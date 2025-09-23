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

export function maskFeedUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const last = segments.pop();

    const path = last ? `/…/${last}` : '/…';

    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return 'https://…';
  }
}
