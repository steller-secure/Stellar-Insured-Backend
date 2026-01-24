import { Role } from './role.enum';
import { Permission } from '../permissions/permission.enum';

export const RolePermissions: Record<Role, Permission[]> = {
  [Role.USER]: [
    Permission.DAO_PROPOSAL_CREATE,
  ],

  [Role.MODERATOR]: [
    Permission.CLAIM_APPROVE,
    Permission.CLAIM_REJECT,
  ],

  [Role.GOVERNANCE]: [
    Permission.DAO_PROPOSAL_FINALIZE,
  ],

  [Role.ADMIN]: [
    Permission.USER_MANAGE,
    Permission.RISK_POOL_MANAGE,
  ],

  [Role.SUPER_ADMIN]: Object.values(Permission),
};
