/**
 * 📊 MODULE SEO MONITORING
 *
 * Regroupe tous les services d'analytics et monitoring SEO:
 * - SeoMonitoringService: Soumission sitemaps & couverture index
 * - SeoPilotageService: Rapports hebdo/mensuel + diagnostics
 * - SeoKpisService: 5 KPIs core (discovery, indexation, TTL crawl, errors, hreflang)
 * - RiskFlagsEngineService: Calcul risk flags (ORPHAN, DUPLICATE, WEAK_CLUSTER, etc.)
 * - GooglebotDetectorService: Détection passive Googlebot + logging crawl
 * - KeywordsDashboardService: Dashboard V-Level par gamme
 * - LogIngestionService: Ingestion logs Caddy (Loki + Meilisearch)
 *
 * Contrôleurs inclus:
 * - SeoMonitoringController, SeoDashboardController, KeywordsDashboardController
 * - SeoPilotageController, SeoLogsController
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';

// Services monitoring (import depuis seo/ pour compatibilité)
import { SeoMonitoringService } from '../seo/services/seo-monitoring.service';
import { SeoPilotageService } from '../seo/services/seo-pilotage.service';
import { SeoKpisService } from '../seo/services/seo-kpis.service';
import { RiskFlagsEngineService } from '../seo/services/risk-flags-engine.service';
import { GooglebotDetectorService } from '../seo/services/googlebot-detector.service';
import { KeywordsDashboardService } from '../seo/services/keywords-dashboard.service';
import { LogIngestionService } from '../seo/services/log-ingestion.service';

// Contrôleurs
import { SeoMonitoringController } from '../seo/controllers/seo-monitoring.controller';
import { SeoDashboardController } from '../seo/controllers/seo-dashboard.controller';
import { KeywordsDashboardController } from '../seo/controllers/keywords-dashboard.controller';
import { SeoPilotageController } from '../seo/controllers/seo-pilotage.controller';
import { SeoLogsController } from '../seo/controllers/seo-logs.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule, // 🚀 P7.3 PERF: Fournit RedisCacheService pour keywords-dashboard
  ],

  controllers: [
    SeoMonitoringController,
    SeoDashboardController,
    KeywordsDashboardController,
    SeoPilotageController,
    SeoLogsController,
  ],

  providers: [
    SeoMonitoringService,
    SeoPilotageService,
    SeoKpisService,
    RiskFlagsEngineService,
    GooglebotDetectorService,
    KeywordsDashboardService,
    LogIngestionService,
  ],

  exports: [
    SeoMonitoringService,
    SeoPilotageService,
    SeoKpisService,
    RiskFlagsEngineService,
    GooglebotDetectorService,
    KeywordsDashboardService,
    LogIngestionService,
  ],
})
export class SeoMonitoringModule {}
