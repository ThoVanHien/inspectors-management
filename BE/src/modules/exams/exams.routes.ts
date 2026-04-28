import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { authenticate, isAdmin, isPartLeader, requireRoles } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { badRequest, forbidden, notFound } from '../../utils/http-error';

export const examsRouter = Router();

interface ExamRow extends RowDataPacket {
  id: number;
  code: string;
  title: string;
  description: string | null;
  part_code: string;
  duration_minutes: number;
  pass_score: string;
  status: string;
  created_by: number;
}

interface QuestionRow extends RowDataPacket {
  id: number;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  content: string;
  score: string;
  order_no: number;
}

interface OptionRow extends RowDataPacket {
  id: number;
  question_id: number;
  content: string;
  is_correct: 0 | 1;
  order_no: number;
}

const createExamSchema = z.object({
  code: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  partCode: z.string().trim().min(1).max(50),
  durationMinutes: z.number().int().positive().default(30),
  maxAttempts: z.number().int().positive().nullable().optional(),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']).default('DRAFT')
});

const createQuestionSchema = z.object({
  type: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE']).default('SINGLE_CHOICE'),
  content: z.string().trim().min(1),
  score: z.number().positive().default(1),
  orderNo: z.number().int().min(0).default(0),
  options: z
    .array(
      z.object({
        content: z.string().trim().min(1),
        isCorrect: z.boolean().default(false),
        orderNo: z.number().int().min(0).default(0)
      })
    )
    .min(2)
});

const submitExamSchema = z.object({
  startedAt: z.string().datetime().optional(),
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        optionIds: z.array(z.number().int().positive()).default([]),
        answerText: z.string().trim().optional()
      })
    )
    .min(1)
});

examsRouter.use(authenticate);

examsRouter.get(
  '/exams',
  asyncHandler(async (req, res) => {
    const params: unknown[] = [];
    let where = '1 = 1';

    if (!isAdmin(req.user!) && isPartLeader(req.user!) && req.user!.partCode) {
      where += ' AND e.part_code = ?';
      params.push(req.user!.partCode);
    }

    const [exams] = await pool.query(
      `SELECT
        e.id,
        e.code,
        e.title,
        e.description,
        e.part_code AS partCode,
        e.duration_minutes AS durationMinutes,
        e.pass_score AS passScore,
        e.status,
        e.created_at AS createdAt,
        u.full_name AS createdByName
      FROM exams e
      JOIN users u ON u.id = e.created_by
      WHERE ${where}
      ORDER BY e.created_at DESC`,
      params
    );

    res.json({ data: exams });
  })
);

examsRouter.post(
  '/exams',
  requireRoles('ADMIN', 'PART_LEADER'),
  validateBody(createExamSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createExamSchema>;

    if (!isAdmin(req.user!) && body.partCode !== req.user!.partCode) {
      throw forbidden('Part leaders can only create exams for their own part');
    }

    const [result] = await pool.query(
      `INSERT INTO exams
        (code, title, description, part_code, duration_minutes, max_attempts, shuffle_questions, shuffle_options, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.code,
        body.title,
        body.description ?? null,
        body.partCode,
        body.durationMinutes,
        body.maxAttempts ?? null,
        body.shuffleQuestions,
        body.shuffleOptions,
        body.status,
        req.user!.id
      ]
    );

    res.status(201).json({ id: Number((result as { insertId: number }).insertId) });
  })
);

examsRouter.get(
  '/exams/:id',
  requireRoles('ADMIN', 'PART_LEADER'),
  asyncHandler(async (req, res) => {
    const exam = await loadExam(Number(req.params.id));
    await assertExamManageAccess(req.user!, exam);
    const questions = await loadQuestionsWithOptions(exam.id, true);

    res.json({ data: { ...mapExam(exam), questions } });
  })
);

examsRouter.patch(
  '/exams/:id/status',
  requireRoles('ADMIN', 'PART_LEADER'),
  validateBody(z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']) })),
  asyncHandler(async (req, res) => {
    const exam = await loadExam(Number(req.params.id));
    await assertExamManageAccess(req.user!, exam);
    await pool.query('UPDATE exams SET status = ? WHERE id = ?', [req.body.status, exam.id]);
    res.json({ ok: true });
  })
);

examsRouter.post(
  '/exams/:id/questions',
  requireRoles('ADMIN', 'PART_LEADER'),
  validateBody(createQuestionSchema),
  asyncHandler(async (req, res) => {
    const exam = await loadExam(Number(req.params.id));
    await assertExamManageAccess(req.user!, exam);

    const body = req.body as z.infer<typeof createQuestionSchema>;
    const correctCount = body.options.filter((option) => option.isCorrect).length;

    if (correctCount === 0) {
      throw badRequest('At least one option must be marked as correct');
    }

    if (body.type !== 'MULTIPLE_CHOICE' && correctCount > 1) {
      throw badRequest('Single choice and true/false questions can only have one correct option');
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [questionResult] = await connection.query(
        `INSERT INTO questions (exam_id, type, content, score, order_no)
        VALUES (?, ?, ?, ?, ?)`,
        [exam.id, body.type, body.content, body.score, body.orderNo]
      );
      const questionId = Number((questionResult as { insertId: number }).insertId);

      for (const option of body.options) {
        await connection.query(
          `INSERT INTO question_options (question_id, content, is_correct, order_no)
          VALUES (?, ?, ?, ?)`,
          [questionId, option.content, option.isCorrect, option.orderNo]
        );
      }

      await connection.commit();
      res.status(201).json({ id: questionId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

examsRouter.get(
  '/exams/:id/take',
  requireRoles('ADMIN', 'PART_LEADER', 'EMPLOYEE'),
  asyncHandler(async (req, res) => {
    const exam = await loadExam(Number(req.params.id));

    if (exam.status !== 'PUBLISHED') {
      throw badRequest('Exam is not published');
    }

    if (!isAdmin(req.user!) && req.user!.partCode && req.user!.partCode !== exam.part_code) {
      throw forbidden('This exam is not assigned to your part');
    }

    const questions = await loadQuestionsWithOptions(exam.id, false);
    res.json({ data: { ...mapExam(exam), questions } });
  })
);

examsRouter.post(
  '/exams/:id/submit',
  requireRoles('ADMIN', 'PART_LEADER', 'EMPLOYEE'),
  validateBody(submitExamSchema),
  asyncHandler(async (req, res) => {
    const exam = await loadExam(Number(req.params.id));

    if (exam.status !== 'PUBLISHED') {
      throw badRequest('Exam is not published');
    }

    if (!isAdmin(req.user!) && req.user!.partCode && req.user!.partCode !== exam.part_code) {
      throw forbidden('This exam is not assigned to your part');
    }

    const body = req.body as z.infer<typeof submitExamSchema>;
    const questions = await loadRawQuestions(exam.id);
    const options = await loadRawOptions(exam.id);

    if (questions.length === 0) {
      throw badRequest('Exam has no active questions');
    }

    const answerByQuestionId = new Map(body.answers.map((answer) => [answer.questionId, answer]));
    const maxScore = questions.reduce((sum, question) => sum + Number(question.score), 0);
    let totalScore = 0;
    const graded = questions.map((question) => {
      const questionOptions = options.filter((option) => option.question_id === question.id);
      const correctIds = questionOptions.filter((option) => Boolean(option.is_correct)).map((option) => option.id).sort();
      const selectedIds = [...(answerByQuestionId.get(question.id)?.optionIds ?? [])].sort();
      const isCorrect = correctIds.length === selectedIds.length && correctIds.every((id, index) => id === selectedIds[index]);
      const score = isCorrect ? Number(question.score) : 0;
      totalScore += score;

      return {
        questionId: question.id,
        selectedIds,
        answerText: answerByQuestionId.get(question.id)?.answerText ?? null,
        isCorrect,
        score
      };
    });
    const percentage = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;
    const passed = percentage >= Number(exam.pass_score);

    if (!passed) {
      await pool.query(
        `INSERT INTO exam_fail_logs (exam_id, user_id, employee_id, employee_no, total_score)
        VALUES (?, ?, ?, ?, ?)`,
        [exam.id, req.user!.id, req.user!.employeeId, req.user!.employeeNo, percentage]
      );

      res.json({ passed: false, totalScore: percentage, requiredScore: Number(exam.pass_score) });
      return;
    }

    const attemptId = await savePassedAttempt(exam, req.user!, body.startedAt ?? null, percentage, graded);
    res.status(201).json({ passed: true, totalScore: percentage, attemptId });
  })
);

async function loadExam(id: number): Promise<ExamRow> {
  const [rows] = await pool.query<ExamRow[]>('SELECT * FROM exams WHERE id = ?', [id]);
  const exam = rows[0];

  if (!exam) {
    throw notFound('Exam not found');
  }

  return exam;
}

async function assertExamManageAccess(user: Express.Request['user'], exam: ExamRow): Promise<void> {
  if (!user) {
    throw forbidden();
  }

  if (!isAdmin(user) && exam.part_code !== user.partCode) {
    throw forbidden('Part leaders can only manage exams for their own part');
  }
}

function mapExam(exam: ExamRow) {
  return {
    id: exam.id,
    code: exam.code,
    title: exam.title,
    description: exam.description,
    partCode: exam.part_code,
    durationMinutes: exam.duration_minutes,
    passScore: Number(exam.pass_score),
    status: exam.status
  };
}

async function loadRawQuestions(examId: number): Promise<QuestionRow[]> {
  const [questions] = await pool.query<QuestionRow[]>(
    `SELECT id, type, content, score, order_no FROM questions
    WHERE exam_id = ? AND status = 'ACTIVE'
    ORDER BY order_no, id`,
    [examId]
  );
  return questions;
}

async function loadRawOptions(examId: number): Promise<OptionRow[]> {
  const [options] = await pool.query<OptionRow[]>(
    `SELECT qo.id, qo.question_id, qo.content, qo.is_correct, qo.order_no
    FROM question_options qo
    JOIN questions q ON q.id = qo.question_id
    WHERE q.exam_id = ? AND q.status = 'ACTIVE'
    ORDER BY qo.order_no, qo.id`,
    [examId]
  );
  return options;
}

async function loadQuestionsWithOptions(examId: number, includeCorrect: boolean) {
  const questions = await loadRawQuestions(examId);
  const options = await loadRawOptions(examId);

  return questions.map((question) => ({
    id: question.id,
    type: question.type,
    content: question.content,
    score: Number(question.score),
    orderNo: question.order_no,
    options: options
      .filter((option) => option.question_id === question.id)
      .map((option) => ({
        id: option.id,
        content: option.content,
        orderNo: option.order_no,
        ...(includeCorrect ? { isCorrect: Boolean(option.is_correct) } : {})
      }))
  }));
}

async function savePassedAttempt(
  exam: ExamRow,
  user: NonNullable<Express.Request['user']>,
  startedAt: string | null,
  totalScore: number,
  graded: Array<{ questionId: number; selectedIds: number[]; answerText: string | null; isCorrect: boolean; score: number }>
): Promise<number> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [attemptResult] = await connection.query(
      `INSERT INTO exam_attempts
        (exam_id, user_id, employee_id, employee_no, attempt_type, status, total_score, is_passed, started_at, submitted_at)
      VALUES (?, ?, ?, ?, 'ONLINE', 'PASSED', ?, TRUE, ?, CURRENT_TIMESTAMP)`,
      [exam.id, user.id, user.employeeId, user.employeeNo, totalScore, startedAt]
    );
    const attemptId = Number((attemptResult as { insertId: number }).insertId);

    for (const answer of graded) {
      const [answerResult] = await connection.query(
        `INSERT INTO attempt_answers (attempt_id, question_id, answer_text, is_correct, score)
        VALUES (?, ?, ?, ?, ?)`,
        [attemptId, answer.questionId, answer.answerText, answer.isCorrect, answer.score]
      );
      const attemptAnswerId = Number((answerResult as { insertId: number }).insertId);

      for (const optionId of answer.selectedIds) {
        await connection.query(
          'INSERT INTO attempt_answer_options (attempt_answer_id, option_id) VALUES (?, ?)',
          [attemptAnswerId, optionId]
        );
      }
    }

    const [certificates] = await connection.query<Array<RowDataPacket & { certificate_id: number }>>(
      'SELECT certificate_id FROM exam_certificates WHERE exam_id = ?',
      [exam.id]
    );

    for (const certificate of certificates) {
      await connection.query(
        `INSERT INTO employee_certificates
          (employee_id, employee_no, user_id, certificate_id, exam_id, attempt_id, certificate_no, issued_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.employeeId,
          user.employeeNo,
          user.id,
          certificate.certificate_id,
          exam.id,
          attemptId,
          `CERT-${exam.code}-${user.employeeId}-${Date.now()}-${certificate.certificate_id}`,
          null
        ]
      );
    }

    await connection.commit();
    return attemptId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
