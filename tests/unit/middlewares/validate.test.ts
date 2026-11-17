import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validate } from '@/middlewares/validate';
import { validateQuery } from '@/middlewares/validateQuery';
import { createMockNext, createMockRequest, createMockResponse } from '../../mocks/express.mock';

const bodySchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0),
});

describe('validate middleware', () => {
  it('passes valid bodies through with parsed data', () => {
    const req = createMockRequest({ body: { email: 'a@b.com', age: 12 } });
    const res = createMockResponse();
    const next = createMockNext();

    validate(bodySchema)(req, res, next);

    expect(req.body).toEqual({ email: 'a@b.com', age: 12 });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects invalid bodies with 400', () => {
    const req = createMockRequest({ body: { email: 'not-an-email', age: -3 } });
    const res = createMockResponse();
    const next = createMockNext();

    validate(bodySchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(next).not.toHaveBeenCalled();
  });
});

describe('validateQuery middleware', () => {
  const querySchema = z.object({ page: z.coerce.number().int().default(1) });

  it('coerces and validates query params', () => {
    const req = createMockRequest({ query: { page: '3' } });
    const res = createMockResponse();
    const next = createMockNext();

    validateQuery(querySchema)(req, res, next);

    expect((req.query as { page: number }).page).toBe(3);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid queries', () => {
    const req = createMockRequest({ query: { page: 'abc' } });
    const res = createMockResponse();
    const next = createMockNext();

    validateQuery(querySchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
