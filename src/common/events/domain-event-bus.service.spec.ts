import { DomainEventBus } from './domain-event-bus.service';
import { DomainEventName } from './event-types';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('DomainEventBus', () => {
  let eventBus: DomainEventBus;
  let emitter: EventEmitter2;

  beforeEach(() => {
    emitter = new EventEmitter2();
    eventBus = new DomainEventBus(emitter);
  });

  it('should emit typed domain events with id and timestamp', async () => {
    const handler = jest.fn();
    eventBus.on(DomainEventName.POLICY_PURCHASED, handler);

    const event = await eventBus.emit(DomainEventName.POLICY_PURCHASED, {
      entityId: 'policy-100',
      entity: { id: 'policy-100' },
      reason: 'Policy purchased',
    });

    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.name).toBe(DomainEventName.POLICY_PURCHASED);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should attach active idempotency key if present', async () => {
    eventBus.setIdempotencyKey('key-12345');

    const event = await eventBus.emit(DomainEventName.CLAIM_CREATED, {
      entityId: 'claim-1',
      entity: { id: 'claim-1' },
    });

    expect(event.idempotencyKey).toBe('key-12345');
  });

  it('should clear idempotency key when set to null', async () => {
    eventBus.setIdempotencyKey('key-12345');
    eventBus.setIdempotencyKey(null);

    const event = await eventBus.emit(DomainEventName.CLAIM_CREATED, {
      entityId: 'claim-1',
      entity: { id: 'claim-1' },
    });

    expect(event.idempotencyKey).toBeUndefined();
  });
});
