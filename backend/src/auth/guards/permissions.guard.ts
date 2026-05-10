import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { PermissionAction } from '../dto/user-permissions.dto';
import { PermissionsService } from '../permissions.service';

/**
 * Guard reading @RequirePermission(action) metadata and consulting
 * PermissionsService against the current user's level. Pairs with
 * AuthenticatedGuard upstream for session validity.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.get<PermissionAction>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!action) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const level = parseInt(String(user?.level ?? 0), 10) || 0;
    const ok = this.permissionsService.hasPermission(level, action);

    if (!ok) {
      this.logger.warn(
        `Permission denied: ${user?.email ?? 'anonymous'} (level=${level}) lacks "${action}"`,
      );
    }
    return ok;
  }
}
