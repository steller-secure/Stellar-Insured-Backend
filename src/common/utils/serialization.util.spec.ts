import {
  INTERNAL_ONLY_KEYS,
  SerializationTransformer,
} from './serialization.util';

describe('SerializationTransformer', () => {
  describe('transform', () => {
    it('should convert BigInt to string', () => {
      // Use a BigInt literal — a Number literal this large loses precision
      // before BigInt() ever sees it, which broke this assertion.
      const input = 12345678901234567890n;
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

  describe('stripInternalFields', () => {
    it('drops deletedAt from top-level objects and keeps legitimate fields', () => {
      const result = SerializationTransformer.stripInternalFields({
        id: 'policy-1',
        deletedAt: new Date('2026-01-01T00:00:00.000Z'),
        status: 'ACTIVE',
      }) as Record<string, unknown>;

      expect(result).toEqual({ id: 'policy-1', status: 'ACTIVE' });
      expect(result.deletedAt).toBeUndefined();
    });

    it('drops deletedAt from nested objects at any depth', () => {
      const result = SerializationTransformer.stripInternalFields({
        policy: {
          holder: { name: 'Ada', deletedAt: new Date() },
          deletedAt: null,
        },
        deletedAt: new Date(),
      }) as Record<string, unknown>;

      expect(result).toEqual({
        policy: { holder: { name: 'Ada' } },
      });
    });

    it('drops deletedAt from arrays and nested arrays', () => {
      const result = SerializationTransformer.stripInternalFields({
        items: [
          { id: 'a', deletedAt: new Date() },
          [{ id: 'b', deletedAt: new Date() }],
        ],
      }) as Record<string, unknown>;

      expect(result).toEqual({
        items: [{ id: 'a' }, [{ id: 'b' }]],
      });
    });

    it('handles null, undefined and primitives', () => {
      expect(SerializationTransformer.stripInternalFields(null)).toBeNull();
      expect(
        SerializationTransformer.stripInternalFields(undefined),
      ).toBeUndefined();
      expect(SerializationTransformer.stripInternalFields('text')).toBe('text');
      expect(SerializationTransformer.stripInternalFields(42)).toBe(42);
      expect(SerializationTransformer.stripInternalFields(true)).toBe(true);
    });

    it('preserves class instances such as Date by reference', () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      const result = SerializationTransformer.stripInternalFields({
        createdAt,
        deletedAt: createdAt,
      }) as Record<string, unknown>;

      expect(result).toEqual({ createdAt });
      expect(result.createdAt).toBe(createdAt);
    });

    it('strips internal keys from payloads nested far deeper than 10 levels', () => {
      let payload: Record<string, unknown> = { deletedAt: new Date() };
      for (let i = 0; i < 30; i++) {
        payload = { level: payload };
      }

      const result = SerializationTransformer.stripInternalFields(payload) as {
        level: unknown;
      };
      let node: unknown = result;
      for (let i = 0; i < 30; i++) {
        node = (node as { level: unknown }).level;
      }
      expect(node).toEqual({});
    });

    it('terminates on circular references without leaking internal keys at the top level', () => {
      const circular: Record<string, unknown> = {
        deletedAt: new Date(),
        name: 'self-referential',
      };
      circular.self = circular;

      const result = SerializationTransformer.stripInternalFields(
        circular,
      ) as Record<string, unknown>;

      expect(result.name).toBe('self-referential');
      expect(result.deletedAt).toBeUndefined();
      expect(result.self).toBeUndefined();
    });

    it('fully sanitizes shared (non-circular) object references on every occurrence', () => {
      const shared = { deletedAt: new Date(), tag: 'shared' };
      const result = SerializationTransformer.stripInternalFields({
        first: shared,
        second: shared,
      }) as Record<string, unknown>;

      expect(result).toEqual({
        first: { tag: 'shared' },
        second: { tag: 'shared' },
      });
    });

    it('does not mutate the original input', () => {
      const deletedAt = new Date();
      const input = {
        id: 'x',
        deletedAt,
        nested: { deletedAt },
      };

      SerializationTransformer.stripInternalFields(input);

      expect(input).toEqual({ id: 'x', deletedAt, nested: { deletedAt } });
      expect(input.deletedAt).toBe(deletedAt);
    });

    it('returns new object/array graphs instead of reusing input references', () => {
      const input = { id: 'x', items: [{ id: 'y' }] };
      const result = SerializationTransformer.stripInternalFields(
        input,
      ) as Record<string, unknown>;

      expect(result).not.toBe(input);
      expect(result.items).not.toBe(input.items);
    });

    it('handles empty objects and arrays', () => {
      expect(SerializationTransformer.stripInternalFields({})).toEqual({});
      expect(SerializationTransformer.stripInternalFields([])).toEqual([]);
    });

    it('exposes exactly the internal-only keys documented for stripping', () => {
      expect(Array.from(INTERNAL_ONLY_KEYS)).toEqual(['deletedAt']);
    });
  });
});
