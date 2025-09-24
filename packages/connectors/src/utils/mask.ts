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
