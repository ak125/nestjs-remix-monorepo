/**
 * Service de gestion des profils utilisateurs
 * Responsabilité unique : CRUD des profils et informations personnelles
 */

import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { UserDataService } from '../../../database/services/user-data.service';
import { CacheService } from '../../../cache/cache.service';
import {
  UpdateProfileDto,
  UpdateAddressDto,
  UserResponseDto,
  UserProfileDto,
} from '../dto/users.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';

@Injectable()
export class UserProfileService extends SupabaseBaseService {
  constructor(
    configService: ConfigService,
    private readonly userDataService: UserDataService,
    private readonly cacheService: CacheService,
  ) {
    super(configService);
  }

  /**
   * Récupérer le profil complet d'un utilisateur
   */
  async getProfile(userId: string): Promise<UserProfileDto> {
    console.log('👤 UserProfileService.getProfile:', userId);

    try {
      // Récupérer depuis le cache d'abord
      const cacheKey = `user_profile_${userId}`;
      const cachedProfile = await this.cacheService.get(cacheKey);
      if (cachedProfile) {
        console.log('✅ Profil récupéré depuis le cache');
        return cachedProfile;
      }

      // Récupérer depuis la base de données
      const user = await this.userDataService.findById(parseInt(userId));
      if (!user) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Récupérer les informations additionnelles
      const address = await this.userDataService.getUserAddress(parseInt(userId));
      const preferences = await this.userDataService.getUserPreferences(parseInt(userId));

      const profile: UserProfileDto = {
        id: String(user.id),
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        isPro: user.is_pro,
        isActive: user.is_active,
        level: user.level,
        avatar: user.avatar_url,
        dateOfBirth: user.date_of_birth,
        gender: user.gender,
        address: address ? {
          street: address.street,
          city: address.city,
          postalCode: address.postal_code,
          country: address.country,
          isDefault: address.is_default,
        } : null,
        preferences: preferences ? {
          language: preferences.language,
          newsletter: preferences.newsletter,
          notifications: preferences.notifications,
        } : null,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      };

      // Mettre en cache
      await this.cacheService.set(cacheKey, profile, 3600); // 1h

      console.log('✅ Profil récupéré:', user.email);
      return profile;
    } catch (error: any) {
      console.error('❌ Erreur récupération profil:', error);
      throw new HttpException(
        error?.message || 'Erreur lors de la récupération du profil',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mettre à jour le profil de base
   */
  async updateProfile(
    userId: string,
    updateDto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    console.log('✏️ UserProfileService.updateProfile:', userId, updateDto);

    try {
      // Vérifier que l'utilisateur existe
      const existingUser = await this.userDataService.findById(parseInt(userId));
      if (!existingUser) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Préparer les données à mettre à jour
      const updateData: Partial<any> = {
        updated_at: new Date(),
      };

      if (updateDto.firstName) updateData.first_name = updateDto.firstName;
      if (updateDto.lastName) updateData.last_name = updateDto.lastName;
      if (updateDto.phone) updateData.phone = updateDto.phone;
      if (updateDto.dateOfBirth) updateData.date_of_birth = updateDto.dateOfBirth;
      if (updateDto.gender) updateData.gender = updateDto.gender;

      // Mettre à jour en base
      const updatedUser = await this.userDataService.updateUser(
        parseInt(userId),
        updateData,
      );

      // Invalider le cache
      await this.cacheService.del(`user_profile_${userId}`);

      // Retourner la réponse formatée
      const userResponse: UserResponseDto = {
        id: String(updatedUser.id),
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
        isPro: updatedUser.is_pro,
        isActive: updatedUser.is_active,
        level: updatedUser.level,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at,
      };

      console.log('✅ Profil mis à jour:', updatedUser.email);
      return userResponse;
    } catch (error: any) {
      console.error('❌ Erreur mise à jour profil:', error);
      throw new HttpException(
        error?.message || 'Erreur lors de la mise à jour du profil',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mettre à jour l'adresse utilisateur
   */
  async updateAddress(
    userId: string,
    addressDto: UpdateAddressDto,
  ): Promise<boolean> {
    console.log('🏠 UserProfileService.updateAddress:', userId);

    try {
      // Vérifier que l'utilisateur existe
      const user = await this.userDataService.findById(parseInt(userId));
      if (!user) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Mettre à jour ou créer l'adresse
      const addressData = {
        user_id: parseInt(userId),
        street: addressDto.street,
        city: addressDto.city,
        postal_code: addressDto.postalCode,
        country: addressDto.country,
        is_default: true,
        updated_at: new Date(),
      };

      await this.userDataService.upsertUserAddress(addressData);

      // Invalider le cache du profil
      await this.cacheService.del(`user_profile_${userId}`);

      console.log('✅ Adresse mise à jour');
      return true;
    } catch (error: any) {
      console.error('❌ Erreur mise à jour adresse:', error);
      throw new HttpException(
        error?.message || "Erreur lors de la mise à jour de l'adresse",
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Changer le mot de passe
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<boolean> {
    console.log('🔐 UserProfileService.changePassword:', userId);

    try {
      // Récupérer l'utilisateur avec le mot de passe
      const user = await this.userDataService.findById(parseInt(userId));
      if (!user) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Vérifier l'ancien mot de passe
      const isOldPasswordValid = await this.verifyPassword(
        changePasswordDto.currentPassword,
        user.password_hash,
      );
      if (!isOldPasswordValid) {
        throw new HttpException(
          'Mot de passe actuel incorrect',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Hasher le nouveau mot de passe
      const hashedNewPassword = await this.hashPassword(
        changePasswordDto.newPassword,
      );

      // Mettre à jour en base
      await this.userDataService.updatePassword(
        parseInt(userId),
        hashedNewPassword,
      );

      console.log('✅ Mot de passe changé');
      return true;
    } catch (error: any) {
      console.error('❌ Erreur changement mot de passe:', error);
      throw new HttpException(
        error?.message || 'Erreur lors du changement de mot de passe',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mettre à jour les préférences utilisateur
   */
  async updatePreferences(
    userId: string,
    preferences: {
      language?: string;
      newsletter?: boolean;
      notifications?: boolean;
    },
  ): Promise<boolean> {
    console.log('⚙️ UserProfileService.updatePreferences:', userId);

    try {
      await this.userDataService.updateUserPreferences(
        parseInt(userId),
        preferences,
      );

      // Invalider le cache du profil
      await this.cacheService.del(`user_profile_${userId}`);

      console.log('✅ Préférences mises à jour');
      return true;
    } catch (error: any) {
      console.error('❌ Erreur mise à jour préférences:', error);
      throw new HttpException(
        'Erreur lors de la mise à jour des préférences',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Uploader un avatar
   */
  async uploadAvatar(userId: string, avatarFile: Express.Multer.File): Promise<string> {
    console.log('📸 UserProfileService.uploadAvatar:', userId);

    try {
      // TODO: Implémenter l'upload vers un service de stockage (S3, Cloudinary, etc.)
      const avatarUrl = `https://avatars.example.com/${userId}/${Date.now()}.jpg`;

      // Mettre à jour l'URL en base
      await this.userDataService.updateUser(parseInt(userId), {
        avatar_url: avatarUrl,
        updated_at: new Date(),
      });

      // Invalider le cache
      await this.cacheService.del(`user_profile_${userId}`);

      console.log('✅ Avatar uploadé:', avatarUrl);
      return avatarUrl;
    } catch (error: any) {
      console.error('❌ Erreur upload avatar:', error);
      throw new HttpException(
        "Erreur lors de l'upload de l'avatar",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ========== MÉTHODES PRIVÉES ==========

  private async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    // TODO: Implémenter la vérification avec bcrypt
    return hash.includes(password);
  }

  private async hashPassword(password: string): Promise<string> {
    // TODO: Implémenter le hashage avec bcrypt
    return `hashed_${password}_${Date.now()}`;
  }
}
