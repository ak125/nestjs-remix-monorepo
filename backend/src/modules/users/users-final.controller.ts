/**
 * 🎯 CONTRÔLEUR USERS FINAL - Version Consolidée et Robuste
 * Regroupe toutes les fonctionnalités en une seule API cohérente
 * Route unique: /api/users
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersFinalService } from './users-final.service';
import { AuthenticatedGuard } from '../../auth/authenticated.guard';
import { IsAdminGuard } from '../../auth/is-admin.guard';
import {
  User,
  CreateUserDto,
  UpdateUserDto,
  UserFilters,
  PaginatedUsers,
  CreateUserSchema,
  UpdateUserSchema,
  UserFiltersSchema,
} from './dto/user.dto';

interface RequestWithUser extends Request {
  user?: any;
}

@Controller('api/users')
export class UsersFinalController {
  private readonly logger = new Logger(UsersFinalController.name);

  constructor(private readonly usersService: UsersFinalService) {}

  // ============================================================================
  // ENDPOINTS PUBLICS (pas d'authentification)
  // ============================================================================

  /**
   * GET /api/users/test - Endpoint de test
   */
  @Get('test')
  async test() {
    this.logger.log('GET /api/users/test');
    return {
      success: true,
      message: 'API Users opérationnelle',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // ENDPOINTS UTILISATEUR (authentification requise)
  // ============================================================================

  /**
   * GET /api/users/profile - Profil de l'utilisateur connecté
   */
  @Get('profile')
  @UseGuards(AuthenticatedGuard)
  async getProfile(@Req() req: RequestWithUser) {
    const user = req.user;
    this.logger.log(`GET /api/users/profile - User: ${user?.email}`);

    if (!user?.id) {
      throw new HttpException('Non authentifié', HttpStatus.UNAUTHORIZED);
    }

    try {
      const profile = await this.usersService.getUserById(user.id);
      return {
        success: true,
        data: profile,
      };
    } catch (error: any) {
      this.logger.error('Erreur getProfile:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération du profil',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/users/profile - Mettre à jour son propre profil
   */
  @Put('profile')
  @UseGuards(AuthenticatedGuard)
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() updates: UpdateUserDto,
  ) {
    const user = req.user;
    this.logger.log(`PUT /api/users/profile - User: ${user?.email}`);

    if (!user?.id) {
      throw new HttpException('Non authentifié', HttpStatus.UNAUTHORIZED);
    }

    try {
      // Validation Zod
      const validatedData = UpdateUserSchema.parse(updates);

      const updatedUser = await this.usersService.updateUser(
        user.id,
        validatedData,
      );

      return {
        success: true,
        message: 'Profil mis à jour avec succès',
        data: updatedUser,
      };
    } catch (error: any) {
      this.logger.error('Erreur updateProfile:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la mise à jour du profil',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /api/users/dashboard - Données du dashboard utilisateur
   */
  @Get('dashboard')
  @UseGuards(AuthenticatedGuard)
  async getDashboard(@Req() req: RequestWithUser) {
    const user = req.user;
    this.logger.log(`GET /api/users/dashboard - User: ${user?.email}`);

    if (!user?.id) {
      throw new HttpException('Non authentifié', HttpStatus.UNAUTHORIZED);
    }

    try {
      const dashboard = await this.usersService.getDashboardData(user.id);
      return {
        success: true,
        data: dashboard,
      };
    } catch (error: any) {
      this.logger.error('Erreur getDashboard:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération du dashboard',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================================================
  // ENDPOINTS ADMIN (authentification + admin requis)
  // ============================================================================

  /**
   * GET /api/users - Liste des utilisateurs (admin)
   */
  @Get()
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getUsers(@Query() query: any) {
    this.logger.log(`GET /api/users - Filters: ${JSON.stringify(query)}`);

    try {
      // Validation des filtres avec Zod
      const filters = UserFiltersSchema.parse({
        search: query.search,
        status: query.status,
        userType: query.userType,
        level: query.level ? parseInt(query.level) : undefined,
        city: query.city,
        country: query.country,
        sortBy: query.sortBy || 'email',
        sortOrder: query.sortOrder || 'asc',
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      });

      const result = await this.usersService.getAllUsers(filters);

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('Erreur getUsers:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des utilisateurs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/users/stats - Statistiques utilisateurs (admin)
   */
  @Get('stats')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getStats() {
    this.logger.log('GET /api/users/stats');

    try {
      const stats = await this.usersService.getGlobalStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      this.logger.error('Erreur getStats:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/users/search - Recherche d'utilisateurs (admin)
   */
  @Get('search')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async searchUsers(
    @Query('q') searchTerm: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`GET /api/users/search?q=${searchTerm}`);

    if (!searchTerm || searchTerm.length < 3) {
      throw new HttpException(
        'Le terme de recherche doit contenir au moins 3 caractères',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const users = await this.usersService.searchUsers(
        searchTerm,
        limit ? parseInt(limit) : 20,
      );

      return {
        success: true,
        data: users,
        total: users.length,
        searchTerm,
      };
    } catch (error: any) {
      this.logger.error('Erreur searchUsers:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la recherche',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/users/:id - Détails d'un utilisateur (admin)
   */
  @Get(':id')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getUser(@Param('id') id: string) {
    this.logger.log(`GET /api/users/${id}`);

    try {
      const user = await this.usersService.getUserById(id);
      return {
        success: true,
        data: user,
      };
    } catch (error: any) {
      this.logger.error(`Erreur getUser ${id}:`, error);
      throw new HttpException(
        error.message || 'Utilisateur non trouvé',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * GET /api/users/:id/stats - Statistiques d'un utilisateur (admin)
   */
  @Get(':id/stats')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getUserStats(@Param('id') id: string) {
    this.logger.log(`GET /api/users/${id}/stats`);

    try {
      const stats = await this.usersService.getUserStats(id);
      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      this.logger.error(`Erreur getUserStats ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/users - Créer un utilisateur (admin)
   */
  @Post()
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async createUser(@Body() userData: CreateUserDto) {
    this.logger.log(`POST /api/users - Email: ${userData.email}`);

    try {
      // Validation Zod
      const validatedData = CreateUserSchema.parse(userData);

      const user = await this.usersService.createUser(validatedData);

      return {
        success: true,
        message: 'Utilisateur créé avec succès',
        data: user,
      };
    } catch (error: any) {
      this.logger.error('Erreur createUser:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la création',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PUT /api/users/:id - Mettre à jour un utilisateur (admin)
   */
  @Put(':id')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async updateUser(@Param('id') id: string, @Body() updates: UpdateUserDto) {
    this.logger.log(`PUT /api/users/${id}`);

    try {
      // Validation Zod
      const validatedData = UpdateUserSchema.parse(updates);

      const user = await this.usersService.updateUser(id, validatedData);

      return {
        success: true,
        message: 'Utilisateur mis à jour avec succès',
        data: user,
      };
    } catch (error: any) {
      this.logger.error(`Erreur updateUser ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors de la mise à jour',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * DELETE /api/users/:id - Désactiver un utilisateur (admin)
   */
  @Delete(':id')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async deleteUser(@Param('id') id: string) {
    this.logger.log(`DELETE /api/users/${id}`);

    try {
      await this.usersService.deleteUser(id);

      return {
        success: true,
        message: 'Utilisateur désactivé avec succès',
      };
    } catch (error: any) {
      this.logger.error(`Erreur deleteUser ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors de la suppression',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /api/users/:id/reactivate - Réactiver un utilisateur (admin)
   */
  @Post(':id/reactivate')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async reactivateUser(@Param('id') id: string) {
    this.logger.log(`POST /api/users/${id}/reactivate`);

    try {
      const user = await this.usersService.reactivateUser(id);

      return {
        success: true,
        message: 'Utilisateur réactivé avec succès',
        data: user,
      };
    } catch (error: any) {
      this.logger.error(`Erreur reactivateUser ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors de la réactivation',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PUT /api/users/:id/password - Changer le mot de passe (admin)
   */
  @Put(':id/password')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async updatePassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    this.logger.log(`PUT /api/users/${id}/password`);

    if (!body.newPassword || body.newPassword.length < 8) {
      throw new HttpException(
        'Le mot de passe doit contenir au moins 8 caractères',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.usersService.updatePassword(id, body.newPassword);

      return {
        success: true,
        message: 'Mot de passe mis à jour avec succès',
      };
    } catch (error: any) {
      this.logger.error(`Erreur updatePassword ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors du changement de mot de passe',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /api/users/export - Exporter les utilisateurs en CSV (admin)
   */
  @Post('export')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async exportUsers(@Body() filters: UserFilters) {
    this.logger.log('POST /api/users/export');

    try {
      const csv = await this.usersService.exportToCSV(filters);

      return {
        success: true,
        data: csv,
        filename: `users-${new Date().toISOString().split('T')[0]}.csv`,
      };
    } catch (error: any) {
      this.logger.error('Erreur exportUsers:', error);
      throw new HttpException(
        error.message || "Erreur lors de l'export",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
