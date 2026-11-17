import { vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const ENV_KEYS = ['PORT', 'NODE_ENV', 'CORS_ORIGIN', 'ADMIN_WEB_URL', 'FRONTEND_WEB_URL'] as const;
type EnvKey = (typeof ENV_KEYS)[number];
type EnvOverrides = Partial<Record<EnvKey, string>>;

const originalValues: Record<EnvKey, string | undefined> = {
  PORT: undefined,
  NODE_ENV: undefined,
  CORS_ORIGIN: undefined,
};
let captured = false;

export const setEnv = (overrides: EnvOverrides): void => {
  if (!captured) {
    for (const key of ENV_KEYS) {
      originalValues[key] = process.env[key];
    }
    captured = true;
  }

  for (const key of ENV_KEYS) {
    const value = overrides[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.resetModules();
};

export const restoreEnv = (): void => {
  if (!captured) return;
  for (const key of ENV_KEYS) {
    const value = originalValues[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};
