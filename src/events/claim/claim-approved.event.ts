/**
 * Event emitted when a claim is approved.
 */
export class ClaimApprovedEvent {
  constructor(
    public readonly claimId: string,
    public readonly userId: string,
    public readonly approvalAmount?: number,
    public readonly approvedBy?: string,
  ) {}
}
