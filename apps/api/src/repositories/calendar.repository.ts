import { Prisma, type Calendar, type PrismaClient } from '@prisma/client';

export interface UpsertCalendarInput {
  connectorId: string;
  providerCalendarId: string;
  displayName?: string | null;
  privacyMode: Calendar['privacyMode'];
  metadata?: Prisma.InputJsonValue;
}

export class CalendarRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertMany(inputs: UpsertCalendarInput[]): Promise<Calendar[]> {
    if (inputs.length === 0) {
      return [];
    }

    return this.prisma.$transaction(
      inputs.map((input) =>
        this.prisma.calendar.upsert({
          where: {
            connectorId_providerCalendarId: {
              connectorId: input.connectorId,
              providerCalendarId: input.providerCalendarId
            }
          },
          update: {
            displayName: input.displayName ?? null,
            privacyMode: input.privacyMode,
            metadata: input.metadata ?? Prisma.JsonNull
          },
          create: {
            connectorId: input.connectorId,
            providerCalendarId: input.providerCalendarId,
            displayName: input.displayName ?? null,
            privacyMode: input.privacyMode,
            metadata: input.metadata ?? Prisma.JsonNull
          }
        })
      )
    );
  }

  async listByConnector(connectorId: string): Promise<Calendar[]> {
    return this.prisma.calendar.findMany({
      where: { connectorId },
      orderBy: { createdAt: 'asc' }
    });
  }
}
