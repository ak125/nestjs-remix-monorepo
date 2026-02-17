import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RagProxyService } from '../../rag-proxy/rag-proxy.service';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  SelectionCriterionSchema,
  DecisionNodeSchema,
  UseCaseSchema,
  type SectionResult,
  type EnrichmentResult,
} from '../dto/buying-guide-enrich.dto';
import type { GammeContentQualityFlag } from '../../gamme-rest/services/buying-guide-data.service';

// ── Quality gate constants (mirrored from buying-guide-data.service.ts) ──

const MIN_NARRATIVE_LENGTH = 40;
const MAX_NARRATIVE_LENGTH = 420;

const GENERIC_PHRASES = [
  'rôle essentiel',
  'entretien régulier',
  'pièce importante',
  'bon fonctionnement',
  'il est recommandé',
  'il est conseillé',
  'en bon état',
  'pièce indispensable',
];

const FAMILY_REQUIRED_TERMS: Record<string, string[]> = {
  freinage: ['frein', 'freinage', 'distance', 'sécurité'],
  moteur: ['moteur', 'combustion', 'lubrification', 'fiabilité'],
  suspension: ['suspension', 'stabilité', 'amortissement', 'tenue'],
  transmission: ['transmission', 'couple', 'embrayage', 'motricité'],
  electrique: ['électrique', 'charge', 'alimentation', 'batterie'],
  climatisation: ['climatisation', 'froid', 'pression', 'compresseur'],
};

const FLAG_PENALTIES: Record<GammeContentQualityFlag, number> = {
  GENERIC_PHRASES: 18,
  MISSING_REQUIRED_TERMS: 16,
  TOO_SHORT: 10,
  TOO_LONG: 8,
  FAQ_TOO_SMALL: 14,
  SYMPTOMS_TOO_SMALL: 12,
  DUPLICATE_ITEMS: 8,
  MISSING_SOURCE_PROVENANCE: 20,
  INTRO_ROLE_MISMATCH: 25,
};

const FAMILY_MARKERS: Record<string, string[]> = {
  freinage: ['frein', 'disque', 'plaquette', 'étrier', 'abs'],
  moteur: ['moteur', 'injecteur', 'distribution', 'lubrification'],
  suspension: ['suspension', 'amortisseur', 'coupelle', 'ressort'],
  transmission: ['embrayage', 'cardan', 'boîte', 'transmission'],
  electrique: ['alternateur', 'batterie', 'démarreur', 'électrique'],
  climatisation: ['climatisation', 'compresseur', 'condenseur', 'évaporateur'],
};

const ACTION_MARKERS = [
  'vérifier',
  'contrôler',
  'choisir',
  'comparer',
  'identifier',
  'confirmer',
  'mesurer',
  'valider',
  'respecter',
  'remplacer',
  'éviter',
  'filtrer',
  'sélectionner',
];

// Min thresholds for anti-wiki gate
const MIN_SELECTION_CRITERIA = 5;
const MIN_ANTI_MISTAKES = 4;
const MIN_DECISION_NODES = 1;
const MIN_FAQS = 3;
const MIN_SYMPTOMS = 3;

// RAG confidence threshold
const MIN_VERIFIED_CONFIDENCE = 0.8;
const MIN_QUALITY_SCORE = 70;

interface SectionValidationResult {
  ok: boolean;
  flags: GammeContentQualityFlag[];
  content: unknown;
  sources: string[];
  confidence: number;
  sourcesCitation: string;
  rawAnswer: string;
}

export interface EnrichDryRunSection {
  content: unknown;
  sources: string[];
  confidence: number;
  flags: GammeContentQualityFlag[];
  ok: boolean;
  rawAnswer: string;
}

export interface EnrichDryRunResult {
  pgId: string;
  gammeName: string;
  family: string;
  sections: Record<string, EnrichDryRunSection>;
  qualityScore: number;
  qualityFlags: GammeContentQualityFlag[];
  antiWikiGate: { ok: boolean; reasons: string[] };
  wouldUpdate: boolean;
}

@Injectable()
export class BuyingGuideEnricherService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    BuyingGuideEnricherService.name,
  );

  constructor(
    configService: ConfigService,
    private readonly ragService: RagProxyService,
  ) {
    super(configService);
  }

  /**
   * Enrich one or more buying guides using RAG-sourced content.
   * dryRun=true → returns preview with quality gates
   * dryRun=false → writes to DB
   */
  async enrich(
    pgIds: string[],
    dryRun: boolean,
  ): Promise<(EnrichmentResult | EnrichDryRunResult)[]> {
    const results: (EnrichmentResult | EnrichDryRunResult)[] = [];

    for (const pgId of pgIds) {
      try {
        const result = await this.enrichSingle(pgId, dryRun);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Failed to enrich pgId=${pgId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (dryRun) {
          results.push({
            pgId,
            gammeName: '',
            family: '',
            sections: {},
            qualityScore: 0,
            qualityFlags: [],
            antiWikiGate: {
              ok: false,
              reasons: [
                `ERROR: ${error instanceof Error ? error.message : String(error)}`,
              ],
            },
            wouldUpdate: false,
          } satisfies EnrichDryRunResult);
        }
      }
    }

    return results;
  }

  private async enrichSingle(
    pgId: string,
    dryRun: boolean,
  ): Promise<EnrichmentResult | EnrichDryRunResult> {
    // 1. Fetch gamme metadata
    const meta = await this.fetchGammeMetadata(pgId);
    if (!meta) {
      throw new Error(`Gamme not found for pgId=${pgId}`);
    }
    const { gammeName, family } = meta;

    this.logger.log(
      `Enriching pgId=${pgId} (${gammeName}, family=${family}) dryRun=${dryRun}`,
    );

    // 2. Enrich from RAG: search + parse markdown (0 LLM)
    const sectionResults = await this.enrichFromRag(gammeName, family);

    // 3. Calculate quality score
    const allFlags: GammeContentQualityFlag[] = [];
    for (const result of Object.values(sectionResults)) {
      allFlags.push(...result.flags);
    }
    const uniqueFlags = [...new Set(allFlags)];
    const penalty = uniqueFlags.reduce(
      (sum, flag) => sum + (FLAG_PENALTIES[flag] || 0),
      0,
    );
    const qualityScore = Math.max(0, 100 - penalty);

    // 4. Anti-wiki gate check
    const antiWikiGate = this.checkAntiWikiGate(sectionResults);

    // 5. DryRun → return preview
    if (dryRun) {
      const dryRunSections: Record<string, EnrichDryRunSection> = {};
      for (const [key, result] of Object.entries(sectionResults)) {
        dryRunSections[key] = {
          content: result.content,
          sources: result.sources,
          confidence: result.confidence,
          flags: result.flags,
          ok: result.ok,
          rawAnswer: result.rawAnswer,
        };
      }

      return {
        pgId,
        gammeName,
        family,
        sections: dryRunSections,
        qualityScore,
        qualityFlags: uniqueFlags,
        antiWikiGate,
        wouldUpdate: qualityScore >= MIN_QUALITY_SCORE && antiWikiGate.ok,
      } satisfies EnrichDryRunResult;
    }

    // 6. Write to DB
    const okSections = Object.entries(sectionResults).filter(([, r]) => r.ok);
    const skippedSections = Object.entries(sectionResults)
      .filter(([, r]) => !r.ok)
      .map(([key]) => key);

    if (okSections.length === 0) {
      return {
        pgId,
        sections: {},
        averageConfidence: 0,
        updated: false,
        sectionsUpdated: 0,
        skippedSections: Object.keys(sectionResults),
      };
    }

    // Build sources URI from all successful sections
    const allSources = okSections.flatMap(([, r]) => r.sources);
    const uniqueSources = [...new Set(allSources)];
    const sourceUri = 'rag://' + uniqueSources.slice(0, 10).join('+');
    const allCitations = okSections
      .map(([, r]) => r.sourcesCitation)
      .filter(Boolean);
    const sourceRef = allCitations.join(' | ');
    const avgConfidence =
      okSections.reduce((sum, [, r]) => sum + r.confidence, 0) /
      okSections.length;

    // Build update payload
    const updatePayload = this.buildUpdatePayload(
      sectionResults,
      sourceUri,
      sourceRef,
      avgConfidence,
      qualityScore,
    );

    // Guard: skip intro_role write if content describes a different piece
    if (
      typeof updatePayload.sgpg_intro_role === 'string' &&
      this.isIntroRoleMismatch(
        updatePayload.sgpg_intro_role as string,
        gammeName,
      )
    ) {
      this.logger.warn(
        `INTRO_ROLE_MISMATCH for pgId=${pgId}: intro_role describes different piece than "${gammeName}", skipping intro_role write`,
      );
      delete updatePayload.sgpg_intro_role;
    }

    await this.upsertBuyingGuide(pgId, updatePayload);

    const resultSections: Record<string, SectionResult> = {};
    for (const [key, result] of Object.entries(sectionResults)) {
      resultSections[key] = {
        content: result.content,
        sources: result.sources,
        confidence: result.confidence,
        sourcesCitation: result.sourcesCitation,
      };
    }

    return {
      pgId,
      sections: resultSections,
      averageConfidence: avgConfidence,
      updated: true,
      sectionsUpdated: okSections.length,
      skippedSections,
    };
  }

  // ── RAG Direct: fetch full docs + parse markdown (0 LLM) ──

  private async enrichFromRag(
    gammeName: string,
    family: string,
  ): Promise<Record<string, SectionValidationResult>> {
    const results: Record<string, SectionValidationResult> = {};

    // Build slug from gamme name: "Disque de frein" → "disque-de-frein"
    const slug = gammeName
      .toLowerCase()
      .replace(/['']/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Fetch full documents via RAG knowledge API (not chunked)
    let gammeContent = '';
    let guideContent = '';
    const sources: string[] = [];

    try {
      const gammeDoc = await this.ragService.getKnowledgeDoc(`gammes.${slug}`);
      gammeContent = gammeDoc.content || '';
      sources.push(gammeDoc.source_path);
      this.logger.log(
        `Loaded gamme doc: gammes.${slug} (${gammeContent.length} chars, truth=${gammeDoc.truth_level})`,
      );
      // Language filter
      if (this.isNonFrenchContent(gammeContent)) {
        this.logger.warn(`Skipping non-French gamme doc: gammes.${slug}`);
        gammeContent = '';
      }
    } catch (error) {
      this.logger.warn(
        `Gamme doc gammes.${slug} not found: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Guide doc slug doesn't always match gamme slug
    // e.g. "disque-de-frein" → "choisir-disques-frein", "plaquette-de-frein" → "choisir-plaquettes"
    const guideDocId = await this.findGuideDocId(slug);
    if (guideDocId) {
      try {
        const guideDoc = await this.ragService.getKnowledgeDoc(guideDocId);
        guideContent = guideDoc.content || '';
        sources.push(guideDoc.source_path);
        this.logger.log(
          `Loaded guide doc: ${guideDocId} (${guideContent.length} chars, truth=${guideDoc.truth_level})`,
        );
        // Language filter
        if (this.isNonFrenchContent(guideContent)) {
          this.logger.warn(`Skipping non-French guide doc: ${guideDocId}`);
          guideContent = '';
        }
      } catch (error) {
        this.logger.warn(
          `Guide doc ${guideDocId} fetch failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      this.logger.warn(`No guide doc found for slug=${slug}`);
    }

    if (!gammeContent && !guideContent) {
      this.logger.warn(`No knowledge docs found for ${gammeName}`);
      const empty = this.failedSection('all', 'No knowledge docs found');
      return {
        anti_mistakes: empty,
        selection_criteria: empty,
        decision_tree: empty,
        use_cases: empty,
      };
    }

    // Merge full document contents
    const allContent = [gammeContent, guideContent]
      .filter(Boolean)
      .join('\n\n');
    const confidence = 1.0; // Full verified docs, not search results
    const citation = sources.join(' + ');

    this.logger.log(
      `RAG knowledge docs loaded: ${allContent.length} chars, sources=[${sources.join(', ')}]`,
    );

    // ── Extract anti_mistakes ──
    const errorsSection = this.extractSection(allContent, 'Erreurs a eviter');
    const antiMistakes = errorsSection
      ? this.extractBulletList(errorsSection)
      : [];
    // Also look for "Erreurs à éviter" with accent
    if (antiMistakes.length === 0) {
      const errorsAlt = this.extractSection(allContent, 'Erreurs à éviter');
      if (errorsAlt) antiMistakes.push(...this.extractBulletList(errorsAlt));
    }
    // Merge items from "Solutions" section (complementary maintenance actions)
    const solutionsSection =
      this.extractSection(allContent, 'Solutions') ||
      this.extractSection(allContent, 'Solutions (par ordre');
    if (solutionsSection) {
      const solutionItems = this.extractBulletList(solutionsSection);
      for (const item of solutionItems) {
        if (
          !antiMistakes.some(
            (existing) => existing.toLowerCase() === item.toLowerCase(),
          )
        ) {
          antiMistakes.push(item);
        }
      }
    }
    const antiMistakesValidation = this.validateSection(
      'anti_mistakes',
      antiMistakes,
      family,
    );
    results['anti_mistakes'] = {
      ok: antiMistakesValidation.ok && antiMistakes.length >= MIN_ANTI_MISTAKES,
      flags: antiMistakesValidation.flags,
      content: antiMistakes,
      sources,
      confidence,
      sourcesCitation: citation,
      rawAnswer: errorsSection || '',
    };

    // ── Extract selection_criteria ──
    const checklistSection = this.extractSection(
      allContent,
      'Check-list compatibilite',
    );
    const checklistAlt = this.extractSection(
      allContent,
      'Check-list compatibilité',
    );
    const checklistItems = this.extractBulletList(
      checklistSection || checklistAlt || '',
    );
    const selectionCriteria = this.buildCriteriaFromCheckList(checklistItems);
    const criteriaValidation = this.validateSection(
      'selection_criteria',
      selectionCriteria,
      family,
    );
    results['selection_criteria'] = {
      ok:
        criteriaValidation.ok &&
        selectionCriteria.length >= MIN_SELECTION_CRITERIA,
      flags: criteriaValidation.flags,
      content: selectionCriteria,
      sources,
      confidence,
      sourcesCitation: citation,
      rawAnswer: checklistSection || checklistAlt || '',
    };

    // ── Extract decision_tree ──
    const replaceSection = this.extractSection(
      allContent,
      'Quand remplacer immediatement',
    );
    const replaceAlt = this.extractSection(
      allContent,
      'Quand remplacer immédiatement',
    );
    const testsSection = this.extractSection(
      allContent,
      'Tests simples (sans outil)',
    );
    const testsAtelierSection = this.extractSection(
      allContent,
      'Tests atelier',
    );
    const decisionTree = this.buildDecisionTree(
      replaceSection || replaceAlt || '',
      testsSection || '',
      testsAtelierSection || '',
    );
    const treeValidation = this.validateSection(
      'decision_tree',
      decisionTree,
      family,
    );
    results['decision_tree'] = {
      ok: treeValidation.ok && decisionTree.length >= MIN_DECISION_NODES,
      flags: treeValidation.flags,
      content: decisionTree,
      sources,
      confidence,
      sourcesCitation: citation,
      rawAnswer: replaceSection || replaceAlt || '',
    };

    // ── Extract use_cases ──
    // Priority 1: Driver profile headings (preferred by BuyingGuideContract)
    const profileHeadings = [
      { id: 'city', heading: 'Conduite urbaine' },
      { id: 'highway', heading: 'Route et autoroute' },
      { id: 'mountain', heading: 'Montagne et charge' },
      { id: 'sport', heading: 'Conduite sportive' },
    ];
    let useCases: z.infer<typeof UseCaseSchema>[] = [];
    let useCasesRaw = '';
    for (const profile of profileHeadings) {
      const section = this.extractSection(allContent, profile.heading);
      if (section) {
        const advantages = this.extractSubSection(section, 'Avantages') || '';
        const inconvenients =
          this.extractSubSection(section, 'Inconvenients') ||
          this.extractSubSection(section, 'Inconvénients') ||
          '';
        useCases.push({
          id: profile.id,
          label: profile.heading,
          recommendation: [advantages, inconvenients]
            .filter(Boolean)
            .join('. ')
            .trim(),
        });
        useCasesRaw += section + '\n';
      }
    }

    // Priority 2 (fallback): Product type headings (legacy)
    if (useCases.length < 2) {
      const percesSection = this.extractSection(allContent, 'Disques perces');
      const percesAlt = this.extractSection(allContent, 'Disques percés');
      const rainuresSection = this.extractSection(
        allContent,
        'Disques rainures',
      );
      const rainuresAlt = this.extractSection(allContent, 'Disques rainurés');
      const standardSection = this.extractSection(
        allContent,
        'Disques pleins/ventiles standard',
      );
      const standardAlt = this.extractSection(
        allContent,
        'Disques pleins/ventilés standard',
      );
      useCases = this.buildUseCases(
        percesSection || percesAlt || '',
        rainuresSection || rainuresAlt || '',
        standardSection || standardAlt || '',
      );
      useCasesRaw =
        (percesSection || percesAlt || '') +
        '\n' +
        (rainuresSection || rainuresAlt || '') +
        '\n' +
        (standardSection || standardAlt || '');
    }

    const useCasesValidation = this.validateSection(
      'use_cases',
      useCases,
      family,
    );
    results['use_cases'] = {
      ok: useCasesValidation.ok && useCases.length >= 2,
      flags: useCasesValidation.flags,
      content: useCases,
      sources,
      confidence,
      sourcesCitation: citation,
      rawAnswer: useCasesRaw,
    };

    // ── Extract FAQ ──
    const guideFaqs = this.extractFaqFromMarkdown(guideContent);
    const fmFaqs = this.parseFrontmatterFaq(gammeContent);
    const allFaqs = [...guideFaqs];
    for (const faq of fmFaqs) {
      if (
        !allFaqs.some(
          (f) => f.question.toLowerCase() === faq.question.toLowerCase(),
        )
      ) {
        allFaqs.push(faq);
      }
    }
    const faqValidation = this.validateSection('faq', allFaqs, family);
    results['faq'] = {
      ok: faqValidation.ok && allFaqs.length >= MIN_FAQS,
      flags: faqValidation.flags,
      content: allFaqs,
      sources,
      confidence,
      sourcesCitation: citation,
      rawAnswer: guideFaqs
        .map((f) => `${f.question}\n${f.answer}`)
        .join('\n\n'),
    };

    return results;
  }

  // ── Guide doc ID resolver ──

  /**
   * Find the guide doc ID for a gamme slug by trying multiple variants.
   * Guide docs don't follow a deterministic pattern from gamme names:
   *  - "disque-de-frein" → "guides.choisir-disques-frein" (pluralized, no "de")
   *  - "plaquette-de-frein" → "guides.choisir-plaquettes" (shortened)
   *  - "courroie-de-distribution" → "guides.choisir-courroie-distribution" (no "de")
   *  - "amortisseur" → "guides.choisir-amortisseurs" (pluralized)
   */
  private async findGuideDocId(slug: string): Promise<string | null> {
    // Generate slug variants to try
    const variants: string[] = [
      slug, // exact: choisir-disque-de-frein
      slug.replace(/-de-|-du-|-des-|-d-|-la-|-le-|-les-|-l-/g, '-'), // drop articles: choisir-disque-frein
    ];

    // Pluralized variants (add 's' to first word)
    const parts = slug.split('-');
    if (parts.length > 0 && !parts[0].endsWith('s')) {
      variants.push(parts[0] + 's-' + parts.slice(1).join('-')); // disques-de-frein
      variants.push(
        (parts[0] + 's-' + parts.slice(1).join('-')).replace(
          /-de-|-du-|-des-|-d-|-la-|-le-|-les-|-l-/g,
          '-',
        ),
      ); // disques-frein
      variants.push(parts[0] + 's'); // disques (shortened)
    }

    // Also try just the first word (for short names like "plaquette" → "plaquettes")
    if (parts.length > 1) {
      variants.push(parts[0]); // disque
      if (!parts[0].endsWith('s')) {
        variants.push(parts[0] + 's'); // plaquettes
      }
    }

    // Deduplicate and clean
    const uniqueVariants = [
      ...new Set(
        variants
          .map((v) => v.replace(/--+/g, '-').replace(/^-|-$/g, ''))
          .filter(Boolean),
      ),
    ];

    // Try each variant as guides.choisir-{variant}
    for (const variant of uniqueVariants) {
      const docId = `guides.choisir-${variant}`;
      try {
        await this.ragService.getKnowledgeDoc(docId);
        this.logger.log(`Found guide doc: ${docId} (variant: ${variant})`);
        return docId;
      } catch {
        // Not found, try next
      }
    }

    // Fallback: list all guide docs and fuzzy match
    try {
      const guideDocs = await this.ragService.listKnowledgeDocs('guides.');
      const slugWords = slug
        .replace(/-/g, ' ')
        .split(' ')
        .filter((w) => w.length > 2);

      let bestMatch: string | null = null;
      let bestScore = 0;

      for (const docId of guideDocs) {
        if (!docId.startsWith('guides.choisir-')) continue;
        const docSlug = docId.replace('guides.choisir-', '');
        const docWords = docSlug.split('-');

        // Score = number of shared significant words
        const score = slugWords.filter((w) =>
          docWords.some((dw) => dw.startsWith(w) || w.startsWith(dw)),
        ).length;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = docId;
        }
      }

      if (bestMatch && bestScore >= 1) {
        this.logger.log(
          `Fuzzy matched guide doc: ${bestMatch} (score=${bestScore})`,
        );
        return bestMatch;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to list guide docs for fuzzy match: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return null;
  }

  // ── YAML frontmatter parsers ──

  /**
   * Extract a flat list of strings from YAML frontmatter.
   * Looks for a key like "antiMistakes:" and collects indented "- item" lines.
   */
  private parseFrontmatterList(content: string, key: string): string[] {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return [];
    const fmBlock = fmMatch[1];
    const keyIdx = fmBlock.indexOf(`${key}:`);
    if (keyIdx < 0) return [];
    const afterKey = fmBlock.substring(keyIdx);
    const lines = afterKey.split('\n').slice(1); // skip the key line itself
    const items: string[] = [];
    for (const line of lines) {
      const m = line.match(/^\s+-\s+(.+)/);
      if (m) {
        items.push(m[1].trim());
      } else if (line.trim() && !line.match(/^\s/)) {
        break; // next top-level key
      }
    }
    return items;
  }

  /**
   * Extract FAQ items ({question, answer}) from YAML frontmatter.
   * Expects structure: faq:\n  - question: ...\n    answer: ...
   */
  private parseFrontmatterFaq(
    content: string,
  ): Array<{ question: string; answer: string }> {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return [];
    const fmBlock = fmMatch[1];
    const faqIdx = fmBlock.indexOf('faq:');
    if (faqIdx < 0) return [];
    const faqs: Array<{ question: string; answer: string }> = [];
    const afterFaq = fmBlock.substring(faqIdx);
    const lines = afterFaq.split('\n').slice(1);
    let currentQ = '';
    let currentA = '';
    for (const line of lines) {
      const qMatch = line.match(/^\s+-\s+question:\s+(.+)/);
      const aMatch = line.match(/^\s+answer:\s+(.+)/);
      if (qMatch) {
        if (currentQ && currentA) {
          faqs.push({ question: currentQ, answer: currentA });
        }
        currentQ = qMatch[1].trim().replace(/^['"]|['"]$/g, '');
        currentA = '';
      } else if (aMatch) {
        currentA = aMatch[1].trim().replace(/^['"]|['"]$/g, '');
      } else if (line.trim() && !line.match(/^\s/)) {
        break; // next top-level key
      }
    }
    if (currentQ && currentA) {
      faqs.push({ question: currentQ, answer: currentA });
    }
    return faqs;
  }

  // ── Language filter ──

  /**
   * Detect if content is non-French using frontmatter lang tag + English heuristic.
   */
  private isNonFrenchContent(content: string): boolean {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const langMatch = fmMatch[1].match(/^lang:\s*(\w+)/m);
      if (langMatch && langMatch[1] !== 'fr') return true;
    }
    const sample = content.substring(0, 500).toLowerCase();
    const enMarkers = [
      'the ',
      'this ',
      'with ',
      ' and ',
      'for ',
      'operation manual',
      'brake system',
    ];
    const enScore = enMarkers.filter((m) => sample.includes(m)).length;
    return enScore >= 3;
  }

  // ── Markdown section parsers ──

  /**
   * Extract FAQ items from markdown guide docs.
   * Matches ### headings ending with "?" and collects answer paragraphs.
   */
  private extractFaqFromMarkdown(
    markdown: string,
  ): Array<{ question: string; answer: string }> {
    const faqs: Array<{ question: string; answer: string }> = [];
    if (!markdown) return faqs;
    const lines = markdown.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^###\s+(.+\?)\s*$/);
      if (!match) continue;
      const question = match[1].trim();
      const answerLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^#{1,3}\s+/)) break;
        const trimmed = lines[j].trim();
        if (trimmed) answerLines.push(trimmed);
      }
      const answer = answerLines.join(' ');
      if (question.length >= 10 && answer.length >= 20) {
        faqs.push({ question, answer });
      }
    }
    return faqs;
  }

  private extractSection(markdown: string, heading: string): string | null {
    // Match ## or ### heading (case-insensitive, accent-insensitive)
    const lines = markdown.split('\n');
    const headingLower = heading.toLowerCase();
    let startIdx = -1;
    let headingLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,3})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        if (level < 2) continue; // skip h1 for heading search
        const title = match[2].trim().toLowerCase();
        if (title.includes(headingLower) || headingLower.includes(title)) {
          startIdx = i + 1;
          headingLevel = level;
          break;
        }
      }
    }

    if (startIdx < 0) return null;

    // Collect until next heading of same or higher level (including h1)
    const sectionLines: string[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,3})\s+/);
      if (match && match[1].length <= headingLevel) break;
      sectionLines.push(line);
    }

    const content = sectionLines.join('\n').trim();
    return content || null;
  }

  private extractBulletList(section: string): string[] {
    return section
      .split('\n')
      .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter((line) => line.length >= 10);
  }

  private buildCriteriaFromCheckList(
    items: string[],
  ): z.infer<typeof SelectionCriterionSchema>[] {
    return items.map((item, i) => {
      const key = item
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 30);
      // First 5 items are "required", rest are "recommended"
      const priority: 'required' | 'recommended' =
        i < 5 ? 'required' : 'recommended';
      return {
        key: key || `criterion_${i + 1}`,
        label: item.split('.')[0].split(':')[0].trim(),
        guidance: item,
        priority,
      };
    });
  }

  private buildDecisionTree(
    replaceSection: string,
    testsSection: string,
    testsAtelierSection: string,
  ): z.infer<typeof DecisionNodeSchema>[] {
    const nodes: z.infer<typeof DecisionNodeSchema>[] = [];

    // Node 1: Visual inspection (from tests simples)
    const simpleTests = this.extractBulletList(testsSection);
    if (simpleTests.length > 0) {
      nodes.push({
        id: 'step-visual',
        question: 'Inspection visuelle et tests simples sans outil',
        options: [
          {
            label: 'Anomalie visible',
            outcome: 'check' as const,
            nextId: 'step-atelier',
            note: simpleTests.join('. '),
          },
          {
            label: 'Aucune anomalie visible',
            outcome: 'continue' as const,
            nextId: 'step-atelier',
          },
        ],
      });
    }

    // Node 2: Workshop tests (from tests atelier)
    const atelierTests = this.extractBulletList(testsAtelierSection);
    if (atelierTests.length > 0) {
      nodes.push({
        id: 'step-atelier',
        question: 'Tests atelier avec outils de mesure',
        options: [
          {
            label: 'Mesures hors tolerance',
            outcome: 'replace' as const,
            note: atelierTests.join('. '),
          },
          {
            label: 'Mesures conformes',
            outcome: 'stop' as const,
            note: 'Piece encore en bon etat de service.',
          },
        ],
      });
    }

    // Node 3: Immediate replacement criteria
    const replaceCriteria = this.extractBulletList(replaceSection);
    if (replaceCriteria.length > 0) {
      nodes.push({
        id: 'step-urgence',
        question: 'Criteres de remplacement immediat (securite)',
        options: [
          {
            label: 'Un ou plusieurs criteres presents',
            outcome: 'replace' as const,
            note: replaceCriteria.join('. '),
          },
          {
            label: 'Aucun critere de remplacement immediat',
            outcome: 'continue' as const,
            nextId: 'step-visual',
          },
        ],
      });
    }

    return nodes;
  }

  private buildUseCases(
    percesSection: string,
    rainuresSection: string,
    standardSection: string,
  ): z.infer<typeof UseCaseSchema>[] {
    const useCases: z.infer<typeof UseCaseSchema>[] = [];

    if (percesSection) {
      const advantages = this.extractSubSection(percesSection, 'Avantages');
      const inconvenients = this.extractSubSection(
        percesSection,
        'Inconvenients',
      );
      useCases.push({
        id: 'perces',
        label: 'Disques percés',
        recommendation: `Avantages: ${advantages || 'evacuation gaz/eau'}. Inconvenients: ${inconvenients || 'usure plaquettes acceleree'}.`,
      });
    }

    if (rainuresSection) {
      const advantages = this.extractSubSection(rainuresSection, 'Avantages');
      const inconvenients = this.extractSubSection(
        rainuresSection,
        'Inconvenients',
      );
      useCases.push({
        id: 'rainures',
        label: 'Disques rainurés',
        recommendation: `Avantages: ${advantages || 'nettoyage de surface'}. Inconvenients: ${inconvenients || 'bruit, confort reduit'}.`,
      });
    }

    if (standardSection) {
      const advantages = this.extractSubSection(standardSection, 'Avantages');
      const inconvenients = this.extractSubSection(
        standardSection,
        'Inconvenients',
      );
      useCases.push({
        id: 'standard',
        label: 'Disques pleins/ventilés standard',
        recommendation: `Avantages: ${advantages || 'cout maitrise, bon compromis'}. Inconvenients: ${inconvenients || 'gestion thermique inferieure'}.`,
      });
    }

    return useCases;
  }

  private extractSubSection(text: string, label: string): string {
    const lines = text.split('\n');
    const labelLower = label.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (!lineLower.includes(labelLower)) continue;

      // Case 1: Inline "- Avantages: evacuation gaz/eau..."
      const colonIdx = lines[i].indexOf(':');
      if (colonIdx >= 0) {
        const inline = lines[i]
          .substring(colonIdx + 1)
          .trim()
          .replace(/\.$/, '');
        if (inline) return inline;
      }

      // Case 2: Sub-heading with bullets underneath
      const items: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.startsWith('-') || line.startsWith('•')) {
          items.push(line.replace(/^[-•]\s*/, '').trim());
        } else if (line.match(/^[A-Z#]/) || line === '') {
          break;
        }
      }
      if (items.length > 0) return items.join(', ');
    }
    return '';
  }

  private failedSection(
    _key: string,
    _reason: string,
    rawAnswer = '',
  ): SectionValidationResult {
    return {
      ok: false,
      flags: [],
      content: null,
      sources: [],
      confidence: 0,
      sourcesCitation: '',
      rawAnswer,
    };
  }

  // ── Quality gates (mirrors buying-guide-data.service.ts constants) ──

  private validateSection(
    sectionKey: string,
    content: unknown,
    family: string,
  ): { ok: boolean; flags: GammeContentQualityFlag[] } {
    const flags: GammeContentQualityFlag[] = [];

    // 1. Generic phrases check (text sections)
    if (typeof content === 'string') {
      const lower = content.toLowerCase();
      if (GENERIC_PHRASES.some((g) => lower.includes(g))) {
        flags.push('GENERIC_PHRASES');
      }
    }

    // 2. Family required terms
    if (typeof content === 'string') {
      const required = FAMILY_REQUIRED_TERMS[family] || [];
      const lower = content.toLowerCase();
      if (required.length > 0 && !required.some((t) => lower.includes(t))) {
        flags.push('MISSING_REQUIRED_TERMS');
      }
    }

    // 3. Length checks (narrative sections)
    if (
      typeof content === 'string' &&
      ['intro_role', 'how_to_choose'].includes(sectionKey)
    ) {
      if (content.length < MIN_NARRATIVE_LENGTH) flags.push('TOO_SHORT');
      if (content.length > MAX_NARRATIVE_LENGTH) flags.push('TOO_LONG');
    }

    // 4. Array minimums
    if (
      sectionKey === 'faq' &&
      Array.isArray(content) &&
      content.length < MIN_FAQS
    ) {
      flags.push('FAQ_TOO_SMALL');
    }
    if (
      sectionKey === 'symptoms' &&
      Array.isArray(content) &&
      content.length < MIN_SYMPTOMS
    ) {
      flags.push('SYMPTOMS_TOO_SMALL');
    }

    // 5. Duplicate detection
    if (Array.isArray(content)) {
      const strings = content.map((c) =>
        typeof c === 'string' ? c : JSON.stringify(c),
      );
      if (new Set(strings).size < strings.length) {
        flags.push('DUPLICATE_ITEMS');
      }
    }

    // 6. Action markers check (anti-mistakes, selection_criteria guidance)
    if (sectionKey === 'anti_mistakes' && Array.isArray(content)) {
      const allText = content.join(' ').toLowerCase();
      const hasAction = ACTION_MARKERS.some((m) => allText.includes(m));
      if (!hasAction) {
        // Not a blocking flag, but logged
        this.logger.warn(
          `Section ${sectionKey}: no action markers found in anti-mistakes`,
        );
      }
    }

    return { ok: flags.length === 0, flags };
  }

  private checkAntiWikiGate(
    sections: Record<string, SectionValidationResult>,
  ): { ok: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check selection criteria count
    const criteria = sections['selection_criteria'];
    if (
      !criteria?.ok ||
      !Array.isArray(criteria.content) ||
      criteria.content.length < MIN_SELECTION_CRITERIA
    ) {
      reasons.push(
        `MISSING_SELECTION_CRITERIA (got ${Array.isArray(criteria?.content) ? criteria.content.length : 0}, need ${MIN_SELECTION_CRITERIA})`,
      );
    }

    // Check anti-mistakes count
    const antiMistakes = sections['anti_mistakes'];
    if (
      !antiMistakes?.ok ||
      !Array.isArray(antiMistakes.content) ||
      antiMistakes.content.length < MIN_ANTI_MISTAKES
    ) {
      reasons.push(
        `MISSING_ANTI_MISTAKES (got ${Array.isArray(antiMistakes?.content) ? antiMistakes.content.length : 0}, need ${MIN_ANTI_MISTAKES})`,
      );
    }

    // Check decision tree
    const tree = sections['decision_tree'];
    if (
      !tree?.ok ||
      !Array.isArray(tree.content) ||
      tree.content.length < MIN_DECISION_NODES
    ) {
      reasons.push('MISSING_DECISION_TREE');
    }

    // Check generic without action across all text
    const textChunks: string[] = [];
    for (const [, result] of Object.entries(sections)) {
      if (!result.ok) continue;
      if (typeof result.content === 'string') {
        textChunks.push(result.content);
      }
      if (Array.isArray(result.content)) {
        for (const item of result.content) {
          if (typeof item === 'string') textChunks.push(item);
          if (typeof item === 'object' && item !== null) {
            textChunks.push(JSON.stringify(item));
          }
        }
      }
    }

    const hasGeneric = textChunks.some((chunk) =>
      GENERIC_PHRASES.some((g) => chunk.toLowerCase().includes(g)),
    );
    const hasAction = textChunks.some((chunk) =>
      ACTION_MARKERS.some((m) => chunk.toLowerCase().includes(m)),
    );
    if (hasGeneric && !hasAction) {
      reasons.push('GENERIC_WITHOUT_ACTION');
    }

    // D1: Check guidance is not a mere copy of label in selection_criteria
    if (
      criteria?.ok &&
      Array.isArray(criteria.content) &&
      criteria.content.length > 0
    ) {
      const guidanceCopies = (
        criteria.content as Array<{ label?: string; guidance?: string }>
      ).filter(
        (c) =>
          c.guidance?.trim() === c.label?.trim() + '.' ||
          c.guidance?.trim() === c.label?.trim(),
      );
      if (guidanceCopies.length > criteria.content.length / 2) {
        reasons.push(
          `GUIDANCE_COPIES_LABEL (${guidanceCopies.length}/${criteria.content.length} criteria have guidance identical to label)`,
        );
      }
    }

    // D2: Check anti_mistakes are actual errors, not positive actions
    if (
      antiMistakes?.ok &&
      Array.isArray(antiMistakes.content) &&
      antiMistakes.content.length > 0
    ) {
      const positiveStarters = [
        'remplacement',
        'entretien',
        'nettoyage',
        'controle',
        'verification',
      ];
      const positiveItems = (antiMistakes.content as string[]).filter((m) =>
        positiveStarters.some((p) => m.toLowerCase().startsWith(p)),
      );
      if (positiveItems.length > antiMistakes.content.length / 2) {
        reasons.push(
          `ANTI_MISTAKES_NOT_ERRORS (${positiveItems.length}/${antiMistakes.content.length} items look like positive actions instead of errors to avoid)`,
        );
      }
    }

    // D3: Check use_cases are user profiles, not product types
    const useCases = sections['use_cases'];
    if (
      useCases?.ok &&
      Array.isArray(useCases.content) &&
      useCases.content.length >= 2
    ) {
      const profileMarkers = [
        'conduite',
        'usage',
        'route',
        'urbain',
        'ville',
        'sport',
        'montagne',
        'autoroute',
        'city',
        'highway',
      ];
      const hasProfile = (
        useCases.content as Array<{ id?: string; label?: string }>
      ).some((uc) =>
        profileMarkers.some(
          (m) =>
            uc.id?.toLowerCase().includes(m) ||
            uc.label?.toLowerCase().includes(m),
        ),
      );
      if (!hasProfile) {
        reasons.push(
          'USE_CASES_NOT_PROFILES (use_cases should describe driver profiles, not product types)',
        );
      }
    }

    return { ok: reasons.length === 0, reasons };
  }

  // ── DB operations ──

  private async fetchGammeMetadata(
    pgId: string,
  ): Promise<{ gammeName: string; family: string } | null> {
    const { data, error } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_parent, pg_level')
      .eq('pg_id', pgId)
      .single();

    if (error || !data) {
      this.logger.warn(`Gamme metadata not found for pgId=${pgId}`);
      return null;
    }

    const gammeName = (data.pg_name as string) || 'cette pièce';

    // Infer family key from gamme name using FAMILY_MARKERS
    let family = 'unknown';
    const lower = gammeName.toLowerCase();
    for (const [key, markers] of Object.entries(FAMILY_MARKERS)) {
      if (markers.some((m) => lower.includes(m))) {
        family = key;
        break;
      }
    }

    return { gammeName, family };
  }

  private buildUpdatePayload(
    sections: Record<string, SectionValidationResult>,
    sourceUri: string,
    sourceRef: string,
    avgConfidence: number,
    qualityScore: number,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      sgpg_source_type: 'rag',
      sgpg_source_uri: sourceUri,
      sgpg_source_ref: sourceRef,
      sgpg_source_verified:
        avgConfidence >= MIN_VERIFIED_CONFIDENCE &&
        qualityScore >= MIN_QUALITY_SCORE,
      sgpg_source_verified_by: 'pipeline:rag-enrich',
      sgpg_source_verified_at: new Date().toISOString(),
    };

    // Map each OK section to its DB column
    for (const [key, result] of Object.entries(sections)) {
      if (!result.ok) continue;

      switch (key) {
        case 'intro_role':
          payload.sgpg_intro_role = result.content;
          break;
        case 'risk':
          if (typeof result.content === 'object' && result.content !== null) {
            const risk = result.content as {
              explanation: string;
              consequences: string[];
              costRange: string;
              conclusion: string;
            };
            payload.sgpg_risk_explanation = risk.explanation;
            payload.sgpg_risk_consequences = risk.consequences;
            payload.sgpg_risk_cost_range = risk.costRange;
            payload.sgpg_risk_conclusion = risk.conclusion;
          }
          break;
        case 'symptoms':
          payload.sgpg_symptoms = result.content;
          break;
        case 'selection_criteria':
          payload.sgpg_selection_criteria = result.content;
          break;
        case 'anti_mistakes':
          payload.sgpg_anti_mistakes = result.content;
          break;
        case 'decision_tree':
          payload.sgpg_decision_tree = result.content;
          break;
        case 'faq':
          payload.sgpg_faq = result.content;
          break;
        case 'how_to_choose':
          payload.sgpg_how_to_choose = result.content;
          break;
        case 'use_cases':
          payload.sgpg_use_cases = result.content;
          break;
      }
    }

    return payload;
  }

  private async upsertBuyingGuide(
    pgId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.client
      .from('__seo_gamme_purchase_guide')
      .update(payload)
      .eq('sgpg_pg_id', pgId);

    if (error) {
      this.logger.error(
        `Failed to update buying guide for pgId=${pgId}: ${error.message}`,
      );
      throw new Error(`DB update failed: ${error.message}`);
    }

    this.logger.log(`Buying guide updated for pgId=${pgId}`);
  }

  /**
   * Checks if intro_role text describes a different piece than the guide title.
   * Extracts piece name before ':' and checks for shared significant words.
   */
  private isIntroRoleMismatch(introRole: string, gammeName: string): boolean {
    const colonIdx = introRole.indexOf(':');
    if (colonIdx < 1) return false;

    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const stripArticles = (s: string) =>
      s.replace(/^(le |la |les |l'|l'|un |une |des )/i, '').trim();

    const rolePiece = normalize(introRole.slice(0, colonIdx));
    const titleNorm = normalize(gammeName);

    if (!rolePiece || !titleNorm) return false;

    const roleWords = stripArticles(rolePiece)
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const titleWords = stripArticles(titleNorm)
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (roleWords.length === 0 || titleWords.length === 0) return false;

    const hasCommon = roleWords.some((rw) =>
      titleWords.some((tw) => tw.includes(rw) || rw.includes(tw)),
    );

    return !hasCommon;
  }
}
