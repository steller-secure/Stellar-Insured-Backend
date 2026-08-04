import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, map, catchError } from 'rxjs';
import { jsonReplacer } from '../utils/json-replacer.util';
import { SerializationTransformer } from '../utils/serialization.util';
import {
  extractEntityIdFromParams,
  getTracingContext,
  updateTracingContext,
} from '../tracing/tracing-context';

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: unknown;
}

interface RequestWithUser {
  user?: { id?: string };
  params?: Record<string, string>;
}

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResponseTransformInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<unknown> | unknown> {
    this.captureTraceContext(context);

    return next.handle().pipe(
      map(body => this.formatResponse(body)),
      catchError(error => {
        this.logger.error(
          `Response serialization error: ${error.message}`,
          error.stack,
        );
        throw error;
      }),
    );
  }

  /**
   * Runs after guards (so `request.user` is already populated by
   * JwtAuthGuard/passport) and before the route handler. Fills in `userId`
   * and a best-effort `entityId` on the current tracing scope, and mirrors
   * the correlation ID onto the response so callers can quote it back when
   * reporting an issue. Non-invasive by design — no controller/service
   * needs to know this is happening.
   */
  private captureTraceContext(context: ExecutionContext): void {
    if (!context || typeof context.switchToHttp !== 'function') return;

    const http = context.switchToHttp();
    const request = http.getRequest?.() as RequestWithUser | undefined;
    if (!request) return;

    if (request.user?.id) {
      updateTracingContext({ userId: request.user.id });
    }

    const entityId = extractEntityIdFromParams(request.params);
    if (entityId) {
      updateTracingContext({ entityId });
    }

    const response = http.getResponse?.();
    const ctx = getTracingContext();
    if (response && typeof response.setHeader === 'function' && ctx) {
      response.setHeader('x-correlation-id', ctx.correlationId);
      if (ctx.entityId) {
        response.setHeader('x-entity-id', ctx.entityId);
      }
    }
  }

  private formatResponse(body: unknown): unknown {
    try {
      if (
        body &&
        typeof body === 'object' &&
        !Array.isArray(body) &&
        'success' in body &&
        typeof (body as any).success === 'boolean'
      ) {
        return body;
      }

      if (
        body &&
        typeof body === 'object' &&
        !Array.isArray(body) &&
        'data' in body &&
        'meta' in body
      ) {
        const { data, meta } = body as any;
        return {
          success: true,
          data: this.serializeSpecialTypes(this.stripSoftDeleteMetadata(data)),
          meta,
        };
      }

      return {
        success: true,
        data: this.serializeSpecialTypes(this.stripSoftDeleteMetadata(body)),
      };
    } catch (error) {
      this.logger.error(
        `Error formatting response: ${error.message}`,
        error.stack,
      );
      // Return a safe fallback response if serialization fails
      return {
        success: true,
        data: this.safeSerialize(body),
      };
    }
  }

  private serializeSpecialTypes(value: unknown): unknown {
    try {
      return SerializationTransformer.transform(value);
    } catch (error) {
      this.logger.warn(
        `Serialization error, falling back to safe serialize: ${error.message}`,
      );
      return this.safeSerialize(value);
    }
  }

  /**
   * Safe serialization fallback that handles errors gracefully
   */
  private safeSerialize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    // Use the jsonReplacer for individual values
    const replaced = jsonReplacer('', value);
    if (replaced !== value) {
      return replaced;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.safeSerialize(item));
    }

    if (typeof value === 'object') {
      try {
        const result: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(
          value as Record<string, unknown>,
        )) {
          result[key] = this.safeSerialize(entry);
        }
        return result;
      } catch (error) {
        // If object serialization fails, return string representation
        return String(value);
      }
    }

    return value;
  }

  /**
   * Removes the internal `deletedAt` soft-delete marker from response
   * payloads so it never leaks through the public API. Only plain objects
   * and arrays are traversed; class instances (Date, Prisma.Decimal, ...)
   * are returned untouched.
   */
  private stripSoftDeleteMetadata(value: unknown, depth = 0): unknown {
    if (depth > 10 || value === null || typeof value !== 'object') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.stripSoftDeleteMetadata(item, depth + 1));
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return value;
    }

    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'deletedAt') {
        continue;
      }
      result[key] = this.stripSoftDeleteMetadata(entry, depth + 1);
    }

    return result;
  }
}
