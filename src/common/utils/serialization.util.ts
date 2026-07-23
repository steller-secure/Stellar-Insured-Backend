import { isBigInt, isPrismaDecimal, isDate } from './type-guards.util';

/**
 * Deep serialization utility for converting special types to JSON-safe values
 * Handles BigInt, Prisma.Decimal, and Date recursively through objects and arrays
 */
export class SerializationTransformer {
  /**
   * Transform a value to JSON-safe format
   */
  static transform(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    // Handle BigInt
    if (isBigInt(value)) {
      return value.toString();
    }

    // Handle Prisma.Decimal
    if (isPrismaDecimal(value)) {
      return (value as any).toString();
    }

    // Handle Date
    if (isDate(value)) {
      return value.toISOString();
    }

    // Handle arrays recursively
    if (Array.isArray(value)) {
      return value.map(item => this.transform(item));
    }

    // Handle objects recursively
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(
        value as Record<string, unknown>,
      )) {
        result[key] = this.transform(item);
      }
      return result;
    }

    // Return primitive values as-is
    return value;
  }

  /**
   * Transform a specific field if it needs serialization
   */
  static transformField(value: unknown): unknown {
    if (isBigInt(value)) {
      return value.toString();
    }
    if (isPrismaDecimal(value)) {
      return (value as any).toString();
    }
    if (isDate(value)) {
      return value.toISOString();
    }
    return value;
  }

  /**
   * Transform an array of values
   */
  static transformArray<T>(values: T[]): unknown[] {
    return values.map(item => this.transform(item));
  }

  /**
   * Transform a partial object (only specified fields)
   */
  static transformPartial<T extends Record<string, unknown>>(
    obj: T,
    fields: (keyof T)[],
  ): Partial<T> {
    const result: Partial<T> = {};
    for (const field of fields) {
      if (field in obj) {
        result[field] = this.transform(obj[field]) as T[keyof T];
      }
    }
    return result;
  }
}
