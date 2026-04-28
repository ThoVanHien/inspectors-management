import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { env } from '../../config/env';
import { pool } from '../../db/pool';
import { authenticate } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate';
import { asyncHandler } from '../../utils/async-handler';
import { badRequest, forbidden, unauthorized } from '../../utils/http-error';

export const authRouter = Router();

interface UserLoginRow extends RowDataPacket {
  id: number;
  employee_id: string;
  employee_no: string | null;
  username: string;
  password_hash: string;
  email: string | null;
  full_name: string | null;
  part_code: string | null;
  roles: string | null;
}

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

const bootstrapAdminSchema = z.object({
  employeeId: z.string().trim().min(1),
  employeeNo: z.string().trim().optional(),
  username: z.string().trim().min(3),
  password: z.string().min(8),
  email: z.string().email().optional(),
  fullName: z.string().trim().optional(),
  partCode: z.string().trim().optional()
});

authRouter.post(
  '/auth/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as z.infer<typeof loginSchema>;

    const [rows] = await pool.query<UserLoginRow[]>(
      `SELECT
        u.id,
        u.employee_id,
        u.employee_no,
        u.username,
        u.password_hash,
        u.email,
        u.full_name,
        u.part_code,
        GROUP_CONCAT(r.code ORDER BY r.code) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.username = ? AND u.status = 'ACTIVE'
      GROUP BY u.id`,
      [username]
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw unauthorized('Invalid username or password');
    }

    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
    const token = jwt.sign({ sub: String(user.id) }, env.JWT_SECRET, options);

    res.json({
      token,
      user: {
        id: user.id,
        employeeId: user.employee_id,
        employeeNo: user.employee_no,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        partCode: user.part_code,
        roles: user.roles?.split(',') ?? []
      }
    });
  })
);

authRouter.post(
  '/auth/bootstrap-admin',
  validateBody(bootstrapAdminSchema),
  asyncHandler(async (req, res) => {
    const [userCountRows] = await pool.query<Array<RowDataPacket & { count: number }>>(
      'SELECT COUNT(*) AS count FROM users'
    );

    if (userCountRows[0]?.count) {
      throw forbidden('Bootstrap admin is only available before the first user is created');
    }

    const body = req.body as z.infer<typeof bootstrapAdminSchema>;
    const passwordHash = await bcrypt.hash(body.password, 12);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO users
          (employee_id, employee_no, username, password_hash, email, full_name, part_code)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          body.employeeId,
          body.employeeNo ?? null,
          body.username,
          passwordHash,
          body.email ?? null,
          body.fullName ?? null,
          body.partCode ?? null
        ]
      );

      const userId = Number((result as { insertId: number }).insertId);
      const [roleRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
        'SELECT id FROM roles WHERE code = ?',
        ['ADMIN']
      );
      const roleId = roleRows[0]?.id;

      if (!roleId) {
        throw badRequest('ADMIN role is missing. Run npm run db:seed first.');
      }

      await connection.query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      await connection.commit();

      res.status(201).json({ id: userId, username: body.username, roles: ['ADMIN'] });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

authRouter.get(
  '/auth/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  })
);
