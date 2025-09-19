import type { AuditLog, PrismaClient, Prisma } from '@prisma/client';

export interface CreateAuditLogInput {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Prisma.JsonValue;
}

export class AuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const metadata: Prisma.JsonValue = input.metadata ?? ({} as Prisma.JsonObject);

    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata
      }
    });
  }
}
