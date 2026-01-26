/**
 * Event emitted when a claim is rejected.
 */
export class ClaimRejectedEvent {
  constructor(
    public readonly claimId: string,
    public readonly userId: string,
    public readonly reason: string,
    public readonly rejectedBy?: string,
    public readonly rejectionReason?: string,
  ) {}
}
