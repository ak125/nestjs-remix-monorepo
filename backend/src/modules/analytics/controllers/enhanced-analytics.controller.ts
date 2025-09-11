import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  EnhancedAnalyticsService,
  AnalyticsConfig,
  AnalyticsMetrics,
} from '../services/enhanced-analytics.service';

export interface TrackEventDto {
  category: string;
  action: string;
  label?: string;
  value?: number;
  customData?: Record<string, any>;
}

export interface UpdateConfigDto {
  provider?: 'google' | 'matomo' | 'plausible' | 'custom';
  trackingId?: string;
  domain?: string;
  scriptUrl?: string;
  config?: Record<string, any>;
  privacy?: {
    anonymizeIp?: boolean;
    trackLoggedInUsers?: boolean;
    cookieConsent?: boolean;
    dataRetentionDays?: number;
  };
  customDimensions?: Record<string, any>;
  excludedPaths?: string[];
  isActive?: boolean;
}

@Controller('api/analytics')
export class EnhancedAnalyticsController {
  private readonly logger = new Logger(EnhancedAnalyticsController.name);

  constructor(
    private readonly analyticsService: EnhancedAnalyticsService,
  ) {}

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
   * Met à jour la configuration analytics
   */
  @Put('config')
  async updateConfig(@Body() updates: UpdateConfigDto): Promise<AnalyticsConfig> {
    return this.analyticsService.updateConfig(updates);
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
   * Endpoint de compatibilité pour analytics.track.php
   */
  @Get('track.php')
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

    // Retourner le script directement pour compatibilité
    return result.script;
  }

  /**
   * Endpoint de compatibilité pour analytics.track.min.php
   */
  @Get('track.min.php')
  async getMinifiedTrackingScript(@Query('v') version?: string): Promise<string> {
    const result = await this.getTrackingScript('true', version || 'v7');
    return result.script;
  }

  /**
   * Endpoint de compatibilité pour v7.analytics.track.php
   */
  @Get('v7.track.php')
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
  async getMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<AnalyticsMetrics> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.analyticsService.getMetrics(start, end);
  }

  /**
   * Récupère les métriques pour une période spécifique
   */
  @Get('metrics/:period')
  async getMetricsForPeriod(
    @Param('period') period: 'today' | 'week' | 'month' | 'year',
  ): Promise<AnalyticsMetrics> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return this.analyticsService.getMetrics(startDate, now);
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
  async handleAnalyticsReport(@Body() batch: {
    type: string;
    events: any[];
    sessionId: string;
    timestamp: string;
  }) {
    this.logger.log(`📊 Analytics batch received: ${batch.events.length} events`);

    // Traiter chaque événement du batch
    const promises = batch.events.map(event =>
      this.analyticsService.trackEvent(
        event.category || 'batch',
        event.action || 'unknown',
        event.label,
        event.value,
        { 
          ...event.data,
          sessionId: batch.sessionId,
          batchType: batch.type,
        }
      )
    );

    await Promise.all(promises);

    return {
      success: true,
      processed: batch.events.length,
      timestamp: new Date().toISOString(),
    };
  }
}
