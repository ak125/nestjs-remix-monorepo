/**
 * 👥 STAFF CONTROLLER - Contrôleur API REST pour la gestion du personnel
 *
 * ✅ ARCHITECTURE RECOMMANDÉE : Utilise StaffService (service métier)
 * ✅ API REST sécurisée pour la gestion du staff administratif
 * ✅ Validation avec DTOs et documentation Swagger
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
import {
  OperationFailedException,
  DomainValidationException,
} from '@common/exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { StaffService, CreateStaffDto, UpdateStaffDto } from './staff.service';

@ApiTags('Staff Management')
@Controller('api/admin/staff')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class StaffController {
  private readonly logger = new Logger(StaffController.name);

  constructor(private readonly staffService: StaffService) {}

  /**
   * GET /api/admin/staff
   * Récupérer la liste du staff avec pagination et filtres
   */
  @Get()
  @ApiOperation({ summary: 'Récupérer la liste du staff' })
  @ApiResponse({
    status: 200,
    description: 'Liste du staff récupérée avec succès',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'department', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getAllStaff(
    @Query()
    query: {
      page?: string;
      limit?: string;
      department?: string;
      isActive?: string;
      search?: string;
    },
  ) {
    try {
      this.logger.log('GET /api/admin/staff - Récupération liste staff');

      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 10;
      const filters = {
        department: query.department,
        isActive:
          query.isActive !== undefined ? query.isActive === 'true' : undefined,
        search: query.search,
      };

      const result = await this.staffService.findAll(page, limit, filters);

      this.logger.log(
        `✅ ${result.data.staff.length}/${result.data.total} membres du staff récupérés`,
      );

      return result;
    } catch (error) {
      this.logger.error('Erreur récupération staff:', error);

      if (error instanceof OperationFailedException) {
        throw error;
      }

      throw new OperationFailedException({
        message: 'Erreur lors de la récupération du staff',
      });
    }
  }

  /**
   * GET /api/admin/staff/:id
   * Récupérer un membre du staff par ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un membre du staff par ID' })
  @ApiResponse({ status: 200, description: 'Membre du staff trouvé' })
  @ApiResponse({ status: 404, description: 'Membre du staff introuvable' })
  async getStaffById(@Param('id') id: string) {
    try {
      this.logger.log(`GET /api/admin/staff/${id} - Récupération staff`);

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
        message: 'Erreur lors de la récupération du membre du staff',
      });
    }
  }

  /**
   * POST /api/admin/staff
   * Créer un nouveau membre du staff
   */
  @Post()
  @ApiOperation({ summary: 'Créer un nouveau membre du staff' })
  @ApiResponse({
    status: 201,
    description: 'Membre du staff créé avec succès',
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async createStaff(@Body() createStaffDto: CreateStaffDto) {
    try {
      this.logger.log(
        `POST /api/admin/staff - Création staff: ${createStaffDto.email}`,
      );

      // Validation basique côté contrôleur
      if (
        !createStaffDto.email ||
        !createStaffDto.firstName ||
        !createStaffDto.lastName
      ) {
        throw new DomainValidationException({
          message: 'Email, prénom et nom sont requis',
        });
      }

      if (!createStaffDto.role) {
        throw new DomainValidationException({
          message: 'Le rôle est requis',
        });
      }

      const staff = await this.staffService.create(createStaffDto);

      this.logger.log(`✅ Staff créé: ${staff.id}`);

      return {
        success: true,
        data: staff,
        message: 'Membre du staff créé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur création staff:', error);

      if (error instanceof DomainValidationException) {
        throw error;
      }

      throw new OperationFailedException({
        message: 'Erreur lors de la création du membre du staff',
      });
    }
  }

  /**
   * PATCH /api/admin/staff/:id
   * Mettre à jour un membre du staff
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un membre du staff' })
  @ApiResponse({ status: 200, description: 'Membre du staff mis à jour' })
  @ApiResponse({ status: 404, description: 'Membre du staff introuvable' })
  async updateStaff(
    @Param('id') id: string,
    @Body() updateStaffDto: UpdateStaffDto,
  ) {
    try {
      this.logger.log(`PATCH /api/admin/staff/${id} - Mise à jour staff`);

      const staff = await this.staffService.update(id, updateStaffDto);

      this.logger.log(`Staff mis à jour avec succès: ${id}`);

      return {
        success: true,
        data: staff,
        message: 'Membre du staff mis à jour avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erreur mise à jour staff ${id}:`, error);

      if (error instanceof OperationFailedException) {
        throw error;
      }

      throw new OperationFailedException({
        message: 'Erreur lors de la mise à jour du membre du staff',
      });
    }
  }

  /**
   * DELETE /api/admin/staff/:id
   * Supprimer (désactiver) un membre du staff
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un membre du staff' })
  @ApiResponse({ status: 200, description: 'Membre du staff supprimé' })
  @ApiResponse({ status: 404, description: 'Membre du staff introuvable' })
  async deleteStaff(@Param('id') id: string) {
    try {
      this.logger.log(`DELETE /api/admin/staff/${id} - Suppression staff`);

      await this.staffService.delete(id);

      this.logger.log(`Staff supprimé avec succès: ${id}`);

      return {
        success: true,
        message: 'Membre du staff supprimé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erreur suppression staff ${id}:`, error);

      if (error instanceof OperationFailedException) {
        throw error;
      }

      throw new OperationFailedException({
        message: 'Erreur lors de la suppression du membre du staff',
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
      this.logger.log('GET /api/admin/staff/stats - Récupération stats');

      const stats = await this.staffService.getStats();

      return {
        success: true,
        data: stats.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur stats staff:', error);

      if (error instanceof OperationFailedException) {
        throw error;
      }

      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des statistiques',
      });
    }
  }

  /**
   * GET /api/admin/staff/health
   * Endpoint de santé pour vérifier le fonctionnement du module
   */
  @Get('health')
  @ApiOperation({ summary: 'Vérification de santé du module staff' })
  @ApiResponse({ status: 200, description: 'Module en bonne santé' })
  async healthCheck() {
    return {
      success: true,
      message: 'StaffController opérationnel',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
