import { ConflictException } from '@nestjs/common';

export class DuplicateVoteException extends ConflictException {
  constructor(walletAddress: string, proposalId: string) {
    super(
      `Wallet ${walletAddress} has already voted on proposal ${proposalId}`,
    );
  }
}
