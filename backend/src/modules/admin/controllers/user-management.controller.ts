/**
 * 👥 USER MANAGEMENT CONTROLLER - Module Admin
 *
 * Contrôleur pour la gestion administrative des utilisateurs
 * Compatible avec l'architecture existante
 */

import {
  Controller,
  Get,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import {
  UserManagementService,
  UserFilters,
} from '../services/user-management.service';
import { User } from '../../../common/decorators/user.decorator';

@Controller('admin/users')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class UserManagementController {
  private readonly logger = new Logger(UserManagementController.name);

  constructor(private readonly userManagementService: UserManagementService) {}

  /**
   * 📊 Statistiques des utilisateurs pour le dashboard admin
   */
  @Get('/stats')
  async getUserStats() {
    try {
      this.logger.log('📊 Récupération stats utilisateurs...');

      const stats = await this.userManagementService.getUserStats();

      this.logger.log('✅ Stats utilisateurs récupérées');
      
      return {
        success: true,
        data: stats,
        message: 'Statistiques utilisateurs récupérées avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur stats utilisateurs:', error);
      
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des statistiques utilisateurs',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 👥 Liste des utilisateurs avec filtres et pagination
   */
  @Get('/')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('isPro') isPro?: string,
    @Query('level') level?: string,
  ) {
    try {
      this.logger.log('👥 Récupération liste utilisateurs...');

      const filters: UserFilters = {};
      
      if (page) filters.page = parseInt(page);
      if (limit) filters.limit = parseInt(limit);
      if (search) filters.search = search;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (isPro !== undefined) filters.isPro = isPro === 'true';
      if (level) filters.level = parseInt(level);

      const result = await this.userManagementService.getUsers(filters);

      this.logger.log(`✅ ${result.users.length} utilisateurs récupérés`);
      
      return {
        success: true,
        data: result,
        message: 'Liste des utilisateurs récupérée avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur liste utilisateurs:', error);
      
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération des utilisateurs',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 👤 Récupérer un utilisateur par ID
   */
  @Get('/:userId')
  async getUserById(@Param('userId') userId: string) {
    try {
      this.logger.log(`👤 Récupération utilisateur: ${userId}`);

      const user = await this.userManagementService.getUserById(userId);
      
      if (!user) {
        throw new HttpException(
          {
            success: false,
            message: 'Utilisateur non trouvé',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(`✅ Utilisateur ${userId} récupéré`);
      
      return {
        success: true,
        data: user,
        message: 'Utilisateur récupéré avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur utilisateur ${userId}:`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la récupération de l\'utilisateur',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ✏️ Mettre à jour un utilisateur
   */
  @Patch('/:userId')
  async updateUser(
    @Param('userId') userId: string,
    @Body()
    updates: {
      level?: number;
      isActive?: boolean;
      isPro?: boolean;
      emailVerified?: boolean;
    },
    @User() admin?: any,
  ) {
    try {
      this.logger.log(`✏️ Mise à jour utilisateur: ${userId}`);

      const success = await this.userManagementService.updateUser(
        userId,
        updates,
      );
      
      if (!success) {
        throw new HttpException(
          {
            success: false,
            message: 'Échec de la mise à jour de l\'utilisateur',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`✅ Utilisateur ${userId} mis à jour par admin ${admin?.cst_id}`);
      
      return {
        success: true,
        message: 'Utilisateur mis à jour avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur mise à jour utilisateur ${userId}:`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la mise à jour de l\'utilisateur',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🚫 Désactiver un utilisateur
   */
  @Delete('/:userId/deactivate')
  async deactivateUser(
    @Param('userId') userId: string,
    @Body('reason') reason?: string,
    @User() admin?: any,
  ) {
    try {
      this.logger.log(`🚫 Désactivation utilisateur: ${userId}`);

      const success = await this.userManagementService.deactivateUser(
        userId,
        reason,
      );
      
      if (!success) {
        throw new HttpException(
          {
            success: false,
            message: 'Échec de la désactivation de l\'utilisateur',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`✅ Utilisateur ${userId} désactivé par admin ${admin?.cst_id}`);
      
      return {
        success: true,
        message: 'Utilisateur désactivé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur désactivation utilisateur ${userId}:`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la désactivation de l\'utilisateur',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * ✅ Réactiver un utilisateur
   */
  @Patch('/:userId/reactivate')
  async reactivateUser(
    @Param('userId') userId: string,
    @User() admin?: any,
  ) {
    try {
      this.logger.log(`✅ Réactivation utilisateur: ${userId}`);

      const success = await this.userManagementService.reactivateUser(userId);
      
      if (!success) {
        throw new HttpException(
          {
            success: false,
            message: 'Échec de la réactivation de l\'utilisateur',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`✅ Utilisateur ${userId} réactivé par admin ${admin?.cst_id}`);
      
      return {
        success: true,
        message: 'Utilisateur réactivé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur réactivation utilisateur ${userId}:`, error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors de la réactivation de l\'utilisateur',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔍 Health check du service de gestion utilisateurs
   */
  @Get('/system/health')
  async healthCheck() {
    try {
      this.logger.log('🔍 Health check user management...');

      const health = await this.userManagementService.healthCheck();

      return {
        success: true,
        data: health,
        message: 'Health check user management terminé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('❌ Erreur health check user management:', error);
      
      throw new HttpException(
        {
          success: false,
          message: 'Erreur lors du health check user management',
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
