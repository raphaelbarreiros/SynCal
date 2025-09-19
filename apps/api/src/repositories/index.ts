import { AdminUserRepository } from './admin-user.repository.js';
import { AuditLogRepository } from './audit-log.repository.js';

export { AdminUserRepository, type CreateAdminUserInput } from './admin-user.repository.js';
export { AuditLogRepository, type CreateAuditLogInput } from './audit-log.repository.js';

export interface Repositories {
  adminUsers: AdminUserRepository;
  auditLogs: AuditLogRepository;
}
