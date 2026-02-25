/**
 * 🔍 GAMME DETAIL ENRICHER SERVICE
 *
 * Extracted from AdminGammesSeoService to reduce file size.
 * Handles the getGammeDetail() logic:
 * - Fetches gamme base data, SEO, conseils, switches, articles
 * - Enriches vehicles with marque/modele/type names
 * - Groups V-Level data
 * - Aggregates stats with badges v2
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  DomainNotFoundException,
  ErrorCodes,
} from '../../../common/exceptions';
import {
  GammeSeoBadgesService,
  GammeAggregatesResult,
} from './gamme-seo-badges.service';
import { GammeVLevelService } from './gamme-vlevel.service';
import type { EnrichedVehicle } from './admin-gammes-seo.service';

interface VLevelItem {
  id: number;
  gamme_name: string;
  model_name: string;
  brand: string;
  variant_name: string;
  energy: string;
  v_level: string;
  rank: number;
  search_volume: number;
  updated_at: string | null;
  type_id: number | null;
}

// Return type for getGammeDetail
export interface GammeDetailResult {
  gamme: Record<string, unknown>;
  seo: Record<string, unknown>;
  conseils: Record<string, unknown>[];
  switchGroups: Array<{
    alias: string;
    count: number;
    sample: string;
    variations: Array<{ sis_id: number; content: string }>;
  }>;
  familySwitchGroups: Array<{
    alias: string;
    count: number;
    sample: string;
    variations: Array<{ id: number; content: string }>;
  }>;
  articles: Record<string, unknown>[];
  vehicles: {
    level1: EnrichedVehicle[];
    level2: EnrichedVehicle[];
    level5: EnrichedVehicle[];
  };
  vLevel: {
    v1: VLevelItem[];
    v2: VLevelItem[];
    v3: VLevelItem[];
    v4: VLevelItem[];
    v5: VLevelItem[];
  };
  stats: Record<string, unknown>;
}

@Injectable()
export class GammeDetailEnricherService extends SupabaseBaseService {
  protected readonly logger = new Logger(GammeDetailEnricherService.name);

  constructor(
    private readonly badgesService: GammeSeoBadgesService,
    private readonly vLevelService: GammeVLevelService,
  ) {
    super();
  }

  /**
   * 📋 Détail complet d'une gamme pour l'admin
   * Fetches and enriches gamme data with vehicles, V-levels, articles, aggregates
   */
  async getGammeDetail(pgId: number): Promise<GammeDetailResult> {
    try {
      this.logger.log(`📋 getGammeDetail(${pgId}) - OPTIMIZED`);
      const pgIdStr = pgId.toString();

      // Parallelize all independent queries
      const [
        gammeResult,
        seoResult,
        conseilsResult,
        rawSwitchesResult,
        rawFamilySwitchesResult,
        articlesResult,
        rawVehiclesResult,
        vLevelResult,
        productsCountResult,
        aggregates,
      ] = await Promise.all([
        // 1. Gamme de base
        this.supabase
          .from('pieces_gamme')
          .select(
            'pg_id, pg_name, pg_alias, pg_level, pg_top, pg_relfollow, pg_sitemap, pg_display, pg_img',
          )
          .eq('pg_id', pgIdStr)
          .single(),
        // 2. SEO
        this.supabase
          .from('__seo_gamme')
          .select('sg_id, sg_title, sg_descrip, sg_keywords, sg_h1, sg_content')
          .eq('sg_pg_id', pgIdStr)
          .single(),
        // 3. Conseils
        this.supabase
          .from('__seo_gamme_conseil')
          .select('sgc_id, sgc_title, sgc_content')
          .eq('sgc_pg_id', pgIdStr)
          .order('sgc_id', { ascending: true }),
        // 4. Item Switches
        this.supabase
          .from('__seo_item_switch')
          .select('sis_id, sis_alias, sis_content')
          .eq('sis_pg_id', pgIdStr)
          .order('sis_alias', { ascending: true }),
        // 5. Family Switches
        this.supabase
          .from('__seo_family_gamme_car_switch')
          .select('sfgcs_id, sfgcs_alias, sfgcs_content')
          .eq('sfgcs_pg_id', pgIdStr)
          .order('sfgcs_alias', { ascending: true }),
        // 6. Articles
        this.supabase
          .from('__blog_advice')
          .select(
            'ba_id, ba_title, ba_alias, ba_preview, ba_visit, ba_create, ba_update',
          )
          .eq('ba_pg_id', pgIdStr)
          .order('ba_create', { ascending: false })
          .limit(20),
        // 7. Vehicules
        this.supabase
          .from('__cross_gamme_car')
          .select(
            'cgc_id, cgc_marque_id, cgc_modele_id, cgc_type_id, cgc_level',
          )
          .eq('cgc_pg_id', pgIdStr)
          .limit(500),
        // 8. V-Level (V2/V3/V4 from DB — V5 computed dynamically)
        this.supabase
          .from('__seo_keywords')
          .select(
            'id, keyword, model, energy, v_level, volume, updated_at, type_id',
          )
          .eq('pg_id', pgId)
          .in('v_level', ['V1', 'V2', 'V3', 'V4'])
          .order('v_level', { ascending: true })
          .order('volume', { ascending: false, nullsFirst: false }),
        // 9. Products count
        this.supabase
          .from('pieces')
          .select('*', { count: 'exact', head: true })
          .eq('pg_id', pgIdStr),
        // 10. Agregats (delegated to GammeSeoBadgesService)
        this.badgesService.getGammeAggregates(pgId),
      ]);

      // Extract data
      const { data: gamme, error: gammeError } = gammeResult;
      const { data: seo } = seoResult;
      const { data: conseils } = conseilsResult;
      const { data: rawSwitches } = rawSwitchesResult;
      const { data: rawFamilySwitches } = rawFamilySwitchesResult;
      const { data: articles } = articlesResult;
      const { data: rawVehicles } = rawVehiclesResult;
      const { data: rawVLevelData } = vLevelResult;
      const { count: productsCount } = productsCountResult;

      if (gammeError || !gamme) {
        throw new DomainNotFoundException({
          code: ErrorCodes.CATALOG.GAMME_NOT_FOUND,
          message: `Gamme ${pgId} non trouvee`,
        });
      }

      // Map __seo_keywords rows to VLevelItem format expected by frontend
      const vLevelData: VLevelItem[] = (rawVLevelData || []).map(
        (kw: Record<string, unknown>) => ({
          id: (kw.id as number) || 0,
          gamme_name: gamme.pg_name || '',
          model_name: (kw.model as string) || '',
          brand: '',
          variant_name: (kw.keyword as string) || '',
          energy: (kw.energy as string) || 'unknown',
          v_level: (kw.v_level as string) || 'V4',
          rank: 0,
          search_volume: (kw.volume as number) || 0,
          updated_at: (kw.updated_at as string | null) ?? null,
          type_id: (kw.type_id as number | null) ?? null,
        }),
      );

      // Compute V5 dynamically from auto_modele hierarchy (no DB persist)
      const v5Items = await this.vLevelService.getV5Siblings(pgId);

      // Group Item Switches by alias - ALL variations
      const switchGroups = this.groupItemSwitches(rawSwitches || []);

      // Group Family Switches by alias - ALL variations
      const familySwitchGroups = this.groupFamilySwitches(
        rawFamilySwitches || [],
      );

      // Group by V-Level (V5 from dynamic computation)
      const vLevelGrouped = {
        v1: (vLevelData || []).filter((v: VLevelItem) => v.v_level === 'V1'),
        v2: (vLevelData || []).filter((v: VLevelItem) => v.v_level === 'V2'),
        v3: (vLevelData || []).filter((v: VLevelItem) => v.v_level === 'V3'),
        v4: (vLevelData || []).filter((v: VLevelItem) => v.v_level === 'V4'),
        v5: v5Items,
      };

      // Merge V5 into vLevelData for stats computation
      const allVLevelData = [...vLevelData, ...v5Items];

      // Enrich vehicles with marque/modele/type names
      const allVehicles = await this.enrichVehicles(rawVehicles || []);

      // Separate by level
      const vehiclesLevel1 = allVehicles.filter((v) => v.level === '1');
      const vehiclesLevel2 = allVehicles.filter((v) => v.level === '2');
      const vehiclesLevel5 = allVehicles.filter((v) => v.level === '5');

      return {
        gamme,
        seo: seo || {
          sg_id: null,
          sg_title: '',
          sg_descrip: '',
          sg_keywords: '',
          sg_h1: '',
          sg_content: '',
        },
        conseils: conseils || [],
        switchGroups,
        familySwitchGroups,
        // Articles enriched with sections_count (default 0)
        articles: (articles || []).map((a) => ({
          ...a,
          sections_count: 0, // TODO: Count sections if a table exists
        })),
        vehicles: {
          level1: vehiclesLevel1,
          level2: vehiclesLevel2,
          level5: vehiclesLevel5,
        },
        vLevel: vLevelGrouped,
        stats: this.buildStats(
          aggregates,
          productsCount,
          allVehicles,
          vLevelGrouped,
          allVLevelData,
          articles,
          vehiclesLevel1,
          vehiclesLevel2,
          vehiclesLevel5,
        ),
      };
    } catch (error) {
      this.logger.error(`❌ Error in getGammeDetail(${pgId}):`, error);
      throw error;
    }
  }

  /**
   * Group item switches by alias
   */
  private groupItemSwitches(
    rawSwitches: Array<{
      sis_id: number;
      sis_alias: string;
      sis_content: string;
    }>,
  ) {
    return Object.entries(
      rawSwitches.reduce(
        (acc, sw) => {
          const alias = String(sw.sis_alias);
          if (!acc[alias]) {
            acc[alias] = [];
          }
          acc[alias].push({
            sis_id: sw.sis_id,
            content: sw.sis_content || '',
          });
          return acc;
        },
        {} as Record<string, Array<{ sis_id: number; content: string }>>,
      ),
    ).map(([alias, variations]) => ({
      alias,
      count: variations.length,
      variations,
      sample:
        variations[0]?.content.substring(0, 50) +
        (variations[0]?.content.length > 50 ? '...' : ''),
    }));
  }

  /**
   * Group family switches by alias
   */
  private groupFamilySwitches(
    rawFamilySwitches: Array<{
      sfgcs_id: number;
      sfgcs_alias: string;
      sfgcs_content: string;
    }>,
  ) {
    return Object.entries(
      rawFamilySwitches.reduce(
        (acc, sw) => {
          const alias = String(sw.sfgcs_alias);
          if (!acc[alias]) {
            acc[alias] = [];
          }
          acc[alias].push({
            id: sw.sfgcs_id,
            content: sw.sfgcs_content || '',
          });
          return acc;
        },
        {} as Record<string, Array<{ id: number; content: string }>>,
      ),
    ).map(([alias, variations]) => ({
      alias,
      count: variations.length,
      variations,
      sample:
        variations[0]?.content.substring(0, 50) +
        (variations[0]?.content.length > 50 ? '...' : ''),
    }));
  }

  /**
   * Enrich vehicles with marque/modele/type names
   */
  private async enrichVehicles(
    rawVehicles: Array<{
      cgc_id: string;
      cgc_marque_id: string;
      cgc_modele_id: string;
      cgc_type_id: string;
      cgc_level: string;
    }>,
  ): Promise<EnrichedVehicle[]> {
    if (!rawVehicles || rawVehicles.length === 0) {
      return [];
    }

    // Collect unique type IDs
    const typeIds = [
      ...new Set(rawVehicles.map((v) => v.cgc_type_id).filter(Boolean)),
    ];

    // Simple query without joins (FK not defined in Supabase)
    const { data: typesData } =
      typeIds.length > 0
        ? await this.supabase
            .from('auto_type')
            .select(
              'type_id, type_name, type_engine, type_fuel, type_marque_id, type_modele_id, type_year_from, type_year_to, type_power_ps',
            )
            .in('type_id', typeIds)
        : { data: [] };

    // Map with STRING KEYS - IMPORTANT: type_marque_id is STRING ("140"), marque_id is NUMBER (140)
    const typeMap = new Map(
      (typesData || []).map((t) => [
        String(t.type_id),
        {
          name: t.type_name || '',
          engine: t.type_engine || '',
          fuel: t.type_fuel || '',
          marque_id: String(t.type_marque_id || ''),
          modele_id: String(t.type_modele_id || ''),
          year_from: t.type_year_from || '',
          year_to: t.type_year_to || '',
          power_ps: t.type_power_ps || '',
        },
      ]),
    );

    // Collect marque/modele IDs (strings in auto_type)
    const allMarqueIds = new Set<string>();
    const allModeleIds = new Set<string>();
    for (const t of typesData || []) {
      if (t.type_marque_id) allMarqueIds.add(String(t.type_marque_id));
      if (t.type_modele_id) allModeleIds.add(String(t.type_modele_id));
    }

    // Separate lookups for marque and modele
    const [marques, modeles] = await Promise.all([
      allMarqueIds.size > 0
        ? this.supabase
            .from('auto_marque')
            .select('marque_id, marque_name')
            .in('marque_id', [...allMarqueIds])
        : { data: [] },
      allModeleIds.size > 0
        ? this.supabase
            .from('auto_modele')
            .select('modele_id, modele_name')
            .in('modele_id', [...allModeleIds])
        : { data: [] },
    ]);

    // Maps with STRING KEYS - conversion since marque_id/modele_id are NUMBER in response
    const marqueMap = new Map(
      (marques.data || []).map((m) => [String(m.marque_id), m.marque_name]),
    );
    const modeleMap = new Map(
      (modeles.data || []).map((m) => [String(m.modele_id), m.modele_name]),
    );

    // Enrich vehicles
    return rawVehicles.map((v) => {
      const typeInfo = typeMap.get(String(v.cgc_type_id));
      return {
        cgc_id: v.cgc_id,
        type_id: v.cgc_type_id || '',
        type_name: typeInfo?.name || '',
        marque_name: marqueMap.get(typeInfo?.marque_id || '') || '',
        modele_name: modeleMap.get(typeInfo?.modele_id || '') || '',
        engine: typeInfo?.engine || '',
        fuel: typeInfo?.fuel || '',
        level: v.cgc_level || '1',
        year_from: typeInfo?.year_from || '',
        year_to: typeInfo?.year_to || '',
        power_ps: typeInfo?.power_ps || '',
      };
    });
  }

  /**
   * Build the stats object for gamme detail response
   */
  private buildStats(
    aggregates: GammeAggregatesResult | null,
    productsCount: number | null,
    allVehicles: EnrichedVehicle[],
    vLevelGrouped: {
      v1: VLevelItem[];
      v2: VLevelItem[];
      v3: VLevelItem[];
      v4: VLevelItem[];
      v5: VLevelItem[];
    },
    vLevelData: VLevelItem[] | null,
    articles: Record<string, unknown>[] | null,
    vehiclesLevel1: EnrichedVehicle[],
    vehiclesLevel2: EnrichedVehicle[],
    vehiclesLevel5: EnrichedVehicle[],
  ): Record<string, unknown> {
    return {
      // Values from aggregates (what the front sees)
      products_count: aggregates?.products_total ?? productsCount ?? 0,
      vehicles_count: aggregates?.vehicles_total ?? allVehicles.length,
      content_words: aggregates?.content_words_total ?? 0,
      vlevel_counts: aggregates?.vlevel_counts ?? {
        V1: vLevelGrouped.v1.length,
        V2: vLevelGrouped.v2.length,
        V3: vLevelGrouped.v3.length,
        V4: vLevelGrouped.v4.length,
        V5: vLevelGrouped.v5.length,
      },

      // Phase 2 badges
      priority_score: aggregates?.priority_score ?? 0,
      catalog_issues: aggregates?.catalog_issues ?? [],
      smart_actions: aggregates?.smart_actions ?? [],

      // ===== Badges v2 (11 badges) =====
      // Pilotage
      index_policy: aggregates?.index_policy ?? 'NOINDEX',
      final_priority: aggregates?.final_priority ?? 'P3',
      // Potentiel
      potential_level: aggregates?.potential_level ?? 'LOW',
      demand_level: aggregates?.demand_level ?? 'LOW',
      difficulty_level: aggregates?.difficulty_level ?? 'MED',
      intent_type: aggregates?.intent_type ?? 'COMPARE',
      // Realite Intra-Gamme
      catalog_status: aggregates?.catalog_status ?? 'EMPTY',
      vehicle_coverage: aggregates?.vehicle_coverage ?? 'EMPTY',
      content_depth: aggregates?.content_depth ?? 'THIN',
      freshness_status: aggregates?.freshness_status ?? 'EXPIRED',
      cluster_health: aggregates?.cluster_health ?? 'ISOLATED',
      topic_purity: aggregates?.topic_purity ?? 'PURE',
      // Executabilite
      execution_status: aggregates?.execution_status ?? 'FAIL',

      // Existing fields (backward compatibility)
      articles_count: (articles || []).length,
      vehicles_level1_count: vehiclesLevel1.length,
      vehicles_level2_count: vehiclesLevel2.length,
      vehicles_level5_count: vehiclesLevel5.length,
      vehicles_total_count: allVehicles.length,
      // V-Level stats (existing)
      vLevel_v1_count: vLevelGrouped.v1.length,
      vLevel_v2_count: vLevelGrouped.v2.length,
      vLevel_v3_count: vLevelGrouped.v3.length,
      vLevel_v4_count: vLevelGrouped.v4.length,
      vLevel_v5_count: vLevelGrouped.v5.length,
      vLevel_total_count: (vLevelData || []).length,
      // Last V-Level update date (most recent)
      vLevel_last_updated:
        vLevelData && vLevelData.length > 0
          ? (vLevelData as Array<{ updated_at?: string | null }>).reduce(
              (latest: string | null, v) => {
                if (!v.updated_at) return latest;
                if (!latest) return v.updated_at;
                return new Date(v.updated_at) > new Date(latest)
                  ? v.updated_at
                  : latest;
              },
              null,
            )
          : null,
      // Last article date (most recent first)
      last_article_date:
        articles && articles.length > 0
          ? articles[0].ba_update || articles[0].ba_create
          : null,

      // DEBUG: Raw values for diagnostics
      _debug: aggregates
        ? {
            products_direct: aggregates.products_direct,
            products_via_vehicles: aggregates.products_via_vehicles,
            products_via_family: aggregates.products_via_family,
            seo_content_raw_words: aggregates.seo_content_raw_words,
            content_breakdown: aggregates.content_breakdown,
            aggregates_computed_at: aggregates.computed_at,
            source_updated_at: aggregates.source_updated_at,
          }
        : {
            products_direct: productsCount || 0,
            products_via_vehicles: 0,
            products_via_family: 0,
            seo_content_raw_words: 0,
            content_breakdown: null,
            aggregates_computed_at: null,
            source_updated_at: null,
            _note:
              'Agregats non encore calcules - executer refresh_gamme_aggregates',
          },
    };
  }
}
