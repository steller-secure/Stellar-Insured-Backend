import * as winston from 'winston';
import Transport from 'winston-transport';
import { tracingFormat, NestWinstonLogger } from './winston.config';
import { redactFormat } from '../common/utils/log-redaction.util';
import {
  runWithTracingContext,
  updateTracingContext,
} from '../common/tracing/tracing-context';

class MemoryTransport extends Transport {
  entries: winston.Logform.TransformableInfo[] = [];

  log(info: winston.Logform.TransformableInfo, callback: () => void): void {
    this.entries.push(info);
    callback();
  }
}

describe('winston tracingFormat', () => {
  it('leaves the log entry untouched outside of a tracing scope', () => {
    const info = tracingFormat().transform(
      { level: 'info', message: 'no scope' },
      undefined,
    ) as winston.Logform.TransformableInfo;

    expect(info.correlationId).toBeUndefined();
    expect(info.userId).toBeUndefined();
    expect(info.entityId).toBeUndefined();
    expect(info.eventId).toBeUndefined();
  });

  it('stamps correlationId, userId, entityId and eventId from the active tracing scope', () => {
    const result = runWithTracingContext(
      { correlationId: 'corr-1', userId: 'user-1' },
      () => {
        updateTracingContext({ entityId: 'entity-1', eventId: 'event-1' });
        return tracingFormat().transform(
          { level: 'info', message: 'inside scope' },
          undefined,
        ) as winston.Logform.TransformableInfo;
      },
    );

    expect(result.correlationId).toBe('corr-1');
    expect(result.userId).toBe('user-1');
    expect(result.entityId).toBe('entity-1');
    expect(result.eventId).toBe('event-1');
  });

  it('does not overwrite fields a call site set explicitly', () => {
    const result = runWithTracingContext({ correlationId: 'corr-2' }, () =>
      tracingFormat().transform(
        { level: 'info', message: 'explicit', correlationId: 'explicit-id' },
        undefined,
      ),
    ) as winston.Logform.TransformableInfo;

    expect(result.correlationId).toBe('explicit-id');
  });

  it('survives redactFormat without the correlation ID being scrubbed as a UUID', () => {
    // This is the crux of the bug this feature had to work around:
    // log-redaction.util.ts blindly redacts any UUID-shaped string, which
    // would otherwise strip the very correlation ID this feature exists to
    // preserve. tracingFormat must run, and redactFormat must special-case
    // the structured trace fields, for this to hold.
    const correlationId = '11111111-2222-4333-8444-555555555555';

    const combined = winston.format.combine(tracingFormat(), redactFormat());

    const result = runWithTracingContext({ correlationId }, () =>
      combined.transform(
        { level: 'info', message: `Claim ${correlationId} touched` },
        undefined,
      ),
    ) as winston.Logform.TransformableInfo;

    expect(result.correlationId).toBe(correlationId);
    // Free-text UUIDs embedded in an arbitrary message are still redacted —
    // only the dedicated structured field is exempted.
    expect(result.message).not.toContain(correlationId);
  });
});

describe('NestWinstonLogger', () => {
  let memoryTransport: MemoryTransport;
  let testLogger: winston.Logger;
  let nestLogger: NestWinstonLogger;

  beforeEach(() => {
    memoryTransport = new MemoryTransport();
    testLogger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(tracingFormat(), winston.format.json()),
      transports: [memoryTransport],
    });
    nestLogger = new NestWinstonLogger(testLogger);
  });

  it('writes Logger.log(message, context) as a correctly-leveled entry', () => {
    // Regression test: passing a raw winston.Logger to NestFactory.create
    // means Nest's `.log(message, context)` hits winston's own
    // `.log(level, message)` signature, which silently drops the entry as
    // an "Unknown logger level". NestWinstonLogger must translate the call
    // instead of forwarding it as-is.
    nestLogger.log('hello world', 'MyContext');

    expect(memoryTransport.entries).toHaveLength(1);
    expect(memoryTransport.entries[0].level).toBe('info');
    expect(memoryTransport.entries[0].message).toBe('hello world');
    expect(memoryTransport.entries[0].context).toBe('MyContext');
  });

  it('writes Logger.error(message, stack, context) with both stack and context preserved', () => {
    nestLogger.error('it broke', 'Error: boom\n at x', 'MyContext');

    expect(memoryTransport.entries).toHaveLength(1);
    expect(memoryTransport.entries[0].level).toBe('error');
    expect(memoryTransport.entries[0].message).toBe('it broke');
    expect(memoryTransport.entries[0].context).toBe('MyContext');
    expect(memoryTransport.entries[0].trace).toContain('boom');
  });

  it('carries the active tracing scope through onto the written entry', () => {
    runWithTracingContext({ correlationId: 'corr-log' }, () => {
      nestLogger.warn('careful now', 'MyContext');
    });

    expect(memoryTransport.entries[0].correlationId).toBe('corr-log');
  });
});
