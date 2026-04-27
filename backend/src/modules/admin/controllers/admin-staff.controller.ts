/**
 * 👥 CONTRÔLEUR ADMIN STAFF - Module Admin
 *
 * API REST pour l'administration du personnel :
 * - CRUD staff complet avec pagination
 * - Statistiques et rapports
 * - Gestion des rôles et permissions
 * - Sécurisation admin avec guards
 * - Réutilisation du StaffService
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { OperationFailedException } from '@common/exceptions';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  StaffService,
  CreateStaffDto,
  UpdateStaffDto,
} from '../../staff/staff.service';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';

@ApiTags('Admin Staff')
@Controller('api/admin/staff')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminStaffController {
  private readonly logger = new Logger(AdminStaffController.name);

  constructor(private readonly staffService: StaffService) {}

  /**
   * GET /api/admin/staff
   * Récupérer tous les membres du staff avec filtres
   */
  @Get()
  @ApiOperation({ summary: 'Récupérer tous les membres du staff' })
  @ApiResponse({ status: 200, description: 'Liste du staff récupérée' })
  async getAllStaff(@Query() query: any) {
    try {
      this.logger.log('GET /api/admin/staff - Liste staff');

      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 10;
      const filters = {
        role: query.role,
        department: query.department,
        isActive:
          query.isActive !== undefined ? query.isActive === 'true' : undefined,
        search: query.search,
      };

      const result = await this.staffService.findAll(page, limit, filters);

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur récupération staff:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération du staff',
      });
    }
  }

  /**
   * GET /api/admin/staff/stats
   * Récupérer les statistiques du staff
   */
  @Get('stats')
  @ApiOperation({ summary: 'Statistiques du staff' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées' })
  async getStaffStats() {
    try {
      this.logger.log('GET /api/admin/staff/stats - Statistiques');

      const stats = await this.staffService.getStats();

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur statistiques staff:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des statistiques',
      });
    }
  }

  /**
   * GET /api/admin/staff/:id
   * Récupérer un membre du staff par ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un membre du staff' })
  @ApiResponse({ status: 200, description: 'Membre du staff trouvé' })
  @ApiResponse({ status: 404, description: 'Membre introuvable' })
  async getStaffById(@Param('id') id: string) {
    try {
      this.logger.log(`GET /api/admin/staff/${id}`);

      const staff = await this.staffService.findById(id);

      return {
        success: true,
        data: staff,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erreur récupération staff ${id}:`, error);

      if (error instanceof OperationFailedException) {
        throw error;
      }

      throw new OperationFailedException({
        message: 'Erreur lors de la récupération du membre',
      });
    }
  }

  /**
   * POST /api/admin/staff
   * Créer un nouveau membre du staff
   */
  @Post()
  @ApiOperation({ summary: 'Créer un membre du staff' })
  @ApiResponse({ status: 201, description: 'Membre créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async createStaff(@Body() createStaffDto: CreateStaffDto) {
    try {
      this.logger.log(`POST /api/admin/staff - ${createStaffDto.email}`);

      const staff = await this.staffService.create(createStaffDto);

      return {
        success: true,
        data: staff,
        message: 'Membre du staff créé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur création staff:', error);

      if (error instanceof OperationFailedException) {
        throw error;
      }

      throw new OperationFailedException({
        message: 'Erreur lors de la création',
      });
    }
  }

  /**
   * PATCH /api/admin/staff/:id
   * Mettre à jour un membre du staff
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un membre du staff' })
  @ApiResponse({ status: 200, description: 'Membre mis à jour' })
  @ApiResponse({ status: 404, description: 'Membre introuvable' })
  async updateStaff(
    @Param('id') id: string,
    @Body() updateStaffDto: UpdateStaffDto,
  ) {
    try {
      this.logger.log(`PATCH /api/admin/staff/${id}`);

      const staff = await this.staffService.update(id, updateStaffDto);

      return {
        success: true,
        data: staff,
        message: 'Membre du staff mis à jour',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erreur mise à jour staff ${id}:`, error);

      if (error instanceof OperationFailedException) {
        throw error;
      }

      throw new OperationFailedException({
        message: 'Erreur lors de la mise à jour',
      });
    }
  }

  /**
   * DELETE /api/admin/staff/:id
   * Désactiver un membre du staff
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Désactiver un membre du staff' })
  @ApiResponse({ status: 200, description: 'Membre désactivé' })
  @ApiResponse({ status: 404, description: 'Membre introuvable' })
  async deleteStaff(@Param('id') id: string) {
    try {
      this.logger.log(`DELETE /api/admin/staff/${id}`);

      const result = await this.staffService.delete(id);

      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erreur suppression staff ${id}:`, error);

      if (error instanceof OperationFailedException) {
        throw error;
      }

      throw new OperationFailedException({
        message: 'Erreur lors de la suppression',
      });
    }
  }
}
