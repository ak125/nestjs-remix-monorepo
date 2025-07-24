/**
 * DTOs pour le module Users - Version complète migrée depuis ecommerce-api
 * Utilise les schémas Zod pour la validation
 */

import {
  RegisterDto,
  LoginDto,
  UpdateProfileDto,
  UpdateAddressDto,
  UserMessageDto,
  ResetPasswordDto,
  ConfirmResetPasswordDto,
  SearchUsersDto,
} from '../schemas/users.schemas';

// Import du bon UserResponseDto avec toutes les propriétés
import { UserResponseDto, transformUserToResponse } from './user-response.dto';

// Export des types depuis les schémas Zod
export {
  RegisterDto,
  LoginDto,
  UpdateProfileDto,
  UpdateAddressDto,
  UserMessageDto,
  ResetPasswordDto,
  ConfirmResetPasswordDto,
  SearchUsersDto,
  UserResponseDto,
  transformUserToResponse,
};

export interface AddressDto {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface LoginResponseDto {
  user: UserResponseDto;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface PaginatedUsersResponseDto {
  users: UserResponseDto[];
  total: number;
  page: number;
  limit: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// DTOs pour compatibilité avec l'interface admin existante
export interface CreateUserDto {
  email: string;
  name: string;
  password: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  isPro?: boolean;
}
