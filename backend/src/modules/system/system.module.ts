import { Module } from '@nestjs/common';
import {
  SystemHealthController,
  SystemHealthService,
} from './system-health.controller';
// Import du SystemService avancé existant
import { SystemService } from './services/system.service';
import { MetricsService } from './services/metrics.service';
import { DatabaseMonitorService } from './services/database-monitor.service';
import { ConfigModule } from '@nestjs/config';

/**
 * 🎯 SystemModule - Monitoring & Métriques Enterprise
 *
 * Version hybride combinant :
 * ✅ SystemHealthController simple (fonctionnel)
 * ✅ SystemService avancé (complet)
 * ✅ MetricsService et DatabaseMonitor (enterprise)
 */
@Module({
  imports: [ConfigModule],
  controllers: [SystemHealthController],
  providers: [
    SystemHealthService, // Simple, fonctionne
    SystemService, // Avancé, complet
    MetricsService, // Enterprise metrics
    DatabaseMonitorService, // Database monitoring
  ],
  exports: [
    SystemHealthService,
    SystemService,
    MetricsService,
    DatabaseMonitorService,
  ],
})
export class SystemModule {}
