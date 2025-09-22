export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  random?: () => number;
}

export const BACKOFF_MINUTES_SEQUENCE = [1, 2, 4, 8, 16] as const;

const DEFAULT_BASE_DELAY_MS = 60_000;
const DEFAULT_MAX_DELAY_MS = 30 * 60_000;
const DEFAULT_JITTER_RATIO = 0.1;

function computeBaseDelay(attempt: number, baseDelayMs: number): number {
  const clampedIndex = Math.max(0, Math.min(BACKOFF_MINUTES_SEQUENCE.length - 1, attempt - 1));
  const withinSequence = BACKOFF_MINUTES_SEQUENCE[clampedIndex];
  const exponentialMinutes = Math.pow(2, attempt - 1);
  const minutes = attempt <= BACKOFF_MINUTES_SEQUENCE.length ? withinSequence : exponentialMinutes;
  return minutes * baseDelayMs;
}

export function calculateBackoffDelayMs(
  retryCount: number,
  options: BackoffOptions = {}
): number {
  const attempt = Math.max(1, retryCount);
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const jitterRatio = options.jitterRatio ?? DEFAULT_JITTER_RATIO;
  const random = options.random ?? Math.random;

  const delayWithoutCap = computeBaseDelay(attempt, baseDelayMs);
  const cappedDelay = Math.min(delayWithoutCap, maxDelayMs);

  if (jitterRatio <= 0) {
    return Math.round(cappedDelay);
  }

  const jitterAmplitude = cappedDelay * jitterRatio;
  const offset = jitterAmplitude * (random() * 2 - 1);
  const result = cappedDelay + offset;

  return Math.max(0, Math.round(result));
}

export function calculateNextRunAt(
  retryCount: number,
  now: Date = new Date(),
  options: BackoffOptions = {}
): Date {
  const delayMs = calculateBackoffDelayMs(retryCount, options);
  return new Date(now.getTime() + delayMs);
}

export function buildDeterministicRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
