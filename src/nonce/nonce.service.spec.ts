import { NonceService } from './nonce.service';
import { BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('NonceService', () => {
  let service: NonceService;
  let cache: any;

  beforeEach(() => {
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    service = new NonceService(cache);
    jest.clearAllMocks();
  });

  describe('generateNonce', () => {
    it('should generate and store a nonce in cache', async () => {
      cache.set.mockResolvedValue(undefined);

      const nonce = await service.generateNonce();

      expect(nonce).toBeDefined();
      expect(typeof nonce).toBe('string');
      expect(nonce.length).toBe(32); // 16 bytes = 32 hex chars
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('nonce:'),
        expect.any(String),
        5 * 60 * 1000, // 5 minutes TTL
      );
    });

    it('should generate unique nonces on each call', async () => {
      cache.set.mockResolvedValue(undefined);

      const nonce1 = await service.generateNonce();
      const nonce2 = await service.generateNonce();

      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('consumeNonce', () => {
    it('should throw BadRequestException for empty nonce', async () => {
      await expect(service.consumeNonce('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for non-string nonce', async () => {
      await expect(service.consumeNonce(null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if nonce is unknown or expired', async () => {
      cache.get.mockResolvedValue(null);

      await expect(service.consumeNonce('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.consumeNonce('nonexistent')).rejects.toThrow(
        'Nonce is invalid, expired, or has already been used.',
      );
    });

    it('should validate and delete a valid nonce', async () => {
      cache.get.mockResolvedValue(Date.now().toString());
      cache.del.mockResolvedValue(undefined);

      const result = await service.consumeNonce('valid-nonce');

      expect(result).toBe(true);
      expect(cache.get).toHaveBeenCalledWith('nonce:valid-nonce');
      expect(cache.del).toHaveBeenCalledWith('nonce:valid-nonce');
    });

    it('should not allow reuse of consumed nonce', async () => {
      // First call: nonce exists
      cache.get.mockResolvedValueOnce(Date.now().toString());
      cache.del.mockResolvedValue(undefined);

      await service.consumeNonce('valid-nonce');

      // Second call: nonce no longer exists (already consumed)
      cache.get.mockResolvedValue(null);

      await expect(service.consumeNonce('valid-nonce')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('isNonceValid', () => {
    it('should return false for empty nonce', async () => {
      const result = await service.isNonceValid('');
      expect(result).toBe(false);
    });

    it('should return false if nonce does not exist in cache', async () => {
      cache.get.mockResolvedValue(null);

      const result = await service.isNonceValid('unknown');
      expect(result).toBe(false);
    });

    it('should return true if nonce exists in cache', async () => {
      cache.get.mockResolvedValue(Date.now().toString());

      const result = await service.isNonceValid('valid-nonce');
      expect(result).toBe(true);
    });

    it('should not consume the nonce when checking validity', async () => {
      cache.get.mockResolvedValue(Date.now().toString());

      await service.isNonceValid('valid-nonce');

      expect(cache.del).not.toHaveBeenCalled();
    });
  });
});
