import { Decimal } from '@prisma/client/runtime/library';

/** Convert Prisma models for JSON API responses */
export function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (value instanceof Decimal) return Number(value);
      if (typeof value === 'bigint') return Number(value);
      return value;
    })
  ) as T;
}

export function formatUser(user: Record<string, unknown>) {
  const {
    password,
    refreshToken,
    emailVerificationToken,
    emailVerificationExpires,
    passwordResetToken,
    passwordResetExpires,
    ...safe
  } = user;
  return {
    ...safe,
    _id: String(user.id),
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
  };
}
