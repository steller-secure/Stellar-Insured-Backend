import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { DomainEvent } from './domain-event.interface';
import { DomainEventName, DomainEventPayloadMap } from './event-types';

@Injectable()
export class DomainEventBus {
  private readonly logger = new Logger(DomainEventBus.name);
  private activeIdempotencyKey: string | null = null;

  constructor(private readonly emitter: EventEmitter2) {}

  setIdempotencyKey(key: string | null): void {
    this.activeIdempotencyKey = key;
  }

  getIdempotencyKey(): string | null {
    return this.activeIdempotencyKey;
  }

  async emit<K extends keyof DomainEventPayloadMap>(
    eventName: K,
    payload: DomainEventPayloadMap[K],
    metadata?: Record<string, unknown>,
  ): Promise<DomainEvent<K, DomainEventPayloadMap[K]>> {
    const event: DomainEvent<K, DomainEventPayloadMap[K]> = {
      id: randomUUID(),
      name: eventName,
      timestamp: new Date(),
      payload,
      idempotencyKey: this.activeIdempotencyKey || undefined,
      metadata,
    };

    try {
      await this.emitter.emitAsync(eventName, event);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error processing event ${eventName} [${event.id}]: ${message}`,
      );
      throw error;
    }

    return event;
  }

  on<K extends keyof DomainEventPayloadMap>(
    eventName: K,
    handler: (
      event: DomainEvent<K, DomainEventPayloadMap[K]>,
    ) => Promise<void> | void,
  ): void {
    this.emitter.on(eventName, handler);
  }
}
