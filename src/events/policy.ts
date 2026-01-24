export class PolicyIssuedEvent {
  constructor(
    public readonly policyId: string, 
    public readonly userId: string
  ) {}
}

export class PolicyRenewedEvent {
  constructor(
    public readonly policyId: string, 
    public readonly userId: string
  ) {}
}

export class PolicyExpiredEvent {
  constructor(
    public readonly policyId: string, 
    public readonly userId: string
  ) {}
}

export class PolicyCancelledEvent {
  constructor(
    public readonly policyId: string, 
    public readonly userId: string, 
    public readonly reason: string
  ) {}
}