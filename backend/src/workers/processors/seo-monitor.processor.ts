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
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { RpcGateService } from '../../security/rpc-gate/rpc-gate.service';
import { getErrorMessage } from '../../common/utils/error.utils';

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
export class SeoMonitorProcessor extends SupabaseBaseService {
  protected override readonly logger = new Logger(SeoMonitorProcessor.name);

  constructor(configService: ConfigService, rpcGate: RpcGateService) {
    super(configService);
    this.rpcGate = rpcGate;
  }

  /**
   * URLs critiques a surveiller en priorite
   * Combos type+gamme verifiees dans pieces_relation_type (source de verite du listing)
   */
  private readonly CRITICAL_URLS = [
    // Filtres a huile (gamme 7) — Peugeot Partner I
    {
      url: '/pieces/filtre-a-huile-7/peugeot-128/partner-i-combispace-128094/1-4-phase-1-8217.html',
      typeId: 8217,
      gammeId: 7,
    },
    {
      url: '/pieces/filtre-a-huile-7/peugeot-128/partner-i-128093/1-4-phase-1-7977.html',
      typeId: 7977,
      gammeId: 7,
    },

    // Disques de frein (gamme 82) — VW Golf VI
    {
      url: '/pieces/disque-de-frein-82/volkswagen-173/golf-vi-173046/2-0-gti-30971.html',
      typeId: 30971,
      gammeId: 82,
    },
    {
      url: '/pieces/disque-de-frein-82/volkswagen-173/golf-vi-173046/1-6-29991.html',
      typeId: 29991,
      gammeId: 82,
    },

    // Plaquettes de frein (gamme 402) — VW Transporter IV
    {
      url: '/pieces/plaquette-de-frein-402/volkswagen-173/transporter-iv-fourgon-173146/2-5-tdi-8773.html',
      typeId: 8773,
      gammeId: 402,
    },
    {
      url: '/pieces/plaquette-de-frein-402/volkswagen-173/transporter-iv-fourgon-173146/1-9-td-6318.html',
      typeId: 6318,
      gammeId: 402,
    },

    // Amortisseurs (gamme 854) — BMW Serie 3 E46
    {
      url: '/pieces/amortisseur-854/bmw-33/serie-3-e46-33027/2-2-320-i-15452.html',
      typeId: 15452,
      gammeId: 854,
    },
    {
      url: '/pieces/amortisseur-854/bmw-33/serie-3-e46-33027/1-9-316-i-11042.html',
      typeId: 11042,
      gammeId: 854,
    },
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
        getErrorMessage(error),
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
      // Source de verite: pieces_relation_type (meme table que la RPC get_pieces_for_type_gamme_v4)
      const { count, error } = await this.supabase
        .from('pieces_relation_type')
        .select('rtp_piece_id', { count: 'exact', head: true })
        .eq('rtp_type_id', typeId)
        .eq('rtp_ga_id', gammeId);

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

      const piecesCount = count ?? 0;

      // Analyse du résultat
      if (piecesCount === 0) {
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

      if (piecesCount < 5) {
        this.logger.warn(
          `⚠️ WARNING: Seulement ${piecesCount} pièce(s) pour ${url}`,
        );
        return {
          url,
          typeId,
          gammeId,
          piecesCount,
          status: 'warning',
          message: `⚠️ Peu de pièces disponibles (${piecesCount})`,
          checkedAt: new Date().toISOString(),
        };
      }

      // OK
      return {
        url,
        typeId,
        gammeId,
        piecesCount,
        status: 'ok',
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur vérification ${url}:`,
        getErrorMessage(error),
      );
      return {
        url,
        typeId,
        gammeId,
        piecesCount: -1,
        status: 'error',
        message: getErrorMessage(error),
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
      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<any[]>(
        'get_random_vehicle_gamme_combinations',
        { sample_size: limit },
        { source: 'cron' },
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
      this.logger.error(
        '❌ Erreur échantillon aléatoire:',
        getErrorMessage(error),
      );
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
