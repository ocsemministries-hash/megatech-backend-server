import type { NextFunction, Request, Response } from 'express';
import { vi } from 'vitest';

export type MockResponse = Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

export const createMockResponse = (): MockResponse => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as MockResponse;

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

export const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    method: 'GET',
    url: '/',
    path: '/',
    headers: {},
    query: {},
    params: {},
    body: {},
    ...overrides,
  }) as Request;

export const createMockNext = (): NextFunction => vi.fn() as unknown as NextFunction;
