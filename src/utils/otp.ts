import { randomInt } from 'node:crypto';

export const generateOtp = (digits = 6): string => {
  const min = 10 ** (digits - 1);
  const max = 10 ** digits - 1;
  return String(randomInt(min, max + 1));
};
