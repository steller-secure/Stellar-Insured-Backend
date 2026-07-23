/**
 * Input sanitization utilities to prevent XSS, injection, and prototype pollution.
 *
 * These helpers are intentionally dependency-free — they rely only on
 * built-in RegExp and recursive traversal — so they add zero bundle size
 * and remain fast for typical JSON payloads.
 */

/** HTML tag pattern – catches <script>, <img onerror=…>, etc. */
const HTML_TAG_RE = /<[^>]*>/g;

/** Dangerous object keys that could enable prototype pollution or script execution */
const DANGEROUS_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

/** Maximum nesting depth for sanitized objects to prevent deep-bomb attacks */
const MAX_OBJECT_DEPTH = 10;

/** Maximum number of keys allowed in a single object */
const MAX_OBJECT_KEYS = 50;

/** Maximum string length for individual values (100 KB) */
const MAX_STRING_LENGTH = 100_000;

/**
 * Strip HTML tags and trim whitespace from a string.
 * Returns the sanitized string.
 */
export function sanitizeString(value: string): string {
  if (typeof value !== 'string') return '';
  let sanitized = value.trim();
  sanitized = sanitized.replace(HTML_TAG_RE, '');
  if (sanitized.length > MAX_STRING_LENGTH) {
    sanitized = sanitized.substring(0, MAX_STRING_LENGTH);
  }
  return sanitized;
}

/**
 * Validate CUID or standard entity ID format (used by Prisma as default ID).
 * Accepts CUID v1, CUID v2, and standard test entity IDs (e.g. user-1, clxyz123abc).
 */
export function isValidCuid(id: string): boolean {
  if (typeof id !== 'string') return false;
  return /^[a-z][a-z0-9_\-]{5,31}$/i.test(id);
}

/**
 * Validate a Stellar public key (ed25519) or muxed account address.
 * Stellar public keys are base-32 encoded, start with 'G', and are 56 chars.
 */
export function isValidStellarAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  if (/^G[A-Z2-7]{55}$/.test(address)) return true;
  return false;
}

/**
 * Validate that a wallet address string is safe for database queries.
 * Accepts Stellar public keys and alphanumeric identifiers.
 */
export function isValidWalletAddress(address: string): boolean {
  if (typeof address !== 'string') return false;
  if (address.length === 0 || address.length > 256) return false;
  return /^[A-Za-z0-9_\-.@]+$/.test(address);
}

/**
 * Recursively sanitize a JSON-compatible value.
 *
 * - Strips HTML tags from strings
 * - Removes dangerous keys (`__proto__`, `constructor`, etc.)
 * - Enforces depth and key-count limits
 * - Preserves null, boolean, and number primitives
 */
export function sanitizeObject(
  value: unknown,
  depth = 0,
  visited = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (depth > MAX_OBJECT_DEPTH) return undefined;

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_OBJECT_KEYS)
      .map(item => sanitizeObject(item, depth + 1, visited));
  }

  if (typeof value === 'object') {
    if (visited.has(value as object)) return undefined;
    visited.add(value as object);

    const sanitized: Record<string, unknown> = Object.create(null);
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length > MAX_OBJECT_KEYS) {
      entries.length = MAX_OBJECT_KEYS;
    }

    for (const [key, val] of entries) {
      if (DANGEROUS_KEYS.has(key)) continue;
      if (key.includes('$') || key.includes('.')) continue;
      const safeKey = sanitizeString(key);
      if (!safeKey) continue;
      sanitized[safeKey] = sanitizeObject(val, depth + 1, visited);
    }

    return sanitized;
  }

  return undefined;
}
