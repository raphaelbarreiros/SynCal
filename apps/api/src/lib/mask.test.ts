import { describe, expect, it } from 'vitest';
import { maskEmail, maskFeedUrl } from './mask.js';

describe('maskEmail', () => {
  it('masks local part when longer than two characters', () => {
    expect(maskEmail('admin@example.com')).toBe('ad***@example.com');
  });
});

describe('maskFeedUrl', () => {
  it('masks intermediate path segments', () => {
    expect(maskFeedUrl('https://calendar.example.com/feeds/private/abcd/basic.ics')).toBe(
      'https://calendar.example.com/…/basic.ics'
    );
  });

  it('handles root-level paths', () => {
    expect(maskFeedUrl('https://calendar.example.com/feed.ics')).toBe(
      'https://calendar.example.com/…/feed.ics'
    );
  });

  it('returns placeholder for invalid URLs', () => {
    expect(maskFeedUrl('not-a-url')).toBe('https://…');
  });
});
