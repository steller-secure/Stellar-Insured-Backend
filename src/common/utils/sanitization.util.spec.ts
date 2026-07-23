import {
  sanitizeString,
  isValidCuid,
  isValidStellarAddress,
  isValidWalletAddress,
  sanitizeObject,
} from './sanitization.util';

describe('sanitization.util', () => {
  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should strip HTML tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe(
        'alert("xss")',
      );
    });

    it('should strip self-closing tags', () => {
      expect(sanitizeString('<img src=x onerror=alert(1)>')).toBe('');
    });

    it('should strip nested HTML tags', () => {
      expect(sanitizeString('<div><b>bold</b></div>')).toBe('bold');
    });

    it('should handle strings without HTML', () => {
      expect(sanitizeString('plain text')).toBe('plain text');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeString(null as any)).toBe('');
      expect(sanitizeString(undefined as any)).toBe('');
      expect(sanitizeString(42 as any)).toBe('');
    });
  });

  describe('isValidCuid', () => {
    it('should accept valid CUID strings', () => {
      expect(isValidCuid('user-1')).toBe(true);
      expect(isValidCuid('clxyz123abc')).toBe(true);
      expect(isValidCuid('a12345678')).toBe(true);
    });

    it('should reject invalid CUID strings', () => {
      expect(isValidCuid('')).toBe(false);
      expect(isValidCuid('<script>')).toBe(false);
      expect(isValidCuid('DROP TABLE')).toBe(false);
      expect(isValidCuid('abc!@#')).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(isValidCuid(null as any)).toBe(false);
      expect(isValidCuid(undefined as any)).toBe(false);
    });
  });

  describe('isValidStellarAddress', () => {
    it('should accept valid Stellar public keys', () => {
      // Stellar public keys are 56 chars starting with G
      const validKey = 'G' + 'A'.repeat(55);
      expect(isValidStellarAddress(validKey)).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidStellarAddress('')).toBe(false);
      expect(isValidStellarAddress('not-a-key')).toBe(false);
      expect(isValidStellarAddress('<script>evil()</script>')).toBe(false);
    });
  });

  describe('isValidWalletAddress', () => {
    it('should accept alphanumeric addresses', () => {
      expect(isValidWalletAddress('GABC123')).toBe(true);
      expect(isValidWalletAddress('user_name@test.com')).toBe(true);
      expect(isValidWalletAddress('abc-123')).toBe(true);
    });

    it('should reject addresses with special/dangerous characters', () => {
      expect(isValidWalletAddress('<script>')).toBe(false);
      expect(isValidWalletAddress("'; DROP TABLE--")).toBe(false);
      expect(isValidWalletAddress('hello world')).toBe(false); // space
      expect(isValidWalletAddress('a*b&c')).toBe(false);
    });

    it('should reject empty or overly long addresses', () => {
      expect(isValidWalletAddress('')).toBe(false);
      expect(isValidWalletAddress('a'.repeat(257))).toBe(false);
    });
  });

  describe('sanitizeObject', () => {
    it('should pass through primitive values', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
      expect(sanitizeObject(true)).toBe(true);
      expect(sanitizeObject(42)).toBe(42);
    });

    it('should sanitize string values', () => {
      expect(sanitizeObject('<b>hello</b>')).toBe('hello');
      expect(sanitizeObject('  trimmed  ')).toBe('trimmed');
    });

    it('should remove dangerous keys from objects', () => {
      const input = {
        __proto__: { polluted: true },
        constructor: { prototype: {} },
        safeKey: 'safe value',
      };
      const result = sanitizeObject(input) as Record<string, unknown>;
      expect(result.safeKey).toBe('safe value');
      expect(result.__proto__).toBeUndefined();
      expect(result.constructor).toBeUndefined();
    });

    it('should remove keys with dollar signs (NoSQL injection)', () => {
      const input = {
        $gt: '',
        'a.b': 'nested key',
        normalKey: 'ok',
      };
      const result = sanitizeObject(input) as Record<string, unknown>;
      expect(result.normalKey).toBe('ok');
      expect(result['$gt']).toBeUndefined();
      expect(result['a.b']).toBeUndefined();
    });

    it('should sanitize nested objects recursively', () => {
      const input = {
        level1: {
          level2: {
            content: '<script>evil()</script>',
          },
        },
      };
      const result = sanitizeObject(input) as any;
      expect(result.level1.level2.content).toBe('evil()');
    });

    it('should handle arrays', () => {
      const input = ['<b>a</b>', '<i>b</i>'];
      const result = sanitizeObject(input) as string[];
      expect(result[0]).toBe('a');
      expect(result[1]).toBe('b');
    });

    it('should discard functions', () => {
      const input = {
        callback: () => 'evil',
        safe: 'value',
      };
      const result = sanitizeObject(input) as Record<string, unknown>;
      expect(result.callback).toBeUndefined();
      expect(result.safe).toBe('value');
    });

    it('should handle circular references gracefully', () => {
      const input: any = { name: 'test' };
      input.self = input;
      const result = sanitizeObject(input) as any;
      expect(result.name).toBe('test');
      expect(result.self).toBeUndefined(); // Cycle detected
    });
  });
});
