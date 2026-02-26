/**
 * 📊 Service d'Accès aux Données Utilisateurs Consolidé
 * Couche d'accès aux données Supabase sans logique métier
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  User,
  CreateUserDto,
  UpdateUserDto,
  UserFilters,
  PaginatedUsers,
  mapSupabaseToUser,
  mapUserToSupabase,
} from '../dto/user.dto';
import * as bcrypt from 'bcrypt';
import { TABLES } from '@repo/database-types';

@Injectable()
export class UserDataConsolidatedService extends SupabaseBaseService {
  protected readonly logger = new Logger(UserDataConsolidatedService.name);

  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('✅ UserDataConsolidatedService initialized');
  }

  /**
   * Récupérer un utilisateur par ID
   */
  async findById(userId: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*')
        .eq('cst_id', userId)
        .single();

      if (error || !data) return null;

      return mapSupabaseToUser(data);
    } catch (error) {
      this.logger.error(`Error finding user by ID ${userId}:`, error);
      return null;
    }
  }

  /**
   * Récupérer un utilisateur par email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*')
        .eq('cst_mail', email)
        .single();

      if (error || !data) return null;

      return mapSupabaseToUser(data);
    } catch (error) {
      this.logger.error(`Error finding user by email ${email}:`, error);
      return null;
    }
  }

  /**
   * Récupérer tous les utilisateurs avec filtres et pagination
   */
  async findAll(filters: UserFilters): Promise<PaginatedUsers> {
    try {
      const {
        search,
        status,
        userType,
        level,
        city,
        country,
        sortBy,
        sortOrder,
        page,
        limit,
      } = filters;

      let query = this.supabase
        .from(TABLES.xtr_customer)
        .select('*', { count: 'exact' });

      // Filtres
      if (status === 'active') query = query.eq('cst_activ', '1');
      else if (status === 'inactive') query = query.eq('cst_activ', '0');

      if (userType === 'pro') query = query.eq('cst_is_pro', '1');
      else if (userType === 'company') query = query.eq('cst_is_cpy', '1');
      else if (userType === 'individual') {
        query = query.eq('cst_is_pro', '0').eq('cst_is_cpy', '0');
      }

      if (level) query = query.eq('cst_level', level);
      if (city) query = query.ilike('cst_city', `%${city}%`);
      if (country) query = query.ilike('cst_country', `%${country}%`);

      // Recherche globale
      if (search) {
        query = query.or(
          `cst_mail.ilike.%${search}%,cst_fname.ilike.%${search}%,cst_name.ilike.%${search}%`,
        );
      }

      // Pagination et tri
      const offset = (page - 1) * limit;
      const supabaseColumn = this.mapSortColumn(sortBy);
      query = query
        .range(offset, offset + limit - 1)
        .order(supabaseColumn, { ascending: sortOrder === 'asc' });

      const { data, error, count } = await query;

      if (error) throw error;

      const users = (data || []).map(mapSupabaseToUser);
      const total = count || 0;

      return {
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
    } catch (error) {
      this.logger.error('Error in findAll:', error);
      throw error;
    }
  }

  /**
   * Créer un nouvel utilisateur
   */
  async create(userData: CreateUserDto): Promise<User> {
    try {
      // Hash du mot de passe
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Préparer les données
      const insertData = {
        cst_id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        cst_pswd: hashedPassword,
        cst_activ: '1',
        cst_created_at: new Date().toISOString(),
        cst_updated_at: new Date().toISOString(),
        ...mapUserToSupabase(userData),
      };

      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .insert(insertData)
        .select()
        .single();

      if (error || !data) throw error;

      return mapSupabaseToUser(data);
    } catch (error) {
      this.logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour un utilisateur
   */
  async update(userId: string, updates: UpdateUserDto): Promise<User> {
    try {
      const updateData = {
        ...mapUserToSupabase(updates),
        cst_updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update(updateData)
        .eq('cst_id', userId)
        .select()
        .single();

      if (error || !data) throw error;

      return mapSupabaseToUser(data);
    } catch (error) {
      this.logger.error(`Error updating user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Désactiver un utilisateur (soft delete)
   */
  async delete(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update({ cst_activ: '0', cst_updated_at: new Date().toISOString() })
        .eq('cst_id', userId);

      if (error) throw error;

      return true;
    } catch (error) {
      this.logger.error(`Error deleting user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Réactiver un utilisateur
   */
  async reactivate(userId: string): Promise<User> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update({ cst_activ: '1', cst_updated_at: new Date().toISOString() })
        .eq('cst_id', userId)
        .select()
        .single();

      if (error || !data) throw error;

      return mapSupabaseToUser(data);
    } catch (error) {
      this.logger.error(`Error reactivating user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Mettre à jour le mot de passe
   */
  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const { error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update({
          cst_pswd: hashedPassword,
          cst_updated_at: new Date().toISOString(),
        })
        .eq('cst_id', userId);

      if (error) throw error;

      return true;
    } catch (error) {
      this.logger.error(`Error updating password for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Compter les utilisateurs actifs
   */
  async countActive(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*', { count: 'exact', head: true })
        .eq('cst_activ', '1');

      if (error) throw error;

      return count || 0;
    } catch (error) {
      this.logger.error('Error counting active users:', error);
      return 0;
    }
  }

  /**
   * Rechercher des utilisateurs
   */
  async search(searchTerm: string, limit = 20): Promise<User[]> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*')
        .eq('cst_activ', '1')
        .or(
          `cst_mail.ilike.%${searchTerm}%,cst_fname.ilike.%${searchTerm}%,cst_name.ilike.%${searchTerm}%`,
        )
        .limit(limit);

      if (error) throw error;

      return (data || []).map(mapSupabaseToUser);
    } catch (error) {
      this.logger.error(
        `Error searching users with term: ${searchTerm}`,
        error,
      );
      return [];
    }
  }

  // ============================================
  // AUTH-SPECIFIC METHODS (login, password upgrade)
  // ============================================

  /**
   * Trouver un utilisateur par ID AVEC le hash du mot de passe
   * Usage : auth uniquement (changePassword verification)
   */
  async findByIdForAuth(
    userId: string,
  ): Promise<{ user: User; passwordHash: string } | null> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*')
        .eq('cst_id', userId)
        .single();

      if (error || !data) return null;

      return {
        user: mapSupabaseToUser(data),
        passwordHash: data.cst_pswd || '',
      };
    } catch (error) {
      this.logger.error(`Error finding user by ID for auth ${userId}:`, error);
      return null;
    }
  }

  /**
   * Trouver un utilisateur par email AVEC le hash du mot de passe
   * Usage : auth uniquement (login verification)
   */
  async findByEmailForAuth(
    email: string,
  ): Promise<{ user: User; passwordHash: string } | null> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*')
        .eq('cst_mail', email)
        .single();

      if (error || !data) return null;

      return {
        user: mapSupabaseToUser(data),
        passwordHash: data.cst_pswd || '',
      };
    } catch (error) {
      this.logger.error(
        `Error finding user by email for auth ${email}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Trouver un admin par email AVEC le hash du mot de passe
   * Usage : auth uniquement (admin login fallback)
   */
  async findAdminByEmailForAuth(email: string): Promise<{
    id: string;
    email: string;
    passwordHash: string;
    level: number;
    firstName: string;
    lastName: string;
    isActive: boolean;
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.config_admin)
        .select('*')
        .eq('cnfa_mail', email)
        .single();

      if (error || !data) return null;

      return {
        id: String(data.cnfa_id),
        email: data.cnfa_mail,
        passwordHash: data.cnfa_pswd || '',
        level: parseInt(String(data.cnfa_level || '7')),
        firstName: data.cnfa_fname || '',
        lastName: data.cnfa_name || '',
        isActive: data.cnfa_activ === '1',
      };
    } catch (error) {
      this.logger.error(
        `Error finding admin by email for auth ${email}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Trouver un admin par ID (pour la désérialisation session)
   */
  async findAdminById(adminId: string): Promise<{
    id: string;
    email: string;
    level: number;
    firstName: string;
    lastName: string;
    isActive: boolean;
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from(TABLES.config_admin)
        .select('*')
        .eq('cnfa_id', adminId)
        .single();

      if (error || !data) return null;

      return {
        id: String(data.cnfa_id),
        email: data.cnfa_mail,
        level: parseInt(String(data.cnfa_level || '7')),
        firstName: data.cnfa_fname || '',
        lastName: data.cnfa_name || '',
        isActive: data.cnfa_activ === '1',
      };
    } catch (error) {
      this.logger.error(`Error finding admin by ID ${adminId}:`, error);
      return null;
    }
  }

  /**
   * Ecrire un hash de mot de passe deja calcule (par userId)
   * Usage : upgrade MD5→bcrypt dans auth.service
   */
  async setPasswordHash(
    userId: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update({
          cst_pswd: hashedPassword,
          cst_updated_at: new Date().toISOString(),
        })
        .eq('cst_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      this.logger.error(
        `Error setting password hash for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Ecrire un hash de mot de passe deja calcule (par email)
   * Usage : guest activation dans auth-token.controller
   */
  async setPasswordHashByEmail(
    email: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update({
          cst_pswd: hashedPassword,
          cst_updated_at: new Date().toISOString(),
        })
        .eq('cst_mail', email);

      if (error) throw error;
      return true;
    } catch (error) {
      this.logger.error(
        `Error setting password hash by email ${email}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Mapper les colonnes de tri
   */
  private mapSortColumn(column: string): string {
    const mapping: Record<string, string> = {
      email: 'cst_mail',
      name: 'cst_name',
      firstName: 'cst_fname',
      lastName: 'cst_name',
      level: 'cst_level',
      city: 'cst_city',
      createdAt: 'cst_created_at',
      status: 'cst_activ',
    };

    return mapping[column] || 'cst_id';
  }
}
