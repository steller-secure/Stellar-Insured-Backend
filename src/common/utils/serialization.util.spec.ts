import { SerializationTransformer } from './serialization.util';

describe('SerializationTransformer', () => {
  describe('transform', () => {
    it('should convert BigInt to string', () => {
      const input = BigInt('12345678901234567890');
      const result = SerializationTransformer.transform(input);
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
      const result = SerializationTransformer.transform(decimalMock);
      expect(result).toBe('123.45');
    });

    it('should convert Date to ISO string', () => {
      const dateValue = new Date('2024-01-15T10:30:00.000Z');
      const result = SerializationTransformer.transform(dateValue);
      expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should handle null and undefined', () => {
      expect(SerializationTransformer.transform(null)).toBe(null);
      expect(SerializationTransformer.transform(undefined)).toBe(undefined);
    });

    it('should handle primitive values', () => {
      expect(SerializationTransformer.transform('string')).toBe('string');
      expect(SerializationTransformer.transform(123)).toBe(123);
      expect(SerializationTransformer.transform(true)).toBe(true);
    });

    it('should handle arrays recursively', () => {
      const input = [BigInt(1), BigInt(2), BigInt(3)];
      const result = SerializationTransformer.transform(input);
      expect(result).toEqual(['1', '2', '3']);
    });

    it('should handle nested arrays', () => {
      const input = [[BigInt(1), BigInt(2)], [BigInt(3)]];
      const result = SerializationTransformer.transform(input);
      expect(result).toEqual([['1', '2'], ['3']]);
    });

    it('should handle objects recursively', () => {
      const input = {
        bigIntField: BigInt(123),
        decimalField: { d: [456], s: 2, e: 0, toString: () => '4.56' },
        dateField: new Date('2024-01-01T00:00:00.000Z'),
        normalField: 'test',
      };
      const result = SerializationTransformer.transform(input);
      expect(result).toEqual({
        bigIntField: '123',
        decimalField: '4.56',
        dateField: '2024-01-01T00:00:00.000Z',
        normalField: 'test',
      });
    });

    it('should handle nested objects', () => {
      const input = {
        nested: {
          deep: {
            bigIntField: BigInt(999),
          },
        },
      };
      const result = SerializationTransformer.transform(input);
      expect(result).toEqual({
        nested: {
          deep: {
            bigIntField: '999',
          },
        },
      });
    });

    it('should handle mixed arrays and objects', () => {
      const input = {
        items: [BigInt(1), BigInt(2)],
        nested: { value: BigInt(3) },
      };
      const result = SerializationTransformer.transform(input);
      expect(result).toEqual({
        items: ['1', '2'],
        nested: { value: '3' },
      });
    });

    it('should handle empty arrays and objects', () => {
      expect(SerializationTransformer.transform([])).toEqual([]);
      expect(SerializationTransformer.transform({})).toEqual({});
    });
  });

  describe('transformField', () => {
    it('should transform BigInt field', () => {
      const result = SerializationTransformer.transformField(BigInt(123));
      expect(result).toBe('123');
    });

    it('should transform Decimal field', () => {
      const decimalMock = { d: [123], s: 2, e: 0, toString: () => '1.23' };
      const result = SerializationTransformer.transformField(decimalMock);
      expect(result).toBe('1.23');
    });

    it('should transform Date field', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const result = SerializationTransformer.transformField(date);
      expect(result).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should return other values unchanged', () => {
      expect(SerializationTransformer.transformField('test')).toBe('test');
      expect(SerializationTransformer.transformField(123)).toBe(123);
    });
  });

  describe('transformArray', () => {
    it('should transform array of BigInt values', () => {
      const input = [BigInt(1), BigInt(2), BigInt(3)];
      const result = SerializationTransformer.transformArray(input);
      expect(result).toEqual(['1', '2', '3']);
    });

    it('should transform array of mixed values', () => {
      const input = [BigInt(1), 'test', 123];
      const result = SerializationTransformer.transformArray(input);
      expect(result).toEqual(['1', 'test', 123]);
    });
  });

  describe('transformPartial', () => {
    it('should transform specified fields', () => {
      const input = {
        bigIntField: BigInt(123),
        normalField: 'test',
        anotherField: 456,
      };
      const result = SerializationTransformer.transformPartial(input, [
        'bigIntField',
        'normalField',
      ]);
      expect(result).toEqual({
        bigIntField: '123',
        normalField: 'test',
      });
    });

    it('should handle missing fields gracefully', () => {
      const input = { bigIntField: BigInt(123) };
      const result = SerializationTransformer.transformPartial(input, [
        'bigIntField',
        'missingField' as any,
      ]);
      expect(result).toEqual({
        bigIntField: '123',
      });
    });
  });
});
