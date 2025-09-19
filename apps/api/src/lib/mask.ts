export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) {
    return '***@***';
  }

  if (local.length <= 2) {
    return `${local[0] ?? '*'}*@${domain}`;
  }

  const visible = local.slice(0, 2);
  const obscuredLength = Math.max(local.length - 2, 1);
  return `${visible}${'*'.repeat(obscuredLength)}@${domain}`;
}
