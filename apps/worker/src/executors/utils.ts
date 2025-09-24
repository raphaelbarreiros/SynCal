import { Prisma } from '@prisma/client';

export function toJsonValue<T>(value: T): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}
