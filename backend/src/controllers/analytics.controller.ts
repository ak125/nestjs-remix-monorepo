import { Controller, Post, Body, Logger } from '@nestjs/common';

interface AnalyticsBatch {
  type: string;
  events: any[];
  sessionId: string;
  timestamp: string;
}

interface PerformanceBatch {
  type: string;
  metrics: any[];
  sessionId: string;
  timestamp: string;
}

@Controller('api/analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  @Post('report')
  async handleAnalyticsReport(@Body() batch: AnalyticsBatch) {
    this.logger.log(
      `📊 Analytics batch reçu: ${batch.events.length} événements`,
    );

    // Log des événements importants
    batch.events.forEach((event) => {
      if (event.type === 'conversion' || event.type === 'ab_test_result') {
        this.logger.log(`🎯 Événement important: ${event.type}`, event.data);
      }
    });

    // Ici vous pourriez :
    // - Sauvegarder en base de données
    // - Envoyer vers un service d'analytics externe (Google Analytics, Mixpanel, etc.)
    // - Déclencher des alertes basées sur les données

    return {
      success: true,
      processed: batch.events.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('performance')
  async handlePerformanceReport(@Body() batch: PerformanceBatch) {
    this.logger.log(
      `⚡ Performance batch reçu: ${batch.metrics.length} métriques`,
    );

    // Log des métriques critiques
    batch.metrics.forEach((metric) => {
      if (metric.name === 'lcp' && metric.value > 2500) {
        this.logger.warn(
          `⚠️ LCP élevé détecté: ${metric.value}ms sur ${metric.context.page}`,
        );
      }
      if (metric.name === 'fid' && metric.value > 100) {
        this.logger.warn(`⚠️ FID élevé détecté: ${metric.value}ms`);
      }
    });

    return {
      success: true,
      processed: batch.metrics.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('errors')
  async handleErrorReport(@Body() errorData: any) {
    this.logger.error(`🚨 Erreur frontend signalée:`, errorData);

    // Ici vous pourriez :
    // - Envoyer vers un service de monitoring d'erreurs (Sentry, Rollbar, etc.)
    // - Créer des tickets automatiques pour les erreurs critiques
    // - Analyser les patterns d'erreurs

    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
