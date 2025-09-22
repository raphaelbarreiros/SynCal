import fastifyEnv from '@fastify/env';
import type { FastifyInstance } from 'fastify';
import dotenvFlow from 'dotenv-flow';
import { z } from 'zod';

type NodeEnv = 'development' | 'test' | 'production';

const DEFAULT_LOGIN_RATE_LIMIT =
  (process.env.NODE_ENV as NodeEnv | undefined) === 'production' ? 5 : 25;

const FASTIFY_CONF_KEY = 'config' as const;

const zEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default((process.env.NODE_ENV as NodeEnv | undefined) ?? 'development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z
    .string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  CORS_ALLOWED_ORIGIN: z
    .string()
    .optional(),
  INITIAL_ADMIN_EMAIL: z
    .string()
    .email('INITIAL_ADMIN_EMAIL must be a valid email address')
    .optional(),
  INITIAL_ADMIN_PASSWORD: z
    .string()
    .min(12, 'INITIAL_ADMIN_PASSWORD must be at least 12 characters')
    .optional(),
  LOG_LEVEL: z
    .string()
    .default('info'),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  AUTH_SESSION_RATE_LIMIT_MAX: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_LOGIN_RATE_LIMIT)
});

export type AppEnv = z.infer<typeof zEnvSchema>;

const fastifyEnvSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'SESSION_SECRET', 'ENCRYPTION_KEY'],
  properties: {
    NODE_ENV: {
      type: 'string',
      default: 'development'
    },
    PORT: {
      type: 'integer',
      default: 3001
    },
    DATABASE_URL: {
      type: 'string'
    },
    SESSION_SECRET: {
      type: 'string',
      minLength: 32
    },
    ENCRYPTION_KEY: {
      type: 'string',
      minLength: 32
    },
    CORS_ALLOWED_ORIGIN: {
      type: 'string'
    },
    INITIAL_ADMIN_EMAIL: {
      type: 'string'
    },
    INITIAL_ADMIN_PASSWORD: {
      type: 'string',
      minLength: 12
    },
    LOG_LEVEL: {
      type: 'string',
      default: 'info'
    },
    WORKER_HEARTBEAT_INTERVAL_MS: {
      type: 'integer',
      default: 5000
    },
    AUTH_SESSION_RATE_LIMIT_MAX: {
      type: 'integer',
      default: DEFAULT_LOGIN_RATE_LIMIT
    }
  }
} as const;

dotenvFlow.config({
  node_env: process.env.NODE_ENV,
  silent: true
});

let cachedEnv: AppEnv | null = null;

function formatErrors(error: z.ZodError<AppEnv>): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');
}

export function loadEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = zEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${formatErrors(parsed.error)}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export async function registerConfig(fastify: FastifyInstance): Promise<AppEnv> {
  await fastify.register(fastifyEnv, {
    dotenv: false,
    schema: fastifyEnvSchema,
    confKey: FASTIFY_CONF_KEY,
    data: process.env
  });

  const rawConfig = (fastify as FastifyInstance & { [FASTIFY_CONF_KEY]: unknown })[
    FASTIFY_CONF_KEY
  ];

  const parsed = zEnvSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${formatErrors(parsed.error)}`);
  }

  const env = parsed.data;
  cachedEnv = env;

  if (!fastify.hasDecorator('appConfig')) {
    fastify.decorate<AppEnv>('appConfig', env);
  } else {
    fastify.appConfig = env;
  }

  return env;
}

export function clearCachedEnv(): void {
  cachedEnv = null;
}

export { getLogger, createLogger, type AppLogger } from './logging.js';

declare module 'fastify' {
  interface FastifyInstance {
    appConfig: AppEnv;
  }
}
