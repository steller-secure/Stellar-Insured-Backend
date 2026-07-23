import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';

describe('EncryptionService', () => {
  let service: EncryptionService;
  let configService: ConfigService;

  // Valid 32-byte base64 key for testing
  const testKeyBase64 = Buffer.alloc(32, 'a').toString('base64');
  const testKeyV2Base64 = Buffer.alloc(32, 'b').toString('base64');

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'ENCRYPTION_KEYS') {
          return `v1:${testKeyBase64},v2:${testKeyV2Base64}`;
        }
        return null;
      }),
    } as any;
    service = new EncryptionService(configService);
  });

  describe('constructor', () => {
    it('should throw if ENCRYPTION_KEYS is not configured', () => {
      const badConfig = { get: jest.fn().mockReturnValue(null) } as any;
      expect(() => new EncryptionService(badConfig)).toThrow(
        'ENCRYPTION_KEYS environment variable is required',
      );
    });

    it('should throw if key format is invalid', () => {
      const badConfig = {
        get: jest.fn().mockReturnValue('invalid-format'),
      } as any;
      expect(() => new EncryptionService(badConfig)).toThrow(
        'Invalid encryption key format',
      );
    });

    it('should throw if key is not 32 bytes', () => {
      const shortKey = Buffer.alloc(16, 'x').toString('base64');
      const badConfig = {
        get: jest.fn().mockReturnValue(`v1:${shortKey}`),
      } as any;
      expect(() => new EncryptionService(badConfig)).toThrow(
        'must be 32 bytes',
      );
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt plaintext and return formatted string', () => {
      const encrypted = service.encrypt('hello world');
      const parts = encrypted.split(':');
      expect(parts.length).toBe(4);
      expect(parts[0]).toBe('v1'); // active key version
    });

    it('should decrypt encrypted text back to original', () => {
      const original = 'sensitive data 12345';
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const encrypted1 = service.encrypt('same text');
      const encrypted2 = service.encrypt('same text');
      expect(encrypted1).not.toBe(encrypted2); // Different IVs
    });

    it('should handle empty string', () => {
      const encrypted = service.encrypt('');
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle special characters and unicode', () => {
      const original = 'Hello 世界! @#$%^&*() 🚀';
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should handle long strings', () => {
      const original = 'x'.repeat(10000);
      const encrypted = service.encrypt(original);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should use active key version in encrypted output', () => {
      const encrypted = service.encrypt('test');
      expect(encrypted.startsWith('v1:')).toBe(true);
    });
  });

  describe('decrypt error handling', () => {
    it('should throw on invalid format (not enough parts)', () => {
      expect(() => service.decrypt('invalid')).toThrow(
        'Invalid encrypted text format',
      );
    });

    it('should throw on unknown key version', () => {
      expect(() => service.decrypt('v99:abc:def:ghi')).toThrow(
        'Encryption key version v99 not found',
      );
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = service.encrypt('test data');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext
      parts[3] = '0000000000000000';
      const tampered = parts.join(':');
      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('getActiveKeyVersion', () => {
    it('should return the first configured key version', () => {
      expect(service.getActiveKeyVersion()).toBe('v1');
    });
  });
});
