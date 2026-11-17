import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

/** Parses and validates req.query against a zod schema, replacing it with the result. */
export const validateQuery =
  (schema: z.ZodType<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      res.status(400).json({
        success: false,
        error: firstIssue ? `${firstIssue.path.join('.') || 'query'}: ${firstIssue.message}` : 'Invalid query',
      });
      return;
    }
    // Express 5 exposes `req.query` as a getter-only property, so a plain
    // assignment throws in strict mode; redefine it on the instance instead.
    Object.defineProperty(req, 'query', {
      value: parsed.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    next();
  };
