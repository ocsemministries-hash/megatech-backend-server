import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  env: { NODE_ENV: 'test', PORT: 5000, CORS_ORIGIN: ['http://localhost:3000'] },
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/config/env', () => ({ ENV: state.env }));
vi.mock('@/utils/logger', () => ({ logger: state.logger }));

import { errorHandler } from '@/middlewares/errorHandler';
import { expectedErrorPayload, httpError, plainError, serverError } from '../../fixtures/error.fixtures';
import { createMockNext, createMockRequest, createMockResponse } from '../../mocks/express.mock';

const invokeErrorHandler = (error: unknown, nodeEnv: string = 'test') => {
  state.env.NODE_ENV = nodeEnv;

  const req = createMockRequest({ path: '/api/v1/test', method: 'GET' });
  const res = createMockResponse();
  const next = createMockNext();

  errorHandler(error, req, res, next);

  return { req, res, next };
};

afterEach(() => {
  state.env.NODE_ENV = 'test';
  vi.clearAllMocks();
});

describe('errorHandler middleware', () => {
  it('responds with the error statusCode and message in non-production', () => {
    const { res } = invokeErrorHandler(httpError);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expectedErrorPayload('Validation failed'));
  });

  it('defaults to a 500 status when the error has no statusCode', () => {
    const { res } = invokeErrorHandler(plainError);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expectedErrorPayload('Database connection lost'));
  });

  it('logs the error with its stack trace and request path', () => {
    const { req } = invokeErrorHandler(plainError);

    expect(state.logger.error).toHaveBeenCalledWith('Database connection lost', {
      stack: plainError.stack,
      path: req.path,
    });
  });

  it('hides internal messages for 500 errors in production', () => {
    const { res } = invokeErrorHandler(serverError, 'production');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expectedErrorPayload('Internal Server Error'));
    expect(res.json).not.toHaveBeenCalledWith(expectedErrorPayload('Sensitive internal detail'));
  });

  it('still surfaces non-500 error messages in production', () => {
    const { res } = invokeErrorHandler(httpError, 'production');

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expectedErrorPayload('Validation failed'));
  });
});
