// Configuration centralisée pour éviter les dépendances circulaires
// Approche Context7 : centraliser la configuration

import { Logger } from '@nestjs/common';
import { ConfigurationException, ErrorCodes } from '@common/exceptions';

// Re-export pour compatibilite — la source de verite est site.constants.ts
export { SITE_ORIGIN } from './site.constants';

export interface AppConfig {
  supabase: {
    url: string;
    serviceKey: string;
    anonKey: string;
    readOnly: boolean;
  };
  redis: {
    url?: string;
    host?: string;
    port?: number;
  };
  app: {
    environment: string;
    port: number;
  };
}

/** Options de connexion ioredis / BullMQ de la cible Redis. */
export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
}

type EnvReader = (key: string) => string | undefined;

const readProcessEnv: EnvReader = (key) => process.env[key];

const redisConfigLogger = new Logger('RedisConfig');

/**
 * Cible Redis unique du backend.
 *
 * REDIS_URL est requis au boot (env-validation.ts) et fait autorité : hôte, port,
 * identifiant, mot de passe, base et TLS en sont dérivés. Tout consommateur qui
 * ouvre sa propre connexion passe par ici ; sinon une instance lancée avec son
 * propre REDIS_URL partage encore, via REDIS_HOST||localhost, les files BullMQ,
 * verrous et clés anti-rejeu d'une autre instance.
 *
 * - REDIS_HOST / REDIS_PORT ne servent qu'en l'absence de REDIS_URL (tests,
 *   scripts hors boot). S'ils désignent une autre cible, ils sont ignorés et un
 *   avertissement le dit.
 * - REDIS_PASSWORD ne complète que si l'URL n'en porte pas (comportement
 *   antérieur des consommateurs qui le lisaient).
 * - REDIS_URL illisible ou hors redis:// / rediss:// → exception. Le message ne
 *   reprend jamais l'URL, qui peut contenir un mot de passe.
 *
 * `read` permet à un service de lire via son ConfigService injecté.
 */
export function redisConnectionOptions(
  read: EnvReader = readProcessEnv,
): RedisConnectionOptions {
  const envHost = read('REDIS_HOST') || undefined;
  const envPort = read('REDIS_PORT') || undefined;
  const envPassword = read('REDIS_PASSWORD') || undefined;
  const url = read('REDIS_URL');

  if (!url) {
    return {
      host: envHost ?? 'localhost',
      port: parseInt(envPort ?? '6379', 10),
      password: envPassword,
    };
  }

  const target = parseRedisUrl(url);
  if (
    (envHost !== undefined && envHost !== target.host) ||
    (envPort !== undefined && parseInt(envPort, 10) !== target.port)
  ) {
    redisConfigLogger.warn(
      `REDIS_HOST/REDIS_PORT (${envHost ?? '-'}:${envPort ?? '-'}) ignorés : REDIS_URL désigne ${target.host}:${target.port}`,
    );
  }
  return { ...target, password: target.password ?? envPassword };
}

function parseRedisUrl(url: string): RedisConnectionOptions {
  const invalid = (detail: string) =>
    new ConfigurationException({
      code: ErrorCodes.CONFIG.LOAD_FAILED,
      message: `REDIS_URL invalide (${detail}) : attendu redis://[utilisateur:motdepasse@]hote[:port][/base] ou rediss://…`,
    });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw invalid('illisible');
  }
  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw invalid('schéma');
  }
  const host = parsed.hostname.replace(/^\[(.*)\]$/, '$1');
  if (!host) {
    throw invalid('hôte absent');
  }
  const dbPath = parsed.pathname.replace(/^\//, '');
  const db = dbPath === '' ? undefined : Number(dbPath);
  if (db !== undefined && !(Number.isInteger(db) && db >= 0)) {
    throw invalid('base');
  }

  return {
    host,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

// Factory pattern pour la configuration
export function createAppConfig(): AppConfig {
  const redisTarget = redisConnectionOptions();
  // Priorité Context7 : variables d'environnement direct d'abord
  const config: AppConfig = {
    supabase: {
      url: process.env.SUPABASE_URL || '',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      anonKey: process.env.SUPABASE_ANON_KEY || '',
      readOnly: process.env.READ_ONLY === 'true',
    },
    redis: {
      url: process.env.REDIS_URL,
      host: redisTarget.host,
      port: redisTarget.port,
    },
    app: {
      environment: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000'),
    },
  };

  // Validation Context7 : échouer rapidement si config invalide.
  // ADR-028 Option D — READ_ONLY=true overrides this check : preprod sets
  // NODE_ENV=production (Dockerfile L39/L63 + docker-compose.preprod.yml L9) for
  // Node/library optimizations, but the deploy intentionally omits SERVICE_ROLE_KEY
  // in favor of ANON_KEY + RLS protection. The dedicated check below validates
  // the anon-key requirement for read-only mode.
  if (
    !config.supabase.serviceKey &&
    config.app.environment === 'production' &&
    !config.supabase.readOnly
  ) {
    throw new ConfigurationException({
      code: ErrorCodes.CONFIG.MISSING,
      message: 'SUPABASE_SERVICE_ROLE_KEY is required in production',
    });
  }

  // ADR-028 Option D : READ_ONLY mode requires SUPABASE_ANON_KEY (privilege downgrade)
  if (config.supabase.readOnly && !config.supabase.anonKey) {
    throw new ConfigurationException({
      code: ErrorCodes.CONFIG.MISSING,
      message:
        'READ_ONLY=true requires SUPABASE_ANON_KEY (ADR-028 Option D — anon key + RLS protection per ADR-021)',
    });
  }

  return config;
}

// Singleton pattern pour éviter les re-créations
let appConfigInstance: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  // Force refresh si l'URL a changé (Context7 fix)
  if (
    appConfigInstance &&
    appConfigInstance.supabase.url !== (process.env.SUPABASE_URL || '')
  ) {
    appConfigInstance = null;
  }

  if (!appConfigInstance) {
    appConfigInstance = createAppConfig();
  }
  return appConfigInstance;
}

export function resetAppConfig(): void {
  appConfigInstance = null;
}
