import {
  isBigInt,
  isPrismaDecimal,
  isDate,
  needsSerialization,
} from './type-guards.util';

describe('type-guards.util', () => {
  describe('isBigInt', () => {
    it('should return true for BigInt', () => {
      expect(isBigInt(BigInt(123))).toBe(true);
      expect(isBigInt(BigInt(0))).toBe(true);
      expect(isBigInt(BigInt(-999))).toBe(true);
    });

    it('should return false for non-BigInt values', () => {
      expect(isBigInt(123)).toBe(false);
      expect(isBigInt('123')).toBe(false);
      expect(isBigInt(null)).toBe(false);
      expect(isBigInt(undefined)).toBe(false);
      expect(isBigInt({})).toBe(false);
    });
  });

  describe('isPrismaDecimal', () => {
    it('should return true for Prisma.Decimal-like objects', () => {
      const decimalMock = {
        d: [12345],
        s: 2,
        e: 0,
        toString: () => '123.45',
      };
      expect(isPrismaDecimal(decimalMock)).toBe(true);
    });

    it('should return true for Decimal with different structures', () => {
      expect(isPrismaDecimal({ d: [1], s: 0, e: 0, toString: () => '1' })).toBe(
        true,
      );
      expect(isPrismaDecimal({ s: 2, e: 0, toString: () => '0.01' })).toBe(
        true,
      );
      expect(isPrismaDecimal({ e: 0, toString: () => '100' })).toBe(true);
    });

    it('should return false for objects without Decimal structure', () => {
      expect(isPrismaDecimal({})).toBe(false);
      expect(isPrismaDecimal({ toString: () => 'test' })).toBe(false);
      expect(isPrismaDecimal({ d: [1], s: 0 })).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isPrismaDecimal(null)).toBe(false);
      expect(isPrismaDecimal(undefined)).toBe(false);
      expect(isPrismaDecimal(123)).toBe(false);
      expect(isPrismaDecimal('123')).toBe(false);
    });

    it('should return false if toString throws', () => {
      const badDecimal = {
        d: [1],
        s: 0,
        e: 0,
        toString: () => {
          throw new Error('Invalid');
        },
      };
      expect(isPrismaDecimal(badDecimal)).toBe(false);
    });

    it('should return false if toString returns non-numeric string', () => {
      const invalidDecimal = {
        d: [1],
        s: 0,
        e: 0,
        toString: () => 'not a number',
      };
      expect(isPrismaDecimal(invalidDecimal)).toBe(false);
    });
  });

  describe('isDate', () => {
    it('should return true for Date instances', () => {
      expect(isDate(new Date())).toBe(true);
      expect(isDate(new Date('2024-01-01'))).toBe(true);
    });

    it('should return false for non-Date values', () => {
      expect(isDate('2024-01-01')).toBe(false);
      expect(isDate(1234567890)).toBe(false);
      expect(isDate(null)).toBe(false);
      expect(isDate(undefined)).toBe(false);
      expect(isDate({})).toBe(false);
    });
  });

  describe('needsSerialization', () => {
    it('should return true for BigInt', () => {
      expect(needsSerialization(BigInt(123))).toBe(true);
    });

    it('should return true for Prisma.Decimal', () => {
      const decimalMock = {
        d: [123],
        s: 2,
        e: 0,
        toString: () => '1.23',
      };
      expect(needsSerialization(decimalMock)).toBe(true);
    });

    it('should return true for Date', () => {
      expect(needsSerialization(new Date())).toBe(true);
    });

    it('should return false for primitive values', () => {
      expect(needsSerialization('string')).toBe(false);
      expect(needsSerialization(123)).toBe(false);
      expect(needsSerialization(true)).toBe(false);
      expect(needsSerialization(null)).toBe(false);
      expect(needsSerialization(undefined)).toBe(false);
    });

    it('should return false for regular objects', () => {
      expect(needsSerialization({})).toBe(false);
      expect(needsSerialization({ name: 'test' })).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(needsSerialization([])).toBe(false);
      expect(needsSerialization([1, 2, 3])).toBe(false);
    });
  });
});
