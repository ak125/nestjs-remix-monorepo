import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

/**
 * 🔍 Service d'audit des URLs
 *
 * Compare les URLs générées par l'application avec :
 * - Google Search Console (URLs crawlées)
 * - Google Analytics 4 (URLs visitées)
 *
 * Prend en compte :
 * - Anciennes URLs en .com
 * - Nouvelles URLs en .fr
 * - Normalisation des domaines pour comparaison
 */
@Injectable()
export class UrlAuditService {
  private readonly logger = new Logger(UrlAuditService.name);
  private gscAuth: any;
  private ga4Client: BetaAnalyticsDataClient | null = null;

  constructor(private configService: ConfigService) {
    this.initializeGoogleClients();
  }

  private initializeGoogleClients() {
    try {
      // Google Search Console Auth
      const gscEmail = this.configService.get('GSC_CLIENT_EMAIL');
      const gscKey = this.configService.get('GSC_PRIVATE_KEY');

      if (gscEmail && gscKey) {
        this.gscAuth = new google.auth.GoogleAuth({
          credentials: {
            client_email: gscEmail,
            private_key: gscKey.replace(/\\n/g, '\n'),
          },
          scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
        });
        this.logger.log('✅ Google Search Console client initialisé');
      } else {
        this.logger.warn(
          '⚠️ GSC credentials manquantes - utilisation mock data',
        );
      }

      // Google Analytics 4 Client
      const ga4Email = this.configService.get('GA4_CLIENT_EMAIL');
      const ga4Key = this.configService.get('GA4_PRIVATE_KEY');

      if (ga4Email && ga4Key) {
        this.ga4Client = new BetaAnalyticsDataClient({
          credentials: {
            client_email: ga4Email,
            private_key: ga4Key.replace(/\\n/g, '\n'),
          },
        });
        this.logger.log('✅ Google Analytics 4 client initialisé');
      } else {
        this.logger.warn(
          '⚠️ GA4 credentials manquantes - utilisation mock data',
        );
      }
    } catch (error) {
      this.logger.error('❌ Erreur initialisation Google clients:', error);
    }
  }

  /**
   * Normalise une URL pour comparaison
   * Remplace .com par .fr et nettoie les paramètres
   */
  private normalizeUrl(url: string): string {
    return url
      .replace('automecanik.com', 'automecanik.fr')
      .replace('www.automecanik.com', 'automecanik.fr')
      .replace('https://automecanik.fr', '')
      .replace('https://www.automecanik.fr', '')
      .replace(/\?.*$/, '') // Supprimer query params
      .replace(/#.*$/, '') // Supprimer hash
      .toLowerCase()
      .trim();
  }

  /**
   * Récupère les URLs crawlées depuis Google Search Console
   */
  async getGscCrawledUrls(
    siteUrl: string,
    startDate: string,
    endDate: string,
  ): Promise<{ url: string; clicks: number; impressions: number }[]> {
    if (!this.gscAuth) {
      this.logger.warn('🔧 Mode MOCK - GSC credentials non configurées');
      return this.getMockGscUrls();
    }

    try {
      const searchconsole = google.searchconsole({
        version: 'v1',
        auth: this.gscAuth,
      });

      const response = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'],
          rowLimit: 25000, // Max 25K URLs
        },
      });

      const urls =
        response.data.rows?.map((row) => ({
          url: this.normalizeUrl(row.keys?.[0] || ''),
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
        })) || [];

      this.logger.log(`✅ ${urls.length} URLs récupérées depuis GSC`);
      return urls;
    } catch (error) {
      this.logger.error('❌ Erreur GSC API:', error);
      return this.getMockGscUrls();
    }
  }

  /**
   * Récupère les URLs visitées depuis Google Analytics 4
   */
  async getGA4VisitedUrls(
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Promise<{ url: string; sessions: number; pageviews: number }[]> {
    if (!this.ga4Client) {
      this.logger.warn('🔧 Mode MOCK - GA4 credentials non configurées');
      return this.getMockGA4Urls();
    }

    try {
      const [response] = await this.ga4Client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
        limit: 10000,
      });

      const urls =
        response.rows?.map((row) => ({
          url: this.normalizeUrl(row.dimensionValues?.[0]?.value || ''),
          sessions: parseInt(row.metricValues?.[0]?.value || '0'),
          pageviews: parseInt(row.metricValues?.[1]?.value || '0'),
        })) || [];

      this.logger.log(`✅ ${urls.length} URLs récupérées depuis GA4`);
      return urls;
    } catch (error) {
      this.logger.error('❌ Erreur GA4 API:', error);
      return this.getMockGA4Urls();
    }
  }

  /**
   * Compare les URLs générées avec GSC et GA4
   */
  async auditUrls(generatedUrls: string[]): Promise<{
    summary: {
      total_generated: number;
      found_in_gsc: number;
      found_in_ga4: number;
      found_in_both: number;
      missing_in_both: number;
    };
    details: {
      in_gsc_only: string[];
      in_ga4_only: string[];
      in_both: string[];
      missing: string[];
    };
    gsc_exclusive: Array<{ url: string; clicks: number; impressions: number }>;
    ga4_exclusive: Array<{ url: string; sessions: number; pageviews: number }>;
  }> {
    this.logger.log(`🔍 Audit de ${generatedUrls.length} URLs générées`);

    // Récupérer données GSC (30 derniers jours)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const siteUrl =
      this.configService.get('GSC_SITE_URL') || 'https://www.automecanik.com';
    const ga4PropertyId = this.configService.get('GA4_PROPERTY_ID') || '';

    const [gscUrls, ga4Urls] = await Promise.all([
      this.getGscCrawledUrls(siteUrl, startDate, endDate),
      this.getGA4VisitedUrls(ga4PropertyId, startDate, endDate),
    ]);

    // Normaliser les URLs générées
    const normalizedGenerated = generatedUrls.map((url) =>
      this.normalizeUrl(url),
    );

    // Créer des Sets pour comparaison rapide
    const gscSet = new Set(gscUrls.map((u) => u.url));
    const ga4Set = new Set(ga4Urls.map((u) => u.url));
    const generatedSet = new Set(normalizedGenerated);

    // Calculer intersections
    const inGscOnly: string[] = [];
    const inGA4Only: string[] = [];
    const inBoth: string[] = [];
    const missing: string[] = [];

    normalizedGenerated.forEach((url) => {
      const inGsc = gscSet.has(url);
      const inGa4 = ga4Set.has(url);

      if (inGsc && inGa4) {
        inBoth.push(url);
      } else if (inGsc && !inGa4) {
        inGscOnly.push(url);
      } else if (!inGsc && inGa4) {
        inGA4Only.push(url);
      } else {
        missing.push(url);
      }
    });

    // URLs dans GSC mais pas générées (anciennes URLs .com ?)
    const gscExclusive = gscUrls.filter((u) => !generatedSet.has(u.url));

    // URLs dans GA4 mais pas générées
    const ga4Exclusive = ga4Urls.filter((u) => !generatedSet.has(u.url));

    const summary = {
      total_generated: normalizedGenerated.length,
      found_in_gsc: inGscOnly.length + inBoth.length,
      found_in_ga4: inGA4Only.length + inBoth.length,
      found_in_both: inBoth.length,
      missing_in_both: missing.length,
    };

    this.logger.log('📊 Résumé audit:', summary);

    return {
      summary,
      details: {
        in_gsc_only: inGscOnly,
        in_ga4_only: inGA4Only,
        in_both: inBoth,
        missing,
      },
      gsc_exclusive: gscExclusive.slice(0, 100), // Top 100
      ga4_exclusive: ga4Exclusive.slice(0, 100),
    };
  }

  /**
   * Détecte les différences de format d'URL (.com vs .fr)
   */
  async detectUrlFormatDifferences(): Promise<{
    com_urls: number;
    fr_urls: number;
    pattern_differences: Array<{
      pattern: string;
      com_count: number;
      fr_count: number;
    }>;
  }> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const siteUrl =
      this.configService.get('GSC_SITE_URL') || 'https://www.automecanik.com';

    const gscUrls = await this.getGscCrawledUrls(siteUrl, startDate, endDate);

    const comUrls = gscUrls.filter((u) => u.url.includes('.com'));
    const frUrls = gscUrls.filter((u) => u.url.includes('.fr'));

    // Analyser patterns (/pieces/, /products/, etc.)
    const patterns = new Map<string, { com: number; fr: number }>();

    gscUrls.forEach((urlData) => {
      const url = urlData.url;
      const isCom = url.includes('.com');

      // Extraire pattern (ex: /pieces/, /products/)
      const match = url.match(/\/([\w-]+)\//);
      const pattern = match ? match[1] : 'root';

      if (!patterns.has(pattern)) {
        patterns.set(pattern, { com: 0, fr: 0 });
      }

      const stats = patterns.get(pattern)!;
      if (isCom) stats.com++;
      else stats.fr++;
    });

    const patternDifferences = Array.from(patterns.entries())
      .map(([pattern, counts]) => ({
        pattern,
        com_count: counts.com,
        fr_count: counts.fr,
      }))
      .sort((a, b) => b.com_count + b.fr_count - (a.com_count + a.fr_count));

    return {
      com_urls: comUrls.length,
      fr_urls: frUrls.length,
      pattern_differences: patternDifferences,
    };
  }

  // ════════════════════════════════════════════════════════════
  // MOCK DATA (pour tests sans credentials Google)
  // ════════════════════════════════════════════════════════════

  private getMockGscUrls(): Array<{
    url: string;
    clicks: number;
    impressions: number;
  }> {
    return [
      {
        url: '/pieces/accumulateur-de-pression-de-carburant-1303.html',
        clicks: 45,
        impressions: 1200,
      },
      {
        url: '/pieces/adaptateur-allume-cigares-3352.html',
        clicks: 12,
        impressions: 450,
      },
      { url: '/pieces/accu-tournevis-4715.html', clicks: 8, impressions: 320 },
      // Anciennes URLs .com (simulation)
      {
        url: '/products/old-piece-9999.html',
        clicks: 2,
        impressions: 50,
      }, // URL obsolète
    ];
  }

  private getMockGA4Urls(): Array<{
    url: string;
    sessions: number;
    pageviews: number;
  }> {
    return [
      {
        url: '/pieces/accumulateur-de-pression-de-carburant-1303.html',
        sessions: 150,
        pageviews: 220,
      },
      {
        url: '/pieces/adaptateur-allume-cigares-3352.html',
        sessions: 45,
        pageviews: 78,
      },
      { url: '/constructeurs/renault', sessions: 320, pageviews: 450 }, // Page non-produit
    ];
  }
}
