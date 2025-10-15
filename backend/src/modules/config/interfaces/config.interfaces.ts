/**
 * 🔧 CONFIG INTERFACES - Types et Interfaces de Configuration
 *
 * Définit tous les types nécessaires pour le module de configuration
 */

export type ConfigEnvironment =
  | 'development'
  | 'production'
  | 'test'
  | 'staging';

export interface ConfigModuleOptions {
  /** Active le système de cache pour les configurations */
  cacheEnabled?: boolean;

  /** Durée de vie du cache en secondes */
  cacheTTL?: number;

  /** Clé de chiffrement pour les données sensibles */
  encryptionKey?: string;

  /** Environnement d'exécution */
  environment?: ConfigEnvironment;

  /** Active la validation des configurations */
  validationEnabled?: boolean;

  /** Active le monitoring des configurations */
  monitoringEnabled?: boolean;

  /** Active les fonctionnalités de sécurité */
  securityEnabled?: boolean;

  /** Préfixe pour les clés de cache */
  cachePrefix?: string;

  /** Configurations par défaut */
  defaults?: Record<string, any>;
}

export interface DatabaseConfig {
  /** URL de connexion à la base de données */
  url: string;

  /** Clé de service pour l'authentification */
  serviceKey: string;

  /** Pool de connexions */
  poolSize?: number;

  /** Timeout de connexion */
  timeout?: number;

  /** SSL activé */
  ssl?: boolean;
}

export interface CacheConfig {
  /** Type de cache (redis, memory) */
  type: 'redis' | 'memory';

  /** URL de connexion Redis */
  url?: string;

  /** Host Redis */
  host?: string;

  /** Port Redis */
  port?: number;

  /** TTL par défaut */
  defaultTTL: number;

  /** Taille maximum du cache mémoire */
  maxSize?: number;
}

export interface SecurityConfig {
  /** Clé de chiffrement principale */
  encryptionKey: string;

  /** Algorithme de chiffrement */
  algorithm?: string;

  /** Salt pour le hashing */
  salt?: string;

  /** Longueur des tokens */
  tokenLength?: number;
}

export interface MonitoringConfig {
  /** Active les métriques */
  enabled: boolean;

  /** Interval de collecte des métriques */
  interval?: number;

  /** Logs détaillés */
  verbose?: boolean;

  /** Alerte sur erreurs */
  alertOnError?: boolean;
}

export interface MetadataConfig {
  /** Titre par défaut */
  defaultTitle: string;

  /** Description par défaut */
  defaultDescription: string;

  /** Mots-clés par défaut */
  defaultKeywords: string[];

  /** Auteur */
  author?: string;

  /** Language par défaut */
  defaultLanguage?: string;
}

export interface BreadcrumbConfig {
  /** Séparateur par défaut */
  separator: string;

  /** Affichage du home */
  showHome: boolean;

  /** Texte du home */
  homeText: string;

  /** URL du home */
  homeUrl: string;

  /** Maximum d'éléments */
  maxItems?: number;
}

export interface ApplicationConfig {
  /** Nom de l'application */
  name: string;

  /** Version de l'application */
  version: string;

  /** Port d'écoute */
  port: number;

  /** Host d'écoute */
  host: string;

  /** Environnement */
  environment: ConfigEnvironment;

  /** Mode debug */
  debug: boolean;

  /** CORS activé */
  corsEnabled: boolean;

  /** Origins autorisées */
  allowedOrigins: string[];
}

export interface FullConfigSchema {
  app: ApplicationConfig;
  database: DatabaseConfig;
  cache: CacheConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  metadata: MetadataConfig;
  breadcrumb: BreadcrumbConfig;
  [key: string]: any; // Pour les configurations custom
}

export interface ConfigValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: ConfigValidationError[];
  warnings: string[];
}

export interface ConfigChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  source: string;
  userId?: string;
}

export interface ConfigAuditLog {
  id: string;
  action: 'create' | 'update' | 'delete' | 'read';
  key: string;
  value?: any;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  environment: ConfigEnvironment;
  config: Partial<FullConfigSchema>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
