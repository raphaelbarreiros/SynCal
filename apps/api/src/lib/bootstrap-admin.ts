import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { LoginRequestSchema } from '@syncal/core';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { AppEnv } from '@syncal/config';
import { hashPassword } from '../services/password.js';
import { maskEmail } from './mask.js';

interface BootstrapCredentials {
  email: string;
  password: string;
  source: 'env' | 'prompt';
}

function createInterface() {
  return readline.createInterface({
    input,
    output,
    terminal: true
  });
}

async function prompt(question: string, { mask = false } = {}): Promise<string> {
  const rl = createInterface();
  const originalWrite = (rl as any)._writeToOutput;

  if (mask) {
    (rl as any)._writeToOutput = function (stringToWrite: string) {
      if (stringToWrite.includes('\n')) {
        originalWrite.call(rl, stringToWrite);
        return;
      }

      const trimmed = stringToWrite.trim();
      if (!trimmed) {
        return;
      }

      originalWrite.call(rl, '*');
    };
  }

  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => {
      if (mask) {
        (rl as any)._writeToOutput = originalWrite;
      }

      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptForCredentials(): Promise<BootstrapCredentials> {
  const email = await prompt('Initial admin email: ');

  let password: string = '';
  let confirmation: string = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    password = await prompt('Initial admin password: ', { mask: true });
    confirmation = await prompt('Confirm password: ', { mask: true });

    if (password === confirmation) {
      break;
    }

    output.write('\nPasswords did not match. Please try again.\n');
  }

  if (password !== confirmation) {
    throw new Error('Password confirmation failed');
  }

  const parsed = LoginRequestSchema.parse({ email, password });
  return { ...parsed, source: 'prompt' };
}

function readEnvCredentials(env: AppEnv): BootstrapCredentials | null {
  const email = env.INITIAL_ADMIN_EMAIL?.trim();
  const password = env.INITIAL_ADMIN_PASSWORD?.trim();

  if (!email || !password) {
    return null;
  }

  const parsed = LoginRequestSchema.parse({ email, password });
  return { ...parsed, source: 'env' };
}

async function resolveCredentials(app: FastifyInstance, env: AppEnv): Promise<BootstrapCredentials> {
  const envCredentials = readEnvCredentials(env);
  if (envCredentials) {
    delete (process.env as Record<string, string | undefined>).INITIAL_ADMIN_PASSWORD;
    return envCredentials;
  }

  if (!input.isTTY) {
    throw new Error('Initial admin credentials must be provided via environment in non-interactive mode');
  }

  return promptForCredentials();
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function ensureInitialAdmin(app: FastifyInstance, env: AppEnv): Promise<void> {
  const existingAdmins = await app.repos.adminUsers.count();
  if (existingAdmins > 0) {
    app.log.info('Admin records already present; skipping initial admin bootstrap');
    return;
  }

  const credentials = await resolveCredentials(app, env);
  const passwordHash = await hashPassword(credentials.password);

  try {
    const admin = await app.repos.adminUsers.create({
      email: credentials.email,
      passwordHash
    });

    await app.repos.auditLogs.create({
      actorId: admin.id,
      action: 'admin.bootstrap',
      entityType: 'admin_user',
      entityId: admin.id,
      metadata: {
        method: credentials.source
      }
    });

    app.log.info(
      {
        event: 'admin_bootstrap',
        email: maskEmail(credentials.email),
        method: credentials.source
      },
      'Initial admin account created'
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existingAdmin = await app.repos.adminUsers.findByEmail(credentials.email);
      if (existingAdmin) {
        app.log.info(
          {
            event: 'admin_bootstrap_race',
            email: maskEmail(credentials.email),
            method: credentials.source
          },
          'Initial admin already created by another instance; skipping bootstrap'
        );
        return;
      }
    }

    throw error;
  }
}
