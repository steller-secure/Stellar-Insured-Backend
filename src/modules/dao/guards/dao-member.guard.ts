import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../../users/entities/user.entity';

interface RequestWithUser extends Request {
  user?: User;
}

@Injectable()
export class DaoMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.walletAddress) {
      throw new ForbiddenException(
        'A linked wallet address is required to participate in DAO voting',
      );
    }

    // Future extension: Verify on-chain DAO membership
    // This could check if the wallet holds specific tokens or NFTs
    // that grant DAO membership status

    return true;
  }
}
