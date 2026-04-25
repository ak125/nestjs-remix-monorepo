/**
 * Google Credentials Service
 *
 * Centralise le chargement et la validation des credentials Service Account
 * Google (GSC + GA4). Deux sources sont supportées, dans l'ordre :
 *
 *   1. ENV per-service (legacy, AP-11) :
 *        GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL
 *        GA4_CLIENT_EMAIL, GA4_PRIVATE_KEY, GA4_PROPERTY_ID
 *      Lus directement par crawl-budget-audit.service.ts:208-216
 *      et url-audit.service.ts:50-60.
 *
 *   2. Application Default Credentials (Google standard) :
 *      GOOGLE_APPLICATION_CREDENTIALS=<path-vers-SA-json>
 *      Le SDK Google lit ce fichier nativement quand on instancie
 *      `new GoogleAuth({ scopes })` ou `new BetaAnalyticsDataClient()`
 *      sans paramètre `credentials`. Aucun parsing maison.
 *
 * GSC_SITE_URL et GA4_PROPERTY_ID restent ENV-only (identifiants de
 * propriété, pas credentials).
 *
 * Refs:
 * - ADR-025-seo-department-architecture (ledger/decisions/adr/)
 * - rules-ai-antipatterns AP-11 (ledger/rules/)
 * - https://cloud.google.com/docs/authentication/application-default-credentials
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export interface GoogleSAReadiness {
  gsc: { ready: boolean; reason?: string };
  ga4: { ready: boolean; reason?: string };
}

@Injectable()
export class GoogleCredentialsService {
  private readonly logger = new Logger(GoogleCredentialsService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * GSC auth via google.auth.GoogleAuth (réutilise le pattern de
   * crawl-budget-audit.service.ts:208-216).
   *
   * @returns null si credentials manquantes (kill-switch implicite).
   */
  getGSCAuth(): InstanceType<typeof google.auth.GoogleAuth> | null {
    const clientEmail = this.configService.get<string>('GSC_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('GSC_PRIVATE_KEY');

    if (clientEmail && privateKey) {
      return new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
    }

    // Fallback : Application Default Credentials. Le SDK lit
    // GOOGLE_APPLICATION_CREDENTIALS nativement, pas de parsing maison.
    if (this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS')) {
      return new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });
    }

    this.logger.warn(
      '⚠️ GSC credentials absentes (ni GSC_CLIENT_EMAIL/GSC_PRIVATE_KEY ni GOOGLE_APPLICATION_CREDENTIALS) — fetchers désactivés',
    );
    return null;
  }

  /**
   * GA4 client via BetaAnalyticsDataClient (réutilise le pattern de
   * url-audit.service.ts:50-60).
   *
   * @returns null si credentials manquantes.
   */
  getGA4Client(): BetaAnalyticsDataClient | null {
    const clientEmail = this.configService.get<string>('GA4_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('GA4_PRIVATE_KEY');
    const propertyId = this.configService.get<string>('GA4_PROPERTY_ID');

    if (!propertyId) {
      this.logger.warn('⚠️ GA4_PROPERTY_ID absent — fetchers désactivés');
      return null;
    }

    if (clientEmail && privateKey) {
      return new BetaAnalyticsDataClient({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
      });
    }

    // Fallback : Application Default Credentials.
    if (this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS')) {
      return new BetaAnalyticsDataClient();
    }

    this.logger.warn(
      '⚠️ GA4 credentials absentes (ni GA4_CLIENT_EMAIL/GA4_PRIVATE_KEY ni GOOGLE_APPLICATION_CREDENTIALS) — fetchers désactivés',
    );
    return null;
  }

  /**
   * GA4 Property ID (numérique, format `properties/123456789` requis par l'API).
   */
  getGA4PropertyName(): string | null {
    const propertyId = this.configService.get<string>('GA4_PROPERTY_ID');
    return propertyId ? `properties/${propertyId}` : null;
  }

  /**
   * GSC site URL (fallback SITE_ORIGIN = https://www.automecanik.com).
   */
  getGSCSiteUrl(): string {
    return (
      this.configService.get<string>('GSC_SITE_URL') ||
      'https://www.automecanik.com'
    );
  }

  /**
   * Master kill-switch — désactive tout fetch côté schedulers.
   * Default false en prod tant que pipeline pas validée.
   */
  isMonitoringEnabled(): boolean {
    return this.configService.get<string>('SEO_MONITORING_ENABLED') === 'true';
  }

  /**
   * Health-check programmatique : credentials présentes et complètes ?
   * Utilisé par l'endpoint /credentials/health.
   */
  checkReadiness(): GoogleSAReadiness {
    const gscEmail = this.configService.get<string>('GSC_CLIENT_EMAIL');
    const gscKey = this.configService.get<string>('GSC_PRIVATE_KEY');
    const ga4Email = this.configService.get<string>('GA4_CLIENT_EMAIL');
    const ga4Key = this.configService.get<string>('GA4_PRIVATE_KEY');
    const ga4Prop = this.configService.get<string>('GA4_PROPERTY_ID');
    const adc = Boolean(
      this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS'),
    );

    const gscReady = Boolean((gscEmail && gscKey) || adc);
    const ga4Ready = Boolean(((ga4Email && ga4Key) || adc) && ga4Prop);

    return {
      gsc: {
        ready: gscReady,
        reason: gscReady
          ? undefined
          : !gscEmail
            ? 'GSC_CLIENT_EMAIL missing'
            : !gscKey
              ? 'GSC_PRIVATE_KEY missing'
              : undefined,
      },
      ga4: {
        ready: ga4Ready,
        reason: ga4Ready
          ? undefined
          : adc
            ? 'GA4_PROPERTY_ID missing'
            : !ga4Email
              ? 'GA4_CLIENT_EMAIL missing'
              : !ga4Key
                ? 'GA4_PRIVATE_KEY missing'
                : !ga4Prop
                  ? 'GA4_PROPERTY_ID missing'
                  : undefined,
      },
    };
  }
}
