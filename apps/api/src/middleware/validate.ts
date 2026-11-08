import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ApiResponse } from '../utils/ApiResponse';

type RequestPart = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, part: RequestPart = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[part]);
      req[part] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        ApiResponse.error(res, 'Validation failed', 422, errors);
        return;
      }
      next(error);
    }
  };
};
