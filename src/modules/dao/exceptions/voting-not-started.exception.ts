import { BadRequestException } from '@nestjs/common';

export class VotingNotStartedException extends BadRequestException {
  constructor(proposalId: string) {
    super(`Voting has not started yet for proposal ${proposalId}`);
  }
}
