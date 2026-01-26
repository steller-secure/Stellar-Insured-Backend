/**
 * Event emitted when a new claim is submitted.
 */
export class ClaimSubmittedEvent {
  constructor(
    public readonly claimId: string,
    public readonly userId: string,
    public readonly policyId: string,
    public readonly claimAmount?: number,
  ) {}
}
