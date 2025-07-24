/**
 * 📋 SERVICE ADMIN DASHBOARD - NestJS-Remix Monorepo
 *
 * Service principal pour les statistiques et métriques admin
 * Intégré avec l'architecture Supabase existante
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseRestService } from '../../../database/supabase-rest.service';
import {
  DashboardStatsSchema,
  type DashboardStats,
} from '../schemas/admin.schemas';

@Injectable()
export class AdminDashboardService {
  private readonly logger = new Logger(AdminDashboardService.name);

  constructor(private readonly supabaseService: SupabaseRestService) {}

  /**
   * Récupérer les statistiques complètes du dashboard admin
   * Utilise les vraies tables legacy
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      this.logger.log('Génération des statistiques dashboard admin...');

      // Paralléliser les requêtes pour de meilleures performances
      const [
        usersStats,
        ordersStats,
        revenueStats,
        stockStats,
        recentActivity,
      ] = await Promise.all([
        this.getUsersStats(),
        this.getOrdersStats(),
        this.getRevenueStats(),
        this.getStockStats(),
        this.getRecentActivity(),
      ]);

      const stats: DashboardStats = {
        totalUsers: usersStats.total,
        activeUsers: usersStats.active,
        totalOrders: ordersStats.total,
        totalRevenue: revenueStats,
        lowStockItems: stockStats.lowStock,
        pendingOrders: ordersStats.pending,
        recentActivity: recentActivity || [],
      };

      // Validation avec Zod
      const validatedStats = DashboardStatsSchema.parse(stats);

      this.logger.log(
        `Stats générées: ${validatedStats.totalUsers} users, ${validatedStats.totalOrders} orders`,
      );
      return validatedStats;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la génération des stats dashboard:',
        error,
      );
      throw error;
    }
  }

  /**
   * Statistiques des utilisateurs depuis ___xtr_customer
   */
  private async getUsersStats(): Promise<{ total: number; active: number }> {
    try {
      // Total des utilisateurs
      const totalResponse = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/___xtr_customer?select=count`,
        {
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'count=exact',
          },
        },
      );

      // Utilisateurs actifs (cst_activ = '1')
      const activeResponse = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/___xtr_customer?select=count&cst_activ=eq.1`,
        {
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'count=exact',
          },
        },
      );

      const totalCount = parseInt(
        totalResponse.headers.get('content-range')?.split('/')[1] || '0',
      );
      const activeCount = parseInt(
        activeResponse.headers.get('content-range')?.split('/')[1] || '0',
      );

      return {
        total: totalCount,
        active: activeCount,
      };
    } catch (error) {
      this.logger.error('Erreur lors du calcul des stats utilisateurs:', error);
      return { total: 0, active: 0 };
    }
  }

  /**
   * Statistiques des commandes depuis ___xtr_order
   */
  private async getOrdersStats(): Promise<{ total: number; pending: number }> {
    try {
      // Total des commandes
      const totalResponse = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/___xtr_order?select=count`,
        {
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'count=exact',
          },
        },
      );

      // Commandes en attente (ord_ords_id = '1' selon les données)
      const pendingResponse = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/___xtr_order?select=count&ord_ords_id=eq.1`,
        {
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'count=exact',
          },
        },
      );

      const totalCount = parseInt(
        totalResponse.headers.get('content-range')?.split('/')[1] || '0',
      );
      const pendingCount = parseInt(
        pendingResponse.headers.get('content-range')?.split('/')[1] || '0',
      );

      return {
        total: totalCount,
        pending: pendingCount,
      };
    } catch (error) {
      this.logger.error('Erreur lors du calcul des stats commandes:', error);
      return { total: 0, pending: 0 };
    }
  }

  /**
   * Calcul du chiffre d'affaires depuis ___xtr_order
   */
  private async getRevenueStats(): Promise<number> {
    try {
      const response = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/___xtr_order?select=ord_total_ttc&ord_is_pay=eq.1`,
        {
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Erreur API Supabase: ${response.status}`);
      }

      const orders = await response.json();
      const totalRevenue = orders.reduce((sum: number, order: any) => {
        return sum + (parseFloat(order.ord_total_ttc) || 0);
      }, 0);

      return totalRevenue;
    } catch (error) {
      this.logger.error('Erreur lors du calcul du CA:', error);
      return 0;
    }
  }

  /**
   * Statistiques stock depuis pieces
   */
  private async getStockStats(): Promise<{ lowStock: number }> {
    try {
      // Approximation pour les articles en stock faible
      // À adapter selon votre logique métier
      const response = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/pieces?select=count&limit=1000`,
        {
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'count=exact',
          },
        },
      );

      // Pour l'instant, on estime 5% en stock faible
      const totalPieces = parseInt(
        response.headers.get('content-range')?.split('/')[1] || '0',
      );
      const lowStockEstimate = Math.floor(totalPieces * 0.05);

      return { lowStock: lowStockEstimate };
    } catch (error) {
      this.logger.error('Erreur lors du calcul des stats stock:', error);
      return { lowStock: 0 };
    }
  }

  /**
   * Activité récente (simulation pour l'instant)
   */
  private async getRecentActivity(): Promise<any[]> {
    try {
      // Simulation d'activité récente
      // À remplacer par une vraie table de logs
      return [
        {
          id: crypto.randomUUID(),
          userId: 'system',
          action: 'dashboard_view',
          resource: 'admin',
          createdAt: new Date(),
        },
      ];
    } catch (error) {
      this.logger.error(
        "Erreur lors de la récupération de l'activité récente:",
        error,
      );
      return [];
    }
  }

  /**
   * Métriques en temps réel pour le monitoring
   */
  async getRealtimeMetrics(): Promise<{
    onlineUsers: number;
    activeOrders: number;
    systemHealth: 'good' | 'warning' | 'critical';
  }> {
    try {
      // Simulation de métriques temps réel
      return {
        onlineUsers: Math.floor(Math.random() * 50) + 10,
        activeOrders: Math.floor(Math.random() * 20) + 5,
        systemHealth: 'good',
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des métriques temps réel:',
        error,
      );
      return {
        onlineUsers: 0,
        activeOrders: 0,
        systemHealth: 'critical',
      };
    }
  }
}
