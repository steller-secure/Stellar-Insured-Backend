import { Injectable } from '@nestjs/common';
import { Role } from '../roles/role.enum';
import { Permission } from './permission.enum';
import { RolePermissions } from '../roles/role-permission.map';

@Injectable()
export class PermissionService {
  getPermissionsForRoles(roles: Role[]): Set<Permission> {
    const permissions = new Set<Permission>();

    roles.forEach(role => {
      RolePermissions[role]?.forEach(p => permissions.add(p));
    });

    return permissions;
  }
}
