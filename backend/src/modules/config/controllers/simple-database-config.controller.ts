import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import {
  SimpleDatabaseConfigService,
  DatabaseConfig,
  DatabaseConnectionTest,
} from '../services/simple-database-config.service';

@Controller('api/config/database')
export class SimpleDatabaseConfigController {
  private readonly logger = new Logger(SimpleDatabaseConfigController.name);

  constructor(
    private readonly databaseConfigService: SimpleDatabaseConfigService,
  ) {}

  /**
   * Endpoint de santé pour vérifier que le service fonctionne
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getHealth() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Récupère la configuration de base de données pour l'environnement par défaut
   */
  @Get()
  async getDefaultConfig(
    @Query('port') port?: number,
  ): Promise<DatabaseConfig> {
    return this.databaseConfigService.getConfig(undefined, port);
  }

  /**
   * Récupère la configuration de base de données pour un environnement spécifique
   */
  @Get(':environment')
  async getConfig(
    @Param('environment') environment: string,
    @Query('port') port?: number,
  ): Promise<DatabaseConfig> {
    return this.databaseConfigService.getConfig(environment, port);
  }

  /**
   * Récupère toutes les configurations disponibles
   */
  @Get('all/configs')
  async getAllConfigs(): Promise<DatabaseConfig[]> {
    return this.databaseConfigService.listConfigs();
  }

  /**
   * Teste la connexion à la base de données
   */
  @Get(':environment/test-connection')
  async testConnection(
    @Param('environment') environment: string,
    @Query('port') port?: number,
  ): Promise<DatabaseConnectionTest> {
    const config = await this.databaseConfigService.getConfig(
      environment,
      port,
    );
    return this.databaseConfigService.testDatabaseConnection(config);
  }

  /**
   * Teste la connexion avec une configuration personnalisée
   */
  @Post('test-connection')
  async testCustomConnection(
    @Body() config: DatabaseConfig,
  ): Promise<DatabaseConnectionTest> {
    return this.databaseConfigService.testDatabaseConnection(config);
  }

  /**
   * Récupère les statistiques des configurations
   */
  @Get('stats/overview')
  async getStats() {
    return this.databaseConfigService.getStats();
  }

  /**
   * Vide le cache pour un environnement spécifique
   */
  @Delete('cache/:environment')
  async clearEnvironmentCache(
    @Param('environment') environment: string,
  ): Promise<{ message: string }> {
    await this.databaseConfigService.invalidateCache(environment);
    return {
      message: `Cache cleared for environment: ${environment}`,
    };
  }

  /**
   * Vide tout le cache
   */
  @Delete('cache')
  async clearAllCache(): Promise<{ message: string }> {
    await this.databaseConfigService.invalidateCache();
    return {
      message: 'All database config cache cleared',
    };
  }
}
