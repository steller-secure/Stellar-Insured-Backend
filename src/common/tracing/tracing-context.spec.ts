import {
  runWithTracingContext,
  getTracingContext,
  getCorrelationId,
  updateTracingContext,
  extractEntityIdFromParams,
} from './tracing-context';

describe('tracing-context', () => {
  it('returns undefined outside of any tracing scope', () => {
    expect(getTracingContext()).toBeUndefined();
    expect(getCorrelationId()).toBeUndefined();
  });

  it('exposes the context set at scope creation', () => {
    runWithTracingContext({ correlationId: 'corr-1', userId: 'user-1' }, () => {
      expect(getTracingContext()).toEqual({
        correlationId: 'corr-1',
        userId: 'user-1',
      });
      expect(getCorrelationId()).toBe('corr-1');
    });
  });

  it('propagates across async boundaries within the same scope', async () => {
    await runWithTracingContext({ correlationId: 'corr-async' }, async () => {
      await Promise.resolve();
      await new Promise((resolve) => setImmediate(resolve));
      expect(getCorrelationId()).toBe('corr-async');
    });
  });

  it('isolates concurrent scopes from each other', async () => {
    const results: string[] = [];

    await Promise.all([
      runWithTracingContext({ correlationId: 'A' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        results.push(getCorrelationId()!);
      }),
      runWithTracingContext({ correlationId: 'B' }, async () => {
        results.push(getCorrelationId()!);
      }),
    ]);

    expect(results.sort()).toEqual(['A', 'B']);
  });

  describe('updateTracingContext', () => {
    it('merges fields into the current scope in place', () => {
      runWithTracingContext({ correlationId: 'corr-2' }, () => {
        updateTracingContext({ userId: 'user-2' });
        updateTracingContext({ entityId: 'entity-2' });
        updateTracingContext({ eventId: 'event-2' });

        expect(getTracingContext()).toEqual({
          correlationId: 'corr-2',
          userId: 'user-2',
          entityId: 'entity-2',
          eventId: 'event-2',
        });
      });
    });

    it('is a no-op outside of a tracing scope', () => {
      expect(() => updateTracingContext({ userId: 'orphan' })).not.toThrow();
      expect(getTracingContext()).toBeUndefined();
    });
  });

  describe('extractEntityIdFromParams', () => {
    it('returns undefined when params are missing or empty', () => {
      expect(extractEntityIdFromParams(undefined)).toBeUndefined();
      expect(extractEntityIdFromParams({})).toBeUndefined();
    });

    it.each([
      ['entityId'],
      ['claimId'],
      ['policyId'],
      ['poolId'],
      ['projectId'],
      ['contractId'],
      ['id'],
    ])('picks up the %s route param', (key) => {
      expect(extractEntityIdFromParams({ [key]: 'value-1' })).toBe('value-1');
    });

    it('prefers more specific keys over the generic "id"', () => {
      expect(
        extractEntityIdFromParams({ id: 'generic', claimId: 'specific' }),
      ).toBe('specific');
    });
  });
});
