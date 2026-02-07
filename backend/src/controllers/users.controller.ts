import { Controller, Get, Param, Query, Req, Logger } from '@nestjs/common';
import {
  OperationFailedException,
  DomainNotFoundException,
  DomainValidationException,
  AuthenticationException,
} from '../common/exceptions';
import { Request } from 'express';
import { LegacyUserService } from '../database/services/legacy-user.service';
import { OrdersService } from '../database/services/orders.service';

@Controller('api/legacy-users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly legacyUserService: LegacyUserService,
    private readonly ordersService: OrdersService,
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
      this.logger.log(`getAllUsers with: page=${page}, limit=${limit}`);
      this.logger.log('Récupération des utilisateurs...');

      const users = await this.legacyUserService.getAllUsers({
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      // Récupérer le total d'utilisateurs actifs
      const totalCount =
        await this.legacyUserService.getTotalActiveUsersCount();

      this.logger.log(
        `Service returned: ${users.length} users out of ${totalCount} total`,
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
      this.logger.error(`Erreur récupération utilisateurs: ${error}`);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des utilisateurs',
      });
    }
  }

  /**
   * GET /api/legacy-users/search?q=terme
   * Recherche d'utilisateurs
   */
  @Get('search')
  async searchUsers(@Query('q') searchTerm: string) {
    try {
      this.logger.log(`Recherche utilisateurs: "${searchTerm}"`);

      if (!searchTerm || searchTerm.length < 3) {
        throw new DomainValidationException({
          message: 'Le terme de recherche doit contenir au moins 3 caractères',
        });
      }

      const users = await this.legacyUserService.searchUsers(searchTerm);

      return {
        success: true,
        data: users,
        searchTerm,
        count: users.length,
      };
    } catch (error) {
      this.logger.error(`Erreur recherche utilisateurs: ${error}`);
      if (error instanceof DomainValidationException) throw error;

      throw new OperationFailedException({
        message: 'Erreur lors de la recherche',
      });
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
      this.logger.log('Récupération des statistiques dashboard');

      // Récupérer l'utilisateur depuis req.user (désérialisé par Passport)
      const user = req.user as Express.User | undefined;

      if (!user || !user.id) {
        throw new AuthenticationException({
          message: 'Session utilisateur non trouvée',
        });
      }

      this.logger.log(
        `Dashboard stats pour utilisateur: ${user.email} (${user.id})`,
      );

      // Récupérer les détails complets de l'utilisateur
      const userDetails = await this.legacyUserService.getUserById(user.id);

      if (!userDetails) {
        throw new DomainNotFoundException({
          message: 'Utilisateur non trouvé',
        });
      }

      // Stats globales (pour admin)
      const totalUsers =
        await this.legacyUserService.getTotalActiveUsersCount();
      const totalOrders = await this.ordersService.getTotalOrdersCount();
      const activeUsers =
        await this.legacyUserService.getTotalActiveUsersCount();

      // Récupérer les commandes de l'utilisateur
      const userOrders = await this.legacyUserService.getUserOrders(user.id);

      // Récupérer les messages de l'utilisateur (5 derniers)
      const baseUrl = process.env.SUPABASE_URL || '';
      const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      let recentMessages = [];
      let unreadCount = 0;

      try {
        const messagesResponse = await fetch(
          `${baseUrl}/rest/v1/___XTR_MSG?MSG_CST_ID=eq.${user.id}&MSG_CNFA_ID=neq.0&order=MSG_DATE.desc&limit=5`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (messagesResponse.ok) {
          recentMessages = await messagesResponse.json();
          unreadCount = recentMessages.filter(
            (msg: any) => msg.MSG_OPEN === 0,
          ).length;
        }
      } catch (error) {
        this.logger.error(`Erreur récupération messages: ${error}`);
      }

      // Calculer les stats des commandes
      const pendingOrders = userOrders.filter(
        (order: any) =>
          order.ord_is_pay === 0 || [1, 2, 3, 4, 5].includes(order.ord_status),
      ).length;
      const completedOrders = userOrders.filter(
        (order: any) => order.ord_is_pay === 1 && order.ord_status === 6,
      ).length;
      const totalRevenue = userOrders.reduce(
        (sum: number, order: any) => sum + parseFloat(order.ord_total_ttc || 0),
        0,
      );

      const userStats = {
        messages: {
          total: recentMessages.length,
          unread: unreadCount,
          recent: recentMessages.slice(0, 5),
        },
        orders: {
          total: userOrders.length,
          pending: pendingOrders,
          completed: completedOrders,
          revenue: totalRevenue,
          recent: userOrders.slice(0, 5),
        },
        profile: {
          completeness: this.calculateProfileCompleteness(userDetails),
          hasActiveSubscription: false,
          isPro: userDetails.isPro || false,
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
            (userDetails as unknown as Record<string, unknown>).lastLoginAt ||
            new Date().toISOString(),
          createdAt:
            (userDetails as unknown as Record<string, unknown>).createdAt ||
            new Date().toISOString(),
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
      this.logger.error(`Erreur récupération stats dashboard: ${error}`);

      if (
        error instanceof AuthenticationException ||
        error instanceof DomainNotFoundException
      ) {
        throw error;
      }

      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des statistiques',
      });
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
      this.logger.log(`Récupération utilisateur ID: ${id}`);

      const user = await this.legacyUserService.getUserById(id, {
        throwOnNotFound: true,
      });

      if (!user) {
        throw new DomainNotFoundException({
          message: 'Utilisateur non trouvé',
        });
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      this.logger.error(`Erreur récupération utilisateur ${id}: ${error}`);
      if (error instanceof DomainNotFoundException) throw error;

      throw new OperationFailedException({
        message: "Erreur lors de la récupération de l'utilisateur",
      });
    }
  }

  /**
   * GET /api/legacy-users/:id/orders
   * Récupère les commandes d'un utilisateur
   */
  @Get(':id/orders')
  async getUserOrders(@Param('id') userId: string) {
    try {
      this.logger.log(`Récupération commandes utilisateur: ${userId}`);

      const orders = await this.legacyUserService.getUserOrders(userId);

      return {
        success: true,
        data: orders,
        userId,
        count: orders.length,
      };
    } catch (error) {
      this.logger.error(`Erreur commandes utilisateur ${userId}: ${error}`);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des commandes',
      });
    }
  }

  /**
   * GET /api/legacy-users/:id/stats
   * Récupère les statistiques détaillées d'un utilisateur
   */
  @Get(':id/stats')
  async getUserStats(@Param('id') userId: string) {
    try {
      this.logger.log(`Récupération statistiques utilisateur: ${userId}`);

      const stats = await this.legacyUserService.getUserStats(userId);

      return {
        success: true,
        data: stats,
        userId,
      };
    } catch (error) {
      this.logger.error(`Erreur statistiques utilisateur ${userId}: ${error}`);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des statistiques',
      });
    }
  }
}
