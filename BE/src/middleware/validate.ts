import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { badRequest } from '../utils/http-error';

export const validateBody =
  <T>(schema: ZodSchema<T>): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      next(badRequest(parsed.error.issues[0]?.message ?? 'Invalid request body'));
      return;
    }

    req.body = parsed.data;
    next();
  };
