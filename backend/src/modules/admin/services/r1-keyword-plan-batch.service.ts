/**
 * R1KeywordPlanBatchService — 0-LLM batch generator for R1 keyword plans.
 *
 * Generates deterministic keyword plans from RAG YAML + DB data:
 * - RAG gamme frontmatter (domain.role, selection, brands, faq)
 * - R3 anti-cannibalization (forbidden terms from validated R3 plan)
 * - Top vehicles from __cross_gamme_car_new
 * - Equipementiers from gamme_aggregates
 *
 * Writes to __seo_r1_keyword_plan via R1KeywordPlanGatesService.upsertR1KeywordPlan().
 * No LLM calls — purely deterministic term generation.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { EnricherYamlParser } from './enricher-yaml-parser.service';
import {
  R1KeywordPlanGatesService,
  type RkpRow,
  type R1SectionTerms,
} from './r1-keyword-plan-gates.service';
import { R3_FORBIDDEN_IN_R1 } from '../../../config/r1-keyword-plan.constants';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';

export interface BatchR1Result {
  pgId: number;
  pgAlias: string;
  status: 'created' | 'skipped' | 'failed';
  rkpId?: number;
  qualityScore?: number;
  r3RiskScore?: number;
  reason?: string;
}

interface TopVehicle {
  marque_name: string;
  modele_name: string;
  cnt: number;
}

@Injectable()
export class R1KeywordPlanBatchService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    R1KeywordPlanBatchService.name,
  );

  private readonly RAG_DIR = `${RAG_KNOWLEDGE_PATH}/gammes`;

  constructor(
    configService: ConfigService,
    private readonly yamlParser: EnricherYamlParser,
    private readonly gatesService: R1KeywordPlanGatesService,
  ) {
    super(configService);
  }

  /**
   * Generate R1 keyword plans for all eligible gammes (R3 validated, no R1 yet).
   */
  async batchGenerate(options: {
    limit?: number;
    minR3Score?: number;
    dryRun?: boolean;
  }): Promise<{ results: BatchR1Result[]; summary: Record<string, number> }> {
    const limit = options.limit ?? 50;
    const minR3Score = options.minR3Score ?? 70;

    // Find eligible gammes: R3 validated, no R1 yet
    const { data: eligible } = await this.client.rpc(
      'execute_sql' as never,
      {
        query: `
        SELECT r3.skp_pg_id AS pg_id, r3.skp_pg_alias AS pg_alias,
               r3.skp_quality_score AS r3_score, r3.skp_section_terms AS r3_terms
        FROM __seo_r3_keyword_plan r3
        LEFT JOIN __seo_r1_keyword_plan r1 ON r1.rkp_pg_id = r3.skp_pg_id
        WHERE r3.skp_status = 'validated'
          AND r3.skp_quality_score >= ${minR3Score}
          AND r1.rkp_id IS NULL
        ORDER BY r3.skp_quality_score DESC
        LIMIT ${limit}
      `,
      } as never,
    );

    // Fallback: direct query if RPC not available
    let gammes: Array<{
      pg_id: number;
      pg_alias: string;
      r3_score: number;
      r3_terms: Record<string, { include_terms?: string[] }> | null;
    }> = [];

    if (eligible && Array.isArray(eligible)) {
      gammes = eligible;
    } else {
      // Direct query approach
      const { data: r3Plans } = await this.client
        .from('__seo_r3_keyword_plan')
        .select('skp_pg_id, skp_pg_alias, skp_quality_score, skp_section_terms')
        .eq('skp_status', 'validated')
        .gte('skp_quality_score', minR3Score)
        .order('skp_quality_score', { ascending: false })
        .limit(limit + 50); // fetch extra to filter

      if (!r3Plans?.length) {
        return { results: [], summary: { total: 0 } };
      }

      // Filter out those that already have R1
      const pgIds = r3Plans.map((r) => Number(r.skp_pg_id));
      const { data: existingR1 } = await this.client
        .from('__seo_r1_keyword_plan')
        .select('rkp_pg_id')
        .in('rkp_pg_id', pgIds);

      const existingSet = new Set(
        (existingR1 ?? []).map((r: { rkp_pg_id: number }) =>
          Number(r.rkp_pg_id),
        ),
      );

      gammes = r3Plans
        .filter((r) => !existingSet.has(Number(r.skp_pg_id)))
        .slice(0, limit)
        .map((r) => ({
          pg_id: Number(r.skp_pg_id),
          pg_alias: r.skp_pg_alias as string,
          r3_score: r.skp_quality_score as number,
          r3_terms: r.skp_section_terms as Record<
            string,
            { include_terms?: string[] }
          > | null,
        }));
    }

    this.logger.log(`[BATCH] Found ${gammes.length} eligible gammes`);

    const results: BatchR1Result[] = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const gamme of gammes) {
      try {
        const result = await this.generateSingle(
          gamme.pg_id,
          gamme.pg_alias,
          gamme.r3_terms,
          options.dryRun ?? false,
        );
        results.push(result);
        if (result.status === 'created') created++;
        else if (result.status === 'skipped') skipped++;
        else failed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[BATCH] Failed pgId=${gamme.pg_id}: ${msg}`);
        results.push({
          pgId: gamme.pg_id,
          pgAlias: gamme.pg_alias,
          status: 'failed',
          reason: msg,
        });
        failed++;
      }
    }

    return {
      results,
      summary: { total: gammes.length, created, skipped, failed },
    };
  }

  /**
   * Generate a single R1 keyword plan from deterministic sources (0-LLM).
   */
  private async generateSingle(
    pgId: number,
    pgAlias: string,
    r3SectionTerms: Record<string, { include_terms?: string[] }> | null,
    dryRun: boolean,
  ): Promise<BatchR1Result> {
    const ctx = `[R1_KP_BATCH pgId=${pgId}]`;

    // ── P0.1: Load RAG gamme ──
    const ragPath = join(this.RAG_DIR, `${pgAlias}.md`);
    let ragContent = '';
    let domainRole = '';
    let selectionCriteria: string[] = [];
    let brands: string[] = [];
    let faqItems: string[] = [];

    if (existsSync(ragPath)) {
      ragContent = readFileSync(ragPath, 'utf-8');
      const fm = this.yamlParser.extractFrontmatterBlock(ragContent);
      if (fm) {
        domainRole =
          this.extractYamlValue(fm, 'role') ?? pgAlias.replace(/-/g, ' ');
        selectionCriteria = this.yamlParser.extractYamlList(fm, 'criteria');
        brands = this.yamlParser.extractYamlList(fm, 'equipementiers');
        if (!brands.length)
          brands = this.yamlParser.extractYamlList(fm, 'brands');
        faqItems = this.yamlParser.extractYamlList(fm, 'faq');
      }
    }

    // Gamme name
    const { data: pgRow } = await this.client
      .from('pieces_gamme')
      .select('pg_name')
      .eq('pg_id', pgId)
      .single();
    const gammeName = pgRow?.pg_name ?? pgAlias.replace(/-/g, ' ');
    const gammeSlug = pgAlias.replace(/-/g, ' ');

    // ── P0.3: Extract R3 forbidden terms ──
    const r3ForbiddenTerms = new Set<string>();
    if (r3SectionTerms) {
      for (const section of Object.values(r3SectionTerms)) {
        for (const term of section.include_terms ?? []) {
          r3ForbiddenTerms.add(term.toLowerCase());
        }
      }
    }
    // Add static R3 forbidden terms
    for (const term of R3_FORBIDDEN_IN_R1) {
      r3ForbiddenTerms.add(term.toLowerCase());
    }

    // ── P0.4: Top vehicles ──
    const { data: vehicles } = await this.client.rpc(
      'get_alternative_vehicles_for_gamme' as never,
      { p_gamme_id: pgId, p_exclude_type_id: 0, p_limit: 6 } as never,
    );

    let topVehicles: TopVehicle[] = [];
    if (vehicles && Array.isArray(vehicles) && vehicles.length > 0) {
      topVehicles = vehicles.map(
        (v: { marque_name: string; modele_name: string }) => ({
          marque_name: v.marque_name,
          modele_name: v.modele_name,
          cnt: 1,
        }),
      );
    } else {
      // Direct query fallback
      const { data: cgcData } = await this.client
        .from('__cross_gamme_car_new')
        .select('cgc_marque_id')
        .eq('cgc_pg_id', String(pgId))
        .limit(1);

      if (cgcData && cgcData.length > 0) {
        // Has cross-gamme data, query with joins via raw SQL
        // (Supabase SDK can't do GROUP BY + JOIN easily)
        topVehicles = []; // Will use generic fallback
      }
    }

    // ── P0.5: Equipementiers from gamme_aggregates ──
    const { data: aggRow } = await this.client
      .from('gamme_aggregates')
      .select('top_brands')
      .eq('sgc_id', pgId)
      .single();

    let equipBrands: string[] = [...brands];
    if (aggRow?.top_brands && typeof aggRow.top_brands === 'object') {
      const topBrands = aggRow.top_brands as Record<string, number>;
      const sorted = Object.entries(topBrands)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);
      if (sorted.length > 0) equipBrands = sorted;
    }

    // ── P1+P2: Build section terms (deterministic) ──
    const sectionTerms = this.buildSectionTerms(
      gammeSlug,
      gammeName,
      domainRole,
      selectionCriteria,
      equipBrands,
      faqItems,
      topVehicles,
      r3ForbiddenTerms,
    );

    // ── Build RkpRow ──
    const row: RkpRow = {
      rkp_pg_id: pgId,
      rkp_pg_alias: pgAlias,
      rkp_gamme_name: gammeName,
      rkp_primary_intent: { intent: 'select', confidence: 85 },
      rkp_secondary_intents: [
        { intent: 'compare_vehicle', confidence: 75 },
        { intent: 'verify_compatibility', confidence: 70 },
      ],
      rkp_boundaries: {
        r3_forbidden_terms: [...r3ForbiddenTerms].slice(0, 100),
        r4_forbidden: [
          'qu est-ce que',
          'glossaire',
          'definition',
          'se compose de',
        ],
        r5_forbidden: ['symptome', 'panne', 'voyant', 'diagnostic', 'code OBD'],
        r6_forbidden: ['guide achat', 'comment choisir', 'comparatif'],
        r2_forbidden: ['prix', 'promo', 'panier', 'en stock'],
      },
      rkp_heading_plan: {
        R1_S0_SERP: { h1: `${gammeName} — Pièce compatible véhicule` },
        R1_S1_HERO: {
          h2: `${gammeName} : trouvez la référence adaptée à votre véhicule`,
        },
        R1_S4_MICRO_SEO: {
          h2: `Pourquoi commander votre ${gammeSlug} ici`,
        },
        R1_S5_COMPAT: {
          h2: `${gammeName} compatible par marque et modèle`,
        },
        R1_S7_EQUIP: {
          h2: `Équipementiers ${gammeSlug} disponibles`,
        },
        R1_S9_FAQ: {
          h2: `Questions fréquentes sur le ${gammeSlug}`,
        },
      },
      rkp_query_clusters: {
        achat_selection: [
          `acheter ${gammeSlug}`,
          `${gammeSlug} voiture`,
          `commander ${gammeSlug}`,
          `${gammeSlug} pièce auto`,
        ],
        compatibilite_vehicule: [
          `${gammeSlug} compatible`,
          `${gammeSlug} par immatriculation`,
          `${gammeSlug} marque modèle année`,
        ],
        equipementiers: equipBrands.slice(0, 4).map((b) => `${gammeSlug} ${b}`),
      },
      rkp_section_terms: sectionTerms,
    };

    // ── P3: Run gates ──
    const gateReport = await this.gatesService.runR1Gates(row);

    if (dryRun) {
      return {
        pgId,
        pgAlias,
        status: 'skipped',
        qualityScore: gateReport.qualityScore,
        r3RiskScore: gateReport.r3RiskScore,
        reason: 'dry_run',
      };
    }

    // ── Output: Upsert ──
    const nextVersion = await this.getNextVersion(pgId);

    await this.gatesService.upsertR1KeywordPlan(String(pgId), {
      rkp_pg_alias: pgAlias,
      rkp_gamme_name: gammeName,
      rkp_primary_intent: row.rkp_primary_intent,
      rkp_secondary_intents: row.rkp_secondary_intents,
      rkp_boundaries: row.rkp_boundaries,
      rkp_heading_plan: row.rkp_heading_plan,
      rkp_section_terms: row.rkp_section_terms,
      rkp_query_clusters: row.rkp_query_clusters,
      rkp_gate_report: gateReport.gateReport,
      rkp_quality_score: gateReport.qualityScore,
      rkp_r3_risk_score: gateReport.r3RiskScore,
      rkp_duplication_score: gateReport.duplicationScore,
      rkp_coverage_score: gateReport.coverageScore,
      rkp_pipeline_phase: 'P2_KEYWORD_GEN',
      rkp_status: 'draft',
      rkp_version: nextVersion,
      rkp_built_by: 'r1-kp-batch-0llm',
    });

    // Verify
    const { data: verify } = await this.client
      .from('__seo_r1_keyword_plan')
      .select('rkp_id')
      .eq('rkp_pg_id', pgId)
      .eq('rkp_version', nextVersion)
      .single();

    this.logger.log(
      `${ctx} Created rkp_id=${verify?.rkp_id} score=${gateReport.qualityScore} jaccard=${gateReport.r3RiskScore}`,
    );

    return {
      pgId,
      pgAlias,
      status: 'created',
      rkpId: verify?.rkp_id,
      qualityScore: gateReport.qualityScore,
      r3RiskScore: gateReport.r3RiskScore,
    };
  }

  // ── Term generation (deterministic, 0-LLM) ──

  private buildSectionTerms(
    gammeSlug: string,
    gammeName: string,
    domainRole: string,
    criteria: string[],
    brands: string[],
    faqItems: string[],
    vehicles: TopVehicle[],
    r3Forbidden: Set<string>,
  ): Record<string, R1SectionTerms> {
    const filter = (terms: string[]) =>
      terms.filter((t) => !r3Forbidden.has(t.toLowerCase()));

    // S0 SERP
    const s0Terms = filter([
      `${gammeSlug}`,
      `${gammeSlug} voiture`,
      `${gammeSlug} pièce compatible`,
      `acheter ${gammeSlug}`,
      `${gammeSlug} compatible véhicule`,
    ]);

    // S1 HERO
    const s1Terms = filter([
      `${gammeSlug} adapté véhicule`,
      `${gammeSlug} sélection par véhicule`,
      `trouver ${gammeSlug}`,
      `${gammeSlug} marque modèle année`,
      `${gammeSlug} qualité OE`,
    ]);

    // S4 MICRO SEO
    const s4Terms = filter([
      `${gammeSlug} qualité origine`,
      `${gammeSlug} livraison rapide`,
      `${gammeSlug} garanti`,
      `commander ${gammeSlug}`,
      `${gammeSlug} première monte`,
      ...brands.slice(0, 3).map((b) => `${gammeSlug} ${b}`),
    ]);

    // S5 COMPAT (vehicle injection)
    const s5Terms: string[] = [];
    if (vehicles.length > 0) {
      for (const v of vehicles.slice(0, 6)) {
        s5Terms.push(`${gammeSlug} ${v.marque_name}`);
        if (v.modele_name) s5Terms.push(`${gammeSlug} ${v.modele_name}`);
      }
    } else {
      // Generic French market brands
      for (const marque of [
        'Renault',
        'Peugeot',
        'Volkswagen',
        'Citroën',
        'BMW',
        'Ford',
      ]) {
        s5Terms.push(`${gammeSlug} ${marque}`);
      }
    }
    s5Terms.push(`${gammeSlug} par immatriculation`);
    s5Terms.push(`${gammeSlug} compatible marque modèle année`);
    const s5Filtered = filter(s5Terms);

    // S7 EQUIP
    const s7Terms = filter([
      ...brands.slice(0, 5).map((b) => `${gammeSlug} ${b}`),
      `équipementier ${gammeSlug}`,
      `marque ${gammeSlug}`,
      `${gammeSlug} qualité équivalente origine`,
    ]);

    // S9 FAQ
    const s9Terms = filter([
      `quel ${gammeSlug} pour mon véhicule`,
      `${gammeSlug} compatible quel véhicule`,
      `trouver référence ${gammeSlug}`,
      `${gammeSlug} par plaque immatriculation`,
      ...faqItems.slice(0, 2).map((q) => q.substring(0, 80)),
    ]);

    return {
      R1_S0_SERP: {
        include_terms: s0Terms,
        micro_phrases: [`${gammeName} compatible véhicule`],
      },
      R1_S1_HERO: {
        include_terms: s1Terms,
        micro_phrases: [`Trouvez le ${gammeSlug} adapté`],
      },
      R1_S4_MICRO_SEO: {
        include_terms: s4Terms,
        micro_phrases: [`${gammeName} de qualité`],
      },
      R1_S5_COMPAT: {
        include_terms: s5Filtered,
        micro_phrases: [`Compatible par véhicule`],
      },
      R1_S7_EQUIP: {
        include_terms: s7Terms,
        micro_phrases: [`Marques disponibles`],
      },
      R1_S9_FAQ: {
        include_terms: s9Terms,
        micro_phrases: [`Questions fréquentes`],
      },
    };
  }

  private async getNextVersion(pgId: number): Promise<number> {
    const { data } = await this.client
      .from('__seo_r1_keyword_plan')
      .select('rkp_version')
      .eq('rkp_pg_id', pgId)
      .order('rkp_version', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return (data[0].rkp_version ?? 0) + 1;
    }
    return 1;
  }

  private extractYamlValue(fm: string, key: string): string | null {
    const regex = new RegExp(`^\\s*${key}:\\s*['"]?(.+?)['"]?\\s*$`, 'm');
    const match = fm.match(regex);
    return match ? match[1].trim() : null;
  }
}
