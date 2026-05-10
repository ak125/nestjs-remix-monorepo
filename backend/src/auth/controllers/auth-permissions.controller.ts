import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth.service';
import { ModuleAccessDto, BulkModuleAccessDto } from '../dto/module-access.dto';
import { PermissionsService } from '../permissions.service';
import {
  BASE_USER_PERMISSIONS,
  UserPermissions,
} from '../dto/user-permissions.dto';

@ApiTags('auth')
@Controller()
export class AuthPermissionsController {
  private readonly logger = new Logger(AuthPermissionsController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
  ) {}

  /**
   * POST /auth/module-access
   * Vérifier l'accès à un module spécifique
   */
  @Post('auth/module-access')
  async checkModuleAccess(@Body() dto: ModuleAccessDto) {
    try {
      const result = await this.authService.checkModuleAccess(
        dto.userId,
        dto.module,
        dto.action || 'read',
      );

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        hasAccess: false,
        reason: 'Access check failed',
        error: message,
      };
    }
  }

  /**
   * POST /auth/bulk-module-access
   * Vérifier l'accès à plusieurs modules à la fois (optimisé)
   */
  @Post('auth/bulk-module-access')
  async checkBulkModuleAccess(@Body() dto: BulkModuleAccessDto) {
    try {
      const results: Record<string, boolean> = {};

      await Promise.all(
        dto.modules.map(async (moduleItem) => {
          const key = `${moduleItem.module}:${moduleItem.action || 'read'}`;
          const result = await this.authService.checkModuleAccess(
            dto.userId,
            moduleItem.module,
            moduleItem.action || 'read',
          );
          results[key] = result.hasAccess;
        }),
      );

      return results;
    } catch {
      return {};
    }
  }

  /**
   * GET /auth/user-permissions/:userId
   * Returns the canonical UserPermissions shape (15 booleans) consumed by
   * the frontend. Single source of truth for per-action permissions.
   */
  @Get('auth/user-permissions/:userId')
  async getUserPermissions(
    @Param('userId') userId: string,
  ): Promise<UserPermissions> {
    try {
      const user = await this.authService.getUserById(userId);
      if (!user || user.isActive === false) {
        return BASE_USER_PERMISSIONS;
      }
      const level = parseInt(String(user.level ?? 0), 10) || 0;
      return this.permissionsService.getPermissions(level);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error fetching user permissions: ${message}`);
      return BASE_USER_PERMISSIONS;
    }
  }
}
