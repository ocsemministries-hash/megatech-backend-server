import type { User } from '@prisma/client';
import { prisma } from '../../base/prisma.client';
import { BaseRepository } from '../../base/base.repository';
import type { ModelDelegate } from '../../base/base.repository.types';
import type { CreateUserInput, UpdateUserInput } from './user.schema';

export class UserRepository extends BaseRepository<User, CreateUserInput, UpdateUserInput> {
  constructor() {
    super(prisma.user as unknown as ModelDelegate<User>);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findFirst({ email: email.toLowerCase() });
  }

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    return this.findFirst({ googleSub });
  }

  async findById(id: string): Promise<User | null> {
    return this.findFirst({ id });
  }

  async createUser(data: CreateUserInput): Promise<User> {
    return prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase(),
      },
    });
  }

  async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    return this.update(id, data);
  }

  async setLastLogin(id: string): Promise<void> {
    await this.update(id, { lastLoginAt: new Date() });
  }
}
