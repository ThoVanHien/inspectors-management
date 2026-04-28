import PDFDocument from 'pdfkit';
import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../../db/pool';
import { authenticate, isAdmin, isPartLeader, requireRoles } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { forbidden, notFound } from '../../utils/http-error';

export const attemptsRouter = Router();

interface AttemptRow extends RowDataPacket {
  id: number;
  exam_id: number;
  user_id: number;
  employee_id: string;
  employee_no: string | null;
  attempt_type: string;
  status: string;
  total_score: string;
  submitted_at: Date | null;
  exam_title: string;
  exam_code: string;
  part_code: string;
  full_name: string | null;
}

attemptsRouter.use(authenticate);

attemptsRouter.get(
  '/attempts',
  requireRoles('ADMIN', 'PART_LEADER', 'EMPLOYEE'),
  asyncHandler(async (req, res) => {
    const params: unknown[] = [];
    let where = '1 = 1';

    if (!isAdmin(req.user!) && isPartLeader(req.user!) && req.user!.partCode) {
      where += ' AND e.part_code = ?';
      params.push(req.user!.partCode);
    } else if (!isAdmin(req.user!) && !isPartLeader(req.user!)) {
      where += ' AND ea.user_id = ?';
      params.push(req.user!.id);
    }

    const [attempts] = await pool.query(
      `SELECT
        ea.id,
        ea.employee_id AS employeeId,
        ea.employee_no AS employeeNo,
        ea.attempt_type AS attemptType,
        ea.status,
        ea.total_score AS totalScore,
        ea.submitted_at AS submittedAt,
        e.code AS examCode,
        e.title AS examTitle
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ${where}
      ORDER BY ea.created_at DESC`,
      params
    );

    res.json({ data: attempts });
  })
);

attemptsRouter.get(
  '/attempts/:id/review',
  requireRoles('ADMIN', 'PART_LEADER', 'EMPLOYEE'),
  asyncHandler(async (req, res) => {
    const attempt = await loadAttempt(Number(req.params.id));
    assertAttemptAccess(req.user!, attempt);
    const answers = await loadAttemptAnswers(attempt.id);

    res.json({ data: { attempt: mapAttempt(attempt), answers } });
  })
);

attemptsRouter.get(
  '/attempts/:id/pdf',
  requireRoles('ADMIN', 'PART_LEADER', 'EMPLOYEE'),
  asyncHandler(async (req, res) => {
    const attempt = await loadAttempt(Number(req.params.id));
    assertAttemptAccess(req.user!, attempt);
    const answers = await loadAttemptAnswers(attempt.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="attempt-${attempt.id}.pdf"`);

    const document = new PDFDocument({ margin: 48 });
    document.pipe(res);

    document.fontSize(18).text('Exam Attempt Result');
    document.moveDown();
    document.fontSize(12).text(`Exam: ${attempt.exam_code} - ${attempt.exam_title}`);
    document.text(`Employee: ${attempt.full_name ?? attempt.employee_id} (${attempt.employee_no ?? 'N/A'})`);
    document.text(`Status: ${attempt.status}`);
    document.text(`Score: ${Number(attempt.total_score).toFixed(2)}`);
    document.text(`Submitted: ${attempt.submitted_at ? attempt.submitted_at.toISOString() : 'N/A'}`);
    document.moveDown();

    answers.forEach((answer, index) => {
      document.fontSize(11).text(`${index + 1}. ${answer.questionContent}`);
      document.text(`Selected: ${answer.selectedOptions || answer.answerText || 'N/A'}`);
      document.text(`Correct: ${answer.correctOptions || 'N/A'}`);
      document.text(`Score: ${Number(answer.score).toFixed(2)}`);
      document.moveDown(0.5);
    });

    document.end();
  })
);

async function loadAttempt(id: number): Promise<AttemptRow> {
  const [rows] = await pool.query<AttemptRow[]>(
    `SELECT
      ea.*,
      e.code AS exam_code,
      e.title AS exam_title,
      e.part_code,
      u.full_name
    FROM exam_attempts ea
    JOIN exams e ON e.id = ea.exam_id
    JOIN users u ON u.id = ea.user_id
    WHERE ea.id = ?`,
    [id]
  );

  const attempt = rows[0];

  if (!attempt) {
    throw notFound('Attempt not found');
  }

  return attempt;
}

function assertAttemptAccess(user: NonNullable<Express.Request['user']>, attempt: AttemptRow): void {
  if (isAdmin(user)) {
    return;
  }

  if (isPartLeader(user) && user.partCode === attempt.part_code) {
    return;
  }

  if (attempt.user_id === user.id) {
    return;
  }

  throw forbidden();
}

function mapAttempt(attempt: AttemptRow) {
  return {
    id: attempt.id,
    employeeId: attempt.employee_id,
    employeeNo: attempt.employee_no,
    attemptType: attempt.attempt_type,
    status: attempt.status,
    totalScore: Number(attempt.total_score),
    submittedAt: attempt.submitted_at,
    exam: {
      id: attempt.exam_id,
      code: attempt.exam_code,
      title: attempt.exam_title,
      partCode: attempt.part_code
    }
  };
}

async function loadAttemptAnswers(attemptId: number) {
  const [answers] = await pool.query<
    Array<
      RowDataPacket & {
      id: number;
      questionId: number;
      questionContent: string;
      answerText: string | null;
      isCorrect: 0 | 1;
      score: string;
      selectedOptions: string | null;
      correctOptions: string | null;
    }>
  >(
    `SELECT
      aa.id,
      q.id AS questionId,
      q.content AS questionContent,
      aa.answer_text AS answerText,
      aa.is_correct AS isCorrect,
      aa.score,
      GROUP_CONCAT(DISTINCT selected.content ORDER BY selected.order_no SEPARATOR ', ') AS selectedOptions,
      GROUP_CONCAT(DISTINCT correct.content ORDER BY correct.order_no SEPARATOR ', ') AS correctOptions
    FROM attempt_answers aa
    JOIN questions q ON q.id = aa.question_id
    LEFT JOIN attempt_answer_options aao ON aao.attempt_answer_id = aa.id
    LEFT JOIN question_options selected ON selected.id = aao.option_id
    LEFT JOIN question_options correct ON correct.question_id = q.id AND correct.is_correct = TRUE
    WHERE aa.attempt_id = ?
    GROUP BY aa.id, q.id
    ORDER BY q.order_no, q.id`,
    [attemptId]
  );

  return answers.map((answer) => ({
    ...answer,
    isCorrect: Boolean(answer.isCorrect),
    score: Number(answer.score)
  }));
}
