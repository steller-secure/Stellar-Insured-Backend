import * as winston from 'winston';
import {
  redactValue,
  REDACTED,
  REDACTED_JWT,
  REDACTED_EMAIL,
  REDACTED_STELLAR,
  REDACTED_UUID,
  REDACTED_PHONE,
  REDACTED_IP,
  REDACTED_CC,
  REDACTED_SSN,
  redactFormat,
  redactLogInfo,
} from './log-redaction.util';

describe('log-redaction.util', () => {
  describe('redactValue', () => {
    it('redacts JWTs in strings', () => {
      const input =
        'Token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      expect(redactValue(input)).not.toContain('eyJ');
      expect(redactValue(input)).toContain(REDACTED_JWT);
    });

    it('redacts Bearer JWTs in strings', () => {
      const input =
        'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      expect(redactValue(input)).not.toContain('eyJ');
      expect(redactValue(input)).toContain(REDACTED_JWT);
    });

    it('redacts emails in strings', () => {
      const input = 'Contact user@example.com for access';
      expect(redactValue(input)).not.toContain('user@example.com');
      expect(redactValue(input)).toContain(REDACTED_EMAIL);
    });

    it('redacts Stellar wallet addresses in strings', () => {
      const input =
        'Wallet GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';
      expect(redactValue(input)).not.toContain(
        'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
      );
      expect(redactValue(input)).toContain(REDACTED_STELLAR);
    });

    it('redacts UUIDs in strings', () => {
      const input =
        'User c4d7e8f0-1234-5678-90ab-cdef12345678 performed action';
      expect(redactValue(input)).not.toContain('c4d7e8f0-1234-5678-90ab-cdef12345678');
      expect(redactValue(input)).toContain(REDACTED_UUID);
    });

    it('redacts phone numbers in strings', () => {
      const input = 'Call +1-555-123-4567 or (555) 123-4567';
      expect(redactValue(input)).not.toContain('+1-555-123-4567');
      expect(redactValue(input)).not.toContain('(555) 123-4567');
      expect(redactValue(input)).toContain(REDACTED_PHONE);
    });

    it('redacts IP addresses in strings', () => {
      const input = 'Request from 192.168.1.100 and 10.0.0.1';
      expect(redactValue(input)).not.toContain('192.168.1.100');
      expect(redactValue(input)).not.toContain('10.0.0.1');
      expect(redactValue(input)).toContain(REDACTED_IP);
    });

    it('redacts credit card numbers in strings', () => {
      const input = 'Card 4111-1111-1111-1111 was used';
      expect(redactValue(input)).not.toContain('4111-1111-1111-1111');
      expect(redactValue(input)).toContain(REDACTED_CC);
    });

    it('redacts SSNs in strings', () => {
      const input = 'SSN 123-45-6789 verified';
      expect(redactValue(input)).not.toContain('123-45-6789');
      expect(redactValue(input)).toContain(REDACTED_SSN);
    });

    it('redacts sensitive keys in objects', () => {
      const input = {
        authorization: 'Bearer secret123',
        cookie: 'session=abc',
        email: 'test@example.com',
        password: 'hunter2',
        id: 1,
      };
      const result = redactValue(input) as Record<string, unknown>;
      expect(result.authorization).toBe(REDACTED);
      expect(result.cookie).toBe(REDACTED);
      expect(result.email).toBe(REDACTED);
      expect(result.password).toBe(REDACTED);
      expect(result.id).toBe(1);
    });

    it('redacts additional PII keys in objects', () => {
      const input = {
        phone: '+1-555-123-4567',
        ipAddress: '192.168.1.100',
        creditCard: '4111-1111-1111-1111',
        ssn: '123-45-6789',
        dateOfBirth: '1990-01-01',
      };
      const result = redactValue(input) as Record<string, unknown>;
      expect(result.phone).toBe(REDACTED);
      expect(result.ipAddress).toBe(REDACTED);
      expect(result.creditCard).toBe(REDACTED);
      expect(result.ssn).toBe(REDACTED);
      expect(result.dateOfBirth).toBe(REDACTED);
    });

    it('redacts nested sensitive fields', () => {
      const input = {
        user: {
          email: 'nested@example.com',
          profile: {
            pushSubscription: 'endpoint:https://example.com',
          },
        },
      };
      const result = redactValue(input) as Record<string, unknown>;
      expect((result.user as Record<string, unknown>).email).toBe(REDACTED);
      expect((result.user as Record<string, unknown>).profile).toEqual({
        pushSubscription: REDACTED,
      });
    });

    it('redacts sensitive keys in arrays', () => {
      const input = [{ token: 'abc123' }, { authorization: 'Bearer xyz' }];
      const result = redactValue(input) as Array<Record<string, unknown>>;
      expect(result[0].token).toBe(REDACTED);
      expect(result[1].authorization).toBe(REDACTED);
    });

    it('preserves structured tracing identifiers even though they are UUID-shaped', () => {
      const input = {
        correlationId: 'c4d7e8f0-1234-5678-90ab-cdef12345678',
        userId: 'a1b2c3d4-1234-5678-90ab-cdef12345678',
        entityId: 'e1e2e3e4-1234-5678-90ab-cdef12345678',
        eventId: 'f1f2f3f4-1234-5678-90ab-cdef12345678',
        requestId: 'aaaaaaaa-1234-5678-90ab-cdef12345678',
      };

      const result = redactValue(input) as Record<string, unknown>;

      expect(result.correlationId).toBe(input.correlationId);
      expect(result.userId).toBe(input.userId);
      expect(result.entityId).toBe(input.entityId);
      expect(result.eventId).toBe(input.eventId);
      expect(result.requestId).toBe(input.requestId);
    });

    it('still redacts UUIDs embedded in free-text message strings', () => {
      const uuid = 'c4d7e8f0-1234-5678-90ab-cdef12345678';
      const input = { message: `Claim ${uuid} approved` };

      const result = redactValue(input) as Record<string, unknown>;

      expect(result.message).not.toContain(uuid);
      expect(result.message).toContain(REDACTED_UUID);
    });

    it('preserves non-sensitive strings', () => {
      const input = 'Hello world, nothing sensitive here';
      expect(redactValue(input)).toBe(input);
    });

    it('preserves numbers and booleans', () => {
      expect(redactValue(42)).toBe(42);
      expect(redactValue(true)).toBe(true);
      expect(redactValue(null)).toBeNull();
      expect(redactValue(undefined)).toBeUndefined();
    });

    it('does not leak secrets in complex nested objects', () => {
      const input = {
        req: {
          headers: {
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
            'x-api-key': 'abcdef1234567890abcdef1234567890',
          },
          body: {
            email: 'user@example.com',
            password: 'super-secret',
            walletAddress:
              'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
            phone: '+1-555-123-4567',
            ipAddress: '192.168.1.100',
            creditCard: '4111-1111-1111-1111',
            ssn: '123-45-6789',
          },
        },
      };
      const str = JSON.stringify(redactValue(input));
      expect(str).not.toContain('eyJ');
      expect(str).not.toContain('Bearer');
      expect(str).not.toContain('user@example.com');
      expect(str).not.toContain('super-secret');
      expect(str).not.toContain(
        'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW',
      );
      expect(str).not.toContain('+1-555-123-4567');
      expect(str).not.toContain('192.168.1.100');
      expect(str).not.toContain('4111-1111-1111-1111');
      expect(str).not.toContain('123-45-6789');
      expect(str).toContain(REDACTED);
    });
  });

  describe('redactLogInfo', () => {
    it('preserves winston\'s internal Symbol-keyed properties (LEVEL/MESSAGE/SPLAT)', () => {
      // Regression test: redactValue rebuilds the object via Object.entries,
      // which only sees string-keyed properties. Winston's TransportStream
      // gates every write on `info[LEVEL]` (a Symbol from `triple-beam`) —
      // losing it silently drops the entry in every transport (Console,
      // DailyRotateFile, ...) with no error. See redactLogInfo's re-attach
      // step, added specifically to prevent this.
      const { LEVEL, MESSAGE, SPLAT } = require('triple-beam');
      const info = { level: 'info', message: 'hello' } as winston.Logform.TransformableInfo;
      (info as Record<symbol, unknown>)[LEVEL] = 'info';
      (info as Record<symbol, unknown>)[MESSAGE] = 'hello';
      (info as Record<symbol, unknown>)[SPLAT] = ['a'];

      const result = redactLogInfo(info) as Record<symbol, unknown>;

      expect(result[LEVEL]).toBe('info');
      expect(result[MESSAGE]).toBe('hello');
      expect(result[SPLAT]).toEqual(['a']);
    });

    it('returns transformed winston info object', () => {
      const info = {
        level: 'info',
        message: 'HTTP GET /api/test',
        meta: {
          req: {
            headers: {
              authorization:
                'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
            },
            body: {
              email: 'user@example.com',
            },
          },
        },
      } as winston.Logform.TransformableInfo;

      const result = redactLogInfo(info);
      const str = JSON.stringify(result);
      expect(str).not.toContain('eyJ');
      expect(str).not.toContain('user@example.com');
      expect(str).toContain(REDACTED);
    });
  });

  describe('logger safety', () => {
    it('does not emit known secret patterns through redaction', () => {
      const secretJwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const secretEmail = 'leaked@example.com';
      const secretWallet =
        'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW';

      const info = {
        level: 'info',
        message: 'HTTP GET /api/users',
        req: {
          headers: {
            authorization: `Bearer ${secretJwt}`,
          },
          body: {
            email: secretEmail,
            walletAddress: secretWallet,
          },
        },
      } as winston.Logform.TransformableInfo;

      const logged = JSON.stringify(redactLogInfo(info));

      expect(logged).not.toContain(secretJwt);
      expect(logged).not.toContain(secretEmail);
      expect(logged).not.toContain(secretWallet);
      expect(logged).toContain(REDACTED);
    });
  });
});
