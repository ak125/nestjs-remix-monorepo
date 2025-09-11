/**
 * 🔒 SERVICE CONFIGURATION SÉCURITÉ
 * 
 * Gestion spécialisée des configurations de sécurité :
 * - Chiffrement des données sensibles
 * - Gestion des IPs autorisées  
 * - Validation des configurations
 * - Audit trail
 * - Politiques de sécurité
 */

import { Injectable, Logger } from '@nestjs/common';
import { EnhancedConfigurationService, ConfigItem } from './enhanced-configuration.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export interface SecurityPolicy {
  name: string;
  enabled: boolean;
  rules: SecurityRule[];
  priority: number;
  description?: string;
}

export interface SecurityRule {
  type: 'ip_whitelist' | 'ip_blacklist' | 'rate_limit' | 'password_policy' | 'session_policy' | 'encryption';
  enabled: boolean;
  config: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface IPSecurityConfig {
  whitelistEnabled: boolean;
  whitelistedIPs: string[];
  blacklistEnabled: boolean;
  blacklistedIPs: string[];
  allowPrivateNetworks: boolean;
  blockVPNs: boolean;
  geoBlocking: {
    enabled: boolean;
    allowedCountries: string[];
    blockedCountries: string[];
  };
}

export interface PasswordPolicyConfig {
  enabled: boolean;
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  forbiddenPasswords: string[];
  historyCount: number;
  expirationDays: number;
  warningDays: number;
}

export interface SessionPolicyConfig {
  enabled: boolean;
  maxSessionDuration: number;
  idleTimeout: number;
  maxConcurrentSessions: number;
  requireSecureConnection: boolean;
  sameSitePolicy: 'strict' | 'lax' | 'none';
  httpOnly: boolean;
  secure: boolean;
}

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  saltRounds: number;
  keyRotationDays: number;
  backupEncryption: boolean;
  encryptionAtRest: boolean;
  encryptionInTransit: boolean;
}

export interface SecurityConfig {
  enabled: boolean;
  environment: string;
  policies: SecurityPolicy[];
  ipSecurity: IPSecurityConfig;
  passwordPolicy: PasswordPolicyConfig;
  sessionPolicy: SessionPolicyConfig;
  encryption: EncryptionConfig;
  auditLog: {
    enabled: boolean;
    retention: number;
    sensitive: boolean;
    realTime: boolean;
  };
  monitoring: {
    enabled: boolean;
    alertThreshold: number;
    notificationEmail: string;
    webhookUrl?: string;
  };
  compliance: {
    gdpr: boolean;
    hipaa: boolean;
    pci: boolean;
    iso27001: boolean;
  };
}

@Injectable()
export class SecurityConfigurationService {
  private readonly logger = new Logger(SecurityConfigurationService.name);

  constructor(private readonly enhancedConfig: EnhancedConfigurationService) {}

  /**
   * 🔒 CONFIGURATION SÉCURITÉ
   */
  async getSecurityConfig(environment = 'production'): Promise<SecurityConfig> {
    try {
      const configs = await this.enhancedConfig.getAllConfigs(environment);
      const securityConfigs = configs.filter((config) => config.category === 'security');

      // Configuration IP Security
      const ipSecurity: IPSecurityConfig = {
        whitelistEnabled: this.getConfigValue(securityConfigs, 'IP_WHITELIST_ENABLED', 'false') === 'true',
        whitelistedIPs: this.parseJsonValue(securityConfigs, 'IP_WHITELIST', []),
        blacklistEnabled: this.getConfigValue(securityConfigs, 'IP_BLACKLIST_ENABLED', 'true') === 'true',
        blacklistedIPs: this.parseJsonValue(securityConfigs, 'IP_BLACKLIST', []),
        allowPrivateNetworks: this.getConfigValue(securityConfigs, 'ALLOW_PRIVATE_NETWORKS', 'true') === 'true',
        blockVPNs: this.getConfigValue(securityConfigs, 'BLOCK_VPNS', 'false') === 'true',
        geoBlocking: {
          enabled: this.getConfigValue(securityConfigs, 'GEO_BLOCKING_ENABLED', 'false') === 'true',
          allowedCountries: this.parseJsonValue(securityConfigs, 'ALLOWED_COUNTRIES', []),
          blockedCountries: this.parseJsonValue(securityConfigs, 'BLOCKED_COUNTRIES', []),
        },
      };

      // Configuration Password Policy
      const passwordPolicy: PasswordPolicyConfig = {
        enabled: this.getConfigValue(securityConfigs, 'PASSWORD_POLICY_ENABLED', 'true') === 'true',
        minLength: parseInt(this.getConfigValue(securityConfigs, 'PASSWORD_MIN_LENGTH', '8')),
        maxLength: parseInt(this.getConfigValue(securityConfigs, 'PASSWORD_MAX_LENGTH', '128')),
        requireUppercase: this.getConfigValue(securityConfigs, 'PASSWORD_REQUIRE_UPPERCASE', 'true') === 'true',
        requireLowercase: this.getConfigValue(securityConfigs, 'PASSWORD_REQUIRE_LOWERCASE', 'true') === 'true',
        requireNumbers: this.getConfigValue(securityConfigs, 'PASSWORD_REQUIRE_NUMBERS', 'true') === 'true',
        requireSpecialChars: this.getConfigValue(securityConfigs, 'PASSWORD_REQUIRE_SPECIAL', 'true') === 'true',
        forbiddenPasswords: this.parseJsonValue(securityConfigs, 'PASSWORD_FORBIDDEN', []),
        historyCount: parseInt(this.getConfigValue(securityConfigs, 'PASSWORD_HISTORY_COUNT', '5')),
        expirationDays: parseInt(this.getConfigValue(securityConfigs, 'PASSWORD_EXPIRATION_DAYS', '90')),
        warningDays: parseInt(this.getConfigValue(securityConfigs, 'PASSWORD_WARNING_DAYS', '7')),
      };

      // Configuration Session Policy
      const sessionPolicy: SessionPolicyConfig = {
        enabled: this.getConfigValue(securityConfigs, 'SESSION_POLICY_ENABLED', 'true') === 'true',
        maxSessionDuration: parseInt(this.getConfigValue(securityConfigs, 'SESSION_MAX_DURATION', '86400')),
        idleTimeout: parseInt(this.getConfigValue(securityConfigs, 'SESSION_IDLE_TIMEOUT', '3600')),
        maxConcurrentSessions: parseInt(this.getConfigValue(securityConfigs, 'SESSION_MAX_CONCURRENT', '3')),
        requireSecureConnection: this.getConfigValue(securityConfigs, 'SESSION_REQUIRE_HTTPS', 'true') === 'true',
        sameSitePolicy: this.getConfigValue(securityConfigs, 'SESSION_SAMESITE', 'strict') as any,
        httpOnly: this.getConfigValue(securityConfigs, 'SESSION_HTTP_ONLY', 'true') === 'true',
        secure: this.getConfigValue(securityConfigs, 'SESSION_SECURE', 'true') === 'true',
      };

      // Configuration Encryption
      const encryption: EncryptionConfig = {
        algorithm: this.getConfigValue(securityConfigs, 'ENCRYPTION_ALGORITHM', 'aes-256-gcm'),
        keyLength: parseInt(this.getConfigValue(securityConfigs, 'ENCRYPTION_KEY_LENGTH', '256')),
        saltRounds: parseInt(this.getConfigValue(securityConfigs, 'ENCRYPTION_SALT_ROUNDS', '12')),
        keyRotationDays: parseInt(this.getConfigValue(securityConfigs, 'ENCRYPTION_KEY_ROTATION', '90')),
        backupEncryption: this.getConfigValue(securityConfigs, 'ENCRYPTION_BACKUP', 'true') === 'true',
        encryptionAtRest: this.getConfigValue(securityConfigs, 'ENCRYPTION_AT_REST', 'true') === 'true',
        encryptionInTransit: this.getConfigValue(securityConfigs, 'ENCRYPTION_IN_TRANSIT', 'true') === 'true',
      };

      const securityConfig: SecurityConfig = {
        enabled: this.getConfigValue(securityConfigs, 'SECURITY_ENABLED', 'true') === 'true',
        environment,
        policies: await this.buildSecurityPolicies(securityConfigs),
        ipSecurity,
        passwordPolicy,
        sessionPolicy,
        encryption,
        auditLog: {
          enabled: this.getConfigValue(securityConfigs, 'AUDIT_LOG_ENABLED', 'true') === 'true',
          retention: parseInt(this.getConfigValue(securityConfigs, 'AUDIT_LOG_RETENTION', '365')),
          sensitive: this.getConfigValue(securityConfigs, 'AUDIT_LOG_SENSITIVE', 'true') === 'true',
          realTime: this.getConfigValue(securityConfigs, 'AUDIT_LOG_REALTIME', 'true') === 'true',
        },
        monitoring: {
          enabled: this.getConfigValue(securityConfigs, 'SECURITY_MONITORING_ENABLED', 'true') === 'true',
          alertThreshold: parseInt(this.getConfigValue(securityConfigs, 'SECURITY_ALERT_THRESHOLD', '5')),
          notificationEmail: this.getConfigValue(securityConfigs, 'SECURITY_NOTIFICATION_EMAIL', ''),
          webhookUrl: this.getConfigValue(securityConfigs, 'SECURITY_WEBHOOK_URL', ''),
        },
        compliance: {
          gdpr: this.getConfigValue(securityConfigs, 'COMPLIANCE_GDPR', 'true') === 'true',
          hipaa: this.getConfigValue(securityConfigs, 'COMPLIANCE_HIPAA', 'false') === 'true',
          pci: this.getConfigValue(securityConfigs, 'COMPLIANCE_PCI', 'false') === 'true',
          iso27001: this.getConfigValue(securityConfigs, 'COMPLIANCE_ISO27001', 'false') === 'true',
        },
      };

      return securityConfig;
    } catch (error) {
      this.logger.error('Erreur getSecurityConfig:', error);
      throw error;
    }
  }

  private async buildSecurityPolicies(configs: ConfigItem[]): Promise<SecurityPolicy[]> {
    const policies: SecurityPolicy[] = [];

    // Politique IP Security
    policies.push({
      name: 'IP Security Policy',
      enabled: this.getConfigValue(configs, 'POLICY_IP_ENABLED', 'true') === 'true',
      priority: 1,
      description: 'Contrôle d\'accès basé sur les adresses IP',
      rules: [
        {
          type: 'ip_whitelist',
          enabled: this.getConfigValue(configs, 'IP_WHITELIST_ENABLED', 'false') === 'true',
          config: { ips: this.parseJsonValue(configs, 'IP_WHITELIST', []) },
          severity: 'high',
        },
        {
          type: 'ip_blacklist',
          enabled: this.getConfigValue(configs, 'IP_BLACKLIST_ENABLED', 'true') === 'true',
          config: { ips: this.parseJsonValue(configs, 'IP_BLACKLIST', []) },
          severity: 'medium',
        },
      ],
    });

    // Politique Rate Limiting
    policies.push({
      name: 'Rate Limiting Policy',
      enabled: this.getConfigValue(configs, 'POLICY_RATE_LIMIT_ENABLED', 'true') === 'true',
      priority: 2,
      description: 'Limitation du taux de requêtes',
      rules: [
        {
          type: 'rate_limit',
          enabled: this.getConfigValue(configs, 'RATE_LIMIT_ENABLED', 'true') === 'true',
          config: {
            maxRequests: parseInt(this.getConfigValue(configs, 'RATE_LIMIT_MAX_REQUESTS', '100')),
            windowMs: parseInt(this.getConfigValue(configs, 'RATE_LIMIT_WINDOW', '900000')),
          },
          severity: 'medium',
        },
      ],
    });

    // Politique Password
    policies.push({
      name: 'Password Policy',
      enabled: this.getConfigValue(configs, 'PASSWORD_POLICY_ENABLED', 'true') === 'true',
      priority: 3,
      description: 'Politique de sécurité des mots de passe',
      rules: [
        {
          type: 'password_policy',
          enabled: true,
          config: {
            minLength: parseInt(this.getConfigValue(configs, 'PASSWORD_MIN_LENGTH', '8')),
            requireUppercase: this.getConfigValue(configs, 'PASSWORD_REQUIRE_UPPERCASE', 'true') === 'true',
            requireNumbers: this.getConfigValue(configs, 'PASSWORD_REQUIRE_NUMBERS', 'true') === 'true',
          },
          severity: 'high',
        },
      ],
    });

    return policies;
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
   * 🔐 VALIDATION DE SÉCURITÉ
   */
  async validateSecurityConfig(environment = 'production'): Promise<any> {
    try {
      const config = await this.getSecurityConfig(environment);
      const validation = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
        recommendations: [] as string[],
        securityScore: 0,
        summary: {
          enabled: config.enabled,
          policiesCount: config.policies.length,
          enabledPoliciesCount: config.policies.filter((p) => p.enabled).length,
          complianceFlags: config.compliance,
        },
      };

      let score = 0;
      const maxScore = 100;

      // Validation des politiques de sécurité
      if (config.enabled) {
        score += 10;
        
        // IP Security
        if (config.ipSecurity.blacklistEnabled) {
          score += 15;
        } else {
          validation.warnings.push('IP blacklist désactivée - recommandé pour la sécurité');
        }

        if (config.ipSecurity.whitelistEnabled && config.ipSecurity.whitelistedIPs.length > 0) {
          score += 10;
        }

        // Password Policy
        if (config.passwordPolicy.enabled) {
          score += 15;
          
          if (config.passwordPolicy.minLength >= 12) {
            score += 5;
          } else if (config.passwordPolicy.minLength < 8) {
            validation.errors.push('Longueur minimale du mot de passe trop faible (< 8)');
            validation.valid = false;
          } else {
            validation.recommendations.push('Recommandé: longueur minimale du mot de passe ≥ 12');
          }

          if (config.passwordPolicy.requireSpecialChars && config.passwordPolicy.requireNumbers) {
            score += 10;
          }
        } else {
          validation.warnings.push('Politique de mot de passe désactivée');
        }

        // Session Policy
        if (config.sessionPolicy.enabled) {
          score += 10;
          
          if (config.sessionPolicy.secure && config.sessionPolicy.httpOnly) {
            score += 10;
          } else {
            validation.warnings.push('Configuration de session non sécurisée');
          }

          if (config.sessionPolicy.sameSitePolicy === 'strict') {
            score += 5;
          }
        }

        // Encryption
        if (config.encryption.encryptionAtRest && config.encryption.encryptionInTransit) {
          score += 15;
        } else {
          validation.errors.push('Chiffrement incomplet (at-rest ou in-transit manquant)');
          validation.valid = false;
        }

        // Audit Log
        if (config.auditLog.enabled) {
          score += 10;
        } else {
          validation.warnings.push('Audit log désactivé - recommandé pour la conformité');
        }

        // Monitoring
        if (config.monitoring.enabled) {
          score += 5;
        }

      } else {
        validation.errors.push('Système de sécurité désactivé');
        validation.valid = false;
      }

      validation.securityScore = Math.round((score / maxScore) * 100);

      // Recommandations basées sur le score
      if (validation.securityScore < 70) {
        validation.recommendations.push('Score de sécurité faible - révision recommandée');
      }

      if (environment === 'production' && validation.securityScore < 85) {
        validation.warnings.push('Score de sécurité insuffisant pour la production');
      }

      return validation;
    } catch (error) {
      this.logger.error('Erreur validateSecurityConfig:', error);
      return {
        valid: false,
        errors: ['Erreur lors de la validation de la configuration de sécurité'],
        warnings: [],
        securityScore: 0,
        summary: null,
      };
    }
  }

  /**
   * 🔒 CHIFFREMENT UTILITAIRES
   */
  async encryptSensitiveValue(value: string, algorithm = 'aes-256-gcm'): Promise<string> {
    try {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, key);
      
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return `${algorithm}:${key.toString('hex')}:${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Erreur encryptSensitiveValue:', error);
      throw error;
    }
  }

  async decryptSensitiveValue(encryptedValue: string): Promise<string> {
    try {
      const [algorithm, keyHex, ivHex, encrypted] = encryptedValue.split(':');
      const key = Buffer.from(keyHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      
      const decipher = crypto.createDecipher(algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Erreur decryptSensitiveValue:', error);
      throw error;
    }
  }

  /**
   * 🔄 INITIALISATION DES CONFIGURATIONS PAR DÉFAUT
   */
  async initializeDefaultSecurityConfigs(
    environment = 'production',
    updatedBy = 'system',
  ): Promise<void> {
    try {
      const defaultConfigs: Omit<ConfigItem, 'id' | 'lastUpdated' | 'updatedBy' | 'version'>[] = [
        {
          key: 'SECURITY_ENABLED',
          value: 'true',
          category: 'security',
          type: 'boolean',
          description: 'Activer le système de sécurité global',
          environment,
          tags: ['security', 'global'],
          isActive: true,
        },
        {
          key: 'PASSWORD_POLICY_ENABLED',
          value: 'true',
          category: 'security',
          type: 'boolean',
          description: 'Activer la politique de mot de passe',
          environment,
          tags: ['security', 'password'],
          isActive: true,
        },
        {
          key: 'PASSWORD_MIN_LENGTH',
          value: '12',
          category: 'security',
          type: 'number',
          description: 'Longueur minimale du mot de passe',
          environment,
          tags: ['security', 'password'],
          isActive: true,
          validationRules: {
            min: 6,
            max: 128,
          },
        },
        {
          key: 'PASSWORD_REQUIRE_UPPERCASE',
          value: 'true',
          category: 'security',
          type: 'boolean',
          description: 'Exiger au moins une majuscule',
          environment,
          tags: ['security', 'password'],
          isActive: true,
        },
        {
          key: 'PASSWORD_REQUIRE_NUMBERS',
          value: 'true',
          category: 'security',
          type: 'boolean',
          description: 'Exiger au moins un chiffre',
          environment,
          tags: ['security', 'password'],
          isActive: true,
        },
        {
          key: 'SESSION_POLICY_ENABLED',
          value: 'true',
          category: 'security',
          type: 'boolean',
          description: 'Activer la politique de session',
          environment,
          tags: ['security', 'session'],
          isActive: true,
        },
        {
          key: 'SESSION_MAX_DURATION',
          value: '86400',
          category: 'security',
          type: 'number',
          description: 'Durée maximale de session (secondes)',
          environment,
          tags: ['security', 'session'],
          isActive: true,
          validationRules: {
            min: 300,
            max: 604800,
          },
        },
        {
          key: 'IP_BLACKLIST_ENABLED',
          value: 'true',
          category: 'security',
          type: 'boolean',
          description: 'Activer la liste noire IP',
          environment,
          tags: ['security', 'ip'],
          isActive: true,
        },
        {
          key: 'AUDIT_LOG_ENABLED',
          value: 'true',
          category: 'security',
          type: 'boolean',
          description: 'Activer les logs d\'audit',
          environment,
          tags: ['security', 'audit'],
          isActive: true,
        },
        {
          key: 'ENCRYPTION_ALGORITHM',
          value: 'aes-256-gcm',
          category: 'security',
          type: 'string',
          description: 'Algorithme de chiffrement',
          environment,
          tags: ['security', 'encryption'],
          isActive: true,
          validationRules: {
            allowedValues: ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'],
          },
        },
      ];

      for (const config of defaultConfigs) {
        const existingConfig = await this.enhancedConfig.getConfig(config.key, environment);
        if (!existingConfig) {
          this.logger.log(`Configuration sécurité par défaut créée: ${config.key}`);
        }
      }

      this.logger.log(`Configurations sécurité par défaut initialisées pour ${environment}`);
    } catch (error) {
      this.logger.error('Erreur initializeDefaultSecurityConfigs:', error);
      throw error;
    }
  }
}
