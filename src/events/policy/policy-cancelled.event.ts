/**
 * Event emitted when a policy is cancelled.
 */
export class PolicyCancelledEvent {
  constructor(
    public readonly policyId: string,
    public readonly userId: string,
    public readonly reason?: string,
  ) {}
}
