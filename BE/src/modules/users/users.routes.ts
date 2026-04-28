import bcrypt from 'bcryptjs';
import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { pool } from '../../db/pool';
import { authenticate, requireRoles } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { badRequest, notFound } from '../../utils/http-error';

export const usersRouter = Router();

const createUserSchema = z.object({
  employeeId: z.string().trim().min(1),
  employeeNo: z.string().trim().optional(),
  username: z.string().trim().min(3),
  password: z.string().min(8),
  email: z.string().email().optional(),
  fullName: z.string().trim().optional(),
  partCode: z.string().trim().optional(),
  groupCode: z.string().trim().optional(),
  team: z.string().trim().optional(),
  roles: z.array(z.enum(['ADMIN', 'PART_LEADER', 'EMPLOYEE'])).min(1).default(['EMPLOYEE'])
});

usersRouter.use(authenticate);

usersRouter.get(
  '/roles',
  requireRoles('ADMIN', 'PART_LEADER'),
  asyncHandler(async (_req, res) => {
    const [roles] = await pool.query('SELECT id, code, name, description FROM roles ORDER BY id');
    res.json({ data: roles });
  })
);

usersRouter.get(
  '/users',
  requireRoles('ADMIN', 'PART_LEADER'),
  asyncHandler(async (_req, res) => {
    const [users] = await pool.query(
      `SELECT
        u.id,
        u.employee_id AS employeeId,
        u.employee_no AS employeeNo,
        u.username,
        u.email,
        u.full_name AS fullName,
        u.part_code AS partCode,
        u.group_code AS groupCode,
        u.team,
        u.status,
        u.last_login_at AS lastLoginAt,
        GROUP_CONCAT(r.code ORDER BY r.code) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      GROUP BY u.id
      ORDER BY u.created_at DESC`
    );

    res.json({ data: users });
  })
);

usersRouter.post(
  '/users',
  requireRoles('ADMIN'),
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createUserSchema>;
    const passwordHash = await bcrypt.hash(body.password, 12);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [userResult] = await connection.query(
        `INSERT INTO users
          (employee_id, employee_no, username, password_hash, email, full_name, part_code, group_code, team)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          body.employeeId,
          body.employeeNo ?? null,
          body.username,
          passwordHash,
          body.email ?? null,
          body.fullName ?? null,
          body.partCode ?? null,
          body.groupCode ?? null,
          body.team ?? null
        ]
      );

      const userId = Number((userResult as { insertId: number }).insertId);
      const [roleRows] = await connection.query<Array<RowDataPacket & { id: number; code: string }>>(
        `SELECT id, code FROM roles WHERE code IN (${body.roles.map(() => '?').join(',')})`,
        body.roles
      );

      if (roleRows.length !== body.roles.length) {
        throw badRequest('One or more roles are invalid');
      }

      for (const role of roleRows) {
        await connection.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, role.id]);
      }

      await connection.commit();
      res.status(201).json({ id: userId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

usersRouter.patch(
  '/users/:id/status',
  requireRoles('ADMIN'),
  validateBody(z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) })),
  asyncHandler(async (req, res) => {
    const [result] = await pool.query('UPDATE users SET status = ? WHERE id = ?', [req.body.status, req.params.id]);

    if ((result as { affectedRows: number }).affectedRows === 0) {
      throw notFound('User not found');
    }

    res.json({ ok: true });
  })
);
