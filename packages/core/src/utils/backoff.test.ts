import { describe, expect, it } from 'vitest';
import {
  BACKOFF_MINUTES_SEQUENCE,
  buildDeterministicRandom,
  calculateBackoffDelayMs
} from './backoff.js';

const ONE_MINUTE_MS = 60_000;

describe('calculateBackoffDelayMs', () => {
  it('follows the 1-2-4-8-16 progression when jitter disabled', () => {
    const delays = BACKOFF_MINUTES_SEQUENCE.map((_, index) =>
      calculateBackoffDelayMs(index + 1, { jitterRatio: 0 })
    );

    expect(delays).toEqual(BACKOFF_MINUTES_SEQUENCE.map((minutes) => minutes * ONE_MINUTE_MS));
  });

  it('caps delays at 30 minutes for higher retry counts', () => {
    const delay = calculateBackoffDelayMs(6, { jitterRatio: 0 });
    expect(delay).toBe(30 * ONE_MINUTE_MS);
  });

  it('applies ±10% jitter using the provided random generator', () => {
    const random = buildDeterministicRandom(42);
    const delay = calculateBackoffDelayMs(2, { random });

    const base = 2 * ONE_MINUTE_MS;
    const lowerBound = base * 0.9;
    const upperBound = base * 1.1;

    expect(delay).toBeGreaterThanOrEqual(lowerBound);
    expect(delay).toBeLessThanOrEqual(upperBound);
  });
});
