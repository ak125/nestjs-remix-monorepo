import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import {
  EnhancedConfigService,
  ConfigItem,
  ConfigBackup,
} from '../services/enhanced-config.service';

export interface SetConfigDto {
  key: string;
  value: string;
  description?: string;
}

export interface RestoreConfigDto {
  backup: ConfigBackup;
}

@Controller('api/config/enhanced')
export class EnhancedConfigController {
  private readonly logger = new Logger(EnhancedConfigController.name);

  constructor(private readonly enhancedConfigService: EnhancedConfigService) {}

  /**
   * Test de santé du service
   */
  @Get('health')
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    this.logger.debug('Health check endpoint called');
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Test de la connexion Supabase et de la table ___config
   */
  @Get('test-db')
  async testDatabase(): Promise<{
    status: string;
    message: string;
    tables?: unknown;
    data?: unknown;
    error?: string;
    errorCode?: string;
    timestamp: string;
  }> {
    try {
      this.logger.debug('Testing Supabase connection...');

      // Test de connexion en listant les tables avec information_schema
      const { data, error } =
        await this.enhancedConfigService['supabase'].rpc('get_table_list');

      if (error) {
        // Si la fonction RPC n'existe pas, essayons une requête plus simple
        const { data: simpleData, error: simpleError } =
          await this.enhancedConfigService['supabase']
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .limit(5);

        if (simpleError) {
          return {
            status: 'ERROR',
            message: 'Supabase connection failed',
            error: simpleError.message || 'Unknown error',
            errorCode: simpleError.code,
            timestamp: new Date().toISOString(),
          };
        }

        return {
          status: 'SUCCESS',
          message: 'Supabase connection successful (fallback method)',
          tables: simpleData,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        status: 'SUCCESS',
        message: 'Supabase connection successful',
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown exception';
      return {
        status: 'ERROR',
        message: 'Exception occurred',
        error: message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Récupère toutes les configurations
   * DÉSACTIVÉ - loadAllConfigs() n'existe pas dans EnhancedConfigService
   */
  // @Get()
  // async getAllConfigs(): Promise<ConfigItem[]> {
  //   this.logger.debug('Getting all configurations');
  //   return this.enhancedConfigService.loadAllConfigs();
  // }

  /**
   * Récupère une configuration par clé
   */
  @Get(':key')
  async getConfig(
    @Param('key') key: string,
  ): Promise<{ key: string; value: string | null }> {
    this.logger.debug(`Getting configuration: ${key}`);
    const value = await this.enhancedConfigService.get(key);
    return { key, value };
  }

  /**
   * Définit une configuration
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async setConfig(@Body() dto: SetConfigDto): Promise<{ message: string }> {
    this.logger.debug(`Setting configuration: ${dto.key}`);
    await this.enhancedConfigService.set(dto.key, dto.value, dto.description);
    return { message: 'Configuration set successfully' };
  }

  /**
   * Met à jour une configuration
   */
  @Put(':key')
  async updateConfig(
    @Param('key') key: string,
    @Body() dto: { value: string; description?: string },
  ): Promise<{ message: string }> {
    this.logger.debug(`Updating configuration: ${key}`);
    await this.enhancedConfigService.set(key, dto.value, dto.description);
    return { message: 'Configuration updated successfully' };
  }

  /**
   * Supprime une configuration
   */
  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(@Param('key') key: string): Promise<void> {
    this.logger.debug(`Deleting configuration: ${key}`);
    await this.enhancedConfigService.delete(key);
  }

  /**
   * Recherche des configurations
   */
  @Get('search/:pattern')
  async searchConfigs(
    @Param('pattern') pattern: string,
  ): Promise<ConfigItem[]> {
    this.logger.debug(`Searching configurations with pattern: ${pattern}`);
    return this.enhancedConfigService.search(pattern);
  }

  /**
   * Récupère les configurations par catégorie
   */
  @Get('category/:category')
  async getByCategory(
    @Param('category') category: string,
  ): Promise<ConfigItem[]> {
    this.logger.debug(`Getting configurations for category: ${category}`);
    return this.enhancedConfigService.getByCategory(category);
  }

  /**
   * Sauvegarde toutes les configurations
   */
  @Post('backup')
  async backup(): Promise<ConfigBackup> {
    this.logger.debug('Creating configuration backup');
    return this.enhancedConfigService.backup();
  }

  /**
   * Restaure les configurations depuis une sauvegarde
   */
  @Post('restore')
  async restore(@Body() dto: RestoreConfigDto): Promise<{ message: string }> {
    this.logger.debug('Restoring configurations from backup');
    await this.enhancedConfigService.restore(dto.backup);
    return { message: 'Configurations restored successfully' };
  }

  /**
   * Chiffre une valeur
   */
  @Post('encrypt')
  async encryptValue(
    @Body() dto: { value: string },
  ): Promise<{ encrypted: string }> {
    this.logger.debug('Encrypting value');
    const encrypted = this.enhancedConfigService.encryptValue(dto.value);
    return { encrypted };
  }

  /**
   * Déchiffre une valeur
   */
  @Post('decrypt')
  async decryptValue(
    @Body() dto: { encrypted: string },
  ): Promise<{ decrypted: string }> {
    this.logger.debug('Decrypting value');
    const decrypted = this.enhancedConfigService.decryptValue(dto.encrypted);
    return { decrypted };
  }

  /**
   * Statistiques sur les configurations
   */
  @Get('stats/overview')
  async getStats(): Promise<{
    total: number;
    categories: Record<string, number>;
    lastUpdated: string | null;
  }> {
    this.logger.debug('Getting configuration statistics');
    return this.enhancedConfigService.getStats();
  }
}
