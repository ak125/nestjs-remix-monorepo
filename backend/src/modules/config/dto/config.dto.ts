import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum, IsObject } from 'class-validator';

export enum ConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  ARRAY = 'array',
}

export class ConfigItemDto {
  @ApiProperty({ description: 'Clé de configuration unique' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Valeur de la configuration' })
  value: any;

  @ApiProperty({ enum: ConfigType, description: 'Type de la configuration' })
  @IsEnum(ConfigType)
  type: ConfigType;

  @ApiPropertyOptional({ description: 'Description de la configuration' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Catégorie de la configuration' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Configuration publique ou privée' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Configuration en lecture seule' })
  @IsOptional()
  @IsBoolean()
  isReadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Date de création' })
  createdAt?: Date;

  @ApiPropertyOptional({ description: 'Date de dernière modification' })
  updatedAt?: Date;
}

export class CreateConfigDto {
  @ApiProperty({ description: 'Clé de configuration unique' })
  @IsString()
  key: string;

  @ApiProperty({ description: 'Valeur de la configuration' })
  value: any;

  @ApiProperty({ enum: ConfigType, description: 'Type de la configuration' })
  @IsEnum(ConfigType)
  type: ConfigType;

  @ApiPropertyOptional({ description: 'Description de la configuration' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Catégorie de la configuration' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Configuration publique ou privée', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Configuration en lecture seule', default: false })
  @IsOptional()
  @IsBoolean()
  isReadOnly?: boolean;
}

export class UpdateConfigDto {
  @ApiPropertyOptional({ description: 'Nouvelle valeur de la configuration' })
  @IsOptional()
  value?: any;

  @ApiPropertyOptional({ enum: ConfigType, description: 'Type de la configuration' })
  @IsOptional()
  @IsEnum(ConfigType)
  type?: ConfigType;

  @ApiPropertyOptional({ description: 'Description de la configuration' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Catégorie de la configuration' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Configuration publique ou privée' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Configuration en lecture seule' })
  @IsOptional()
  @IsBoolean()
  isReadOnly?: boolean;
}

export class ConfigQueryDto {
  @ApiPropertyOptional({ description: 'Filtrer par catégorie' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filtrer par type' })
  @IsOptional()
  @IsEnum(ConfigType)
  type?: ConfigType;

  @ApiPropertyOptional({ description: 'Afficher uniquement les configurations publiques' })
  @IsOptional()
  @IsBoolean()
  publicOnly?: boolean;

  @ApiPropertyOptional({ description: 'Recherche textuelle' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Nombre d\'éléments par page' })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: 'Décalage pour la pagination' })
  @IsOptional()
  offset?: number;
}
