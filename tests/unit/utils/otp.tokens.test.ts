import { describe, expect, it } from 'vitest';
import { generateOtp } from '@/utils/otp';
import { generateOpaqueToken, hashToken } from '@/utils/tokens';

describe('otp utils', () => {
  it('generates a numeric code of the requested length', () => {
    const otp = generateOtp(6);
    expect(otp).toMatch(/^\d{6}$/);
  });
});

describe('token utils', () => {
  it('generates a long opaque token', () => {
    expect(generateOpaqueToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes tokens deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
    expect(hashToken('abc')).not.toBe(hashToken('abd'));
  });
});
