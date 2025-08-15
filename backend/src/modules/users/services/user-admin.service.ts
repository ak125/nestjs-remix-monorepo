/**
 * Service d'administration des utilisateurs
 * Responsabilité unique : Gestion CRUD admin, niveaux, et opérations en masse
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { UserDataService } from '../../../database/services/user-data.service';
import { CacheService } from '../../../cache/cache.service';
import {
  CreateUserDto,
  UpdateUserDto,
  SearchUsersDto,
  UserResponseDto,
  PaginatedUsersResponseDto,
} from '../dto/users.dto';
import { CreateUserDto as CreateUserControllerDto } from '../dto/create-user.dto';

@Injectable()
export class UserAdminService extends SupabaseBaseService {
  constructor(
    configService: ConfigService,
    private readonly userDataService: UserDataService,
    private readonly cacheService: CacheService,
  ) {
    super(configService);
  }

  /**
   * Récupérer tous les utilisateurs avec pagination et filtres
   */
  async getAllUsers(
    page: number = 1,
    limit: number = 20,
    searchDto?: SearchUsersDto,
    currentUser?: any,
  ): Promise<PaginatedUsersResponseDto> {
    console.log('📋 UserAdminService.getAllUsers:', { page, limit, searchDto });

    try {
      // Calculer l'offset
      const offset = (page - 1) * limit;

      // Construire les filtres
      const filters: any = {};
      if (searchDto?.email) filters.email = searchDto.email;
      if (searchDto?.isActive !== undefined) filters.is_active = searchDto.isActive;
      if (searchDto?.isPro !== undefined) filters.is_pro = searchDto.isPro;
      if (searchDto?.level !== undefined) filters.level = searchDto.level;

      // Récupérer les utilisateurs depuis la base
      const { users, total } = await this.userDataService.findUsersWithFilters(
        filters,
        offset,
        limit,
        searchDto?.sortBy || 'created_at',
        searchDto?.sortOrder || 'desc',
      );

      // Convertir au format de réponse
      const formattedUsers: UserResponseDto[] = users.map((user) => ({
        id: String(user.id),
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        isPro: user.is_pro,
        isActive: user.is_active,
        level: user.level,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: user.last_login_at,
      }));

      const result: PaginatedUsersResponseDto = {
        users: formattedUsers,
        total,
        page,
        limit,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };

      console.log(`✅ ${formattedUsers.length} utilisateurs récupérés sur ${total}`);
      return result;
    } catch (error: any) {
      console.error('❌ Erreur récupération utilisateurs:', error);
      throw new HttpException(
        error?.message || 'Erreur lors de la récupération des utilisateurs',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Créer un nouvel utilisateur (admin uniquement)
   */
  async createUser(createUserDto: CreateUserControllerDto): Promise<UserResponseDto> {
    console.log('➕ UserAdminService.createUser:', createUserDto.email);

    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await this.userDataService.findByEmail(createUserDto.email);
      if (existingUser) {
        throw new ConflictException('Un utilisateur avec cet email existe déjà');
      }

      // Préparer les données utilisateur
      const userData = {
        email: createUserDto.email,
        first_name: createUserDto.firstName,
        last_name: createUserDto.lastName,
        phone: createUserDto.phone,
        password_hash: await this.generateDefaultPassword(),
        is_pro: createUserDto.isPro || false,
        is_active: true,
        level: createUserDto.level || 1,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Créer en base
      const newUser = await this.userDataService.createUser(userData);

      // Convertir au format de réponse
      const userResponse: UserResponseDto = {
        id: String(newUser.id),
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        phone: newUser.phone,
        isPro: newUser.is_pro,
        isActive: newUser.is_active,
        level: newUser.level,
        createdAt: newUser.created_at,
        updatedAt: newUser.updated_at,
      };

      console.log('✅ Utilisateur créé (admin):', userResponse.id);
      return userResponse;
    } catch (error: any) {
      console.error('❌ Erreur création utilisateur (admin):', error);
      throw new HttpException(
        error?.message || "Erreur lors de la création de l'utilisateur",
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mettre à jour un utilisateur (admin)
   */
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    console.log('✏️ UserAdminService.updateUser:', id, updateUserDto);

    try {
      // Vérifier que l'utilisateur existe
      const existingUser = await this.userDataService.findById(parseInt(id));
      if (!existingUser) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Préparer les données à mettre à jour
      const updateData: any = { updated_at: new Date() };

      if (updateUserDto.email) updateData.email = updateUserDto.email;
      if (updateUserDto.name) {
        const nameParts = updateUserDto.name.split(' ');
        updateData.first_name = nameParts[0];
        updateData.last_name = nameParts.slice(1).join(' ');
      }
      if (updateUserDto.phone) updateData.phone = updateUserDto.phone;
      if (updateUserDto.isPro !== undefined) updateData.is_pro = updateUserDto.isPro;
      if (updateUserDto.isActive !== undefined) updateData.is_active = updateUserDto.isActive;
      if (updateUserDto.level !== undefined) updateData.level = updateUserDto.level;

      // Mettre à jour en base
      const updatedUser = await this.userDataService.updateUser(parseInt(id), updateData);

      // Invalider le cache
      await this.cacheService.del(`user_profile_${id}`);

      // Convertir au format de réponse
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

      console.log('✅ Utilisateur mis à jour:', userResponse.email);
      return userResponse;
    } catch (error: any) {
      console.error('❌ Erreur mise à jour utilisateur:', error);
      throw new HttpException(
        error?.message || "Erreur lors de la mise à jour de l'utilisateur",
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Supprimer un utilisateur (désactivation)
   */
  async deleteUser(id: string): Promise<boolean> {
    console.log('🗑️ UserAdminService.deleteUser:', id);

    try {
      const user = await this.userDataService.findById(parseInt(id));
      if (!user) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Désactiver plutôt que supprimer
      await this.userDataService.updateUser(parseInt(id), {
        is_active: false,
        updated_at: new Date(),
      });

      // Invalider le cache
      await this.cacheService.del(`user_profile_${id}`);

      console.log('✅ Utilisateur désactivé:', id);
      return true;
    } catch (error: any) {
      console.error('❌ Erreur suppression utilisateur:', error);
      throw new HttpException(
        error?.message || "Erreur lors de la suppression de l'utilisateur",
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mettre à jour le niveau d'un utilisateur
   */
  async updateUserLevel(id: string, level: number): Promise<UserResponseDto> {
    console.log('🔰 UserAdminService.updateUserLevel:', id, level);

    try {
      if (level < 1 || level > 10) {
        throw new BadRequestException('Le niveau doit être entre 1 et 10');
      }

      const user = await this.userDataService.findById(parseInt(id));
      if (!user) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      const updatedUser = await this.userDataService.updateUser(parseInt(id), {
        level,
        updated_at: new Date(),
      });

      // Invalider le cache
      await this.cacheService.del(`user_profile_${id}`);

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

      console.log('✅ Niveau utilisateur mis à jour:', level);
      return userResponse;
    } catch (error: any) {
      console.error('❌ Erreur mise à jour niveau:', error);
      throw new HttpException(
        error?.message || 'Erreur lors de la mise à jour du niveau',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Réactiver un utilisateur désactivé
   */
  async reactivateUser(id: string): Promise<UserResponseDto> {
    console.log('🔓 UserAdminService.reactivateUser:', id);

    try {
      const user = await this.userDataService.findById(parseInt(id));
      if (!user) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      const updatedUser = await this.userDataService.updateUser(parseInt(id), {
        is_active: true,
        updated_at: new Date(),
      });

      // Invalider le cache
      await this.cacheService.del(`user_profile_${id}`);

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

      console.log('✅ Utilisateur réactivé:', id);
      return userResponse;
    } catch (error: any) {
      console.error('❌ Erreur réactivation utilisateur:', error);
      throw new HttpException(
        error?.message || 'Erreur lors de la réactivation',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtenir les statistiques des utilisateurs
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    pro: number;
    byLevel: Record<number, number>;
  }> {
    console.log('📊 UserAdminService.getUserStats');

    try {
      const stats = await this.userDataService.getUserStatistics();

      console.log('✅ Statistiques récupérées');
      return stats;
    } catch (error: any) {
      console.error('❌ Erreur récupération stats:', error);
      throw new HttpException(
        'Erreur lors de la récupération des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Opération en masse : désactiver plusieurs utilisateurs
   */
  async bulkDeactivateUsers(userIds: string[]): Promise<number> {
    console.log('🔒 UserAdminService.bulkDeactivateUsers:', userIds.length);

    try {
      const numericIds = userIds.map((id) => parseInt(id));
      const result = await this.userDataService.bulkUpdateUsers(numericIds, {
        is_active: false,
        updated_at: new Date(),
      });

      // Invalider les caches
      for (const id of userIds) {
        await this.cacheService.del(`user_profile_${id}`);
      }

      console.log('✅ Utilisateurs désactivés en masse:', result);
      return result;
    } catch (error: any) {
      console.error('❌ Erreur désactivation en masse:', error);
      throw new HttpException(
        'Erreur lors de la désactivation en masse',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ========== MÉTHODES PRIVÉES ==========

  private async generateDefaultPassword(): Promise<string> {
    // Générer un mot de passe temporaire
    const tempPassword = `temp_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    return `hashed_${tempPassword}`;
  }
}
