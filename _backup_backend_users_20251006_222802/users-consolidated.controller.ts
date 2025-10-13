/**
 * CONTRÔLEUR UTILISATEURS CONSOLIDÉ
 * Version propre sans doublon - endpoints unifiés
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
} from '@nestjs/common';
import { UsersConsolidatedService } from './users-consolidated.service';
import { AuthenticatedGuard } from '../../auth/authenticated.guard';
import { IsAdminGuard } from '../../auth/is-admin.guard';
import {
  UserCompleteDto,
  UserSearchFiltersDto,
  CreateUserDto,
  UpdateUserDto,
  UserSearchFiltersDtoSchema,
} from './dto/user-complete.dto';

@Controller('api/users-v2')
export class UsersConsolidatedController {
  private readonly logger = new Logger(UsersConsolidatedController.name);

  constructor(
    private readonly usersService: UsersConsolidatedService,
  ) {}

  /**
   * GET /api/users-v2 - Liste des utilisateurs avec filtres avancés
   * Accessible uniquement aux admins
   */
  @Get()
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getUsers(@Query() query: any) {
    this.logger.log(`GET /api/users-v2 - Filters: ${JSON.stringify(query)}`);

    try {
      // Validation avec Zod
      const filters = UserSearchFiltersDtoSchema.parse({
        search: query.search,
        status: query.status,
        userType: query.userType,
        level: query.level ? parseInt(query.level) : undefined,
        city: query.city,
        country: query.country,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 20,
      });

      const result = await this.usersService.getAllUsers(filters);

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      this.logger.error('❌ Error in getUsers:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des utilisateurs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/users-v2/:id - Détails d'un utilisateur
   */
  @Get(':id')
  @UseGuards(AuthenticatedGuard)
  async getUser(@Param('id') id: string) {
    this.logger.log(`GET /api/users-v2/${id}`);

    try {
      const user = await this.usersService.getUserById(id);
      return {
        success: true,
        data: user,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error getting user ${id}:`, error);
      throw new HttpException(
        error.message || 'Utilisateur non trouvé',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * GET /api/users-v2/:id/orders - Commandes d'un utilisateur
   */
  @Get(':id/orders')
  @UseGuards(AuthenticatedGuard)
  async getUserOrders(@Param('id') id: string) {
    this.logger.log(`GET /api/users-v2/${id}/orders`);

    try {
      const orders = await this.usersService.getUserOrders(id);
      return {
        success: true,
        data: orders,
        total: orders.length,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error getting orders for user ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des commandes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/users-v2/:id/stats - Statistiques d'un utilisateur
   */
  @Get(':id/stats')
  @UseGuards(AuthenticatedGuard)
  async getUserStats(@Param('id') id: string) {
    this.logger.log(`GET /api/users-v2/${id}/stats`);

    try {
      const stats = await this.usersService.getUserStats(id);
      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error getting stats for user ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/users-v2/search/:term - Recherche d'utilisateurs
   */
  @Get('search/:term')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async searchUsers(
    @Param('term') term: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`GET /api/users-v2/search/${term}`);

    try {
      const users = await this.usersService.searchUsers(
        term,
        limit ? parseInt(limit) : 20,
      );
      return {
        success: true,
        data: users,
        total: users.length,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error searching users with term ${term}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors de la recherche',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/users-v2/email/:email - Recherche par email
   */
  @Get('email/:email')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getUserByEmail(@Param('email') email: string) {
    this.logger.log(`GET /api/users-v2/email/${email}`);

    try {
      const user = await this.usersService.getUserByEmail(email);
      if (!user) {
        throw new HttpException('Utilisateur non trouvé', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: user,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error getting user by email ${email}:`, error);
      throw new HttpException(
        error.message || 'Utilisateur non trouvé',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * POST /api/users-v2 - Créer un utilisateur
   */
  @Post()
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async createUser(@Body() userData: CreateUserDto) {
    this.logger.log(`POST /api/users-v2 - Email: ${userData.email}`);

    try {
      const user = await this.usersService.createUser(userData);
      return {
        success: true,
        message: 'Utilisateur créé avec succès',
        data: user,
      };
    } catch (error: any) {
      this.logger.error('❌ Error creating user:', error);
      throw new HttpException(
        error.message || 'Erreur lors de la création',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PUT /api/users-v2/:id - Mettre à jour un utilisateur
   */
  @Put(':id')
  @UseGuards(AuthenticatedGuard)
  async updateUser(@Param('id') id: string, @Body() updates: UpdateUserDto) {
    this.logger.log(`PUT /api/users-v2/${id}`);

    try {
      const user = await this.usersService.updateUser(id, updates);
      return {
        success: true,
        message: 'Utilisateur mis à jour avec succès',
        data: user,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error updating user ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors de la mise à jour',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * DELETE /api/users-v2/:id - Désactiver un utilisateur
   */
  @Delete(':id')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async deleteUser(@Param('id') id: string) {
    this.logger.log(`DELETE /api/users-v2/${id}`);

    try {
      await this.usersService.deleteUser(id);
      return {
        success: true,
        message: 'Utilisateur désactivé avec succès',
      };
    } catch (error: any) {
      this.logger.error(`❌ Error deleting user ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors de la suppression',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /api/users-v2/:id/reactivate - Réactiver un utilisateur
   */
  @Post(':id/reactivate')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async reactivateUser(@Param('id') id: string) {
    this.logger.log(`POST /api/users-v2/${id}/reactivate`);

    try {
      const user = await this.usersService.reactivateUser(id);
      return {
        success: true,
        message: 'Utilisateur réactivé avec succès',
        data: user,
      };
    } catch (error: any) {
      this.logger.error(`❌ Error reactivating user ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors de la réactivation',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PUT /api/users-v2/:id/password - Changer le mot de passe
   */
  @Put(':id/password')
  @UseGuards(AuthenticatedGuard)
  async updatePassword(
    @Param('id') id: string,
    @Body() body: { newPassword: string },
  ) {
    this.logger.log(`PUT /api/users-v2/${id}/password`);

    try {
      await this.usersService.updatePassword(id, body.newPassword);
      return {
        success: true,
        message: 'Mot de passe mis à jour avec succès',
      };
    } catch (error: any) {
      this.logger.error(`❌ Error updating password for user ${id}:`, error);
      throw new HttpException(
        error.message || 'Erreur lors du changement de mot de passe',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /api/users-v2/stats/count - Comptage total utilisateurs actifs
   */
  @Get('stats/count')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getTotalActiveUsers() {
    this.logger.log('GET /api/users-v2/stats/count');

    try {
      const count = await this.usersService.getTotalActiveUsersCount();
      return {
        success: true,
        data: { totalActiveUsers: count },
      };
    } catch (error: any) {
      this.logger.error('❌ Error counting active users:', error);
      throw new HttpException(
        error.message || 'Erreur lors du comptage',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
