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
   *
   * ⚠️ IMPORTANT: Les gammeIds corrects sont:
   * - Filtre à huile = 7 (pas 75)
   * - Disque de frein = 82 (pas 10)
   * - Plaquette de frein = 402 (pas 11)
   * - Amortisseur = 854 (pas 1)
   *
   * Combinaisons validées depuis __cross_gamme_car (2026-02-02)
   */
  private readonly CRITICAL_URLS = [
    // Filtres à huile (gamme 7)
    {
      url: '/pieces/filtre-a-huile-7/renault-140/scenic-iii-140089/1-5-dci-5853.html',
      typeId: 5853,
      gammeId: 7,
    },
    {
      url: '/pieces/filtre-a-huile-7/peugeot-128/306-128032/1-4-2480.html',
      typeId: 2480,
      gammeId: 7,
    },

    // Plaquettes de frein (gamme 402)
    {
      url: '/pieces/plaquette-de-frein-402/renault-140/clio-iii-140004/1-5-dci-19051.html',
      typeId: 19051,
      gammeId: 402,
    },
    {
      url: '/pieces/plaquette-de-frein-402/volkswagen-173/golf-iv-173039/1-9-tdi-13100.html',
      typeId: 13100,
      gammeId: 402,
    },

    // Disques de frein (gamme 82)
    {
      url: '/pieces/disque-de-frein-82/bmw-33/serie-5-e60-33052/3-0-535-d-18308.html',
      typeId: 18308,
      gammeId: 82,
    },
    {
      url: '/pieces/disque-de-frein-82/renault-140/laguna-ii-140028/1-9-dci-15476.html',
      typeId: 15476,
      gammeId: 82,
    },

    // Amortisseurs (gamme 854)
    {
      url: '/pieces/amortisseur-854/renault-140/scenic-ii-140088/1-9-dci-17441.html',
      typeId: 17441,
      gammeId: 854,
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
