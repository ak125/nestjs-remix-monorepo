import { Injectable } from '@nestjs/common';
import {
  ADMIN_PERMISSIONS,
  BASE_USER_PERMISSIONS,
  COMMERCIAL_PERMISSIONS,
  MANAGER_PERMISSIONS,
  PermissionAction,
  SUPER_ADMIN_PERMISSIONS,
  UserPermissions,
} from './dto/user-permissions.dto';

/**
 * Canonical per-action permission resolver. Single source of truth for
 * "can role X perform action Y". Consumed by PermissionsGuard at runtime
 * and by GET /auth/user-permissions/:userId for the frontend.
 */
@Injectable()
export class PermissionsService {
  getPermissions(userLevel: number): UserPermissions {
    const lvl = Number.isFinite(userLevel) ? userLevel : 0;
    if (lvl >= 9) return SUPER_ADMIN_PERMISSIONS;
    if (lvl >= 7) return ADMIN_PERMISSIONS;
    if (lvl >= 5) return MANAGER_PERMISSIONS;
    if (lvl >= 3) return COMMERCIAL_PERMISSIONS;
    return BASE_USER_PERMISSIONS;
  }

  hasPermission(userLevel: number, action: PermissionAction): boolean {
    return this.getPermissions(userLevel)[action] === true;
  }
}
