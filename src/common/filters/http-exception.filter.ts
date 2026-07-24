import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ThrottlerException } from '@nestjs/throttler';
import { ErrorCode } from '../enums/error-codes.enum';
import {
  ErrorResponseDto,
  ValidationFieldError,
} from '../dto/error-response.dto';

type ErrorDetails = ValidationFieldError[] | Record<string, unknown> | null;

interface ExtractedErrorInfo {
  status: number;
  code: string;
  message: string;
  details?: ErrorDetails;
}

interface HttpExceptionResponseBody {
  message?: string | string[];
}

/**
 * AllExceptionsFilter
 *
 * Global exception filter — catches **every** thrown exception and converts it
 * into the standardised ErrorResponseDto shape so clients always receive:
 *
 *   { success: false, error: { code, message, details, timestamp, path, requestId } }
 *
 * Previously the codebase had four different error shapes:
 *  1. { error: 'message' }   — returned with HTTP 200
 *  2. NestJS default          — { statusCode, message, error }
 *  3. Unhandled exception     — { message, statusCode: 500 }
 *  4. throw new Error(...)    — { message, statusCode: 500 }
 *
 * This filter replaces all four with a single, predictable contract.
 *
 * Register it globally in AppModule:
 *   { provide: APP_FILTER, useClass: AllExceptionsFilter }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.extractErrorInfo(exception);

    // Pull correlation ID injected by CorrelationIdMiddleware (if present).
    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request.headers['x-correlation-id'] as string) ||
      undefined;

    const body: ErrorResponseDto = {
      success: false,
      error: {
        code,
        message,
        details: details ?? null,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId,
      },
    };

    // Log server errors (5xx) at error level; client errors (4xx) at warn.
    if (status >= 500) {
      this.logger.error(
        `[${requestId ?? '-'}] ${request.method} ${request.url} → ${status} ${code}: ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${requestId ?? '-'}] ${request.method} ${request.url} → ${status} ${code}: ${message}`,
      );
    }

    response.status(status).json(body);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private extractErrorInfo(exception: unknown): ExtractedErrorInfo {
    // 1. NestJS ThrottlerException
    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests. Please slow down and try again later.',
      };
    }

    // 2. Standard NestJS HttpException (covers NotFoundException, BadRequestException, etc.)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // Zod validation pipe errors arrive as an object with a `message` array.
      if (
        this.isHttpExceptionResponseBody(exceptionResponse) &&
        'message' in exceptionResponse &&
        Array.isArray(exceptionResponse.message)
      ) {
        const validationDetails = this.parseZodErrors(
          exceptionResponse.message,
        );
        return {
          status,
          code: ErrorCode.VALIDATION_ERROR,
          message: 'One or more input fields are invalid.',
          details: validationDetails,
        };
      }

      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : this.isHttpExceptionResponseBody(exceptionResponse) &&
              typeof exceptionResponse.message === 'string'
            ? exceptionResponse.message
            : exception.message;

      return {
        status,
        code: this.httpStatusToErrorCode(status),
        message,
      };
    }

    // 3. Prisma client errors
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.prismaErrorToErrorInfo(exception);
    }

    // 4. Generic / unknown exceptions
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred. Please try again later.',
    };
  }

  private prismaErrorToErrorInfo(
    exception: Prisma.PrismaClientKnownRequestError,
  ): ExtractedErrorInfo {
    const map: Record<string, ExtractedErrorInfo> = {
      P2000: {
        status: HttpStatus.BAD_REQUEST,
        code: ErrorCode.BAD_REQUEST,
        message: 'The provided value is too long for a database field.',
      },
      P2002: {
        status: HttpStatus.CONFLICT,
        code: ErrorCode.CONFLICT,
        message: 'A record with the provided data already exists.',
      },
      P2003: {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: ErrorCode.UNPROCESSABLE_ENTITY,
        message: 'The referenced resource does not exist.',
      },
      P2011: {
        status: HttpStatus.BAD_REQUEST,
        code: ErrorCode.BAD_REQUEST,
        message: 'A required value cannot be null.',
      },
      P2025: {
        status: HttpStatus.NOT_FOUND,
        code: ErrorCode.NOT_FOUND,
        message: 'The requested database record was not found.',
      },
    };

    return (
      map[exception.code] ?? {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        message: 'A database error occurred.',
      }
    );
  }

  private isHttpExceptionResponseBody(
    value: unknown,
  ): value is HttpExceptionResponseBody {
    return typeof value === 'object' && value !== null;
  }

  /**
   * Convert an array of Zod validation error strings into structured
   * ValidationFieldError objects.
   *
   * ZodValidationPipe formats errors as:
   *   "field: error message"
   */
  private parseZodErrors(
    messages: string[],
  ): ValidationFieldError[] {
    const fieldMap = new Map<string, string[]>();

    for (const msg of messages) {
      // Zod-formatted error (field: message)
      const colonIdx = msg.indexOf(': ');
      if (colonIdx > -1) {
        const field = msg.substring(0, colonIdx);
        const constraint = msg.substring(colonIdx + 2);
        if (!fieldMap.has(field)) fieldMap.set(field, []);
        fieldMap.get(field)!.push(constraint);
      } else {
        // Fallback: split on first space
        const spaceIdx = msg.indexOf(' ');
        const field = spaceIdx > -1 ? msg.substring(0, spaceIdx) : 'unknown';
        const constraint = msg;
        if (!fieldMap.has(field)) fieldMap.set(field, []);
        fieldMap.get(field)!.push(constraint);
      }
    }

    return Array.from(fieldMap.entries()).map(([field, constraints]) => ({
      field,
      constraints,
    }));
  }

  private httpStatusToErrorCode(status: number): ErrorCode {
    const map: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.UNPROCESSABLE_ENTITY,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.TOO_MANY_REQUESTS,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
    };
    return map[status] ?? ErrorCode.INTERNAL_SERVER_ERROR;
  }
}
