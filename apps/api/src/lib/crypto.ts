import { createCipher, createDecipher, randomBytes, createHash } from 'crypto';

/**
 * Encrypts sensitive data like OAuth tokens using AES-256-GCM
 */
export function encryptCredentials(data: Record<string, any>, encryptionKey: string): Buffer {
  try {
    const json = JSON.stringify(data);
    const key = getEncryptionKey(encryptionKey);
    const iv = randomBytes(16); // 128-bit IV for GCM
    const cipher = createCipher('aes-256-gcm', key);
    
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get the authentication tag
    const tag = cipher.getAuthTag();
    
    // Combine IV + tag + encrypted data
    const result = Buffer.concat([
      iv, 
      tag, 
      Buffer.from(encrypted, 'hex')
    ]);
    
    return result;
  } catch (error) {
    throw new Error(`Failed to encrypt credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts credentials encrypted with encryptCredentials
 */
export function decryptCredentials(encryptedData: Buffer, encryptionKey: string): Record<string, any> {
  try {
    const key = getEncryptionKey(encryptionKey);
    
    // Extract IV (first 16 bytes), tag (next 16 bytes), and encrypted data
    const iv = encryptedData.slice(0, 16);
    const tag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);
    
    const decipher = createDecipher('aes-256-gcm', key);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    throw new Error(`Failed to decrypt credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Derives a consistent encryption key from the configured encryption key
 */
function getEncryptionKey(encryptionKey: string): Buffer {
  // Handle base64: prefix as mentioned in .env.example
  let keyString = encryptionKey;
  if (keyString.startsWith('base64:')) {
    keyString = keyString.slice(7);
    return Buffer.from(keyString, 'base64');
  }
  
  // For non-base64 keys, hash them to ensure consistent 32-byte length
  return createHash('sha256').update(keyString).digest();
}

/**
 * Generates a random state string for OAuth CSRF protection
 */
export function generateOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Validates OAuth state to prevent CSRF attacks
 */
export function validateOAuthState(expectedState: string, actualState: string): boolean {
  if (!expectedState || !actualState) {
    return false;
  }
  return expectedState === actualState;
}