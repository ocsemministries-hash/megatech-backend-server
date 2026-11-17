import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

/**
 * Validates a request body (or object shape) against a zod schema and replaces
 * req.body with the validated (parsed) result.
 */
export const validate =
  (schema: z.ZodType<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        success: false,
        error: firstIssue ? `${firstIssue.path.join('.') || 'body'}: ${firstIssue.message}` : 'Invalid request body',
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
