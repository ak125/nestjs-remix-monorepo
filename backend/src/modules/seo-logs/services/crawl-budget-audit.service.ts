import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

/**
 * 🔍 SERVICE D'AUDIT CRAWL BUDGET
 *
 * Objectif : Croiser les URLs générées par l'application avec les données réelles
 * de Google Search Console et Google Analytics pour valider la cohérence.
 *
 * ⚠️ IMPORTANT :
 * - Production : URLs en .com (https://www.automecanik.com)
 * - Dev/Test : URLs en .fr (https://automecanik.fr)
 * - Ce service normalise automatiquement les domaines pour comparaison
 */
@Injectable()
export class CrawlBudgetAuditService {
  private readonly logger = new Logger(CrawlBudgetAuditService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * 🎯 AUDIT PRINCIPAL : Comparer URLs app vs GSC vs GA4
   */
  async auditUrlConsistency(options: {
    gammeIds?: number[]; // Filtrer par gammes spécifiques
    sampleSize?: number; // Nombre d'URLs à auditer (défaut: 1000)
    domain?: 'com' | 'fr'; // Domaine de référence (défaut: com)
  }) {
    const { gammeIds, sampleSize = 1000, domain = 'com' } = options;

    this.logger.log('🔍 Démarrage audit de cohérence URLs...');
    this.logger.log(`Domain référence: .${domain}`);

    const results = {
      timestamp: new Date().toISOString(),
      domain_reference: domain,
      app_urls: {
        total: 0,
        sample: [] as string[],
        by_gamme: {} as Record<string, number>,
      },
      gsc_urls: {
        total: 0,
        crawled_last_30d: 0,
        indexed: 0,
        sample: [] as string[],
      },
      ga4_urls: {
        total_sessions: 0,
        top_pages: [] as Array<{ url: string; sessions: number }>,
      },
      comparison: {
        app_only: [] as string[], // URLs dans app mais pas dans GSC/GA4
        gsc_only: [] as string[], // URLs dans GSC mais pas générées par app
        perfect_match: [] as string[], // URLs présentes partout
        domain_mismatch: [] as string[], // URLs avec .com au lieu de .fr (ou inverse)
      },
      recommendations: [] as string[],
    };

    try {
      // 1. Récupérer URLs générées par l'app
      const appUrls = await this.getAppGeneratedUrls(gammeIds, sampleSize);
      results.app_urls.total = appUrls.length;
      results.app_urls.sample = appUrls.slice(0, 10); // Premiers 10 pour debug

      // Compter par gamme
      appUrls.forEach((url) => {
        const match = url.match(/pieces\/[^-]+-(\d+)\.html/);
        if (match) {
          const gammeId = match[1];
          results.app_urls.by_gamme[gammeId] =
            (results.app_urls.by_gamme[gammeId] || 0) + 1;
        }
      });

      // 2. Récupérer URLs de Google Search Console
      const gscUrls = await this.getGSCUrls(domain);
      results.gsc_urls.total = gscUrls.length;
      results.gsc_urls.sample = gscUrls.slice(0, 10);

      // 3. Récupérer top pages de Google Analytics
      const ga4Pages = await this.getGA4TopPages(domain);
      results.ga4_urls.top_pages = ga4Pages;
      results.ga4_urls.total_sessions = ga4Pages.reduce(
        (sum, p) => sum + p.sessions,
        0,
      );

      // 4. Normaliser les domaines pour comparaison
      const normalizedAppUrls = appUrls.map((url) =>
        this.normalizeDomain(url, domain),
      );
      const normalizedGscUrls = gscUrls.map((url) =>
        this.normalizeDomain(url, domain),
      );
      const normalizedGa4Urls = ga4Pages.map((p) =>
        this.normalizeDomain(p.url, domain),
      );

      // 5. Comparaison croisée
      const appUrlSet = new Set(normalizedAppUrls);
      const gscUrlSet = new Set(normalizedGscUrls);
      const ga4UrlSet = new Set(normalizedGa4Urls);

      // URLs uniquement dans app
      results.comparison.app_only = normalizedAppUrls.filter(
        (url) => !gscUrlSet.has(url) && !ga4UrlSet.has(url),
      );

      // URLs uniquement dans GSC
      results.comparison.gsc_only = normalizedGscUrls.filter(
        (url) => !appUrlSet.has(url),
      );

      // URLs présentes partout
      results.comparison.perfect_match = normalizedAppUrls.filter(
        (url) => gscUrlSet.has(url) && ga4UrlSet.has(url),
      );

      // Détecter URLs avec mauvais domaine (.com au lieu de .fr)
      results.comparison.domain_mismatch = gscUrls.filter((url) => {
        const hasCom = url.includes('.com');
        const hasFr = url.includes('.fr');
        if (domain === 'com' && hasFr) return true;
        if (domain === 'fr' && hasCom) return true;
        return false;
      });

      // 6. Générer recommandations
      this.generateRecommendations(results);

      this.logger.log('✅ Audit terminé');
      return results;
    } catch (error) {
      this.logger.error('❌ Erreur audit:', error);
      throw error;
    }
  }

  /**
   * Récupérer les URLs générées par l'application (pieces)
   */
  private async getAppGeneratedUrls(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    gammeIds?: number[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    limit = 1000,
  ): Promise<string[]> {
    // TODO: Remplacer par vraie requête Supabase
    // Pour l'instant, retourne des exemples basés sur le pattern réel

    this.logger.log('📋 Récupération URLs app...');

    // MOCK DATA - À REMPLACER
    const mockUrls = [
      'https://automecanik.fr/pieces/accumulateur-de-pression-de-carburant-1303.html',
      'https://automecanik.fr/pieces/adaptateur-allume-cigares-3352.html',
      'https://automecanik.fr/pieces/accumulateur-de-volume-dhuile-transmission-autom-60717.html',
    ];

    /*
    // VRAIE IMPLÉMENTATION :
    const { data } = await this.supabase
      .from(TABLES.pieces)
      .select('piece_id, piece_alias, piece_ga_id, pieces_gamme!inner(pg_alias)')
      .eq('piece_display', true)
      .in('piece_ga_id', gammeIds || [])
      .limit(limit);

    return data.map(piece => 
      `https://automecanik.fr/pieces/${piece.pieces_gamme.pg_alias}-${piece.piece_id}.html`
    );
    */

    return mockUrls;
  }

  /**
   * Récupérer URLs crawlées par Google Search Console
   */
  private async getGSCUrls(domain: 'com' | 'fr'): Promise<string[]> {
    this.logger.log('🔍 Récupération URLs Google Search Console...');

    try {
      const siteUrl = `https://www.automecanik.${domain}`;

      // Vérifier si credentials sont configurées
      const clientEmail = this.configService.get<string>('GSC_CLIENT_EMAIL');
      const privateKey = this.configService.get<string>('GSC_PRIVATE_KEY');

      if (!clientEmail || !privateKey) {
        this.logger.warn(
          '⚠️ Credentials GSC non configurées, retour mock data',
        );
        return this.getMockGSCUrls(domain);
      }

      // Authentification
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      });

      const searchconsole = google.searchconsole({ version: 'v1', auth });

      // Requête : URLs crawlées derniers 30 jours
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _response = await searchconsole.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: siteUrl,
          siteUrl: siteUrl,
        },
      });

      // Alternative : Utiliser Search Analytics API
      const analyticsResponse = await searchconsole.searchanalytics.query({
        siteUrl: siteUrl,
        requestBody: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          dimensions: ['page'],
          rowLimit: 25000, // Max 25K URLs
        },
      });

      const urls =
        analyticsResponse.data.rows?.map((row) => row.keys?.[0] || '') || [];
      this.logger.log(`✅ ${urls.length} URLs récupérées depuis GSC`);

      return urls;
    } catch (error) {
      this.logger.error('❌ Erreur GSC API:', error);
      this.logger.warn('Retour sur mock data GSC');
      return this.getMockGSCUrls(domain);
    }
  }

  /**
   * Récupérer top pages de Google Analytics 4
   */
  private async getGA4TopPages(
    domain: 'com' | 'fr',
  ): Promise<Array<{ url: string; sessions: number }>> {
    this.logger.log('📊 Récupération top pages GA4...');

    try {
      const propertyId = this.configService.get<string>('GA4_PROPERTY_ID');
      const clientEmail = this.configService.get<string>('GA4_CLIENT_EMAIL');
      const privateKey = this.configService.get<string>('GA4_PRIVATE_KEY');

      if (!propertyId || !clientEmail || !privateKey) {
        this.logger.warn('⚠️ Credentials GA4 non configurées, retour mock');
        return this.getMockGA4Pages(domain);
      }

      const analyticsDataClient = new BetaAnalyticsDataClient({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
      });

      const [response] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [
          {
            startDate: '30daysAgo',
            endDate: 'today',
          },
        ],
        dimensions: [
          {
            name: 'pagePath',
          },
        ],
        metrics: [
          {
            name: 'sessions',
          },
        ],
        orderBys: [
          {
            metric: {
              metricName: 'sessions',
            },
            desc: true,
          },
        ],
        limit: 1000,
      });

      const pages =
        response.rows?.map((row) => ({
          url: `https://www.automecanik.${domain}${row.dimensionValues?.[0]?.value || ''}`,
          sessions: parseInt(row.metricValues?.[0]?.value || '0'),
        })) || [];

      this.logger.log(`✅ ${pages.length} pages récupérées depuis GA4`);
      return pages;
    } catch (error) {
      this.logger.error('❌ Erreur GA4 API:', error);
      this.logger.warn('Retour sur mock data GA4');
      return this.getMockGA4Pages(domain);
    }
  }

  /**
   * Normaliser domaine pour comparaison (.com ou .fr)
   *
   * Gère aussi www. vs non-www pour éviter faux négatifs
   */
  private normalizeDomain(url: string, targetDomain: 'com' | 'fr'): string {
    let normalized = url;

    // Normaliser domaine (.fr ↔ .com)
    if (targetDomain === 'com') {
      normalized = normalized.replace(/automecanik\.fr/g, 'automecanik.com');
    } else {
      normalized = normalized.replace(/automecanik\.com/g, 'automecanik.fr');
    }

    // Toujours retirer www. pour comparaison uniforme
    normalized = normalized.replace(/www\./g, '');

    // Forcer https://
    normalized = normalized.replace(/^http:\/\//g, 'https://');

    return normalized;
  }

  /**
   * Générer recommandations basées sur l'audit
   */
  private generateRecommendations(results: any) {
    const { app_urls, comparison } = results;

    // Taux de matching
    const matchRate = (comparison.perfect_match.length / app_urls.total) * 100;

    if (matchRate < 50) {
      results.recommendations.push(
        '🚨 CRITIQUE : Moins de 50% des URLs app sont crawlées par Google. Vérifier sitemap et robots.txt',
      );
    } else if (matchRate < 80) {
      results.recommendations.push(
        '⚠️ ATTENTION : ' +
          matchRate.toFixed(1) +
          '% de matching. Améliorer soumission sitemap.',
      );
    } else {
      results.recommendations.push(
        '✅ BON : ' +
          matchRate.toFixed(1) +
          '% des URLs app sont indexées par Google.',
      );
    }

    // URLs orphelines dans GSC
    if (comparison.gsc_only.length > 100) {
      results.recommendations.push(
        `🔍 INVESTIGATION : ${comparison.gsc_only.length} URLs dans GSC mais pas dans l'app. Vérifier anciennes URLs ou erreurs 404.`,
      );
    }

    // Problème de domaine
    if (comparison.domain_mismatch.length > 0) {
      results.recommendations.push(
        `🔧 CONFIGURATION : ${comparison.domain_mismatch.length} URLs avec mauvais domaine (.com vs .fr). Vérifier redirections.`,
      );
    }

    // URLs app non crawlées
    if (comparison.app_only.length > app_urls.total * 0.3) {
      results.recommendations.push(
        `📤 ACTION : ${comparison.app_only.length} URLs générées mais jamais crawlées. Soumettre sitemap à Google Search Console.`,
      );
    }
  }

  /**
   * Mock data pour GSC (quand API pas configurée)
   */
  private getMockGSCUrls(domain: 'com' | 'fr'): string[] {
    const baseUrl = `https://www.automecanik.${domain}`;
    return [
      `${baseUrl}/pieces/accumulateur-de-pression-de-carburant-1303.html`,
      `${baseUrl}/pieces/adaptateur-allume-cigares-3352.html`,
      `${baseUrl}/pieces/filtre-a-huile-5234.html`,
      `${baseUrl}/constructeurs/renault`,
      `${baseUrl}/`,
    ];
  }

  /**
   * Mock data pour GA4 (quand API pas configurée)
   */
  private getMockGA4Pages(
    domain: 'com' | 'fr',
  ): Array<{ url: string; sessions: number }> {
    const baseUrl = `https://www.automecanik.${domain}`;
    return [
      { url: `${baseUrl}/`, sessions: 12500 },
      {
        url: `${baseUrl}/pieces/accumulateur-de-pression-de-carburant-1303.html`,
        sessions: 850,
      },
      { url: `${baseUrl}/pieces/filtre-a-huile-5234.html`, sessions: 720 },
      { url: `${baseUrl}/constructeurs/renault`, sessions: 650 },
    ];
  }

  /**
   * 🎯 RAPPORT AUDIT POUR GAMME SPÉCIFIQUE
   */
  async auditGamme(gammeId: number) {
    this.logger.log(`🔍 Audit gamme ${gammeId}...`);

    const results = {
      gamme_id: gammeId,
      app_urls_count: 0,
      gsc_crawled_count: 0,
      ga4_sessions: 0,
      avg_position: null,
      crawl_rate: null,
      recommendations: [] as string[],
    };

    // Audit spécifique à cette gamme
    const fullAudit = await this.auditUrlConsistency({
      gammeIds: [gammeId],
      sampleSize: 10000,
    });

    results.app_urls_count = fullAudit.app_urls.by_gamme[gammeId] || 0;
    results.gsc_crawled_count = fullAudit.comparison.perfect_match.length;
    results.ga4_sessions = fullAudit.ga4_urls.top_pages
      .filter((p) => p.url.includes(`-${gammeId}.html`))
      .reduce((sum, p) => sum + p.sessions, 0);

    if (results.app_urls_count > 0) {
      results.crawl_rate =
        (results.gsc_crawled_count / results.app_urls_count) * 100;
    }

    // Recommandations spécifiques
    if (results.crawl_rate && results.crawl_rate < 30) {
      results.recommendations.push(
        `🚨 Gamme ${gammeId} : Seulement ${results.crawl_rate.toFixed(1)}% des URLs crawlées. CANDIDAT IDÉAL pour exclusion temporaire.`,
      );
    } else if (results.ga4_sessions > 1000) {
      results.recommendations.push(
        `✅ Gamme ${gammeId} : Forte performance (${results.ga4_sessions} sessions/mois). À INCLURE prioritairement.`,
      );
    }

    return results;
  }
}
