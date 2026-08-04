import { AsyncLocalStorage } from 'async_hooks';

/**
 * Fields automatically injected into every log line, DB audit record, and
 * notification payload emitted while a request (or background job/on-chain
 * event) is in flight. See winston.config.ts for how this is read back out
 * on every log call, and correlation-id.middleware.ts for where the HTTP
 * request scope is created.
 */
export interface TracingContext {
  correlationId: string;
  userId?: string;
  entityId?: string;
  eventId?: string;
}

const storage = new AsyncLocalStorage<TracingContext>();

/**
 * Starts a brand-new tracing scope. Everything invoked synchronously or
 * asynchronously from within `fn` sees `getTracingContext()` return this
 * context (or a mutated copy of it via `updateTracingContext`).
 *
 * Used once per HTTP request (correlation-id.middleware.ts) and once per
 * background unit of work that has no parent request — a queued email/push
 * job or an indexed on-chain event.
 */
export function runWithTracingContext<T>(
  context: TracingContext,
  fn: () => T,
): T {
  return storage.run(context, fn);
}

export function getTracingContext(): TracingContext | undefined {
  return storage.getStore();
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * Merges fields into the *current* tracing scope in place. Because
 * AsyncLocalStorage hands out the same object reference throughout a scope's
 * lifetime, this makes the update visible to everything downstream (log
 * lines, audit writes, notification payloads) without those callers having
 * to thread the values through function signatures themselves.
 *
 * A no-op outside of a tracing scope (e.g. code invoked from a unit test
 * that never calls `runWithTracingContext`) so callers never need to guard.
 */
export function updateTracingContext(
  patch: Partial<Omit<TracingContext, 'correlationId'>>,
): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  if (patch.userId !== undefined) ctx.userId = patch.userId;
  if (patch.entityId !== undefined) ctx.entityId = patch.entityId;
  if (patch.eventId !== undefined) ctx.eventId = patch.eventId;
}

/** Route params commonly used to identify the primary entity of a request. */
const ENTITY_ID_PARAM_KEYS = [
  'entityId',
  'claimId',
  'policyId',
  'poolId',
  'projectId',
  'contractId',
  'id',
];

/**
 * Best-effort extraction of a primary entity id from route params, so most
 * routes get `entityId` populated without every controller having to call
 * `updateTracingContext` by hand. Controllers/services with more specific
 * knowledge of "the" entity for a flow can still call
 * `updateTracingContext({ entityId })` directly to override this guess.
 */
export function extractEntityIdFromParams(
  params: Record<string, string> | undefined,
): string | undefined {
  if (!params) return undefined;
  for (const key of ENTITY_ID_PARAM_KEYS) {
    if (params[key]) return params[key];
  }
  return undefined;
}
