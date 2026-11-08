import type { Response } from 'express';
import type { ApiResponse as IApiResponse, PaginationMeta } from '@nexus/shared';

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode = 200,
    meta?: PaginationMeta
  ): Response {
    const body: IApiResponse<T> = { success: true, message, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  static created<T>(res: Response, data: T, message = 'Created successfully'): Response {
    return ApiResponse.success(res, data, message, 201);
  }

  static error(
    res: Response,
    message: string,
    statusCode = 400,
    errors?: { field: string; message: string }[]
  ): Response {
    const body: IApiResponse = { success: false, message };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
  }

  static notFound(res: Response, message = 'Resource not found'): Response {
    return ApiResponse.error(res, message, 404);
  }

  static unauthorized(res: Response, message = 'Unauthorized'): Response {
    return ApiResponse.error(res, message, 401);
  }

  static forbidden(res: Response, message = 'Forbidden'): Response {
    return ApiResponse.error(res, message, 403);
  }

  static serverError(res: Response, message = 'Internal server error'): Response {
    return ApiResponse.error(res, message, 500);
  }
}
