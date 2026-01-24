import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClaimsService } from '../../modules/claims/claims.service';

@Injectable()
export class ClaimOwnerGuard implements CanActivate {
  constructor(private readonly claimService: ClaimsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Extract claimId from params
    const params = request.params;
    const rawClaimId = params.id || params.claimId;

    if (!rawClaimId) {
      throw new NotFoundException('Claim ID not provided');
    }

    // FIXED: Ensure claimId is a string, not a string[]
    const claimId = Array.isArray(rawClaimId) ? rawClaimId[0] : rawClaimId;

    const claim = await this.claimService.findOne(claimId);

    if (!claim) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    // Check if the authenticated user is the owner of the claim
    // or if the user has an admin role
    const isOwner = claim.userId === user.id;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('You do not have permission to access this claim');
    }

    return true;
  }
}