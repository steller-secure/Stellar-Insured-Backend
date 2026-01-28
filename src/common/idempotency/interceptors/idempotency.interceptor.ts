import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { IdempotencyService } from '../idempotency.service';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';

/**
 * Interceptor to handle idempotency key logic for critical endpoints
 * 
 * Flow:
 * 1. Check if endpoint requires idempotency (@Idempotent decorator)
 * 2. Extract Idempotency-Key header from request
 * 3. Check if request with same key was already processed
 * 4. If yes, return cached response
 * 5. If no, process request and cache the result
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Check if the endpoint is marked as @Idempotent
    const isIdempotent = this.reflector.get<boolean>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );

    if (!isIdempotent) {
      // Not an idempotent endpoint, pass through
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const idempotencyKey = request.headers['idempotency-key'] as string;
    const userId = request.user?.id || null;
    const method = request.method;
    const endpoint = request.baseUrl + request.path;
    const requestBody = request.body;

    try {
      // Check if this request has already been processed
      const checkResult = await this.idempotencyService.checkIdempotency(
        idempotencyKey,
        userId,
        method,
        endpoint,
        requestBody,
      );

      if (checkResult.isDuplicate && checkResult.cachedResponse) {
        this.logger.debug(
          `Replaying cached response for idempotency key: ${idempotencyKey}`,
        );

        // Return cached response
        response.status(checkResult.cachedResponse.statusCode);

        // If the original request resulted in an error, throw it
        if (checkResult.cachedResponse.status === 'ERROR') {
          return throwError(
            () =>
              new ConflictException({
                message: 'Duplicate request detected (cached error)',
                statusCode: checkResult.cachedResponse.statusCode,
                originalError: checkResult.cachedResponse.errorMessage,
              }),
          );
        }

        return new Observable((observer) => {
          observer.next(checkResult.cachedResponse.response);
          observer.complete();
        });
      }

      // New request - create idempotency record
      await this.idempotencyService.createIdempotencyRecord(
        idempotencyKey,
        userId,
        method,
        endpoint,
        requestBody,
      );

      // Process the request
      return next.handle().pipe(
        tap(async (responseData) => {
          // Store successful response
          const statusCode = response.statusCode || HttpStatus.OK;
          await this.idempotencyService.markAsSuccess(
            idempotencyKey,
            userId,
            statusCode,
            responseData,
          );
        }),
        catchError(async (error) => {
          // Store error response
          const statusCode = error.getStatus?.() || HttpStatus.INTERNAL_SERVER_ERROR;
          const errorMessage = error.message || 'Unknown error';

          await this.idempotencyService.markAsError(
            idempotencyKey,
            userId,
            statusCode,
            errorMessage,
          );

          return throwError(() => error);
        }),
      );
    } catch (error) {
      // If idempotency check fails, let it propagate
      // (will be handled by global exception filter)
      return throwError(() => error);
    }
  }
}
