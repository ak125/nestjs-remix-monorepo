/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { EnricherTextUtils } from './enricher-text-utils.service';
import {
  R7_TABLES,
  R7_HEADING_TEMPLATES,
  R7_SECTION_QUALITY_GATES,
  R7_KP_QUALITY_THRESHOLDS,
  R7_GENERIC_PHRASES,
  R7_SITEMAP_RULES,
  type R7SeoDecision,
} from '../../../config/r7-keyword-plan.constants';

// ── Result ──

export interface R7EnrichResult {
  status: 'draft' | 'failed' | 'skipped';
  seoDecision: R7SeoDecision;
  diversityScore: number;
  warnings: string[];
  reasons: string[];
  pageKey: string;
}

// ── RAG brand frontmatter ──

interface BrandRagData {
  brand?: string;
  alias?: string;
  country?: string;
  top_models?: string[];
  top_gammes?: string[];
  common_issues?: string[];
  maintenance_tips?: string[];
  faq?: Array<{ q: string; a: string }>;
  history?: string;
}

// ── Block ──

interface R7Block {
  id: string;
  type: string;
  title: string;
  renderedText: string;
  specificityWeight: number;
  boilerplateRisk: number;
  semanticPayload: string[];
}

@Injectable()
export class R7BrandEnricherService extends SupabaseBaseService {
  protected override readonly logger = new Logger(R7BrandEnricherService.name);
  private readonly RAG_BRANDS_DIR =
    '/opt/automecanik/rag/knowledge/constructeurs';

  constructor(
    configService: ConfigService,
    private readonly textUtils: EnricherTextUtils,
  ) {
    super(configService);
  }

  /**
   * Fetch brand data via RPC (same call used by frontend).
   */
  private async fetchBrandData(
    marqueId: number,
  ): Promise<Record<string, any> | null> {
    const { data, error } = await this.callRpc<Record<string, any>>(
      'get_brand_page_data_optimized',
      { p_marque_id: marqueId },
      { source: 'api' },
    );
    if (error || !data?.brand) return null;
    return data;
  }

  /**
   * Enrich a single R7 brand page using RAG knowledge.
   * 0 LLM — pure data fetch + templates + scoring + DB writes.
   */
  async enrichSingle(marqueId: number): Promise<R7EnrichResult> {
    const startTime = performance.now();
    const pageKey = `r7_brand_${marqueId}`;

    try {
      // ── 1. FETCH DATA ──
      const brandData = await this.fetchBrandData(marqueId);
      if (!brandData?.brand) {
        return {
          status: 'failed',
          seoDecision: 'REJECT',
          diversityScore: 0,
          warnings: ['brand not found'],
          reasons: ['BRAND_NOT_FOUND'],
          pageKey,
        };
      }

      const b = brandData.brand;
      const brandName = b.marque_name || '';
      const brandAlias = (b.marque_alias || '').toLowerCase();
      const popularVehicles: any[] = brandData.popular_vehicles || [];
      const popularParts: any[] = brandData.popular_parts || [];
      const popularGammes: any[] = brandData.popular_gammes || [];
      const relatedBrands: any[] = brandData.related_brands || [];
      const blogContent = brandData.blog_content;

      // RAG: brand file
      const brandRag = this.loadBrandRag(brandAlias);

      // ── 2. COMPOSE BLOCKS ──
      const blocks = this.composeBlocks(
        brandName,
        brandAlias,
        popularVehicles,
        popularParts,
        popularGammes,
        relatedBrands,
        blogContent,
        brandRag,
      );

      // Build H1 + meta
      const h1 = `Catalogue pièces auto ${brandName}`;
      const metaTitle =
        `Pièces auto ${brandName} : catalogue compatible tous modèles | AutoMecanik`.slice(
          0,
          75,
        );
      const metaDescription =
        `Catalogue pièces détachées ${brandName} compatibles : freinage, embrayage, distribution, filtration. Sélectionnez votre modèle et motorisation.`.slice(
          0,
          170,
        );
      const canonicalUrl = `/constructeurs/${brandAlias}-${marqueId}.html`;

      // Full content
      const contentMain = blocks
        .map((bl) => `## ${bl.title}\n\n${bl.renderedText}`)
        .join('\n\n---\n\n');

      // ── 3. SCORE ──
      const metrics = this.computeMetrics(blocks, popularGammes);
      const fingerprints = this.computeFingerprints(contentMain, blocks);

      // ── 4. GATE ──
      const { decision, reasons, warnings } = this.gate(metrics, blocks);
      const sitemapRules = R7_SITEMAP_RULES[decision];

      const blockPlan = blocks.map((bl) => ({
        id: bl.id,
        type: bl.type,
        title: bl.title,
        specificityWeight: bl.specificityWeight,
        boilerplateRisk: bl.boilerplateRisk,
      }));

      const renderedBlocks = blocks.map((bl) => ({
        id: bl.id,
        type: bl.type,
        title: bl.title,
        renderedText: bl.renderedText || '',
        specificityWeight: bl.specificityWeight,
        boilerplateRisk: bl.boilerplateRisk,
      }));

      // Section scores
      const sectionScores: Record<string, number> = {};
      for (const bl of blocks) {
        sectionScores[bl.id] = bl.specificityWeight * 100;
      }

      // ── 5. WRITE DB ──

      // 5a. UPSERT __seo_r7_pages
      const pageId = await this.upsertPage({
        pageKey,
        marqueId,
        brandName,
        brandAlias,
        country: brandRag.country || null,
        h1,
        metaTitle,
        metaDescription,
        canonicalUrl,
        contentMain,
        blockPlan,
        renderedBlocks,
        sectionScores,
        metrics,
        fingerprints,
        decision,
        sitemapRules,
        modelsCount: popularVehicles.length,
        gammesCount: popularGammes.length,
        vehiclesCount: popularVehicles.length,
      });

      if (!pageId) {
        return {
          status: 'failed',
          seoDecision: 'REJECT',
          diversityScore: 0,
          warnings: ['DB write failed'],
          reasons: ['DB_WRITE_FAILED'],
          pageKey,
        };
      }

      // 5b. INSERT __seo_r7_page_versions
      await this.insertVersion(
        pageId,
        contentMain,
        blockPlan,
        renderedBlocks,
        sectionScores,
        metrics,
        fingerprints,
        decision,
      );

      // 5c. INSERT __seo_r7_fingerprints
      await this.insertFingerprints(pageId, pageKey, fingerprints, blocks);

      // 5d. INSERT __seo_r7_regeneration_queue (if REGENERATE)
      if (decision === 'REGENERATE') {
        await this.insertRegenerationQueue(pageId, pageKey, reasons);
      }

      // 5e. INSERT __seo_r7_qa_reviews (if REVIEW_REQUIRED)
      if (decision === 'REVIEW_REQUIRED') {
        await this.insertQaReview(pageId);
      }

      const elapsed = (performance.now() - startTime).toFixed(0);
      this.logger.log(
        `✅ R7 enriched marque_id=${marqueId} (${brandName}) → ${decision} (score=${metrics.diversityScore.toFixed(1)}) in ${elapsed}ms`,
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
        `❌ R7 enrichment failed marque_id=${marqueId}: ${(error as Error).message}`,
      );
      return {
        status: 'failed',
        seoDecision: 'REJECT',
        diversityScore: 0,
        warnings: [(error as Error).message],
        reasons: ['ENRICHMENT_FAILED'],
        pageKey,
      };
    }
  }

  // ── RAG Loader ──

  private loadBrandRag(brandAlias: string): BrandRagData {
    const filePath = join(this.RAG_BRANDS_DIR, `${brandAlias}.md`);
    if (!existsSync(filePath)) return {};
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---/);
      if (match) {
        return yaml.load(match[1]) as BrandRagData;
      }
    } catch {
      // graceful skip
    }
    return {};
  }

  // ── Compose Blocks ──

  private composeBlocks(
    brandName: string,
    brandAlias: string,
    popularVehicles: any[],
    popularParts: any[],
    popularGammes: any[],
    relatedBrands: any[],
    blogContent: any,
    rag: BrandRagData,
  ): R7Block[] {
    const blocks: R7Block[] = [];
    const tpl = (key: keyof typeof R7_HEADING_TEMPLATES) =>
      R7_HEADING_TEMPLATES[key].replace(/{brand}/g, brandName);

    // S1_HERO
    blocks.push({
      id: 'R7_S1_HERO',
      type: 'hero',
      title: `Catalogue pièces auto ${brandName}`,
      renderedText: `Trouvez rapidement les pièces adaptées à votre ${brandName} : sélectionnez votre modèle et votre motorisation pour voir uniquement les références compatibles.`,
      specificityWeight: 0.6,
      boilerplateRisk: 0.3,
      semanticPayload: [brandName, 'catalogue', 'pièces auto'],
    });

    // S2_MICRO_SEO (140+ words, brand-specific)
    const microLines: string[] = [];
    microLines.push(
      `${brandName} est un constructeur automobile${rag.country ? ` ${rag.country}` : ''} dont les véhicules sont largement représentés sur le marché français.`,
    );
    if (popularGammes.length > 0) {
      const gammeNames = popularGammes
        .slice(0, 5)
        .map((g) => g.pg_name || g.gamme_name)
        .filter(Boolean);
      if (gammeNames.length > 0) {
        microLines.push(
          `Les familles de pièces les plus demandées pour ${brandName} sont : ${gammeNames.join(', ')}.`,
        );
      }
    }
    if (popularVehicles.length > 0) {
      const modelNames = [
        ...new Set(
          popularVehicles
            .slice(0, 5)
            .map((v) => v.modele_name)
            .filter(Boolean),
        ),
      ];
      if (modelNames.length > 0) {
        microLines.push(
          `Parmi les modèles les plus recherchés : ${modelNames.join(', ')}.`,
        );
      }
    }
    if (rag.common_issues && rag.common_issues.length > 0) {
      microLines.push(
        `Les problèmes fréquemment rencontrés sur les véhicules ${brandName} incluent : ${rag.common_issues.slice(0, 3).join(', ')}.`,
      );
    }
    microLines.push(
      `Notre catalogue couvre l'ensemble des motorisations ${brandName}, de la citadine au véhicule utilitaire. Chaque pièce est vérifiée pour la compatibilité avec votre véhicule précis.`,
    );
    blocks.push({
      id: 'R7_S2_MICRO_SEO',
      type: 'micro_seo',
      title: tpl('R7_S2_MICRO_SEO'),
      renderedText: microLines.join(' '),
      specificityWeight: 0.8,
      boilerplateRisk: 0.15,
      semanticPayload: [brandName, ...(rag.top_models || []).slice(0, 3)],
    });

    // S3_SHORTCUTS (6 internal link cards)
    const shortcuts: string[] = [];
    const topModels = [
      ...new Set(
        popularVehicles
          .slice(0, 3)
          .map((v) => v.modele_name)
          .filter(Boolean),
      ),
    ];
    topModels.forEach((m) =>
      shortcuts.push(
        `- [Pièces ${brandName} ${m}](/constructeurs/${brandAlias}/)`,
      ),
    );
    const topGammes = popularGammes.slice(0, 3);
    topGammes.forEach((g) =>
      shortcuts.push(
        `- [${g.pg_name || g.gamme_name} ${brandName}](/pieces/${g.pg_alias || ''})`,
      ),
    );
    if (shortcuts.length > 0) {
      blocks.push({
        id: 'R7_S3_SHORTCUTS',
        type: 'shortcuts',
        title: 'Accès rapide',
        renderedText: shortcuts.join('\n'),
        specificityWeight: 0.5,
        boilerplateRisk: 0.2,
        semanticPayload: [...topModels, ...topGammes.map((g) => g.pg_alias)],
      });
    }

    // S4_GAMMES (gate: min 3)
    if (
      popularGammes.length >= R7_SECTION_QUALITY_GATES.R7_S4_GAMMES.minItems
    ) {
      const gammeLines = popularGammes
        .slice(0, 8)
        .map(
          (g) =>
            `- **${g.pg_name || g.gamme_name}** — ${g.product_count || 0} références`,
        );
      blocks.push({
        id: 'R7_S4_GAMMES',
        type: 'popular_gammes',
        title: tpl('R7_S4_GAMMES'),
        renderedText: gammeLines.join('\n'),
        specificityWeight: 0.7,
        boilerplateRisk: 0.15,
        semanticPayload: popularGammes
          .slice(0, 5)
          .map((g) => g.pg_alias || g.pg_name),
      });
    }

    // S5_PARTS (gate: min 4)
    if (popularParts.length >= R7_SECTION_QUALITY_GATES.R7_S5_PARTS.minItems) {
      const partLines = popularParts
        .slice(0, 8)
        .map((p) => `- ${p.pg_name} ${brandName}`);
      blocks.push({
        id: 'R7_S5_PARTS',
        type: 'popular_parts',
        title: tpl('R7_S5_PARTS'),
        renderedText: partLines.join('\n'),
        specificityWeight: 0.65,
        boilerplateRisk: 0.2,
        semanticPayload: popularParts.slice(0, 5).map((p) => p.pg_name),
      });
    }

    // S6_VEHICLES (gate: min 2)
    if (
      popularVehicles.length >= R7_SECTION_QUALITY_GATES.R7_S6_VEHICLES.minItems
    ) {
      const vehicleLines = popularVehicles
        .slice(0, 6)
        .map(
          (v) =>
            `- **${v.marque_name || brandName} ${v.modele_name} ${v.type_name || ''}** ${v.type_power_ps ? `(${v.type_power_ps} ch)` : ''}`,
        );
      blocks.push({
        id: 'R7_S6_VEHICLES',
        type: 'popular_vehicles',
        title: tpl('R7_S6_VEHICLES'),
        renderedText: vehicleLines.join('\n'),
        specificityWeight: 0.7,
        boilerplateRisk: 0.15,
        semanticPayload: popularVehicles
          .slice(0, 5)
          .map((v) => `${v.modele_name} ${v.type_name || ''}`),
      });
    }

    // S7_COMPATIBILITY (3-step guide)
    blocks.push({
      id: 'R7_S7_COMPATIBILITY',
      type: 'compatibility_guide',
      title: tpl('R7_S7_COMPATIBILITY'),
      renderedText: [
        `**Étape 1 — Sélectionnez votre modèle** : Choisissez votre modèle ${brandName} dans la liste ci-dessus.`,
        `**Étape 2 — Précisez la motorisation** : Indiquez la cylindrée et la puissance (information sur votre carte grise, champ D.2).`,
        `**Étape 3 — Vérifiez la compatibilité** : Le système affiche uniquement les pièces compatibles avec votre motorisation exacte.`,
        ``,
        `> Astuce : Vérifiez toujours la référence OEM (numéro d'origine constructeur) pour une compatibilité garantie.`,
      ].join('\n'),
      specificityWeight: 0.75,
      boilerplateRisk: 0.2,
      semanticPayload: [
        brandName,
        'compatibilité',
        'motorisation',
        'carte grise',
      ],
    });

    // S8_SAFE_TABLE (maintenance intervals)
    const maintenanceTips = rag.maintenance_tips || [];
    const safeTableLines = [
      '| Pièce | Intervalle recommandé |',
      '|---|---|',
      '| Plaquettes de frein | 30 000 - 50 000 km |',
      '| Disques de frein | 60 000 - 80 000 km |',
      '| Kit de distribution | 80 000 - 120 000 km |',
      '| Filtre à huile | 15 000 - 20 000 km |',
      '| Filtre à air | 20 000 - 40 000 km |',
      '| Amortisseurs | 80 000 - 100 000 km |',
    ];
    if (maintenanceTips.length > 0) {
      safeTableLines.push('', `**Spécificités ${brandName} :**`);
      maintenanceTips
        .slice(0, 3)
        .forEach((tip) => safeTableLines.push(`- ${tip}`));
    }
    blocks.push({
      id: 'R7_S8_SAFE_TABLE',
      type: 'safe_table',
      title: tpl('R7_S8_SAFE_TABLE'),
      renderedText: safeTableLines.join('\n'),
      specificityWeight: maintenanceTips.length > 0 ? 0.7 : 0.5,
      boilerplateRisk: maintenanceTips.length > 0 ? 0.2 : 0.4,
      semanticPayload: [brandName, 'entretien', 'remplacement', 'intervalles'],
    });

    // S9_FAQ (5 Q/R)
    const ragFaqs = rag.faq || [];
    const faqItems: Array<{ q: string; a: string }> = [];
    // Use RAG FAQs first
    ragFaqs.slice(0, 5).forEach((f) => faqItems.push(f));
    // Fill with defaults if needed
    const defaultFaqs = [
      {
        q: `Comment trouver la bonne pièce pour ma ${brandName} ?`,
        a: `Sélectionnez votre modèle ${brandName} et votre motorisation dans notre configurateur. Le système vérifie automatiquement la compatibilité.`,
      },
      {
        q: `Les pièces ${brandName} sont-elles d'origine ?`,
        a: `Nous proposons des pièces OEM et des pièces de qualité équivalente certifiées par les grands équipementiers (Bosch, Valeo, TRW, etc.).`,
      },
      {
        q: `Quels modèles ${brandName} sont couverts ?`,
        a: `Notre catalogue couvre l'ensemble des modèles ${brandName} disponibles sur le marché français.`,
      },
      {
        q: `Comment vérifier la compatibilité d'une pièce ${brandName} ?`,
        a: `Chaque fiche produit affiche les véhicules compatibles. Utilisez le sélecteur de véhicule pour filtrer les pièces adaptées à votre motorisation.`,
      },
      {
        q: `Quel délai de livraison pour les pièces ${brandName} ?`,
        a: `La livraison standard est de 24 à 48h en France métropolitaine.`,
      },
    ];
    while (faqItems.length < 5 && defaultFaqs.length > 0) {
      const next = defaultFaqs.shift();
      if (next && !faqItems.some((f) => f.q === next.q)) {
        faqItems.push(next);
      }
    }
    blocks.push({
      id: 'R7_S9_FAQ',
      type: 'faq',
      title: tpl('R7_S9_FAQ'),
      renderedText: faqItems.map((f) => `**${f.q}**\n${f.a}`).join('\n\n'),
      specificityWeight: ragFaqs.length > 0 ? 0.75 : 0.5,
      boilerplateRisk: ragFaqs.length > 0 ? 0.15 : 0.35,
      semanticPayload: faqItems.map((f) => f.q.slice(0, 30)),
    });

    // S10_RELATED (brand → brand maillage)
    if (relatedBrands.length > 0) {
      const relatedLines = relatedBrands
        .slice(0, 6)
        .map(
          (rb) =>
            `- [Pièces ${rb.marque_name}](/constructeurs/${rb.marque_alias}-${rb.marque_id}.html)`,
        );
      blocks.push({
        id: 'R7_S10_RELATED',
        type: 'related_brands',
        title: 'Autres constructeurs',
        renderedText: relatedLines.join('\n'),
        specificityWeight: 0.4,
        boilerplateRisk: 0.3,
        semanticPayload: relatedBrands.slice(0, 5).map((rb) => rb.marque_name),
      });
    }

    // S11_ABOUT (truncated 800 chars)
    const maxChars = R7_SECTION_QUALITY_GATES.R7_S11_ABOUT.maxChars;
    let aboutText = '';
    if (blogContent?.content) {
      aboutText = blogContent.content
        .replace(/<[^>]*>?/gm, '')
        .trim()
        .slice(0, maxChars);
    } else if (rag.history) {
      aboutText = rag.history.slice(0, maxChars);
    } else {
      aboutText = `${brandName} est un constructeur automobile reconnu sur le marché français et international. AutoMecanik propose l'ensemble des pièces détachées compatibles avec les véhicules ${brandName}.`;
    }
    blocks.push({
      id: 'R7_S11_ABOUT',
      type: 'about',
      title: tpl('R7_S11_ABOUT'),
      renderedText: aboutText,
      specificityWeight: rag.history || blogContent?.content ? 0.6 : 0.35,
      boilerplateRisk: rag.history || blogContent?.content ? 0.2 : 0.5,
      semanticPayload: [brandName, 'constructeur'],
    });

    return blocks;
  }

  // ── Metrics ──

  private computeMetrics(blocks: R7Block[], gammes: any[]) {
    const total = blocks.length;
    const specificBlocks = blocks.filter((b) => b.specificityWeight >= 0.65);
    const boilerplateBlocks = blocks.filter((b) => b.boilerplateRisk >= 0.5);

    const specificContentRatio = total > 0 ? specificBlocks.length / total : 0;
    const boilerplateRatio = total > 0 ? boilerplateBlocks.length / total : 0;

    // Generic phrase detection
    const fullText = blocks
      .map((b) => b.renderedText)
      .join(' ')
      .toLowerCase();
    const genericCount = R7_GENERIC_PHRASES.reduce(
      (count, phrase) => count + (fullText.includes(phrase) ? 1 : 0),
      0,
    );
    const genericPhraseRatio =
      genericCount / Math.max(1, R7_GENERIC_PHRASES.length);

    // Section completeness
    const sectionCompleteness =
      blocks.length >= 9
        ? 90
        : blocks.length >= 7
          ? 75
          : blocks.length >= 5
            ? 55
            : 30;

    // Commercial intent (gammes + parts sections)
    const hasGammes = blocks.some((b) => b.type === 'popular_gammes');
    const hasParts = blocks.some((b) => b.type === 'popular_parts');
    const hasVehicles = blocks.some((b) => b.type === 'popular_vehicles');
    const commercialIntentScore =
      (hasGammes ? 30 : 0) +
      (hasParts ? 30 : 0) +
      (hasVehicles ? 20 : 0) +
      (gammes.length > 5 ? 20 : gammes.length > 0 ? 10 : 0);

    // FAQ quality
    const faqBlock = blocks.find((b) => b.type === 'faq');
    const faqReuseRiskScore =
      faqBlock && faqBlock.specificityWeight < 0.6 ? 50 : 0;

    // Diversity score (weighted)
    const diversityScore = Math.max(
      0,
      Math.min(
        100,
        specificContentRatio * 100 * 0.25 +
          sectionCompleteness * 0.25 +
          commercialIntentScore * 0.2 +
          (100 - genericPhraseRatio * 100) * 0.15 +
          (100 - boilerplateRatio * 100) * 0.15,
      ),
    );

    return {
      specificContentRatio,
      boilerplateRatio,
      diversityScore,
      genericPhraseRatio,
      commercialIntentScore,
      faqReuseRiskScore,
      sectionCompleteness,
    };
  }

  // ── Fingerprints ──

  private computeFingerprints(contentMain: string, blocks: R7Block[]) {
    const normalizedText = contentMain
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    const blockSequence = blocks.map((b) => b.type).join('|');
    const semanticKey = blocks
      .flatMap((b) => b.semanticPayload)
      .sort()
      .join('|');
    const faqBlock = blocks.find((b) => b.type === 'faq');

    return {
      contentFingerprint: this.sha256(contentMain),
      normalizedTextFingerprint: this.sha256(normalizedText),
      blockSequenceFingerprint: this.sha256(blockSequence),
      semanticKeyFingerprint: this.sha256(semanticKey),
      faqSignature: this.sha256(faqBlock?.renderedText || 'NO_FAQ'),
    };
  }

  private sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  // ── Gate ──

  private gate(
    metrics: ReturnType<R7BrandEnricherService['computeMetrics']>,
    blocks: R7Block[],
  ): { decision: R7SeoDecision; reasons: string[]; warnings: string[] } {
    const reasons: string[] = [];
    const warnings: string[] = [];

    // Hard gates
    if (metrics.specificContentRatio < 0.4)
      reasons.push('LOW_SPECIFIC_CONTENT');
    if (metrics.boilerplateRatio > 0.5) reasons.push('HIGH_BOILERPLATE');
    if (metrics.genericPhraseRatio > R7_KP_QUALITY_THRESHOLDS.weakPhraseRatio)
      reasons.push('HIGH_GENERIC_PHRASES');

    // Block presence checks
    const types = new Set(blocks.map((b) => b.type));
    if (!types.has('micro_seo')) reasons.push('MISSING_MICRO_SEO');
    if (!types.has('compatibility_guide')) reasons.push('MISSING_COMPAT_GUIDE');
    if (!types.has('faq')) reasons.push('MISSING_FAQ');

    // Structural failure → REJECT
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
      metrics.diversityScore >= R7_KP_QUALITY_THRESHOLDS.minQualityScore &&
      reasons.length === 0
    ) {
      return { decision: 'PUBLISH', reasons, warnings };
    }

    if (metrics.diversityScore >= R7_KP_QUALITY_THRESHOLDS.minQualityScore) {
      warnings.push(...reasons.map((r) => `gate warning: ${r}`));
      return { decision: 'PUBLISH', reasons, warnings };
    }

    return { decision: 'REVIEW_REQUIRED', reasons, warnings };
  }

  // ── DB Writes ──

  private async upsertPage(params: {
    pageKey: string;
    marqueId: number;
    brandName: string;
    brandAlias: string;
    country: string | null;
    h1: string;
    metaTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    contentMain: string;
    blockPlan: any[];
    renderedBlocks: any[];
    sectionScores: Record<string, number>;
    metrics: ReturnType<R7BrandEnricherService['computeMetrics']>;
    fingerprints: ReturnType<R7BrandEnricherService['computeFingerprints']>;
    decision: R7SeoDecision;
    sitemapRules: { sitemap: boolean; robots: string };
    modelsCount: number;
    gammesCount: number;
    vehiclesCount: number;
  }): Promise<string | null> {
    const row = {
      page_key: params.pageKey,
      page_role: 'R7_BRAND',
      marque_id: params.marqueId,
      marque_name: params.brandName,
      marque_alias: params.brandAlias,
      country: params.country,
      h1: params.h1,
      meta_title: params.metaTitle,
      meta_description: params.metaDescription,
      canonical_url: params.canonicalUrl,
      content_main: params.contentMain,
      block_plan: params.blockPlan,
      rendered_json: { blocks: params.renderedBlocks },
      section_scores: params.sectionScores,
      diversity_score: params.metrics.diversityScore,
      boilerplate_ratio: params.metrics.boilerplateRatio,
      specific_content_ratio: params.metrics.specificContentRatio,
      commercial_intent_score: params.metrics.commercialIntentScore,
      faq_reuse_risk_score: params.metrics.faqReuseRiskScore,
      generic_phrase_ratio: params.metrics.genericPhraseRatio,
      content_fingerprint: params.fingerprints.contentFingerprint,
      faq_signature: params.fingerprints.faqSignature,
      normalized_text_fingerprint:
        params.fingerprints.normalizedTextFingerprint,
      seo_decision: params.decision,
      sitemap_included: params.sitemapRules.sitemap,
      robots_directive: params.sitemapRules.robots,
      models_count: params.modelsCount,
      gammes_count: params.gammesCount,
      vehicles_count: params.vehiclesCount,
      published_at:
        params.decision === 'PUBLISH' ? new Date().toISOString() : null,
    };

    const { data, error } = await this.client
      .from(R7_TABLES.pages)
      .upsert(row, { onConflict: 'page_key' })
      .select('id')
      .single();

    if (error) {
      this.logger.error(`UPSERT ${R7_TABLES.pages} failed: ${error.message}`);
      return null;
    }
    return data?.id || null;
  }

  private async insertVersion(
    pageId: string,
    contentMain: string,
    blockPlan: any[],
    renderedBlocks: any[],
    sectionScores: Record<string, number>,
    metrics: ReturnType<R7BrandEnricherService['computeMetrics']>,
    fingerprints: ReturnType<R7BrandEnricherService['computeFingerprints']>,
    decision: R7SeoDecision,
  ): Promise<void> {
    const { data: existing } = await this.client
      .from(R7_TABLES.versions)
      .select('version_no')
      .eq('page_id', pageId)
      .order('version_no', { ascending: false })
      .limit(1);
    const nextVersion = existing?.[0] ? existing[0].version_no + 1 : 1;

    await this.client.from(R7_TABLES.versions).insert({
      page_id: pageId,
      version_no: nextVersion,
      content_main: contentMain,
      rendered_json: { blocks: renderedBlocks },
      block_plan: blockPlan,
      seo_decision: decision,
      diversity_score: metrics.diversityScore,
      content_fingerprint: fingerprints.contentFingerprint,
      faq_signature: fingerprints.faqSignature,
      section_scores: sectionScores,
    });
  }

  private async insertFingerprints(
    pageId: string,
    pageKey: string,
    fingerprints: ReturnType<R7BrandEnricherService['computeFingerprints']>,
    blocks: R7Block[],
  ): Promise<void> {
    await this.client.from(R7_TABLES.fingerprints).insert({
      page_id: pageId,
      page_key: pageKey,
      content_fingerprint: fingerprints.contentFingerprint,
      normalized_text_fingerprint: fingerprints.normalizedTextFingerprint,
      block_sequence_fingerprint: fingerprints.blockSequenceFingerprint,
      semantic_key_fingerprint: fingerprints.semanticKeyFingerprint,
      faq_signature: fingerprints.faqSignature,
      top_tokens: blocks.flatMap((b) => b.semanticPayload).slice(0, 20),
      block_type_sequence: blocks.map((b) => b.type),
    });
  }

  private async insertRegenerationQueue(
    pageId: string,
    pageKey: string,
    reasons: string[],
  ): Promise<void> {
    await this.client.from(R7_TABLES.queue).insert({
      page_id: pageId,
      page_key: pageKey,
      reason_code: reasons[0] || 'CONTENT_BROKEN',
      reason_details: { all_reasons: reasons },
      status: 'PENDING',
      priority: 100,
    });
  }

  private async insertQaReview(pageId: string): Promise<void> {
    await this.client.from(R7_TABLES.qa).insert({
      page_id: pageId,
      review_status: 'TODO',
      notes: 'Auto-flagged: diversityScore below publish threshold',
    });
  }
}
