import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getAppConfig } from '../../config/app.config';

@Injectable()
export abstract class SupabaseBaseService {
  protected readonly logger = new Logger(SupabaseBaseService.name);
  protected readonly supabase: SupabaseClient;
  protected readonly supabaseUrl: string;
  protected readonly supabaseServiceKey: string;
  protected readonly baseUrl: string;

  constructor(protected configService?: ConfigService) {
    // Context7 : Resilient configuration loading
    const appConfig = getAppConfig();

    // Essayer d'utiliser ConfigService en premier, sinon utiliser la config centralisée
    if (configService) {
      this.supabaseUrl =
        configService.get<string>('SUPABASE_URL') || appConfig.supabase.url;
      this.supabaseServiceKey =
        configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
        appConfig.supabase.serviceKey;
    } else {
      this.supabaseUrl = appConfig.supabase.url;
      this.supabaseServiceKey = appConfig.supabase.serviceKey;
    }

    if (!this.supabaseUrl) {
      throw new Error('SUPABASE_URL not found in environment variables');
    }

    if (!this.supabaseServiceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY not found in environment variables',
      );
    }

    this.baseUrl = `${this.supabaseUrl}/rest/v1`;

    // Créer le client Supabase
    this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    this.logger.log('SupabaseBaseService initialized');
    this.logger.log(`URL: ${this.supabaseUrl}`);
    this.logger.log(`Service key present: ${this.supabaseServiceKey ? 'Yes' : 'No'}`);
  }

  /**
   * Expose le client Supabase pour les classes héritées
   */
  get client(): SupabaseClient {
    return this.supabase;
  }

  protected get headers() {
    return {
      'Content-Type': 'application/json',
      apikey: this.supabaseServiceKey,
      Authorization: `Bearer ${this.supabaseServiceKey}`,
      Prefer: 'return=representation',
    };
  }

  /**
   * Test de connexion Supabase
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/___xtr_customer?select=count&limit=1`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      return response.ok;
    } catch (error) {
      console.error('Erreur test connexion:', error);
      return false;
    }
  }
}
