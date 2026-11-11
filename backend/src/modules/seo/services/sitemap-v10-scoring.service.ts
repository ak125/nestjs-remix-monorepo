/**
 * 📊 SERVICE SCORING V10 ULTRA ROBUSTE - CALCUL SCORES ENTITÉS SEO
 *
 * Algorithme de scoring multi-dimensionnel (7 familles):
 * 1. BusinessValue: 35% (marge, conversion, stock, panier moyen)
 * 2. Demand: 25% (recherche interne + SEO matrix + impressions/CTR)
 * 3. GraphStrength: 10% (inbound links, hub links, breadcrumbs)
 * 4. ClusterDepth: 10% (nb pages satellites valides)
 * 5. ContentStrength: 20% (qualité, unicité, structure)
 *
 * Pénalités:
 * - Risk (duplication): -30%
 * - Risk (orphan): -80%
 * - Confusion: -100% (bloquant)
 *
 * RÈGLES BLOQUANTES (non-négociables):
 * - confusionRisk >= 50 → EXCLUDE
 * - meta_robots contains 'noindex' → EXCLUDE
 * - status_target connu et != 200 → EXCLUDE (inconnu = non bloquant)
 * - canonical_url incohérent → EXCLUDE
 *
 * Buckets (score brut 0-200):
 * - HOT: score >= 120 (daily crawl)
 * - NEW: < 48h + score >= 90
 * - STABLE: score 90-119
 * - COLD: score 60-89
 * - EXCLUDE: score < 60 OU bloquant
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { DatabaseException, ErrorCodes } from '@common/exceptions';

// Types
export interface EntityInputs {
  // 7 familles de signaux
  businessValue: number; // 0-100 (marge, conversion, stock, panier moyen)
  demand: number; // 0-100 (recherche interne + SEO matrix + impressions/CTR)
  graphStrength: number; // 0-100 (inbound links + hub links + breadcrumbs)
  clusterDepth: number; // count (nb pages satellites valides)
  contentStrength: number; // 0-100 (qualité, unicité, structure)

  // Risques
  duplicationRisk: number; // 0-100
  orphanRisk: number; // 0-100
  thinContentRisk: number; // 0-100 (word_count < 300)
  confusionRisk: number; // 0-100 (règles métier bloquantes)

  // Métadonnées pour règles bloquantes
  metaRobots?: string; // Pour vérifier noindex
  statusTarget?: number | null; // Pour vérifier != 200 (absent = inconnu)
  canonicalUrl?: string; // Pour vérifier incohérence
  url?: string; // URL de la page
  isRecent?: boolean; // < 48h depuis publication
}

export interface EntityScore {
  total: number; // Score brut 0-200
  normalized: number; // Score normalisé 0-100
  bucket: 'hot' | 'new' | 'stable' | 'cold' | 'exclude';
  isBlocked: boolean; // True si règle bloquante appliquée
  blockReason?: string; // Raison du blocage
  breakdown: {
    positives: number;
    negatives: number;
    graphNorm: number;
    clusterNorm: number;
  };
}

/**
 * Issue d'un recalcul :
 * - `ok`                 : toutes les entrées lues, tous les scores écrits ;
 * - `inputs_unavailable` : une source d'entrée est vide ou non alimentée,
 *                          aucun score n'a été écrit ;
 * - `failed`             : une lecture, une écriture ou la propagation des
 *                          températures a échoué.
 */
export type ScoringStatus = 'ok' | 'inputs_unavailable' | 'failed';

export interface ScoringResult {
  /** Vrai seulement quand `status === 'ok'`. */
  success: boolean;
  status: ScoringStatus;
  /** Libellé fixe de la cause (le détail technique reste dans les logs). */
  reason?: string;
  processed: number;
  updated: number;
  errors: number;
  durationMs: number;
}

// Poids de scoring (configurables) - Total positifs = 1.0
const WEIGHTS = {
  // Signaux positifs (somme = 1.0)
  business: 0.35, // BusinessValue
  demand: 0.25, // Demand
  graph: 0.1, // GraphStrength
  cluster: 0.1, // ClusterDepth
  content: 0.2, // ContentStrength

  // Pénalités (multiplicateurs négatifs)
  duplication: 0.3, // -30% du score max
  orphan: 0.8, // -80% (très pénalisant)
  thinContent: 0.2, // -20%
  confusion: 1.0, // -100% (bloquant)
};

// Seuils de bucketing (score brut 0-200)
const THRESHOLDS = {
  HOT: 120, // score >= 120
  STABLE: 90, // score >= 90
  COLD: 60, // score >= 60
  EXCLUDE: 60, // score < 60
  NEW_MIN: 90, // Pour NEW: isRecent + score >= 90
};

// Taille de page des lectures (plafond de lignes par requête PostgREST)
const READ_PAGE_SIZE = 1000;

interface ScoringPageRow {
  id: number;
  url: string;
  entity_id: number | null;
  page_type: string | null;
  meta_robots: string | null;
  canonical_url: string | null;
  status_target: number | null;
  last_published_at: string | null;
  title: string | null;
  meta_description: string | null;
}

@Injectable()
export class SitemapV10ScoringService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    SitemapV10ScoringService.name,
  );

  constructor(configService: ConfigService, rpcGate: RpcGateService) {
    super(configService);
    this.rpcGate = rpcGate;

    this.logger.log('📊 SitemapV10ScoringService initialized');
  }

  /**
   * Calcule le score d'une entité (algorithme ultra robuste)
   */
  scoreEntity(inputs: EntityInputs): EntityScore {
    // ========================================
    // 1. RÈGLES BLOQUANTES (non-négociables)
    // ========================================
    let isBlocked = false;
    let blockReason: string | undefined;

    // Règle 1: confusionRisk >= 50
    if (inputs.confusionRisk >= 50) {
      isBlocked = true;
      blockReason = 'confusionRisk >= 50';
    }

    // Règle 2: meta_robots contains 'noindex'
    if (inputs.metaRobots?.toLowerCase().includes('noindex')) {
      isBlocked = true;
      blockReason = 'meta_robots contains noindex';
    }

    // Règle 3: status_target connu et != 200 (absent = inconnu, non bloquant)
    if (inputs.statusTarget != null && inputs.statusTarget !== 200) {
      isBlocked = true;
      blockReason = `status_target = ${inputs.statusTarget} (not 200)`;
    }

    // Règle 4: canonical_url incohérent
    if (
      inputs.canonicalUrl &&
      inputs.url &&
      inputs.canonicalUrl !== inputs.url
    ) {
      isBlocked = true;
      blockReason = 'canonical_url inconsistent';
    }

    // ========================================
    // 2. CALCUL DU SCORE
    // ========================================

    // Normalisations
    const graphNorm = Math.min(100, inputs.graphStrength); // Déjà 0-100
    const clusterNorm = Math.min(100, inputs.clusterDepth * 10); // 10 pages = 100

    // Score positif (max théorique = 100 * 1.0 = 100)
    const positives =
      inputs.businessValue * WEIGHTS.business +
      inputs.demand * WEIGHTS.demand +
      graphNorm * WEIGHTS.graph +
      clusterNorm * WEIGHTS.cluster +
      inputs.contentStrength * WEIGHTS.content;

    // Score négatif (pénalités)
    const negatives =
      inputs.duplicationRisk * WEIGHTS.duplication +
      inputs.orphanRisk * WEIGHTS.orphan +
      (inputs.thinContentRisk || 0) * WEIGHTS.thinContent +
      inputs.confusionRisk * WEIGHTS.confusion;

    // Score brut (peut aller de 0 à ~200 en pratique)
    // On multiplie par 2 pour avoir une échelle 0-200
    const total = Math.max(0, (positives - negatives) * 2);

    // Score normalisé 0-100 (pour compatibilité)
    const maxPossible = 100 * 2; // Échelle 0-200
    const normalized = Math.round((total / maxPossible) * 100);

    // ========================================
    // 3. BUCKETING FINAL
    // ========================================
    let bucket: EntityScore['bucket'];

    if (isBlocked || total < THRESHOLDS.EXCLUDE) {
      bucket = 'exclude';
    } else if (inputs.isRecent && total >= THRESHOLDS.NEW_MIN) {
      // NEW: publié < 48h ET score >= 90
      bucket = 'new';
    } else if (total >= THRESHOLDS.HOT) {
      // HOT: score >= 120
      bucket = 'hot';
    } else if (total >= THRESHOLDS.STABLE) {
      // STABLE: score 90-119
      bucket = 'stable';
    } else {
      // COLD: score 60-89
      bucket = 'cold';
    }

    return {
      total: Math.round(total),
      normalized,
      bucket,
      isBlocked,
      blockReason,
      breakdown: {
        positives: Math.round(positives),
        negatives: Math.round(negatives),
        graphNorm: Math.round(graphNorm),
        clusterNorm: Math.round(clusterNorm),
      },
    };
  }

  /**
   * Lit toutes les lignes d'une source, page par page. Une erreur de lecture
   * lève : une source illisible n'est jamais traitée comme une source vide.
   */
  private async readAll<T>(
    label: string,
    fetchPage: (
      from: number,
      to: number,
    ) => PromiseLike<{
      data: T[] | null;
      error: { message: string } | null;
    }>,
  ): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += READ_PAGE_SIZE) {
      const { data, error } = await fetchPage(from, from + READ_PAGE_SIZE - 1);
      if (error) {
        throw new DatabaseException({
          code: ErrorCodes.DATABASE.OPERATION_FAILED,
          message: `Failed to load ${label}: ${error.message}`,
          details: error.message,
          cause: error instanceof Error ? error : undefined,
        });
      }
      rows.push(...(data ?? []));
      if (!data || data.length < READ_PAGE_SIZE) return rows;
    }
  }

  /**
   * Recalcule les scores pour toutes les pages.
   *
   * Fermé par défaut : aucun score n'est écrit tant qu'une source d'entrée est
   * illisible, vide ou non alimentée. Une entrée inconnue n'est pas une
   * pénalité — sans graphe de liens, toute page serait notée orpheline, et
   * sans titre ni description, toute page serait notée dupliquée et pauvre.
   */
  async refreshAllScores(): Promise<ScoringResult> {
    const startTime = Date.now();
    this.logger.log('🔄 Starting full score refresh...');

    let processed = 0;
    let updated = 0;
    let errors = 0;
    let phase = 'input read';

    const finish = (status: ScoringStatus, reason?: string): ScoringResult => {
      const durationMs = Date.now() - startTime;
      const summary = `processed=${processed} updated=${updated} errors=${errors} durationMs=${durationMs}`;
      if (status === 'ok') {
        this.logger.log(`✅ Score refresh complete: ${summary}`);
      } else {
        this.logger.warn(
          `Score refresh stopped (${status}: ${reason}): ${summary}`,
        );
      }
      return {
        success: status === 'ok',
        status,
        reason,
        processed,
        updated,
        errors,
        durationMs,
      };
    };

    try {
      // 1. Liens entrants avec types (GraphStrength, orphanRisk) — lus en
      //    premier : sans eux, rien d'autre n'a besoin d'être chargé.
      const inboundData = await this.readAll<{
        to_url: string;
        link_type: string | null;
      }>('inbound links', (from, to) =>
        this.supabase
          .from('__seo_internal_link')
          .select('to_url, link_type')
          .eq('is_active', true)
          .order('id', { ascending: true })
          .range(from, to),
      );

      if (inboundData.length === 0) {
        return finish('inputs_unavailable', 'inbound link graph is empty');
      }

      // Compter liens par URL et type
      const inboundMap = new Map<
        string,
        { total: number; hub: number; breadcrumb: number }
      >();
      for (const row of inboundData) {
        const current = inboundMap.get(row.to_url) || {
          total: 0,
          hub: 0,
          breadcrumb: 0,
        };
        current.total++;
        if (row.link_type === 'hub') current.hub++;
        if (row.link_type === 'breadcrumb') current.breadcrumb++;
        inboundMap.set(row.to_url, current);
      }

      // 2. Charger les violations/blockers (30 jours)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const violationsData = await this.readAll<{
        sql_record_id: string;
        sql_severity: string | null;
      }>('quality log', (from, to) =>
        this.supabase
          .from('__seo_quality_log')
          .select('sql_record_id, sql_severity')
          .gte('sql_created_at', thirtyDaysAgo.toISOString())
          .order('sql_id', { ascending: true })
          .range(from, to),
      );

      const blockersMap = new Map<string, boolean>();
      for (const row of violationsData) {
        if (row.sql_severity === 'block') {
          blockersMap.set(row.sql_record_id, true);
        }
      }

      // 3. Charger les pages AVEC meta_robots, canonical, status
      // Note: On ne filtre pas status_target ici pour détecter les erreurs
      const pages = await this.readAll<ScoringPageRow>('pages', (from, to) =>
        this.supabase
          .from('__seo_page')
          .select(
            'id, url, entity_id, page_type, meta_robots, canonical_url, status_target, last_published_at, title, meta_description',
          )
          .eq('is_indexable_hint', true)
          .order('id', { ascending: true })
          .range(from, to),
      );

      this.logger.log(`   Found ${pages.length} pages to score`);

      if (pages.length === 0) {
        return finish('inputs_unavailable', 'no indexable page to score');
      }
      if (!pages.some((page) => page.title)) {
        return finish('inputs_unavailable', 'no page carries a title');
      }
      if (!pages.some((page) => page.meta_description)) {
        return finish(
          'inputs_unavailable',
          'no page carries a meta description',
        );
      }

      // 4. Compter pages par entity (pour ClusterDepth)
      const clusterMap = new Map<number, number>();
      for (const page of pages) {
        if (page.entity_id) {
          const count = clusterMap.get(page.entity_id) || 0;
          clusterMap.set(page.entity_id, count + 1);
        }
      }

      phase = 'scoring';

      // 5. Calculer et mettre à jour les scores
      const recentThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h
      const scoresToInsert: Array<{
        url: string;
        entity_id: number | null;
        score_total: number;
        score_traffic: number;
        score_conversion: number;
        score_revenue: number;
        score_freshness: number;
        score_backlinks: number;
        score_internal: number;
        inbound_links: number;
        orphan_risk: number;
        duplication_risk: number;
        confusion_risk: number;
        is_blocked: boolean;
        block_reason: string | undefined;
        bucket: 'hot' | 'new' | 'stable' | 'cold' | 'exclude';
      }> = [];

      for (const page of pages) {
        processed++;

        const links = inboundMap.get(page.url) || {
          total: 0,
          hub: 0,
          breadcrumb: 0,
        };
        const hasBlocker = blockersMap.get(page.url) || false;
        const clusterSize = page.entity_id
          ? clusterMap.get(page.entity_id) || 1
          : 1;
        const publishedAt = page.last_published_at
          ? new Date(page.last_published_at)
          : null;
        const isRecent = publishedAt && publishedAt >= recentThreshold;

        // ========================================
        // RÈGLES BLOQUANTES → confusionRisk = 100
        // ========================================
        let confusionRisk = 0;

        // Règle 1: Blocker SEO existant
        if (hasBlocker) confusionRisk = 100;

        // Règle 2: meta_robots noindex
        if (page.meta_robots?.toLowerCase().includes('noindex'))
          confusionRisk = 100;

        // Règle 3: status_target connu et != 200 (absent = inconnu)
        if (page.status_target != null && page.status_target !== 200)
          confusionRisk = 100;

        // Règle 4: canonical incohérent
        if (page.canonical_url && page.canonical_url !== page.url)
          confusionRisk = 100;

        // ========================================
        // CALCUL DES 7 FAMILLES DE SIGNAUX
        // ========================================

        // 1. BusinessValue (heuristique - à brancher sur données réelles)
        const businessValue =
          page.page_type === 'canonical'
            ? 80
            : page.page_type === 'product'
              ? 70
              : 50;

        // 2. Demand: differentiate by page type since GSC data not available
        const demand =
          page.page_type === 'canonical'
            ? 75
            : page.page_type === 'product'
              ? 50
              : 30;

        // 3. GraphStrength (liens entrants pondérés)
        const graphStrength = Math.min(
          100,
          links.total * 5 + // 5 pts par lien
            links.hub * 10 + // +10 pts si hub
            links.breadcrumb * 5, // +5 pts si breadcrumb
        );

        // 4. ClusterDepth
        const clusterDepth = clusterSize;

        // 5. ContentStrength (heuristique)
        const contentStrength = page.page_type === 'canonical' ? 70 : 40;

        // Risques
        const orphanRisk = links.total === 0 ? 100 : links.total < 2 ? 40 : 0;
        // Duplication risk: pages without unique title/description are at higher risk
        const duplicationRisk =
          !page.title && !page.meta_description
            ? 60
            : !page.title || !page.meta_description
              ? 30
              : 5;
        // Thin content risk: pages without title or description are thin
        const thinContentRisk =
          !page.title && !page.meta_description
            ? 80
            : !page.meta_description
              ? 40
              : 0;

        // Calculer le score avec l'algorithme ultra robuste
        const score = this.scoreEntity({
          businessValue,
          demand,
          graphStrength,
          clusterDepth,
          contentStrength,
          duplicationRisk,
          orphanRisk,
          thinContentRisk,
          confusionRisk,
          metaRobots: page.meta_robots ?? undefined,
          statusTarget: page.status_target,
          canonicalUrl: page.canonical_url ?? undefined,
          url: page.url,
          isRecent: isRecent || false,
        });

        // Scores pour la table (compatibilité avec colonnes existantes)
        const freshnessScore = isRecent ? 100 : publishedAt ? 50 : 30;

        scoresToInsert.push({
          url: page.url,
          entity_id: page.entity_id,
          score_total: score.normalized,
          score_traffic: Math.min(100, demand),
          score_conversion: Math.min(100, businessValue),
          score_revenue: Math.min(100, businessValue * 0.8),
          score_freshness: freshnessScore,
          score_backlinks: Math.min(100, links.total * 10),
          score_internal: graphStrength,
          inbound_links: links.total,
          orphan_risk: orphanRisk,
          duplication_risk: duplicationRisk,
          confusion_risk: confusionRisk,
          is_blocked: score.isBlocked,
          block_reason: score.blockReason,
          bucket: score.bucket,
        });
      }

      // 6. Upsert par batch de 1000 — arrêt au premier lot refusé : des
      //    scores partiels ne doivent pas atteindre les températures.
      phase = 'score write';
      const batchSize = 1000;
      for (let i = 0; i < scoresToInsert.length; i += batchSize) {
        const batch = scoresToInsert.slice(i, i + batchSize);

        const { error: upsertError } = await this.supabase
          .from('__seo_entity_score_v10')
          .upsert(batch, { onConflict: 'url' });

        if (upsertError) {
          this.logger.error(`Batch upsert error: ${upsertError.message}`);
          errors = scoresToInsert.length - updated;
          return finish('failed', 'score write failed');
        }
        updated += batch.length;
      }

      // 7. Mettre à jour les températures dans __seo_page
      // 🛡️ RPC Safety Gate
      phase = 'temperature refresh';
      const { data: refreshResult, error: refreshError } =
        await this.callRpc<number>(
          'refresh_temperature_scores',
          {},
          { source: 'cron' },
        );
      if (refreshError) {
        this.logger.error(`Temperature refresh error: ${refreshError.message}`);
        errors++;
        return finish('failed', 'temperature refresh failed');
      }
      this.logger.log(
        `   Updated temperatures for ${refreshResult || 0} pages`,
      );

      return finish('ok');
    } catch (error) {
      this.logger.error(`Score refresh failed during ${phase}: ${error}`);
      errors++;
      return finish('failed', `${phase} failed`);
    }
  }

  /**
   * Obtenir les statistiques de distribution des scores.
   * Lève si la vue est illisible (jamais de zéros à la place d'une panne).
   */
  async getScoreDistribution(): Promise<{
    byBucket: Record<string, number>;
    avgScore: number;
    totalScored: number;
  }> {
    const { data: stats, error } = await this.supabase
      .from('v_seo_temperature_stats')
      .select('*');

    // Une vue illisible n'est pas une distribution vide.
    if (error) {
      throw new DatabaseException({
        code: ErrorCodes.DATABASE.OPERATION_FAILED,
        message: `Failed to load score distribution: ${error.message}`,
        details: error.message,
        cause: error instanceof Error ? error : undefined,
      });
    }

    const byBucket: Record<string, number> = {};
    let totalUrls = 0;
    let weightedScore = 0;

    for (const row of stats || []) {
      byBucket[row.temperature] = Number(row.url_count) || 0;
      totalUrls += Number(row.url_count) || 0;
      weightedScore +=
        (Number(row.url_count) || 0) * (Number(row.avg_score) || 0);
    }

    return {
      byBucket,
      avgScore: totalUrls > 0 ? Math.round(weightedScore / totalUrls) : 0,
      totalScored: totalUrls,
    };
  }
}
