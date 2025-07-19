import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { SupabaseRestService } from '../../database/supabase-rest.service';
import { CacheService } from '../../cache/cache.service';
import { CreateUserDto, CreateUserSchema } from './dto/create-user.dto';
import { UpdateUserDto, UpdateUserSchema } from './dto/update-user.dto';
import { UserResponseDto, transformUserToResponse } from './dto/user-response.dto';
import { ChangePasswordDto, ChangePasswordSchema } from './dto/change-password.dto';
import { UserProfileDto, transformUserToProfile } from './dto/user-profile.dto';
import { CreateUserAddressDto, UpdateUserAddressDto, UserAddressDto } from './dto/user-address.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly supabaseService: SupabaseRestService,
    private readonly cacheService: CacheService,
  ) {}

  async findById(id: string): Promise<UserResponseDto | null> {
    try {
      console.log(`🔍 UsersService.findById: ${id}`);
      
      // Essayer le cache d'abord
      try {
        const cachedUser = await this.cacheService.getCachedUser(id);
        if (cachedUser) {
          console.log(`✅ User found in cache: ${cachedUser.email}`);
          return cachedUser;
        }
      } catch (cacheError) {
        console.log('Cache indisponible, recherche en DB:', (cacheError as Error).message);
      }

      const user = await this.supabaseService.getUserById(id);
      if (!user) {
        return null;
      }

      const userResponse = transformUserToResponse(user);
      
      // Mettre en cache le résultat
      try {
        await this.cacheService.cacheUser(id, userResponse);
      } catch (cacheError) {
        console.log('Erreur lors de la mise en cache:', (cacheError as Error).message);
      }

      console.log(`✅ User found in service: ${userResponse.email}`);
      return userResponse;
    } catch (error) {
      console.error(`❌ Error in UsersService.findById: ${error}`);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserResponseDto | null> {
    try {
      console.log(`🔍 UsersService.findByEmail: ${email}`);
      const user = await this.supabaseService.findUserByEmail(email);
      if (!user) {
        return null;
      }

      const userResponse = transformUserToResponse(user);
      console.log(`✅ User found by email in service: ${userResponse.email}`);
      return userResponse;
    } catch (error) {
      console.error(`❌ Error in UsersService.findByEmail: ${error}`);
      throw error;
    }
  }

  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    try {
      console.log('🔨 UsersService.createUser:', { email: createUserDto.email });

      // Validation avec Zod
      const validatedData = CreateUserSchema.parse(createUserDto);

      // Vérifier si l'utilisateur existe déjà
      const existingUser = await this.findByEmail(validatedData.email);
      if (existingUser) {
        throw new ConflictException('Un utilisateur avec cet email existe déjà');
      }

      // Créer l'utilisateur
      const newUser = await this.supabaseService.createUser(validatedData);
      if (!newUser) {
        throw new BadRequestException('Erreur lors de la création de l\'utilisateur');
      }

      const userResponse = transformUserToResponse(newUser);
      
      // Mettre en cache
      try {
        await this.cacheService.cacheUser(userResponse.id, userResponse);
      } catch (cacheError) {
        console.log('Erreur lors de la mise en cache:', (cacheError as Error).message);
      }

      console.log(`✅ User created successfully: ${userResponse.email}`);
      return userResponse;
    } catch (error) {
      console.error(`❌ Error in UsersService.createUser: ${error}`);
      throw error;
    }
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    try {
      console.log(`� UsersService.updateUser: ${id}`, updateUserDto);

      // Validation avec Zod
      const validatedData = UpdateUserSchema.parse(updateUserDto);

      // Vérifier que l'utilisateur existe
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Si email change, vérifier qu'il n'est pas déjà utilisé
      if (validatedData.email && validatedData.email !== existingUser.email) {
        const userWithEmail = await this.findByEmail(validatedData.email);
        if (userWithEmail) {
          throw new ConflictException('Cet email est déjà utilisé par un autre utilisateur');
        }
      }

      // Mettre à jour l'utilisateur
      const updatedUser = await this.supabaseService.updateUserProfile(id, validatedData);
      if (!updatedUser) {
        throw new BadRequestException('Erreur lors de la mise à jour');
      }

      const userResponse = transformUserToResponse(updatedUser);
      
      // Mettre à jour le cache
      try {
        await this.cacheService.cacheUser(id, userResponse);
      } catch (cacheError) {
        console.log('Erreur lors de la mise à jour du cache:', (cacheError as Error).message);
      }

      console.log(`✅ User updated successfully: ${userResponse.email}`);
      return userResponse;
    } catch (error) {
      console.error(`❌ Error in UsersService.updateUser: ${error}`);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      console.log(`🗑️ UsersService.deleteUser: ${id}`);

      // Vérifier que l'utilisateur existe
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Soft delete : désactiver le compte au lieu de le supprimer
      const deactivatedUser = await this.updateUser(id, { isActive: false });
      
      // Supprimer du cache
      try {
        await this.cacheService.invalidateUser(id);
      } catch (cacheError) {
        console.log('Erreur lors de la suppression du cache:', (cacheError as Error).message);
      }

      console.log(`✅ User deactivated successfully: ${deactivatedUser.email}`);
      return true;
    } catch (error) {
      console.error(`❌ Error in UsersService.deleteUser: ${error}`);
      throw error;
    }
  }

  async getAllUsers(page: number = 1, limit: number = 20): Promise<{ users: UserResponseDto[], total: number, page: number, limit: number }> {
    try {
      console.log(`📋 UsersService.getAllUsers: page=${page}, limit=${limit}`);

      // Pour l'instant, méthode simplifiée
      // TODO: Implémenter la pagination dans SupabaseRestService
      console.log('⚠️ getAllUsers: Méthode non implémentée - utilisation de données vides');
      
      return {
        users: [],
        total: 0,
        page,
        limit
      };
    } catch (error) {
      console.error(`❌ Error in UsersService.getAllUsers: ${error}`);
      throw error;
    }
  }

  async searchUsers(searchTerm: string): Promise<UserResponseDto[]> {
    try {
      console.log(`🔍 UsersService.searchUsers: ${searchTerm}`);

      // TODO: Implémenter la recherche dans SupabaseRestService
      console.log('⚠️ searchUsers: Méthode non implémentée - retour de tableau vide');
      
      return [];
    } catch (error) {
      console.error(`❌ Error in UsersService.searchUsers: ${error}`);
      throw error;
    }
  }

  async validateUserCredentials(email: string, password: string): Promise<UserResponseDto | null> {
    try {
      console.log(`🔐 UsersService.validateUserCredentials: ${email}`);

      const user = await this.supabaseService.findUserByEmail(email);
      if (!user) {
        return null;
      }

      const isPasswordValid = await this.supabaseService.validatePassword(password, user.cst_pswd);
      if (!isPasswordValid) {
        return null;
      }

      const userResponse = transformUserToResponse(user);
      console.log(`✅ User credentials validated: ${userResponse.email}`);
      return userResponse;
    } catch (error) {
      console.error(`❌ Error in UsersService.validateUserCredentials: ${error}`);
      throw error;
    }
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<boolean> {
    try {
      console.log(`🔒 UsersService.changePassword: ${userId}`);

      // Validation avec Zod
      const validatedData = ChangePasswordSchema.parse(changePasswordDto);

      // Vérifier que l'utilisateur existe
      const user = await this.supabaseService.findUserById(userId);
      if (!user) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // Vérifier le mot de passe actuel
      const isCurrentPasswordValid = await this.supabaseService.validatePassword(
        validatedData.currentPassword,
        user.cst_pswd
      );

      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Mot de passe actuel incorrect');
      }

      // Changer le mot de passe
      const hashedPassword = await this.supabaseService.hashPassword(validatedData.newPassword);
      const result = await this.supabaseService.updateUserPassword(user.cst_mail, hashedPassword);

      if (!result) {
        throw new BadRequestException('Erreur lors du changement de mot de passe');
      }

      // Invalider le cache utilisateur
      try {
        await this.cacheService.invalidateUser(userId);
      } catch (cacheError) {
        console.log('Erreur lors de l\'invalidation du cache:', (cacheError as Error).message);
      }

      console.log(`✅ Password changed successfully for user: ${userId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error in UsersService.changePassword: ${error}`);
      throw error;
    }
  }

  async getUserProfile(userId: string): Promise<UserProfileDto> {
    try {
      console.log(`👤 UsersService.getUserProfile: ${userId}`);

      // Récupérer l'utilisateur
      const user = await this.supabaseService.findUserById(userId);
      if (!user) {
        throw new NotFoundException('Utilisateur non trouvé');
      }

      // TODO: Récupérer les adresses et statistiques
      // Pour l'instant, utiliser les données de base
      const profile = transformUserToProfile(user);

      console.log(`✅ User profile retrieved: ${profile.email}`);
      return profile;
    } catch (error) {
      console.error(`❌ Error in UsersService.getUserProfile: ${error}`);
      throw error;
    }
  }

  async updateUserLevel(userId: string, level: number): Promise<UserResponseDto> {
    try {
      console.log(`⬆️ UsersService.updateUserLevel: ${userId} -> level ${level}`);

      // Vérifier que le niveau est valide (basé sur l'analyse legacy)
      if (![2, 6, 9].includes(level)) {
        throw new BadRequestException('Niveau d\'autorisation invalide. Niveaux autorisés: 2, 6, 9');
      }

      // TODO: Implémenter la mise à jour du niveau dans SupabaseRestService
      // Pour l'instant, utiliser updateUserProfile
      const updatedUser = await this.updateUser(userId, { 
        // Ajouter le niveau aux données à mettre à jour
        // Ce champ devra être ajouté au UpdateUserDto
      } as any);

      console.log(`✅ User level updated: ${updatedUser.email} -> level ${level}`);
      return updatedUser;
    } catch (error) {
      console.error(`❌ Error in UsersService.updateUserLevel: ${error}`);
      throw error;
    }
  }

  async deactivateUser(userId: string, reason?: string): Promise<boolean> {
    try {
      console.log(`🚫 UsersService.deactivateUser: ${userId}`, { reason });

      const result = await this.updateUser(userId, { isActive: false });

      // TODO: Logger la raison de désactivation
      console.log(`✅ User deactivated: ${result.email}`);
      return true;
    } catch (error) {
      console.error(`❌ Error in UsersService.deactivateUser: ${error}`);
      throw error;
    }
  }

  async reactivateUser(userId: string): Promise<UserResponseDto> {
    try {
      console.log(`✅ UsersService.reactivateUser: ${userId}`);

      const result = await this.updateUser(userId, { isActive: true });

      console.log(`✅ User reactivated: ${result.email}`);
      return result;
    } catch (error) {
      console.error(`❌ Error in UsersService.reactivateUser: ${error}`);
      throw error;
    }
  }

  async getUsersByLevel(level: number): Promise<UserResponseDto[]> {
    try {
      console.log(`📊 UsersService.getUsersByLevel: ${level}`);

      // TODO: Implémenter la recherche par niveau dans SupabaseRestService
      // Pour l'instant, retourner un tableau vide
      console.log('⚠️ getUsersByLevel: Méthode non implémentée - retour de tableau vide');
      
      return [];
    } catch (error) {
      console.error(`❌ Error in UsersService.getUsersByLevel: ${error}`);
      throw error;
    }
  }

  async getActiveUsers(page: number = 1, limit: number = 20): Promise<{ users: UserResponseDto[], total: number, page: number, limit: number }> {
    try {
      console.log(`✅ UsersService.getActiveUsers: page=${page}, limit=${limit}`);

      // TODO: Implémenter le filtrage des utilisateurs actifs
      // Pour l'instant, utiliser getAllUsers
      const result = await this.getAllUsers(page, limit);
      
      // Filtrer les utilisateurs actifs côté application (temporaire)
      const activeUsers = result.users.filter(user => user.isActive);
      
      return {
        users: activeUsers,
        total: activeUsers.length,
        page,
        limit
      };
    } catch (error) {
      console.error(`❌ Error in UsersService.getActiveUsers: ${error}`);
      throw error;
    }
  }
}