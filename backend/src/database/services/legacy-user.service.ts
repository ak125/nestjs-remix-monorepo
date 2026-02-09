import { TABLES } from '@repo/database-types';
import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { getErrorMessage } from '../../common/utils/error.utils';

export interface LegacyUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  civility?: string;
  address?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  mobile?: string;
  isPro: boolean;
  isCompany: boolean;
  level: number;
  isActive: boolean;
  siret?: string;
  companyName?: string;
}

@Injectable()
export class LegacyUserService extends SupabaseBaseService {
  constructor(
    configService?: ConfigService,
    private readonly cacheService?: CacheService,
  ) {
    super(configService);
    this.logger.log('LegacyUserService initialized');
  }

  /**
   * Récupère tous les utilisateurs avec pagination
   */
  async getAllUsers(
    options: { limit?: number; offset?: number } = {},
  ): Promise<LegacyUser[]> {
    try {
      const { limit = 20, offset = 0 } = options;

      this.logger.log(
        `[UserService] getAllUsers called with: ${JSON.stringify({ limit, offset })}`,
      );

      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select(
          'cst_id, cst_mail, cst_name, cst_fname, cst_city, cst_level, cst_activ',
        )
        .eq('cst_activ', '1')
        .order('cst_id', { ascending: false })
        .range(offset, offset + limit - 1);

      this.logger.log(
        `[UserService] Supabase query result: ${JSON.stringify({
          dataLength: data?.length,
          error: error,
          firstUser: data?.[0],
        })}`,
      );

      if (error) {
        this.logger.error(
          `[UserService] Supabase error: ${JSON.stringify(error)}`,
        );
        throw error;
      }

      const mappedUsers = (data || []).map((user) =>
        this.mapToLegacyUser(user),
      );
      this.logger.log(
        `[UserService] Mapped users: ${JSON.stringify({
          count: mappedUsers.length,
          firstMapped: mappedUsers[0],
        })}`,
      );
      return mappedUsers;
    } catch (error) {
      this.logger.error(`[UserService] Failed to get all users: ${error}`);
      throw error;
    }
  }

  /**
   * Récupère un utilisateur par son ID
   */
  async getUserById(
    userId: string,
    options?: { throwOnNotFound?: boolean },
  ): Promise<LegacyUser | null> {
    try {
      this.logger.debug(`🔍 Recherche utilisateur avec ID: ${userId}`);

      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*')
        .eq('cst_id', userId)
        .single();

      if (error || !data) {
        this.logger.warn(`⚠️ Client ${userId} non trouvé`);

        // Si throwOnNotFound est true, on lance une erreur (pour l'endpoint API)
        if (options?.throwOnNotFound) {
          throw new NotFoundException(
            `Utilisateur non trouvé avec l'ID: ${userId}`,
          );
        }

        // Sinon retourner null (pour usage interne, affichage liste)
        return null;
      }

      this.logger.debug(`✅ Utilisateur trouvé:`, {
        id: data.cst_id,
        email: data.cst_mail,
      });
      return this.mapToLegacyUser(data);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `❌ Erreur inattendue lors de la recherche de l'utilisateur ${userId}:`,
        error,
      );
      throw new NotFoundException(
        `Impossible de récupérer l'utilisateur ${userId}: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Recherche d'utilisateurs
   */
  async searchUsers(searchTerm: string, limit = 20): Promise<LegacyUser[]> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('cst_id, cst_mail, cst_name, cst_fname, cst_city, cst_level')
        .eq('cst_activ', '1')
        .or(
          `cst_mail.ilike.%${searchTerm}%,cst_name.ilike.%${searchTerm}%,cst_fname.ilike.%${searchTerm}%`,
        )
        .limit(limit);

      if (error) throw error;

      return (data || []).map((user) => this.mapToLegacyUser(user));
    } catch (error) {
      this.logger.error(
        `Failed to search users with term: ${searchTerm}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Récupère les commandes d'un utilisateur
   */
  async getUserOrders(userId: string): Promise<any[]> {
    try {
      this.logger.debug(`📦 Recherche commandes pour user: ${userId}`);

      const { data, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('ord_id, ord_date, ord_total_ttc, ord_is_pay, ord_info')
        .eq('ord_cst_id', userId)
        .order('ord_date', { ascending: false })
        .limit(50);

      if (error) {
        this.logger.error(`❌ Erreur Supabase orders pour ${userId}:`, error);
        throw error;
      }

      const orders = (data || [])
        .map((order) => {
          try {
            return {
              id: order.ord_id,
              date: order.ord_date,
              total: parseFloat(order.ord_total_ttc || '0'),
              isPaid: order.ord_is_pay === '1',
              info: order.ord_info || null,
              status: order.ord_is_pay === '1' ? 'paid' : 'pending',
            };
          } catch (mapError) {
            this.logger.warn(
              `⚠️ Erreur mapping order ${order.ord_id}:`,
              mapError,
            );
            return null;
          }
        })
        .filter(Boolean); // Filtrer les nulls

      this.logger.debug(
        `✅ ${orders.length} commandes trouvées pour user ${userId}`,
      );
      return orders;
    } catch (error) {
      this.logger.error(`❌ Failed to get orders for user ${userId}:`, error);
      // Retourner un tableau vide au lieu de throw pour ne pas bloquer l'affichage
      return [];
    }
  }

  /**
   * Récupère les statistiques détaillées d'un utilisateur
   */
  async getUserStats(userId: string): Promise<{
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    lastOrderDate: string | null;
    firstOrderDate: string | null;
    paymentRate: number;
    accountAge: number;
    registrationDate: string | null;
  }> {
    try {
      this.logger.debug(`📊 Calcul statistiques pour user: ${userId}`);

      // Récupérer toutes les commandes pour les stats
      const orders = await this.getUserOrders(userId);

      const totalOrders = orders.length;
      const completedOrders = orders.filter((o) => o.isPaid).length;
      const pendingOrders = totalOrders - completedOrders;
      const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);
      const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      const paymentRate =
        totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

      // Dates des commandes
      const orderDates = orders
        .map((o) => new Date(o.date))
        .filter((d) => !isNaN(d.getTime()));
      const lastOrderDate =
        orderDates.length > 0
          ? new Date(
              Math.max(...orderDates.map((d) => d.getTime())),
            ).toISOString()
          : null;
      const firstOrderDate =
        orderDates.length > 0
          ? new Date(
              Math.min(...orderDates.map((d) => d.getTime())),
            ).toISOString()
          : null;

      // Ancienneté du compte (en jours)
      const registrationDate = firstOrderDate; // Approximation avec la première commande
      const accountAge = registrationDate
        ? Math.floor(
            (Date.now() - new Date(registrationDate).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;

      const stats = {
        totalOrders,
        completedOrders,
        pendingOrders,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        lastOrderDate,
        firstOrderDate,
        paymentRate: parseFloat(paymentRate.toFixed(1)),
        accountAge,
        registrationDate,
      };

      this.logger.debug(`✅ Stats calculées pour user ${userId}:`, stats);
      return stats;
    } catch (error) {
      this.logger.error(`❌ Failed to get stats for user ${userId}:`, error);
      // Retourner des stats vides en cas d'erreur
      return {
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        totalSpent: 0,
        averageOrderValue: 0,
        lastOrderDate: null,
        firstOrderDate: null,
        paymentRate: 0,
        accountAge: 0,
        registrationDate: null,
      };
    }
  }

  /**
   * Mappe les données de la DB vers le modèle LegacyUser
   */
  private mapToLegacyUser(dbData: any): LegacyUser {
    return {
      id: dbData.cst_id,
      email: dbData.cst_mail,
      firstName: dbData.cst_fname,
      lastName: dbData.cst_name,
      civility: dbData.cst_civility,
      address: dbData.cst_address,
      zipCode: dbData.cst_zip_code,
      city: dbData.cst_city,
      country: dbData.cst_country,
      phone: dbData.cst_tel,
      mobile: dbData.cst_gsm,
      isPro: dbData.cst_is_pro === '1',
      isCompany: dbData.cst_is_cpy === '1',
      level: parseInt(dbData.cst_level || '0'),
      isActive: dbData.cst_activ === '1',
      siret: dbData.cst_siret,
      companyName: dbData.cst_rs,
    };
  }

  /**
   * Compte le nombre total d'utilisateurs actifs
   */
  async getTotalActiveUsersCount(): Promise<number> {
    const cacheKey = 'total_active_users_count';

    // Essayer d'abord le cache (TTL: 2 minutes pour les stats)
    const cached = await this.cacheService?.get<number>(cacheKey);
    if (cached !== null && cached !== undefined) {
      this.logger.debug('📊 Using cached total active users count:', cached);
      return cached;
    }

    try {
      this.logger.debug('📊 Fetching total active users count from database');

      const { count, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*', { count: 'exact', head: true })
        .eq('cst_activ', '1');

      if (error) throw error;

      const totalCount = count || 0;

      // Cache pour 2 minutes (les stats changent pas souvent)
      await this.cacheService?.set(cacheKey, totalCount, 120);

      return totalCount;
    } catch (error) {
      this.logger.error('Failed to count total active users:', error);
      throw error;
    }
  }
}
