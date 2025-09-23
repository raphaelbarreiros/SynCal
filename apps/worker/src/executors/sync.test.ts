import { describe, expect, it, vi } from 'vitest';
import type { JobExecutionResult } from './sync.js';
import { createJobRouter } from './sync.js';

function buildJob(type: string) {
  return {
    id: 'job-1',
    payload: { type }
  } as any;
}

const context = {
  prisma: {} as any,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
};

describe('createJobRouter', () => {
  it('routes jobs based on payload type', async () => {
    const executor = vi.fn(async () => ({
      outcome: 'success',
      processedEvents: 1,
      failedEvents: 0
    } satisfies JobExecutionResult));

    const router = createJobRouter({ test: executor });

    const result = await router(buildJob('test'), context);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('success');
  });

  it('fails when no executor matches', async () => {
    const router = createJobRouter({});

    const result = await router(buildJob('unknown'), context);
    expect(result.outcome).toBe('failure');
    expect(result.errorSummary).toContain('unknown');
  });
});
