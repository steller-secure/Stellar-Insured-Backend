import { SetMetadata } from '@nestjs/common';

export const CHECK_OWNERSHIP_KEY = 'checkOwnership';
export const CheckOwnership = () => SetMetadata(CHECK_OWNERSHIP_KEY, true);
