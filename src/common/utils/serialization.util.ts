import { isBigInt, isPrismaDecimal, isDate } from './type-guards.util';

/**
 * Keys that are internal-only and must never appear in a public API response.
 *
 * `deletedAt` is the soft-delete marker used across every model (see
 * prisma/schema.prisma and SOFT_DELETE_GUIDE.md). It is meaningful to the
 * platform (soft-delete lifecycle, audit, admin flows) but is not data an
 * external consumer should rely on — responses deliberately omit it so it
 * cannot leak through any endpoint, at any nesting depth.
 */
export const INTERNAL_ONLY_KEYS: ReadonlySet<string> = new Set(['deletedAt']);

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

  /**
   * Deep-copies a plain-object/array payload, dropping every key listed in
   * {@link INTERNAL_ONLY_KEYS} (currently the `deletedAt` soft-delete marker)
   * at any nesting depth. This is the single sanitization pass applied to
   * public responses by ResponseTransformInterceptor.
   *
   * Guarantees:
   * - Non-mutating: the input graph is never modified; a fresh object/array
   *   graph is returned.
   * - Cycle-safe: `ancestors` tracks the current recursion path, so circular
   *   references terminate (the cycle point resolves to `undefined`) instead
   *   of recursing forever. Unlike a fixed depth cap, this also means deeply
   *   nested payloads cannot smuggle internal-only keys past the filter.
   * - Shared (non-circular) references are fully sanitized on every visit.
   * - Class instances (Date, Prisma.Decimal, ...) are preserved by reference
   *   so the transformer can convert them to JSON-safe values downstream.
   */
  static stripInternalFields(
    value: unknown,
    ancestors = new Set<object>(),
  ): unknown {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      if (ancestors.has(value)) {
        // Circular reference — resolve the cycle point so serialization
        // terminates instead of overflowing the stack.
        return undefined;
      }
      ancestors.add(value);
      const result = value.map(item =>
        this.stripInternalFields(item, ancestors),
      );
      ancestors.delete(value);
      return result;
    }

    // Only traverse plain objects; class instances (Date, Prisma.Decimal,
    // Buffer, ...) carry no internal-only keys of ours and are returned
    // untouched for the special-type transformer to convert.
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }

    if (ancestors.has(value)) {
      return undefined;
    }
    ancestors.add(value);

    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (INTERNAL_ONLY_KEYS.has(key)) {
        continue;
      }
      result[key] = this.stripInternalFields(entry, ancestors);
    }

    ancestors.delete(value);
    return result;
  }
}
