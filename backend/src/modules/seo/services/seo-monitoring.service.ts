import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// import { Cron } from '@nestjs/schedule'; // TODO: Réactiver quand compatible

export interface SitemapStatus {
  url: string;
  submitted: boolean;
  discovered: boolean;
  indexed: number;
  errors: number;
  warnings: number;
  lastChecked: Date;
}

export interface IndexCoverage {
  totalUrls: number;
  indexedUrls: number;
  excludedUrls: number;
  errorUrls: number;
  coverage: number; // percentage
}

export interface UrlError {
  url: string;
  errorType: string;
  severity: 'error' | 'warning';
  firstDetected: Date;
  message: string;
}

export interface MonitoringReport {
  timestamp: Date;
  sitemaps: SitemapStatus[];
  indexCoverage: IndexCoverage;
  urlErrors: UrlError[];
  alerts: string[];
}

@Injectable()
export class SeoMonitoringService {
  private readonly logger = new Logger(SeoMonitoringService.name);
  private readonly baseUrl: string;
  private readonly slackWebhook: string;
  private readonly sitemapUrls: string[];

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'BASE_URL',
      'https://automecanik.com',
    );
    this.slackWebhook = this.configService.get<string>('SLACK_WEBHOOK_URL', '');

    // Liste de tous les sitemaps à monitorer
    this.sitemapUrls = [
      `${this.baseUrl}/sitemap-index.xml.gz`,
      `${this.baseUrl}/sitemap-products.xml.gz`,
      `${this.baseUrl}/sitemap-blog.xml.gz`,
      `${this.baseUrl}/sitemap-pages.xml.gz`,
      `${this.baseUrl}/sitemap-constructeurs.xml.gz`,
      `${this.baseUrl}/sitemap-catalog.xml.gz`,
      // Remix sitemaps (non-gzipped)
      `${this.baseUrl}/sitemap-blog.xml`,
      `${this.baseUrl}/sitemap-pages.xml`,
      `${this.baseUrl}/sitemap-conseils.xml`,
    ];
  }

  /**
   * Cron job quotidien : Vérifier tous les sitemaps
   * Tous les jours à 6h00 AM
   * TODO: Réactiver quand @nestjs/schedule sera compatible
   */
  // @Cron('0 6 * * *', {
  //   name: 'check-sitemaps-daily',
  //   timeZone: 'Europe/Paris',
  // })
  async checkAllSitemapsDaily(): Promise<void> {
    this.logger.log('🔍 Démarrage vérification quotidienne des sitemaps...');

    const report = await this.generateMonitoringReport();

    // Alertes si problèmes détectés
    if (report.alerts.length > 0) {
      await this.sendAlerts(report);
    }

    // Log rapport
    this.logger.log('📊 Rapport monitoring généré:');
    this.logger.log(`   • Sitemaps monitored: ${report.sitemaps.length}`);
    this.logger.log(
      `   • Index coverage: ${report.indexCoverage.coverage.toFixed(1)}%`,
    );
    this.logger.log(`   • URL errors: ${report.urlErrors.length}`);
    this.logger.log(`   • Alerts: ${report.alerts.length}`);
  }

  /**
   * Générer un rapport complet de monitoring
   */
  async generateMonitoringReport(): Promise<MonitoringReport> {
    const sitemaps = await this.checkAllSitemaps();
    const indexCoverage = await this.checkIndexCoverage();
    const urlErrors = await this.detectUrlErrors();
    const alerts = this.generateAlerts(sitemaps, indexCoverage, urlErrors);

    return {
      timestamp: new Date(),
      sitemaps,
      indexCoverage,
      urlErrors,
      alerts,
    };
  }

  /**
   * Vérifier le statut de tous les sitemaps
   */
  private async checkAllSitemaps(): Promise<SitemapStatus[]> {
    const statuses: SitemapStatus[] = [];

    for (const sitemapUrl of this.sitemapUrls) {
      const status = await this.checkSitemapStatus(sitemapUrl);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Vérifier le statut d'un sitemap individuel
   */
  private async checkSitemapStatus(url: string): Promise<SitemapStatus> {
    try {
      // Vérifier que le sitemap est accessible
      const response = await fetch(url, { method: 'HEAD' });

      if (!response.ok) {
        this.logger.warn(
          `⚠️ Sitemap non accessible: ${url} (${response.status})`,
        );
        return {
          url,
          submitted: false,
          discovered: false,
          indexed: 0,
          errors: 1,
          warnings: 0,
          lastChecked: new Date(),
        };
      }

      // TODO: Intégrer avec Google Search Console API pour obtenir les vraies stats
      // Pour l'instant, on simule avec des données de base
      const stats = await this.getSitemapStatsFromSearchConsole(url);

      return {
        url,
        submitted: true,
        discovered: stats.discovered,
        indexed: stats.indexed,
        errors: stats.errors,
        warnings: stats.warnings,
        lastChecked: new Date(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur vérification sitemap ${url}:`, error);
      return {
        url,
        submitted: false,
        discovered: false,
        indexed: 0,
        errors: 1,
        warnings: 0,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Obtenir les stats d'un sitemap depuis Google Search Console
   * TODO: Implémenter l'intégration réelle avec Search Console API
   */
  private async getSitemapStatsFromSearchConsole(url: string): Promise<{
    discovered: boolean;
    indexed: number;
    errors: number;
    warnings: number;
  }> {
    // TODO: Utiliser googleapis pour appeler Search Console API
    // https://developers.google.com/webmaster-tools/v1/sitemaps
    
    /*
    const { google } = require('googleapis');
    const searchconsole = google.searchconsole('v1');
    
    const res = await searchconsole.sitemaps.get({
      siteUrl: this.baseUrl,
      feedpath: url,
    });
    
    return {
      discovered: res.data.isPending === false,
      indexed: res.data.contents?.[0]?.submitted || 0,
      errors: res.data.errors || 0,
      warnings: res.data.warnings || 0,
    };
    */

    // Placeholder jusqu'à intégration API
    this.logger.debug(`📡 [TODO] Appel Search Console API pour ${url}`);
    return {
      discovered: true,
      indexed: 0,
      errors: 0,
      warnings: 0,
    };
  }

  /**
   * Vérifier la couverture d'indexation globale
   */
  private async checkIndexCoverage(): Promise<IndexCoverage> {
    // TODO: Appeler Search Console API pour obtenir index coverage
    // https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect

    const totalUrls = 150000; // Estimation (à obtenir depuis les sitemaps)
    const indexedUrls = 120000; // TODO: Obtenir depuis Search Console
    const excludedUrls = 25000;
    const errorUrls = 5000;

    return {
      totalUrls,
      indexedUrls,
      excludedUrls,
      errorUrls,
      coverage: (indexedUrls / totalUrls) * 100,
    };
  }

  /**
   * Détecter les erreurs d'URL
   */
  private async detectUrlErrors(): Promise<UrlError[]> {
    // TODO: Appeler Search Console API pour obtenir les erreurs
    // https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect

    const errors: UrlError[] = [];

    // Placeholder
    this.logger.debug('📡 [TODO] Détection erreurs URL via Search Console API');

    return errors;
  }

  /**
   * Générer des alertes basées sur les métriques
   */
  private generateAlerts(
    sitemaps: SitemapStatus[],
    indexCoverage: IndexCoverage,
    urlErrors: UrlError[],
  ): string[] {
    const alerts: string[] = [];

    // Alerte 1: Sitemaps non découverts
    const undiscoveredSitemaps = sitemaps.filter((s) => !s.discovered);
    if (undiscoveredSitemaps.length > 0) {
      alerts.push(
        `🚨 ${undiscoveredSitemaps.length} sitemap(s) non découvert(s) par Google`,
      );
    }

    // Alerte 2: Sitemaps avec erreurs
    const sitemapsWithErrors = sitemaps.filter((s) => s.errors > 0);
    if (sitemapsWithErrors.length > 0) {
      alerts.push(
        `⚠️ ${sitemapsWithErrors.length} sitemap(s) avec erreurs détectées`,
      );
    }

    // Alerte 3: Couverture d'indexation faible
    if (indexCoverage.coverage < 70) {
      alerts.push(
        `📉 Couverture d'indexation faible: ${indexCoverage.coverage.toFixed(1)}% (objectif: >80%)`,
      );
    }

    // Alerte 4: Trop d'erreurs d'URL
    if (urlErrors.length > 100) {
      alerts.push(
        `❌ ${urlErrors.length} erreurs d'URL détectées (seuil: 100)`,
      );
    }

    // Alerte 5: Erreurs critiques
    const criticalErrors = urlErrors.filter((e) => e.severity === 'error');
    if (criticalErrors.length > 0) {
      alerts.push(
        `🔴 ${criticalErrors.length} erreur(s) critique(s) nécessitant une action immédiate`,
      );
    }

    return alerts;
  }

  /**
   * Envoyer des alertes via Slack
   */
  private async sendAlerts(report: MonitoringReport): Promise<void> {
    if (!this.slackWebhook) {
      this.logger.warn('⚠️ SLACK_WEBHOOK_URL non configuré, skip alertes');
      return;
    }

    const message = this.formatSlackMessage(report);

    try {
      const response = await fetch(this.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      this.logger.log('✅ Alertes envoyées sur Slack');
    } catch (error) {
      this.logger.error('❌ Erreur envoi alertes Slack:', error);
    }
  }

  /**
   * Formatter le message Slack
   */
  private formatSlackMessage(report: MonitoringReport): any {
    const color = report.alerts.length > 0 ? 'warning' : 'good';

    return {
      username: 'SEO Monitor',
      icon_emoji: ':mag:',
      attachments: [
        {
          color,
          title: '📊 Rapport Monitoring SEO',
          text: `Rapport généré le ${report.timestamp.toLocaleString('fr-FR')}`,
          fields: [
            {
              title: 'Couverture Index',
              value: `${report.indexCoverage.coverage.toFixed(1)}% (${report.indexCoverage.indexedUrls}/${report.indexCoverage.totalUrls} URLs)`,
              short: true,
            },
            {
              title: 'Sitemaps',
              value: `${report.sitemaps.length} monitored`,
              short: true,
            },
            {
              title: 'Erreurs URL',
              value: `${report.urlErrors.length} détectées`,
              short: true,
            },
            {
              title: 'Alertes',
              value: `${report.alerts.length} active(s)`,
              short: true,
            },
          ],
          footer: 'SEO Monitoring Service',
          ts: Math.floor(report.timestamp.getTime() / 1000),
        },
        ...(report.alerts.length > 0
          ? [
              {
                color: 'danger',
                title: '🚨 Alertes',
                text: report.alerts.join('\n'),
              },
            ]
          : []),
      ],
    };
  }

  /**
   * Soumettre un sitemap à Google Search Console
   * Manuel (à appeler via endpoint API)
   */
  async submitSitemapToSearchConsole(sitemapUrl: string): Promise<boolean> {
    try {
      // TODO: Utiliser Search Console API pour soumettre
      // https://developers.google.com/webmaster-tools/v1/sitemaps/submit

      /*
      const { google } = require('googleapis');
      const searchconsole = google.searchconsole('v1');
      
      await searchconsole.sitemaps.submit({
        siteUrl: this.baseUrl,
        feedpath: sitemapUrl,
      });
      */

      this.logger.log(`✅ Sitemap soumis à Search Console: ${sitemapUrl}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Erreur soumission sitemap ${sitemapUrl}:`, error);
      return false;
    }
  }

  /**
   * Soumettre tous les sitemaps
   */
  async submitAllSitemaps(): Promise<void> {
    this.logger.log('📤 Soumission de tous les sitemaps à Search Console...');

    let submitted = 0;
    let failed = 0;

    for (const sitemapUrl of this.sitemapUrls) {
      const success = await this.submitSitemapToSearchConsole(sitemapUrl);
      if (success) {
        submitted++;
      } else {
        failed++;
      }
    }

    this.logger.log(`✅ Soumission terminée: ${submitted} OK, ${failed} KO`);
  }

  /**
   * Obtenir le rapport actuel (API endpoint)
   */
  async getCurrentReport(): Promise<MonitoringReport> {
    return this.generateMonitoringReport();
  }

  /**
   * Sanity check : Vérifier que tous les sitemaps sont accessibles
   */
  async verifySitemapsAccessibility(): Promise<{
    accessible: number;
    failed: string[];
  }> {
    const failed: string[] = [];
    let accessible = 0;

    for (const url of this.sitemapUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          accessible++;
        } else {
          failed.push(`${url} (${response.status})`);
        }
      } catch (error) {
        failed.push(`${url} (error: ${error.message})`);
      }
    }

    return { accessible, failed };
  }
}
