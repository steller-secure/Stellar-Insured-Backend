import { BadRequestException } from '@nestjs/common';

export class ProposalExpiredException extends BadRequestException {
  constructor(proposalId: string) {
    super(`Voting period has ended for proposal ${proposalId}`);
  }
}
