/**
 * 🔧 CONFIG MODULE - Module de Configuration Avancé
 * 
 * Architecture alignée sur les meilleures pratiques du projet :
 * ✅ Module global avec configuration dynamique
 * ✅ Services spécialisés par domaine (config, enhanced-config)
 * ✅ Cache intégré pour les performances
 * ✅ Support multi-environnements
 * ✅ Encryption/Decryption pour les données sensibles
 * ✅ Integration avec DatabaseModule et CacheModule
 * ✅ Configuration centralisée cohérente avec app.config.ts
 */

import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

// Controllers
import { SimpleConfigController } from './controllers/simple-config.controller';
import { SimpleDatabaseConfigController } from './controllers/simple-database-config.controller';

// Services
import { SimpleConfigService } from './services/simple-config.service';
import { SimpleDatabaseConfigService } from './services/simple-database-config.service';

// Modules externes
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../cache/cache.module';

// Interfaces et types
interface ConfigModuleOptions {
  environment?: 'development' | 'production' | 'test';
  cacheTTL?: number;
  enableValidation?: boolean;
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    CacheModule,
  ],
  controllers: [SimpleConfigController, SimpleDatabaseConfigController],
  providers: [
    // Services principaux
    SimpleConfigService,
    SimpleDatabaseConfigService,
  ],
  exports: [
    // Services principaux exportés
    SimpleConfigService,
    SimpleDatabaseConfigService,
  ],
})
export class ConfigModule {
  /**
   * Configuration dynamique du module
   * Permet de personnaliser le comportement selon l'environnement
   */
  static forRoot(options?: ConfigModuleOptions): DynamicModule {
    const defaultOptions: ConfigModuleOptions = {
      cacheTTL: 3600, // 1 heure par défaut
      environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      enableValidation: true,
    };

    const mergedOptions = { ...defaultOptions, ...options };

    return {
      module: ConfigModule,
      providers: [
        {
          provide: 'CONFIG_OPTIONS',
          useValue: mergedOptions,
        },
        {
          provide: 'CONFIG_ENVIRONMENT',
          useValue: mergedOptions.environment,
        },
      ],
    };
  }

  /**
   * Configuration pour les tests
   * Désactive le cache et la validation pour les performances
   */
  static forTesting(): DynamicModule {
    return ConfigModule.forRoot({
      cacheTTL: 0,
      enableValidation: false,
      environment: 'test',
    });
  }
}
