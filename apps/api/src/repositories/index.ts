import { AdminUserRepository } from './admin-user.repository.js';
import { AuditLogRepository } from './audit-log.repository.js';
import { ConnectorRepository } from './connector.repository.js';
import { CalendarRepository } from './calendar.repository.js';

export { AdminUserRepository, type CreateAdminUserInput } from './admin-user.repository.js';
export { AuditLogRepository, type CreateAuditLogInput } from './audit-log.repository.js';
export { ConnectorRepository, type CreateConnectorInput } from './connector.repository.js';
export { CalendarRepository, type UpsertCalendarInput } from './calendar.repository.js';

export interface Repositories {
  adminUsers: AdminUserRepository;
  auditLogs: AuditLogRepository;
  connectors: ConnectorRepository;
  calendars: CalendarRepository;
}
