import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { z } from 'zod';

// Schémas Zod pour la validation
const ConfigValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.object({}).passthrough(),
  z.array(z.any()),
]);

const CreateConfigSchema = z.object({
  key: z.string().min(1, 'La clé est obligatoire'),
  value: ConfigValueSchema,
  category: z.string().optional().default('general'),
  description: z.string().optional(),
  isSensitive: z.boolean().optional().default(false),
  type: z
    .enum(['string', 'number', 'boolean', 'json'])
    .optional()
    .default('string'),
});

const UpdateConfigSchema = z.object({
  value: ConfigValueSchema.optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  isSensitive: z.boolean().optional(),
});

const ConfigQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  sensitive: z.boolean().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
});

type CreateConfigDto = z.infer<typeof CreateConfigSchema>;
type UpdateConfigDto = z.infer<typeof UpdateConfigSchema>;
type ConfigQueryDto = z.infer<typeof ConfigQuerySchema>;

interface ConfigItem {
  key: string;
  value: any;
  category: string;
  description?: string;
  isSensitive: boolean;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

@ApiTags('Configuration')
@Controller('api/admin/configuration')
export class ConfigController {
  private readonly logger = new Logger(ConfigController.name);
  private readonly configs = new Map<string, ConfigItem>();
  private readonly cache = new Map<string, { value: any; expiry: number }>();
  private readonly analytics = {
    reads: 0,
    writes: 0,
    cachehits: 0,
    errors: 0,
  };

  constructor() {
    // Initialiser quelques configurations par défaut
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs() {
    const defaults: Omit<ConfigItem, 'createdAt' | 'updatedAt'>[] = [
      {
        key: 'database.url',
        value: 'postgresql://localhost:5432/auto_parts',
        category: 'database',
        description: 'URL de connexion à la base de données',
        isSensitive: true,
        type: 'string',
      },
      {
        key: 'app.debug',
        value: false,
        category: 'app',
        description: "Mode debug de l'application",
        isSensitive: false,
        type: 'boolean',
      },
      {
        key: 'cache.ttl',
        value: 3600,
        category: 'cache',
        description: 'Durée de vie du cache en secondes',
        isSensitive: false,
        type: 'number',
      },
      {
        key: 'api.limits',
        value: { requests: 1000, window: 3600 },
        category: 'api',
        description: "Limites de l'API",
        isSensitive: false,
        type: 'json',
      },
    ];

    defaults.forEach((config) => {
      this.configs.set(config.key, {
        ...config,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  }

  private getCachedValue(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      this.analytics.cachehits++;
      return cached.value;
    }
    return null;
  }

  private setCachedValue(key: string, value: any, ttlSeconds: number = 300) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  private encryptSensitiveValue(value: any): string {
    // Simulation de chiffrement (en production, utiliser un vrai système de chiffrement)
    return Buffer.from(JSON.stringify(value)).toString('base64');
  }

  private decryptSensitiveValue(encryptedValue: string): any {
    // Simulation de déchiffrement
    try {
      return JSON.parse(Buffer.from(encryptedValue, 'base64').toString());
    } catch {
      return encryptedValue;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer toutes les configurations' })
  @ApiResponse({
    status: 200,
    description: 'Configurations récupérées avec succès',
  })
  async getAllConfigs(@Query() query: ConfigQueryDto) {
    try {
      this.analytics.reads++;

      // Valider les paramètres de requête
      const validatedQuery = ConfigQuerySchema.parse(query);

      // Récupérer toutes les configurations
      let configs = Array.from(this.configs.values());

      // Filtrer par catégorie
      if (validatedQuery.category) {
        configs = configs.filter(
          (config) => config.category === validatedQuery.category,
        );
      }

      // Filtrer par recherche
      if (validatedQuery.search) {
        const searchTerm = validatedQuery.search.toLowerCase();
        configs = configs.filter(
          (config) =>
            config.key.toLowerCase().includes(searchTerm) ||
            config.description?.toLowerCase().includes(searchTerm),
        );
      }

      // Filtrer par sensibilité
      if (validatedQuery.sensitive !== undefined) {
        configs = configs.filter(
          (config) => config.isSensitive === validatedQuery.sensitive,
        );
      }

      // Pagination
      const start = (validatedQuery.page - 1) * validatedQuery.limit;
      const end = start + validatedQuery.limit;
      const paginatedConfigs = configs.slice(start, end);

      // Masquer les valeurs sensibles pour les utilisateurs non autorisés
      const safeConfigs = paginatedConfigs.map((config) => ({
        ...config,
        value: config.isSensitive ? '[MASKED]' : config.value,
      }));

      return {
        success: true,
        data: safeConfigs,
        pagination: {
          page: validatedQuery.page,
          limit: validatedQuery.limit,
          total: configs.length,
          pages: Math.ceil(configs.length / validatedQuery.limit),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.analytics.errors++;
      this.logger.error(
        'Erreur lors de la récupération des configurations',
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des configurations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':key')
  @ApiOperation({ summary: 'Récupérer une configuration par clé' })
  @ApiResponse({
    status: 200,
    description: 'Configuration récupérée avec succès',
  })
  @ApiResponse({ status: 404, description: 'Configuration non trouvée' })
  async getConfigByKey(@Param('key') key: string) {
    try {
      this.analytics.reads++;

      // Vérifier le cache
      const cachedValue = this.getCachedValue(key);
      if (cachedValue !== null) {
        return {
          success: true,
          data: { key, value: cachedValue },
          cached: true,
          timestamp: new Date().toISOString(),
        };
      }

      const config = this.configs.get(key);
      if (!config) {
        throw new HttpException(
          'Configuration non trouvée',
          HttpStatus.NOT_FOUND,
        );
      }

      let value = config.value;
      if (config.isSensitive) {
        // En production, vérifier les permissions ici
        value = '[MASKED]';
      }

      // Mettre en cache
      this.setCachedValue(key, value);

      return {
        success: true,
        data: {
          key: config.key,
          value,
          category: config.category,
          description: config.description,
          type: config.type,
          updatedAt: config.updatedAt,
        },
        cached: false,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.analytics.errors++;
      this.logger.error(
        `Erreur lors de la récupération de la configuration ${key}`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @ApiOperation({ summary: 'Créer une nouvelle configuration' })
  @ApiResponse({ status: 201, description: 'Configuration créée avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 409, description: 'La configuration existe déjà' })
  @ApiBody({ type: Object })
  async createConfig(@Body() createConfigDto: CreateConfigDto) {
    try {
      this.analytics.writes++;

      // Valider les données
      const validatedData = CreateConfigSchema.parse(createConfigDto);

      // Vérifier si la clé existe déjà
      if (this.configs.has(validatedData.key)) {
        throw new HttpException(
          'La configuration existe déjà',
          HttpStatus.CONFLICT,
        );
      }

      // Traiter la valeur sensible
      let processedValue = validatedData.value;
      if (validatedData.isSensitive) {
        processedValue = this.encryptSensitiveValue(validatedData.value);
      }

      // Créer la configuration
      const newConfig: ConfigItem = {
        key: validatedData.key,
        value: processedValue,
        category: validatedData.category || 'general',
        description: validatedData.description,
        isSensitive: validatedData.isSensitive || false,
        type: validatedData.type || 'string',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.configs.set(validatedData.key, newConfig);

      // Invalider le cache
      this.cache.delete(validatedData.key);

      this.logger.log(`Configuration créée: ${validatedData.key}`);

      return {
        success: true,
        message: 'Configuration créée avec succès',
        data: {
          key: newConfig.key,
          category: newConfig.category,
          type: newConfig.type,
          createdAt: newConfig.createdAt,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.analytics.errors++;
      this.logger.error(
        'Erreur lors de la création de la configuration',
        error,
      );
      throw new HttpException(
        'Erreur lors de la création de la configuration',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':key')
  @ApiOperation({ summary: 'Mettre à jour une configuration' })
  @ApiResponse({
    status: 200,
    description: 'Configuration mise à jour avec succès',
  })
  @ApiResponse({ status: 404, description: 'Configuration non trouvée' })
  @ApiBody({ type: Object })
  async updateConfig(
    @Param('key') key: string,
    @Body() updateConfigDto: UpdateConfigDto,
  ) {
    try {
      this.analytics.writes++;

      // Valider les données
      const validatedData = UpdateConfigSchema.parse(updateConfigDto);

      const existingConfig = this.configs.get(key);
      if (!existingConfig) {
        throw new HttpException(
          'Configuration non trouvée',
          HttpStatus.NOT_FOUND,
        );
      }

      // Traiter la nouvelle valeur si fournie
      let processedValue = existingConfig.value;
      if (validatedData.value !== undefined) {
        processedValue = existingConfig.isSensitive
          ? this.encryptSensitiveValue(validatedData.value)
          : validatedData.value;
      }

      // Mettre à jour la configuration
      const updatedConfig: ConfigItem = {
        ...existingConfig,
        value: processedValue,
        category: validatedData.category ?? existingConfig.category,
        description: validatedData.description ?? existingConfig.description,
        isSensitive: validatedData.isSensitive ?? existingConfig.isSensitive,
        updatedAt: new Date(),
      };

      this.configs.set(key, updatedConfig);

      // Invalider le cache
      this.cache.delete(key);

      this.logger.log(`Configuration mise à jour: ${key}`);

      return {
        success: true,
        message: 'Configuration mise à jour avec succès',
        data: {
          key: updatedConfig.key,
          category: updatedConfig.category,
          updatedAt: updatedConfig.updatedAt,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.analytics.errors++;
      this.logger.error(
        `Erreur lors de la mise à jour de la configuration ${key}`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la mise à jour de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Supprimer une configuration' })
  @ApiResponse({
    status: 200,
    description: 'Configuration supprimée avec succès',
  })
  @ApiResponse({ status: 404, description: 'Configuration non trouvée' })
  async deleteConfig(@Param('key') key: string) {
    try {
      this.analytics.writes++;

      const existingConfig = this.configs.get(key);
      if (!existingConfig) {
        throw new HttpException(
          'Configuration non trouvée',
          HttpStatus.NOT_FOUND,
        );
      }

      // Supprimer la configuration
      this.configs.delete(key);

      // Invalider le cache
      this.cache.delete(key);

      this.logger.log(`Configuration supprimée: ${key}`);

      return {
        success: true,
        message: 'Configuration supprimée avec succès',
        data: { key },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.analytics.errors++;
      this.logger.error(
        `Erreur lors de la suppression de la configuration ${key}`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la suppression de la configuration',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('cache/stats')
  @ApiOperation({ summary: 'Statistiques du cache' })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées avec succès',
  })
  async getCacheStats() {
    const cacheSize = this.cache.size;
    const activeEntries = Array.from(this.cache.values()).filter(
      (entry) => entry.expiry > Date.now(),
    ).length;

    return {
      success: true,
      data: {
        cache: {
          size: cacheSize,
          active: activeEntries,
          expired: cacheSize - activeEntries,
        },
        analytics: this.analytics,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Delete('cache')
  @ApiOperation({ summary: 'Vider le cache' })
  @ApiResponse({ status: 200, description: 'Cache vidé avec succès' })
  async clearCache() {
    const previousSize = this.cache.size;
    this.cache.clear();

    this.logger.log(`Cache vidé: ${previousSize} entrées supprimées`);

    return {
      success: true,
      message: 'Cache vidé avec succès',
      data: { clearedEntries: previousSize },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('cache/warmup')
  @ApiOperation({ summary: 'Réchauffer le cache' })
  @ApiResponse({ status: 200, description: 'Cache réchauffé avec succès' })
  async warmupCache() {
    let warmedCount = 0;

    for (const [key, config] of this.configs.entries()) {
      if (!config.isSensitive) {
        this.setCachedValue(key, config.value);
        warmedCount++;
      }
    }

    this.logger.log(
      `Cache réchauffé: ${warmedCount} configurations mises en cache`,
    );

    return {
      success: true,
      message: 'Cache réchauffé avec succès',
      data: { warmedConfigs: warmedCount },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('public')
  @ApiOperation({ summary: 'Récupérer les configurations publiques' })
  @ApiResponse({
    status: 200,
    description: 'Configurations publiques récupérées',
  })
  async getPublicConfigs() {
    const publicConfigs = Array.from(this.configs.values())
      .filter((config) => !config.isSensitive)
      .map((config) => ({
        key: config.key,
        value: config.value,
        category: config.category,
        description: config.description,
      }));

    return {
      success: true,
      data: publicConfigs,
      count: publicConfigs.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: "Métriques d'utilisation" })
  @ApiResponse({ status: 200, description: 'Métriques récupérées avec succès' })
  async getMetrics() {
    return {
      success: true,
      data: {
        analytics: this.analytics,
        configurations: {
          total: this.configs.size,
          sensitive: Array.from(this.configs.values()).filter(
            (c) => c.isSensitive,
          ).length,
          public: Array.from(this.configs.values()).filter(
            (c) => !c.isSensitive,
          ).length,
        },
        cache: {
          size: this.cache.size,
          hitRate:
            this.analytics.reads > 0
              ? (this.analytics.cachehits / this.analytics.reads) * 100
              : 0,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('audit-trail')
  @ApiOperation({ summary: 'Historique des changements' })
  @ApiResponse({ status: 200, description: 'Historique récupéré avec succès' })
  async getAuditTrail(@Query('key') key?: string) {
    // Simulation d'un audit trail (en production, utiliser une vraie base de données)
    const auditEntries = [
      {
        id: 1,
        configKey: key || 'database.url',
        action: 'created',
        user: 'system',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        changes: { created: true },
      },
      {
        id: 2,
        configKey: key || 'database.url',
        action: 'updated',
        user: 'admin',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        changes: { value: '[ENCRYPTED]' },
      },
    ];

    return {
      success: true,
      data: key
        ? auditEntries.filter((entry) => entry.configKey === key)
        : auditEntries,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('system/database')
  @ApiOperation({ summary: 'Configuration de base de données' })
  @ApiResponse({ status: 200, description: 'Configuration database récupérée' })
  async getDatabaseConfig() {
    const dbConfigs = Array.from(this.configs.values())
      .filter((config) => config.category === 'database')
      .map((config) => ({
        key: config.key,
        value: config.isSensitive ? '[MASKED]' : config.value,
        description: config.description,
      }));

    return {
      success: true,
      data: dbConfigs,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('system/email')
  @ApiOperation({ summary: 'Configuration email' })
  @ApiResponse({ status: 200, description: 'Configuration email récupérée' })
  async getEmailConfig() {
    // Simulation de configurations email
    return {
      success: true,
      data: [
        {
          key: 'email.smtp.host',
          value: 'smtp.example.com',
          description: 'Serveur SMTP',
        },
        {
          key: 'email.from',
          value: 'noreply@autoparts.com',
          description: 'Adresse expéditeur',
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Get('system/all')
  @ApiOperation({ summary: 'Toutes les configurations système' })
  @ApiResponse({
    status: 200,
    description: 'Configurations système récupérées',
  })
  async getAllSystemConfigs() {
    const systemConfigs = Array.from(this.configs.values())
      .filter((config) =>
        ['database', 'cache', 'api'].includes(config.category),
      )
      .map((config) => ({
        key: config.key,
        value: config.isSensitive ? '[MASKED]' : config.value,
        category: config.category,
        description: config.description,
      }));

    return {
      success: true,
      data: systemConfigs,
      categories: ['database', 'cache', 'api'],
      timestamp: new Date().toISOString(),
    };
  }
}
