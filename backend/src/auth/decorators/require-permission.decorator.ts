import { SetMetadata } from '@nestjs/common';
import type { PermissionAction } from '../dto/user-permissions.dto';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Marks a controller method as requiring a specific per-action permission.
 * Read by PermissionsGuard via Reflector.
 *
 * @example
 *   @Post(':orderId/cancel')
 *   @RequirePermission('canCancel')
 *   async cancelOrder(...) { ... }
 */
export const RequirePermission = (action: PermissionAction) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, action);
