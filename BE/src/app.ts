import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { attemptsRouter } from './modules/attempts/attempts.routes';
import { authRouter } from './modules/auth/auth.routes';
import { certificatesRouter } from './modules/certificates/certificates.routes';
import { examsRouter } from './modules/exams/exams.routes';
import { filesRouter } from './modules/files/files.routes';
import { usersRouter } from './modules/users/users.routes';
import { healthRouter } from './routes/health.routes';
import { notFound } from './utils/http-error';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  env.API_PREFIX,
  healthRouter,
  authRouter,
  usersRouter,
  examsRouter,
  certificatesRouter,
  filesRouter,
  attemptsRouter
);

app.use((_req, _res, next) => {
  next(notFound('Route not found'));
});

app.use(errorHandler);
