import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { ContentWriteGateService } from '../../../config/content-write-gate.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { RoleId } from '../../../config/role-ids';
import type { ResourceGroup } from '../../../config/execution-registry.types';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { DatabaseException, ErrorCodes } from '@common/exceptions';
import { SupabaseRpcError } from '../../../security/rpc-gate/rpc-gate.errors';
import { EnricherTextUtils } from './enricher-text-utils.service';
import {
  R8_TABLES,
  R8_HARD_GATES,
  R8_DIVERSITY_FORMULA_WEIGHTS,
  R8_DIVERSITY_THRESHOLDS,
  R8_SITEMAP_RULES,
  buildNeighborFamilyKey,
  buildEngineFamilyKey,
  buildR8H1,
  type R8SeoDecision,
  type R8ReasonCode,
} from '../../../config/r8-keyword-plan.constants';
import {
  selectVariation,
  SEO_R8_INTRO_VARIATIONS,
  SEO_R8_VARIANT_HIGHLIGHT_VARIATIONS,
  SEO_R8_CATALOG_ACCESS_VARIATIONS,
  SEO_R8_FAQ_OPENING_VARIATIONS,
  SEO_R8_TRUST_SIGNAL_VARIATIONS,
  R8_SLOT_OFFSETS,
} from '../../../config/seo-variations.config';
import {
  SeoRoleTemplateSelector,
  type SeoRoleTemplatePickResult,
} from '../../seo/services/chain/seo-role-template-selector.service';
import type { R8VariantSignature } from '../../../config/page-contract-r8.schema';
import {
  R8_OWNED_EDITORIAL_MIN_QUALITY,
  pickAnchorGamme,
  buildOwnedSelectionGuide,
  buildOwnedEntretien,
  buildOwnedFaq,
  extractGammeSourceFromRpc,
  type GammeEditorial,
  type MotorisationFacts,
} from './r8-owned-editorial.composer';

// ── Result ──

export interface R8EnrichResult {
  /**
   * `write_gate_blocked` : contenu calculé mais écriture refusée par le
   * WriteGate (`written=false`). Un refus de garde n'est pas une erreur :
   * la page reste telle quelle et aucune version n'est enregistrée.
   */
  status: 'draft' | 'failed' | 'skipped' | 'write_gate_blocked';
  seoDecision: R8SeoDecision;
  diversityScore: number;
  warnings: string[];
  reasons: R8ReasonCode[];
  pageKey: string;
  /**
   * Motif d'un résultat non abouti (`failed` ou `write_gate_blocked`), préfixé
   * par son code (`DB_ERROR: …`, `WRITE_GATE_BLOCKED: …`, `CONTENT_BROKEN: …`).
   * C'est le champ `data.reason` que `ExecutionRouterService` recopie dans
   * `__pipeline_chain_queue.pcq_error` : sans lui, le rapport d'exécution ne
   * distingue pas une panne DB d'un refus de garde. Absent sur `draft`.
   */
  reason?: string;
  /** Détail du refus — présent uniquement avec `status: 'write_gate_blocked'`. */
  writeGate?: {
    reason: string;
    fieldsSkipped: string[];
    fieldsStripped: string[];
  };
}

// ── Block ──

interface R8Block {
  id: string;
  type: string;
  title: string;
  renderedText: string;
  specificityWeight: number;
  boilerplateRisk: number;
  semanticPayload: string[];
}

// ── Neighbor ──

interface R8Neighbor {
  id: string;
  page_key: string;
  content_main: string;
  faq_signature: string;
  category_signature: string;
  diversity_score: number;
  /**
   * PR-1 seo-v9 R8 meta variant pool : map slot → srtp_id (uuid).
   * Optionnel — pages historiques antérieures à PR-1 ont `{}` ou `null`.
   * H1 non poolisé : `buildR8H1` reste source unique.
   */
  variant_signature?: {
    meta_title?: string | null;
    meta_description?: string | null;
  } | null;
}

// ── Page write outcome ──

/**
 * Issue de l'écriture de `__seo_r8_pages`. Seul `written` autorise les
 * écritures dépendantes (version, fingerprints, similarité, files).
 * `gate_refused` = refus du WriteGate (pas une erreur) ; `db_error` = panne DB.
 */
type R8PageWriteOutcome =
  | { kind: 'written'; pageId: string }
  | {
      kind: 'gate_refused';
      pageId: string;
      reason: string;
      fieldsSkipped: string[];
      fieldsStripped: string[];
    }
  | { kind: 'db_error'; operation: string; code?: string; message: string };

@Injectable()
export class R8VehicleEnricherService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    R8VehicleEnricherService.name,
  );
  private readonly RAG_GAMMES_DIR = `${RAG_KNOWLEDGE_PATH}/gammes`;

  constructor(
    configService: ConfigService,
    private readonly textUtils: EnricherTextUtils,
    private readonly seoRoleTemplate: SeoRoleTemplateSelector,
    @Optional() private readonly writeGate?: ContentWriteGateService,
    @Optional() private readonly featureFlags?: FeatureFlagsService,
  ) {
    super(configService);
  }

  /**
   * Fetch vehicle data via RPC (no VehicleRpcService dependency — direct call).
   */
  private async fetchVehicleData(
    typeId: number,
  ): Promise<Record<string, any> | null> {
    // ADR-016: route via cache-first RPC (O(1) lookup sur __vehicle_page_cache)
    const { data, error } = await this.callRpc<Record<string, any>>(
      'get_vehicle_page_data_cached',
      { p_type_id: typeId },
      { source: 'api' },
    );
    // Panne DB de la RPC ≠ véhicule introuvable : explicite, jamais un `null`.
    // (RpcBlockedError = refus de politique, pas une panne DB → chemin inchangé.)
    if (error instanceof SupabaseRpcError) {
      this.logger.error(
        `[R8_DB_ERROR] op=fetch_vehicle_data type_id=${typeId} code=${error.code ?? 'unknown'} message=${error.message}`,
      );
      throw new DatabaseException({
        code: ErrorCodes.DATABASE.RPC_FAILED,
        message: `R8 fetchVehicleData failed (code=${error.code ?? 'unknown'}): ${error.message}`,
        context: {
          operation: 'fetch_vehicle_data',
          pgCode: error.code,
          typeId,
        },
      });
    }
    if (error || !data?.vehicle) return null;

    // Normalize French RPC field names → English field names expected by composeBlocks
    const v = data.vehicle;
    data.vehicle = {
      ...v,
      brand_name: v.brand_name || v.marque_name || '',
      brand_alias: v.brand_alias || v.marque_alias || '',
      model_name: v.model_name || v.modele_name || '',
      model_alias: v.model_alias || v.modele_alias || '',
      model_id: v.model_id || v.modele_id || null,
      fuel: v.fuel || v.type_fuel || '',
      body: v.body || v.modele_body || v.type_body || '',
      power_ps: v.power_ps || v.type_power_ps || '',
      power_kw: v.power_kw || v.type_power_kw || '',
      year_from: v.year_from || v.type_year_from || '',
      year_to: v.year_to || v.type_year_to || '',
      liter: v.liter || v.type_liter || '',
      type_name: v.type_name || '',
    };

    return data;
  }

  /**
   * Enrich a single R8 vehicle page using RAG knowledge.
   * 0 LLM — pure data fetch + templates + scoring + DB writes.
   */
  async enrichSingle(typeId: number): Promise<R8EnrichResult> {
    const startTime = performance.now();
    const pageKey = `r8_vehicle_${typeId}`;

    try {
      // ── 1. FETCH DATA ──
      const vehicleData = await this.fetchVehicleData(typeId);
      if (!vehicleData?.vehicle) {
        return {
          status: 'failed',
          seoDecision: 'REJECT',
          diversityScore: 0,
          warnings: ['vehicle not found'],
          reasons: ['CONTENT_BROKEN'],
          reason: 'CONTENT_BROKEN: vehicle not found',
          pageKey,
        };
      }

      const v = vehicleData.vehicle;
      const families: Array<{
        pg_id: number;
        pg_alias: string;
        pg_name: string;
        family_name: string;
        product_count: number;
      }> = vehicleData.compatible_families || vehicleData.families || [];
      const bestsellers: Array<{
        piece_id: number;
        piece_name: string;
        price: number;
      }> = vehicleData.bestsellers || [];

      // RAG: top 5 gammes
      const topGammes = families.slice(0, 5);
      const gammeRags = topGammes.map((g) => this.loadGammeRag(g.pg_alias));

      // Fix B (flag R8_OWNED_EDITORIAL_ENABLED) — owned, quality-gated gamme
      // editorial from the OWNED DB tables. OFF (default) → [] → existing path.
      const useOwnedEditorial =
        this.featureFlags?.r8OwnedEditorialEnabled ?? false;
      // The cache RPC exposes compatible gammes under popular_parts /
      // catalog.families[].gammes (NOT compatible_families), so legacy
      // `families` is often empty. When so, source owned-editorial gammes from
      // the RPC. Flag-gated only — never touches the legacy families/catalog block.
      const ownedGammeSource =
        useOwnedEditorial && topGammes.length === 0
          ? extractGammeSourceFromRpc(vehicleData)
          : topGammes;
      const gammeEditorials: GammeEditorial[] = useOwnedEditorial
        ? (
            await Promise.all(
              ownedGammeSource
                .slice(0, 5)
                .map((g) => this.loadGammeEditorial(g)),
            )
          ).filter((e): e is GammeEditorial => e !== null)
        : [];

      // Neighbors from DB
      const neighborFamilyKey = buildNeighborFamilyKey({
        brand: v.brand_name || '',
        model: v.model_name || '',
        fuel: v.fuel || '',
        body: v.body || '',
      });
      const neighbors = await this.fetchNeighbors(neighborFamilyKey, pageKey);

      // ── 2. COMPOSE BLOCKS ──
      const blocks = this.composeBlocks(
        v,
        families,
        bestsellers,
        gammeRags,
        neighbors,
        useOwnedEditorial,
        gammeEditorials,
        pageKey,
      );

      // H1 : reste produit par buildR8H1 (format optimisé avec plage d'années,
      // déjà désambiguïsant). NON poolisé en PR-1 — pas de signal GSC démontré
      // sur H1 spécifiquement.
      const h1 = buildR8H1({
        brand: v.brand_name || '',
        model: v.model_name || '',
        type: v.type_name || '',
        powerPs: v.power_ps || '',
        yearFrom: v.year_from || '',
        yearTo: v.year_to || null,
      });

      // Meta title + description : PR-1 seo-v9 R8 meta variant pool.
      // Sélection via __seo_role_template_pool + SeoSwitchSelector (sha256 seed).
      // Fallback synchrone vers les templates hardcodés si le pool est vide
      // ou en erreur DB → no-regression (warning émis pour détection seed ratée).
      const placeholders = {
        brand: v.brand_name || '',
        model: v.model_name || '',
        type: v.type_name || '',
        power: v.power_ps ?? '',
        fuel: v.fuel || '',
        year_from: v.year_from ?? '',
        year_to: v.year_to ?? '',
      };
      const seedFor = (): { vehicleId: number; pgId: number } => ({
        vehicleId: typeId,
        pgId: 0,
      });
      const [
        metaTitlePick,
        metaDescPick,
      ]: Array<SeoRoleTemplatePickResult | null> = await Promise.all([
        this.seoRoleTemplate.pick({
          role: 'R8_VEHICLE',
          slot: 'meta_title',
          seed: seedFor(),
          placeholders,
        }),
        this.seoRoleTemplate.pick({
          role: 'R8_VEHICLE',
          slot: 'meta_description',
          seed: seedFor(),
          placeholders,
        }),
      ]);

      const metaTitle =
        metaTitlePick?.rendered ??
        `Pièces ${v.brand_name} ${v.model_name} ${v.type_name} ${v.power_ps}ch | AutoMecanik`.slice(
          0,
          75,
        );
      const metaDescription =
        metaDescPick?.rendered ??
        `Catalogue complet de pièces auto pour ${h1}. ${families.length} familles de pièces compatibles. Livraison rapide.`.slice(
          0,
          170,
        );

      // Warning structuré si fallback déclenché — détecte une seed migration ratée silencieuse
      if (!metaTitlePick || !metaDescPick) {
        const missing = [
          !metaTitlePick ? 'meta_title' : null,
          !metaDescPick ? 'meta_description' : null,
        ]
          .filter(Boolean)
          .join(',');
        this.logger.warn(
          `[R8_META_POOL_FALLBACK] type_id=${typeId} missing_pool_slots=${missing}`,
        );
      }

      const variantSignature: R8VariantSignature = {
        meta_title: metaTitlePick?.id ?? null,
        meta_description: metaDescPick?.id ?? null,
      };

      const canonicalUrl = `/constructeurs/${(v.brand_alias || v.brand_name || '').toLowerCase()}/${(v.model_alias || v.model_name || '').toLowerCase()}/${typeId}.html`;

      // Full content
      const contentMain = blocks
        .map((b) => `## ${b.title}\n\n${b.renderedText}`)
        .join('\n\n---\n\n');

      // ── 3. SCORE ──
      const metrics = this.computeMetrics(blocks, neighbors, families);
      const fingerprints = this.computeFingerprints(contentMain, blocks);

      // ── 3.b META COLLISION (PR-1 seo-v9 R8 meta variant pool) ──
      // Pénalise semanticSimilarityScore si ≥2 voisins partagent le même
      // template `meta_title` ou `meta_description`. La pénalité (≤ -10) peut
      // basculer le score sous le seuil `min_semantic_diversity=65` du gate
      // → `LOW_SEMANTIC_DIVERSITY` reason naturellement émis. Pas de
      // pénalité H1 (5 templates × 18 frères → ⌈18/5⌉=4 collisions
      // mathématiquement inévitables, faux positifs garantis).
      const metaCollisionWarnings = this.applyMetaCollisionPenalty(
        metrics,
        neighbors,
        variantSignature,
      );

      // ── 4. GATE ──
      const { decision, reasons, warnings } = this.gate(metrics, blocks);
      // Merge des warnings collision avec ceux du gate
      warnings.push(...metaCollisionWarnings);
      const sitemapRules = R8_SITEMAP_RULES[decision];

      // ── 5. WRITE DB ──
      const engineFamilyKey = buildEngineFamilyKey({
        brand: v.brand_name || '',
        model: v.model_name || '',
        fuel: v.fuel || '',
        typeName: v.type_name || '',
      });

      const blockPlan = blocks.map((b) => ({
        id: b.id,
        type: b.type,
        title: b.title,
        specificityWeight: b.specificityWeight,
        boilerplateRisk: b.boilerplateRisk,
      }));

      // rendered_json stores full blocks with renderedText for frontend rendering
      const renderedBlocks = blocks.map((b) => ({
        id: b.id,
        type: b.type,
        title: b.title,
        renderedText: b.renderedText || '',
        specificityWeight: b.specificityWeight,
        boilerplateRisk: b.boilerplateRisk,
      }));

      // 5a. UPSERT __seo_r8_pages
      const write = await this.upsertPage({
        pageKey,
        vehicle: v,
        typeId: String(typeId),
        h1,
        metaTitle,
        metaDescription,
        canonicalUrl,
        contentMain,
        blockPlan,
        renderedBlocks,
        blocks,
        metrics,
        fingerprints,
        neighborFamilyKey,
        engineFamilyKey,
        decision,
        sitemapRules,
        variantSignature,
      });

      if (write.kind === 'db_error') {
        const detail = `op=${write.operation} code=${write.code ?? 'unknown'} ${write.message}`;
        return {
          status: 'failed',
          seoDecision: 'REJECT',
          diversityScore: 0,
          warnings: ['DB write failed', detail],
          reasons: ['DB_ERROR'],
          reason: `DB_ERROR: ${detail}`,
          pageKey,
        };
      }

      // Refus du WriteGate (written=false) : la page n'a PAS été écrite.
      // Aucune version / empreinte / similarité / file / QA n'est enregistrée
      // pour un contenu qui n'existe pas en base ; statut distinct remonté.
      if (write.kind === 'gate_refused') {
        return {
          status: 'write_gate_blocked',
          seoDecision: decision,
          diversityScore: metrics.diversityScore,
          warnings: [...warnings, `WRITE_GATE_BLOCKED: ${write.reason}`],
          reasons,
          reason: `WRITE_GATE_BLOCKED: ${write.reason}`,
          pageKey,
          writeGate: {
            reason: write.reason,
            fieldsSkipped: write.fieldsSkipped,
            fieldsStripped: write.fieldsStripped,
          },
        };
      }

      const pageId = write.pageId;

      // 5b. INSERT __seo_r8_page_versions
      await this.insertVersion(
        pageId,
        contentMain,
        blockPlan,
        renderedBlocks,
        metrics,
        fingerprints,
        decision,
      );

      // 5c. INSERT __seo_r8_fingerprints
      await this.insertFingerprints(
        pageId,
        pageKey,
        neighborFamilyKey,
        engineFamilyKey,
        fingerprints,
        blocks,
      );

      // 5d. INSERT __seo_r8_similarity_index (if neighbors)
      if (neighbors.length > 0) {
        await this.insertSimilarityScores(
          pageId,
          neighbors,
          contentMain,
          fingerprints,
        );
      }

      // 5e. INSERT __seo_r8_regeneration_queue (if REGENERATE)
      if (decision === 'REGENERATE') {
        await this.insertRegenerationQueue(pageId, pageKey, reasons);
      }

      // 5f. INSERT __seo_r8_qa_reviews (if REVIEW_REQUIRED)
      if (decision === 'REVIEW_REQUIRED') {
        await this.insertQaReview(pageId);
      }

      const elapsed = (performance.now() - startTime).toFixed(0);
      this.logger.log(
        `✅ R8 enriched type_id=${typeId} → ${decision} (score=${metrics.diversityScore.toFixed(1)}) in ${elapsed}ms`,
      );

      return {
        status: 'draft',
        seoDecision: decision,
        diversityScore: metrics.diversityScore,
        warnings,
        reasons,
        pageKey,
      };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(
        `❌ R8 enrichment failed type_id=${typeId}: ${message}`,
      );
      // Panne DB (lecture/écriture) ≠ contenu cassé.
      const code: R8ReasonCode =
        error instanceof DatabaseException ? 'DB_ERROR' : 'CONTENT_BROKEN';
      return {
        status: 'failed',
        seoDecision: 'REJECT',
        diversityScore: 0,
        warnings: [message],
        reasons: [code],
        reason: `${code}: ${message}`,
        pageKey,
      };
    }
  }

  // ── RAG Loaders ──

  private loadGammeRag(pgAlias: string): {
    faq: Array<{ q: string; a: string }>;
    symptoms: string[];
  } {
    const filePath = join(this.RAG_GAMMES_DIR, `${pgAlias}.md`);
    if (!existsSync(filePath)) return { faq: [], symptoms: [] };
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return { faq: [], symptoms: [] };
      const front = yaml.load(match[1]) as Record<string, unknown>;
      const contract = (front as any)?.page_contract || {};
      return {
        faq: Array.isArray(contract.faq) ? contract.faq : [],
        symptoms: Array.isArray(contract.symptoms) ? contract.symptoms : [],
      };
    } catch {
      return { faq: [], symptoms: [] };
    }
  }

  // ── Owned editorial (Fix B) ──

  /**
   * Loads governed, quality-gated gamme editorial from the OWNED DB tables
   * (`__seo_gamme_purchase_guide` + `__seo_gamme_conseil`) — NOT RAG md, NOT
   * TecDoc, NOT scraping. Quality floor `R8_OWNED_EDITORIAL_MIN_QUALITY`,
   * drafts excluded. Returns `null` when the gamme carries no publishable
   * editorial; the caller logs `R8_OWNED_EDITORIAL_FALLBACK` and uses the
   * existing path (never silent — CLAUDE.md no-silent-fallback).
   */
  private async loadGammeEditorial(family: {
    pg_id: number;
    pg_alias: string;
    pg_name: string;
    product_count: number;
  }): Promise<GammeEditorial | null> {
    const pgKey = String(family.pg_id);
    const [pgRes, conseilRes] = await Promise.all([
      this.client
        .from('__seo_gamme_purchase_guide')
        .select(
          'sgpg_how_to_choose, sgpg_selection_criteria, sgpg_symptoms, sgpg_risk_explanation, sgpg_risk_consequences, sgpg_timing_years, sgpg_timing_km, sgpg_timing_note, sgpg_anti_mistakes, sgpg_faq',
        )
        .eq('sgpg_pg_id', pgKey)
        .eq('sgpg_is_draft', false)
        .gte('sgpg_gatekeeper_score', R8_OWNED_EDITORIAL_MIN_QUALITY)
        .limit(1),
      this.client
        .from('__seo_gamme_conseil')
        .select('sgc_content, sgc_section_type, sgc_title')
        .eq('sgc_pg_id', pgKey)
        .gte('sgc_quality_score', R8_OWNED_EDITORIAL_MIN_QUALITY)
        .order('sgc_order', { ascending: true })
        .limit(20),
    ]);

    if (pgRes.error) {
      this.logger.warn(
        `loadGammeEditorial purchase_guide query failed pg_id=${pgKey}: ${pgRes.error.message}`,
      );
    }
    if (conseilRes.error) {
      this.logger.warn(
        `loadGammeEditorial conseil query failed pg_id=${pgKey}: ${conseilRes.error.message}`,
      );
    }

    const pg = (pgRes.data && pgRes.data[0]) || null;
    const conseil = (conseilRes.data ?? []).map((c: any) => ({
      content: c.sgc_content ?? null,
      section_type: c.sgc_section_type ?? null,
      title: c.sgc_title ?? null,
    }));

    if (!pg && conseil.length === 0) return null;

    return {
      pgId: family.pg_id,
      pgName: family.pg_name,
      pgAlias: family.pg_alias,
      productCount: family.product_count,
      purchaseGuide: pg
        ? {
            how_to_choose: pg.sgpg_how_to_choose ?? null,
            selection_criteria: pg.sgpg_selection_criteria ?? null,
            symptoms: Array.isArray(pg.sgpg_symptoms) ? pg.sgpg_symptoms : null,
            risk_explanation: pg.sgpg_risk_explanation ?? null,
            risk_consequences: Array.isArray(pg.sgpg_risk_consequences)
              ? pg.sgpg_risk_consequences
              : null,
            timing_years: pg.sgpg_timing_years ?? null,
            timing_km: pg.sgpg_timing_km ?? null,
            timing_note: pg.sgpg_timing_note ?? null,
            anti_mistakes: Array.isArray(pg.sgpg_anti_mistakes)
              ? pg.sgpg_anti_mistakes
              : null,
            faq: pg.sgpg_faq ?? null,
          }
        : null,
      conseil,
    };
  }

  // ── Neighbors ──

  // Sentinel : `R8Neighbor` augmenté avec `variant_signature` pour la
  // détection de collision meta dans la fratrie (PR-1 seo-v9).
  private async fetchNeighbors(
    neighborFamilyKey: string,
    excludePageKey: string,
  ): Promise<R8Neighbor[]> {
    const { data, error } = await this.client
      .from(R8_TABLES.pages)
      .select(
        'id, page_key, content_main, faq_signature, category_signature, diversity_score, variant_signature',
      )
      .eq('neighbor_family_key', neighborFamilyKey)
      .neq('page_key', excludePageKey)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(5);
    // Une erreur DB (ex. colonne absente, 42703) n'est PAS « aucun voisin » :
    // un [] silencieux gonfle le score de diversité et peut ouvrir le gate INDEX.
    if (error) {
      this.logger.error(
        `[R8_DB_ERROR] op=fetch_neighbors neighbor_family_key=${neighborFamilyKey} code=${error.code ?? 'unknown'} message=${error.message}`,
      );
      throw new DatabaseException({
        code: ErrorCodes.DATABASE.OPERATION_FAILED,
        message: `R8 fetchNeighbors failed (code=${error.code ?? 'unknown'}): ${error.message}`,
        context: { operation: 'fetch_neighbors', pgCode: error.code },
      });
    }
    return (data ?? []) as R8Neighbor[];
  }

  // ── Compose Blocks ──

  private composeBlocks(
    v: any,
    families: Array<{
      pg_id: number;
      pg_alias: string;
      pg_name: string;
      family_name: string;
      product_count: number;
    }>,
    bestsellers: Array<{ piece_id: number; piece_name: string; price: number }>,
    gammeRags: Array<{
      faq: Array<{ q: string; a: string }>;
      symptoms: string[];
    }>,
    neighbors: R8Neighbor[],
    useOwnedEditorial = false,
    gammeEditorials: GammeEditorial[] = [],
    pageKey = '',
  ): R8Block[] {
    const blocks: R8Block[] = [];
    const brand = v.brand_name || '';
    const model = v.model_name || '';
    const type = v.type_name || '';
    const power = v.power_ps || '';
    const fuel = v.fuel || '';
    const yearFrom = v.year_from || '';
    const yearTo = v.year_to || '';
    const typeIdInt = parseInt(String(v.type_id || 0), 10);
    const placeholderCtx = {
      brand,
      model,
      type,
      power: String(power),
      fuel,
      year_from: String(yearFrom),
      year_to: yearTo ? String(yearTo) : "aujourd'hui",
      families_count: String(families.length),
      engine_code:
        Array.isArray(v.engine_codes) && v.engine_codes.length
          ? v.engine_codes[0]
          : '',
    };
    const renderTemplate = (template: string): string =>
      template.replace(/\{(\w+)\}/g, (_, key) =>
        Object.prototype.hasOwnProperty.call(placeholderCtx, key)
          ? (placeholderCtx as Record<string, string>)[key]
          : `{${key}}`,
      );

    // Fix B — owned editorial × motorisation facts (flag-gated by caller).
    const facts: MotorisationFacts = {
      brand,
      model,
      type,
      power: String(power),
      fuel,
      yearFrom: String(yearFrom),
      yearTo: yearTo ? String(yearTo) : '',
    };
    const anchorEditorial = useOwnedEditorial
      ? pickAnchorGamme(gammeEditorials)
      : null;

    // S_IDENTITY (ADR-022 P2d : rotation déterministe pool 7)
    const introTemplate = selectVariation(
      SEO_R8_INTRO_VARIATIONS,
      typeIdInt,
      0,
      R8_SLOT_OFFSETS.INTRO,
    );
    blocks.push({
      id: 'S_IDENTITY',
      type: 'vehicle_identity',
      title: `${brand} ${model} ${type}`,
      renderedText: renderTemplate(introTemplate),
      specificityWeight: 0.75,
      boilerplateRisk: 0.15,
      semanticPayload: [brand, model, type, fuel, power].filter(Boolean),
    });

    // S_COMPAT_SCOPE
    const engineCodes = Array.isArray(v.engine_codes) ? v.engine_codes : [];
    const cnitCodes = Array.isArray(v.cnit_codes) ? v.cnit_codes : [];
    const compatLines = [];
    if (engineCodes.length)
      compatLines.push(`Codes moteur : ${engineCodes.join(', ')}`);
    if (cnitCodes.length)
      compatLines.push(`Codes CNIT : ${cnitCodes.join(', ')}`);
    if (!compatLines.length)
      compatLines.push(
        `Vérifiez la compatibilité avec votre numéro VIN (case D.2 de la carte grise).`,
      );
    blocks.push({
      id: 'S_COMPAT_SCOPE',
      type: 'compatibility_scope',
      title: `Compatibilité ${brand} ${model} ${type}`,
      renderedText: compatLines.join('\n'),
      specificityWeight: engineCodes.length > 0 ? 0.85 : 0.5,
      boilerplateRisk: engineCodes.length > 0 ? 0.1 : 0.4,
      semanticPayload: [...engineCodes, ...cnitCodes],
    });

    // S_TECH_SPECS — motorisation du type courant, depuis auto_type uniquement.
    // Le tableau `specs_techniques` du fichier RAG véhicule n'est plus rendu :
    // RAG = couche chatbot, zéro autorité d'écriture contenu (CLAUDE.md
    // invariant 4, ADR-031/046). Cette fiche vient d'une seule page web non
    // vérifiée, niveau modèle, et était recopiée sur tous les types du modèle
    // (cylindrée diesel 1 461 cm3 affichée sur un 1.2 essence).
    if (type) {
      blocks.push({
        id: 'S_TECH_SPECS',
        type: 'technical_specs',
        title: `Fiche technique ${brand} ${model} ${type}`,
        renderedText: `**Motorisation** : ${type} ${power ? power + ' ch' : ''} (${fuel || 'N/C'})`,
        specificityWeight: 0.9,
        boilerplateRisk: 0.05,
        semanticPayload: [type, fuel, power ? `${power}ch` : ''].filter(
          Boolean,
        ),
      });
    }

    // S_VARIANT_DIFFERENCE (ADR-022 P2d : rotation pool 11 avec salt)
    const variantTemplate = selectVariation(
      SEO_R8_VARIANT_HIGHLIGHT_VARIATIONS,
      typeIdInt,
      0,
      R8_SLOT_OFFSETS.VARIANT_HIGHLIGHT,
    );
    blocks.push({
      id: 'S_VARIANT_DIFFERENCE',
      type: 'variant_difference',
      title:
        neighbors.length > 0
          ? `Ce qui distingue la ${type} ${power} ch`
          : `Spécificités de la ${type} ${power} ch`,
      renderedText: renderTemplate(variantTemplate),
      specificityWeight: neighbors.length > 0 ? 0.95 : 0.85,
      boilerplateRisk: neighbors.length > 0 ? 0.05 : 0.1,
      semanticPayload: [
        type,
        power,
        neighbors.length > 0 ? 'variant' : String(families.length),
        'différence',
      ],
    });

    // S_SELECTION_GUIDE — owned editorial (Fix B) × facts only. The former
    // fallback copied `pieces_usure` of the vehicle RAG file: RAG = chatbot
    // layer, zero content-write authority (CLAUDE.md invariant 4, ADR-031/046).
    // No owned editorial → no block; the gate records MISSING_HELP_BLOCK.
    const ownedSelection =
      useOwnedEditorial && anchorEditorial
        ? buildOwnedSelectionGuide(anchorEditorial, facts)
        : null;
    if (ownedSelection) {
      blocks.push(ownedSelection);
    } else if (useOwnedEditorial) {
      this.logger.log(
        `R8_OWNED_EDITORIAL_FALLBACK section=S_SELECTION_GUIDE page=${pageKey} reason=${anchorEditorial ? 'no_owned_selection' : 'no_anchor_editorial'}`,
      );
    }

    // S_ENTRETIEN_CONTEXT — owned editorial (Fix B) × facts only. The former
    // fallback copied `problemes_connus` of the vehicle RAG file, i.e. generic
    // gamme symptoms identical across vehicles, under a "Problèmes connus
    // <marque> <modèle>" H2 (same rule as S_SELECTION_GUIDE above).
    const ownedEntretien =
      useOwnedEditorial && anchorEditorial
        ? buildOwnedEntretien(anchorEditorial, facts)
        : null;
    if (ownedEntretien) {
      blocks.push(ownedEntretien);
    } else if (useOwnedEditorial) {
      this.logger.log(
        `R8_OWNED_EDITORIAL_FALLBACK section=S_ENTRETIEN_CONTEXT page=${pageKey} reason=${anchorEditorial ? 'no_owned_entretien' : 'no_anchor_editorial'}`,
      );
    }

    // S_CATALOG_ACCESS (dynamic ranking + ADR-022 P2d variation opener)
    const topFamilies = families.slice(0, 10);
    if (topFamilies.length >= 3) {
      const catalogOpener = renderTemplate(
        selectVariation(
          SEO_R8_CATALOG_ACCESS_VARIATIONS,
          typeIdInt,
          0,
          R8_SLOT_OFFSETS.CATALOG_ACCESS,
        ),
      );
      const catalogLines = topFamilies.map(
        (f, i) => `${i + 1}. **${f.pg_name}** — ${f.product_count} références`,
      );
      blocks.push({
        id: 'S_CATALOG_ACCESS',
        type: 'dynamic_category_ranking',
        title: `Top familles de pièces`,
        renderedText: `${catalogOpener}\n\n${catalogLines.join('\n')}`,
        specificityWeight: 0.75,
        boilerplateRisk: 0.15,
        semanticPayload: topFamilies.map((f) => f.pg_alias),
      });
    }

    // S_FAQ_DEDICATED — owned FAQ (Fix B) merged across gammes, else gamme-RAG FAQ.
    // ADR-022 P2d variation opener = connective tissue (used in both paths).
    const faqOpener = renderTemplate(
      selectVariation(
        SEO_R8_FAQ_OPENING_VARIATIONS,
        typeIdInt,
        0,
        R8_SLOT_OFFSETS.FAQ_OPENING,
      ),
    );
    const ownedFaq = useOwnedEditorial
      ? buildOwnedFaq(gammeEditorials, facts, faqOpener)
      : null;
    if (ownedFaq) {
      blocks.push(ownedFaq);
    } else {
      if (useOwnedEditorial) {
        this.logger.log(
          `R8_OWNED_EDITORIAL_FALLBACK section=S_FAQ_DEDICATED page=${pageKey} reason=no_owned_faq`,
        );
      }
      const allFaqs = gammeRags.flatMap((g) => g.faq);
      const uniqueFaqs = this.deduplicateFaqs(allFaqs).slice(0, 6);
      if (uniqueFaqs.length >= 2) {
        blocks.push({
          id: 'S_FAQ_DEDICATED',
          type: 'dedicated_faq',
          title: `Questions fréquentes`,
          renderedText: `${faqOpener}\n\n${uniqueFaqs.map((f) => `**${f.q}**\n${f.a}`).join('\n\n')}`,
          specificityWeight: 0.7,
          boilerplateRisk: 0.2,
          semanticPayload: uniqueFaqs.map((f) => f.q.slice(0, 30)),
        });
      }
    }

    // S_TRUST (ADR-022 P2d : atténue boilerplate via rotation pool 5)
    const trustTemplate = selectVariation(
      SEO_R8_TRUST_SIGNAL_VARIATIONS,
      typeIdInt,
      0,
      R8_SLOT_OFFSETS.TRUST_SIGNAL,
    );
    blocks.push({
      id: 'S_TRUST',
      type: 'trust_and_support',
      title: `Garantie et livraison`,
      renderedText: renderTemplate(trustTemplate),
      specificityWeight: 0.4,
      boilerplateRisk: 0.65,
      semanticPayload: ['garantie', 'livraison', brand, model].filter(Boolean),
    });

    return blocks;
  }

  // ── FAQ Dedup ──

  private deduplicateFaqs(
    faqs: Array<{ q: string; a: string }>,
  ): Array<{ q: string; a: string }> {
    const seen = new Set<string>();
    return faqs.filter((f) => {
      const key = f.q
        .toLowerCase()
        .replace(/[^a-zàâéèêëïîôùûüÿç0-9]/g, '')
        .slice(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ── Metrics ──

  private computeMetrics(
    blocks: R8Block[],
    neighbors: R8Neighbor[],
    families: Array<{ pg_id: number; pg_alias: string; pg_name: string }>,
  ) {
    const total = blocks.length;
    const specificBlocks = blocks.filter((b) => b.specificityWeight >= 0.65);
    const boilerplateBlocks = blocks.filter((b) => b.boilerplateRisk >= 0.5);

    const specificContentRatio = total > 0 ? specificBlocks.length / total : 0;
    const boilerplateRatio = total > 0 ? boilerplateBlocks.length / total : 0;

    // Semantic similarity (Jaccard tokens vs neighbors)
    let semanticSimilarityScore = 80; // default intrinsic
    if (neighbors.length > 0) {
      const myTokens = new Set(blocks.flatMap((b) => b.semanticPayload));
      const avgSim =
        neighbors.reduce((sum, n) => {
          const nTokens = new Set(
            (n.content_main || '').toLowerCase().split(/\s+/).slice(0, 100),
          );
          const intersection = [...myTokens].filter((t) =>
            nTokens.has(t),
          ).length;
          const union = new Set([...myTokens, ...nTokens]).size;
          return sum + (union > 0 ? (1 - intersection / union) * 100 : 80);
        }, 0) / neighbors.length;
      semanticSimilarityScore = Math.min(100, Math.max(0, avgSim));
    }

    // FAQ reuse risk
    let faqReuseRiskScore = 0;
    if (neighbors.length > 0) {
      const faqBlock = blocks.find((b) => b.type === 'dedicated_faq');
      if (faqBlock) {
        const myFaqHash = this.sha256(faqBlock.renderedText);
        const matchingNeighbors = neighbors.filter(
          (n) => n.faq_signature === myFaqHash,
        ).length;
        faqReuseRiskScore =
          neighbors.length > 0
            ? (matchingNeighbors / neighbors.length) * 100
            : 0;
      }
    }

    // Catalog delta (intrinsic based on family count)
    const catalogDeltaScore = Math.min(100, families.length * 2);

    // Category order diversity (intrinsic)
    const categoryOrderDiversityScore =
      blocks.length >= 7 ? 85 : blocks.length >= 5 ? 70 : 50;

    // Commercial intent
    const hasCtaBlock = blocks.some(
      (b) => b.type === 'dynamic_category_ranking',
    );
    const hasBestsellers = blocks.some((b) => b.type === 'best_entrypoints');
    const commercialIntentScore =
      (hasCtaBlock ? 40 : 0) +
      (hasBestsellers ? 30 : 0) +
      (families.length > 5 ? 30 : families.length > 0 ? 15 : 0);

    // Weighted formula
    const w = R8_DIVERSITY_FORMULA_WEIGHTS;
    const diversityScore = Math.max(
      0,
      Math.min(
        100,
        specificContentRatio * 100 * w.specificContentRatioScore +
          (specificBlocks.reduce((s, b) => s + b.specificityWeight, 0) /
            Math.max(1, specificBlocks.length)) *
            100 *
            w.blockSpecificityScore +
          semanticSimilarityScore * w.semanticSimilarityScore +
          categoryOrderDiversityScore * w.categoryOrderDiversityScore +
          catalogDeltaScore * w.catalogDeltaScore +
          commercialIntentScore * w.commercialIntentScore +
          (100 - faqReuseRiskScore) * w.faqReuseRiskInverted +
          boilerplateRatio * 100 * w.boilerplatePenalty,
      ),
    );

    return {
      specificContentRatio,
      boilerplateRatio,
      diversityScore,
      semanticSimilarityScore,
      categoryOrderDiversityScore,
      faqReuseRiskScore,
      catalogDeltaScore,
      commercialIntentScore,
    };
  }

  // ── Fingerprints ──

  private computeFingerprints(contentMain: string, blocks: R8Block[]) {
    const normalizedText = contentMain
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    const blockSequence = blocks.map((b) => b.type).join('|');
    const semanticKey = blocks
      .flatMap((b) => b.semanticPayload)
      .sort()
      .join('|');
    const faqBlock = blocks.find((b) => b.type === 'dedicated_faq');
    const categoryBlock = blocks.find(
      (b) => b.type === 'dynamic_category_ranking',
    );

    return {
      contentFingerprint: this.sha256(contentMain),
      normalizedTextFingerprint: this.sha256(normalizedText),
      blockSequenceFingerprint: this.sha256(blockSequence),
      semanticKeyFingerprint: this.sha256(semanticKey),
      faqSignature: this.sha256(faqBlock?.renderedText || 'NO_FAQ'),
      categorySignature: this.sha256(
        categoryBlock?.renderedText || 'NO_CATEGORY',
      ),
    };
  }

  private sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  // ── Meta collision penalty (PR-1 seo-v9 R8 meta variant pool) ──

  /**
   * Pour chaque slot meta sensible (`meta_title`, `meta_description`), compte
   * les voisins de la fratrie (`neighbor_family_key`) qui partagent le même
   * `srtp_id`. Si ≥ 2 collisions → pénalité de 5 pts sur
   * `metrics.semanticSimilarityScore`. Les pénalités s'additionnent ; le score
   * est plafonné à 0.
   *
   * Pas de pénalité H1 : pool 5 templates × 18 frères = ⌈18/5⌉=4 collisions
   * inévitables (faux positifs garantis si pénalisé).
   *
   * @returns warnings texte à merger avec ceux du gate.
   */
  private applyMetaCollisionPenalty(
    metrics: ReturnType<R8VehicleEnricherService['computeMetrics']>,
    neighbors: R8Neighbor[],
    variantSignature: R8VariantSignature,
  ): string[] {
    const warnings: string[] = [];

    const sameMetaTitleCount = variantSignature.meta_title
      ? neighbors.filter(
          (n) =>
            n.variant_signature?.meta_title === variantSignature.meta_title,
        ).length
      : 0;

    const sameMetaDescCount = variantSignature.meta_description
      ? neighbors.filter(
          (n) =>
            n.variant_signature?.meta_description ===
            variantSignature.meta_description,
        ).length
      : 0;

    if (sameMetaTitleCount >= 2) {
      metrics.semanticSimilarityScore = Math.max(
        0,
        metrics.semanticSimilarityScore - 5,
      );
      warnings.push(
        `META_TITLE_COLLISION_IN_FAMILY count=${sameMetaTitleCount}`,
      );
    }
    if (sameMetaDescCount >= 2) {
      metrics.semanticSimilarityScore = Math.max(
        0,
        metrics.semanticSimilarityScore - 5,
      );
      warnings.push(
        `META_DESCRIPTION_COLLISION_IN_FAMILY count=${sameMetaDescCount}`,
      );
    }

    return warnings;
  }

  // ── Gate ──

  private gate(
    metrics: ReturnType<R8VehicleEnricherService['computeMetrics']>,
    blocks: R8Block[],
  ): { decision: R8SeoDecision; reasons: R8ReasonCode[]; warnings: string[] } {
    const reasons: R8ReasonCode[] = [];
    const warnings: string[] = [];

    // Hard gates
    if (metrics.specificContentRatio < R8_HARD_GATES.min_specific_content_ratio)
      reasons.push('LOW_SPECIFIC_CONTENT');
    if (metrics.boilerplateRatio > R8_HARD_GATES.max_boilerplate_ratio)
      reasons.push('HIGH_BOILERPLATE');
    if (metrics.faqReuseRiskScore > R8_HARD_GATES.max_faq_reuse_risk)
      reasons.push('HIGH_FAQ_REUSE');
    if (metrics.semanticSimilarityScore < R8_HARD_GATES.min_semantic_diversity)
      reasons.push('LOW_SEMANTIC_DIVERSITY');
    if (metrics.commercialIntentScore < R8_HARD_GATES.min_commercial_intent)
      reasons.push('LOW_COMMERCIAL_INTENT');

    // Block presence checks
    const types = new Set(blocks.map((b) => b.type));
    if (!types.has('variant_difference'))
      reasons.push('MISSING_VARIANT_DIFF_BLOCK');
    if (!types.has('selection_help') && !types.has('maintenance_context'))
      reasons.push('MISSING_HELP_BLOCK');
    if (!types.has('compatibility_scope')) reasons.push('MISSING_COMPAT_BLOCK');
    if (!types.has('dynamic_category_ranking'))
      reasons.push('MISSING_CATALOG_DYNAMIC_BLOCK');

    // Structural failures → REJECT
    if (blocks.length < 4) {
      return {
        decision: 'REJECT',
        reasons: ['CONTENT_BROKEN'],
        warnings: ['too few blocks'],
      };
    }

    // Missing critical blocks → REGENERATE
    const criticalMissing = reasons.filter((r) => r.startsWith('MISSING_'));
    if (criticalMissing.length >= 2) {
      return { decision: 'REGENERATE', reasons, warnings };
    }

    // Score-based decision
    if (
      metrics.diversityScore >= R8_DIVERSITY_THRESHOLDS.index_min &&
      reasons.length === 0
    ) {
      if (metrics.diversityScore < R8_DIVERSITY_THRESHOLDS.clean_threshold) {
        warnings.push(
          `diversityScore ${metrics.diversityScore.toFixed(1)} < clean_threshold ${R8_DIVERSITY_THRESHOLDS.clean_threshold}`,
        );
      }
      return { decision: 'INDEX', reasons, warnings };
    }

    if (metrics.diversityScore >= R8_DIVERSITY_THRESHOLDS.index_min) {
      warnings.push(...reasons.map((r) => `gate warning: ${r}`));
      return { decision: 'INDEX', reasons, warnings };
    }

    return { decision: 'REVIEW_REQUIRED', reasons, warnings };
  }

  // ── DB Writes ──

  private async upsertPage(params: {
    pageKey: string;
    vehicle: any;
    typeId: string;
    h1: string;
    metaTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    contentMain: string;
    blockPlan: any[];
    renderedBlocks: any[];
    blocks: R8Block[];
    metrics: ReturnType<R8VehicleEnricherService['computeMetrics']>;
    fingerprints: ReturnType<R8VehicleEnricherService['computeFingerprints']>;
    neighborFamilyKey: string;
    engineFamilyKey: string;
    decision: R8SeoDecision;
    sitemapRules: { sitemap: boolean; robots: string };
    variantSignature: R8VariantSignature;
  }): Promise<R8PageWriteOutcome> {
    const v = params.vehicle;
    const row = {
      page_key: params.pageKey,
      page_role: 'R8',
      brand: v.brand_name || '',
      model: v.model_name || '',
      type_name: v.type_name || '',
      power_ps: String(v.power_ps || ''),
      fuel: v.fuel || '',
      body: v.body || '',
      year_from: String(v.year_from || ''),
      year_to: v.year_to ? String(v.year_to) : null,
      engine_codes: v.engine_codes || [],
      cnit_codes: v.cnit_codes || [],
      mine_codes: v.mine_codes || [],
      brand_id: v.brand_id ? String(v.brand_id) : null,
      model_id: v.model_id ? String(v.model_id) : null,
      type_id: params.typeId,
      canonical_url: params.canonicalUrl,
      h1: params.h1,
      meta_title: params.metaTitle,
      meta_description: params.metaDescription,
      content_main: params.contentMain,
      rendered_json: { blocks: params.renderedBlocks },
      block_plan: params.blockPlan,
      seo_decision: params.decision,
      specific_content_ratio: params.metrics.specificContentRatio,
      boilerplate_ratio: params.metrics.boilerplateRatio,
      diversity_score: params.metrics.diversityScore,
      semantic_similarity_score: params.metrics.semanticSimilarityScore,
      category_order_diversity_score:
        params.metrics.categoryOrderDiversityScore,
      faq_reuse_risk_score: params.metrics.faqReuseRiskScore,
      catalog_delta_score: params.metrics.catalogDeltaScore,
      commercial_intent_score: params.metrics.commercialIntentScore,
      content_fingerprint: params.fingerprints.contentFingerprint,
      normalized_text_fingerprint:
        params.fingerprints.normalizedTextFingerprint,
      faq_signature: params.fingerprints.faqSignature,
      category_signature: params.fingerprints.categorySignature,
      neighbor_family_key: params.neighborFamilyKey,
      engine_family_key: params.engineFamilyKey,
      sitemap_included: params.sitemapRules.sitemap,
      robots_directive: params.sitemapRules.robots,
      published_at:
        params.decision === 'INDEX' ? new Date().toISOString() : null,
      // PR-1 seo-v9 R8 meta variant pool : map slot -> srtp_id (uuid).
      variant_signature: params.variantSignature,
    };

    // ── P1.5 v2.1: Route through WriteGate when enabled ──
    // R8 uses upsert (insert or update). WriteGate handles updates via merge.
    // For new pages (insert), we still need the direct upsert path.
    if (this.writeGate && this.featureFlags?.writeGuardEnabled) {
      // Check if page already exists
      const { data: existingPage, error: lookupError } = await this.client
        .from(R8_TABLES.pages)
        .select('id')
        .eq('page_key', row.page_key)
        .maybeSingle();

      // Lecture en échec ≠ « page absente » : sans ce garde, une page existante
      // retomberait sur l'upsert direct et contournerait le WriteGate.
      if (lookupError) {
        this.logger.error(
          `[R8_DB_ERROR] op=page_lookup page_key=${row.page_key} code=${lookupError.code ?? 'unknown'} message=${lookupError.message}`,
        );
        return {
          kind: 'db_error',
          operation: 'page_lookup',
          code: lookupError.code,
          message: lookupError.message,
        };
      }

      if (existingPage) {
        // Update existing — route through WriteGate
        const correlationId = `r8-${row.page_key}-${Date.now().toString(36)}`;
        const result = await this.writeGate.writeToTarget({
          roleId: RoleId.R8_VEHICLE,
          target: 'r8_vehicle_main' as ResourceGroup,
          pkValue: existingPage.id,
          payload: row,
          correlationId,
        });
        this.logger.log(
          `R8 page via WriteGate: ${row.page_key} written=${result.written} ` +
            `fields=${result.fieldsWritten.length} skipped=${result.fieldsSkipped.length}`,
        );
        if (!result.written) {
          const reason = result.reason ?? 'unknown';
          // Le WriteGate encode ses propres pannes DB en `db_error…` : ce n'est
          // pas un refus de garde, c'est une panne d'écriture. Contrat du
          // préfixe = ContentWriteExecutor.execute, étape H
          // (config/content-write-executor.service.ts) : `db_error: <message>`
          // si l'UPDATE échoue (l.208) et `db_error_insert: <message>` si
          // l'INSERT de repli échoue (l.230) ; ContentWriteGateService recopie
          // ce `reason` tel quel. Épinglé par le test C2 de
          // r8-vehicle-enricher.write-gate.test.ts (motif produit par le vrai
          // exécuteur) : pas d'énumération parallèle ici.
          if (reason.startsWith('db_error')) {
            this.logger.error(
              `[R8_DB_ERROR] op=write_gate page_key=${row.page_key} page_id=${existingPage.id} ` +
                `reason=${reason} correlation_id=${correlationId}`,
            );
            return {
              kind: 'db_error',
              operation: 'write_gate',
              message: reason,
            };
          }
          this.logger.warn(
            `[R8_WRITE_GATE_REFUSED] page_key=${row.page_key} page_id=${existingPage.id} ` +
              `reason=${reason} fields_skipped=${result.fieldsSkipped.join(',') || '-'} ` +
              `fields_stripped=${result.fieldsStripped.join(',') || '-'} correlation_id=${correlationId}`,
          );
          return {
            kind: 'gate_refused',
            pageId: existingPage.id,
            reason,
            fieldsSkipped: result.fieldsSkipped,
            fieldsStripped: result.fieldsStripped,
          };
        }
        return { kind: 'written', pageId: existingPage.id };
      }
      // New page — fall through to upsert (insert)
    }

    // Legacy/insert path
    const { data, error } = await this.client
      .from(R8_TABLES.pages)
      .upsert(row, { onConflict: 'page_key' })
      .select('id')
      .single();

    if (error) {
      this.logger.error(
        `[R8_DB_ERROR] op=upsert UPSERT __seo_r8_pages failed: code=${error.code ?? 'unknown'} message=${error.message}`,
      );
      return {
        kind: 'db_error',
        operation: 'upsert',
        code: error.code,
        message: error.message,
      };
    }
    if (!data?.id) {
      return {
        kind: 'db_error',
        operation: 'upsert',
        message: 'upsert returned no id',
      };
    }
    return { kind: 'written', pageId: data.id };
  }

  private async insertVersion(
    pageId: string,
    contentMain: string,
    blockPlan: any[],
    renderedBlocks: any[],
    metrics: ReturnType<R8VehicleEnricherService['computeMetrics']>,
    fingerprints: ReturnType<R8VehicleEnricherService['computeFingerprints']>,
    decision: R8SeoDecision,
  ): Promise<void> {
    // Get next version number
    const { data: existing } = await this.client
      .from(R8_TABLES.versions)
      .select('version_no')
      .eq('page_id', pageId)
      .order('version_no', { ascending: false })
      .limit(1);
    const nextVersion = existing?.[0] ? existing[0].version_no + 1 : 1;

    await this.client.from(R8_TABLES.versions).insert({
      page_id: pageId,
      version_no: nextVersion,
      content_main: contentMain,
      rendered_json: { blocks: renderedBlocks },
      block_plan: blockPlan,
      seo_decision: decision,
      diversity_score: metrics.diversityScore,
      semantic_similarity_score: metrics.semanticSimilarityScore,
      catalog_delta_score: metrics.catalogDeltaScore,
      commercial_intent_score: metrics.commercialIntentScore,
      content_fingerprint: fingerprints.contentFingerprint,
      faq_signature: fingerprints.faqSignature,
      category_signature: fingerprints.categorySignature,
    });
  }

  private async insertFingerprints(
    pageId: string,
    pageKey: string,
    neighborFamilyKey: string,
    engineFamilyKey: string,
    fingerprints: ReturnType<R8VehicleEnricherService['computeFingerprints']>,
    blocks: R8Block[],
  ): Promise<void> {
    await this.client.from(R8_TABLES.fingerprints).insert({
      page_id: pageId,
      page_key: pageKey,
      neighbor_family_key: neighborFamilyKey,
      engine_family_key: engineFamilyKey,
      content_fingerprint: fingerprints.contentFingerprint,
      normalized_text_fingerprint: fingerprints.normalizedTextFingerprint,
      block_sequence_fingerprint: fingerprints.blockSequenceFingerprint,
      semantic_key_fingerprint: fingerprints.semanticKeyFingerprint,
      faq_signature: fingerprints.faqSignature,
      category_signature: fingerprints.categorySignature,
      top_tokens: blocks.flatMap((b) => b.semanticPayload).slice(0, 20),
      block_type_sequence: blocks.map((b) => b.type),
    });
  }

  private async insertSimilarityScores(
    pageId: string,
    neighbors: R8Neighbor[],
    contentMain: string,
    fingerprints: ReturnType<R8VehicleEnricherService['computeFingerprints']>,
  ): Promise<void> {
    for (const neighbor of neighbors) {
      // Simple token Jaccard
      const myTokens = new Set(
        contentMain.toLowerCase().split(/\s+/).slice(0, 200),
      );
      const nTokens = new Set(
        (neighbor.content_main || '').toLowerCase().split(/\s+/).slice(0, 200),
      );
      const intersection = [...myTokens].filter((t) => nTokens.has(t)).length;
      const union = new Set([...myTokens, ...nTokens]).size;
      const semanticSim = union > 0 ? (intersection / union) * 100 : 0;

      const faqSim =
        fingerprints.faqSignature === neighbor.faq_signature ? 100 : 0;
      const catSim =
        fingerprints.categorySignature === neighbor.category_signature
          ? 100
          : 0;
      const overall = semanticSim * 0.5 + faqSim * 0.25 + catSim * 0.25;

      await this.client.from(R8_TABLES.similarity).upsert(
        {
          page_id: pageId,
          compared_page_id: neighbor.id,
          semantic_similarity_score: semanticSim,
          faq_similarity_score: faqSim,
          category_order_similarity_score: catSim,
          overall_similarity_score: overall,
          comparison_scope: 'NEAREST_NEIGHBOR',
        },
        { onConflict: 'page_id,compared_page_id,comparison_scope' },
      );
    }
  }

  private async insertRegenerationQueue(
    pageId: string,
    pageKey: string,
    reasons: R8ReasonCode[],
  ): Promise<void> {
    await this.client.from(R8_TABLES.queue).insert({
      page_id: pageId,
      page_key: pageKey,
      reason_code: reasons[0] || 'CONTENT_BROKEN',
      reason_details: { all_reasons: reasons },
      status: 'PENDING',
      priority: 100,
    });
  }

  private async insertQaReview(pageId: string): Promise<void> {
    await this.client.from(R8_TABLES.qa).insert({
      page_id: pageId,
      review_status: 'TODO',
      notes: 'Auto-flagged: diversityScore below index threshold',
    });
  }
}
