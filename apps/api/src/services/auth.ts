import { LoginRequestSchema, type LoginRequest } from '@syncal/core';
import type { AdminUser } from '@prisma/client';
import { verifyPassword } from './password.js';
import type { AdminUserRepository } from '../repositories/admin-user.repository.js';

export interface AuthenticationResult {
  admin: AdminUser;
}

export function parseLoginRequest(payload: unknown): LoginRequest {
  return LoginRequestSchema.parse(payload);
}

export async function authenticateAdmin(
  repository: AdminUserRepository,
  credentials: LoginRequest
): Promise<AuthenticationResult | null> {
  const admin = await repository.findByEmail(credentials.email);
  if (!admin) {
    return null;
  }

  const passwordMatches = await verifyPassword(admin.passwordHash, credentials.password);
  if (!passwordMatches) {
    return null;
  }

  return { admin };
}
