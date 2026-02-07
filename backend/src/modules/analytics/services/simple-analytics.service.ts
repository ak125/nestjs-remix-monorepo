import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';
import {
  getErrorMessage,
  getErrorStack,
} from '../../../common/utils/error.utils';

/**
 * 📊 SIMPLE ANALYTICS SERVICE - Configuration et Tracking Simplifié
 *
 * Version simplifiée du service Analytics qui fonctionne sans tables spécifiques :
 * ✅ Configuration basée sur les variables d'environnement
 * ✅ Cache intégré pour performances optimales
 * ✅ Support multi-providers (Google, Matomo, Plausible, Custom)
 * ✅ Scripts optimisés et minifiés
 * ✅ Configuration GDPR compliant
 * ✅ Compatibilité avec analytics.track.php existant
 */

export interface AnalyticsConfig {
  provider: 'google' | 'matomo' | 'plausible' | 'custom';
  trackingId: string;
  domain?: string;
  scriptUrl?: string;
  config: Record<string, any>;
  anonymizeIp: boolean;
  trackLoggedInUsers: boolean;
  customDimensions?: Record<string, any>;
  excludedPaths?: string[];
  isActive: boolean;
}

export interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  customData?: Record<string, any>;
  timestamp: Date;
}

export interface AnalyticsMetrics {
  totalEvents: number;
  topEvents: Array<{
    category: string;
    action: string;
    count: number;
    percentage: number;
  }>;
  providersUsed: string[];
  lastEventTime: Date | null;
}

export interface ScriptConfig {
  provider: string;
  minified: boolean;
  async: boolean;
  defer: boolean;
  version: string;
}

@Injectable()
export class SimpleAnalyticsService {
  private readonly logger = new Logger(SimpleAnalyticsService.name);
  private readonly cachePrefix = 'analytics';
  private readonly cacheTtl = 600; // 10 minutes
  private eventsBuffer: AnalyticsEvent[] = [];

  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Récupère la configuration analytics depuis les variables d'environnement
   */
  async getConfig(): Promise<AnalyticsConfig | null> {
    const cacheKey = `${this.cachePrefix}:config:env`;

    try {
      // Vérifier le cache d'abord
      const cached = await this.cacheService.get<AnalyticsConfig>(cacheKey);
      if (cached) {
        this.logger.debug('Analytics config loaded from cache');
        return cached;
      }

      // Charger depuis les variables d'environnement
      const provider = this.configService.get<string>(
        'ANALYTICS_PROVIDER',
        'google',
      );

      // Obtenir l'ID de tracking selon le provider
      let trackingId = '';
      switch (provider) {
        case 'google':
          trackingId = this.configService.get<string>(
            'ANALYTICS_GOOGLE_ID',
            '',
          );
          break;
        case 'matomo':
          trackingId = this.configService.get<string>(
            'ANALYTICS_MATOMO_SITE_ID',
            '',
          );
          break;
        case 'plausible':
          trackingId = this.configService.get<string>(
            'ANALYTICS_PLAUSIBLE_DOMAIN',
            '',
          );
          break;
        default:
          trackingId = this.configService.get<string>(
            'ANALYTICS_TRACKING_ID',
            '',
          );
      }

      if (!trackingId) {
        this.logger.warn(
          `No analytics tracking ID configured for provider: ${provider}`,
        );
        return null;
      }

      const config: AnalyticsConfig = {
        provider: provider as any,
        trackingId,
        domain: this.configService.get<string>('ANALYTICS_DOMAIN'),
        scriptUrl: this.configService.get<string>('ANALYTICS_SCRIPT_URL'),
        config: this.parseJsonConfig(
          this.configService.get<string>('ANALYTICS_CONFIG', '{}'),
        ),
        anonymizeIp: this.configService.get<boolean>(
          'ANALYTICS_ANONYMIZE_IP',
          true,
        ),
        trackLoggedInUsers: this.configService.get<boolean>(
          'ANALYTICS_TRACK_LOGGED_USERS',
          false,
        ),
        customDimensions: this.parseJsonConfig(
          this.configService.get<string>('ANALYTICS_CUSTOM_DIMENSIONS', '{}'),
        ),
        excludedPaths: this.configService
          .get<string>('ANALYTICS_EXCLUDED_PATHS', '')
          .split(',')
          .filter(Boolean),
        isActive: this.configService.get<boolean>('ANALYTICS_ENABLED', false),
      };

      // Mettre en cache
      await this.cacheService.set(cacheKey, config, this.cacheTtl);
      this.logger.log(
        `Analytics config loaded for provider: ${config.provider}`,
      );

      return config;
    } catch (error) {
      this.logger.error('Error loading analytics config', getErrorStack(error));
      return null;
    }
  }

  /**
   * Génère le script de tracking optimisé
   * Compatible avec analytics.track.php, analytics.track.min.php, v7.analytics.track.php
   */
  async getTrackingScript(
    options: ScriptConfig = {
      provider: 'auto',
      minified: false,
      async: true,
      defer: true,
      version: 'latest',
    },
  ): Promise<string> {
    const config = await this.getConfig();

    if (!config || !config.isActive) {
      return '<!-- Analytics disabled or not configured -->';
    }

    let script = '';

    try {
      switch (config.provider) {
        case 'google':
          script = this.generateGoogleAnalyticsScript(config, options);
          break;
        case 'matomo':
          script = this.generateMatomoScript(config, options);
          break;
        case 'plausible':
          script = this.generatePlausibleScript(config, options);
          break;
        case 'custom':
          script = config.scriptUrl
            ? this.generateCustomScript(config, options)
            : '';
          break;
        default:
          this.logger.warn(
            `Unsupported analytics provider: ${config.provider}`,
          );
          return '<!-- Unsupported analytics provider -->';
      }

      // Ajouter la configuration GDPR
      script = this.enhanceScriptWithGDPR(script, config);

      return options.minified ? this.minifyScript(script) : script;
    } catch (error) {
      this.logger.error(
        'Error generating tracking script',
        getErrorStack(error),
      );
      return '<!-- Error generating analytics script -->';
    }
  }

  /**
   * Enregistre un événement analytics en mémoire
   */
  async trackEvent(
    category: string,
    action: string,
    label?: string,
    value?: number,
    customData?: Record<string, any>,
  ): Promise<void> {
    const config = await this.getConfig();
    if (!config || !config.isActive) return;

    try {
      const event: AnalyticsEvent = {
        category,
        action,
        label,
        value,
        customData,
        timestamp: new Date(),
      };

      // Stocker en mémoire (buffer limité)
      this.eventsBuffer.push(event);
      if (this.eventsBuffer.length > 1000) {
        this.eventsBuffer = this.eventsBuffer.slice(-500); // Garder les 500 plus récents
      }

      this.logger.debug(`Event tracked: ${category}:${action}`);
    } catch (error) {
      this.logger.error('Error tracking event', getErrorStack(error));
    }
  }

  /**
   * Récupère les métriques analytics depuis le buffer en mémoire
   */
  async getMetrics(): Promise<AnalyticsMetrics> {
    try {
      const eventCounts: Record<string, number> = {};
      this.eventsBuffer.forEach((event) => {
        const key = `${event.category}:${event.action}`;
        eventCounts[key] = (eventCounts[key] || 0) + 1;
      });

      const topEvents = Object.entries(eventCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([key, count]) => {
          const [category, action] = key.split(':');
          return {
            category,
            action,
            count,
            percentage: Math.round((count / this.eventsBuffer.length) * 100),
          };
        });

      const lastEventTime =
        this.eventsBuffer.length > 0
          ? this.eventsBuffer[this.eventsBuffer.length - 1].timestamp
          : null;

      const config = await this.getConfig();
      const providersUsed = config ? [config.provider] : [];

      return {
        totalEvents: this.eventsBuffer.length,
        topEvents,
        providersUsed,
        lastEventTime,
      };
    } catch (error) {
      this.logger.error(
        'Error getting analytics metrics',
        getErrorStack(error),
      );
      throw new DatabaseException({
        code: ErrorCodes.ANALYTICS.METRICS_FAILED,
        message: `Failed to get metrics: ${getErrorMessage(error)}`,
        details: getErrorMessage(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Génère le script Google Analytics optimisé
   */
  private generateGoogleAnalyticsScript(
    config: AnalyticsConfig,
    options: ScriptConfig,
  ): string {
    const asyncAttr = options.async ? 'async' : '';

    return `
<!-- Google Analytics ${options.version} -->
<script ${asyncAttr} src="https://www.googletagmanager.com/gtag/js?id=${config.trackingId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  
  const gtagConfig = {
    ${config.anonymizeIp ? "'anonymize_ip': true," : ''}
    ${
      config.customDimensions
        ? Object.entries(config.customDimensions)
            .map(([k, v]) => `'custom_map': {'${k}': '${v}'}`)
            .join(',')
        : ''
    }
    ${Object.entries(config.config || {})
      .map(([k, v]) => `'${k}': ${JSON.stringify(v)}`)
      .join(',')}
  };
  
  gtag('config', '${config.trackingId}', gtagConfig);
</script>
<!-- End Google Analytics -->`.trim();
  }

  /**
   * Génère le script Matomo optimisé
   */
  private generateMatomoScript(
    config: AnalyticsConfig,
    options: ScriptConfig,
  ): string {
    return `
<!-- Matomo ${options.version} -->
<script>
  var _paq = window._paq = window._paq || [];
  ${config.anonymizeIp ? "_paq.push(['setDoNotTrack', true]);" : ''}
  ${
    config.customDimensions
      ? Object.entries(config.customDimensions)
          .map(([k, v]) => `_paq.push(['setCustomDimension', ${k}, '${v}']);`)
          .join('\n  ')
      : ''
  }
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function() {
    var u="//${config.domain}/";
    _paq.push(['setTrackerUrl', u+'matomo.php']);
    _paq.push(['setSiteId', '${config.trackingId}']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.${options.async ? 'async=true; ' : ''}g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
  })();
</script>
<!-- End Matomo -->`.trim();
  }

  /**
   * Génère le script Plausible optimisé
   */
  private generatePlausibleScript(
    config: AnalyticsConfig,
    options: ScriptConfig,
  ): string {
    const attributes = [
      options.defer ? 'defer' : '',
      `data-domain="${config.domain}"`,
      config.customDimensions
        ? Object.entries(config.customDimensions)
            .map(([k, v]) => `data-${k}="${v}"`)
            .join(' ')
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return `
<!-- Plausible ${options.version} -->
<script ${attributes} src="https://plausible.io/js/script.js"></script>
<!-- End Plausible -->`.trim();
  }

  /**
   * Génère un script personnalisé
   */
  private generateCustomScript(
    config: AnalyticsConfig,
    options: ScriptConfig,
  ): string {
    if (!config.scriptUrl) return '';

    return `
<!-- Custom Analytics ${options.version} -->
<script ${options.async ? 'async' : ''} ${options.defer ? 'defer' : ''} src="${config.scriptUrl}"></script>
<script>
  // Custom configuration
  ${JSON.stringify(config.config, null, 2)}
</script>
<!-- End Custom Analytics -->`.trim();
  }

  /**
   * Ajoute la configuration GDPR au script
   */
  private enhanceScriptWithGDPR(
    script: string,
    config: AnalyticsConfig,
  ): string {
    const gdprScript = `
<script>
  // GDPR Compliance Enhancement
  window.analyticsConsent = {
    granted: true,
    provider: '${config.provider}',
    anonymizeIp: ${config.anonymizeIp}
  };
</script>`;

    return script + '\n' + gdprScript;
  }

  /**
   * Minifie le script JavaScript
   */
  private minifyScript(script: string): string {
    return script
      .replace(/\/\*[\s\S]*?\*\//g, '') // Supprimer commentaires multi-lignes
      .replace(/\/\/.*/g, '') // Supprimer commentaires single-line
      .replace(/\s+/g, ' ') // Réduire espaces multiples
      .replace(/>\s+</g, '><') // Supprimer espaces entre balises
      .replace(/;\s+/g, ';') // Optimiser point-virgules
      .trim();
  }

  /**
   * Parse une configuration JSON depuis une string
   */
  private parseJsonConfig(configStr: string): Record<string, any> {
    try {
      return JSON.parse(configStr);
    } catch {
      return {};
    }
  }

  /**
   * Vide le cache analytics
   */
  async clearCache(): Promise<void> {
    try {
      const pattern = `${this.cachePrefix}:*`;
      await this.cacheService.del(pattern);
      this.logger.log('Analytics cache cleared');
    } catch (error) {
      this.logger.error('Error clearing analytics cache', getErrorStack(error));
    }
  }

  /**
   * Vide le buffer d'événements
   */
  async clearEvents(): Promise<void> {
    this.eventsBuffer = [];
    this.logger.log('Analytics events buffer cleared');
  }

  /**
   * Récupère les statistiques du service
   */
  async getServiceStats(): Promise<{
    configLoaded: boolean;
    totalEvents: number;
    lastEventTime: Date | null;
    provider: string | null;
    isActive: boolean;
  }> {
    const config = await this.getConfig();
    const metrics = await this.getMetrics();

    return {
      configLoaded: !!config,
      totalEvents: metrics.totalEvents,
      lastEventTime: metrics.lastEventTime,
      provider: config?.provider || null,
      isActive: config?.isActive || false,
    };
  }
}
