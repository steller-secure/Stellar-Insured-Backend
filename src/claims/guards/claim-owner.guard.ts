import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ClaimService } from '../services/claim.service';

@Injectable()
export class ClaimOwnerGuard implements CanActivate {
  constructor(private claimService: ClaimService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const userId = (request.user as any)?.id;
    const claimId = request.params.claimId;

    if (!userId || !claimId) {
      throw new ForbiddenException('Invalid request context');
    }

    const claim = await this.claimService.getClaimById(claimId);

    if (!claim || claim.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this claim',
      );
    }

    return true;
  }
}
