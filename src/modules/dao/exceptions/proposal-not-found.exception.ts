import { NotFoundException } from '@nestjs/common';

export class ProposalNotFoundException extends NotFoundException {
  constructor(proposalId: string) {
    super(`Proposal with ID ${proposalId} not found`);
  }
}
