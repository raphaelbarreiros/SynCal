import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { AppLogger } from '@syncal/config';
import { createWorker } from './worker.js';

const originalSigint = process.listeners('SIGINT');
const originalSigterm = process.listeners('SIGTERM');

function setup() {
  const connect = vi.fn().mockResolvedValue(undefined);
  const disconnect = vi.fn().mockResolvedValue(undefined);
  const info = vi.fn();
  const error = vi.fn();
  const child = vi.fn().mockReturnValue({ info, error, child: vi.fn() });
  const logger = { info, error, child } as unknown as AppLogger;
  const exit = vi.fn() as unknown as (code: number) => never;

  const worker = createWorker({
    prisma: { $connect: connect, $disconnect: disconnect },
    logger,
    intervalMs: 1000,
    exit
  });

  return { worker, connect, disconnect, logger, exit, infoMock: info };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  for (const listener of originalSigint) {
    process.on('SIGINT', listener);
  }
  for (const listener of originalSigterm) {
    process.on('SIGTERM', listener);
  }
});

describe('worker heartbeat', () => {
  it('connects to the database and emits startup heartbeat immediately', async () => {
    const { worker, connect, infoMock } = setup();
    await worker.start();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(infoMock).toHaveBeenCalledWith('Worker connected to database');

    const heartbeatCall = infoMock.mock.calls.find((call) => call[1] === 'Worker heartbeat');
    expect(heartbeatCall?.[0]).toEqual({ reason: 'startup' });
  });

  it('emits periodic heartbeat on interval', async () => {
    const { worker, infoMock } = setup();
    await worker.start();

    infoMock.mockClear();
    await vi.advanceTimersByTimeAsync(1000);

    const heartbeatCall = infoMock.mock.calls.find((call) => call[1] === 'Worker heartbeat');
    expect(heartbeatCall?.[0]).toEqual({ reason: 'interval' });
  });

  it('disconnects and exits when receiving termination signal', async () => {
    const { worker, disconnect, exit } = setup();
    await worker.start();

    process.emit('SIGTERM');
    await Promise.resolve();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
