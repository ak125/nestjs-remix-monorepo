import { Controller, Get, Param, Query, Req, Logger } from '@nestjs/common';
import {
  OperationFailedException,
  DomainNotFoundException,
  DomainValidationException,
  AuthenticationException,
} from '../common/exceptions';
import { Request } from 'express';
import { UserDataConsolidatedService } from '../modules/users/services/user-data-consolidated.service';
import { OrdersService } from '../database/services/orders.service';

interface UserMessageRow {
  MSG_OPEN: number;
  [key: string]: unknown;
}

interface _UserOrderRow {
  ord_is_pay: number;
  ord_is_ship: number;
  ord_total_ttc: string;
  ord_status: number;
  [key: string]: unknown;
}

interface UserProfileRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  isPro?: boolean;
  isActive?: boolean;
  level?: number;
  id?: string;
  [key: string]: unknown;
}

@Controller('api/legacy-users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly userDataService: UserDataConsolidatedService,
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

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      const result = await this.userDataService.findAll({
        page: pageNum,
        limit: limitNum,
        status: 'active',
        sortBy: 'email',
        sortOrder: 'desc',
      });

      this.logger.log(
        `Service returned: ${result.users.length} users out of ${result.pagination.total} total`,
      );

      return {
        success: true,
        data: result.users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: result.pagination.total,
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

      const users = await this.userDataService.search(searchTerm);

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
      const userDetails = await this.userDataService.findById(user.id);

      if (!userDetails) {
        throw new DomainNotFoundException({
          message: 'Utilisateur non trouvé',
        });
      }

      // Stats globales (pour admin)
      const totalUsers = await this.userDataService.countActive();
      const totalOrders = await this.ordersService.getTotalOrdersCount();
      const activeUsers = totalUsers;

      // Récupérer les commandes de l'utilisateur
      const userOrders = await this.ordersService.getUserOrders(user.id);

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
            (msg: UserMessageRow) => msg.MSG_OPEN === 0,
          ).length;
        }
      } catch (error) {
        this.logger.error(`Erreur récupération messages: ${error}`);
      }

      // Calculer les stats des commandes
      const pendingOrders = userOrders.filter((order) => !order.isPaid).length;
      const completedOrders = userOrders.filter((order) => order.isPaid).length;
      const totalRevenue = userOrders.reduce(
        (sum, order) => sum + (order.totalTtc || 0),
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
          completeness: this.calculateProfileCompleteness(
            userDetails as unknown as UserProfileRow,
          ),
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
  private calculateProfileCompleteness(user: UserProfileRow): number {
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

      const user = await this.userDataService.findById(id);

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

      const orders = await this.ordersService.getUserOrders(userId);

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

      const stats = await this.ordersService.getOrdersStats(userId);

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
