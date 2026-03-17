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
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { EnricherTextUtils } from './enricher-text-utils.service';
import { VehicleRagGeneratorService } from './vehicle-rag-generator.service';
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

// ── Result ──

export interface R8EnrichResult {
  status: 'draft' | 'failed' | 'skipped';
  seoDecision: R8SeoDecision;
  diversityScore: number;
  warnings: string[];
  reasons: R8ReasonCode[];
  pageKey: string;
}

// ── RAG vehicle frontmatter ──

interface VehicleRagData {
  motorisations?: Array<{ moteur: string; puissance: string; code: string }>;
  problemes_connus?: string[];
  pieces_usure?: string[];
  entretien?: string[];
  faq?: Array<{ q: string; a: string }>;
  specs_techniques?: {
    longueur?: string;
    largeur?: string;
    hauteur?: string;
    empattement?: string;
    poids?: string;
    coffre?: string;
    reservoir?: string;
    vitesse_max?: string;
    zero_a_cent?: string;
    conso_mixte?: string;
    co2?: string;
    couple?: string;
    cylindree?: string;
    boite?: string;
    transmission?: string;
    pneus?: string;
    diam_braquage?: string;
    norme_euro?: string;
    source_url?: string;
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
}

@Injectable()
export class R8VehicleEnricherService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    R8VehicleEnricherService.name,
  );
  private readonly RAG_VEHICLES_DIR = '/opt/automecanik/rag/knowledge/vehicles';
  private readonly RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';

  constructor(
    configService: ConfigService,
    private readonly textUtils: EnricherTextUtils,
    private readonly vehicleRagGenerator: VehicleRagGeneratorService,
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
    const { data, error } = await this.callRpc<Record<string, any>>(
      'get_vehicle_page_data_optimized',
      { p_type_id: typeId },
      { source: 'api' },
    );
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

      // RAG: vehicle model file — auto-generate if missing
      const brandSlug = (v.brand_alias || '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const modelSlug = (v.model_alias || v.model_name || '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const ragPath = join(
        this.RAG_VEHICLES_DIR,
        `${brandSlug}-${modelSlug}.md`,
      );
      const ragFallback = join(this.RAG_VEHICLES_DIR, `${modelSlug}.md`);
      if (!existsSync(ragPath) && !existsSync(ragFallback) && v.model_id) {
        const modeleId =
          typeof v.model_id === 'string'
            ? parseInt(v.model_id, 10)
            : v.model_id;
        if (modeleId > 0) {
          this.logger.log(
            `Auto-generating vehicle RAG for ${brandSlug}-${modelSlug} (modele_id=${modeleId})`,
          );
          await this.vehicleRagGenerator.generateForModel(modeleId);
        }
      }
      const vehicleRag = this.loadVehicleRag(
        v.model_alias || v.model_name || '',
        v.brand_alias || v.brand_name || '',
      );

      // RAG: top 5 gammes
      const topGammes = families.slice(0, 5);
      const gammeRags = topGammes.map((g) => this.loadGammeRag(g.pg_alias));

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
        vehicleRag,
        gammeRags,
        neighbors,
      );

      // Build H1 + meta
      const h1 = buildR8H1({
        brand: v.brand_name || '',
        model: v.model_name || '',
        type: v.type_name || '',
        powerPs: v.power_ps || '',
        yearFrom: v.year_from || '',
        yearTo: v.year_to || null,
      });
      const metaTitle =
        `Pièces ${v.brand_name} ${v.model_name} ${v.type_name} ${v.power_ps}ch | AutoMecanik`.slice(
          0,
          75,
        );
      const metaDescription =
        `Catalogue complet de pièces auto pour ${h1}. ${families.length} familles de pièces compatibles. Livraison rapide.`.slice(
          0,
          170,
        );
      const canonicalUrl = `/constructeurs/${(v.brand_alias || v.brand_name || '').toLowerCase()}/${(v.model_alias || v.model_name || '').toLowerCase()}/${typeId}.html`;

      // Full content
      const contentMain = blocks
        .map((b) => `## ${b.title}\n\n${b.renderedText}`)
        .join('\n\n---\n\n');

      // ── 3. SCORE ──
      const metrics = this.computeMetrics(blocks, neighbors, families);
      const fingerprints = this.computeFingerprints(contentMain, blocks);

      // ── 4. GATE ──
      const { decision, reasons, warnings } = this.gate(metrics, blocks);
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
      const pageId = await this.upsertPage({
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
      });

      if (!pageId) {
        return {
          status: 'failed',
          seoDecision: 'REJECT',
          diversityScore: 0,
          warnings: ['DB write failed'],
          reasons: ['CONTENT_BROKEN'],
          pageKey,
        };
      }

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
      this.logger.error(
        `❌ R8 enrichment failed type_id=${typeId}: ${(error as Error).message}`,
      );
      return {
        status: 'failed',
        seoDecision: 'REJECT',
        diversityScore: 0,
        warnings: [(error as Error).message],
        reasons: ['CONTENT_BROKEN'],
        pageKey,
      };
    }
  }

  // ── RAG Loaders ──

  private loadVehicleRag(
    modelName: string,
    brandAlias?: string,
  ): VehicleRagData {
    const slug = modelName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const brand = (brandAlias || '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Try multiple slug patterns (brand-model first, model only as fallback)
    const candidates = [brand ? `${brand}-${slug}` : '', slug].filter(Boolean);

    for (const candidate of candidates) {
      const filePath = join(this.RAG_VEHICLES_DIR, `${candidate}.md`);
      if (!existsSync(filePath)) continue;
      try {
        const raw = readFileSync(filePath, 'utf-8');
        const match = raw.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
          const front = yaml.load(match[1]) as Record<string, unknown>;
          return front as unknown as VehicleRagData;
        }
      } catch {
        continue;
      }
    }
    return {};
  }

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

  // ── Neighbors ──

  private async fetchNeighbors(
    neighborFamilyKey: string,
    excludePageKey: string,
  ): Promise<R8Neighbor[]> {
    const { data, error } = await this.client
      .from(R8_TABLES.pages)
      .select(
        'id, page_key, content_main, faq_signature, category_signature, diversity_score',
      )
      .eq('neighbor_family_key', neighborFamilyKey)
      .neq('page_key', excludePageKey)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(5);
    if (error || !data) return [];
    return data as R8Neighbor[];
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
    vehicleRag: VehicleRagData,
    gammeRags: Array<{
      faq: Array<{ q: string; a: string }>;
      symptoms: string[];
    }>,
    neighbors: R8Neighbor[],
  ): R8Block[] {
    const blocks: R8Block[] = [];
    const brand = v.brand_name || '';
    const model = v.model_name || '';
    const type = v.type_name || '';
    const power = v.power_ps || '';
    const fuel = v.fuel || '';
    const yearFrom = v.year_from || '';
    const yearTo = v.year_to || '';

    // S_IDENTITY
    blocks.push({
      id: 'S_IDENTITY',
      type: 'vehicle_identity',
      title: `${brand} ${model} ${type}`,
      renderedText: `La ${brand} ${model} ${type} ${power} ch${fuel ? ` (${fuel})` : ''} est produite de ${yearFrom}${yearTo ? ` à ${yearTo}` : " à aujourd'hui"}. Cette fiche regroupe l'ensemble des pièces compatibles avec votre motorisation.`,
      specificityWeight: 0.7,
      boilerplateRisk: 0.2,
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

    // S_TECH_SPECS — motorisation du type courant + web specs (dimensions, performances)
    const specs = vehicleRag.specs_techniques;
    const hasSpecs =
      specs && Object.keys(specs).filter((k) => k !== 'source_url').length > 0;
    if (type || hasSpecs) {
      const parts: string[] = [];

      // Web specs table (dimensions, performances)
      if (hasSpecs) {
        const specRows: string[] = [];
        if (specs.longueur) specRows.push(`| Longueur | ${specs.longueur} |`);
        if (specs.largeur) specRows.push(`| Largeur | ${specs.largeur} |`);
        if (specs.hauteur) specRows.push(`| Hauteur | ${specs.hauteur} |`);
        if (specs.empattement)
          specRows.push(`| Empattement | ${specs.empattement} |`);
        if (specs.poids) specRows.push(`| Poids à vide | ${specs.poids} |`);
        if (specs.coffre) specRows.push(`| Coffre | ${specs.coffre} |`);
        if (specs.reservoir)
          specRows.push(`| Réservoir | ${specs.reservoir} |`);
        if (specs.cylindree)
          specRows.push(`| Cylindrée | ${specs.cylindree} |`);
        if (specs.couple) specRows.push(`| Couple | ${specs.couple} |`);
        if (specs.boite) specRows.push(`| Boîte | ${specs.boite} |`);
        if (specs.transmission)
          specRows.push(`| Transmission | ${specs.transmission} |`);
        if (specs.vitesse_max)
          specRows.push(`| Vitesse max | ${specs.vitesse_max} |`);
        if (specs.zero_a_cent)
          specRows.push(`| 0 à 100 km/h | ${specs.zero_a_cent} |`);
        if (specs.conso_mixte)
          specRows.push(`| Consommation mixte | ${specs.conso_mixte} |`);
        if (specs.co2) specRows.push(`| Émissions CO₂ | ${specs.co2} |`);
        if (specs.pneus) specRows.push(`| Pneumatiques | ${specs.pneus} |`);
        if (specs.norme_euro)
          specRows.push(`| Norme Euro | ${specs.norme_euro} |`);
        if (specRows.length > 0) {
          parts.push(
            `| Caractéristique | Valeur |\n|---|---|\n${specRows.join('\n')}`,
          );
        }
      }

      // Motorisation unique du type courant (1 type = 1 motorisation)
      if (type) {
        parts.push(
          `**Motorisation** : ${type} ${power ? power + ' ch' : ''} (${fuel || 'N/C'})`,
        );
      }

      blocks.push({
        id: 'S_TECH_SPECS',
        type: 'technical_specs',
        title: `Fiche technique ${brand} ${model} ${type}`,
        renderedText: parts.join('\n\n'),
        specificityWeight: hasSpecs ? 0.95 : 0.9,
        boilerplateRisk: 0.05,
        semanticPayload: [
          type,
          fuel,
          power ? `${power}ch` : '',
          ...(hasSpecs ? ['dimensions', 'performances', 'specs'] : []),
        ].filter(Boolean),
      });
    }

    // S_VARIANT_DIFFERENCE
    if (neighbors.length > 0) {
      const variantText = `Cette motorisation ${type} ${power} ch se distingue par sa puissance et son catalogue de pièces. Certaines familles (turbo, injecteurs, calculateur) sont spécifiques à cette version.`;
      blocks.push({
        id: 'S_VARIANT_DIFFERENCE',
        type: 'variant_difference',
        title: `Ce qui distingue la ${type} ${power} ch`,
        renderedText: variantText,
        specificityWeight: 0.95,
        boilerplateRisk: 0.05,
        semanticPayload: [type, power, 'variant', 'différence'],
      });
    } else {
      blocks.push({
        id: 'S_VARIANT_DIFFERENCE',
        type: 'variant_difference',
        title: `Spécificités de la ${type} ${power} ch`,
        renderedText: `La ${brand} ${model} ${type} ${power} ch possède un catalogue de ${families.length} familles de pièces. Les pièces de freinage, filtration et distribution sont les plus demandées pour cette motorisation.`,
        specificityWeight: 0.8,
        boilerplateRisk: 0.15,
        semanticPayload: [type, power, String(families.length)],
      });
    }

    // S_SELECTION_GUIDE
    const usurePieces = vehicleRag.pieces_usure || [];
    if (usurePieces.length > 0) {
      blocks.push({
        id: 'S_SELECTION_GUIDE',
        type: 'selection_help',
        title: `Pièces d'usure courantes`,
        renderedText: usurePieces.map((p) => `- ${p}`).join('\n'),
        specificityWeight: 0.85,
        boilerplateRisk: 0.1,
        semanticPayload: usurePieces.slice(0, 5),
      });
    }

    // S_ENTRETIEN_CONTEXT
    const problemes = vehicleRag.problemes_connus || [];
    if (problemes.length > 0) {
      blocks.push({
        id: 'S_ENTRETIEN_CONTEXT',
        type: 'maintenance_context',
        title: `Problèmes connus ${brand} ${model}`,
        renderedText: problemes.map((p) => `- ${p}`).join('\n'),
        specificityWeight: 0.85,
        boilerplateRisk: 0.1,
        semanticPayload: problemes.slice(0, 3),
      });
    }

    // S_CATALOG_ACCESS (dynamic ranking)
    const topFamilies = families.slice(0, 10);
    if (topFamilies.length >= 3) {
      const catalogLines = topFamilies.map(
        (f, i) => `${i + 1}. **${f.pg_name}** — ${f.product_count} références`,
      );
      blocks.push({
        id: 'S_CATALOG_ACCESS',
        type: 'dynamic_category_ranking',
        title: `Top familles de pièces`,
        renderedText: catalogLines.join('\n'),
        specificityWeight: 0.75,
        boilerplateRisk: 0.15,
        semanticPayload: topFamilies.map((f) => f.pg_alias),
      });
    }

    // S_FAQ_DEDICATED (merge from gamme RAGs)
    const allFaqs = gammeRags.flatMap((g) => g.faq);
    const uniqueFaqs = this.deduplicateFaqs(allFaqs).slice(0, 6);
    if (uniqueFaqs.length >= 2) {
      blocks.push({
        id: 'S_FAQ_DEDICATED',
        type: 'dedicated_faq',
        title: `Questions fréquentes`,
        renderedText: uniqueFaqs.map((f) => `**${f.q}**\n${f.a}`).join('\n\n'),
        specificityWeight: 0.65,
        boilerplateRisk: 0.25,
        semanticPayload: uniqueFaqs.map((f) => f.q.slice(0, 30)),
      });
    }

    // S_TRUST (static boilerplate)
    blocks.push({
      id: 'S_TRUST',
      type: 'trust_and_support',
      title: `Garantie et livraison`,
      renderedText: `Toutes les pièces sont garanties et expédiées sous 24-48h. Retours gratuits sous 30 jours. Notre service client est disponible du lundi au vendredi.`,
      specificityWeight: 0.3,
      boilerplateRisk: 0.8,
      semanticPayload: ['garantie', 'livraison'],
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
  }): Promise<string | null> {
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
    };

    // ── P1.5 v2.1: Route through WriteGate when enabled ──
    // R8 uses upsert (insert or update). WriteGate handles updates via merge.
    // For new pages (insert), we still need the direct upsert path.
    if (this.writeGate && this.featureFlags?.writeGuardEnabled) {
      // Check if page already exists
      const { data: existingPage } = await this.client
        .from(R8_TABLES.pages)
        .select('id')
        .eq('page_key', row.page_key)
        .maybeSingle();

      if (existingPage) {
        // Update existing — route through WriteGate
        const result = await this.writeGate.writeToTarget({
          roleId: RoleId.R8_VEHICLE,
          target: 'r8_vehicle_main' as ResourceGroup,
          pkValue: existingPage.id,
          payload: row,
          correlationId: `r8-${row.page_key}-${Date.now().toString(36)}`,
        });
        this.logger.log(
          `R8 page via WriteGate: ${row.page_key} written=${result.written} ` +
            `fields=${result.fieldsWritten.length} skipped=${result.fieldsSkipped.length}`,
        );
        return existingPage.id;
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
      this.logger.error(`UPSERT __seo_r8_pages failed: ${error.message}`);
      return null;
    }
    return data?.id || null;
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
