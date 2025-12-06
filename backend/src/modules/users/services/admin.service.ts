/**
 * UsersAdminService - Opérations administratives uniquement
 *
 * Service dédié aux opérations admin qui ne peuvent PAS être exécutées par les utilisateurs normaux:
 * - Gestion des niveaux utilisateur (1=user, 7+=admin)
 * - Activation/désactivation de comptes
 * - Suppression définitive (soft delete)
 *
 * ⚠️ IMPORTANT: Ce service ne gère PAS:
 * - createUser() → Utiliser AuthService.register()
 * - updateUser() → Utiliser ProfileService.updateProfile() ou UsersService.update()
 * - Les utilisateurs normaux peuvent modifier leur propre profil via ProfileService
 *
 * @see JOUR3-PHASE3.1-ANALYSE-ADMIN-SIMPLIFIE.md
 */

import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { ProfileService } from './profile.service';
import { ConfigService } from '@nestjs/config';
import { TABLES } from '@repo/database-types';
import { UserResponseDto } from '../dto/users.dto';

@Injectable()
export class UsersAdminService extends SupabaseBaseService {
  constructor(
    configService: ConfigService,
    private readonly profileService: ProfileService,
  ) {
    super(configService);
  }

  // ========== GESTION NIVEAU UTILISATEUR ==========

  /**
   * Mettre à jour le niveau d'un utilisateur (admin uniquement)
   *
   * Le niveau détermine les privilèges:
   * - 1-6: Utilisateur normal
   * - 7-9: Administrateur
   *
   * @param id - ID de l'utilisateur
   * @param level - Nouveau niveau (1-9)
   * @returns UserResponseDto - Utilisateur avec niveau mis à jour
   * @throws NotFoundException si utilisateur n'existe pas
   * @throws HttpException si niveau invalide
   */
  async updateUserLevel(id: string, level: number): Promise<UserResponseDto> {
    this.logger.log(`⬆️ AdminService.updateUserLevel: ${id} → ${level}`);

    try {
      // Vérifier que l'utilisateur existe
      const existingUser = await this.profileService.findById(id);
      if (!existingUser) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Valider le niveau (1-9)
      if (level < 1 || level > 9) {
        throw new HttpException(
          'Niveau invalide (doit être entre 1 et 9)',
          HttpStatus.BAD_REQUEST,
        );
      }

      // UPDATE niveau dans DB
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update({
          cst_level: level.toString(),
          cst_updated_at: new Date().toISOString(),
        })
        .eq('cst_id', id)
        .select()
        .single();

      if (error) {
        this.logger.error('❌ Erreur update niveau:', error);
        throw new HttpException(
          'Erreur lors de la mise à jour du niveau',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Invalider le cache
      await this.profileService.invalidateCachedProfile(id);

      // Retourner utilisateur mis à jour
      const updatedUser: UserResponseDto = {
        id: data.cst_id,
        email: data.cst_mail,
        firstName: data.cst_fname,
        lastName: data.cst_name,
        isPro: data.cst_pro === '1',
        isActive: data.cst_activ === '1',
        createdAt: new Date(data.cst_created_at),
        updatedAt: new Date(data.cst_updated_at),
      };

      this.logger.log(`✅ Niveau utilisateur mis à jour: ${id} = ${level}`);
      return updatedUser;
    } catch (error: any) {
      this.logger.error('❌ Erreur mise à jour niveau:', error);
      throw error;
    }
  }

  // ========== ACTIVATION / DÉSACTIVATION ==========

  /**
   * Désactiver un utilisateur (admin uniquement)
   *
   * Empêche l'utilisateur de se connecter. Ses données sont conservées.
   * Le compte peut être réactivé ultérieurement.
   *
   * @param id - ID de l'utilisateur
   * @param reason - Raison de la désactivation (optionnel, pour logs/audit)
   * @returns boolean - true si succès
   * @throws NotFoundException si utilisateur n'existe pas
   */
  async deactivateUser(id: string, reason?: string): Promise<boolean> {
    this.logger.log(
      `🚫 AdminService.deactivateUser: ${id}${reason ? ` - ${reason}` : ''}`,
    );

    try {
      // Vérifier que l'utilisateur existe
      const existingUser = await this.profileService.findById(id);
      if (!existingUser) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // UPDATE cst_activ = '0'
      const { error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update({
          cst_activ: '0',
          cst_updated_at: new Date().toISOString(),
        })
        .eq('cst_id', id);

      if (error) {
        this.logger.error('❌ Erreur désactivation utilisateur:', error);
        throw new HttpException(
          'Erreur lors de la désactivation',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Invalider le cache
      await this.profileService.invalidateCachedProfile(id);

      // Logger la raison si fournie (pour audit)
      if (reason) {
        this.logger.warn(`⚠️ Désactivation utilisateur ${id}: ${reason}`);
      }

      this.logger.log(`✅ Utilisateur désactivé: ${id}`);
      return true;
    } catch (error: any) {
      this.logger.error('❌ Erreur désactivation utilisateur:', error);
      throw error;
    }
  }

  /**
   * Réactiver un utilisateur (admin uniquement)
   *
   * Permet à un utilisateur désactivé de se reconnecter.
   *
   * @param id - ID de l'utilisateur
   * @returns UserResponseDto - Utilisateur réactivé
   * @throws NotFoundException si utilisateur n'existe pas
   */
  async reactivateUser(id: string): Promise<UserResponseDto> {
    this.logger.log(`✅ AdminService.reactivateUser: ${id}`);

    try {
      // Vérifier que l'utilisateur existe
      const existingUser = await this.profileService.findById(id);
      if (!existingUser) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // UPDATE cst_activ = '1'
      const { data, error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update({
          cst_activ: '1',
          cst_updated_at: new Date().toISOString(),
        })
        .eq('cst_id', id)
        .select()
        .single();

      if (error) {
        this.logger.error('❌ Erreur réactivation utilisateur:', error);
        throw new HttpException(
          'Erreur lors de la réactivation',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Invalider le cache
      await this.profileService.invalidateCachedProfile(id);

      // Retourner utilisateur réactivé
      const reactivatedUser: UserResponseDto = {
        id: data.cst_id,
        email: data.cst_mail,
        firstName: data.cst_fname,
        lastName: data.cst_name,
        isPro: data.cst_pro === '1',
        isActive: data.cst_activ === '1',
        createdAt: new Date(data.cst_created_at),
        updatedAt: new Date(data.cst_updated_at),
      };

      this.logger.log(`✅ Utilisateur réactivé: ${id}`);
      return reactivatedUser;
    } catch (error: any) {
      this.logger.error('❌ Erreur réactivation utilisateur:', error);
      throw error;
    }
  }

  // ========== SUPPRESSION DÉFINITIVE ==========

  /**
   * Supprimer définitivement un utilisateur (soft delete)
   *
   * Désactive l'utilisateur (cst_activ='0'). Les données ne sont PAS supprimées physiquement
   * pour des raisons de conformité (RGPD, audit, historique).
   *
   * Note: Peut être appelé par admin OU par l'utilisateur lui-même (droit RGPD à l'oubli).
   *
   * @param id - ID de l'utilisateur à supprimer
   * @returns boolean - true si succès
   * @throws NotFoundException si utilisateur n'existe pas
   */
  async deleteUserSoft(id: string): Promise<boolean> {
    this.logger.log(`🗑️ AdminService.deleteUserSoft: ${id}`);

    try {
      // Vérifier que l'utilisateur existe
      const existingUser = await this.profileService.findById(id);
      if (!existingUser) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Soft delete: UPDATE cst_activ = '0'
      const { error } = await this.supabase
        .from(TABLES.xtr_customer)
        .update({
          cst_activ: '0',
          cst_updated_at: new Date().toISOString(),
        })
        .eq('cst_id', id);

      if (error) {
        this.logger.error('❌ Erreur soft delete utilisateur:', error);
        throw new HttpException(
          "Erreur lors de la suppression de l'utilisateur",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Invalider le cache
      await this.profileService.invalidateCachedProfile(id);

      this.logger.log(`✅ Utilisateur supprimé (soft delete): ${id}`);
      return true;
    } catch (error: any) {
      this.logger.error('❌ Erreur suppression utilisateur:', error);
      throw error;
    }
  }
}
