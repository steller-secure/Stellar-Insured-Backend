import { jsonReplacer } from './json-replacer.util';

describe('jsonReplacer', () => {
  it('should convert BigInt to string', () => {
    const bigIntValue = BigInt('12345678901234567890');
    const result = jsonReplacer('', bigIntValue);
    expect(result).toBe('12345678901234567890');
    expect(typeof result).toBe('string');
  });

  it('should convert Prisma.Decimal to string', () => {
    const decimalMock = {
      d: [12345],
      s: 2,
      e: 0,
      toString: () => '123.45',
    };

    const result = jsonReplacer('', decimalMock);
    expect(result).toBe('123.45');
    expect(typeof result).toBe('string');
  });

  it('should convert Date to ISO string', () => {
    const dateValue = new Date('2024-01-15T10:30:00.000Z');
    const result = jsonReplacer('', dateValue);
    expect(result).toBe('2024-01-15T10:30:00.000Z');
    expect(typeof result).toBe('string');
  });

  it('should return primitive values unchanged', () => {
    expect(jsonReplacer('', 'string')).toBe('string');
    expect(jsonReplacer('', 123)).toBe(123);
    expect(jsonReplacer('', true)).toBe(true);
    expect(jsonReplacer('', null)).toBe(null);
    expect(jsonReplacer('', undefined)).toBe(undefined);
  });

  it('should return objects unchanged', () => {
    const obj = { name: 'test', value: 42 };
    const result = jsonReplacer('', obj);
    expect(result).toBe(obj);
  });

  it('should return arrays unchanged', () => {
    const arr = [1, 2, 3];
    const result = jsonReplacer('', arr);
    expect(result).toBe(arr);
  });

  it('should handle zero BigInt', () => {
    const result = jsonReplacer('', BigInt(0));
    expect(result).toBe('0');
  });

  it('should handle negative BigInt', () => {
    const result = jsonReplacer('', BigInt(-999));
    expect(result).toBe('-999');
  });

  it('should handle Decimal with zero', () => {
    const decimalMock = {
      d: [0],
      s: 0,
      e: 0,
      toString: () => '0',
    };
    const result = jsonReplacer('', decimalMock);
    expect(result).toBe('0');
  });

  it('should handle Decimal with negative value', () => {
    const decimalMock = {
      d: [123],
      s: 2,
      e: 0,
      toString: () => '-1.23',
    };
    const result = jsonReplacer('', decimalMock);
    expect(result).toBe('-1.23');
  });

  it('should ignore objects without Decimal structure', () => {
    const regularObj = { name: 'test', toString: () => 'custom' };
    const result = jsonReplacer('', regularObj);
    expect(result).toBe(regularObj);
  });

  it('should ignore objects with toString that returns non-numeric string', () => {
    const invalidDecimal = {
      d: [1],
      s: 0,
      e: 0,
      toString: () => 'not a number',
    };
    const result = jsonReplacer('', invalidDecimal);
    expect(result).toBe(invalidDecimal);
  });
});
