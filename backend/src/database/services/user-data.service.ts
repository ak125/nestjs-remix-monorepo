import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { ConfigService } from '@nestjs/config';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive: boolean;
  isPro: boolean;
  level: number;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class UserDataService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('UserDataService initialized');
  }

  /**
   * Récupère un utilisateur par ID
   */
  async getUserById(userId: string): Promise<User> {
    try {
      const { data, error } = await this.client
        .from('___xtr_customer')
        .select('*')
        .eq('customer_id', userId)
        .single();

      if (error || !data) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      return this.mapToUser(data);
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Récupère un utilisateur par email
   */
  async getUserByEmail(email: string): Promise<User> {
    try {
      const { data, error } = await this.client
        .from('___xtr_customer')
        .select('*')
        .eq('customer_email', email)
        .single();

      if (error || !data) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      return this.mapToUser(data);
    } catch (error) {
      this.logger.error(`Failed to get user by email ${email}:`, error);
      throw error;
    }
  }

  /**
   * Crée un nouvel utilisateur
   */
  async createUser(userData: Partial<User>): Promise<User> {
    try {
      const { data, error } = await this.client
        .from('___xtr_customer')
        .insert({
          customer_email: userData.email,
          customer_firstname: userData.firstName,
          customer_lastname: userData.lastName,
          customer_phone: userData.phone,
          customer_is_active: userData.isActive ?? true,
          customer_is_pro: userData.isPro ?? false,
          customer_level: userData.level ?? 1,
          customer_created_at: new Date(),
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapToUser(data);
    } catch (error) {
      this.logger.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Met à jour un utilisateur
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const updateData: any = {};

      if (updates.email) updateData.customer_email = updates.email;
      if (updates.firstName) updateData.customer_firstname = updates.firstName;
      if (updates.lastName) updateData.customer_lastname = updates.lastName;
      if (updates.phone) updateData.customer_phone = updates.phone;
      if (typeof updates.isActive !== 'undefined')
        updateData.customer_is_active = updates.isActive;
      if (typeof updates.isPro !== 'undefined')
        updateData.customer_is_pro = updates.isPro;
      if (updates.level) updateData.customer_level = updates.level;

      const { data, error } = await this.client
        .from('___xtr_customer')
        .update({
          ...updateData,
          customer_updated_at: new Date(),
        })
        .eq('customer_id', userId)
        .select()
        .single();

      if (error) throw error;
      return this.mapToUser(data);
    } catch (error) {
      this.logger.error(`Failed to update user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Mappe les données de la DB vers le modèle User
   */
  private mapToUser(dbData: any): User {
    return {
      id: dbData.customer_id,
      email: dbData.customer_email,
      firstName: dbData.customer_firstname,
      lastName: dbData.customer_lastname,
      phone: dbData.customer_phone,
      isActive: dbData.customer_is_active,
      isPro: dbData.customer_is_pro,
      level: dbData.customer_level,
      createdAt: dbData.customer_created_at,
      updatedAt: dbData.customer_updated_at,
    };
  }
}
