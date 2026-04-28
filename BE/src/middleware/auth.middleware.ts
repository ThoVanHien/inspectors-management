import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2';
import { env } from '../config/env';
import { pool } from '../db/pool';
import type { AuthUser, RoleCode } from '../types/auth';
import { forbidden, unauthorized } from '../utils/http-error';

interface JwtPayload {
  sub: string;
}

interface UserRow extends RowDataPacket {
  id: number;
  employee_id: string;
  employee_no: string | null;
  username: string;
  full_name: string | null;
  email: string | null;
  part_code: string | null;
  roles: string | null;
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      throw unauthorized();
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const [rows] = await pool.query<UserRow[]>(
      `SELECT
        u.id,
        u.employee_id,
        u.employee_no,
        u.username,
        u.full_name,
        u.email,
        u.part_code,
        GROUP_CONCAT(r.code ORDER BY r.code) AS roles
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = ? AND u.status = 'ACTIVE'
      GROUP BY u.id`,
      [Number(payload.sub)]
    );

    const user = rows[0];

    if (!user) {
      throw unauthorized();
    }

    req.user = {
      id: user.id,
      employeeId: user.employee_id,
      employeeNo: user.employee_no,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      partCode: user.part_code,
      roles: (user.roles?.split(',') ?? []) as RoleCode[]
    } satisfies AuthUser;

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRoles =
  (...roles: RoleCode[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(unauthorized());
      return;
    }

    const allowed = roles.some((role) => req.user?.roles.includes(role));

    if (!allowed) {
      next(forbidden());
      return;
    }

    next();
  };

export const isAdmin = (user: AuthUser): boolean => user.roles.includes('ADMIN');
export const isPartLeader = (user: AuthUser): boolean => user.roles.includes('PART_LEADER');
