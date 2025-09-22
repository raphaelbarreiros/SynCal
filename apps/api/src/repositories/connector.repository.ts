import type {
  Connector,
  ConnectorStatus,
  PrismaClient
} from '@prisma/client';
import { Prisma } from '@prisma/client';

export interface CreateConnectorInput {
  ownerId: string;
  type: Connector['type'];
  displayName?: string | null;
  credentialsEncrypted: Buffer;
  config: Prisma.InputJsonValue;
  status?: ConnectorStatus;
  lastValidatedAt?: Date | null;
}

export interface UpdateConnectorValidationInput {
  id: string;
  status: ConnectorStatus;
  lastValidatedAt?: Date | null;
  config?: Prisma.InputJsonValue;
}

export class ConnectorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateConnectorInput): Promise<Connector> {
    return this.prisma.connector.create({
      data: {
        ownerId: input.ownerId,
        type: input.type,
        displayName: input.displayName ?? null,
        status: input.status ?? 'pending_validation',
        credentialsEncrypted: input.credentialsEncrypted,
        configJson: input.config,
        lastValidatedAt: input.lastValidatedAt ?? null
      }
    });
  }

  async findById(id: string): Promise<Connector | null> {
    return this.prisma.connector.findUnique({
      where: { id }
    });
  }

  async listByOwner(ownerId: string): Promise<Connector[]> {
    return this.prisma.connector.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateValidation(input: UpdateConnectorValidationInput): Promise<Connector> {
    return this.prisma.connector.update({
      where: { id: input.id },
      data: {
        status: input.status,
        lastValidatedAt: input.lastValidatedAt ?? null,
        configJson: input.config ?? undefined
      }
    });
  }

  async updateConfig(id: string, config: Prisma.InputJsonValue): Promise<Connector> {
    return this.prisma.connector.update({
      where: { id },
      data: {
        configJson: config
      }
    });
  }
}
