import {
  Controller,
  Get,
  Post,
  Put,
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

export interface CreateDatabaseConfigDto {
  environment: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  sslEnabled: boolean;
  poolSize: number;
  connectionTimeout?: number;
  maxConnections?: number;
}

export interface UpdateDatabaseConfigDto {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  sslEnabled?: boolean;
  poolSize?: number;
  connectionTimeout?: number;
  maxConnections?: number;
  isActive?: boolean;
}

export interface TestConnectionDto {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  sslEnabled: boolean;
}

@Controller('api/config/database')
export class DatabaseConfigController {
  private readonly logger = new Logger(DatabaseConfigController.name);

  constructor(
    private readonly databaseConfigService: SimpleDatabaseConfigService,
  ) {}

  /**
   * Test de santé du service
   */
  @Get('health')
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    this.logger.debug('Database config health check endpoint called');
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Récupère la configuration pour un environnement
   * GET /api/config/database/:environment?port=5432
   */
  @Get(':environment')
  async getConfig(
    @Param('environment') environment: string,
    @Query('port') port?: number,
  ): Promise<DatabaseConfig> {
    this.logger.debug(
      `Getting database config for ${environment}:${port || 'default'}`,
    );
    return this.databaseConfigService.getConfig(environment, port);
  }

  /**
   * Liste toutes les configurations
   * GET /api/config/database?environment=production
   */
  @Get()
  async listConfigs(
    @Query('environment') environment?: string,
  ): Promise<DatabaseConfig[]> {
    this.logger.debug(
      `Listing database configs for environment: ${environment || 'all'}`,
    );
    return this.databaseConfigService.listConfigs(environment);
  }

  /**
   * Crée ou met à jour une configuration
   * POST /api/config/database
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createConfig(
    @Body() createDto: CreateDatabaseConfigDto,
  ): Promise<DatabaseConfig> {
    this.logger.debug(
      `Creating database config for ${createDto.environment}:${createDto.port}`,
    );

    const config: DatabaseConfig = {
      ...createDto,
      isActive: true,
    };

    return this.databaseConfigService.upsertConfig(config);
  }

  /**
   * Met à jour une configuration existante
   * PUT /api/config/database/:environment/:port
   */
  @Put(':environment/:port')
  @HttpCode(HttpStatus.OK)
  async updateConfig(
    @Param('environment') environment: string,
    @Param('port') port: number,
    @Body() updateDto: UpdateDatabaseConfigDto,
  ): Promise<DatabaseConfig> {
    this.logger.debug(`Updating database config for ${environment}:${port}`);

    // Récupérer la config existante
    const existingConfig = await this.databaseConfigService.getConfig(
      environment,
      port,
    );

    // Merger avec les nouvelles données
    const updatedConfig: DatabaseConfig = {
      ...existingConfig,
      ...updateDto,
      environment,
      port,
    };

    return this.databaseConfigService.upsertConfig(updatedConfig);
  }

  /**
   * Supprime une configuration
   * DELETE /api/config/database/:environment/:port
   */
  @Delete(':environment/:port')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(
    @Param('environment') environment: string,
    @Param('port') port: number,
  ): Promise<void> {
    this.logger.debug(`Deleting database config for ${environment}:${port}`);
    await this.databaseConfigService.deleteConfig(environment, port);
  }

  /**
   * Teste une connexion de base de données
   * POST /api/config/database/test-connection
   */
  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(
    @Body() testDto: TestConnectionDto,
  ): Promise<DatabaseConnectionTest> {
    this.logger.debug(
      `Testing database connection to ${testDto.host}:${testDto.port}`,
    );

    const config: DatabaseConfig = {
      environment: 'test',
      host: testDto.host,
      port: testDto.port,
      database: testDto.database,
      username: testDto.username,
      password: testDto.password,
      sslEnabled: testDto.sslEnabled,
      poolSize: 1, // Juste pour le test
      isActive: true,
    };

    return this.databaseConfigService.testDatabaseConnection(config);
  }

  /**
   * Teste la configuration existante pour un environnement
   * POST /api/config/database/:environment/test
   */
  @Post(':environment/test')
  @HttpCode(HttpStatus.OK)
  async testExistingConfig(
    @Param('environment') environment: string,
    @Query('port') port?: number,
  ): Promise<DatabaseConnectionTest> {
    this.logger.debug(
      `Testing existing database config for ${environment}:${port || 'default'}`,
    );

    const config = await this.databaseConfigService.getConfig(
      environment,
      port,
    );
    return this.databaseConfigService.testDatabaseConnection(config);
  }

  /**
   * Récupère les environnements disponibles
   * GET /api/config/database/environments/list
   */
  @Get('environments/list')
  async getEnvironments(): Promise<{ environments: string[] }> {
    this.logger.debug('Getting available environments');

    const configs = await this.databaseConfigService.listConfigs();
    const environments = [
      ...new Set(configs.map((config) => config.environment)),
    ];

    return { environments };
  }

  /**
   * Statistiques des configurations
   * GET /api/config/database/stats/overview
   */
  @Get('stats/overview')
  async getStats(): Promise<{
    total: number;
    byEnvironment: Record<string, number>;
    active: number;
    inactive: number;
  }> {
    this.logger.debug('Getting database config statistics');

    const configs = await this.databaseConfigService.listConfigs();

    const byEnvironment: Record<string, number> = {};
    let active = 0;
    let inactive = 0;

    configs.forEach((config) => {
      byEnvironment[config.environment] =
        (byEnvironment[config.environment] || 0) + 1;
      if (config.isActive) {
        active++;
      } else {
        inactive++;
      }
    });

    return {
      total: configs.length,
      byEnvironment,
      active,
      inactive,
    };
  }
}
