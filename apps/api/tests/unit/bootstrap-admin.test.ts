import { describe, expect, it, vi, afterEach } from 'vitest';
import { Prisma, type AdminUser } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { AppEnv } from '@syncal/config';
import { ensureInitialAdmin } from '../../src/lib/bootstrap-admin.js';

interface AdminRepoStub {
  count: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  findByEmail: ReturnType<typeof vi.fn>;
}

interface AuditRepoStub {
  create: ReturnType<typeof vi.fn>;
}

interface TestContext {
  app: FastifyInstance;
  adminRepo: AdminRepoStub;
  auditRepo: AuditRepoStub;
  log: { info: ReturnType<typeof vi.fn> };
  env: AppEnv;
}

const baseEnv: AppEnv = {
  NODE_ENV: 'test',
  PORT: 3001,
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  SESSION_SECRET: 's'.repeat(64),
  ENCRYPTION_KEY: 'e'.repeat(64),
  INITIAL_ADMIN_EMAIL: undefined,
  INITIAL_ADMIN_PASSWORD: undefined,
  LOG_LEVEL: 'silent',
  WORKER_HEARTBEAT_INTERVAL_MS: 5000,
  AUTH_SESSION_RATE_LIMIT_MAX: 25
};

function createContext(overrides: Partial<AppEnv> = {}): TestContext {
  const adminRepo: AdminRepoStub = {
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    findByEmail: vi.fn()
  };
  const auditRepo: AuditRepoStub = {
    create: vi.fn()
  };
  const log = {
    info: vi.fn()
  };

  const app = {
    repos: { adminUsers: adminRepo, auditLogs: auditRepo },
    log
  } as unknown as FastifyInstance;

  const env: AppEnv = { ...baseEnv, ...overrides };

  return { app, adminRepo, auditRepo, log, env };
}

describe('ensureInitialAdmin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (process.env as Record<string, string | undefined>).INITIAL_ADMIN_PASSWORD;
  });

  it('handles concurrent bootstrap unique constraint gracefully', async () => {
    const { app, adminRepo, auditRepo, log, env } = createContext({
      INITIAL_ADMIN_EMAIL: 'admin@example.com',
      INITIAL_ADMIN_PASSWORD: 'AdminPassword123!'
    });

    (process.env as Record<string, string | undefined>).INITIAL_ADMIN_PASSWORD = env.INITIAL_ADMIN_PASSWORD;

    const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`email`)', {
      code: 'P2002',
      clientVersion: '6.16.2',
      meta: { target: ['adminUser_email_key'] }
    });

    adminRepo.create.mockRejectedValue(uniqueConstraintError);

    const existingAdmin: Partial<AdminUser> = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@example.com'
    };
    adminRepo.findByEmail.mockResolvedValue(existingAdmin);

    await expect(ensureInitialAdmin(app, env)).resolves.toBeUndefined();

    expect(adminRepo.create).toHaveBeenCalledTimes(1);
    expect(adminRepo.findByEmail).toHaveBeenCalledWith('admin@example.com');
    expect(auditRepo.create).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'admin_bootstrap_race' }),
      expect.stringContaining('Initial admin already created by another instance')
    );
    expect((process.env as Record<string, string | undefined>).INITIAL_ADMIN_PASSWORD).toBeUndefined();
  });

  it('rethrows when unique constraint occurs without matching admin', async () => {
    const { app, adminRepo, env } = createContext({
      INITIAL_ADMIN_EMAIL: 'admin@example.com',
      INITIAL_ADMIN_PASSWORD: 'AdminPassword123!'
    });

    (process.env as Record<string, string | undefined>).INITIAL_ADMIN_PASSWORD = env.INITIAL_ADMIN_PASSWORD;

    const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`email`)', {
      code: 'P2002',
      clientVersion: '6.16.2',
      meta: { target: ['adminUser_email_key'] }
    });

    adminRepo.create.mockRejectedValue(uniqueConstraintError);
    adminRepo.findByEmail.mockResolvedValue(null);

    await expect(ensureInitialAdmin(app, env)).rejects.toThrow(uniqueConstraintError);
  });
});
