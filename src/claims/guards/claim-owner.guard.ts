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
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // FIX: Handle potential array param
    const rawId = request.params.id;
    const claimId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!claimId || !user) {
      return false;
    }

    // Now 'claimId' is guaranteed to be a string
    const claim = await this.claimService.getClaimById(claimId);

    if (!claim) {
      return false; // Or throw NotFoundException
    }

    // Allow if user is admin or the owner
    // Note: Adjust 'user.role' access based on your User entity structure
    if (user.role === 'admin') { 
        return true; 
    }

    return claim.userId === user.id;
  }
}
