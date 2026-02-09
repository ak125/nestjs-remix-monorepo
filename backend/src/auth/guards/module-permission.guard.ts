import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';

export const RequireModule = (module: string, action: string = 'read') =>
  Reflect.metadata('module_permission', { module, action });

@Injectable()
export class ModulePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<{ module: string; action: string }>(
      'module_permission',
      context.getHandler(),
    );

    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const session = await this.authService.getSessionFromRequest(request);

    if (!session?.user) {
      return false;
    }

    const accessCheck = await this.authService.checkModuleAccess(
      session.user.id,
      permission.module,
      permission.action,
    );

    if (!accessCheck.hasAccess) {
      this.authService.handleNoPrivilege(permission.module);
    }

    return accessCheck.hasAccess;
  }
}
