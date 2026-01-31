/**
 * SeoMonitoringModule
 *
 * Sous-module dédié au monitoring et pilotage SEO :
 * - KPIs et dashboards
 * - Pilotage hebdo/mensuel avec auto-diagnostics
 * - Détection Googlebot et risk flags
 * - Keywords dashboard (V-Level par gamme)
 *
 * @see .spec/00-canon/architecture.md - SEO Module refactoring
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Module Workers (pour schedulers)
import { WorkerModule } from '../../../workers/worker.module';

// Module Database (pour accès Supabase)
import { DatabaseModule } from '../../../database/database.module';

// =====================================================
// SERVICES - Monitoring SEO
// =====================================================

import { SeoMonitoringService } from '../services/seo-monitoring.service';
import { SeoPilotageService } from '../services/seo-pilotage.service';
import { SeoKpisService } from '../services/seo-kpis.service';
import { GooglebotDetectorService } from '../services/googlebot-detector.service';
import { RiskFlagsEngineService } from '../services/risk-flags-engine.service';
import { KeywordsDashboardService } from '../services/keywords-dashboard.service';
import { LogIngestionService } from '../services/log-ingestion.service';
import { SeoInterpolationMonitorService } from '../services/seo-interpolation-monitor.service';

// =====================================================
// CONTROLLERS - API Monitoring
// =====================================================

import { SeoMonitoringController } from '../controllers/seo-monitoring.controller';
import { SeoMonitorController } from '../controllers/seo-monitor.controller';
import { SeoPilotageController } from '../controllers/seo-pilotage.controller';
import { SeoDashboardController } from '../controllers/seo-dashboard.controller';
import { KeywordsDashboardController } from '../controllers/keywords-dashboard.controller';
import { SeoLogsController } from '../controllers/seo-logs.controller';

@Module({
  imports: [ConfigModule, WorkerModule, DatabaseModule],

  controllers: [
    SeoMonitoringController, // GET /seo-monitoring/report
    SeoMonitorController, // Monitoring BullMQ
    SeoPilotageController, // GET /api/seo/pilotage/weekly
    SeoDashboardController, // GET /api/seo/dashboard/stats
    KeywordsDashboardController, // GET /api/seo/keywords/gammes
    SeoLogsController, // Logs Meilisearch
  ],

  providers: [
    SeoMonitoringService,
    SeoPilotageService,
    SeoKpisService,
    GooglebotDetectorService,
    RiskFlagsEngineService,
    KeywordsDashboardService,
    LogIngestionService,
    SeoInterpolationMonitorService, // 🛡️ Monitoring interpolation SEO
  ],

  exports: [
    SeoMonitoringService,
    SeoPilotageService,
    SeoKpisService,
    GooglebotDetectorService,
    RiskFlagsEngineService,
    KeywordsDashboardService,
    LogIngestionService,
    SeoInterpolationMonitorService, // 🛡️ Export pour utilisation dans d'autres modules
  ],
})
export class SeoMonitoringModule {}
