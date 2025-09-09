import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache.service';

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
  private cacheService = new CacheService();

  constructor(configService?: ConfigService) {
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

      console.log(`[UserService] getAllUsers called with:`, { limit, offset });

      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .select(
          'cst_id, cst_mail, cst_name, cst_fname, cst_city, cst_level, cst_activ',
        )
        .eq('cst_activ', '1')
        .order('cst_id', { ascending: false })
        .range(offset, offset + limit - 1);

      console.log(`[UserService] Supabase query result:`, {
        dataLength: data?.length,
        error: error,
        firstUser: data?.[0],
      });

      if (error) {
        console.error(`[UserService] Supabase error:`, error);
        throw error;
      }

      const mappedUsers = (data || []).map((user) =>
        this.mapToLegacyUser(user),
      );
      console.log(`[UserService] Mapped users:`, {
        count: mappedUsers.length,
        firstMapped: mappedUsers[0],
      });
      return mappedUsers;
    } catch (error) {
      console.error('[UserService] Failed to get all users:', error);
      this.logger.error('Failed to get all users:', error);
      throw error;
    }
  }

  /**
   * Récupère un utilisateur par son ID
   */
  async getUserById(userId: string): Promise<LegacyUser> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .select('*')
        .eq('cst_id', userId)
        .single();

      if (error || !data) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      return this.mapToLegacyUser(data);
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Recherche d'utilisateurs
   */
  async searchUsers(searchTerm: string, limit = 20): Promise<LegacyUser[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_customer')
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
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select('ord_id, ord_date, ord_total_ttc, ord_is_pay, ord_info')
        .eq('ord_cst_id', userId)
        .order('ord_date', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((order) => ({
        id: order.ord_id,
        date: order.ord_date,
        total: parseFloat(order.ord_total_ttc || '0'),
        isPaid: order.ord_is_pay === '1',
        info: order.ord_info,
        status: order.ord_is_pay === '1' ? 'paid' : 'pending',
      }));
    } catch (error) {
      this.logger.error(`Failed to get orders for user ${userId}:`, error);
      throw error;
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
    const cached = this.cacheService.get<number>(cacheKey);
    if (cached !== null) {
      this.logger.debug('📊 Using cached total active users count:', cached);
      return cached;
    }

    try {
      this.logger.debug('📊 Fetching total active users count from database');

      const { count, error } = await this.supabase
        .from('___xtr_customer')
        .select('*', { count: 'exact', head: true })
        .eq('cst_activ', '1');

      if (error) throw error;

      const totalCount = count || 0;

      // Cache pour 2 minutes (les stats changent pas souvent)
      this.cacheService.set(cacheKey, totalCount, 2 * 60 * 1000);

      return totalCount;
    } catch (error) {
      this.logger.error('Failed to count total active users:', error);
      throw error;
    }
  }
}
