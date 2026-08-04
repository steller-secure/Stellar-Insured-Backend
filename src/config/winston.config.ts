import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { LoggerService } from '@nestjs/common';
import { redactFormat } from '../common/utils/log-redaction.util';
import { getTracingContext } from '../common/tracing/tracing-context';

/**
 * Pulls correlationId/userId/entityId/eventId out of the current
 * AsyncLocalStorage scope (see tracing-context.ts) and stamps them onto
 * every log entry. Because this runs as part of the logger-level format
 * chain, it applies uniformly to every transport and every call site —
 * `new Logger().log(...)`, expressWinston's request/error loggers, and
 * direct winston calls alike — with zero changes required at each call
 * site. Placed before `redactFormat()` so the redaction pass can apply its
 * trace-aware allowlist to the fields this adds.
 */
export const tracingFormat = winston.format((info) => {
  const ctx = getTracingContext();
  if (!ctx) return info;

  if (ctx.correlationId && info.correlationId === undefined) {
    info.correlationId = ctx.correlationId;
  }
  if (ctx.userId && info.userId === undefined) {
    info.userId = ctx.userId;
  }
  if (ctx.entityId && info.entityId === undefined) {
    info.entityId = ctx.entityId;
  }
  if (ctx.eventId && info.eventId === undefined) {
    info.eventId = ctx.eventId;
  }

  return info;
});

const isProduction = process.env.NODE_ENV === 'production';
const logDir = process.env.LOG_DIR || 'logs';
const logLevel = process.env.LOG_LEVEL || 'info';

const consoleFormat = isProduction
  ? winston.format.json()
  : winston.format.combine(winston.format.colorize(), winston.format.simple());

export const winstonConfig: winston.LoggerOptions = {
  level: logLevel,
  exitOnError: false,
  defaultMeta: { service: process.env.SERVICE_NAME || 'stellar-insured-backend' },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    tracingFormat(),
    redactFormat(),
  ),
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new winston.transports.DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: logLevel,
    }),
    new winston.transports.DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      level: 'error',
    }),
  ],
};

export const logger = winston.createLogger(winstonConfig);

/**
 * NestJS's `LoggerService` calls `.log(message, context)` / `.error(message,
 * stack, context)` etc — two or three positional string args. Winston's own
 * `.log()` has a *different* two-arg signature, `(level, message)`, so
 * passing the raw winston `logger` instance straight to `NestFactory.create`
 * (as `{ logger }`) silently misreads every `new Logger().log(msg)` /
 * `.warn(msg)` / `.debug(msg)` call's message as a log *level*. Winston then
 * drops the entry as an "Unknown logger level" instead of writing it — the
 * likely reason tracing/log fields were reported missing from "many log
 * lines" in the first place. This adapter translates Nest's calling
 * convention into winston's `logger.info(message, meta)`-style shortcuts so
 * every `Logger` call site in the app is actually written (and, via
 * `tracingFormat` above, actually carries the current trace context).
 */
export class NestWinstonLogger implements LoggerService {
  constructor(private readonly winstonLogger: winston.Logger = logger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.winstonLogger.info(String(message), this.buildMeta(optionalParams));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.winstonLogger.error(String(message), this.buildMeta(optionalParams, true));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.winstonLogger.warn(String(message), this.buildMeta(optionalParams));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.winstonLogger.debug(String(message), this.buildMeta(optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.winstonLogger.verbose(String(message), this.buildMeta(optionalParams));
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.winstonLogger.error(String(message), { ...this.buildMeta(optionalParams, true), fatal: true });
  }

  /**
   * Nest's convention is `(message, ...rest, context?)`, with `.error` also
   * accepting a `stack` before `context`: `(message, stack?, context?)`.
   */
  private buildMeta(
    optionalParams: unknown[],
    withStack = false,
  ): Record<string, unknown> {
    const meta: Record<string, unknown> = {};
    const params = [...optionalParams];

    if (params.length > 0 && typeof params[params.length - 1] === 'string') {
      meta.context = params.pop();
    }
    if (withStack && params.length > 0 && typeof params[params.length - 1] === 'string') {
      meta.trace = params.pop();
    }

    return meta;
  }
}

export const nestWinstonLogger = new NestWinstonLogger();
