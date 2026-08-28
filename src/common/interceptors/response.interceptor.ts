import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, map, catchError } from 'rxjs';
import { jsonReplacer } from '../utils/json-replacer.util';
import {
  INTERNAL_ONLY_KEYS,
  SerializationTransformer,
} from '../utils/serialization.util';
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

/** Maximum nesting the safe-serialization fallback will traverse. */
const SAFE_SERIALIZE_MAX_DEPTH = 100;

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
    const request = http.getRequest?.();
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
          data: this.serializeSpecialTypes(
            SerializationTransformer.stripInternalFields(data),
          ),
          // `meta` is sanitized too: pagination metadata must not become a
          // back-door for internal-only fields.
          meta: this.serializeSpecialTypes(
            SerializationTransformer.stripInternalFields(meta),
          ),
        };
      }

      return {
        success: true,
        data: this.serializeSpecialTypes(
          SerializationTransformer.stripInternalFields(body),
        ),
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
   * Safe serialization fallback that handles errors gracefully. This is the
   * last line of defense: it still drops internal-only keys (so the fallback
   * path can never reintroduce what the primary path stripped) and is depth-
   * bounded so circular payloads terminate instead of overflowing the stack.
   */
  private safeSerialize(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    // Depth guard: circular references (or pathological nesting) terminate
    // here rather than recursing forever.
    if (depth > SAFE_SERIALIZE_MAX_DEPTH) {
      return String(value);
    }

    // Use the jsonReplacer for individual values
    const replaced = jsonReplacer('', value);
    if (replaced !== value) {
      return replaced;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.safeSerialize(item, depth + 1));
    }

    if (typeof value === 'object') {
      try {
        const result: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (INTERNAL_ONLY_KEYS.has(key)) {
            continue;
          }
          result[key] = this.safeSerialize(entry, depth + 1);
        }
        return result;
      } catch {
        // If object serialization fails, return string representation
        return String(value);
      }
    }

    return value;
  }
}
