import { TABLES } from '@repo/database-types';
/**
 * ProfileService - Gestion des profils utilisateurs
 *
 * Responsabilités:
 * ✅ Récupération profils (getProfile, findById, findByEmail)
 * ✅ Mise à jour profils (updateProfile)
 * ✅ Mapping ___xtr_customer ↔ UserResponseDto
 * ✅ Cache profils fréquemment accédés
 *
 * Architecture:
 * - Utilise UserService pour accès données ___xtr_customer
 * - Remplace mock data par vraies queries DB
 * - Centralise mapping DB → DTO
 * - Évite circular dependency avec UsersService
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  OperationFailedException,
  DatabaseException,
} from '../../../common/exceptions';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { UserService } from '../../../database/services/user.service';
import { CacheService } from '../../../cache/cache.service';
import { UserResponseDto, UpdateProfileDto } from '../dto/users.dto';

@Injectable()
export class ProfileService extends SupabaseBaseService {
  protected readonly logger = new Logger(ProfileService.name);

  constructor(
    configService: ConfigService,
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
  ) {
    super(configService);
    this.logger.log('ProfileService initialized');
  }

  /**
   * Récupérer le profil d'un utilisateur
   * ✅ Utilise vraies données DB (UserService)
   * ✅ Cache pour performance
   */
  async getProfile(userId: string): Promise<UserResponseDto> {
    this.logger.log(`Récupération profil utilisateur: ${userId}`);

    try {
      // Vérifier cache
      const cached = await this.getCachedProfile(userId);
      if (cached) {
        this.logger.log(`✅ Profil trouvé en cache: ${userId}`);
        return cached;
      }

      // Query DB via UserService
      const user = await this.userService.getUserById(userId);

      if (!user) {
        throw new NotFoundException(`Utilisateur ${userId} non trouvé`);
      }

      // Convertir vers UserResponseDto
      const profile = this.mapToUserResponse(user);

      // Mettre en cache
      await this.setCachedProfile(userId, profile);

      this.logger.log(`✅ Profil récupéré: ${profile.email}`);
      return profile;
    } catch (error: unknown) {
      this.logger.error(`❌ Erreur récupération profil ${userId}:`, error);
      if (error instanceof NotFoundException) throw error;
      throw new OperationFailedException({
        message:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la récupération du profil',
      });
    }
  }

  /**
   * Mettre à jour le profil d'un utilisateur
   * ✅ Persiste changements en DB (UPDATE ___xtr_customer)
   * ✅ Invalide cache après mise à jour
   */
  async updateProfile(
    userId: string,
    updateDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Mise à jour profil utilisateur: ${userId}`, updateDto);

    try {
      // 1. Vérifier que l'utilisateur existe
      const existingUser = await this.getProfile(userId);
      if (!existingUser) {
        throw new NotFoundException(`Utilisateur ${userId} non trouvé`);
      }

      // 2. Préparer données pour UPDATE ___xtr_customer
      const updateData: any = {};

      if (updateDto.firstName !== undefined) {
        updateData.cst_fname = updateDto.firstName;
      }

      if (updateDto.lastName !== undefined) {
        updateData.cst_name = updateDto.lastName;
      }

      if (updateDto.phone !== undefined) {
        updateData.cst_tel = updateDto.phone;
      }

      // 3. UPDATE via Supabase
      const { error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update(updateData)
        .eq('cst_id', userId)
        .select()
        .single();

      if (error) {
        throw new DatabaseException({
          message: `Erreur mise à jour DB: ${error.message}`,
        });
      }

      // 4. Invalider cache
      await this.invalidateCachedProfile(userId);

      // 5. Récupérer profil mis à jour
      const updatedProfile = await this.getProfile(userId);

      this.logger.log(`✅ Profil mis à jour: ${updatedProfile.email}`);
      return updatedProfile;
    } catch (error: unknown) {
      this.logger.error(`❌ Erreur mise à jour profil ${userId}:`, error);
      if (
        error instanceof NotFoundException ||
        error instanceof DatabaseException
      )
        throw error;
      throw new OperationFailedException({
        message:
          error instanceof Error
            ? error.message
            : 'Erreur lors de la mise à jour du profil',
      });
    }
  }

  /**
   * Trouver un utilisateur par ID
   * ✅ Utilise vraies données DB
   * ✅ Retourne null si non trouvé (pas d'exception)
   */
  async findById(id: string): Promise<UserResponseDto | null> {
    this.logger.log(`Recherche utilisateur par ID: ${id}`);

    try {
      const user = await this.userService.getUserById(id);

      if (!user) {
        this.logger.log(`❌ Utilisateur ${id} non trouvé`);
        return null;
      }

      const profile = this.mapToUserResponse(user);
      this.logger.log(`✅ Utilisateur trouvé: ${profile.email}`);
      return profile;
    } catch (error: unknown) {
      this.logger.error(`❌ Erreur recherche par ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Trouver un utilisateur par email
   * ✅ Query Supabase directe (pas de mock data)
   * ✅ Retourne null si non trouvé
   */
  async findByEmail(email: string): Promise<UserResponseDto | null> {
    this.logger.log(`Recherche utilisateur par email: ${email}`);

    try {
      // Query directe Supabase ___xtr_customer
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('*')
        .eq('cst_mail', email)
        .single();

      if (error || !data) {
        this.logger.log(`❌ Utilisateur avec email ${email} non trouvé`);
        return null;
      }

      const profile = this.mapToUserResponse(data);
      this.logger.log(`✅ Utilisateur trouvé par email: ${profile.id}`);
      return profile;
    } catch (error: unknown) {
      this.logger.error(`❌ Erreur recherche par email ${email}:`, error);
      return null;
    }
  }

  // ========== MÉTHODES PRIVÉES ==========

  /**
   * Mapper données DB ___xtr_customer vers UserResponseDto
   * ✅ Centralise conversion dans 1 seul endroit
   * ✅ Gère conversions booléens '0'/'1' → boolean
   */
  private mapToUserResponse(user: any): UserResponseDto {
    return {
      id: user.cst_id,
      email: user.cst_mail,
      firstName: user.cst_fname || '',
      lastName: user.cst_name || '',
      isActive: user.cst_activ === '1',
      isPro: user.cst_is_pro === '1',
      tel: user.cst_tel || '',
      createdAt: new Date(), // TODO: Ajouter champ cst_created_at dans schema DB
      updatedAt: new Date(), // TODO: Ajouter champ cst_updated_at dans schema DB
    };
  }

  /**
   * Récupérer profil depuis cache
   */
  private async getCachedProfile(
    userId: string,
  ): Promise<UserResponseDto | null> {
    try {
      const cacheKey = `user:profile:${userId}`;
      const cached = await this.cacheService.get<UserResponseDto>(cacheKey);
      return cached || null;
    } catch (error) {
      this.logger.warn(`Erreur lecture cache profil ${userId}:`, error);
      return null;
    }
  }

  /**
   * Mettre profil en cache (TTL: 5 minutes)
   */
  private async setCachedProfile(
    userId: string,
    profile: UserResponseDto,
  ): Promise<void> {
    try {
      const cacheKey = `user:profile:${userId}`;
      const ttl = 300; // 5 minutes
      await this.cacheService.set(cacheKey, JSON.stringify(profile), ttl);
    } catch (error) {
      this.logger.warn(`Erreur mise en cache profil ${userId}:`, error);
      // Non bloquant, continuer sans cache
    }
  }

  /**
   * Invalider cache profil après mise à jour
   */
  /**
   * Invalider le cache du profil utilisateur
   * Public pour permettre l'utilisation par UsersAdminService
   */
  async invalidateCachedProfile(userId: string): Promise<void> {
    try {
      const cacheKey = `user:profile:${userId}`;
      await this.cacheService.del(cacheKey);
      this.logger.log(`✅ Cache profil ${userId} invalidé`);
    } catch (error) {
      this.logger.warn(`Erreur invalidation cache profil ${userId}:`, error);
      // Non bloquant
    }
  }
}
