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
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { getErrorMessage } from '@common/utils/error.utils';
import { buildPieceVehicleUrl } from '@common/utils/url-builder.utils';
import { AdminJobHealthService } from '../../modules/admin/services/admin-job-health.service';
import {
  getTypeModelIndex,
  sitemapLinkState,
} from '../../modules/seo/helpers/auto-type-valid-ids.helper';

/**
 * Seuil « peu de pièces » (warning). C'est aussi la borne de lecture de la
 * sonde `checkUrl` : au-delà, le compte exact n'a aucune valeur de décision.
 */
const WARNING_THRESHOLD = 5;

/** Nombre de tirages de l'échantillon aléatoire (valeur historique du job). */
const RANDOM_SAMPLE_SIZE = 20;

/**
 * Source de l'échantillon : la table qui alimente le sitemap des pages pièces
 * (`SitemapV10PiecesService`). Chaque ligne est une page R2
 * gamme × véhicule servie.
 */
const SAMPLE_SOURCE = '__sitemap_p_link';
const SAMPLE_COLUMNS =
  'map_id, map_pg_alias, map_pg_id, map_marque_alias, map_marque_id, map_modele_alias, map_modele_id, map_type_alias, map_type_id';

interface SitemapPieceLink {
  map_id: number;
  map_pg_alias: string;
  map_pg_id: number;
  map_marque_alias: string;
  map_marque_id: number;
  map_modele_alias: string;
  map_modele_id: number;
  map_type_alias: string | null;
  map_type_id: number;
}

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
  private lastQueueErrorLog = 0;

  constructor(
    configService: ConfigService,
    rpcGate: RpcGateService,
    private readonly jobHealth: AdminJobHealthService,
  ) {
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
    // ADR-028 Option D — 8e classe : cron registered en preprod (validation
    // BullMQ wiring) mais le handler court-circuite sans appel DB/RPC.
    // Ce gate vit dans le PROCESSOR, pas le scheduler — préserve la couche
    // scheduling validée en preprod miroir prod.
    if (this.isReadOnlyMode) {
      this.logger.warn(
        {
          metric: 'readonly.skipped',
          operation: 'seo-monitor.handleMonitoring',
          jobId: job.id,
          taskType: job.data.taskType,
        },
        `[READ_ONLY] Skip seo-monitor processor (job #${job.id}, ${job.data.taskType}) — cron registered but writes/RPC disabled`,
      );
      return {
        totalChecked: 0,
        okCount: 0,
        warningCount: 0,
        errorCount: 0,
        alerts: [],
        timestamp: new Date().toISOString(),
      };
    }

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

        // Lève si l'échantillon est vide ou illisible : le job échoue
        // (@OnQueueFailed → recordFailure), jamais un succès à 0 page.
        const randomUrls = await this.getRandomUrlSample(RANDOM_SAMPLE_SIZE);

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

      this.jobHealth.recordSuccess('seo-monitor', duration).catch(() => {});

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
      // Source de vérité : pieces_relation_type, MÊME colonne que les RPC de la
      // page R2 (rm_get_page_complete_v2 / get_listing_products_extended /
      // get_soft_404_alternatives) = `rtp_pg_id` (gamme de la page). `rtp_ga_id`
      // est la gamme ARTICLE TecDoc (sous-gamme), non indexée : l'ancien filtre
      // sous-comptait de 1 à 12 % sur les couples critiques et coûtait
      // 2 705 blocs lus par appel (comptage exact sur 368 M lignes, A1 plan
      // massdoc 2026-09-02).
      //
      // Sonde BORNÉE : la décision ne dépend que de « 0 / moins de
      // WARNING_THRESHOLD / au moins WARNING_THRESHOLD » — on lit au plus
      // WARNING_THRESHOLD lignes via l'index composite (rtp_type_id, rtp_pg_id),
      // jamais un COUNT complet.
      const { data, error } = await this.supabase
        .from('pieces_relation_type')
        .select('rtp_piece_id')
        .eq('rtp_type_id', typeId)
        .eq('rtp_pg_id', gammeId)
        .limit(WARNING_THRESHOLD);

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

      // = min(nombre réel, WARNING_THRESHOLD) : exact sous le seuil (ce qui
      // alimente les alertes), « ≥ WARNING_THRESHOLD » au-dessus.
      const piecesCount = data?.length ?? 0;

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

      if (piecesCount < WARNING_THRESHOLD) {
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
   * 🎲 Tire un échantillon aléatoire de pages R2 servies.
   *
   * Source : `__sitemap_p_link`, la table du sitemap des pages pièces. Chaque
   * tirage prend la première ligne dont `map_id` ≥ un point aléatoire de
   * [1, max(map_id)], via la clé primaire (une ligne lue par tirage). Les
   * trous de numérotation pèsent un peu sur la répartition, sans conséquence
   * pour une sonde. Les lignes dont le type n'existe plus, ou a changé de
   * modèle, sont écartées par le même filtre que le sitemap
   * (`sitemapLinkState`).
   *
   * Lève une erreur si une lecture échoue ou si aucune page ne reste : le job
   * doit échouer, pas se terminer en succès sans rien tester (incident #2144 :
   * l'ancienne RPC `get_random_vehicle_gamme_combinations` n'a jamais existé
   * en base, et l'erreur était convertie en liste vide).
   */
  private async getRandomUrlSample(
    sampleSize: number,
  ): Promise<Array<{ url: string; typeId: number; gammeId: number }>> {
    const { data: top, error: topError } = await this.supabase
      .from(SAMPLE_SOURCE)
      .select('map_id')
      .order('map_id', { ascending: false })
      .limit(1);
    if (topError) {
      throw new Error(
        `Échantillon aléatoire : lecture de ${SAMPLE_SOURCE} impossible (${topError.message})`,
      );
    }
    const maxId = Number(top?.[0]?.map_id);
    if (!Number.isInteger(maxId) || maxId < 1) {
      throw new Error(`Échantillon aléatoire : ${SAMPLE_SOURCE} est vide`);
    }

    const drawn = new Map<number, SitemapPieceLink>();
    for (let i = 0; i < sampleSize; i++) {
      const start = 1 + Math.floor(Math.random() * maxId);
      const { data, error } = await this.supabase
        .from(SAMPLE_SOURCE)
        .select(SAMPLE_COLUMNS)
        .gte('map_id', start)
        .order('map_id', { ascending: true })
        .limit(1);
      if (error) {
        throw new Error(
          `Échantillon aléatoire : tirage dans ${SAMPLE_SOURCE} impossible (${error.message})`,
        );
      }
      const row = (data as SitemapPieceLink[] | null)?.[0];
      if (row) drawn.set(row.map_id, row);
    }

    // Lève si auto_type est illisible (jamais un index vide).
    const typeModels = await getTypeModelIndex(this.supabase);
    const live = [...drawn.values()].filter(
      (row) => sitemapLinkState(row, typeModels) === 'live',
    );

    this.logger.log(
      `🎲 Échantillon aléatoire : ${sampleSize} tirages, ${drawn.size} lignes distinctes, ${live.length} pages retenues`,
    );

    if (live.length === 0) {
      throw new Error(
        `Échantillon aléatoire vide : ${drawn.size} ligne(s) tirée(s) dans ${SAMPLE_SOURCE}, aucune page servie`,
      );
    }

    return live.map((row) => ({
      url: buildPieceVehicleUrl(
        row.map_pg_alias,
        row.map_pg_id,
        row.map_marque_alias,
        row.map_marque_id,
        row.map_modele_alias,
        row.map_modele_id,
        row.map_type_alias,
        row.map_type_id,
      ),
      typeId: row.map_type_id,
      gammeId: row.map_pg_id,
    }));
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
    const now = Date.now();
    if (now - this.lastQueueErrorLog > 60_000) {
      this.logger.error(`❌ Erreur queue seo-monitor: ${error.message}`);
      this.lastQueueErrorLog = now;
    }
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
    this.jobHealth.recordFailure('seo-monitor', error.message).catch(() => {});
  }
}
