// Configuration centralisée pour éviter les dépendances circulaires
// Approche Context7 : centraliser la configuration

import { ConfigurationException, ErrorCodes } from '../common/exceptions';

export interface AppConfig {
  supabase: {
    url: string;
    serviceKey: string;
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

// Factory pattern pour la configuration
export function createAppConfig(): AppConfig {
  // Priorité Context7 : variables d'environnement direct d'abord
  const config: AppConfig = {
    supabase: {
      url:
        process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co',
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    },
    redis: {
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    app: {
      environment: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000'),
    },
  };

  // Validation Context7 : échouer rapidement si config invalide
  if (!config.supabase.serviceKey && config.app.environment === 'production') {
    throw new ConfigurationException({ code: ErrorCodes.CONFIG.MISSING, message: 'SUPABASE_SERVICE_ROLE_KEY is required in production' });
  }

  return config;
}

// Singleton pattern pour éviter les re-créations
let appConfigInstance: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  // Force refresh si l'URL a changé (Context7 fix)
  if (
    appConfigInstance &&
    appConfigInstance.supabase.url !==
      (process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co')
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
