import { z } from 'zod';

export const SyncJobStatusSchema = z.enum([
  'pending',
  'in_progress',
  'retrying',
  'failed',
  'completed'
]);

export const SyncJobOutcomeSchema = z.enum(['success', 'partial', 'failure']);

export type SyncJobStatus = z.infer<typeof SyncJobStatusSchema>;
export type SyncJobOutcome = z.infer<typeof SyncJobOutcomeSchema>;

const JobWindowSchema = z
  .object({
    start: z.string().datetime(),
    end: z.string().datetime()
  })
  .superRefine((value, ctx) => {
    const start = new Date(value.start);
    const end = new Date(value.end);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'window.end must be after window.start',
        path: ['end']
      });
    }
  });

export const ScheduleJobRequestSchema = z
  .object({
    pairId: z.string().uuid(),
    connectorId: z.string().uuid().optional(),
    priority: z.number().int().min(-32_768).max(32_767).default(0),
    payload: z.record(z.string(), z.unknown()).optional(),
    window: JobWindowSchema
  })
  .strict();

export type ScheduleJobRequest = z.infer<typeof ScheduleJobRequestSchema>;
export type JobWindow = z.infer<typeof JobWindowSchema>;
