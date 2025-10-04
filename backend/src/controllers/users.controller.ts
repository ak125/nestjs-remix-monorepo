import {
  Controller,
  Get,
  Param,
  Query,
  HttpStatus,
  HttpException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { LegacyUserService } from '../database/services/legacy-user.service';
import { LegacyOrderService } from '../database/services/legacy-order.service';

@Controller('api/legacy-users')
export class UsersController {
  constructor(
    private readonly legacyUserService: LegacyUserService,
    private readonly legacyOrderService: LegacyOrderService,
  ) {}

  /**
   * GET /api/users
   * Récupère tous les utilisateurs avec pagination
   */
  @Get()
  async getAllUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    try {
      console.log(
        '[UsersController] � NEW CONTROLLER CALLED - getAllUsers with:',
        { page, limit },
      );
      console.log('�📋 Récupération des utilisateurs...');

      const users = await this.legacyUserService.getAllUsers({
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      // Récupérer le total d'utilisateurs actifs
      const totalCount =
        await this.legacyUserService.getTotalActiveUsersCount();

      console.log(
        '[UsersController] 🔥 Service returned:',
        users.length,
        'users out of',
        totalCount,
        'total',
      );

      return {
        success: true,
        data: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
        },
      };
    } catch (error) {
      console.error(
        '[UsersController] ❌ Erreur récupération utilisateurs:',
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des utilisateurs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/legacy-users/search?q=terme
   * Recherche d'utilisateurs
   */
  @Get('search')
  async searchUsers(@Query('q') searchTerm: string) {
    try {
      console.log(`🔍 Recherche utilisateurs: "${searchTerm}"`);

      if (!searchTerm || searchTerm.length < 3) {
        throw new HttpException(
          'Le terme de recherche doit contenir au moins 3 caractères',
          HttpStatus.BAD_REQUEST,
        );
      }

      const users = await this.legacyUserService.searchUsers(searchTerm);

      return {
        success: true,
        data: users,
        searchTerm,
        count: users.length,
      };
    } catch (error) {
      console.error('❌ Erreur recherche utilisateurs:', error);
      if (error instanceof HttpException) throw error;

      throw new HttpException(
        'Erreur lors de la recherche',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/legacy-users/dashboard
   * Récupère les statistiques pour le dashboard utilisateur connecté
   * Nécessite une session authentifiée
   */
  @Get('dashboard')
  async getDashboardStats(@Req() req: Request) {
    try {
      console.log(`📊 Récupération des statistiques dashboard`);

      // Récupérer l'utilisateur depuis la session
      const sessionUser = (req.session as any)?.passport?.user;
      
      if (!sessionUser?.userId) {
        throw new HttpException(
          'Session utilisateur non trouvée',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Récupérer les détails complets de l'utilisateur
      const userDetails = await this.legacyUserService.getUserById(
        sessionUser.userId,
      );

      if (!userDetails) {
        throw new HttpException('Utilisateur non trouvé', HttpStatus.NOT_FOUND);
      }

      // Stats globales (pour admin)
      const totalUsers =
        await this.legacyUserService.getTotalActiveUsersCount();
      const totalOrders = await this.legacyOrderService.getTotalOrdersCount();
      const activeUsers =
        await this.legacyUserService.getTotalActiveUsersCount();

      // TODO: Implémenter récupération des messages et commandes utilisateur
      // Pour l'instant, stats basiques basées sur les données disponibles
      const userStats = {
        messages: {
          total: 0,
          unread: 0,
          threads: 0,
        },
        orders: {
          total: 0,
          pending: 0,
          completed: 0,
          revenue: 0,
        },
        profile: {
          completeness: this.calculateProfileCompleteness(userDetails),
          hasActiveSubscription: false,
          securityScore: 75,
        },
      };

      return {
        success: true,
        user: {
          id: userDetails.id,
          email: userDetails.email,
          firstName: userDetails.firstName,
          lastName: userDetails.lastName,
          status: userDetails.isActive ? 'active' : 'inactive',
          lastLoginAt:
            (userDetails as any).lastLoginAt || new Date().toISOString(),
          createdAt: (userDetails as any).createdAt || new Date().toISOString(),
          isPro: userDetails.isPro || false,
          isActive: userDetails.isActive,
          level: userDetails.level || 1,
        },
        stats: userStats,
        globalStats: {
          totalUsers,
          totalOrders,
          activeUsers,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ Erreur récupération stats dashboard:`, error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Calcule le taux de complétion du profil utilisateur
   */
  private calculateProfileCompleteness(user: any): number {
    let score = 0;
    const fields = [
      user.firstName,
      user.lastName,
      user.email,
      user.phone,
      user.address,
    ];
    
    fields.forEach((field) => {
      if (field && field.toString().trim().length > 0) {
        score += 20;
      }
    });

    return Math.min(score, 100);
  }

  /**
   * GET /api/legacy-users/:id
   * Récupère un utilisateur par son ID
   */
  @Get(':id')
  async getUserById(@Param('id') id: string) {
    try {
      console.log(`🔍 Récupération utilisateur ID: ${id}`);

      const user = await this.legacyUserService.getUserById(id);

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      console.error(`❌ Erreur récupération utilisateur ${id}:`, error);
      if (error instanceof HttpException) throw error;

      throw new HttpException(
        "Erreur lors de la récupération de l'utilisateur",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/legacy-users/:id/orders
   * Récupère les commandes d'un utilisateur
   */
  @Get(':id/orders')
  async getUserOrders(@Param('id') userId: string) {
    try {
      console.log(`📦 Récupération commandes utilisateur: ${userId}`);

      const orders = await this.legacyUserService.getUserOrders(userId);

      return {
        success: true,
        data: orders,
        userId,
        count: orders.length,
      };
    } catch (error) {
      console.error(`❌ Erreur commandes utilisateur ${userId}:`, error);
      throw new HttpException(
        'Erreur lors de la récupération des commandes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
