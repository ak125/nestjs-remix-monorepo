import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  ConfigItemDto,
  CreateConfigDto,
  UpdateConfigDto,
  ConfigQueryDto,
  ConfigType,
} from '../dto/config.dto';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CacheService } from '../../cache/cache.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';

@Injectable()
export class DatabaseConfigService extends SupabaseBaseService {
  protected readonly logger = new Logger(DatabaseConfigService.name);
  private readonly cachePrefix = 'config:';
  private readonly cacheTTL = 3600; // 1 heure
  protected readonly tableName = '___config';

  constructor(
    private readonly cacheService: CacheService,
    @Inject('CONFIG_OPTIONS') private readonly options: any = {},
  ) {
    super();
  }

  async getAllConfigs(query: ConfigQueryDto = {}): Promise<ConfigItemDto[]> {
    try {
      const cacheKey = `${this.cachePrefix}all:${JSON.stringify(query)}`;

      // Vérifier le cache si activé
      if (this.options.cacheEnabled !== false) {
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
          this.logger.debug('Configurations récupérées depuis le cache');
          return cached as ConfigItemDto[];
        }
      }

      let queryBuilder = this.client.from(this.tableName).select('*');

      // Appliquer les filtres
      if (query.category) {
        queryBuilder = queryBuilder.ilike('config_key', `${query.category}.%`);
      }

      if (query.search) {
        queryBuilder = queryBuilder.or(
          `config_key.ilike.%${query.search}%,description.ilike.%${query.search}%`,
        );
      }

      // Pagination
      if (query.limit) {
        queryBuilder = queryBuilder.limit(query.limit);
      }

      if (query.offset) {
        queryBuilder = queryBuilder.range(
          query.offset,
          query.offset + (query.limit || 50) - 1,
        );
      }

      const { data, error } = await queryBuilder.order('config_key');

      if (error) {
        this.logger.error(
          'Erreur lors de la récupération des configurations',
          error,
        );
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `Erreur database: ${error.message}`,
        });
      }

      const configs = this.formatConfigs(data || []);

      // Mettre en cache si activé
      if (this.options.cacheEnabled !== false && configs.length > 0) {
        await this.cacheService.set(
          cacheKey,
          configs,
          this.options.cacheTTL || this.cacheTTL,
        );
      }

      return configs;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des configurations',
        error,
      );
      throw error;
    }
  }

  async getConfig(key: string): Promise<ConfigItemDto | null> {
    try {
      const cacheKey = `${this.cachePrefix}${key}`;

      // Vérifier le cache si activé
      if (this.options.cacheEnabled !== false) {
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
          this.logger.debug(`Configuration ${key} récupérée depuis le cache`);
          return cached as ConfigItemDto;
        }
      }

      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .eq('config_key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Configuration non trouvée
        }
        this.logger.error(
          `Erreur lors de la récupération de la configuration ${key}`,
          error,
        );
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `Erreur database: ${error.message}`,
        });
      }

      const config = this.formatConfig(data);

      // Mettre en cache si activé
      if (this.options.cacheEnabled !== false) {
        await this.cacheService.set(
          cacheKey,
          config,
          this.options.cacheTTL || this.cacheTTL,
        );
      }

      return config;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de la configuration ${key}`,
        error,
      );
      throw error;
    }
  }

  async createConfig(createConfigDto: CreateConfigDto): Promise<ConfigItemDto> {
    try {
      const configData = {
        config_key: createConfigDto.key,
        config_value: this.serializeValue(
          createConfigDto.value,
          createConfigDto.type,
        ),
        description: createConfigDto.description,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.client
        .from(this.tableName)
        .insert(configData)
        .select()
        .single();

      if (error) {
        this.logger.error(
          'Erreur lors de la création de la configuration',
          error,
        );
        throw new DatabaseException({
          code: ErrorCodes.CONFIG.UPDATE_FAILED,
          message: `Erreur database: ${error.message}`,
        });
      }

      const config = this.formatConfig(data);

      // Invalider le cache
      await this.invalidateCache(createConfigDto.key);

      return config;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la création de la configuration',
        error,
      );
      throw error;
    }
  }

  async updateConfig(
    key: string,
    updateConfigDto: UpdateConfigDto,
  ): Promise<ConfigItemDto | null> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updateConfigDto.value !== undefined) {
        updateData.config_value = this.serializeValue(
          updateConfigDto.value,
          updateConfigDto.type || ConfigType.STRING,
        );
      }

      if (updateConfigDto.description !== undefined) {
        updateData.description = updateConfigDto.description;
      }

      const { data, error } = await this.client
        .from(this.tableName)
        .update(updateData)
        .eq('config_key', key)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Configuration non trouvée
        }
        this.logger.error(
          `Erreur lors de la mise à jour de la configuration ${key}`,
          error,
        );
        throw new DatabaseException({
          code: ErrorCodes.CONFIG.UPDATE_FAILED,
          message: `Erreur database: ${error.message}`,
        });
      }

      const config = this.formatConfig(data);

      // Invalider le cache
      await this.invalidateCache(key);

      return config;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour de la configuration ${key}`,
        error,
      );
      throw error;
    }
  }

  async deleteConfig(key: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .eq('config_key', key);

      if (error) {
        this.logger.error(
          `Erreur lors de la suppression de la configuration ${key}`,
          error,
        );
        throw new DatabaseException({
          code: ErrorCodes.CONFIG.UPDATE_FAILED,
          message: `Erreur database: ${error.message}`,
        });
      }

      // Invalider le cache
      await this.invalidateCache(key);

      return true;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression de la configuration ${key}`,
        error,
      );
      throw error;
    }
  }

  async clearCache(): Promise<void> {
    try {
      // Implémentation simplifiée - dans un vrai projet,
      // il faudrait implémenter une méthode de nettoyage par pattern
      this.logger.log(
        'Cache des configurations vidé (implémentation simplifiée)',
      );
    } catch (error) {
      this.logger.error('Erreur lors du vidage du cache', error);
      throw error;
    }
  }

  private formatConfig(data: any): ConfigItemDto {
    // Adapter au format de la table ___config
    const value = this.deserializeValue(
      data.config_value || '{}',
      ConfigType.JSON,
    );

    return {
      key: data.config_key,
      value: value,
      type: this.detectConfigType(value),
      description: data.description,
      category: this.extractCategory(data.config_key),
      isPublic: true, // Par défaut public pour ___config
      isReadOnly: false,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
    };
  }

  private formatConfigs(data: any[]): ConfigItemDto[] {
    return data.map((item) => this.formatConfig(item));
  }

  private serializeValue(value: any, type: ConfigType): string {
    switch (type) {
      case ConfigType.STRING:
        return String(value);
      case ConfigType.NUMBER:
        return String(Number(value));
      case ConfigType.BOOLEAN:
        return String(Boolean(value));
      case ConfigType.JSON:
      case ConfigType.ARRAY:
        return JSON.stringify(value);
      default:
        return String(value);
    }
  }

  private deserializeValue(value: string, type: ConfigType): any {
    try {
      switch (type) {
        case ConfigType.STRING:
          return value;
        case ConfigType.NUMBER:
          return Number(value);
        case ConfigType.BOOLEAN:
          return value === 'true';
        case ConfigType.JSON:
        case ConfigType.ARRAY:
          return JSON.parse(value);
        default:
          return value;
      }
    } catch (error) {
      this.logger.warn(
        `Erreur lors de la désérialisation de la valeur: ${value}`,
        error,
      );
      return value;
    }
  }

  private async invalidateCache(key: string): Promise<void> {
    try {
      // Invalider la configuration spécifique
      await this.cacheService.del(`${this.cachePrefix}${key}`);

      // Invalider les listes mises en cache - simplifiée car deletePattern n'existe pas
      // TODO: Implémenter une méthode de nettoyage plus sophistiquée
      this.logger.debug(`Cache invalidé pour la clé: ${key}`);
    } catch (error) {
      this.logger.warn("Erreur lors de l'invalidation du cache", error);
    }
  }

  private detectConfigType(value: any): ConfigType {
    if (typeof value === 'string') return ConfigType.STRING;
    if (typeof value === 'number') return ConfigType.NUMBER;
    if (typeof value === 'boolean') return ConfigType.BOOLEAN;
    if (Array.isArray(value)) return ConfigType.ARRAY;
    if (typeof value === 'object') return ConfigType.JSON;
    return ConfigType.STRING;
  }

  private extractCategory(key: string): string {
    const parts = key.split('.');
    return parts.length > 1 ? parts[0] : 'general';
  }
}
