import type { UserStatus } from '@prisma/client';

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  passwordHash?: string | null;
  googleSub?: string | null;
  status?: UserStatus;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  status?: UserStatus;
  passwordHash?: string | null;
  googleSub?: string | null;
  lastLoginAt?: Date;
}
