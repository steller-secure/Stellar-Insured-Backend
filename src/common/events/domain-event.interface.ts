export interface DomainEvent<
  TName extends string = string,
  TPayload = unknown,
> {
  readonly id: string;
  readonly name: TName;
  readonly timestamp: Date;
  readonly payload: TPayload;
  readonly idempotencyKey?: string;
  readonly metadata?: Record<string, unknown>;
}
