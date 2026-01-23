import { BadRequestException } from '@nestjs/common';
import { ProposalStatus } from '../enums/proposal-status.enum';

export class InvalidProposalStatusException extends BadRequestException {
  constructor(proposalId: string, currentStatus: ProposalStatus) {
    super(
      `Cannot vote on proposal ${proposalId}. Current status is ${currentStatus}, but must be ACTIVE`,
    );
  }
}
