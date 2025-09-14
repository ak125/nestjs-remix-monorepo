import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';

// Export de l'enum depuis les schémas
export enum ConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  ARRAY = 'array',
}

// Import des schémas et types Zod
import {
  CreateConfigSchema,
  UpdateConfigSchema,
  ConfigQuerySchema,
  ConfigItemSchema,
  type CreateConfigDto as ZodCreateConfigDto,
  type UpdateConfigDto as ZodUpdateConfigDto,
  type ConfigQueryDto as ZodConfigQueryDto,
  type ConfigItemDto as ZodConfigItemDto,
} from '../schemas/config.schemas';

// Classes pour la documentation Swagger (optionnel, mais utile pour l'API)
export class ConfigItemDto implements ZodConfigItemDto {
  @ApiProperty({ description: 'Clé de configuration unique' })
  key: string;

  @ApiProperty({ description: 'Valeur de la configuration' })
  value: any;

  @ApiProperty({ enum: ConfigType, description: 'Type de la configuration' })
  type: ConfigType;

  @ApiPropertyOptional({ description: 'Description de la configuration' })
  description?: string;

  @ApiPropertyOptional({ description: 'Catégorie de la configuration' })
  category?: string;

  @ApiPropertyOptional({ description: 'Configuration publique ou privée' })
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Configuration en lecture seule' })
  isReadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Date de création' })
  createdAt?: Date;

  @ApiPropertyOptional({ description: 'Date de dernière modification' })
  updatedAt?: Date;
}

export class CreateConfigDto implements ZodCreateConfigDto {
  @ApiProperty({ description: 'Clé de configuration unique' })
  key: string;

  @ApiProperty({ description: 'Valeur de la configuration' })
  value: any;

  @ApiProperty({ enum: ConfigType, description: 'Type de la configuration' })
  type: ConfigType;

  @ApiPropertyOptional({ description: 'Description de la configuration' })
  description?: string;

  @ApiPropertyOptional({ description: 'Catégorie de la configuration' })
  category?: string;

  @ApiPropertyOptional({
    description: 'Configuration publique ou privée',
    default: false,
  })
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Configuration en lecture seule',
    default: false,
  })
  isReadOnly?: boolean;
}

export class UpdateConfigDto implements ZodUpdateConfigDto {
  @ApiPropertyOptional({ description: 'Nouvelle valeur de la configuration' })
  value?: any;

  @ApiPropertyOptional({
    enum: ConfigType,
    description: 'Type de la configuration',
  })
  type?: ConfigType;

  @ApiPropertyOptional({ description: 'Description de la configuration' })
  description?: string;

  @ApiPropertyOptional({ description: 'Catégorie de la configuration' })
  category?: string;

  @ApiPropertyOptional({ description: 'Configuration publique ou privée' })
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Configuration en lecture seule' })
  isReadOnly?: boolean;
}

export class ConfigQueryDto implements ZodConfigQueryDto {
  @ApiPropertyOptional({ description: 'Filtrer par catégorie' })
  category?: string;

  @ApiPropertyOptional({ description: 'Filtrer par type' })
  type?: ConfigType;

  @ApiPropertyOptional({
    description: 'Afficher uniquement les configurations publiques',
  })
  publicOnly?: boolean;

  @ApiPropertyOptional({ description: 'Recherche textuelle' })
  search?: string;

  @ApiPropertyOptional({ description: "Nombre d'éléments par page" })
  limit?: number;

  @ApiPropertyOptional({ description: 'Décalage pour la pagination' })
  offset?: number;
}

// Export des schémas Zod pour la validation
export {
  CreateConfigSchema,
  UpdateConfigSchema,
  ConfigQuerySchema,
  ConfigItemSchema,
};

// Types utilitaires
export type ValidatedCreateConfigDto = z.infer<typeof CreateConfigSchema>;
export type ValidatedUpdateConfigDto = z.infer<typeof UpdateConfigSchema>;
export type ValidatedConfigQueryDto = z.infer<typeof ConfigQuerySchema>;
