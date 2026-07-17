import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((err) => ({
          location: err.path[0],
          field: err.path.slice(1).join('.'),
          message: err.message,
        }));
        next(new AppError('Request validation failed', 400, { validationErrors: errors }));
      } else {
        next(error);
      }
    }
  };
};
