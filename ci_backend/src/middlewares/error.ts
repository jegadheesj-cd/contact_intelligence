import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import logger from '../config/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorDetails: any = {};

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorDetails = err.errorDetails || {};
  } else if (err.name === 'ZodError') {
    // Handled in validator middleware, but in case it bubbles up
    statusCode = 400;
    message = 'Validation Error';
    errorDetails = err;
  } else {
    logger.error('Unexpected error: %s', err.stack || err.message);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      ...errorDetails,
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
  });
};
