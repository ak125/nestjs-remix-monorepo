import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth.service';
import { ModuleAccessDto, BulkModuleAccessDto } from '../dto/module-access.dto';

@ApiTags('auth')
@Controller()
export class AuthPermissionsController {
  private readonly logger = new Logger(AuthPermissionsController.name);

  constructor(private readonly authService: AuthService) {}

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
    } catch (error: any) {
      return {
        hasAccess: false,
        reason: 'Access check failed',
        error: error.message,
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
   * Obtenir toutes les permissions d'un utilisateur (optimisé pour cache frontend)
   */
  @Get('auth/user-permissions/:userId')
  async getUserPermissions(@Param('userId') userId: string) {
    try {
      const modules = [
        'commercial',
        'admin',
        'seo',
        'expedition',
        'inventory',
        'finance',
        'reports',
      ];
      const permissions: Record<string, { read: boolean; write: boolean }> = {};

      await Promise.all(
        modules.map(async (module) => {
          const [readAccess, writeAccess] = await Promise.all([
            this.authService.checkModuleAccess(userId, module, 'read'),
            this.authService.checkModuleAccess(userId, module, 'write'),
          ]);

          permissions[module] = {
            read: readAccess.hasAccess,
            write: writeAccess.hasAccess,
          };
        }),
      );

      return permissions;
    } catch (error: any) {
      console.error('Error fetching user permissions:', error);
      return {};
    }
  }
}
