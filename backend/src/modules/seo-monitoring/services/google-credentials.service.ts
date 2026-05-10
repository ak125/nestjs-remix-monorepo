/**
 * Google Credentials Service
 *
 * Centralise le chargement et la validation des credentials Service Account
 * Google (GSC + GA4) depuis les ENV vars existantes du codebase :
 *
 *   GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL  (lus par crawl-budget-audit.service.ts)
 *   GA4_CLIENT_EMAIL, GA4_PRIVATE_KEY, GA4_PROPERTY_ID  (lus par url-audit.service.ts)
 *
 * Ce service ne crée pas de nouveaux noms d'ENV (cf. AP-11 vault rule).
 * Il fournit juste une API typée pour les fetchers du module.
 *
 * Refs:
 * - ADR-025-seo-department-architecture (ledger/decisions/adr/)
 * - rules-ai-antipatterns AP-11 (ledger/rules/)
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

    if (!clientEmail || !privateKey) {
      this.logger.warn(
        '⚠️ GSC credentials absentes (GSC_CLIENT_EMAIL/GSC_PRIVATE_KEY) — fetchers désactivés',
      );
      return null;
    }

    return new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
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

    if (!clientEmail || !privateKey || !propertyId) {
      this.logger.warn(
        '⚠️ GA4 credentials absentes (GA4_CLIENT_EMAIL/GA4_PRIVATE_KEY/GA4_PROPERTY_ID) — fetchers désactivés',
      );
      return null;
    }

    return new BetaAnalyticsDataClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
    });
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

    return {
      gsc: {
        ready: Boolean(gscEmail && gscKey),
        reason: !gscEmail
          ? 'GSC_CLIENT_EMAIL missing'
          : !gscKey
            ? 'GSC_PRIVATE_KEY missing'
            : undefined,
      },
      ga4: {
        ready: Boolean(ga4Email && ga4Key && ga4Prop),
        reason: !ga4Email
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
