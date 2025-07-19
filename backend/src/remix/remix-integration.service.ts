/**
 * Service d'intégration pour Remix - Accès direct aux services NestJS
 * Evite les appels HTTP internes inutiles
 */

import { Injectable } from '@nestjs/common';
import { OrdersCompleteService } from '../modules/orders/orders-complete.service';
import { UsersService } from '../modules/users/users.service';

@Injectable()
export class RemixIntegrationService {
  constructor(
    private readonly ordersService: OrdersCompleteService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Récupérer les commandes avec pagination pour Remix
   */
  async getOrdersForRemix(params: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    search?: string;
  }) {
    try {
      const { page = 1, limit = 10, status, paymentStatus, search } = params;
      
      // Utiliser directement le service orders
      const result = await this.ordersService.getOrdersWithAllRelations(
        page,
        limit,
        {
          status,
          ...(search && { customerId: search })
        }
      );

      return {
        success: true,
        orders: result.orders || [],
        total: result.total || 0,
        page,
        totalPages: Math.ceil((result.total || 0) / limit),
      };
    } catch (error) {
      console.error('Erreur dans getOrdersForRemix:', error);
      return {
        success: false,
        orders: [],
        total: 0,
        page: 1,
        totalPages: 1,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer les utilisateurs pour Remix
   */
  async getUsersForRemix(params: {
    page?: number;
    limit?: number;
    search?: string;
    level?: number;
  }) {
    try {
      const { page = 1, limit = 10, search, level } = params;
      
      const result = await this.usersService.getAllUsers(page, limit);

      return {
        success: true,
        users: result.users || [],
        total: result.total || 0,
        page,
        totalPages: Math.ceil((result.total || 0) / limit),
      };
    } catch (error) {
      console.error('Erreur dans getUsersForRemix:', error);
      return {
        success: false,
        users: [],
        total: 0,
        page: 1,
        totalPages: 1,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer les statistiques pour le dashboard
   */
  async getDashboardStats() {
    try {
      // Récupérer les stats en parallèle
      const [ordersResult, usersResult] = await Promise.all([
        this.ordersService.getOrdersWithAllRelations(1, 1),
        this.usersService.getAllUsers(1, 1),
      ]);

      return {
        success: true,
        stats: {
          totalOrders: ordersResult.total || 0,
          totalUsers: usersResult.total || 0,
          // Ajoutez d'autres statistiques selon vos besoins
        },
      };
    } catch (error) {
      console.error('Erreur dans getDashboardStats:', error);
      return {
        success: false,
        stats: {
          totalOrders: 0,
          totalUsers: 0,
        },
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}
