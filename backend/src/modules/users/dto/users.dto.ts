/**
 * DTOs pour le module Users - Version complète migrée depuis ecommerce-api
 * Utilise les schémas Zod pour la validation
 */

import {
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

// Note: CreateUserDto est maintenant dans create-user.dto.ts (version Zod complète)
// L'interface simple ci-dessous était un doublon et a été supprimée
