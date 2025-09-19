import type { AdminUser, PrismaClient } from '@prisma/client';

export interface CreateAdminUserInput {
  email: string;
  passwordHash: string;
}

export class AdminUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async count(): Promise<number> {
    return this.prisma.adminUser.count();
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    return this.prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() }
    });
  }

  async create(input: CreateAdminUserInput): Promise<AdminUser> {
    return this.prisma.adminUser.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash
      }
    });
  }
}
