/**
 * SERVICE UTILISATEURS CONSOLIDÉ
 * Version propre sans doublon ni redondance
 * Basé sur LegacyUserService (le meilleur) avec tous les champs
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import {
  UserCompleteDto,
  PaginatedUsersDto,
  UserSearchFiltersDto,
  CreateUserDto,
  UpdateUserDto,
  mapSupabaseToUserDto,
  mapUserDtoToSupabase,
} from './dto/user-complete.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersConsolidatedService extends SupabaseBaseService {
  private readonly logger = new Logger(UsersConsolidatedService.name);
  private cacheService = new CacheService();

  constructor(configService?: ConfigService) {
    super(configService);
    this.logger.log('✅ UsersConsolidatedService initialized');
  }

  /**
   * 📋 RÉCUPÉRER TOUS LES UTILISATEURS AVEC PAGINATION ET FILTRES
   * Version consolidée avec cache Redis
   */
  async getAllUsers(
    filters: UserSearchFiltersDto = {},
  ): Promise<PaginatedUsersDto> {
    const {
      search,
      status,
      userType,
      level,
      city,
      country,
      sortBy = 'cst_id',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = filters;

    const cacheKey = `users:all:${JSON.stringify(filters)}`;
    const cached = this.cacheService.get<PaginatedUsersDto>(cacheKey);
    if (cached) {
      this.logger.debug('📦 Cache hit for getAllUsers');
      return cached;
    }

    try {
      this.logger.debug(
        `🔍 Fetching users with filters: ${JSON.stringify(filters)}`,
      );

      let query = this.supabase
        .from('___xtr_customer')
        .select('*', { count: 'exact' });

      // Filtre par statut
      if (status === 'active') {
        query = query.eq('cst_activ', '1');
      } else if (status === 'inactive') {
        query = query.eq('cst_activ', '0');
      }

      // Filtre par type d'utilisateur
      if (userType === 'pro') {
        query = query.eq('cst_is_pro', '1');
      } else if (userType === 'particulier') {
        query = query.eq('cst_is_pro', '0');
      } else if (userType === 'company') {
        query = query.eq('cst_is_cpy', '1');
      }

      // Filtre par niveau
      if (level) {
        query = query.eq('cst_level', level);
      }

      // Filtre par ville
      if (city) {
        query = query.ilike('cst_city', `%${city}%`);
      }

      // Filtre par pays
      if (country) {
        query = query.ilike('cst_country', `%${country}%`);
      }

      // Recherche globale (email, prénom, nom)
      if (search) {
        query = query.or(
          `cst_mail.ilike.%${search}%,cst_fname.ilike.%${search}%,cst_name.ilike.%${search}%`,
        );
      }

      // Pagination
      const offset = (page - 1) * limit;
      query = query
        .range(offset, offset + limit - 1)
        .order(sortBy, { ascending: sortOrder === 'asc' });

      const { data, error, count } = await query;

      if (error) {
        this.logger.error('❌ Supabase error in getAllUsers:', error);
        throw error;
      }

      const users = (data || []).map(mapSupabaseToUserDto);
      const total = count || 0;

      const result: PaginatedUsersDto = {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1,
        },
      };

      // Cache pour 2 minutes
      this.cacheService.set(cacheKey, result, 2 * 60 * 1000);

      this.logger.log(`✅ Retrieved ${users.length} users of ${total} total`);
      return result;
    } catch (error) {
      this.logger.error('❌ Error in getAllUsers:', error);
      throw error;
    }
  }

  /**
   * 👤 RÉCUPÉRER UN UTILISATEUR PAR ID
   */
  async getUserById(userId: string): Promise<UserCompleteDto> {
    const cacheKey = `user:id:${userId}`;
    const cached = this.cacheService.get<UserCompleteDto>(cacheKey);
    if (cached) {
      this.logger.debug(`📦 Cache hit for user ${userId}`);
      return cached;
    }

    try {
      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .select('*')
        .eq('cst_id', userId)
        .single();

      if (error || !data) {
        throw new NotFoundException(`Utilisateur ${userId} non trouvé`);
      }

      const user = mapSupabaseToUserDto(data);

      // Cache pour 5 minutes
      this.cacheService.set(cacheKey, user, 5 * 60 * 1000);

      return user;
    } catch (error) {
      this.logger.error(`❌ Error getting user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 📧 RÉCUPÉRER UN UTILISATEUR PAR EMAIL
   */
  async getUserByEmail(email: string): Promise<UserCompleteDto | null> {
    const cacheKey = `user:email:${email}`;
    const cached = this.cacheService.get<UserCompleteDto | null>(cacheKey);
    if (cached !== null) {
      this.logger.debug(`📦 Cache hit for user email ${email}`);
      return cached;
    }

    try {
      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .select('*')
        .eq('cst_mail', email)
        .single();

      if (error || !data) {
        this.cacheService.set(cacheKey, null, 2 * 60 * 1000);
        return null;
      }

      const user = mapSupabaseToUserDto(data);

      // Cache pour 5 minutes
      this.cacheService.set(cacheKey, user, 5 * 60 * 1000);

      return user;
    } catch (error) {
      this.logger.error(`❌ Error getting user by email ${email}:`, error);
      return null;
    }
  }

  /**
   * ➕ CRÉER UN NOUVEL UTILISATEUR
   */
  async createUser(userData: CreateUserDto): Promise<UserCompleteDto> {
    try {
      // Vérifier si l'email existe déjà
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('Un utilisateur avec cet email existe déjà');
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Préparer les données
      const newUserData = {
        cst_id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        cst_pswd: hashedPassword,
        cst_activ: '1',
        cst_level: userData.isPro ? 5 : 1,
        cst_created_at: new Date().toISOString(),
        cst_updated_at: new Date().toISOString(),
        ...mapUserDtoToSupabase(userData),
      };

      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .insert(newUserData)
        .select()
        .single();

      if (error || !data) {
        this.logger.error('❌ Error creating user:', error);
        throw error;
      }

      const user = mapSupabaseToUserDto(data);

      // Invalider le cache
      this.cacheService.delete(`user:email:${userData.email}`);

      this.logger.log(`✅ User created: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error('❌ Error in createUser:', error);
      throw error;
    }
  }

  /**
   * ✏️ METTRE À JOUR UN UTILISATEUR
   */
  async updateUser(
    userId: string,
    updates: UpdateUserDto,
  ): Promise<UserCompleteDto> {
    try {
      // Vérifier que l'utilisateur existe
      const existingUser = await this.getUserById(userId);

      // Préparer les données
      const updateData = {
        ...mapUserDtoToSupabase(updates),
        cst_updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .update(updateData)
        .eq('cst_id', userId)
        .select()
        .single();

      if (error || !data) {
        this.logger.error(`❌ Error updating user ${userId}:`, error);
        throw error;
      }

      const user = mapSupabaseToUserDto(data);

      // Invalider le cache
      this.cacheService.delete(`user:id:${userId}`);
      this.cacheService.delete(`user:email:${existingUser.email}`);
      this.cacheService.deletePattern('users:all:*');

      this.logger.log(`✅ User updated: ${userId}`);
      return user;
    } catch (error) {
      this.logger.error(`❌ Error in updateUser ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 🗑️ SUPPRIMER UN UTILISATEUR (désactivation soft)
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('___xtr_customer')
        .update({ cst_activ: '0', cst_updated_at: new Date().toISOString() })
        .eq('cst_id', userId);

      if (error) {
        this.logger.error(`❌ Error deleting user ${userId}:`, error);
        throw error;
      }

      // Invalider le cache
      this.cacheService.delete(`user:id:${userId}`);
      this.cacheService.deletePattern('users:all:*');

      this.logger.log(`✅ User deactivated: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Error in deleteUser ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 🔄 RÉACTIVER UN UTILISATEUR
   */
  async reactivateUser(userId: string): Promise<UserCompleteDto> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .update({ cst_activ: '1', cst_updated_at: new Date().toISOString() })
        .eq('cst_id', userId)
        .select()
        .single();

      if (error || !data) {
        this.logger.error(`❌ Error reactivating user ${userId}:`, error);
        throw error;
      }

      const user = mapSupabaseToUserDto(data);

      // Invalider le cache
      this.cacheService.delete(`user:id:${userId}`);
      this.cacheService.deletePattern('users:all:*');

      this.logger.log(`✅ User reactivated: ${userId}`);
      return user;
    } catch (error) {
      this.logger.error(`❌ Error in reactivateUser ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 🔒 METTRE À JOUR LE MOT DE PASSE
   */
  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const { error } = await this.supabase
        .from('___xtr_customer')
        .update({
          cst_pswd: hashedPassword,
          cst_updated_at: new Date().toISOString(),
        })
        .eq('cst_id', userId);

      if (error) {
        this.logger.error(`❌ Error updating password for ${userId}:`, error);
        throw error;
      }

      this.logger.log(`✅ Password updated for user: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Error in updatePassword ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 📊 OBTENIR LES COMMANDES D'UN UTILISATEUR
   */
  async getUserOrders(userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_order')
        .select('ord_id, ord_date, ord_total_ttc, ord_is_pay, ord_info')
        .eq('ord_cst_id', userId)
        .order('ord_date', { ascending: false })
        .limit(50);

      if (error) {
        this.logger.error(
          `❌ Error getting orders for user ${userId}:`,
          error,
        );
        throw error;
      }

      return (data || []).map((order) => ({
        id: order.ord_id,
        date: order.ord_date,
        total: parseFloat(order.ord_total_ttc || '0'),
        isPaid: order.ord_is_pay === '1',
        info: order.ord_info,
        status: order.ord_is_pay === '1' ? 'paid' : 'pending',
      }));
    } catch (error) {
      this.logger.error(`❌ Error in getUserOrders ${userId}:`, error);
      throw error;
    }
  }

  /**
   * 📈 OBTENIR STATISTIQUES UTILISATEUR
   */
  async getUserStats(userId: string): Promise<{
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
  }> {
    try {
      const orders = await this.getUserOrders(userId);
      const paidOrders = orders.filter((o) => o.isPaid);

      const totalOrders = paidOrders.length;
      const totalSpent = paidOrders.reduce((sum, o) => sum + o.total, 0);
      const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

      return {
        totalOrders,
        totalSpent: Math.round(totalSpent * 100) / 100,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      };
    } catch (error) {
      this.logger.error(`❌ Error in getUserStats ${userId}:`, error);
      return { totalOrders: 0, totalSpent: 0, averageOrderValue: 0 };
    }
  }

  /**
   * 📊 COMPTER LE TOTAL D'UTILISATEURS ACTIFS
   */
  async getTotalActiveUsersCount(): Promise<number> {
    const cacheKey = 'users:count:active';
    const cached = this.cacheService.get<number>(cacheKey);
    if (cached !== null) {
      this.logger.debug('📦 Cache hit for active users count');
      return cached;
    }

    try {
      const { count, error } = await this.supabase
        .from('___xtr_customer')
        .select('*', { count: 'exact', head: true })
        .eq('cst_activ', '1');

      if (error) throw error;

      const totalCount = count || 0;

      // Cache pour 5 minutes
      this.cacheService.set(cacheKey, totalCount, 5 * 60 * 1000);

      return totalCount;
    } catch (error) {
      this.logger.error('❌ Error counting active users:', error);
      return 0;
    }
  }

  /**
   * 🔍 RECHERCHE AVANCÉE D'UTILISATEURS
   */
  async searchUsers(
    searchTerm: string,
    limit = 20,
  ): Promise<UserCompleteDto[]> {
    try {
      const { data, error } = await this.supabase
        .from('___xtr_customer')
        .select('*')
        .eq('cst_activ', '1')
        .or(
          `cst_mail.ilike.%${searchTerm}%,cst_fname.ilike.%${searchTerm}%,cst_name.ilike.%${searchTerm}%`,
        )
        .limit(limit);

      if (error) throw error;

      return (data || []).map(mapSupabaseToUserDto);
    } catch (error) {
      this.logger.error(
        `❌ Error searching users with term: ${searchTerm}`,
        error,
      );
      return [];
    }
  }
}
