import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { logger } from '../utils/logger';
import { config } from '../config';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    ApiResponse.error(res, err.message, err.statusCode, err.errors);
    return;
  }

  // Errors raised by express.json() for bad client input must not look like server faults.
  const bodyParserType = (err as Error & { type?: string }).type;
  if (bodyParserType === 'entity.parse.failed') {
    ApiResponse.error(res, 'Invalid JSON in request body', 400);
    return;
  }
  if (bodyParserType === 'entity.too.large') {
    ApiResponse.error(res, 'Request body too large', 413);
    return;
  }

  // Malformed values that slip past validation (NaN ids, unknown enum members, object-typed query
  // parameters) are client errors, not server faults.
  if (err instanceof Prisma.PrismaClientValidationError) {
    ApiResponse.error(res, 'Invalid request parameters', 400);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Write conflict / deadlock between concurrent transactions: the client may simply retry.
    if (err.code === 'P2034') {
      ApiResponse.error(res, 'The request conflicted with another one, please retry', 409);
      return;
    }
    if (err.code === 'P2002') {
      ApiResponse.error(res, 'Duplicate field value', 409);
      return;
    }
    if (err.code === 'P2025') {
      ApiResponse.notFound(res, 'Resource not found');
      return;
    }
    if (err.code === 'P2003') {
      ApiResponse.error(res, 'Invalid reference to a related record', 400);
      return;
    }
  }

  logger.error('Unhandled error:', err);

  ApiResponse.serverError(
    res,
    config.isProd ? 'Something went wrong' : err.message
  );
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  ApiResponse.notFound(res, 'API endpoint not found');
};
