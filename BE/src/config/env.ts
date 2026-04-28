import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('exam_certificate_system'),
  JWT_SECRET: z.string().min(8).default('change_me'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  UPLOAD_ROOT: z.string().default('uploads'),
  MAX_PDF_SIZE_MB: z.coerce.number().default(10)
});

export const env = schema.parse(process.env);
