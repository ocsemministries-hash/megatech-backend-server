import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/utils/password';

describe('password utils', () => {
  it('hashes a password and verifies it', async () => {
    const hash = await hashPassword('S3cret-pass!');
    expect(hash).not.toBe('S3cret-pass!');
    await expect(verifyPassword('S3cret-pass!', hash)).resolves.toBe(true);
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('produces distinct hashes for the same password (salting)', async () => {
    const a = await hashPassword('same-pass');
    const b = await hashPassword('same-pass');
    expect(a).not.toBe(b);
  });
});
