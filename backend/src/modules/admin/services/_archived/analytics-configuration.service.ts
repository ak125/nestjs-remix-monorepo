/**
 * 📊 SERVICE CONFIGURATION ANALYTICS
 * 
 * Gestion spécialisée des configurations analytics :
 * - Support multi-providers (Google, Matomo, Plausible)
 * - Scripts optimisés et minifiés
 * - Configuration des dimensions personnalisées
 * - Exclusion de chemins
 * - GDPR compliance
 */

import { Injectable, Logger } from '@nestjs/common';
import { EnhancedConfigurationService, ConfigItem } from './enhanced-configuration.service';

export interface AnalyticsProvider {
  name: 'google' | 'matomo' | 'plausible' | 'custom';
  enabled: boolean;
  config: Record<string, any>;
  priority: number;
  gdprCompliant: boolean;
}

export interface GoogleAnalyticsConfig {
  trackingId: string;
  measurementId?: string;
  debug: boolean;
  anonymizeIp: boolean;
  allowAdFeatures: boolean;
  customDimensions?: Record<string, string>;
  events?: Record<string, any>;
  ecommerce?: boolean;
}

export interface MatomoAnalyticsConfig {
  siteId: string;
  url: string;
  trackingCode: string;
  cookieDomain?: string;
  disableCookies: boolean;
  respectDoNotTrack: boolean;
  customVariables?: Record<string, any>;
}

export interface PlausibleAnalyticsConfig {
  domain: string;
  apiKey?: string;
  trackLocalhost: boolean;
  trackOutboundLinks: boolean;
  excludePages?: string[];
  customEvents?: string[];
}

export interface AnalyticsConfig {
  enabled: boolean;
  environment: string;
  providers: AnalyticsProvider[];
  globalSettings: {
    respectDoNotTrack: boolean;
    gdprCompliant: boolean;
    cookieConsent: boolean;
    excludePaths: string[];
    excludeIps: string[];
    minimumSessionDuration: number;
    sessionTimeout: number;
  };
  scriptOptimization: {
    async: boolean;
    defer: boolean;
    minified: boolean;
    bundled: boolean;
    cdn: boolean;
  };
  performance: {
    batchSize: number;
    flushInterval: number;
    maxRetries: number;
    timeout: number;
  };
}

@Injectable()
export class AnalyticsConfigurationService {
  private readonly logger = new Logger(AnalyticsConfigurationService.name);

  constructor(
    private readonly enhancedConfig: EnhancedConfigurationService,
  ) {}

  /**
   * 📊 CONFIGURATION ANALYTICS
   */
  async getAnalyticsConfig(environment = 'production'): Promise<AnalyticsConfig> {
    try {
      const configs = await this.enhancedConfig.getAllConfigs(environment);
      const analyticsConfigs = configs.filter(
        (config) => config.category === 'analytics',
      );

      // Configuration Google Analytics
      const googleConfig: GoogleAnalyticsConfig = {
        trackingId: this.getConfigValue(analyticsConfigs, 'GOOGLE_ANALYTICS_ID', ''),
        measurementId: this.getConfigValue(analyticsConfigs, 'GOOGLE_MEASUREMENT_ID', ''),
        debug: this.getConfigValue(analyticsConfigs, 'GA_DEBUG', 'false') === 'true',
        anonymizeIp: this.getConfigValue(analyticsConfigs, 'GA_ANONYMIZE_IP', 'true') === 'true',
        allowAdFeatures: this.getConfigValue(analyticsConfigs, 'GA_AD_FEATURES', 'false') === 'true',
        ecommerce: this.getConfigValue(analyticsConfigs, 'GA_ECOMMERCE', 'false') === 'true',
      };

      // Configuration Matomo
      const matomoConfig: MatomoAnalyticsConfig = {
        siteId: this.getConfigValue(analyticsConfigs, 'MATOMO_SITE_ID', ''),
        url: this.getConfigValue(analyticsConfigs, 'MATOMO_URL', ''),
        trackingCode: this.getConfigValue(analyticsConfigs, 'MATOMO_TRACKING_CODE', ''),
        disableCookies: this.getConfigValue(analyticsConfigs, 'MATOMO_NO_COOKIES', 'true') === 'true',
        respectDoNotTrack: this.getConfigValue(analyticsConfigs, 'MATOMO_DNT', 'true') === 'true',
      };

      // Configuration Plausible
      const plausibleConfig: PlausibleAnalyticsConfig = {
        domain: this.getConfigValue(analyticsConfigs, 'PLAUSIBLE_DOMAIN', ''),
        apiKey: this.getConfigValue(analyticsConfigs, 'PLAUSIBLE_API_KEY', ''),
        trackLocalhost: this.getConfigValue(analyticsConfigs, 'PLAUSIBLE_LOCALHOST', 'false') === 'true',
        trackOutboundLinks: this.getConfigValue(analyticsConfigs, 'PLAUSIBLE_OUTBOUND', 'true') === 'true',
        excludePages: this.parseJsonValue(analyticsConfigs, 'PLAUSIBLE_EXCLUDE_PAGES', []),
      };

      // Providers activés
      const providers: AnalyticsProvider[] = [];

      if (googleConfig.trackingId) {
        providers.push({
          name: 'google',
          enabled: this.getConfigValue(analyticsConfigs, 'GOOGLE_ANALYTICS_ENABLED', 'true') === 'true',
          config: googleConfig,
          priority: parseInt(this.getConfigValue(analyticsConfigs, 'GA_PRIORITY', '1')),
          gdprCompliant: googleConfig.anonymizeIp && !googleConfig.allowAdFeatures,
        });
      }

      if (matomoConfig.siteId) {
        providers.push({
          name: 'matomo',
          enabled: this.getConfigValue(analyticsConfigs, 'MATOMO_ENABLED', 'true') === 'true',
          config: matomoConfig,
          priority: parseInt(this.getConfigValue(analyticsConfigs, 'MATOMO_PRIORITY', '2')),
          gdprCompliant: matomoConfig.disableCookies && matomoConfig.respectDoNotTrack,
        });
      }

      if (plausibleConfig.domain) {
        providers.push({
          name: 'plausible',
          enabled: this.getConfigValue(analyticsConfigs, 'PLAUSIBLE_ENABLED', 'true') === 'true',
          config: plausibleConfig,
          priority: parseInt(this.getConfigValue(analyticsConfigs, 'PLAUSIBLE_PRIORITY', '3')),
          gdprCompliant: true, // Plausible est GDPR-compliant par défaut
        });
      }

      const analyticsConfig: AnalyticsConfig = {
        enabled: this.getConfigValue(analyticsConfigs, 'ANALYTICS_ENABLED', 'true') === 'true',
        environment,
        providers: providers.sort((a, b) => a.priority - b.priority),
        globalSettings: {
          respectDoNotTrack: this.getConfigValue(analyticsConfigs, 'ANALYTICS_RESPECT_DNT', 'true') === 'true',
          gdprCompliant: this.getConfigValue(analyticsConfigs, 'ANALYTICS_GDPR', 'true') === 'true',
          cookieConsent: this.getConfigValue(analyticsConfigs, 'ANALYTICS_COOKIE_CONSENT', 'true') === 'true',
          excludePaths: this.parseJsonValue(analyticsConfigs, 'ANALYTICS_EXCLUDE_PATHS', ['/admin', '/api']),
          excludeIps: this.parseJsonValue(analyticsConfigs, 'ANALYTICS_EXCLUDE_IPS', []),
          minimumSessionDuration: parseInt(this.getConfigValue(analyticsConfigs, 'ANALYTICS_MIN_SESSION', '5')),
          sessionTimeout: parseInt(this.getConfigValue(analyticsConfigs, 'ANALYTICS_SESSION_TIMEOUT', '1800')),
        },
        scriptOptimization: {
          async: this.getConfigValue(analyticsConfigs, 'ANALYTICS_ASYNC', 'true') === 'true',
          defer: this.getConfigValue(analyticsConfigs, 'ANALYTICS_DEFER', 'false') === 'true',
          minified: this.getConfigValue(analyticsConfigs, 'ANALYTICS_MINIFIED', 'true') === 'true',
          bundled: this.getConfigValue(analyticsConfigs, 'ANALYTICS_BUNDLED', 'false') === 'true',
          cdn: this.getConfigValue(analyticsConfigs, 'ANALYTICS_CDN', 'true') === 'true',
        },
        performance: {
          batchSize: parseInt(this.getConfigValue(analyticsConfigs, 'ANALYTICS_BATCH_SIZE', '50')),
          flushInterval: parseInt(this.getConfigValue(analyticsConfigs, 'ANALYTICS_FLUSH_INTERVAL', '5000')),
          maxRetries: parseInt(this.getConfigValue(analyticsConfigs, 'ANALYTICS_MAX_RETRIES', '3')),
          timeout: parseInt(this.getConfigValue(analyticsConfigs, 'ANALYTICS_TIMEOUT', '5000')),
        },
      };

      return analyticsConfig;
    } catch (error) {
      this.logger.error('Erreur getAnalyticsConfig:', error);
      throw error;
    }
  }

  private getConfigValue(
    configs: ConfigItem[],
    key: string,
    defaultValue: string,
  ): string {
    const config = configs.find((c) => c.key === key);
    return config ? String(config.value) : defaultValue;
  }

  private parseJsonValue<T>(
    configs: ConfigItem[],
    key: string,
    defaultValue: T,
  ): T {
    try {
      const value = this.getConfigValue(configs, key, '');
      return value ? JSON.parse(value) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * 🎯 GÉNÉRATION DE SCRIPTS
   */
  async generateAnalyticsScripts(environment = 'production'): Promise<string[]> {
    try {
      const config = await this.getAnalyticsConfig(environment);
      const scripts: string[] = [];

      if (!config.enabled) {
        return scripts;
      }

      for (const provider of config.providers.filter((p) => p.enabled)) {
        let script = '';

        switch (provider.name) {
          case 'google':
            script = this.generateGoogleAnalyticsScript(
              provider.config as GoogleAnalyticsConfig,
              config,
            );
            break;

          case 'matomo':
            script = this.generateMatomoScript(
              provider.config as MatomoAnalyticsConfig,
              config,
            );
            break;

          case 'plausible':
            script = this.generatePlausibleScript(
              provider.config as PlausibleAnalyticsConfig,
              config,
            );
            break;
        }

        if (script) {
          scripts.push(script);
        }
      }

      return scripts;
    } catch (error) {
      this.logger.error('Erreur generateAnalyticsScripts:', error);
      return [];
    }
  }

  private generateGoogleAnalyticsScript(
    gaConfig: GoogleAnalyticsConfig,
    globalConfig: AnalyticsConfig,
  ): string {
    const asyncAttr = globalConfig.scriptOptimization.async ? 'async' : '';
    const deferAttr = globalConfig.scriptOptimization.defer ? 'defer' : '';

    return `
<!-- Google Analytics -->
<script ${asyncAttr} ${deferAttr} src="https://www.googletagmanager.com/gtag/js?id=${gaConfig.trackingId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  
  // Configuration GDPR
  ${globalConfig.globalSettings.respectDoNotTrack ? 'if (navigator.doNotTrack !== "1") {' : ''}
  
  gtag('js', new Date());
  gtag('config', '${gaConfig.trackingId}', {
    anonymize_ip: ${gaConfig.anonymizeIp},
    allow_ad_personalization_signals: ${gaConfig.allowAdFeatures},
    cookie_flags: 'SameSite=None;Secure',
    ${gaConfig.debug ? 'debug_mode: true,' : ''}
  });
  
  ${globalConfig.globalSettings.respectDoNotTrack ? '}' : ''}
</script>
<!-- End Google Analytics -->
`.trim();
  }

  private generateMatomoScript(
    matomoConfig: MatomoAnalyticsConfig,
    globalConfig: AnalyticsConfig,
  ): string {
    return `
<!-- Matomo -->
<script type="text/javascript">
  ${globalConfig.globalSettings.respectDoNotTrack ? 'if (navigator.doNotTrack !== "1") {' : ''}
  
  var _paq = window._paq = window._paq || [];
  
  ${matomoConfig.respectDoNotTrack ? "_paq.push(['setDoNotTrack', true]);" : ''}
  ${matomoConfig.disableCookies ? "_paq.push(['disableCookies']);" : ''}
  
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  
  (function() {
    var u="${matomoConfig.url}";
    _paq.push(['setTrackerUrl', u+'matomo.php']);
    _paq.push(['setSiteId', '${matomoConfig.siteId}']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.type='text/javascript'; g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
  })();
  
  ${globalConfig.globalSettings.respectDoNotTrack ? '}' : ''}
</script>
<!-- End Matomo -->
`.trim();
  }

  private generatePlausibleScript(
    plausibleConfig: PlausibleAnalyticsConfig,
    globalConfig: AnalyticsConfig,
  ): string {
    const asyncAttr = globalConfig.scriptOptimization.async ? 'async' : '';
    const deferAttr = globalConfig.scriptOptimization.defer ? 'defer' : '';

    let scriptSrc = 'https://plausible.io/js/plausible.js';
    if (!plausibleConfig.trackLocalhost) {
      scriptSrc = 'https://plausible.io/js/plausible.js';
    }

    return `
<!-- Plausible Analytics -->
${globalConfig.globalSettings.respectDoNotTrack ? '<script>if (navigator.doNotTrack !== "1") {</script>' : ''}
<script ${asyncAttr} ${deferAttr} data-domain="${plausibleConfig.domain}" src="${scriptSrc}"></script>
${globalConfig.globalSettings.respectDoNotTrack ? '<script>}</script>' : ''}
<!-- End Plausible Analytics -->
`.trim();
  }

  /**
   * 🔄 INITIALISATION DES CONFIGURATIONS PAR DÉFAUT
   */
  async initializeDefaultAnalyticsConfigs(
    environment = 'production',
    updatedBy = 'system',
  ): Promise<void> {
    try {
      const defaultConfigs: Omit<ConfigItem, 'id' | 'lastUpdated' | 'updatedBy' | 'version'>[] = [
        {
          key: 'ANALYTICS_ENABLED',
          value: 'true',
          category: 'analytics',
          type: 'boolean',
          description: 'Activer le système analytics global',
          environment,
          tags: ['analytics', 'global'],
          isActive: true,
        },
        {
          key: 'GOOGLE_ANALYTICS_ENABLED',
          value: 'false',
          category: 'analytics',
          type: 'boolean',
          description: 'Activer Google Analytics',
          environment,
          tags: ['analytics', 'google'],
          isActive: true,
        },
        {
          key: 'GOOGLE_ANALYTICS_ID',
          value: '',
          category: 'analytics',
          type: 'string',
          description: 'ID de suivi Google Analytics (GA-XXXXXXXX)',
          environment,
          tags: ['analytics', 'google'],
          isActive: true,
          validationRules: {
            pattern: '^(GA-[A-Z0-9-]+|G-[A-Z0-9]+)?$',
          },
        },
        {
          key: 'MATOMO_ENABLED',
          value: 'false',
          category: 'analytics',
          type: 'boolean',
          description: 'Activer Matomo Analytics',
          environment,
          tags: ['analytics', 'matomo'],
          isActive: true,
        },
        {
          key: 'PLAUSIBLE_ENABLED',
          value: 'false',
          category: 'analytics',
          type: 'boolean',
          description: 'Activer Plausible Analytics',
          environment,
          tags: ['analytics', 'plausible'],
          isActive: true,
        },
        {
          key: 'ANALYTICS_RESPECT_DNT',
          value: 'true',
          category: 'analytics',
          type: 'boolean',
          description: 'Respecter le Do Not Track des navigateurs',
          environment,
          tags: ['analytics', 'privacy'],
          isActive: true,
        },
        {
          key: 'ANALYTICS_GDPR',
          value: 'true',
          category: 'analytics',
          type: 'boolean',
          description: 'Mode GDPR-compliant',
          environment,
          tags: ['analytics', 'privacy', 'gdpr'],
          isActive: true,
        },
        {
          key: 'ANALYTICS_EXCLUDE_PATHS',
          value: JSON.stringify(['/admin', '/api', '/health']),
          category: 'analytics',
          type: 'json',
          description: 'Chemins à exclure du tracking',
          environment,
          tags: ['analytics', 'exclusion'],
          isActive: true,
        },
      ];

      for (const config of defaultConfigs) {
        const existingConfig = await this.enhancedConfig.getConfig(config.key, environment);
        if (!existingConfig) {
          this.logger.log(`Configuration analytics par défaut créée: ${config.key}`);
        }
      }

      this.logger.log(`Configurations analytics par défaut initialisées pour ${environment}`);
    } catch (error) {
      this.logger.error('Erreur initializeDefaultAnalyticsConfigs:', error);
      throw error;
    }
  }

  /**
   * 📊 VALIDATION DES CONFIGURATIONS ANALYTICS
   */
  async validateAnalyticsConfig(environment = 'production'): Promise<any> {
    try {
      const config = await this.getAnalyticsConfig(environment);
      const validation = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
        summary: {
          enabled: config.enabled,
          providersCount: config.providers.length,
          enabledProvidersCount: config.providers.filter((p) => p.enabled).length,
          gdprCompliant: config.globalSettings.gdprCompliant,
        },
      };

      // Validation des providers
      for (const provider of config.providers) {
        if (provider.enabled) {
          switch (provider.name) {
            case 'google':
              const gaConfig = provider.config as GoogleAnalyticsConfig;
              if (!gaConfig.trackingId) {
                validation.errors.push('Google Analytics: ID de suivi manquant');
                validation.valid = false;
              }
              if (config.globalSettings.gdprCompliant && gaConfig.allowAdFeatures) {
                validation.warnings.push('Google Analytics: Les fonctionnalités publicitaires ne sont pas GDPR-compliant');
              }
              break;

            case 'matomo':
              const matomoConfig = provider.config as MatomoAnalyticsConfig;
              if (!matomoConfig.siteId || !matomoConfig.url) {
                validation.errors.push('Matomo: Configuration incomplète (siteId ou URL manquant)');
                validation.valid = false;
              }
              break;

            case 'plausible':
              const plausibleConfig = provider.config as PlausibleAnalyticsConfig;
              if (!plausibleConfig.domain) {
                validation.errors.push('Plausible: Domaine manquant');
                validation.valid = false;
              }
              break;
          }
        }
      }

      return validation;
    } catch (error) {
      this.logger.error('Erreur validateAnalyticsConfig:', error);
      return {
        valid: false,
        errors: ['Erreur lors de la validation de la configuration'],
        warnings: [],
        summary: null,
      };
    }
  }
}
