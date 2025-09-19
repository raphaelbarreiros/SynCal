import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password service', () => {
  const plainPassword = 'Str0ngPassword!';

  it('hashes a password using Argon2id', async () => {
    const hash = await hashPassword(plainPassword);

    expect(hash).toBeTypeOf('string');
    expect(hash).not.toContain(plainPassword);
  });

  it('verifies matching passwords and rejects mismatches', async () => {
    const hash = await hashPassword(plainPassword);

    await expect(verifyPassword(hash, plainPassword)).resolves.toBe(true);
    await expect(verifyPassword(hash, 'incorrect-password')).resolves.toBe(false);
  });
});
