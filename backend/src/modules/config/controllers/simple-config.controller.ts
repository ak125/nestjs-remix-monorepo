import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { SimpleConfigService, AppConfig } from '../services/simple-config.service';

export interface UpdateConfigDto {
  key: keyof AppConfig;
  value: string;
}

@Controller('api/config/app')
export class SimpleConfigController {
  private readonly logger = new Logger(SimpleConfigController.name);

  constructor(private readonly configService: SimpleConfigService) {}

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
   * Test de connexion à la base de données
   */
  @Get('test-connection')
  async testConnection(): Promise<{ status: string; message: string }> {
    this.logger.debug('Testing database connection');
    return this.configService.testDatabaseConnection();
  }

  /**
   * Récupère toute la configuration de l'application
   */
  @Get()
  async getAppConfig(): Promise<AppConfig | null> {
    this.logger.debug('Getting app configuration');
    return this.configService.getAppConfig();
  }

  /**
   * Récupère une valeur spécifique de configuration
   */
  @Get('value/:key')
  async getConfigValue(@Param('key') key: keyof AppConfig): Promise<{ key: string; value: string | null }> {
    this.logger.debug(`Getting configuration value: ${String(key)}`);
    const value = await this.configService.getConfigValue(key);
    return { key: String(key), value };
  }

  /**
   * Met à jour une valeur de configuration
   */
  @Put('value/:key')
  @HttpCode(HttpStatus.OK)
  async updateConfigValue(
    @Param('key') key: keyof AppConfig,
    @Body() dto: { value: string },
  ): Promise<{ message: string }> {
    this.logger.debug(`Updating configuration: ${String(key)}`);
    await this.configService.updateConfigValue(key, dto.value);
    return { message: 'Configuration updated successfully' };
  }

  /**
   * Statistiques sur la configuration
   */
  @Get('stats')
  async getStats(): Promise<{
    total_fields: number;
    filled_fields: number;
    last_updated: string | null;
  }> {
    this.logger.debug('Getting configuration statistics');
    return this.configService.getConfigStats();
  }
}
