import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemService } from './services/system.service';
import { MetricsService } from './services/metrics.service';
import { DatabaseMonitorService } from './services/database-monitor.service';

/**
 * 🎯 SystemModule - Monitoring & Métriques Enterprise
 * 
 * Version optimisée pour production
 * Fonctionnalités principales :
 * ✅ Métriques performance, business, SEO
 * ✅ Surveillance base de données
 * ✅ Health checks système
 * ✅ Alertes automatiques
 * ✅ Insights prédictifs
 */
@Module({
  controllers: [SystemController],
  providers: [SystemService, MetricsService, DatabaseMonitorService],
  exports: [SystemService, MetricsService, DatabaseMonitorService],
})
export class SystemModule {}
