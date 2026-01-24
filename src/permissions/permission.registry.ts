import { Permission } from './permission.enum';

export const PermissionRegistry = new Set<Permission>(
  Object.values(Permission),
);
