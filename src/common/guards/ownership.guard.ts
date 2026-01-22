import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export interface OwnershipGuardOptions {
  userIdParam?: string;
  resourceOwnerIdField?: string;
}

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Assuming user is attached to request by auth middleware

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get the user ID from the route parameters
    const userIdFromParams = request.params.userId;

    // Check if the authenticated user ID matches the requested user ID
    if (user.id !== userIdFromParams) {
      throw new ForbiddenException(
        'You can only access your own notifications',
      );
    }

    return true;
  }
}
