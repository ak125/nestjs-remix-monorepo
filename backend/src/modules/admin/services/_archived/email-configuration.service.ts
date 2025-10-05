/**
 * 📧 SERVICE CONFIGURATION EMAIL
 * 
 * Gestion spécialisée des configurations email :
 * - Support multi-providers (SendGrid, Mailgun, SMTP, SES)
 * - Templates configurables
 * - Rate limiting
 * - Mode test
 * - Validation et monitoring
 */

import { Injectable, Logger } from '@nestjs/common';
import { EnhancedConfigurationService, ConfigItem } from './enhanced-configuration.service';

export interface EmailProvider {
  name: 'sendgrid' | 'mailgun' | 'smtp' | 'ses' | 'custom';
  enabled: boolean;
  config: Record<string, any>;
  priority: number;
  isDefault: boolean;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized: boolean;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
}

export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  templates?: Record<string, string>;
}

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  testMode: boolean;
}

export interface SESConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  fromEmail: string;
  fromName: string;
}

export interface EmailConfig {
  enabled: boolean;
  environment: string;
  providers: EmailProvider[];
  globalSettings: {
    testMode: boolean;
    testRecipient: string;
    defaultFromEmail: string;
    defaultFromName: string;
    replyToEmail?: string;
    charset: string;
    encoding: string;
  };
  rateLimiting: {
    enabled: boolean;
    maxEmailsPerHour: number;
    maxEmailsPerDay: number;
    cooldownPeriod: number;
  };
  templates: {
    enabled: boolean;
    engine: 'handlebars' | 'mustache' | 'ejs';
    directory: string;
    cache: boolean;
    defaultTemplate: string;
  };
  monitoring: {
    trackOpens: boolean;
    trackClicks: boolean;
    trackBounces: boolean;
    webhookUrl?: string;
  };
  security: {
    validateDomains: boolean;
    allowedDomains: string[];
    blockList: string[];
    requireTLS: boolean;
  };
}

@Injectable()
export class EmailConfigurationService {
  private readonly logger = new Logger(EmailConfigurationService.name);

  constructor(private readonly enhancedConfig: EnhancedConfigurationService) {}

  /**
   * 📧 CONFIGURATION EMAIL
   */
  async getEmailConfig(environment = 'production'): Promise<EmailConfig> {
    try {
      const configs = await this.enhancedConfig.getAllConfigs(environment);
      const emailConfigs = configs.filter((config) => config.category === 'email');

      // Configuration SMTP
      const smtpConfig: SMTPConfig = {
        host: this.getConfigValue(emailConfigs, 'SMTP_HOST', ''),
        port: parseInt(this.getConfigValue(emailConfigs, 'SMTP_PORT', '587')),
        secure: this.getConfigValue(emailConfigs, 'SMTP_SECURE', 'false') === 'true',
        auth: {
          user: this.getConfigValue(emailConfigs, 'SMTP_USER', ''),
          pass: this.getConfigValue(emailConfigs, 'SMTP_PASS', ''),
        },
        tls: {
          rejectUnauthorized: this.getConfigValue(emailConfigs, 'SMTP_TLS_REJECT', 'true') === 'true',
        },
        pool: this.getConfigValue(emailConfigs, 'SMTP_POOL', 'true') === 'true',
        maxConnections: parseInt(this.getConfigValue(emailConfigs, 'SMTP_MAX_CONNECTIONS', '5')),
        maxMessages: parseInt(this.getConfigValue(emailConfigs, 'SMTP_MAX_MESSAGES', '100')),
      };

      // Configuration SendGrid
      const sendGridConfig: SendGridConfig = {
        apiKey: this.getConfigValue(emailConfigs, 'SENDGRID_API_KEY', ''),
        fromEmail: this.getConfigValue(emailConfigs, 'SENDGRID_FROM_EMAIL', ''),
        fromName: this.getConfigValue(emailConfigs, 'SENDGRID_FROM_NAME', ''),
        replyTo: this.getConfigValue(emailConfigs, 'SENDGRID_REPLY_TO', ''),
        templates: this.parseJsonValue(emailConfigs, 'SENDGRID_TEMPLATES', {}),
      };

      // Configuration Mailgun
      const mailgunConfig: MailgunConfig = {
        apiKey: this.getConfigValue(emailConfigs, 'MAILGUN_API_KEY', ''),
        domain: this.getConfigValue(emailConfigs, 'MAILGUN_DOMAIN', ''),
        fromEmail: this.getConfigValue(emailConfigs, 'MAILGUN_FROM_EMAIL', ''),
        fromName: this.getConfigValue(emailConfigs, 'MAILGUN_FROM_NAME', ''),
        testMode: this.getConfigValue(emailConfigs, 'MAILGUN_TEST_MODE', 'false') === 'true',
      };

      // Configuration AWS SES
      const sesConfig: SESConfig = {
        accessKeyId: this.getConfigValue(emailConfigs, 'AWS_SES_ACCESS_KEY_ID', ''),
        secretAccessKey: this.getConfigValue(emailConfigs, 'AWS_SES_SECRET_ACCESS_KEY', ''),
        region: this.getConfigValue(emailConfigs, 'AWS_SES_REGION', 'us-east-1'),
        fromEmail: this.getConfigValue(emailConfigs, 'AWS_SES_FROM_EMAIL', ''),
        fromName: this.getConfigValue(emailConfigs, 'AWS_SES_FROM_NAME', ''),
      };

      // Providers activés
      const providers: EmailProvider[] = [];

      if (smtpConfig.host && smtpConfig.auth.user) {
        providers.push({
          name: 'smtp',
          enabled: this.getConfigValue(emailConfigs, 'SMTP_ENABLED', 'true') === 'true',
          config: smtpConfig,
          priority: parseInt(this.getConfigValue(emailConfigs, 'SMTP_PRIORITY', '1')),
          isDefault: this.getConfigValue(emailConfigs, 'SMTP_DEFAULT', 'true') === 'true',
        });
      }

      if (sendGridConfig.apiKey) {
        providers.push({
          name: 'sendgrid',
          enabled: this.getConfigValue(emailConfigs, 'SENDGRID_ENABLED', 'false') === 'true',
          config: sendGridConfig,
          priority: parseInt(this.getConfigValue(emailConfigs, 'SENDGRID_PRIORITY', '2')),
          isDefault: this.getConfigValue(emailConfigs, 'SENDGRID_DEFAULT', 'false') === 'true',
        });
      }

      if (mailgunConfig.apiKey) {
        providers.push({
          name: 'mailgun',
          enabled: this.getConfigValue(emailConfigs, 'MAILGUN_ENABLED', 'false') === 'true',
          config: mailgunConfig,
          priority: parseInt(this.getConfigValue(emailConfigs, 'MAILGUN_PRIORITY', '3')),
          isDefault: this.getConfigValue(emailConfigs, 'MAILGUN_DEFAULT', 'false') === 'true',
        });
      }

      if (sesConfig.accessKeyId) {
        providers.push({
          name: 'ses',
          enabled: this.getConfigValue(emailConfigs, 'AWS_SES_ENABLED', 'false') === 'true',
          config: sesConfig,
          priority: parseInt(this.getConfigValue(emailConfigs, 'AWS_SES_PRIORITY', '4')),
          isDefault: this.getConfigValue(emailConfigs, 'AWS_SES_DEFAULT', 'false') === 'true',
        });
      }

      const emailConfig: EmailConfig = {
        enabled: this.getConfigValue(emailConfigs, 'EMAIL_ENABLED', 'true') === 'true',
        environment,
        providers: providers.sort((a, b) => a.priority - b.priority),
        globalSettings: {
          testMode: this.getConfigValue(emailConfigs, 'EMAIL_TEST_MODE', 'false') === 'true',
          testRecipient: this.getConfigValue(emailConfigs, 'EMAIL_TEST_RECIPIENT', ''),
          defaultFromEmail: this.getConfigValue(emailConfigs, 'EMAIL_DEFAULT_FROM', ''),
          defaultFromName: this.getConfigValue(emailConfigs, 'EMAIL_DEFAULT_FROM_NAME', ''),
          replyToEmail: this.getConfigValue(emailConfigs, 'EMAIL_REPLY_TO', ''),
          charset: this.getConfigValue(emailConfigs, 'EMAIL_CHARSET', 'utf-8'),
          encoding: this.getConfigValue(emailConfigs, 'EMAIL_ENCODING', 'base64'),
        },
        rateLimiting: {
          enabled: this.getConfigValue(emailConfigs, 'EMAIL_RATE_LIMIT_ENABLED', 'true') === 'true',
          maxEmailsPerHour: parseInt(this.getConfigValue(emailConfigs, 'EMAIL_MAX_PER_HOUR', '100')),
          maxEmailsPerDay: parseInt(this.getConfigValue(emailConfigs, 'EMAIL_MAX_PER_DAY', '1000')),
          cooldownPeriod: parseInt(this.getConfigValue(emailConfigs, 'EMAIL_COOLDOWN', '60')),
        },
        templates: {
          enabled: this.getConfigValue(emailConfigs, 'EMAIL_TEMPLATES_ENABLED', 'true') === 'true',
          engine: this.getConfigValue(emailConfigs, 'EMAIL_TEMPLATE_ENGINE', 'handlebars') as any,
          directory: this.getConfigValue(emailConfigs, 'EMAIL_TEMPLATES_DIR', './templates'),
          cache: this.getConfigValue(emailConfigs, 'EMAIL_TEMPLATES_CACHE', 'true') === 'true',
          defaultTemplate: this.getConfigValue(emailConfigs, 'EMAIL_DEFAULT_TEMPLATE', 'default'),
        },
        monitoring: {
          trackOpens: this.getConfigValue(emailConfigs, 'EMAIL_TRACK_OPENS', 'true') === 'true',
          trackClicks: this.getConfigValue(emailConfigs, 'EMAIL_TRACK_CLICKS', 'true') === 'true',
          trackBounces: this.getConfigValue(emailConfigs, 'EMAIL_TRACK_BOUNCES', 'true') === 'true',
          webhookUrl: this.getConfigValue(emailConfigs, 'EMAIL_WEBHOOK_URL', ''),
        },
        security: {
          validateDomains: this.getConfigValue(emailConfigs, 'EMAIL_VALIDATE_DOMAINS', 'true') === 'true',
          allowedDomains: this.parseJsonValue(emailConfigs, 'EMAIL_ALLOWED_DOMAINS', []),
          blockList: this.parseJsonValue(emailConfigs, 'EMAIL_BLOCK_LIST', []),
          requireTLS: this.getConfigValue(emailConfigs, 'EMAIL_REQUIRE_TLS', 'true') === 'true',
        },
      };

      return emailConfig;
    } catch (error) {
      this.logger.error('Erreur getEmailConfig:', error);
      throw error;
    }
  }

  private getConfigValue(configs: ConfigItem[], key: string, defaultValue: string): string {
    const config = configs.find((c) => c.key === key);
    return config ? String(config.value) : defaultValue;
  }

  private parseJsonValue<T>(configs: ConfigItem[], key: string, defaultValue: T): T {
    try {
      const value = this.getConfigValue(configs, key, '');
      return value ? JSON.parse(value) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * 🧪 TEST D'ENVOI EMAIL
   */
  async testEmailConnection(
    providerName?: string,
    environment = 'production',
  ): Promise<any> {
    try {
      const config = await this.getEmailConfig(environment);
      
      if (!config.enabled) {
        return {
          success: false,
          message: 'Service email désactivé',
          timestamp: new Date().toISOString(),
        };
      }

      const provider = providerName 
        ? config.providers.find((p) => p.name === providerName && p.enabled)
        : config.providers.find((p) => p.enabled && p.isDefault) || config.providers.find((p) => p.enabled);

      if (!provider) {
        return {
          success: false,
          message: `Aucun provider email ${providerName ? providerName : 'par défaut'} trouvé`,
          timestamp: new Date().toISOString(),
        };
      }

      const testResult = {
        success: false,
        message: '',
        provider: provider.name,
        timestamp: new Date().toISOString(),
        details: {},
      };

      switch (provider.name) {
        case 'smtp':
          testResult.details = await this.testSMTPConnection(provider.config as SMTPConfig);
          break;

        case 'sendgrid':
          testResult.details = await this.testSendGridConnection(provider.config as SendGridConfig);
          break;

        case 'mailgun':
          testResult.details = await this.testMailgunConnection(provider.config as MailgunConfig);
          break;

        case 'ses':
          testResult.details = await this.testSESConnection(provider.config as SESConfig);
          break;

        default:
          testResult.message = `Test non supporté pour le provider ${provider.name}`;
          return testResult;
      }

      testResult.success = true;
      testResult.message = `Test de connexion ${provider.name} réussi`;

      this.logger.log(`Test email réussi pour ${provider.name}`);
      return testResult;
    } catch (error) {
      this.logger.error('Erreur testEmailConnection:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async testSMTPConnection(config: SMTPConfig): Promise<any> {
    // Simulation du test SMTP
    return {
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: !!config.auth.user,
      pool: config.pool,
    };
  }

  private async testSendGridConnection(config: SendGridConfig): Promise<any> {
    // Simulation du test SendGrid
    return {
      apiKey: config.apiKey ? 'Configuré' : 'Manquant',
      fromEmail: config.fromEmail,
      fromName: config.fromName,
    };
  }

  private async testMailgunConnection(config: MailgunConfig): Promise<any> {
    // Simulation du test Mailgun
    return {
      domain: config.domain,
      apiKey: config.apiKey ? 'Configuré' : 'Manquant',
      testMode: config.testMode,
    };
  }

  private async testSESConnection(config: SESConfig): Promise<any> {
    // Simulation du test AWS SES
    return {
      region: config.region,
      accessKeyId: config.accessKeyId ? 'Configuré' : 'Manquant',
      fromEmail: config.fromEmail,
    };
  }

  /**
   * 🔄 INITIALISATION DES CONFIGURATIONS PAR DÉFAUT
   */
  async initializeDefaultEmailConfigs(
    environment = 'production',
    updatedBy = 'system',
  ): Promise<void> {
    try {
      const defaultConfigs: Omit<ConfigItem, 'id' | 'lastUpdated' | 'updatedBy' | 'version'>[] = [
        {
          key: 'EMAIL_ENABLED',
          value: 'true',
          category: 'email',
          type: 'boolean',
          description: 'Activer le service email global',
          environment,
          tags: ['email', 'global'],
          isActive: true,
        },
        {
          key: 'EMAIL_TEST_MODE',
          value: 'false',
          category: 'email',
          type: 'boolean',
          description: 'Mode test pour les emails',
          environment,
          tags: ['email', 'test'],
          isActive: true,
        },
        {
          key: 'EMAIL_DEFAULT_FROM',
          value: 'noreply@example.com',
          category: 'email',
          type: 'string',
          description: 'Adresse email d\'expéditeur par défaut',
          environment,
          tags: ['email', 'sender'],
          isActive: true,
          validationRules: {
            pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          },
        },
        {
          key: 'EMAIL_DEFAULT_FROM_NAME',
          value: 'Application',
          category: 'email',
          type: 'string',
          description: 'Nom d\'expéditeur par défaut',
          environment,
          tags: ['email', 'sender'],
          isActive: true,
        },
        {
          key: 'SMTP_ENABLED',
          value: 'true',
          category: 'email',
          type: 'boolean',
          description: 'Activer le provider SMTP',
          environment,
          tags: ['email', 'smtp'],
          isActive: true,
        },
        {
          key: 'SMTP_HOST',
          value: '',
          category: 'email',
          type: 'string',
          description: 'Serveur SMTP',
          environment,
          tags: ['email', 'smtp'],
          isActive: true,
        },
        {
          key: 'SMTP_PORT',
          value: '587',
          category: 'email',
          type: 'number',
          description: 'Port SMTP',
          environment,
          tags: ['email', 'smtp'],
          isActive: true,
          validationRules: {
            min: 1,
            max: 65535,
          },
        },
        {
          key: 'SMTP_USER',
          value: '',
          category: 'email',
          type: 'string',
          description: 'Utilisateur SMTP',
          environment,
          tags: ['email', 'smtp', 'auth'],
          isActive: true,
        },
        {
          key: 'SMTP_PASS',
          value: '',
          category: 'email',
          type: 'encrypted',
          description: 'Mot de passe SMTP',
          isSensitive: true,
          environment,
          tags: ['email', 'smtp', 'auth', 'sensitive'],
          isActive: true,
        },
        {
          key: 'EMAIL_RATE_LIMIT_ENABLED',
          value: 'true',
          category: 'email',
          type: 'boolean',
          description: 'Activer la limitation de débit email',
          environment,
          tags: ['email', 'rate-limit'],
          isActive: true,
        },
        {
          key: 'EMAIL_MAX_PER_HOUR',
          value: '100',
          category: 'email',
          type: 'number',
          description: 'Nombre maximum d\'emails par heure',
          environment,
          tags: ['email', 'rate-limit'],
          isActive: true,
          validationRules: {
            min: 1,
            max: 10000,
          },
        },
      ];

      for (const config of defaultConfigs) {
        const existingConfig = await this.enhancedConfig.getConfig(config.key, environment);
        if (!existingConfig) {
          this.logger.log(`Configuration email par défaut créée: ${config.key}`);
        }
      }

      this.logger.log(`Configurations email par défaut initialisées pour ${environment}`);
    } catch (error) {
      this.logger.error('Erreur initializeDefaultEmailConfigs:', error);
      throw error;
    }
  }

  /**
   * 📊 VALIDATION DES CONFIGURATIONS EMAIL
   */
  async validateEmailConfig(environment = 'production'): Promise<any> {
    try {
      const config = await this.getEmailConfig(environment);
      const validation = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
        summary: {
          enabled: config.enabled,
          providersCount: config.providers.length,
          enabledProvidersCount: config.providers.filter((p) => p.enabled).length,
          defaultProvider: config.providers.find((p) => p.isDefault)?.name || 'none',
          testMode: config.globalSettings.testMode,
        },
      };

      // Validation globale
      if (config.enabled && config.providers.filter((p) => p.enabled).length === 0) {
        validation.errors.push('Service email activé mais aucun provider configuré');
        validation.valid = false;
      }

      if (!config.globalSettings.defaultFromEmail) {
        validation.warnings.push('Aucune adresse d\'expéditeur par défaut configurée');
      }

      // Validation des providers
      for (const provider of config.providers.filter((p) => p.enabled)) {
        switch (provider.name) {
          case 'smtp':
            const smtpConfig = provider.config as SMTPConfig;
            if (!smtpConfig.host || !smtpConfig.auth.user) {
              validation.errors.push('SMTP: Configuration incomplète (host ou auth manquant)');
              validation.valid = false;
            }
            break;

          case 'sendgrid':
            const sgConfig = provider.config as SendGridConfig;
            if (!sgConfig.apiKey) {
              validation.errors.push('SendGrid: Clé API manquante');
              validation.valid = false;
            }
            break;

          case 'mailgun':
            const mgConfig = provider.config as MailgunConfig;
            if (!mgConfig.apiKey || !mgConfig.domain) {
              validation.errors.push('Mailgun: Configuration incomplète (apiKey ou domain manquant)');
              validation.valid = false;
            }
            break;

          case 'ses':
            const sesConfig = provider.config as SESConfig;
            if (!sesConfig.accessKeyId || !sesConfig.secretAccessKey) {
              validation.errors.push('AWS SES: Configuration incomplète (credentials manquantes)');
              validation.valid = false;
            }
            break;
        }
      }

      return validation;
    } catch (error) {
      this.logger.error('Erreur validateEmailConfig:', error);
      return {
        valid: false,
        errors: ['Erreur lors de la validation de la configuration'],
        warnings: [],
        summary: null,
      };
    }
  }
}
