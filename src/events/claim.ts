export class ClaimSubmittedEvent {
  constructor(
    public readonly claimId: string,
    public readonly userId: string,
    public readonly policyId: string,
    public readonly claimAmount: number, 
  ) {}
}

export class ClaimApprovedEvent {
  constructor(
    public readonly claimId: string,
    public readonly userId: string,
    public readonly approvedBy: string,
    public readonly approvalAmount: number,
  ) {}
}

export class ClaimRejectedEvent {
  constructor(
    public readonly claimId: string,
    public readonly userId: string,
    public readonly rejectedBy: string,
    public readonly rejectionReason: string,
  ) {}
}

export class ClaimSettledEvent {
  constructor(
    public readonly claimId: string,
    public readonly userId: string,
    public readonly settlementAmount: number,
    public readonly settledBy: string,
  ) {}
}