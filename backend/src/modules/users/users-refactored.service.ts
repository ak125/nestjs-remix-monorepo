/**
 * Service Users refactorisé - Architecture clean
 * Coordonne les services spécialisés et expose une API unifiée
 */

import { Injectable } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { UserProfileService } from './services/user-profile.service';
import { UserAdminService } from './services/user-admin.service';
import {
  RegisterDto,
  LoginDto,
  UpdateProfileDto,
  UpdateAddressDto,
  SearchUsersDto,
  UserResponseDto,
  LoginResponseDto,
  PaginatedUsersResponseDto,
  ResetPasswordDto,
  ConfirmResetPasswordDto,
} from './dto/users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserProfileDto } from './dto/user-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly authService: AuthService,
    private readonly userProfileService: UserProfileService,
    private readonly userAdminService: UserAdminService,
  ) {}

  // ========== MÉTHODES D'AUTHENTIFICATION ==========
  // Délègue vers AuthService

  async register(registerDto: RegisterDto): Promise<UserResponseDto> {
    return this.authService.register(registerDto);
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  async requestPasswordReset(resetDto: ResetPasswordDto): Promise<boolean> {
    return this.authService.requestPasswordReset(resetDto);
  }

  async confirmPasswordReset(confirmDto: ConfirmResetPasswordDto): Promise<boolean> {
    return this.authService.confirmPasswordReset(confirmDto);
  }

  async validateToken(token: string): Promise<UserResponseDto | null> {
    return this.authService.validateToken(token);
  }

  async logout(userId: string): Promise<boolean> {
    return this.authService.logout(userId);
  }

  // ========== MÉTHODES DE PROFIL ==========
  // Délègue vers UserProfileService

  async getProfile(userId: string): Promise<UserProfileDto> {
    return this.userProfileService.getProfile(userId);
  }

  async updateProfile(userId: string, updateDto: UpdateProfileDto): Promise<UserResponseDto> {
    return this.userProfileService.updateProfile(userId, updateDto);
  }

  async updateAddress(userId: string, addressDto: UpdateAddressDto): Promise<boolean> {
    return this.userProfileService.updateAddress(userId, addressDto);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<boolean> {
    return this.userProfileService.changePassword(userId, changePasswordDto);
  }

  async updatePreferences(
    userId: string,
    preferences: {
      language?: string;
      newsletter?: boolean;
      notifications?: boolean;
    },
  ): Promise<boolean> {
    return this.userProfileService.updatePreferences(userId, preferences);
  }

  async uploadAvatar(userId: string, avatarFile: Express.Multer.File): Promise<string> {
    return this.userProfileService.uploadAvatar(userId, avatarFile);
  }

  // ========== MÉTHODES D'ADMINISTRATION ==========
  // Délègue vers UserAdminService

  async getAllUsers(
    page: number = 1,
    limit: number = 20,
    searchDto?: SearchUsersDto,
    currentUser?: any,
  ): Promise<PaginatedUsersResponseDto> {
    return this.userAdminService.getAllUsers(page, limit, searchDto, currentUser);
  }

  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.userAdminService.createUser(createUserDto);
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    return this.userAdminService.updateUser(id, updateUserDto);
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.userAdminService.deleteUser(id);
  }

  async updateUserLevel(id: string, level: number): Promise<UserResponseDto> {
    return this.userAdminService.updateUserLevel(id, level);
  }

  async reactivateUser(id: string): Promise<UserResponseDto> {
    return this.userAdminService.reactivateUser(id);
  }

  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    pro: number;
    byLevel: Record<number, number>;
  }> {
    return this.userAdminService.getUserStats();
  }

  async bulkDeactivateUsers(userIds: string[]): Promise<number> {
    return this.userAdminService.bulkDeactivateUsers(userIds);
  }

  // ========== MÉTHODES DE COMPATIBILITÉ ==========
  // Pour maintenir la compatibilité avec l'existant

  /**
   * @deprecated Utiliser getProfile à la place
   */
  async getUserProfile(id: string): Promise<UserProfileDto> {
    console.warn('⚠️ getUserProfile est déprécié, utiliser getProfile');
    return this.getProfile(id);
  }

  /**
   * @deprecated Utiliser getAllUsers avec des filtres à la place
   */
  async searchUsers(searchDto: SearchUsersDto): Promise<PaginatedUsersResponseDto> {
    console.warn('⚠️ searchUsers est déprécié, utiliser getAllUsers avec searchDto');
    return this.getAllUsers(1, 20, searchDto);
  }

  /**
   * @deprecated Utiliser getAllUsers avec filtres à la place
   */
  async getActiveUsers(page: number = 1, limit: number = 20): Promise<PaginatedUsersResponseDto> {
    console.warn('⚠️ getActiveUsers est déprécié, utiliser getAllUsers avec filtres');
    const searchDto: SearchUsersDto = { isActive: true };
    return this.getAllUsers(page, limit, searchDto);
  }

  /**
   * @deprecated Utiliser getAllUsers avec filtres à la place
   */
  async getUsersByLevel(level: number): Promise<UserResponseDto[]> {
    console.warn('⚠️ getUsersByLevel est déprécié, utiliser getAllUsers avec filtres');
    const result = await this.getAllUsers(1, 1000, { level });
    return result.users;
  }

  /**
   * @deprecated Utiliser updateUser à la place
   */
  async deactivateUser(id: string, reason?: string): Promise<boolean> {
    console.warn('⚠️ deactivateUser est déprécié, utiliser deleteUser');
    if (reason) {
      console.log(`Raison de désactivation: ${reason}`);
    }
    return this.deleteUser(id);
  }
}
