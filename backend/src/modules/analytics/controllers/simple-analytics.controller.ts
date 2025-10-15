import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  Header,
} from '@nestjs/common';
import {
  SimpleAnalyticsService,
  AnalyticsConfig,
  AnalyticsMetrics,
} from '../services/simple-analytics.service';

export interface TrackEventDto {
  category: string;
  action: string;
  label?: string;
  value?: number;
  customData?: Record<string, any>;
}

@Controller('api/analytics')
export class SimpleAnalyticsController {
  private readonly logger = new Logger(SimpleAnalyticsController.name);

  constructor(private readonly analyticsService: SimpleAnalyticsService) {}

  /**
   * Endpoint de santé pour vérifier que le service fonctionne
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getHealth() {
    const stats = await this.analyticsService.getServiceStats();
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      analytics: {
        configLoaded: stats.configLoaded,
        totalEvents: stats.totalEvents,
        provider: stats.provider,
        isActive: stats.isActive,
        lastEventTime: stats.lastEventTime,
      },
    };
  }

  /**
   * Récupère la configuration analytics active
   */
  @Get('config')
  async getConfig(): Promise<AnalyticsConfig | null> {
    return this.analyticsService.getConfig();
  }

  /**
   * Génère le script de tracking
   * Compatible avec les anciennes URLs : analytics.track.php, analytics.track.min.php, v7.analytics.track.php
   */
  @Get('script')
  async getTrackingScript(
    @Query('minified') minified?: string,
    @Query('version') version?: string,
    @Query('provider') provider?: string,
  ): Promise<{ script: string; provider: string; version: string }> {
    const isMinified = minified === 'true' || minified === '1';
    const scriptVersion = version || 'latest';

    const script = await this.analyticsService.getTrackingScript({
      provider: provider || 'auto',
      minified: isMinified,
      async: true,
      defer: true,
      version: scriptVersion,
    });

    const config = await this.analyticsService.getConfig();

    return {
      script,
      provider: config?.provider || 'none',
      version: scriptVersion,
    };
  }

  /**
   * Endpoint moderne pour obtenir le script de tracking (remplace track.php)
   */
  @Get('track.js')
  @Header('Content-Type', 'application/javascript')
  @Header('Cache-Control', 'public, max-age=3600')
  async getTrackingScriptModern(
    @Query('min') min?: string,
    @Query('v') version?: string,
  ): Promise<string> {
    const isMinified = min === '1' || min === 'true';
    const scriptVersion = version || 'v7';

    const result = await this.getTrackingScript(
      isMinified ? 'true' : 'false',
      scriptVersion,
    );

    return result.script;
  }

  /**
   * Endpoint de compatibilité pour analytics.track.php (legacy)
   * Retourne directement le script JavaScript comme le faisait le PHP
   */
  @Get('track.php')
  @Header('Content-Type', 'application/javascript')
  @Header('Cache-Control', 'public, max-age=3600')
  async getTrackingScriptLegacy(
    @Query('min') min?: string,
    @Query('v') version?: string,
  ): Promise<string> {
    const isMinified = min === '1' || min === 'true';
    const scriptVersion = version || 'v7';

    const result = await this.getTrackingScript(
      isMinified ? 'true' : 'false',
      scriptVersion,
    );

    // Retourner le script directement comme le faisait le PHP
    return result.script;
  }

  /**
   * Endpoint moderne pour le script minifié (remplace track.min.php)
   */
  @Get('track.min.js')
  @Header('Content-Type', 'application/javascript')
  @Header('Cache-Control', 'public, max-age=3600')
  async getMinifiedTrackingScriptModern(
    @Query('v') version?: string,
  ): Promise<string> {
    const result = await this.getTrackingScript('true', version || 'v7');
    return result.script;
  }

  /**
   * Endpoint de compatibilité pour analytics.track.min.php (legacy)
   */
  @Get('track.min.php')
  @Header('Content-Type', 'application/javascript')
  @Header('Cache-Control', 'public, max-age=3600')
  async getMinifiedTrackingScript(
    @Query('v') version?: string,
  ): Promise<string> {
    const result = await this.getTrackingScript('true', version || 'v7');
    return result.script;
  }

  /**
   * Endpoint de compatibilité pour v7.analytics.track.php
   */
  @Get('v7.track.php')
  @Header('Content-Type', 'application/javascript')
  @Header('Cache-Control', 'public, max-age=3600')
  async getV7TrackingScript(@Query('min') min?: string): Promise<string> {
    const result = await this.getTrackingScript(min || 'false', 'v7');
    return result.script;
  }

  /**
   * Enregistre un événement analytics
   */
  @Post('track')
  @HttpCode(HttpStatus.CREATED)
  async trackEvent(@Body() eventData: TrackEventDto): Promise<{
    success: boolean;
    timestamp: string;
  }> {
    await this.analyticsService.trackEvent(
      eventData.category,
      eventData.action,
      eventData.label,
      eventData.value,
      eventData.customData,
    );

    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Récupère les métriques analytics
   */
  @Get('metrics')
  async getMetrics(): Promise<AnalyticsMetrics> {
    return this.analyticsService.getMetrics();
  }

  /**
   * Récupère les métriques pour une période spécifique
   */
  @Get('metrics/:period')
  async getMetricsForPeriod(
    @Param('period') period: 'today' | 'week' | 'month' | 'year',
  ): Promise<AnalyticsMetrics> {
    // Pour la version simplifiée, on retourne toujours les mêmes métriques
    // Dans une version complète, on filtrerait par période
    return this.analyticsService.getMetrics();
  }

  /**
   * Vide le cache analytics
   */
  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  async clearCache(): Promise<{ message: string; timestamp: string }> {
    await this.analyticsService.clearCache();
    return {
      message: 'Analytics cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Vide le buffer d'événements
   */
  @Post('events/clear')
  @HttpCode(HttpStatus.OK)
  async clearEvents(): Promise<{ message: string; timestamp: string }> {
    await this.analyticsService.clearEvents();
    return {
      message: 'Analytics events buffer cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Récupère les statistiques du service
   */
  @Get('stats')
  async getServiceStats() {
    return this.analyticsService.getServiceStats();
  }

  /**
   * Endpoint pour les rapports batch (compatibilité avec l'existant)
   */
  @Post('report')
  async handleAnalyticsReport(
    @Body()
    batch: {
      type: string;
      events: any[];
      sessionId: string;
      timestamp: string;
    },
  ) {
    this.logger.log(
      `📊 Analytics batch received: ${batch.events.length} events`,
    );

    // Traiter chaque événement du batch
    const promises = batch.events.map((event) =>
      this.analyticsService.trackEvent(
        event.category || 'batch',
        event.action || 'unknown',
        event.label,
        event.value,
        {
          ...event.data,
          sessionId: batch.sessionId,
          batchType: batch.type,
        },
      ),
    );

    await Promise.all(promises);

    return {
      success: true,
      processed: batch.events.length,
      timestamp: new Date().toISOString(),
    };
  }
}
