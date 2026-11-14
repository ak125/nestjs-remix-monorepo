/**
 * 🏷️ GAMME SEO BADGES SERVICE
 *
 * Extracted from AdminGammesSeoService (DEC: reduce 2,064-line file)
 * Handles:
 * - V-Level global statistics dashboard
 * - Gamme aggregates refresh (RPC)
 * - Phase 2 badges (11 badges v2) retrieval
 * - Section K conformity metrics
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';

// ============== EXPORTED TYPES ==============

export interface GammeAggregatesResult {
  products_total: number;
  vehicles_total: number;
  content_words_total: number;
  products_direct: number;
  products_via_vehicles: number;
  products_via_family: number;
  vlevel_counts: {
    V1: number;
    V2: number;
    V3: number;
    V4: number;
    V5: number;
  };
  seo_content_raw_words: number;
  content_breakdown: {
    seo: number;
    conseil: number;
    switches: number;
    purchaseGuide: number;
  };
  computed_at: string | null;
  source_updated_at: string | null;
  // Phase 2 Badges
  priority_score: number;
  catalog_issues: string[];
  smart_actions: Array<{ action: string; priority: string }>;
  // ===== Badges v2 (11 badges) =====
  // Pilotage
  index_policy: 'INDEX' | 'SOFT-INDEX' | 'NOINDEX';
  final_priority: 'P1' | 'P1-PENDING' | 'P2' | 'P3' | 'SOFT-INDEX';
  // Potentiel
  potential_level: 'HIGH' | 'MID' | 'LOW';
  demand_level: 'HIGH' | 'MID' | 'LOW';
  difficulty_level: 'EASY' | 'MED' | 'HARD';
  intent_type: 'BUY' | 'COMPARE' | 'INFO' | 'MIXED';
  // Réalité Intra-Gamme
  catalog_status: 'OK' | 'LOW' | 'EMPTY';
  vehicle_coverage: 'COVERED' | 'PARTIAL' | 'EMPTY';
  content_depth: 'RICH' | 'OK' | 'THIN';
  freshness_status: 'FRESH' | 'STALE' | 'EXPIRED';
  cluster_health: 'STRONG' | 'MISSING' | 'ISOLATED' | 'CANNIBAL';
  topic_purity: 'PURE' | 'DILUTED';
  // Exécutabilité
  execution_status: 'PASS' | 'WARN' | 'FAIL';
}

/**
 * Contrat V-Level des indicateurs globaux (lot A, 2026-11-04).
 *
 * Grain : LIGNE de `public.__seo_keywords` (pas un véhicule unique, pas une
 * audience). Périmètre catalogue et G1 : `public.pieces_gamme`.
 * Identité de contrôle, vérifiée avant toute réponse :
 *   keywords.total = keywords.classified + keywords.unclassified + keywords.unexpectedLevel
 *   somme des tranches de fraîcheur = keywords.total
 * Une lecture incomplète ou incohérente lève une erreur : jamais de zéro substitué.
 */
export const VLEVEL_RECOGNIZED_LEVELS = [
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
] as const;
export type VLevelRecognized = (typeof VLEVEL_RECOGNIZED_LEVELS)[number];

export const VLEVEL_GLOBAL_STATS_CONTRACT = 'vlevel-global-stats.v2' as const;

export interface VLevelGlobalStats {
  contract: typeof VLEVEL_GLOBAL_STATS_CONTRACT;
  source: {
    keywords: '__seo_keywords';
    catalogue: 'pieces_gamme';
  };
  /** Fenêtre de lecture : plusieurs requêtes successives, pas un instantané transactionnel. */
  read: {
    startedAt: string;
    completedAt: string;
    pageSize: number;
    keywordPages: number;
    cataloguePages: number;
  };
  keywords: {
    /** Nombre de lignes de mots-clés. */
    total: number;
    byLevel: Record<VLevelRecognized, number>;
    /** Somme des lignes V1 à V6 : dénominateur des pourcentages par niveau. */
    classified: number;
    /** v_level NULL. */
    unclassified: number;
    /** v_level non NULL hors V1 à V6 (casse comprise) : anomalie signalée. */
    unexpectedLevel: number;
    /** Valeurs inattendues observées, au plus 20, par nombre décroissant. */
    unexpectedLevelValues: Array<{ value: string; count: number }>;
    /** Lignes dont le pg_id est NULL ou absent de pieces_gamme. */
    withoutCatalogueGamme: number;
  };
  gammes: {
    /** Lignes de pieces_gamme. */
    catalogueTotal: number;
    /** pg_id distincts de pieces_gamme portant au moins une ligne V1 à V6. */
    withClassification: number;
    /** Gammes pg_top = '1'. */
    g1Total: number;
    /** Gammes pg_top = '1' portant au moins une ligne V2 (« enregistré », pas « validé »). */
    g1WithV2: number;
  };
  /**
   * Âge de collected_at à l'instant read.startedAt. Bornes incluses :
   * ≤ 7 jours ; > 7 et ≤ 30 jours ; > 30 jours. Absente, invalide ou future = inconnue.
   */
  freshness: {
    upTo7Days: number;
    from7To30Days: number;
    over30Days: number;
    unknownOrInvalid: number;
  };
  dates: {
    /** max(collected_at) parmi les dates valides non futures. */
    latestCollectedAt: string | null;
    /** max(updated_at) parmi les dates valides non futures ; ce n'est pas une date de collecte. */
    latestUpdatedAt: string | null;
  };
}

/** Lecture V-Level impossible ou incohérente : le contrôleur la rend en échec explicite. */
export class VLevelStatsReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VLevelStatsReadError';
  }
}

const VLEVEL_STATS_PAGE_SIZE = 1000;
/** Borne du travail : 200 pages de 1 000 lignes, au-delà la lecture échoue explicitement. */
const VLEVEL_STATS_MAX_PAGES = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class GammeSeoBadgesService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeSeoBadgesService.name);

  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * 📊 Indicateurs globaux V-Level (lecture seule, sans recalcul).
   *
   * Lecture exhaustive par pagination en keyset (ordre unique sur la clé
   * primaire), contrôlée par un comptage exact préalable : une page en erreur,
   * un `data` nul, un dépassement de borne ou un écart entre lignes lues et
   * comptage lèvent `VLevelStatsReadError`. Aucune écriture.
   */
  async getVLevelGlobalStats(
    now: Date = new Date(),
  ): Promise<VLevelGlobalStats> {
    const startedAt = now.toISOString();
    const nowMs = now.getTime();
    this.logger.log('📊 Lecture des indicateurs V-Level (__seo_keywords)');

    const catalogue = await this.readAllPages<{
      pg_id: number | string | null;
      pg_top: string | number | null;
    }>('pieces_gamme', 'pg_id, pg_top', 'pg_id');

    const catalogueIds = new Set<string>();
    const g1Ids = new Set<string>();
    for (const row of catalogue.rows) {
      if (row.pg_id === null || row.pg_id === undefined) continue;
      const id = String(row.pg_id);
      catalogueIds.add(id);
      if (row.pg_top !== null && String(row.pg_top) === '1') g1Ids.add(id);
    }

    const keywords = await this.readAllPages<{
      id: number;
      pg_id: number | string | null;
      v_level: string | null;
      collected_at: string | null;
      updated_at: string | null;
    }>('__seo_keywords', 'id, pg_id, v_level, collected_at, updated_at', 'id');

    const byLevel = Object.fromEntries(
      VLEVEL_RECOGNIZED_LEVELS.map((l) => [l, 0]),
    ) as Record<VLevelRecognized, number>;
    const recognized = new Set<string>(VLEVEL_RECOGNIZED_LEVELS);
    const unexpected = new Map<string, number>();
    const gammesClassified = new Set<string>();
    const g1WithV2 = new Set<string>();
    const freshness = {
      upTo7Days: 0,
      from7To30Days: 0,
      over30Days: 0,
      unknownOrInvalid: 0,
    };
    let unclassified = 0;
    let withoutCatalogueGamme = 0;
    let latestCollectedMs: number | null = null;
    let latestUpdatedMs: number | null = null;

    for (const row of keywords.rows) {
      const pgId =
        row.pg_id === null || row.pg_id === undefined
          ? null
          : String(row.pg_id);
      const inCatalogue = pgId !== null && catalogueIds.has(pgId);
      if (!inCatalogue) withoutCatalogueGamme++;

      const level = row.v_level;
      if (level === null || level === undefined) {
        unclassified++;
      } else if (recognized.has(level)) {
        byLevel[level as VLevelRecognized]++;
        if (inCatalogue && pgId !== null) {
          gammesClassified.add(pgId);
          if (level === 'V2' && g1Ids.has(pgId)) g1WithV2.add(pgId);
        }
      } else {
        unexpected.set(level, (unexpected.get(level) ?? 0) + 1);
      }

      const collectedMs = this.parsePastTimestamp(row.collected_at, nowMs);
      if (collectedMs === null) {
        freshness.unknownOrInvalid++;
      } else {
        const age = nowMs - collectedMs;
        if (age <= 7 * DAY_MS) freshness.upTo7Days++;
        else if (age <= 30 * DAY_MS) freshness.from7To30Days++;
        else freshness.over30Days++;
        if (latestCollectedMs === null || collectedMs > latestCollectedMs) {
          latestCollectedMs = collectedMs;
        }
      }

      const updatedMs = this.parsePastTimestamp(row.updated_at, nowMs);
      if (
        updatedMs !== null &&
        (latestUpdatedMs === null || updatedMs > latestUpdatedMs)
      ) {
        latestUpdatedMs = updatedMs;
      }
    }

    const total = keywords.rows.length;
    const classified = VLEVEL_RECOGNIZED_LEVELS.reduce(
      (sum, l) => sum + byLevel[l],
      0,
    );
    const unexpectedLevel = [...unexpected.values()].reduce((s, n) => s + n, 0);
    const freshnessSum =
      freshness.upTo7Days +
      freshness.from7To30Days +
      freshness.over30Days +
      freshness.unknownOrInvalid;
    if (classified + unclassified + unexpectedLevel !== total) {
      throw new VLevelStatsReadError(
        'Identité de contrôle rompue : total ≠ classés + sans niveau + inattendus',
      );
    }
    if (freshnessSum !== total) {
      throw new VLevelStatsReadError(
        'Tranches de fraîcheur incomplètes : somme ≠ total',
      );
    }

    if (total === 0) {
      this.logger.warn('⚠️ __seo_keywords lue intégralement : source vide');
    }
    if (unexpectedLevel > 0) {
      this.logger.warn(
        `⚠️ ${unexpectedLevel} mot(s)-clé(s) avec un niveau hors V1–V6`,
      );
    }

    const stats: VLevelGlobalStats = {
      contract: VLEVEL_GLOBAL_STATS_CONTRACT,
      source: { keywords: '__seo_keywords', catalogue: 'pieces_gamme' },
      read: {
        startedAt,
        completedAt: new Date().toISOString(),
        pageSize: VLEVEL_STATS_PAGE_SIZE,
        keywordPages: keywords.pages,
        cataloguePages: catalogue.pages,
      },
      keywords: {
        total,
        byLevel,
        classified,
        unclassified,
        unexpectedLevel,
        unexpectedLevelValues: [...unexpected.entries()]
          .map(([value, count]) => ({ value, count }))
          // Ordre déterministe indépendant de la locale : nombre décroissant, puis code de caractère.
          .sort(
            (a, b) =>
              b.count - a.count ||
              (a.value < b.value ? -1 : a.value > b.value ? 1 : 0),
          )
          .slice(0, 20),
        withoutCatalogueGamme,
      },
      gammes: {
        catalogueTotal: catalogueIds.size,
        withClassification: gammesClassified.size,
        g1Total: g1Ids.size,
        g1WithV2: g1WithV2.size,
      },
      freshness,
      dates: {
        latestCollectedAt:
          latestCollectedMs === null
            ? null
            : new Date(latestCollectedMs).toISOString(),
        latestUpdatedAt:
          latestUpdatedMs === null
            ? null
            : new Date(latestUpdatedMs).toISOString(),
      },
    };

    this.logger.log(
      `✅ Indicateurs V-Level : ${total} mots-clés (${classified} classés), ${catalogueIds.size} gammes catalogue, ${keywords.pages}+${catalogue.pages} pages`,
    );
    return stats;
  }

  /** Date valide et non future, sinon null (comptée « inconnue ou invalide »). */
  private parsePastTimestamp(
    value: string | null | undefined,
    nowMs: number,
  ): number | null {
    if (!value) return null;
    const ms = Date.parse(value);
    if (Number.isNaN(ms) || ms > nowMs) return null;
    return ms;
  }

  /**
   * Lecture exhaustive d'une table : comptage exact, puis pages en keyset
   * (`key > dernière clé`, ordre croissant) jusqu'à une page vide. S'arrêter
   * sur une page vide plutôt que sur une page « courte » évite de prendre une
   * limite de réponse du serveur pour la fin de la table.
   */
  private async readAllPages<T extends Record<string, unknown>>(
    table: string,
    columns: string,
    key: string,
  ): Promise<{ rows: T[]; pages: number }> {
    const { count, error: countError } = await this.supabase
      .from(table)
      .select(key, { count: 'exact', head: true });
    if (countError || typeof count !== 'number') {
      this.logger.error(
        `❌ Comptage ${table} impossible: ${countError?.message ?? 'count absent'}`,
      );
      throw new VLevelStatsReadError(`Comptage ${table} impossible`);
    }

    const rows: T[] = [];
    let lastKey: unknown = undefined;
    let pages = 0;
    for (;;) {
      if (pages >= VLEVEL_STATS_MAX_PAGES) {
        throw new VLevelStatsReadError(
          `${table} dépasse la borne de ${VLEVEL_STATS_MAX_PAGES} pages`,
        );
      }
      let query = this.supabase
        .from(table)
        .select(columns)
        .order(key, { ascending: true })
        .limit(VLEVEL_STATS_PAGE_SIZE);
      if (lastKey !== undefined) query = query.gt(key, lastKey);
      const { data, error } = await query;
      pages++;
      if (error || !Array.isArray(data)) {
        this.logger.error(
          `❌ Lecture ${table} page ${pages} impossible: ${error?.message ?? 'data absent'}`,
        );
        throw new VLevelStatsReadError(`Lecture ${table} interrompue`);
      }
      if (data.length === 0) break;
      const page = data as unknown as T[];
      const nextKey = page[page.length - 1][key];
      if (nextKey === null || nextKey === undefined || nextKey === lastKey) {
        throw new VLevelStatsReadError(`Clé de pagination ${table} invalide`);
      }
      rows.push(...page);
      lastKey = nextKey;
    }

    if (rows.length !== count) {
      this.logger.error(
        `❌ ${table} : ${rows.length} lignes lues pour ${count} comptées (écriture concurrente ou limite)`,
      );
      throw new VLevelStatsReadError(`Lecture ${table} incohérente`);
    }
    return { rows, pages };
  }

  /**
   * 🔄 Refresh les agrégats pour une ou toutes les gammes
   * Appelle la RPC refresh_gamme_aggregates
   */
  async refreshAggregates(pgId?: number): Promise<{
    success: boolean;
    refreshed: number;
    results: Array<{
      pg_id: number;
      products_total: number;
      vehicles_total: number;
      content_words_total: number;
      status: string;
    }>;
  }> {
    try {
      this.logger.log(
        `🔄 refreshAggregates(${pgId ? `pg_id=${pgId}` : 'all gammes'})`,
      );

      // 🛡️ RPC Safety Gate
      const { data, error } = await this.callRpc<any[]>(
        'refresh_gamme_aggregates',
        { p_pg_id: pgId || null },
        { source: 'admin' },
      );

      if (error) {
        this.logger.error('❌ Error calling refresh_gamme_aggregates:', error);
        throw error;
      }

      const results = data || [];
      this.logger.log(`✅ Aggregates refreshed: ${results.length} gammes`);

      return {
        success: true,
        refreshed: results.length,
        results,
      };
    } catch (error) {
      this.logger.error('❌ Error in refreshAggregates():', error);
      throw error;
    }
  }

  /**
   * 📊 Récupère les agrégats pour une gamme
   * Retourne null si pas encore calculés
   * v2: Inclut les 11 badges SEO
   */
  async getGammeAggregates(
    pgId: number,
  ): Promise<GammeAggregatesResult | null> {
    try {
      const { data, error } = await this.supabase
        .from('gamme_aggregates')
        .select('*')
        .eq('ga_pg_id', pgId)
        .single();

      if (error) {
        // Table might not exist yet or no data
        if (error.code === 'PGRST116') {
          return null; // No row found
        }
        this.logger.warn(
          `⚠️ Error fetching aggregates for pg_id=${pgId}:`,
          error,
        );
        return null;
      }

      return {
        products_total: data.products_total || 0,
        vehicles_total: data.vehicles_total || 0,
        content_words_total: data.content_words_total || 0,
        products_direct: data.products_direct || 0,
        products_via_vehicles: data.products_via_vehicles || 0,
        products_via_family: data.products_via_family || 0,
        vlevel_counts: data.vlevel_counts || {
          V1: 0,
          V2: 0,
          V3: 0,
          V4: 0,
          V5: 0,
        },
        seo_content_raw_words: data.seo_content_raw_words || 0,
        content_breakdown: data.content_breakdown || {
          seo: 0,
          conseil: 0,
          switches: 0,
          purchaseGuide: 0,
        },
        computed_at: data.computed_at,
        source_updated_at: data.source_updated_at,
        // Phase 2 Badges
        priority_score: data.priority_score || 0,
        catalog_issues: data.catalog_issues || [],
        smart_actions: data.smart_actions || [],
        // ===== Badges v2 (11 badges) =====
        // Pilotage
        index_policy: data.index_policy || 'NOINDEX',
        final_priority: data.final_priority || 'P3',
        // Potentiel
        potential_level: data.potential_level || 'LOW',
        demand_level: data.demand_level || 'LOW',
        difficulty_level: data.difficulty_level || 'MED',
        intent_type: data.intent_type || 'COMPARE',
        // Réalité Intra-Gamme
        catalog_status: data.catalog_status || 'EMPTY',
        vehicle_coverage: data.vehicle_coverage || 'EMPTY',
        content_depth: data.content_depth || 'THIN',
        freshness_status: data.freshness_status || 'EXPIRED',
        cluster_health: data.cluster_health || 'ISOLATED',
        topic_purity: data.topic_purity || 'PURE',
        // Exécutabilité
        execution_status: data.execution_status || 'FAIL',
      };
    } catch (error) {
      this.logger.error(`❌ Error in getGammeAggregates(${pgId}):`, error);
      return null;
    }
  }
}
