import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Logger,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth.service';
import { AuthenticatedGuard } from '../authenticated.guard';
import { IsAdminGuard } from '../is-admin.guard';
import { ModuleAccessDto, BulkModuleAccessDto } from '../dto/module-access.dto';
import { PermissionsService } from '../permissions.service';
import {
  BASE_USER_PERMISSIONS,
  UserPermissions,
} from '../dto/user-permissions.dto';
import { STAFF_LEVEL } from '../session-privilege';

/** Champs de la session lus ici (posés par `CookieSerializer`). */
interface SessionUser {
  id?: string | number;
  level?: string | number;
  isAdmin?: boolean;
}

/**
 * Droits d'un compte.
 *
 * - `auth/module-access` et `auth/bulk-module-access` répondent pour un compte
 *   désigné dans le corps de la requête : réservés aux administrateurs.
 * - `auth/user-permissions/:userId` exige une session. Chacun lit ses propres
 *   permissions ; seul un administrateur lit celles d'un autre compte.
 */
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
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
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
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
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
   *
   * Ses propres permissions se lisent sur la session, déjà rattachée à sa
   * table d'origine : un identifiant client égal à un identifiant du personnel
   * ne donne pas les permissions de ce dernier.
   */
  @Get('auth/user-permissions/:userId')
  @UseGuards(AuthenticatedGuard)
  async getUserPermissions(
    @Param('userId') userId: string,
    @Req() request: Express.Request,
  ): Promise<UserPermissions> {
    const session = (request.user ?? {}) as SessionUser;
    const sessionLevel = parseInt(String(session.level ?? 0), 10) || 0;

    if (session.id !== undefined && String(session.id) === userId) {
      return this.permissionsService.getPermissions(sessionLevel);
    }

    // Hors du `try` : le refus ne doit pas devenir une réponse 200.
    // Même règle qu'`IsAdminGuard`.
    if (session.isAdmin !== true && sessionLevel < STAFF_LEVEL.ADMIN) {
      this.logger.warn(
        `Access denied: user ${String(session.id)} requested permissions of user ${userId}`,
      );
      throw new ForbiddenException('Access denied');
    }

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
