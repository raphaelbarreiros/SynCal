import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function normalizeKey(raw: string): Buffer {
  const value = raw.startsWith('base64:') ? raw.slice('base64:'.length) : raw;
  const buffer = Buffer.from(value, 'base64');

  if (buffer.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes; received ${buffer.length}`
    );
  }

  return buffer;
}

function readRawKey(): string {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY must be configured before encrypting secrets');
  }

  return raw;
}

export function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  cachedKey = normalizeKey(readRawKey());
  return cachedKey;
}

export function encryptSecret(plaintext: string | Buffer): Buffer {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const buffer = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf8');
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptSecret(payload: Buffer): Buffer {
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted payload is too short');
  }

  const key = getEncryptionKey();
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function encryptJson<T>(value: T): Buffer {
  const json = JSON.stringify(value);
  return encryptSecret(json);
}

export function decryptJson<T>(payload: Buffer): T {
  const buffer = decryptSecret(payload);
  return JSON.parse(buffer.toString('utf8')) as T;
}

export function clearCachedKey(): void {
  cachedKey = null;
}
