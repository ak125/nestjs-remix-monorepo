/**
 * 📋 CONTRÔLEUR STAFF ADMIN - Module Admin
 *
 * API REST pour la gestion du staff administratif
 * Migration et intégration avec la table ___config_admin
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AdminStaffService } from '../services/admin-staff.service';
import { LocalAuthGuard } from '../../../auth/local-auth.guard';
import {
  CreateLegacyStaff,
  UpdateLegacyStaff,
  LegacyStaffQuery,
  SuperAdminCreation,
  CreateLegacyStaffSchema,
  UpdateLegacyStaffSchema,
  LegacyStaffQuerySchema,
  SuperAdminCreationSchema,
} from '../schemas/legacy-staff.schemas';

@Controller('admin/staff')
@UseGuards(LocalAuthGuard)
export class AdminStaffController {
  private readonly logger = new Logger(AdminStaffController.name);

  constructor(private readonly staffService: AdminStaffService) {}

  /**
   * GET /admin/staff
   * Récupérer tous les staff avec pagination et filtres
   */
  @Get()
  async getAllStaff(@Query() query: any, @Request() _req: any) {
    try {
      this.logger.log('Requête liste staff');

      // Parser et valider la query
      const parsedQuery: LegacyStaffQuery = {
        page: parseInt(query.page) || 1,
        limit: parseInt(query.limit) || 20,
        search: query.search,
        level: query.level ? parseInt(query.level) : undefined,
        isActive:
          query.isActive !== undefined ? query.isActive === 'true' : undefined,
        department: query.department,
      };

      const validatedQuery = LegacyStaffQuerySchema.parse(parsedQuery);
      const currentUserId = _req.user?.id || 'system';

      const result = await this.staffService.getAllStaff(
        validatedQuery,
        currentUserId,
      );

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération du staff:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération du staff',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /admin/staff/stats
   * Récupérer les statistiques du staff
   */
  @Get('stats')
  async getStaffStats() {
    try {
      this.logger.log('Requête statistiques staff');
      const stats = await this.staffService.getStaffStats();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des stats staff:',
        error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération des statistiques',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /admin/staff/permissions/:level
   * Récupérer les permissions pour un niveau donné
   */
  @Get('permissions/:level')
  async getPermissions(@Param('level') level: string) {
    try {
      this.logger.log(`Requête permissions niveau: ${level}`);
      const levelNum = parseInt(level);

      if (isNaN(levelNum) || levelNum < 1 || levelNum > 9) {
        throw new BadRequestException('Niveau invalide (1-9)');
      }

      const permissions = this.staffService.getPermissions(levelNum);
      const description = this.staffService.getLevelDescription(levelNum);

      return {
        success: true,
        data: {
          level: levelNum,
          description,
          permissions,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des permissions ${level}:`,
        error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération des permissions',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /admin/staff/:id
   * Récupérer un staff par ID
   */
  @Get(':id')
  async getStaffById(@Param('id') id: string) {
    try {
      this.logger.log(`Requête staff ID: ${id}`);
      const staff = await this.staffService.getStaffById(id);

      if (!staff) {
        throw new NotFoundException('Staff non trouvé');
      }

      return {
        success: true,
        data: staff,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération du staff ${id}:`,
        error,
      );
      return {
        success: false,
        error:
          error instanceof NotFoundException
            ? 'Staff non trouvé'
            : 'Erreur lors de la récupération du staff',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /admin/staff
   * Créer un nouveau staff
   */
  @Post()
  async createStaff(@Body() data: CreateLegacyStaff, @Request() _req: any) {
    try {
      this.logger.log(`Création staff: ${data.login}`);

      // Validation des données
      const validatedData = CreateLegacyStaffSchema.parse(data);
      const currentUserId = _req.user?.id || 'system';

      const staff = await this.staffService.createStaff(
        validatedData,
        currentUserId,
      );

      return {
        success: true,
        data: staff,
        message: 'Staff créé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur lors de la création du staff:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la création du staff',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /admin/staff/super-admin
   * Créer un super-administrateur niveau 9
   */
  @Post('super-admin')
  async createSuperAdmin(
    @Body() data: SuperAdminCreation,
    @Request() _req: any,
  ) {
    try {
      this.logger.log(`Création super-admin: ${data.login}`);

      // Validation des données
      const validatedData = SuperAdminCreationSchema.parse(data);

      const superAdmin =
        await this.staffService.createSuperAdmin(validatedData);

      return {
        success: true,
        data: superAdmin,
        message: 'Super-administrateur créé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur lors de la création du super-admin:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la création du super-admin',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * PATCH /admin/staff/:id
   * Mettre à jour un staff
   */
  @Patch(':id')
  async updateStaff(
    @Param('id') id: string,
    @Body() data: Partial<UpdateLegacyStaff>,
    @Request() _req: any,
  ) {
    try {
      this.logger.log(`Mise à jour staff: ${id}`);

      const updateData: UpdateLegacyStaff = { ...data, id: parseInt(id) };
      const validatedData = UpdateLegacyStaffSchema.parse(updateData);
      const currentUserId = _req.user?.id || 'system';

      const staff = await this.staffService.updateStaff(
        validatedData,
        currentUserId,
      );

      return {
        success: true,
        data: staff,
        message: 'Staff mis à jour avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la mise à jour du staff ${id}:`, error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la mise à jour du staff',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * PATCH /admin/staff/:id/toggle-status
   * Activer/Désactiver un staff
   */
  @Patch(':id/toggle-status')
  async toggleStaffStatus(
    @Param('id') id: string,
    @Body() { isActive }: { isActive: boolean },
    @Request() _req: any,
  ) {
    try {
      this.logger.log(`Changement statut staff ${id}: ${isActive}`);
      const currentUserId = _req.user?.id || 'system';

      const staff = await this.staffService.toggleStaffStatus(
        id,
        isActive,
        currentUserId,
      );

      return {
        success: true,
        data: staff,
        message: `Staff ${isActive ? 'activé' : 'désactivé'} avec succès`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du changement de statut du staff ${id}:`,
        error,
      );
      return {
        success: false,
        error: 'Erreur lors du changement de statut',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * PATCH /admin/staff/:id/change-password
   * Changer le mot de passe d'un staff
   */
  @Patch(':id/change-password')
  async changePassword(
    @Param('id') id: string,
    @Body() { newPassword }: { newPassword: string },
    @Request() _req: any,
  ) {
    try {
      this.logger.log(`Changement mot de passe staff: ${id}`);

      if (!newPassword || newPassword.length < 6) {
        throw new BadRequestException(
          'Le mot de passe doit contenir au moins 6 caractères',
        );
      }

      const currentUserId = _req.user?.id || 'system';
      const success = await this.staffService.changePassword(
        id,
        newPassword,
        currentUserId,
      );

      if (!success) {
        throw new Error('Échec du changement de mot de passe');
      }

      return {
        success: true,
        message: 'Mot de passe changé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du changement de mot de passe ${id}:`,
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erreur lors du changement de mot de passe',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * POST /admin/staff/:id/validate-password
   * Valider le mot de passe d'un staff
   */
  @Post(':id/validate-password')
  async validatePassword(
    @Param('id') id: string,
    @Body() { password }: { password: string },
  ) {
    try {
      this.logger.log(`Validation mot de passe staff: ${id}`);

      const isValid = await this.staffService.validatePassword(id, password);

      return {
        success: true,
        data: { isValid },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de la validation du mot de passe ${id}:`,
        error,
      );
      return {
        success: false,
        error: 'Erreur lors de la validation du mot de passe',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
