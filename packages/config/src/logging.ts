import pino, { type LoggerOptions, type Logger } from 'pino';
import { loadEnv, type AppEnv } from './index.js';

let rootLogger: Logger | null = null;

function buildLoggerOptions(env: AppEnv): LoggerOptions {
  const options: LoggerOptions = {
    level: env.LOG_LEVEL
  };

  return options;
}

export function getLogger(): Logger {
  if (rootLogger) {
    return rootLogger;
  }

  const env = loadEnv();
  rootLogger = pino(buildLoggerOptions(env));
  return rootLogger;
}

export function createLogger(bindings: Record<string, unknown>): Logger {
  return getLogger().child(bindings);
}

export type AppLogger = Logger;
