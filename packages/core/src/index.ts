export type HealthStatus = 'ok' | 'degraded';

export interface HealthResponse {
  status: HealthStatus;
  db: 'connected' | 'disconnected';
  encryptionKey: 'ready' | 'missing';
  time: string;
  reason?: string;
}

export * from './dtos/auth.js';
export * from './dtos/jobs.js';
export * from './dtos/connectors.js';
export * from './utils/backoff.js';
