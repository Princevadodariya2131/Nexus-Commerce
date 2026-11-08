import { AppError } from './AppError';

const MAX_UNSIGNED_INT = 4294967295;

/**
 * Parses a numeric resource id from a URL parameter. Anything that is not a positive integer that fits
 * the database's INT UNSIGNED column ("abc", "-1", "1.5", "0", "99999999999") is reported as a clean 404
 * instead of reaching Prisma, where NaN would surface as an unhandled 500.
 */
export function parseIdParam(value: unknown, label = 'Resource'): number {
  const text = typeof value === 'string' ? value : '';
  if (!/^[1-9]\d{0,9}$/.test(text) || Number(text) > MAX_UNSIGNED_INT) {
    throw new AppError(`${label} not found`, 404);
  }
  return Number(text);
}
