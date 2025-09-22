import { describe, it, expect } from 'vitest';
import {
  encryptCredentials,
  decryptCredentials,
  generateOAuthState,
  validateOAuthState
} from '../lib/crypto';

describe('Crypto Utilities', () => {
  const testEncryptionKey = 'test-encryption-key-must-be-32-chars-minimum';
  const testCredentials = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    scope: 'calendar.read calendar.write',
    user_profile: {
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User'
    }
  };

  describe('encryptCredentials', () => {
    it('should encrypt credentials successfully', () => {
      const encrypted = encryptCredentials(testCredentials, testEncryptionKey);
      
      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(0);
      // Should be at least IV (16) + tag (16) + some encrypted data
      expect(encrypted.length).toBeGreaterThanOrEqual(32);
    });

    it('should produce different encrypted output for same input (due to random IV)', () => {
      const encrypted1 = encryptCredentials(testCredentials, testEncryptionKey);
      const encrypted2 = encryptCredentials(testCredentials, testEncryptionKey);
      
      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should handle empty credentials object', () => {
      const emptyCredentials = {};
      const encrypted = encryptCredentials(emptyCredentials, testEncryptionKey);
      
      expect(encrypted).toBeInstanceOf(Buffer);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle empty key by hashing it', () => {
      // Empty strings get hashed to a valid key, so this won't throw
      const emptyCredentials = { test: 'data' };
      const encrypted = encryptCredentials(emptyCredentials, '');
      const decrypted = decryptCredentials(encrypted, '');
      
      expect(decrypted).toEqual(emptyCredentials);
    });
  });

  describe('decryptCredentials', () => {
    it('should decrypt credentials successfully', () => {
      const encrypted = encryptCredentials(testCredentials, testEncryptionKey);
      const decrypted = decryptCredentials(encrypted, testEncryptionKey);
      
      expect(decrypted).toEqual(testCredentials);
    });

    it('should handle empty credentials object', () => {
      const emptyCredentials = {};
      const encrypted = encryptCredentials(emptyCredentials, testEncryptionKey);
      const decrypted = decryptCredentials(encrypted, testEncryptionKey);
      
      expect(decrypted).toEqual(emptyCredentials);
    });

    it('should throw error with wrong key', () => {
      const encrypted = encryptCredentials(testCredentials, testEncryptionKey);
      const wrongKey = 'wrong-encryption-key-must-be-32-chars';
      
      expect(() => {
        decryptCredentials(encrypted, wrongKey);
      }).toThrow('Failed to decrypt credentials');
    });

    it('should throw error with corrupted data', () => {
      const encrypted = encryptCredentials(testCredentials, testEncryptionKey);
      // Corrupt the encrypted data by modifying a byte
      encrypted[encrypted.length - 1] = (encrypted[encrypted.length - 1] + 1) % 256;
      
      expect(() => {
        decryptCredentials(encrypted, testEncryptionKey);
      }).toThrow('Failed to decrypt credentials');
    });

    it('should throw error with invalid buffer size', () => {
      const tooSmallBuffer = Buffer.alloc(10); // Less than IV + tag size
      
      expect(() => {
        decryptCredentials(tooSmallBuffer, testEncryptionKey);
      }).toThrow('Failed to decrypt credentials');
    });
  });

  describe('base64 key handling', () => {
    it('should handle base64: prefixed key', () => {
      // Create a 32-byte base64 encoded key
      const rawKey = 'test-key-32-bytes-minimum-length!';
      const base64Key = 'base64:' + Buffer.from(rawKey).toString('base64');
      
      const encrypted = encryptCredentials(testCredentials, base64Key);
      const decrypted = decryptCredentials(encrypted, base64Key);
      
      expect(decrypted).toEqual(testCredentials);
    });

    it('should handle regular string key (gets hashed)', () => {
      const stringKey = 'simple-string-key';
      
      const encrypted = encryptCredentials(testCredentials, stringKey);
      const decrypted = decryptCredentials(encrypted, stringKey);
      
      expect(decrypted).toEqual(testCredentials);
    });
  });

  describe('generateOAuthState', () => {
    it('should generate a random state string', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();
      
      expect(state1).toBeTruthy();
      expect(state2).toBeTruthy();
      expect(state1).not.toBe(state2);
      expect(typeof state1).toBe('string');
      expect(typeof state2).toBe('string');
      expect(state1.length).toBeGreaterThan(0);
    });

    it('should generate URL-safe base64 strings', () => {
      const state = generateOAuthState();
      
      // base64url should not contain +, /, or = characters
      expect(state).not.toMatch(/[+/=]/);
      
      // Should only contain URL-safe characters
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate strings of reasonable length', () => {
      const state = generateOAuthState();
      
      // 32 bytes encoded as base64url should be around 43 characters
      expect(state.length).toBeGreaterThan(40);
      expect(state.length).toBeLessThan(50);
    });
  });

  describe('validateOAuthState', () => {
    it('should return true for matching states', () => {
      const state = 'test-state-string';
      const result = validateOAuthState(state, state);
      
      expect(result).toBe(true);
    });

    it('should return false for different states', () => {
      const state1 = 'test-state-1';
      const state2 = 'test-state-2';
      const result = validateOAuthState(state1, state2);
      
      expect(result).toBe(false);
    });

    it('should return false for empty expected state', () => {
      const result = validateOAuthState('', 'actual-state');
      
      expect(result).toBe(false);
    });

    it('should return false for empty actual state', () => {
      const result = validateOAuthState('expected-state', '');
      
      expect(result).toBe(false);
    });

    it('should return false for null states', () => {
      expect(validateOAuthState(null as any, 'state')).toBe(false);
      expect(validateOAuthState('state', null as any)).toBe(false);
      expect(validateOAuthState(null as any, null as any)).toBe(false);
    });

    it('should return false for undefined states', () => {
      expect(validateOAuthState(undefined as any, 'state')).toBe(false);
      expect(validateOAuthState('state', undefined as any)).toBe(false);
      expect(validateOAuthState(undefined as any, undefined as any)).toBe(false);
    });

    it('should handle case-sensitive comparison', () => {
      const result = validateOAuthState('Test-State', 'test-state');
      
      expect(result).toBe(false);
    });
  });

  describe('round-trip encryption', () => {
    it('should handle complex nested objects', () => {
      const complexCredentials = {
        access_token: 'complex-token',
        refresh_token: 'complex-refresh',
        metadata: {
          user: {
            id: 123,
            preferences: ['pref1', 'pref2'],
            settings: {
              theme: 'dark',
              notifications: true
            }
          },
          calendars: [
            { id: 'cal1', name: 'Calendar 1' },
            { id: 'cal2', name: 'Calendar 2' }
          ]
        }
      };

      const encrypted = encryptCredentials(complexCredentials, testEncryptionKey);
      const decrypted = decryptCredentials(encrypted, testEncryptionKey);
      
      expect(decrypted).toEqual(complexCredentials);
    });

    it('should handle unicode characters', () => {
      const unicodeCredentials = {
        user_name: '用户名',
        description: 'Café ☕ and résumé 📄',
        emoji: '🔒🌟🚀'
      };

      const encrypted = encryptCredentials(unicodeCredentials, testEncryptionKey);
      const decrypted = decryptCredentials(encrypted, testEncryptionKey);
      
      expect(decrypted).toEqual(unicodeCredentials);
    });
  });
});