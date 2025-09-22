import { Prisma, type PrismaClient, type SyncJob } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { ScheduleJobRequestSchema, type SyncJobStatus } from '@syncal/core';

const ACTIVE_JOB_STATUSES: SyncJobStatus[] = ['pending', 'retrying', 'in_progress'];
const MAX_IDEMPOTENCY_KEY_LENGTH = 255;

interface ScheduleJobInsert {
  pairId: string;
  connectorId: string;
  windowStart: Date;
  windowEnd: Date;
  payload: Prisma.InputJsonValue;
  priority: number;
}

function sanitizeIdempotencyKey(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, MAX_IDEMPOTENCY_KEY_LENGTH);
}

async function scheduleJobTransactional(
  prisma: PrismaClient,
  data: ScheduleJobInsert,
  idempotencyKey: string | undefined
): Promise<SyncJob> {
  return prisma.$transaction(
    async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.syncJob.findFirst({
          where: { idempotencyKey }
        });

        if (existing) {
          return existing;
        }
      }

      const duplicate = await tx.syncJob.findFirst({
        where: {
          pairId: data.pairId,
          connectorId: data.connectorId,
          windowStart: data.windowStart,
          windowEnd: data.windowEnd,
          status: {
            in: ACTIVE_JOB_STATUSES
          }
        }
      });

      if (duplicate) {
        return duplicate;
      }

      return tx.syncJob.create({
        data: {
          pairId: data.pairId,
          connectorId: data.connectorId,
          windowStart: data.windowStart,
          windowEnd: data.windowEnd,
          payload: data.payload,
          priority: data.priority,
          idempotencyKey: idempotencyKey ?? null
        }
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );
}

export async function jobsScheduleRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/jobs/schedule',
    {
      onRequest: [fastify.requireAdmin],
      preHandler: [fastify.csrfProtection]
    },
    async function (request, reply) {
      try {
        const parsed = ScheduleJobRequestSchema.parse(request.body);
        const idempotencyKey = sanitizeIdempotencyKey(request.headers['idempotency-key']);

        const pair = await fastify.prisma.syncPair.findUnique({
          where: { id: parsed.pairId },
          include: {
            primaryCalendar: true
          }
        });

        if (!pair) {
          return reply.status(404).send({ error: 'Pair not found' });
        }

        const connectorId = parsed.connectorId ?? pair.primaryCalendar.connectorId;

        const failureStats = await fastify.prisma.connectorFailureStat.findUnique({
          where: {
            connectorId_pairId: {
              connectorId,
              pairId: parsed.pairId
            }
          }
        });

        if (failureStats?.pausedUntil && failureStats.pausedUntil > new Date()) {
          const alert = await fastify.prisma.alert.findFirst({
            where: {
              category: 'sync_circuit_breaker',
              connectorId,
              pairId: parsed.pairId,
              acknowledged: false
            },
            orderBy: {
              createdAt: 'desc'
            }
          });

          return reply.status(409).send({
            error: 'connector_paused',
            message:
              alert?.message ?? 'Connector is paused due to circuit breaker activation',
            pausedUntil: failureStats.pausedUntil.toISOString(),
            consecutiveFailures: failureStats.consecutiveFailures
          });
        }

        const payload = (parsed.payload ?? {}) as Prisma.InputJsonValue;

        const job = await scheduleJobTransactional(
          fastify.prisma,
          {
            pairId: parsed.pairId,
            connectorId,
            windowStart: new Date(parsed.window.start),
            windowEnd: new Date(parsed.window.end),
            payload,
            priority: parsed.priority ?? 0
          },
          idempotencyKey
        );

        request.log.info(
          {
            jobId: job.id,
            pairId: job.pairId,
            connectorId: job.connectorId,
            idempotencyHit: Boolean(idempotencyKey && job.idempotencyKey === idempotencyKey)
          },
          'Scheduled sync job'
        );

        return reply.status(202).send({ jobId: job.id, status: job.status });
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.status(400).send({ error: 'Invalid schedule payload' });
        }

        request.log.error({ err: error }, 'Failed to schedule sync job');
        return reply.status(500).send({ error: 'Failed to schedule job' });
      }
    }
  );
}
