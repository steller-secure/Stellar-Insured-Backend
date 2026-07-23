import { ErrorCode } from '../enums/error-codes.enum';

/**
 * ErrorDetailDto
 *
 * The `error` object nested inside every non-2xx response.
 */
export class ErrorDetailDto {
  /** Machine-readable error code clients can switch on. */
  code: ErrorCode | string;

  /** Human-readable description of what went wrong. */
  message: string;

  /**
   * Optional structured details (e.g. per-field validation errors).
   * Shape varies by error type; clients should treat this as unknown.
   */
  details?: Record<string, unknown> | ValidationFieldError[] | null;

  /** ISO-8601 timestamp of when the error occurred. */
  timestamp: string;

  /** The request path that produced the error. */
  path: string;

  /** Correlation / request ID for log tracing. */
  requestId?: string;
}

/**
 * ErrorResponseDto
 *
 * Top-level shape of every error response body.
 *
 * Example:
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "USER_NOT_FOUND",
 *     "message": "User with ID abc123 was not found.",
 *     "details": null,
 *     "timestamp": "2026-04-17T10:30:00.000Z",
 *     "path": "/api/v1/user/abc123",
 *     "requestId": "req-xyz"
 *   }
 * }
 * ```
 */
export class ErrorResponseDto {
  success: false = false;
  error: ErrorDetailDto;
}

/**
 * ValidationFieldError
 *
 * One entry in the `details` array when the error code is VALIDATION_ERROR.
 */
export class ValidationFieldError {
  /** The DTO field name that failed validation. */
  field: string;

  /** The invalid value that was received. */
  value?: unknown;

  /** Array of constraint messages that were violated. */
  constraints: string[];
}
