import { describe, expect, it, vi } from 'vitest';

import { createHtmlIcsSyncExecutor } from './html-ics.js';

const buildContext = () => ({
  prisma: {} as any,
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
});

describe('createHtmlIcsSyncExecutor', () => {
  it('fails when the payload does not match html_ics_sync', async () => {
    const executor = createHtmlIcsSyncExecutor();
    const context = buildContext();
    const job = {
      id: 'job-1',
      payload: { type: 'connector_validation' }
    } as any;

    const result = await executor(job, context);

    expect(result.outcome).toBe('failure');
    expect(result.errorSummary).toContain('Unsupported payload');
    expect(context.logger.error).toHaveBeenCalledWith(
      { payload: job.payload, jobId: 'job-1' },
      'Unsupported payload for html_ics_sync executor'
    );
  });
});
