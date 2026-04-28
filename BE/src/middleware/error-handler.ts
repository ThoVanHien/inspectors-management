import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = Number(error.statusCode || error.status || 500);

  if (status === 500) {
    console.error(error);
  }

  res.status(status).json({
    message: status === 500 ? 'Internal server error' : error.message
  });
};
