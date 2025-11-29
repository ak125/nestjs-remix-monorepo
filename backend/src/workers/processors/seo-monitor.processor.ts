/**
 * 🛡️ PROCESSOR MONITORING SEO
 *
 * Surveille les pages critiques pour détecter les problèmes
 * de parsing d'URL qui pourraient causer 0 articles affichés
 * et déclencher une désindexation SEO injustifiée.
 *
 * Job répétitif BullMQ: Toutes les 30 minutes
 */

import { Processor, Process, OnQueueError, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

interface SeoMonitorJobData {
  taskType: 'check-critical-urls' | 'check-random-sample';
  triggeredBy: 'scheduler' | 'api' | 'alert';
}

interface UrlCheckResult {
  url: string;
  typeId: number;
  gammeId: number;
  piecesCount: number;
  status: 'ok' | 'warning' | 'error';
  message?: string;
  checkedAt: string;
}

interface MonitoringResult {
  totalChecked: number;
  okCount: number;
  warningCount: number;
  errorCount: number;
  alerts: UrlCheckResult[];
  timestamp: string;
}

@Processor('seo-monitor')
export class SeoMonitorProcessor {
  private readonly logger = new Logger(SeoMonitorProcessor.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    // Initialiser client Supabase
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * URLs critiques à surveiller en priorité
   * Ces URLs génèrent le plus de trafic organique
   */
  private readonly CRITICAL_URLS = [
    // Filtres à huile populaires
    {
      url: '/pieces/filtre-a-huile-75/renault-140/clio-iii-140004/1-5-dci-19052.html',
      typeId: 19052,
      gammeId: 75,
    },
    {
      url: '/pieces/filtre-a-huile-75/peugeot-118/208-118001/1-6-bluehdi-75-18781.html',
      typeId: 18781,
      gammeId: 75,
    },
    {
      url: '/pieces/filtre-a-huile-75/citroen-46/c4-picasso-46012/2-0-hdi-19053.html',
      typeId: 19053,
      gammeId: 75,
    },

    // Plaquettes de frein populaires
    {
      url: '/pieces/plaquettes-de-frein-11/volkswagen-166/golf-v-166005/1-9-tdi-19087.html',
      typeId: 19087,
      gammeId: 11,
    },
    {
      url: '/pieces/plaquettes-de-frein-11/audi-11/a3-11001/2-0-tdi-18782.html',
      typeId: 18782,
      gammeId: 11,
    },

    // Disques de frein
    {
      url: '/pieces/disque-de-frein-10/bmw-24/serie-3-24003/320d-18783.html',
      typeId: 18783,
      gammeId: 10,
    },

    // Amortisseurs
    {
      url: '/pieces/amortisseur-1/mercedes-107/classe-c-107003/220-cdi-18784.html',
      typeId: 18784,
      gammeId: 1,
    },

    // TODO: Ajouter plus d'URLs critiques basées sur Google Analytics
  ];

  /**
   * 🔍 Traite le job de monitoring SEO
   */
  @Process('check-pages')
  async handleMonitoring(
    job: Job<SeoMonitorJobData>,
  ): Promise<MonitoringResult> {
    this.logger.log(
      `🔍 [Job #${job.id}] Démarrage monitoring SEO (${job.data.taskType})`,
    );

    const startTime = Date.now();
    const results: UrlCheckResult[] = [];

    try {
      // Job de vérification des URLs critiques
      if (job.data.taskType === 'check-critical-urls') {
        await job.progress(10);

        for (let i = 0; i < this.CRITICAL_URLS.length; i++) {
          const urlConfig = this.CRITICAL_URLS[i];

          const result = await this.checkUrl(
            urlConfig.url,
            urlConfig.typeId,
            urlConfig.gammeId,
          );

          results.push(result);

          // Mise à jour progression
          const progress =
            Math.floor(((i + 1) / this.CRITICAL_URLS.length) * 80) + 10;
          await job.progress(progress);
        }
      }

      // Job de vérification d'échantillon aléatoire
      else if (job.data.taskType === 'check-random-sample') {
        await job.progress(10);

        const randomUrls = await this.getRandomUrlSample(20);

        for (let i = 0; i < randomUrls.length; i++) {
          const urlConfig = randomUrls[i];

          const result = await this.checkUrl(
            urlConfig.url,
            urlConfig.typeId,
            urlConfig.gammeId,
          );

          results.push(result);

          const progress = Math.floor(((i + 1) / randomUrls.length) * 80) + 10;
          await job.progress(progress);
        }
      }

      await job.progress(90);

      // Analyse des résultats
      const analysis = this.analyzeResults(results);

      // Envoi alertes si erreurs critiques
      if (analysis.errorCount > 0) {
        await this.sendAlerts(analysis.alerts);
      }

      await job.progress(100);

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ [Job #${job.id}] Monitoring terminé en ${duration}ms - ` +
          `${analysis.okCount} OK, ${analysis.warningCount} warnings, ${analysis.errorCount} erreurs`,
      );

      return analysis;
    } catch (error) {
      this.logger.error(
        `❌ [Job #${job.id}] Erreur monitoring:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * 🔍 Vérifie une URL spécifique
   */
  private async checkUrl(
    url: string,
    typeId: number,
    gammeId: number,
  ): Promise<UrlCheckResult> {
    try {
      // Requête SQL pour compter les pièces compatibles
      // Table réelle: __cross_gamme_car (cross-reference gamme × vehicule)
      const { data, error } = await this.supabase
        .from('__cross_gamme_car')
        .select('cgc_id', { count: 'exact' })
        .eq('cgc_type_id', typeId)
        .eq('cgc_pg_id', gammeId);

      if (error) {
        return {
          url,
          typeId,
          gammeId,
          piecesCount: -1,
          status: 'error',
          message: `Erreur DB: ${error.message}`,
          checkedAt: new Date().toISOString(),
        };
      }

      const count = data?.length || 0;

      // Analyse du résultat
      if (count === 0) {
        this.logger.error(
          `🚨 ALERTE SEO: 0 pièce trouvée pour ${url} (typeId=${typeId}, gammeId=${gammeId})`,
        );
        return {
          url,
          typeId,
          gammeId,
          piecesCount: 0,
          status: 'error',
          message: '🚨 RISQUE DÉSINDEXATION: 0 pièce trouvée',
          checkedAt: new Date().toISOString(),
        };
      }

      if (count < 5) {
        this.logger.warn(`⚠️ WARNING: Seulement ${count} pièce(s) pour ${url}`);
        return {
          url,
          typeId,
          gammeId,
          piecesCount: count,
          status: 'warning',
          message: `⚠️ Peu de pièces disponibles (${count})`,
          checkedAt: new Date().toISOString(),
        };
      }

      // OK
      return {
        url,
        typeId,
        gammeId,
        piecesCount: count,
        status: 'ok',
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur vérification ${url}:`, error.message);
      return {
        url,
        typeId,
        gammeId,
        piecesCount: -1,
        status: 'error',
        message: error.message,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 🎲 Récupère un échantillon aléatoire d'URLs à surveiller
   */
  private async getRandomUrlSample(
    limit: number = 20,
  ): Promise<Array<{ url: string; typeId: number; gammeId: number }>> {
    try {
      // Requête pour récupérer 20 combinaisons type+gamme aléatoires
      const { data, error } = await this.supabase.rpc(
        'get_random_vehicle_gamme_combinations',
        {
          sample_size: limit,
        },
      );

      if (error || !data) {
        this.logger.warn('⚠️ Impossible de récupérer échantillon aléatoire');
        return [];
      }

      return data.map((row: any) => ({
        url: this.buildUrl(
          row.marque_alias,
          row.modele_alias,
          row.type_alias,
          row.gamme_alias,
          row.id_type,
          row.id_pg,
        ),
        typeId: row.id_type,
        gammeId: row.id_pg,
      }));
    } catch (error) {
      this.logger.error('❌ Erreur échantillon aléatoire:', error.message);
      return [];
    }
  }

  /**
   * 🔧 Construit une URL de pièce
   * Format: /pieces/{gamme-id}/{marque}/{modele}/{type-id}.html
   */
  private buildUrl(
    marqueAlias: string,
    modeleAlias: string,
    typeAlias: string,
    gammeAlias: string,
    typeId: number,
    gammeId: number,
  ): string {
    return `/pieces/${gammeAlias}-${gammeId}/${marqueAlias}/${modeleAlias}/${typeAlias}-${typeId}.html`;
  }

  /**
   * 📊 Analyse les résultats de monitoring
   */
  private analyzeResults(results: UrlCheckResult[]): MonitoringResult {
    const okCount = results.filter((r) => r.status === 'ok').length;
    const warningCount = results.filter((r) => r.status === 'warning').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    const alerts = results.filter(
      (r) => r.status === 'error' || r.status === 'warning',
    );

    return {
      totalChecked: results.length,
      okCount,
      warningCount,
      errorCount,
      alerts,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 🚨 Envoie des alertes pour les erreurs critiques
   */
  private async sendAlerts(alerts: UrlCheckResult[]): Promise<void> {
    for (const alert of alerts) {
      // Log structuré pour Vector
      this.logger.error({
        event: 'seo_page_no_results',
        severity: alert.status === 'error' ? 'critical' : 'warning',
        url: alert.url,
        typeId: alert.typeId,
        gammeId: alert.gammeId,
        piecesCount: alert.piecesCount,
        message: alert.message,
        risk: 'désindexation SEO',
        timestamp: alert.checkedAt,
      });
    }

    // TODO: Envoyer vers Slack/Email si erreurs critiques
    // if (alerts.some(a => a.status === 'error')) {
    //   await this.notificationService.sendSlackAlert({...});
    // }
  }

  /**
   * ❌ Gestion des erreurs de queue
   */
  @OnQueueError()
  handleError(error: Error) {
    this.logger.error('❌ Erreur queue seo-monitor:', error.message);
  }

  /**
   * 💥 Gestion des jobs échoués
   */
  @OnQueueFailed()
  handleFailedJob(job: Job, error: Error) {
    this.logger.error(
      `💥 Job #${job.id} échoué après ${job.attemptsMade} tentatives:`,
      error.message,
    );
  }
}
