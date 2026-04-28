import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { notFound } from '../../utils/http-error';

export const certificatesRouter = Router();

const createCertificateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  validityMonths: z.number().int().positive().nullable().optional(),
  templateFileId: z.number().int().positive().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
});

const linkCertificateSchema = z.object({
  certificateId: z.number().int().positive()
});

certificatesRouter.use(authenticate);

certificatesRouter.get(
  '/certificates',
  requireRoles('ADMIN', 'PART_LEADER'),
  asyncHandler(async (_req, res) => {
    const [certificates] = await pool.query(
      `SELECT
        id,
        code,
        name,
        description,
        validity_months AS validityMonths,
        template_file_id AS templateFileId,
        status,
        created_at AS createdAt
      FROM certificates
      ORDER BY created_at DESC`
    );
    res.json({ data: certificates });
  })
);

certificatesRouter.post(
  '/certificates',
  requireRoles('ADMIN'),
  validateBody(createCertificateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createCertificateSchema>;
    const [result] = await pool.query(
      `INSERT INTO certificates (code, name, description, validity_months, template_file_id, status)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        body.code,
        body.name,
        body.description ?? null,
        body.validityMonths ?? null,
        body.templateFileId ?? null,
        body.status
      ]
    );

    res.status(201).json({ id: Number((result as { insertId: number }).insertId) });
  })
);

certificatesRouter.post(
  '/exams/:examId/certificates',
  requireRoles('ADMIN', 'PART_LEADER'),
  validateBody(linkCertificateSchema),
  asyncHandler(async (req, res) => {
    await pool.query(
      `INSERT INTO exam_certificates (exam_id, certificate_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE certificate_id = VALUES(certificate_id)`,
      [req.params.examId, req.body.certificateId]
    );
    res.status(201).json({ ok: true });
  })
);

certificatesRouter.get(
  '/employee-certificates',
  requireRoles('ADMIN', 'PART_LEADER', 'EMPLOYEE'),
  asyncHandler(async (req, res) => {
    const params: unknown[] = [];
    let where = '1 = 1';

    if (!req.user?.roles.includes('ADMIN') && !req.user?.roles.includes('PART_LEADER')) {
      where += ' AND ec.user_id = ?';
      params.push(req.user!.id);
    }

    const [records] = await pool.query(
      `SELECT
        ec.id,
        ec.employee_id AS employeeId,
        ec.employee_no AS employeeNo,
        ec.certificate_no AS certificateNo,
        ec.issued_at AS issuedAt,
        ec.expired_at AS expiredAt,
        ec.status,
        c.name AS certificateName,
        e.title AS examTitle
      FROM employee_certificates ec
      JOIN certificates c ON c.id = ec.certificate_id
      JOIN exams e ON e.id = ec.exam_id
      WHERE ${where}
      ORDER BY ec.issued_at DESC`,
      params
    );

    res.json({ data: records });
  })
);

certificatesRouter.patch(
  '/employee-certificates/:id/status',
  requireRoles('ADMIN'),
  validateBody(z.object({ status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED']) })),
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('UPDATE employee_certificates SET status = ? WHERE id = ?', [
      req.body.status,
      req.params.id
    ]);

    if ((result as { affectedRows: number }).affectedRows === 0) {
      throw notFound('Employee certificate not found');
    }

    res.json({ ok: true });
  })
);
