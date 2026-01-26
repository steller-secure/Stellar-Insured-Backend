/**
 * Event emitted when a claim is settled (payment processed).
 */
export class ClaimSettledEvent {
  constructor(
    public readonly claimId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly settledBy?: string,
    public readonly settlementAmount?: number,
  ) {}
}
