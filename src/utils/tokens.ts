import { createHash, randomBytes } from 'node:crypto';

/** Deterministic opaque token used for lookups + storage. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const generateOpaqueToken = (bytes = 32): string => randomBytes(bytes).toString('hex');
