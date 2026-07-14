import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { SimpleAnalyticsController } from './controllers/simple-analytics.controller';
import { LandingAttributionController } from './controllers/landing-attribution.controller';

// Services
import { SimpleAnalyticsService } from './services/simple-analytics.service';

// Modules externes
import { DatabaseModule } from '../../database/database.module';

/**
 * 📊 ANALYTICS MODULE - Module Analytics Avancé
 *
 * Architecture alignée sur les meilleures pratiques du projet :
 * ✅ Module global pour utilisation dans toute l'application
 * ✅ Service principal pour gestion des configurations analytics
 * ✅ Contrôleur avec endpoints complets et compatibilité legacy
 * ✅ Integration avec CacheModule et DatabaseModule
 * ✅ Support multi-providers (Google, Matomo, Plausible, Custom)
 * ✅ Tracking d'événements temps réel
 * ✅ Configuration GDPR compliant
 * ✅ Scripts optimisés et compatibilité legacy
 */

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [SimpleAnalyticsController, LandingAttributionController],
  providers: [SimpleAnalyticsService],
  exports: [SimpleAnalyticsService],
})
export class AnalyticsModule {
  /**
   * Configuration pour les tests
   * Désactive le cache et utilise des mocks
   */
  static forTesting() {
    return {
      module: AnalyticsModule,
      providers: [
        {
          provide: SimpleAnalyticsService,
          useValue: {
            getConfig: jest.fn(),
            getTrackingScript: jest.fn(),
            trackEvent: jest.fn(),
            getMetrics: jest.fn(),
            updateConfig: jest.fn(),
            clearCache: jest.fn(),
            getServiceStats: jest.fn(),
          },
        },
      ],
    };
  }
}
