import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { DomainEventBus } from '../common/events/domain-event-bus.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: DomainEventBus,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const idempotencyKey =
      request.headers['idempotency-key'] || request.headers['Idempotency-Key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    this.eventBus.setIdempotencyKey(idempotencyKey as string);

    const method = request.method;
    const endpoint = request.url;

    try {
      const existingKey = await this.prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      if (existingKey) {
        const isExpired = new Date() > existingKey.expiresAt;

        if (!isExpired) {
          if (existingKey.status === 'COMPLETED' && existingKey.response) {
            response.set('X-Idempotency-Key', idempotencyKey);
            response.set('X-Idempotency-Replayed', 'true');
            return of(existingKey.response);
          }

          if (existingKey.status === 'PENDING') {
            throw new HttpException(
              'Request is still being processed. Please wait and retry.',
              HttpStatus.CONFLICT,
            );
          }
        }

        await this.prisma.idempotencyKey.update({
          where: { key: idempotencyKey },
          data: {
            method,
            endpoint,
            requestBody: request.body || {},
            response: Prisma.DbNull,
            status: 'PENDING',
            expiresAt,
            deletedAt: null,
          },
        });
      } else {
        await this.prisma.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            method,
            endpoint,
            requestBody: request.body || {},
            status: 'PENDING',
            expiresAt,
          },
        });
      }

      return next.handle().pipe(
        tap(async result => {
          await this.prisma.idempotencyKey.update({
            where: { key: idempotencyKey },
            data: {
              status: 'COMPLETED',
              response: result,
            },
          });
          response.set('X-Idempotency-Key', idempotencyKey);
        }),
        finalize(() => {
          this.eventBus.setIdempotencyKey(null);
        }),
      );
    } catch (error) {
      this.eventBus.setIdempotencyKey(null);

      if (error instanceof HttpException) {
        throw error;
      }

      if (idempotencyKey) {
        try {
          await this.prisma.idempotencyKey.update({
            where: { key: idempotencyKey },
            data: {
              status: 'FAILED',
              response: { error: error.message || 'Internal server error' },
            },
          });
        } catch {}
      }
      throw error;
    }
  }
}
