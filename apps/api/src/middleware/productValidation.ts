import type { Request, Response, NextFunction } from 'express';
import { ROLES } from '@nexus/shared';
import { validate } from './validate';
import {
  adminProductCreateSchema,
  adminProductUpdateSchema,
  vendorProductCreateSchema,
  vendorProductUpdateSchema,
} from '../validators/product.validator';

/**
 * Picks the product whitelist by role. Only administrators get the wider schema
 * (isFeatured, vendorId); every other role, including unknown ones, gets the
 * restrictive vendor schema.
 */
export const validateProductWrite = (mode: 'create' | 'update') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    const isAdmin = role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;
    const schema =
      mode === 'create'
        ? isAdmin
          ? adminProductCreateSchema
          : vendorProductCreateSchema
        : isAdmin
          ? adminProductUpdateSchema
          : vendorProductUpdateSchema;
    validate(schema)(req, res, next);
  };
};
