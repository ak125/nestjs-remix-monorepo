import { Injectable, Logger, Optional } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { AiContentService } from '../../ai-content/ai-content.service';
import { RagProxyService } from '../../rag-proxy/rag-proxy.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { PageBriefService } from './page-brief.service';
import { EnricherYamlParser } from './enricher-yaml-parser.service';
import { RagSafeDistillService } from './rag-safe-distill.service';
import { R1KeywordPlanGatesService } from './r1-keyword-plan-gates.service';
import { R1_SECTION_CONFIG } from '../../../config/r1-keyword-plan.constants';
import { RAG_SECTION_REQUIREMENTS } from '../../../config/keyword-plan.constants';
import type { PageBrief } from './page-brief.service';
import type {
  R1IntentLockOutput,
  R1SerpPackOutput,
  R1SectionCopyOutput,
  R1GatekeeperOutput,
  R1PipelineResult,
  RagSafePack,
} from '../../../workers/types/content-refresh.types';

// ── RAG Structured Content (parsed from knowledge docs) ──

interface RagStructuredContent {
  /** Full markdown document (raw) */
  rawContent: string;
  /** Parsed YAML frontmatter fields */
  frontmatter: {
    domain_role?: string;
    must_be_true?: string[];
    confusion_with?: string[];
    selection_criteria?: string[];
  };
  /** Extracted markdown sections (0 LLM) */
  sections: {
    howToChoose?: string;
    antiMistakes?: string[];
    symptoms?: string[];
    faq?: Array<{ question: string; answer: string }>;
  };
}

/**
 * R1 Content Pipeline Service — 4-prompt sequential pipeline
 *
 * Principe : RAG = source de verite. Le LLM reformule, il n'invente RIEN.
 *
 * P1: INTENT LOCK → verrouille intention + nuggets → __seo_page_brief
 * P2: SERP PACK → title, meta, H1, H2s → __seo_gamme + sgpg_h1_override
 * P3: SECTION COPY → copy sections R1 → sgpg_* colonnes
 * P4: GATEKEEPER → validation QA + tracabilite RAG → sgpg_is_draft = false si OK
 */
@Injectable()
export class R1ContentPipelineService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    R1ContentPipelineService.name,
  );

  constructor(
    @Optional() private readonly aiContent: AiContentService,
    @Optional() private readonly pageBriefService: PageBriefService,
    @Optional() private readonly ragSafeDistill: RagSafeDistillService,
    private readonly ragProxy: RagProxyService,
    private readonly flags: FeatureFlagsService,
    private readonly yamlParser: EnricherYamlParser,
    private readonly r1KpGates: R1KeywordPlanGatesService,
  ) {
    super();
  }

  /**
   * Run the full 4-prompt R1 pipeline for a single gamme.
   * @param ragSafePack — pre-computed by ContentRefreshProcessor (optional)
   */
  async run(
    pgId: string,
    pgAlias: string,
    gammeName: string,
    ragSafePack?: RagSafePack | null,
  ): Promise<R1PipelineResult> {
    this.logger.log(
      `[R1_PIPELINE] Starting for pgId=${pgId} alias=${pgAlias} gamme=${gammeName}`,
    );

    if (!this.aiContent) {
      throw new Error(
        'R1ContentPipelineService requires AiContentService (LLM_POLISH_ENABLED=true)',
      );
    }

    // ── KP0: Audit existing R1 sections ──
    const audit = await this.r1KpGates.auditR1Sections(pgId);
    if (this.r1KpGates.shouldSkipGamme(audit)) {
      this.logger.log(
        `[KP0] Gamme ${gammeName} already healthy (priority=${audit.priority_score}), skipping R1 pipeline`,
      );
      await this.r1KpGates.upsertR1KeywordPlan(pgId, {
        rkp_pg_alias: pgAlias,
        rkp_gamme_name: gammeName,
        rkp_audit_result: audit,
        rkp_pipeline_phase: 'complete',
        rkp_status: 'validated',
      });
      // Return empty result — existing content is already healthy
      return {
        intentLock: {
          primary_intent: 'transactional',
          forbidden_lexicon: [],
          allowed_lexicon: [],
          confusion_pairs: [],
          writing_constraints: {
            max_words: 520,
            min_words: 350,
            tone: 'expert-accessible',
            person: 'vous',
            zero_diagnostic: true,
            zero_howto: true,
          },
          interest_nuggets: [],
        },
        serpPack: {
          title_main: '',
          title_variants: [],
          meta_main: '',
          meta_variants: [],
          h1: '',
          h2: [],
        },
        sectionCopy: {
          hero_subtitle: '',
          proof_badges: [],
          selector_microcopy: [],
          micro_seo_block: '',
          compatibilities_intro: '',
          equipementiers_line: '',
          faq_selector: [],
          family_cross_sell_intro: '',
        },
        gatekeeper: {
          gate_score: 100,
          gate_status: 'PASS' as const,
          checks: {},
          fixes_applied: [],
          version_clean: 'v0 — KP0 skip (healthy)',
        },
      };
    }
    // Store KP0 audit result
    await this.r1KpGates.upsertR1KeywordPlan(pgId, {
      rkp_pg_alias: pgAlias,
      rkp_gamme_name: gammeName,
      rkp_audit_result: audit,
      rkp_pipeline_phase: 'KP0_AUDIT',
    });

    // ── Étape 0 : Extraction RAG structurée ──
    const ragStructured = await this.fetchStructuredRagContent(
      pgAlias,
      gammeName,
    );

    if (!ragStructured) {
      this.logger.warn(
        `[R1_PIPELINE] No RAG content for ${pgAlias} — aborting pipeline`,
      );
      return {
        intentLock: {
          primary_intent: '',
          forbidden_lexicon: [],
          allowed_lexicon: [],
          confusion_pairs: [],
          writing_constraints: {
            max_words: 520,
            min_words: 350,
            tone: 'expert-accessible',
            person: 'vous',
            zero_diagnostic: true,
            zero_howto: true,
          },
          interest_nuggets: [],
        },
        serpPack: {
          title_main: '',
          title_variants: [],
          meta_main: '',
          meta_variants: [],
          h1: '',
          h2: [],
        },
        sectionCopy: {
          hero_subtitle: '',
          proof_badges: [],
          selector_microcopy: [],
          micro_seo_block: '',
          compatibilities_intro: '',
          equipementiers_line: '',
          faq_selector: [],
          family_cross_sell_intro: '',
        },
        gatekeeper: {
          gate_score: 0,
          gate_status: 'FAIL' as const,
          checks: {},
          fixes_applied: [],
          version_clean: 'v0 — no RAG content',
        },
      };
    }

    // ── RAG sufficiency depth check ──
    const ragCheck = this.validateRagSufficiency(ragStructured);
    if (!ragCheck.sufficient) {
      this.logger.warn(
        `[R1_PIPELINE] RAG insufficient for ${pgAlias}: missing=[${ragCheck.missing.join(', ')}], warnings=[${ragCheck.warnings.join(', ')}]`,
      );
      return {
        intentLock: {
          primary_intent: '',
          forbidden_lexicon: [],
          allowed_lexicon: [],
          confusion_pairs: [],
          writing_constraints: {
            max_words: 520,
            min_words: 350,
            tone: 'expert-accessible',
            person: 'vous',
            zero_diagnostic: true,
            zero_howto: true,
          },
          interest_nuggets: [],
        },
        serpPack: {
          title_main: '',
          title_variants: [],
          meta_main: '',
          meta_variants: [],
          h1: '',
          h2: [],
        },
        sectionCopy: {
          hero_subtitle: '',
          proof_badges: [],
          selector_microcopy: [],
          micro_seo_block: '',
          compatibilities_intro: '',
          equipementiers_line: '',
          faq_selector: [],
          family_cross_sell_intro: '',
        },
        gatekeeper: {
          gate_score: 0,
          gate_status: 'FAIL' as const,
          checks: {},
          fixes_applied: [],
          version_clean: `v0 — RAG insufficient: ${ragCheck.missing.join(', ')}`,
        },
      };
    }
    if (ragCheck.warnings.length > 0) {
      this.logger.log(
        `[R1_PIPELINE] RAG warnings for ${pgAlias}: ${ragCheck.warnings.join('; ')}`,
      );
    }

    // ── Compiler squelette HTML depuis sections RAG (pour P3) ──
    const htmlDraft = this.composeHtmlDraft(gammeName, ragStructured);

    // ── Charger contexte gamme (familyLabel + productCount) ──
    const gammeCtx = await this.fetchGammeContext(pgId);

    // ── Load existing R1 keyword plan for pipeline enrichment (before P1) ──
    let r1HeadingPlan: Record<string, unknown> | null = null;
    let r1SectionTerms: Record<string, unknown> | null = null;
    let r1Boundaries: Record<string, unknown> | null = null;
    let r1QueryClusters: Record<string, unknown> | null = null;
    let r3RiskTerms: string[] = [];
    try {
      const { data: kpRow } = await this.client
        .from('__seo_r1_keyword_plan')
        .select(
          'rkp_heading_plan, rkp_section_terms, rkp_boundaries, rkp_query_clusters, rkp_r3_risk_score, rkp_gate_report',
        )
        .eq('rkp_pg_id', pgId)
        .order('rkp_version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (kpRow) {
        if (kpRow.rkp_heading_plan)
          r1HeadingPlan = kpRow.rkp_heading_plan as Record<string, unknown>;
        if (kpRow.rkp_section_terms)
          r1SectionTerms = kpRow.rkp_section_terms as Record<string, unknown>;
        if (kpRow.rkp_boundaries)
          r1Boundaries = kpRow.rkp_boundaries as Record<string, unknown>;
        if (kpRow.rkp_query_clusters)
          r1QueryClusters = kpRow.rkp_query_clusters as Record<string, unknown>;
        const r3Score = kpRow.rkp_r3_risk_score as number | null;
        if (r3Score != null && r3Score > 0.1) {
          const gateReport = kpRow.rkp_gate_report as Record<
            string,
            { triggerItems?: string[] }
          > | null;
          r3RiskTerms = gateReport?.RG7_R3_RISK?.triggerItems ?? [];
        }
      }
    } catch {
      /* keyword plan enrichment is optional */
    }

    // ── P1: Intent Lock (RAG frontmatter + boundaries + R3 risk terms) ──
    const intentLock = await this.stepIntentLock(
      pgId,
      pgAlias,
      gammeName,
      ragStructured,
      r1Boundaries,
      r3RiskTerms,
    );

    // ── P2: SERP Pack (P1 + RAG + familyLabel + headingPlan + queryClusters) ──
    const serpPack = await this.stepSerpPack(
      pgId,
      gammeName,
      intentLock,
      ragStructured,
      gammeCtx.familyLabel,
      r1HeadingPlan,
      r1QueryClusters,
    );

    // ── Charger le page brief (écrit par P1) pour P3 ──
    let brief: PageBrief | null = null;
    if (this.pageBriefService) {
      try {
        brief = await this.pageBriefService.getActiveBrief(
          parseInt(pgId, 10),
          'R1',
        );
      } catch {
        /* brief optionnel */
      }
    }

    // ── P3: Section Copy (P1 + P2 + RAG + htmlDraft + brief + productCount + sectionTerms) ──
    const sectionCopy = await this.stepSectionCopy(
      pgId,
      gammeName,
      intentLock,
      serpPack,
      ragStructured,
      htmlDraft,
      brief,
      gammeCtx.productCount,
      r1SectionTerms,
    );

    // ── P4: Gatekeeper (P1 + P3 + citations RAG) ──
    const gatekeeper = await this.stepGatekeeper(
      pgId,
      pgAlias,
      gammeName,
      intentLock,
      sectionCopy,
      ragSafePack,
    );

    // ── Post-P4: Persist keyword plan scores ──
    const requiredSections = Object.entries(R1_SECTION_CONFIG).filter(
      ([, def]) => def.required,
    );
    const coverageRatio =
      requiredSections.length > 0
        ? requiredSections.filter(([sid]) => {
            const sectionScore = audit.section_scores?.[sid];
            return sectionScore != null && sectionScore > 0;
          }).length / requiredSections.length
        : 0;

    await this.r1KpGates.upsertR1KeywordPlan(pgId, {
      rkp_pg_alias: pgAlias,
      rkp_gamme_name: gammeName,
      rkp_quality_score: gatekeeper.gate_score,
      rkp_coverage_score: coverageRatio,
      rkp_pipeline_phase: 'complete',
      rkp_status: gatekeeper.gate_status === 'PASS' ? 'active' : 'draft',
    });

    this.logger.log(
      `[R1_PIPELINE] Complete for pgId=${pgId}: score=${gatekeeper.gate_score}, status=${gatekeeper.gate_status}`,
    );

    return { intentLock, serpPack, sectionCopy, gatekeeper };
  }

  // ── P1: Intent Lock ──

  private async stepIntentLock(
    pgId: string,
    pgAlias: string,
    gammeName: string,
    rag: RagStructuredContent,
    boundaries?: Record<string, unknown> | null,
    r3RiskTerms?: string[],
  ): Promise<R1IntentLockOutput> {
    this.logger.debug(`[P1_INTENT_LOCK] pgId=${pgId}`);

    const response = await this.aiContent!.generateContent({
      type: 'r1_intent_lock',
      prompt: `Generate intent lock for gamme: ${gammeName}`,
      context: {
        gammeName,
        ragContent: rag.rawContent.substring(0, 3000),
        frontmatter: rag.frontmatter,
        boundaries: boundaries || null,
        r3RiskTerms: r3RiskTerms || [],
      },
      temperature: 0.3,
      maxLength: 2000,
      useCache: false,
    });

    const parsed = this.parseJsonResponse<R1IntentLockOutput>(
      response.content,
      'P1_INTENT_LOCK',
    );

    // Store in __seo_page_brief + sgpg_interest_nuggets
    await this.storeIntentLock(pgId, pgAlias, gammeName, parsed);

    return parsed;
  }

  // ── P2: SERP Pack ──

  private async stepSerpPack(
    pgId: string,
    gammeName: string,
    intentLock: R1IntentLockOutput,
    rag: RagStructuredContent,
    familyLabel?: string,
    headingPlan?: Record<string, unknown> | null,
    queryClusters?: Record<string, unknown> | null,
  ): Promise<R1SerpPackOutput> {
    this.logger.debug(`[P2_SERP_PACK] pgId=${pgId}`);

    const response = await this.aiContent!.generateContent({
      type: 'r1_serp_pack',
      prompt: `Generate SERP pack for gamme: ${gammeName}`,
      context: {
        gammeName,
        intentLock,
        ragContent: rag.rawContent.substring(0, 2000),
        selectionCriteria: rag.frontmatter.selection_criteria ?? [],
        familyLabel: familyLabel || '',
        ...(headingPlan && { headingPlan }),
        ...(queryClusters && { queryClusters }),
      },
      temperature: 0.5,
      maxLength: 1000,
      useCache: false,
    });

    const parsed = this.parseJsonResponse<R1SerpPackOutput>(
      response.content,
      'P2_SERP_PACK',
    );

    // Store in __seo_gamme + sgpg_h1_override
    await this.storeSerpPack(pgId, parsed);

    return parsed;
  }

  // ── P3: Section Copy ──

  private async stepSectionCopy(
    pgId: string,
    gammeName: string,
    intentLock: R1IntentLockOutput,
    serpPack: R1SerpPackOutput,
    rag: RagStructuredContent,
    htmlDraft?: string,
    brief?: PageBrief | null,
    productCount?: number,
    sectionTerms?: Record<string, unknown> | null,
  ): Promise<R1SectionCopyOutput> {
    this.logger.debug(`[P3_SECTION_COPY] pgId=${pgId}`);

    const response = await this.aiContent!.generateContent({
      type: 'r1_section_copy',
      prompt: `Generate section copy for gamme: ${gammeName}`,
      context: {
        gammeName,
        intentLock,
        serpPack,
        ragContent: rag.rawContent.substring(0, 3000),
        htmlDraft: htmlDraft || '',
        brief: brief
          ? {
              primary_intent: brief.primary_intent,
              forbidden_overlap: brief.forbidden_overlap,
              writing_constraints: brief.writing_constraints,
              termes_techniques: brief.termes_techniques,
            }
          : null,
        productCount: productCount ?? 0,
        sectionTerms: sectionTerms || null,
      },
      temperature: 0.6,
      maxLength: 3000,
      useCache: false,
    });

    const parsed = this.parseJsonResponse<R1SectionCopyOutput>(
      response.content,
      'P3_SECTION_COPY',
    );

    // Store in sgpg_* columns
    await this.storeSectionCopy(pgId, parsed);

    return parsed;
  }

  // ── P4: Gatekeeper ──

  private async stepGatekeeper(
    pgId: string,
    pgAlias: string,
    gammeName: string,
    intentLock: R1IntentLockOutput,
    sectionCopy: R1SectionCopyOutput,
    ragSafePack?: RagSafePack | null,
  ): Promise<R1GatekeeperOutput> {
    this.logger.debug(`[P4_GATEKEEPER] pgId=${pgId}`);

    // Fallback: distill RagSafePack if not pre-computed
    let effectivePack = ragSafePack;
    if (!effectivePack && this.ragSafeDistill) {
      try {
        effectivePack = await this.ragSafeDistill.distill(pgAlias, 'R1_ROUTER');
        this.logger.debug(
          `[P4_GATEKEEPER] Distilled fallback pack: ${effectivePack.citations_used.length} citations`,
        );
      } catch {
        /* fallback: empty citations */
      }
    }

    // Build citations summary for RAG traceability
    const ragCitationsUsed =
      effectivePack?.citations_used?.map((c) => c.text) ?? [];

    const response = await this.aiContent!.generateContent({
      type: 'r1_gatekeeper',
      prompt: `Validate R1 content for gamme: ${gammeName}`,
      context: {
        gammeName,
        intentLock,
        sectionCopy,
        ragCitationsUsed,
      },
      temperature: 0.2,
      maxLength: 1500,
      useCache: false,
    });

    const parsed = this.parseJsonResponse<R1GatekeeperOutput>(
      response.content,
      'P4_GATEKEEPER',
    );

    // Store gatekeeper result + set draft status
    await this.storeGatekeeperResult(pgId, parsed);

    return parsed;
  }

  // ── HTML Draft Compiler (from RAG sections) ──

  private composeHtmlDraft(
    gammeName: string,
    rag: RagStructuredContent,
  ): string {
    const parts: string[] = [];

    if (rag.sections.howToChoose) {
      parts.push(`<h2>Comment choisir vos ${gammeName} ?</h2>`);
      parts.push(`<p>${rag.sections.howToChoose}</p>`);
    }

    if (rag.frontmatter.selection_criteria?.length) {
      parts.push('<ul>');
      for (const c of rag.frontmatter.selection_criteria.slice(0, 4)) {
        parts.push(`<li>${c}</li>`);
      }
      parts.push('</ul>');
    }

    if (rag.sections.antiMistakes?.length) {
      parts.push(`<h2>Erreurs à éviter</h2><ul>`);
      for (const m of rag.sections.antiMistakes.slice(0, 4)) {
        parts.push(`<li>${m}</li>`);
      }
      parts.push('</ul>');
    }

    if (rag.sections.faq?.length) {
      parts.push('<h2>Questions fréquentes</h2>');
      for (const f of rag.sections.faq.slice(0, 4)) {
        parts.push(`<h3>${f.question}</h3><p>${f.answer}</p>`);
      }
    }

    return parts.join('\n') || '';
  }

  // ── Gamme Context (family label + product count) ──

  private async fetchGammeContext(
    pgId: string,
  ): Promise<{ familyLabel: string; productCount: number }> {
    try {
      const supabase = this.client;

      // Family label via pieces_gamme → pieces_family
      const { data: gamme } = await supabase
        .from('pieces_gamme')
        .select('pg_family_id, pieces_family!inner(pf_name)')
        .eq('pg_id', pgId)
        .single();

      // Supabase join returns pieces_family as array or object — extract pf_name safely
      let familyLabel = '';
      if (gamme) {
        const raw = gamme as unknown as Record<string, unknown>;
        const family = raw.pieces_family;
        if (Array.isArray(family) && family.length > 0) {
          familyLabel = String(
            (family[0] as Record<string, unknown>).pf_name ?? '',
          );
        } else if (family && typeof family === 'object') {
          familyLabel = String(
            (family as Record<string, unknown>).pf_name ?? '',
          );
        }
      }

      // Product count for this gamme
      const { count } = await supabase
        .from('__products')
        .select('id', { count: 'exact', head: true })
        .eq('gamme_id', pgId);

      return { familyLabel, productCount: count ?? 0 };
    } catch (err) {
      this.logger.warn(
        `[GAMME_CTX] Failed to fetch context for pgId=${pgId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { familyLabel: '', productCount: 0 };
    }
  }

  // ── RAG Structured Content Fetch ──

  private async fetchStructuredRagContent(
    pgAlias: string,
    gammeName: string,
  ): Promise<RagStructuredContent | null> {
    try {
      const slug = gammeName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // Fetch raw document from RAG knowledge base
      let rawContent: string | null = null;

      const doc = await this.ragProxy.getKnowledgeDoc(`gammes.${slug}`);
      if (doc?.content) {
        rawContent = doc.content;
      } else {
        // Try alias-based lookup
        const docByAlias = await this.ragProxy.getKnowledgeDoc(
          `gammes.${pgAlias}`,
        );
        rawContent = docByAlias?.content ?? null;
      }

      if (!rawContent) return null;

      // Parse YAML frontmatter
      const fmBlock = this.yamlParser.extractFrontmatterBlock(rawContent);
      const frontmatter: RagStructuredContent['frontmatter'] = {};

      if (fmBlock) {
        // Extract structured fields from YAML
        const mustBeTrue = this.yamlParser.extractYamlList(
          fmBlock,
          'must_be_true',
        );
        if (mustBeTrue.length > 0) frontmatter.must_be_true = mustBeTrue;

        const confusionWith = this.yamlParser.extractYamlList(
          fmBlock,
          'confusion_with',
        );
        if (confusionWith.length > 0)
          frontmatter.confusion_with = confusionWith;

        const selectionCriteria = this.yamlParser.extractYamlList(
          fmBlock,
          'selection_criteria',
        );
        if (selectionCriteria.length > 0)
          frontmatter.selection_criteria = selectionCriteria;

        // domain.role — extract via regex (nested YAML key)
        const roleMatch = fmBlock.match(
          /domain[\s\S]*?role:\s*["']?([^"'\n]+)/,
        );
        if (roleMatch?.[1]) frontmatter.domain_role = roleMatch[1].trim();
      }

      // Parse structured sections
      const pageContract = this.yamlParser.parsePageContractYaml(rawContent);
      const faq = this.yamlParser.parseFrontmatterFaq(rawContent);

      const sections: RagStructuredContent['sections'] = {};
      if (pageContract?.howToChoose)
        sections.howToChoose = pageContract.howToChoose;
      if (pageContract?.antiMistakes?.length)
        sections.antiMistakes = pageContract.antiMistakes;
      if (pageContract?.symptoms?.length)
        sections.symptoms = pageContract.symptoms;
      if (faq.length > 0) sections.faq = faq;

      this.logger.log(
        `[RAG] Structured content for ${pgAlias}: fm_keys=${Object.keys(frontmatter).length}, sections=${Object.keys(sections).length}`,
      );

      return { rawContent, frontmatter, sections };
    } catch (err) {
      this.logger.warn(
        `[RAG] Could not fetch structured RAG content for ${pgAlias}/${gammeName}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  // ── RAG Sufficiency Validation ──

  private validateRagSufficiency(rag: RagStructuredContent): {
    sufficient: boolean;
    missing: string[];
    warnings: string[];
  } {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Minimum content length
    if (rag.rawContent.length < 500) {
      missing.push('rawContent < 500 chars');
    }

    // Required YAML frontmatter
    if (!rag.frontmatter.domain_role) {
      missing.push('frontmatter.domain_role');
    }
    if (
      !rag.frontmatter.selection_criteria ||
      rag.frontmatter.selection_criteria.length < 2
    ) {
      missing.push('frontmatter.selection_criteria (need >= 2)');
    }

    // Warnings (non-blocking)
    if (
      !rag.frontmatter.must_be_true ||
      rag.frontmatter.must_be_true.length === 0
    ) {
      warnings.push('frontmatter.must_be_true empty');
    }
    if (!rag.sections.howToChoose) {
      warnings.push('sections.howToChoose missing');
    }
    if (!rag.sections.faq || rag.sections.faq.length < 2) {
      warnings.push('sections.faq insufficient (< 2 items)');
    }

    // Cross-check with RAG_SECTION_REQUIREMENTS (R1→R3 mapping)
    const r1ToR3Map: Record<string, string> = {
      R1_S1_HERO: 'S1',
      R1_S4_MICRO_SEO: 'S3',
      R1_S9_FAQ: 'S8',
    };

    for (const [r1Section, r3Section] of Object.entries(r1ToR3Map)) {
      const reqs = RAG_SECTION_REQUIREMENTS[r3Section];
      if (!reqs) continue;
      for (const req of reqs) {
        const blockValue = this.resolveRagBlock(rag, req.block);
        if (req.checkType === 'non_empty' && !blockValue) {
          warnings.push(`${r1Section} needs RAG block ${req.block}`);
        }
        if (req.checkType === 'list') {
          const items = Array.isArray(blockValue) ? blockValue.length : 0;
          if (items < req.minItems) {
            warnings.push(
              `${r1Section} needs ${req.minItems}+ items in ${req.block} (found ${items})`,
            );
          }
        }
      }
    }

    return { sufficient: missing.length === 0, missing, warnings };
  }

  private resolveRagBlock(rag: RagStructuredContent, block: string): unknown {
    const map: Record<string, unknown> = {
      'domain.role': rag.frontmatter.domain_role,
      'selection.criteria': rag.frontmatter.selection_criteria,
      'selection.anti_mistakes': rag.sections.antiMistakes,
      'diagnostic.symptoms': rag.sections.symptoms,
      'rendering.faq': rag.sections.faq,
      'maintenance.interval': rag.sections.howToChoose,
    };
    return map[block] ?? null;
  }

  // ── DB Storage Methods ──

  private async storeIntentLock(
    pgId: string,
    pgAlias: string,
    gammeName: string,
    data: R1IntentLockOutput,
  ): Promise<void> {
    const supabase = this.client;

    // Upsert into __seo_page_brief (partial unique index on pg_id,page_role WHERE status='active')
    const { error } = await supabase.from('__seo_page_brief').upsert(
      {
        pg_id: pgId,
        pg_alias: pgAlias,
        page_role: 'R1',
        primary_intent: data.primary_intent,
        forbidden_overlap:
          data.forbidden_lexicon ?? data.forbidden_overlap ?? [],
        termes_techniques: data.allowed_lexicon ?? data.termes_techniques ?? [],
        preuves:
          data.interest_nuggets?.map((n) => n.rag_source) ?? data.preuves ?? [],
        writing_constraints: data.writing_constraints,
        overrides_json: {
          allowed_lexicon: data.allowed_lexicon ?? [],
          confusion_pairs: data.confusion_pairs ?? [],
        },
        status: 'active',
        version: 1,
        created_by: 'r1_pipeline',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'pg_id,page_role,version' },
    );

    if (error) {
      this.logger.warn(`[P1] Failed to store intent lock: ${error.message}`);
    }

    // Store interest_nuggets + intent_lock (full P1 JSONB) in purchase guide
    const { error: pgError } = await supabase
      .from('__seo_gamme_purchase_guide')
      .update({
        sgpg_interest_nuggets: data.interest_nuggets,
        sgpg_intent_lock: data,
        sgpg_updated_at: new Date(),
      })
      .eq('sgpg_pg_id', pgId);

    if (pgError) {
      this.logger.warn(
        `[P1] Failed to store interest_nuggets/intent_lock: ${pgError.message}`,
      );
    }
  }

  private async storeSerpPack(
    pgId: string,
    data: R1SerpPackOutput,
  ): Promise<void> {
    const supabase = this.client;
    const h2List = data.h2 ?? data.h2s ?? [];

    // Store in __seo_gamme (draft fields + title_main)
    const { error: seoError } = await supabase
      .from('__seo_gamme')
      .update({
        sg_title_draft: data.title_main,
        sg_content_draft: h2List.map((h2) => `<h2>${h2}</h2>`).join('\n'),
        sg_descrip_draft: data.meta_main,
        sg_draft_source: 'r1_pipeline',
        sg_draft_updated_at: new Date().toISOString(),
      })
      .eq('sg_pg_id', pgId);

    if (seoError) {
      this.logger.warn(
        `[P2] Failed to store SERP pack in __seo_gamme: ${seoError.message}`,
      );
    }

    // Store h1_override + serp_variants in purchase guide
    const { error: pgError } = await supabase
      .from('__seo_gamme_purchase_guide')
      .update({
        sgpg_h1_override: data.h1,
        sgpg_serp_variants: {
          title_variants: data.title_variants ?? [],
          meta_variants: data.meta_variants ?? [],
        },
        sgpg_updated_at: new Date(),
      })
      .eq('sgpg_pg_id', pgId);

    if (pgError) {
      this.logger.warn(`[P2] Failed to store h1_override: ${pgError.message}`);
    }
  }

  private async storeSectionCopy(
    pgId: string,
    data: R1SectionCopyOutput,
  ): Promise<void> {
    const supabase = this.client;

    const { error } = await supabase
      .from('__seo_gamme_purchase_guide')
      .update({
        sgpg_hero_subtitle: data.hero_subtitle,
        sgpg_selector_microcopy: data.selector_microcopy,
        sgpg_micro_seo_block: data.micro_seo_block,
        sgpg_compatibilities_intro: data.compatibilities_intro,
        sgpg_equipementiers_line: data.equipementiers_line,
        sgpg_family_cross_sell_intro: data.family_cross_sell_intro,
        sgpg_faq: data.faq_selector,
        // proof_badges mapped to arg1-4 titles
        ...(data.proof_badges?.[0] && {
          sgpg_arg1_title: data.proof_badges[0],
        }),
        ...(data.proof_badges?.[1] && {
          sgpg_arg2_title: data.proof_badges[1],
        }),
        ...(data.proof_badges?.[2] && {
          sgpg_arg3_title: data.proof_badges[2],
        }),
        ...(data.proof_badges?.[3] && {
          sgpg_arg4_title: data.proof_badges[3],
        }),
        // Store safe_table_rows (normalize how → howToCheck for frontend)
        ...(data.safe_table_rows?.length && {
          sgpg_safe_table_rows: data.safe_table_rows.map(
            (row: Record<string, unknown>) => ({
              element: String(row.element || ''),
              howToCheck: String(row.howToCheck || row.how || ''),
              icon: row.icon || null,
            }),
          ),
        }),
        ...(data.visual_plan && {
          sgpg_visual_plan: data.visual_plan,
        }),
        sgpg_updated_at: new Date(),
      })
      .eq('sgpg_pg_id', pgId);

    if (error) {
      this.logger.warn(`[P3] Failed to store section copy: ${error.message}`);
    }
  }

  private async storeGatekeeperResult(
    pgId: string,
    data: R1GatekeeperOutput,
  ): Promise<void> {
    const supabase = this.client;

    const score = data.gate_score ?? data.score ?? 0;
    const isDraftResolved =
      data.gate_status === 'PASS' || (score >= 80 && !data.flags?.length);

    // Extract flag names from rich checks for backward compat
    const flagNames: string[] = data.flags ?? [];
    if (data.checks && typeof data.checks === 'object') {
      for (const [key, val] of Object.entries(data.checks)) {
        if (
          val &&
          typeof val === 'object' &&
          'status' in val &&
          (val as Record<string, unknown>).status !== 'PASS'
        ) {
          flagNames.push(key);
        }
      }
    }

    const { error } = await supabase
      .from('__seo_gamme_purchase_guide')
      .update({
        sgpg_gatekeeper_score: score,
        sgpg_gatekeeper_flags: flagNames,
        sgpg_gatekeeper_checks: {
          checks: data.checks ?? {},
          fixes_applied: data.fixes_applied ?? [],
          version_clean: data.version_clean ?? '',
          gate_status: data.gate_status ?? (isDraftResolved ? 'PASS' : 'FAIL'),
        },
        sgpg_is_draft: !isDraftResolved,
        sgpg_updated_at: new Date(),
      })
      .eq('sgpg_pg_id', pgId);

    if (error) {
      this.logger.warn(
        `[P4] Failed to store gatekeeper result: ${error.message}`,
      );
    }

    this.logger.log(
      `[P4] pgId=${pgId}: score=${score}, draft=${!isDraftResolved}, status=${data.gate_status ?? 'N/A'}`,
    );
  }

  // ── JSON Parser ──

  private parseJsonResponse<T>(raw: string, step: string): T {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '');
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch (err) {
      this.logger.error(
        `[${step}] Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.logger.debug(`[${step}] Raw response: ${raw.substring(0, 500)}`);
      throw new Error(`${step}: Invalid JSON response from LLM`);
    }
  }
}
