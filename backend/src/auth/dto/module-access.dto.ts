// backend/src/auth/dto/module-access.dto.ts
// DTOs pour les endpoints de permissions optimisés

export interface ModuleAccessDto {
  userId: string;
  module: string;
  action?: string;
}

export interface BulkModuleAccessDto {
  userId: string;
  modules: ModuleAccessItemDto[];
}

export interface ModuleAccessItemDto {
  module: string;
  action?: string;
}

export interface AccessLogDto {
  userId: string;
  action: string;
  resource: string;
  module: string;
  statusCode: number;
  timestamp?: string;
}

export interface TokenValidationDto {
  token: string;
}

export interface ModuleAccessResult {
  hasAccess: boolean;
  reason?: string;
  requiredRole?: string;
}
