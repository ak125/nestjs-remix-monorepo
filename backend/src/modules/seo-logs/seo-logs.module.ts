import { Module } from '@nestjs/common';
import { SeoKpiController } from './controllers/seo-kpi.controller';
import { SeoAuditController } from './controllers/seo-audit.controller';
import { CrawlBudgetExperimentController } from './controllers/crawl-budget-experiment.controller';
import { CrawlBudgetAuditController } from './controllers/crawl-budget-audit.controller';
import { SeoAuditSchedulerService } from './services/seo-audit-scheduler.service';
import { CrawlBudgetSupabaseService } from './services/crawl-budget-supabase.service';
import { CrawlBudgetAuditService } from './services/crawl-budget-audit.service';
import {
  GoogleSearchConsoleService,
  GoogleAnalyticsService,
  SitemapGeneratorService,
  CrawlBudgetOrchestratorService,
} from './services/crawl-budget-integrations.service';

/**
 * 📊 Module d'analyse des logs SEO & A/B Testing Crawl Budget
 *
 * Fournit:
 * - Endpoints analyse logs de crawl et KPIs SEO via Loki
 * - Audits hebdomadaires automatiques via BullMQ
 * - A/B Testing du crawl budget (exclure/inclure/réduire familles)
 * - Intégration Google Search Console + Google Analytics 4
 * - Génération de sitemaps filtrés dynamiques
 *
 * Note: Utilisation directe de BullMQ (sans @nestjs/bullmq)
 * pour éviter les conflits de version avec @nestjs/common v10
 */
@Module({
  imports: [],
  controllers: [
    SeoKpiController,
    SeoAuditController,
    CrawlBudgetExperimentController,
    CrawlBudgetAuditController,
  ],
  providers: [
    // Audit services
    SeoAuditSchedulerService,

    // A/B Testing services
    CrawlBudgetSupabaseService,
    GoogleSearchConsoleService,
    GoogleAnalyticsService,
    SitemapGeneratorService,
    CrawlBudgetOrchestratorService,
    CrawlBudgetAuditService,
  ],
  exports: [SeoAuditSchedulerService, CrawlBudgetOrchestratorService],
})
export class SeoLogsModule {}

