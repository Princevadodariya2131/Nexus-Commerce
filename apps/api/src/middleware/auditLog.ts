import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { param } from '../utils/param';

export const auditLog = (action: string, resource: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      if (res.statusCode < 400) {
        prisma.auditLog
          .create({
            data: {
              userId: req.user?.userId ? parseInt(req.user.userId, 10) : null,
              action,
              resource,
              resourceId: req.params.id ? param(req, 'id') : undefined,
              details: { method: req.method, path: req.path },
              ip: req.ip,
              userAgent: req.get('user-agent'),
            },
          })
          .catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
};
