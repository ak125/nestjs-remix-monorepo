import { Injectable, Logger, Optional } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RagProxyService } from '../../rag-proxy/rag-proxy.service';
import { AiContentService } from '../../ai-content/ai-content.service';
import { PageBriefService } from './page-brief.service';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const yaml = require('js-yaml');
import { z } from 'zod';
import {
  SelectionCriterionSchema,
  DecisionNodeSchema,
  UseCaseSchema,
  type SectionResult,
  type EnrichmentResult,
} from '../dto/buying-guide-enrich.dto';
import type {
  EvidenceEntry,
  ClaimEntry,
  ClaimKind,
} from '../../../workers/types/content-refresh.types';
import { createHash } from 'node:crypto';
import {
  type GammeContentQualityFlag,
  MIN_NARRATIVE_LENGTH,
  MAX_NARRATIVE_LENGTH,
  GENERIC_PHRASES,
  FAMILY_REQUIRED_TERMS,
  FLAG_PENALTIES,
  FAMILY_MARKERS,
  ACTION_MARKERS,
  MIN_SELECTION_CRITERIA,
  MIN_ANTI_MISTAKES_BUYING_GUIDE as MIN_ANTI_MISTAKES,
  MIN_DECISION_NODES,
  MIN_FAQS,
  MIN_SYMPTOMS,
  MIN_VERIFIED_CONFIDENCE,
  MIN_QUALITY_SCORE,
} from '../../../config/buying-guide-quality.constants';

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
  private readonly RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';

  constructor(
    configService: ConfigService,
    private readonly ragService: RagProxyService,
    @Optional() private readonly aiContentService?: AiContentService,
    @Optional() private readonly pageBriefService?: PageBriefService,
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
    supplementaryFiles: string[] = [],
    conservativeMode = false,
  ): Promise<(EnrichmentResult | EnrichDryRunResult)[]> {
    const results: (EnrichmentResult | EnrichDryRunResult)[] = [];

    for (const pgId of pgIds) {
      try {
        const result = await this.enrichSingle(
          pgId,
          dryRun,
          supplementaryFiles,
          conservativeMode,
        );
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
    supplementaryFiles: string[] = [],
    conservativeMode = false,
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

    // 2. Load active brief (if available) for brief-driven enrichment
    let brief: import('./page-brief.service').PageBrief | null = null;
    if (this.pageBriefService) {
      try {
        brief = await this.pageBriefService.getActiveBrief(
          parseInt(pgId),
          'R3_guide',
        );
        if (!brief) {
          // Fallback: try R1 brief
          brief = await this.pageBriefService.getActiveBrief(
            parseInt(pgId),
            'R1',
          );
        }
        if (brief) {
          this.logger.log(
            `Brief loaded for pgId=${pgId}: role=${brief.page_role}, v=${brief.version}, confidence=${brief.confidence_score}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to load brief for pgId=${pgId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // 3. Enrich from RAG: search + parse markdown (0 LLM)
    const {
      sections: sectionResults,
      evidencePack: evidenceEntries,
      claims,
    } = await this.enrichFromRag(gammeName, family, supplementaryFiles, brief);

    // 4. Calculate quality score
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

    // 5. Anti-wiki gate check
    const antiWikiGate = this.checkAntiWikiGate(sectionResults);

    // 6. DryRun → return preview
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

    // 7. Write to DB
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
        evidencePack: evidenceEntries,
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

    // Generate sg_content_draft from enriched sections
    await this.writeSeoContentDraft(
      pgId,
      gammeName,
      sectionResults,
      conservativeMode,
    );

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
      evidencePack: evidenceEntries,
      claims,
    };
  }

  // ── RAG Direct: fetch full docs + parse markdown (0 LLM) ──

  private async enrichFromRag(
    gammeName: string,
    family: string,
    supplementaryFiles: string[] = [],
    brief?: import('./page-brief.service').PageBrief | null,
  ): Promise<{
    sections: Record<string, SectionValidationResult>;
    evidencePack: EvidenceEntry[];
    claims: ClaimEntry[];
  }> {
    const results: Record<string, SectionValidationResult> = {};

    // Build slug from gamme name: "Disque de frein" → "disque-de-frein"
    // NFD normalize decomposes accents: "à" → "a" + combining accent → strip combining → "a"
    const slug = gammeName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['']/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-{2,}/g, '-');

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

    // Fallback: read from disk if API content lacks YAML frontmatter
    if (!gammeContent || !gammeContent.startsWith('---\n')) {
      const diskContent = this.readGammeFromDisk(slug);
      if (diskContent) {
        this.logger.log(
          `Disk fallback for ${slug}: ${diskContent.length} chars`,
        );
        gammeContent = diskContent;
        if (!sources.length) sources.push(`disk://${slug}`);
      }
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
        sections: {
          anti_mistakes: empty,
          selection_criteria: empty,
          decision_tree: empty,
          use_cases: empty,
        },
        evidencePack: [],
        claims: [],
      };
    }

    // Merge full document contents
    let allContent = [gammeContent, guideContent].filter(Boolean).join('\n\n');

    // Append supplementary RAG files (web/PDF ingested content, anonymized)
    if (supplementaryFiles.length > 0) {
      let appendedCount = 0;
      for (const fp of supplementaryFiles) {
        try {
          if (!existsSync(fp)) continue;
          let body = readFileSync(fp, 'utf-8');
          // Strip YAML frontmatter
          body = body.replace(/^---\n[\s\S]*?\n---\n?/, '');
          if (body.trim().length < 50) continue;
          // Anonymize: remove OEM brand names
          body = this.anonymizeContent(body);
          allContent += '\n\n' + body;
          appendedCount++;
        } catch (err) {
          this.logger.warn(
            `Failed to read supplementary file ${fp}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
      if (appendedCount > 0) {
        this.logger.log(
          `Appended ${appendedCount} supplementary files to buying guide content`,
        );
      }
    }

    const confidence = 1.0; // Full verified docs, not search results
    const citation = sources.join(' + ');

    this.logger.log(
      `RAG knowledge docs loaded: ${allContent.length} chars, sources=[${sources.join(', ')}]`,
    );

    // ── Parse v4 frontmatter (priority) or legacy page_contract (fallback) ──
    const v4Data = this.parseV4Frontmatter(gammeContent);
    const pageContract = v4Data
      ? null
      : this.parsePageContractYaml(gammeContent);

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
    // Heading alias: "Attention aux Fausses Promesses"
    if (antiMistakes.length === 0) {
      const errorsAlias = this.extractSection(
        allContent,
        'Attention aux Fausses Promesses',
      );
      if (errorsAlias)
        antiMistakes.push(...this.extractBulletList(errorsAlias));
    }
    // v4 structured data: selection.anti_mistakes
    if (
      antiMistakes.length < MIN_ANTI_MISTAKES &&
      v4Data?.antiMistakes?.length
    ) {
      for (const item of v4Data.antiMistakes) {
        if (!antiMistakes.some((e) => e.toLowerCase() === item.toLowerCase())) {
          antiMistakes.push(item);
        }
      }
    }
    // Legacy YAML fallback: page_contract.antiMistakes
    if (
      antiMistakes.length < MIN_ANTI_MISTAKES &&
      pageContract?.antiMistakes?.length
    ) {
      for (const item of pageContract.antiMistakes) {
        if (!antiMistakes.some((e) => e.toLowerCase() === item.toLowerCase())) {
          antiMistakes.push(item);
        }
      }
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
    // Heading aliases for auto-generated docs
    const checklistAlias =
      this.extractSection(allContent, 'Criteres de Compatibilite') ||
      this.extractSection(allContent, 'Critères de Compatibilité');
    const checklistItems = this.extractBulletList(
      checklistSection || checklistAlt || checklistAlias || '',
    );
    const selectionCriteria = this.buildCriteriaFromCheckList(checklistItems);
    // v4 structured data: selection.criteria
    if (
      selectionCriteria.length < MIN_SELECTION_CRITERIA &&
      v4Data?.selectionCriteria?.length
    ) {
      for (const criterion of v4Data.selectionCriteria) {
        if (criterion.length > 5) {
          selectionCriteria.push({
            key: `v4-${selectionCriteria.length}`,
            label: criterion,
            guidance: criterion,
            priority: 'recommended',
          });
        }
      }
    }
    // v4 fallback: diagnostic.symptoms as criteria (same logic as legacy)
    if (
      selectionCriteria.length < MIN_SELECTION_CRITERIA &&
      v4Data?.symptoms?.length
    ) {
      for (const symptom of v4Data.symptoms) {
        if (symptom.length > 5) {
          selectionCriteria.push({
            key: `v4-symptom-${selectionCriteria.length}`,
            label: symptom,
            guidance: `Vérifier : ${symptom}`,
            priority: 'recommended',
          });
        }
      }
    }
    // Legacy YAML fallback: build criteria from page_contract.symptoms + howToChoose
    if (
      selectionCriteria.length < MIN_SELECTION_CRITERIA &&
      pageContract?.symptoms?.length
    ) {
      for (const symptom of pageContract.symptoms) {
        const clean = symptom.replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
        if (clean.length > 5) {
          selectionCriteria.push({
            key: `yaml-${selectionCriteria.length}`,
            label: clean,
            guidance: `Vérifier : ${clean}`,
            priority: 'recommended',
          });
        }
      }
    }
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
    // YAML fallback: page_contract.diagnosticTree → decision nodes
    if (
      decisionTree.length < MIN_DECISION_NODES &&
      pageContract?.diagnosticTree?.length
    ) {
      for (let i = 0; i < pageContract.diagnosticTree.length; i++) {
        const dt = pageContract.diagnosticTree[i];
        const nextIdx =
          i + 1 < pageContract.diagnosticTree.length
            ? `yaml-step-${i + 1}`
            : undefined;
        decisionTree.push({
          id: `yaml-step-${i}`,
          question: dt.if.replace(/_/g, ' '),
          options: [
            {
              label: dt.then.replace(/_/g, ' '),
              outcome: 'check' as const,
              ...(nextIdx ? { nextId: nextIdx } : {}),
            },
          ],
        });
      }
    }
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

    // Priority 3 (v4 structured data): rendering.arguments
    if (useCases.length < 2 && v4Data?.arguments?.length) {
      for (const arg of v4Data.arguments) {
        useCases.push({
          id: `v4-${useCases.length}`,
          label: arg.title,
          recommendation: arg.content,
        });
      }
    }
    // Priority 4 (legacy YAML fallback): page_contract.arguments
    if (useCases.length < 2 && pageContract?.arguments?.length) {
      for (const arg of pageContract.arguments) {
        useCases.push({
          id: `yaml-${useCases.length}`,
          label: arg.title,
          recommendation: arg.content,
        });
      }
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
    // v4: use parsed FAQ from yaml.load() (reliable), legacy: regex-based parser
    const fmFaqs = v4Data?.faq?.length
      ? v4Data.faq
      : this.parseFrontmatterFaq(gammeContent);
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

    // Build evidence pack from section rawAnswers + source metadata
    const evidenceEntries: EvidenceEntry[] = [];
    for (const [sectionKey, section] of Object.entries(results)) {
      if (!section.ok || !section.rawAnswer) continue;
      evidenceEntries.push({
        docId: sources[0] || `gammes.${slug}`,
        heading: sectionKey,
        charRange: [-1, -1] as [number, number],
        rawExcerpt: section.rawAnswer.substring(0, 200),
        confidence: section.confidence,
      });
    }

    // ── Claim Ledger MVP: extract claims from enriched sections ──
    const claims = this.extractClaims(results, sources, evidenceEntries, brief);

    return { sections: results, evidencePack: evidenceEntries, claims };
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
      const qMatch = line.match(/^\s+-?\s*question:\s+(.+)/);
      const aMatch = line.match(/^\s+-?\s*answer:\s+(.+)/);
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

  // ── Disk reader (fallback when RAG API strips frontmatter) ──

  private readGammeFromDisk(slug: string): string | null {
    const filePath = join(this.RAG_GAMMES_DIR, `${slug}.md`);
    try {
      if (!existsSync(filePath)) return null;
      return readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  // ── Page contract YAML parser ──

  /**
   * Parse page_contract from YAML frontmatter to extract structured data.
   * Used as fallback when markdown heading extraction yields insufficient results.
   */
  private parsePageContractYaml(content: string): {
    antiMistakes?: string[];
    symptoms?: string[];
    howToChoose?: string;
    diagnosticTree?: Array<{ if: string; then: string }>;
    arguments?: Array<{ title: string; content: string }>;
  } | null {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];

    if (!fm.includes('page_contract:')) return null;

    const result: {
      antiMistakes?: string[];
      symptoms?: string[];
      howToChoose?: string;
      diagnosticTree?: Array<{ if: string; then: string }>;
      arguments?: Array<{ title: string; content: string }>;
    } = {};

    // antiMistakes list
    const antiMistakes = this.parseFrontmatterList(content, 'antiMistakes');
    if (antiMistakes.length > 0) result.antiMistakes = antiMistakes;

    // symptoms list (under page_contract)
    const pcIdx = fm.indexOf('page_contract:');
    if (pcIdx >= 0) {
      const pcBlock = fm.substring(pcIdx);
      const sympIdx = pcBlock.indexOf('symptoms:');
      if (sympIdx >= 0) {
        const afterSymp = pcBlock.substring(sympIdx);
        const lines = afterSymp.split('\n').slice(1);
        const symptoms: string[] = [];
        for (const line of lines) {
          const m = line.match(/^\s+-\s+['"]?(.+?)['"]?\s*$/);
          if (m) {
            symptoms.push(m[1].trim());
          } else if (line.trim() && !line.match(/^\s/)) {
            break;
          }
        }
        if (symptoms.length > 0) result.symptoms = symptoms;
      }
    }

    // howToChoose (inline string, not a list)
    const htcMatch = fm.match(/howToChoose:\s+(.+)$/m);
    if (htcMatch) result.howToChoose = htcMatch[1].trim();

    // diagnostic_tree (top-level, not under page_contract)
    const dtIdx = fm.indexOf('diagnostic_tree:');
    if (dtIdx >= 0) {
      const afterDt = fm.substring(dtIdx);
      const dtLines = afterDt.split('\n').slice(1);
      const nodes: Array<{ if: string; then: string }> = [];
      let curIf = '';
      let curThen = '';
      for (const line of dtLines) {
        const ifM = line.match(/^\s*-?\s*if:\s*(.+)/);
        const thenM = line.match(/^\s+then:\s*(.+)/);
        if (ifM) {
          if (curIf && curThen) nodes.push({ if: curIf, then: curThen });
          curIf = ifM[1].trim();
          curThen = '';
        } else if (thenM) {
          curThen = thenM[1].trim();
        } else if (line.trim() && !line.match(/^\s/) && !line.startsWith('-')) {
          break;
        }
      }
      if (curIf && curThen) nodes.push({ if: curIf, then: curThen });
      if (nodes.length > 0) result.diagnosticTree = nodes;
    }

    // arguments (under page_contract)
    const argIdx = fm.indexOf('arguments:');
    if (argIdx >= 0) {
      const afterArg = fm.substring(argIdx);
      const argLines = afterArg.split('\n').slice(1);
      const args: Array<{ title: string; content: string }> = [];
      let curTitle = '';
      let curContent = '';
      for (const line of argLines) {
        const titleM = line.match(/^\s+title:\s+(.+)/);
        const contentM = line.match(/^\s+content:\s+(.+)/);
        if (titleM) {
          curTitle = titleM[1].trim();
        } else if (contentM) {
          curContent = contentM[1].trim();
          if (curTitle && curContent) {
            args.push({ title: curTitle, content: curContent });
            curTitle = '';
            curContent = '';
          }
        } else if (line.trim() && !line.match(/^\s/) && !line.startsWith('-')) {
          break;
        }
      }
      if (args.length > 0) result.arguments = args;
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  // ── v4 schema frontmatter parser (js-yaml) ──

  /**
   * Parse v4 schema frontmatter using js-yaml.
   * Detects v4 via `rendering.quality.version === 'GammeContentContract.v4'`
   * and returns structured data from the 5 blocs (domain, selection, diagnostic,
   * maintenance, rendering). Returns null for non-v4 files.
   *
   * Same pattern as conseil-enricher.service.ts:parseV4ToPageContract()
   * and reference.service.ts:parseRagGammeFileV4().
   */
  private parseV4Frontmatter(content: string): {
    faq: Array<{ question: string; answer: string }>;
    arguments: Array<{ title: string; content: string }>;
    antiMistakes: string[];
    symptoms: string[];
    selectionCriteria: string[];
    howToChoose: string | null;
    diagnosticTree: Array<{ if: string; then: string }>;
  } | null {
    try {
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fm = yaml.load(fmMatch[1]) as Record<string, any>;
      if (!fm) return null;

      // v4 detection — same 3-path check as conseil-enricher
      const version =
        fm?.rendering?.quality?.version ||
        fm?.page_contract?.quality?.version ||
        fm?.quality?.version;
      if (version !== 'GammeContentContract.v4') return null;

      const selection = fm.selection || {};
      const diagnostic = fm.diagnostic || {};
      const rendering = fm.rendering || {};

      // FAQ: rendering.faq[] → {question, answer}
      const faq: Array<{ question: string; answer: string }> = (
        rendering.faq || []
      )
        .map(
          (f: {
            question?: string;
            answer?: string;
            q?: string;
            a?: string;
          }) => ({
            question: f.question || f.q || '',
            answer: f.answer || f.a || '',
          }),
        )
        .filter(
          (f: { question: string; answer: string }) => f.question && f.answer,
        );

      // Arguments: rendering.arguments[] → {title, content}
      // v4 arguments have {title, icon, source_ref} — adapt to enricher's {title, content} format
      const args: Array<{ title: string; content: string }> = (
        rendering.arguments || []
      )
        .map((a: { title?: string; icon?: string; source_ref?: string }) => ({
          title: a.title || '',
          content: a.title || '', // v4 arguments are label-only, no separate content field
        }))
        .filter((a: { title: string }) => a.title);

      // Anti-mistakes: selection.anti_mistakes[]
      const antiMistakes: string[] = (selection.anti_mistakes || []).filter(
        (s: unknown) => typeof s === 'string' && s.length > 0,
      );

      // Symptoms: diagnostic.symptoms[].label
      const symptoms: string[] = (diagnostic.symptoms || [])
        .map((s: { label?: string } | string) =>
          typeof s === 'string' ? s : s?.label || '',
        )
        .filter((s: string) => s.length > 0);

      // Selection criteria: selection.criteria[]
      const selectionCriteria: string[] = (selection.criteria || []).filter(
        (s: unknown) => typeof s === 'string' && s.length > 0,
      );

      // HowToChoose: join selection.criteria as a single string (legacy compat)
      const howToChoose =
        selectionCriteria.length > 0 ? selectionCriteria.join('. ') : null;

      // Diagnostic tree: diagnostic.causes[] → {if, then}
      const diagnosticTree: Array<{ if: string; then: string }> = (
        diagnostic.causes || []
      ).map((c: string) => ({ if: c, then: '' }));

      // Validate: at least 2 useful fields present
      let fieldCount = 0;
      if (faq.length > 0) fieldCount++;
      if (antiMistakes.length > 0) fieldCount++;
      if (symptoms.length > 0) fieldCount++;
      if (selectionCriteria.length > 0) fieldCount++;
      if (args.length > 0) fieldCount++;

      if (fieldCount < 2) {
        this.logger.warn(
          'v4 frontmatter detected but < 2 useful fields, skipping',
        );
        return null;
      }

      this.logger.log(
        `Parsed v4 frontmatter: ${faq.length} FAQ, ${antiMistakes.length} anti-mistakes, ${symptoms.length} symptoms, ${selectionCriteria.length} criteria, ${args.length} arguments`,
      );

      return {
        faq,
        arguments: args,
        antiMistakes,
        symptoms,
        selectionCriteria,
        howToChoose,
        diagnosticTree,
      };
    } catch (err) {
      this.logger.warn(`Failed to parse v4 frontmatter: ${err}`);
      return null;
    }
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
      .map((line) =>
        line
          .replace(/^[-•*\d.)\s]+/, '') // Strip leading list markers
          .replace(/\*\*(.+?)\*\*/g, '$1') // Strip **bold** markdown
          .replace(/\*(.+?)\*/g, '$1') // Strip *italic* markdown
          .trim(),
      )
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

  // ── Anonymization (shared with ConseilEnricherService) ──

  private static readonly OEM_BRANDS = [
    'DENSO',
    'Bosch',
    'Valeo',
    'Continental',
    'Hella',
    'Sachs',
    'LuK',
    'TRW',
    'Brembo',
    'ATE',
    'Delphi',
    'SKF',
    'INA',
    'FAG',
    'Gates',
    'Dayco',
    'NGK',
    'Magneti Marelli',
    'ZF',
    'Aisin',
    'NTN',
    'SNR',
    'Febi',
    'Bilstein',
    'Monroe',
    'KYB',
    'Sachs',
    'Lemforder',
    'Meyle',
    'Corteco',
    'Elring',
    'Victor Reinz',
    'Mahle',
    'Mann Filter',
    'Purflux',
  ];

  /**
   * Remove OEM brand names, self-promotional phrases, and third-party URLs.
   * Content must read as AutoMecanik technical knowledge, not manufacturer copy.
   */
  private anonymizeContent(text: string): string {
    let result = text;
    for (const brand of BuyingGuideEnricherService.OEM_BRANDS) {
      const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\b${escaped}\\b\\s*`, 'gi'), '');
      result = result.replace(new RegExp(`\\s*\\b${escaped}\\b`, 'gi'), '');
    }
    // Remove self-promotional phrases
    result = result.replace(
      /\b(chez|par|de|from)\s+(nous|notre|our)\b[^.]*\./gi,
      '',
    );
    // Remove third-party URLs
    result = result.replace(/https?:\/\/[^\s)]+/g, '');
    // Clean multiple spaces
    return result.replace(/\s{2,}/g, ' ').trim();
  }

  /**
   * Checks if intro_role text describes a different piece than the guide title.
   * Extracts piece name before ':' and checks for shared significant words.
   */
  // ── SEO Content Draft Generation ──

  /**
   * Compose sg_content_draft HTML from enriched buying guide sections.
   * Combines selection criteria, symptoms (from anti_mistakes), and use cases.
   */
  /**
   * Restore common French accents missing from YAML source files.
   */
  private restoreAccents(text: string): string {
    const ACCENT_MAP: Array<[RegExp, string]> = [
      [/\bequipements?\b/gi, 'équipement'],
      [/\belectriques?\b/gi, 'électrique'],
      [/\bvehicules?\b/gi, 'véhicule'],
      [/\bverifi/gi, 'vérifi'],
      [/\bgeneral\b/gi, 'général'],
      [/\bsecurite\b/gi, 'sécurité'],
      [/\bprecedent/gi, 'précédent'],
      [/\bdefaut\b/gi, 'défaut'],
      [/\bdetect/gi, 'détect'],
      [/\bdegradation/gi, 'dégradation'],
      [/\bcontrole\b/gi, 'contrôle'],
      [/\bmodele\b/gi, 'modèle'],
      [/\bannee\b/gi, 'année'],
      [/\bspecifi/gi, 'spécifi'],
      [/\breferen/gi, 'référen'],
      [/\bprocedure\b/gi, 'procédure'],
      [/\bcomplete\b/gi, 'complète'],
      [/\bpieces\b/gi, 'pièces'],
      [/\bpiece\b/gi, 'pièce'],
      [/\belectri/gi, 'électri'],
      [/\benergie\b/gi, 'énergie'],
      [/\bnecessaire\b/gi, 'nécessaire'],
      [/\bpreventif\b/gi, 'préventif'],
    ];
    let result = text;
    for (const [pattern, replacement] of ACCENT_MAP) {
      result = result.replace(pattern, (match) => {
        const suffix =
          match.endsWith('s') && !replacement.endsWith('s') ? 's' : '';
        return replacement + suffix;
      });
    }
    return result;
  }

  private composeSeoContent(
    gammeName: string,
    sections: Record<string, SectionValidationResult>,
  ): string | null {
    let html = '';
    const displayName = gammeName.toLowerCase();

    // Selection criteria → "Comment choisir"
    const criteria = sections['selection_criteria'];
    if (
      criteria?.ok &&
      Array.isArray(criteria.content) &&
      criteria.content.length >= 2
    ) {
      const items = (
        criteria.content as Array<{ label: string; guidance: string }>
      )
        .filter((c) => !c.guidance.trimEnd().endsWith(':')) // Exclude intro phrases
        .slice(0, 4);
      if (items.length >= 2) {
        html += `<h2>Comment choisir vos ${displayName} ?</h2><ul>`;
        html += items
          .map((c) => {
            const cleanLabel = this.restoreAccents(
              c.label.replace(/\*\*/g, '').trim(),
            );
            const cleanGuidance = this.restoreAccents(
              c.guidance.replace(/\*\*/g, '').trim(),
            );
            // Skip duplication: if guidance starts with label, show only guidance
            if (
              cleanGuidance.toLowerCase().startsWith(cleanLabel.toLowerCase())
            ) {
              return `<li>${cleanGuidance}</li>`;
            }
            return `<li><b>${cleanLabel}</b> — ${cleanGuidance}</li>`;
          })
          .join('');
        html += '</ul>';
      }
    }

    // Anti-mistakes → "Erreurs à éviter"
    const mistakes = sections['anti_mistakes'];
    if (
      mistakes?.ok &&
      Array.isArray(mistakes.content) &&
      mistakes.content.length >= 2
    ) {
      const items = (mistakes.content as string[])
        .slice(0, 5)
        .map((m) =>
          this.restoreAccents(
            m
              .replace(/^❌\s*/, '') // Strip leading ❌ emoji
              .replace(/^[""\u201C]|[""\u201D]$/g, '') // Strip surrounding quotes
              .replace(/\*\*/g, '') // Strip markdown bold
              .trim(),
          ),
        )
        .filter((m) => m.length > 5 && !m.endsWith(':')) // Exclude intro phrases
        .slice(0, 4);
      if (items.length >= 2) {
        html += `<h2>Erreurs à éviter</h2><ul>`;
        html += items.map((m) => `<li>${m}</li>`).join('');
        html += '</ul>';
      }
    }

    // Use cases → "Selon votre usage"
    const useCases = sections['use_cases'];
    if (
      useCases?.ok &&
      Array.isArray(useCases.content) &&
      useCases.content.length >= 2
    ) {
      const items = (
        useCases.content as Array<{ label: string; recommendation: string }>
      ).slice(0, 3);
      html += `<h2>Selon votre usage</h2><ul>`;
      html += items
        .map(
          (uc) =>
            `<li><b>${this.restoreAccents(uc.label)}</b> — ${this.restoreAccents(uc.recommendation)}</li>`,
        )
        .join('');
      html += '</ul>';
    }

    return html.length >= 100 ? html : null;
  }

  /**
   * Write sg_content_draft to __seo_gamme if meaningful content can be composed.
   */
  private async writeSeoContentDraft(
    pgId: string,
    gammeName: string,
    sections: Record<string, SectionValidationResult>,
    conservativeMode = false,
  ): Promise<void> {
    const templateContent = this.composeSeoContent(gammeName, sections);
    if (!templateContent) return;

    let finalContent = templateContent;
    let draftSource = conservativeMode ? 'pipeline:conservative' : 'pipeline';
    let llmModel: string | null = null;

    if (this.aiContentService && !conservativeMode) {
      try {
        // Brief-aware template selection (Phase 2)
        const brief =
          process.env.BRIEF_AWARE_ENABLED === 'true'
            ? await this.pageBriefService?.getActiveBrief(parseInt(pgId), 'R1')
            : null;

        const result = await this.aiContentService.generateContent({
          type: brief ? 'seo_content_R1' : 'seo_content_polish',
          prompt: `Polish SEO content for ${gammeName}`,
          tone: 'professional',
          language: 'fr',
          maxLength: 2000,
          temperature: 0.4,
          context: brief
            ? { draft: templateContent, gammeName, brief }
            : { draft: templateContent, gammeName },
          useCache: true,
        });
        const polished = result.content.trim();
        if (
          polished.length >= 100 &&
          polished.includes('<h2>') &&
          polished.length <= templateContent.length * 1.3
        ) {
          finalContent = polished;
          draftSource = brief ? 'pipeline+llm+brief' : 'pipeline+llm';
          llmModel = result.metadata.model;
          this.logger.log(
            `LLM polished sg_content for pgId=${pgId} (${polished.length} chars, model=${llmModel}, brief=${brief ? 'R1' : 'none'})`,
          );
        } else {
          this.logger.warn(
            `LLM polish rejected for pgId=${pgId}: length=${polished.length}, hasH2=${polished.includes('<h2>')}, using template`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `LLM polish failed for pgId=${pgId}, using template: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Read current state to avoid overwriting a better draft_source
    const { data: current } = await this.client
      .from('__seo_gamme')
      .select('sg_draft_source, sg_draft_llm_model, sg_descrip_draft')
      .eq('sg_pg_id', pgId)
      .single();

    // Don't regress from pipeline+llm (or +brief) to pipeline
    const mergedDraftSource =
      current?.sg_draft_source?.includes('pipeline+llm') &&
      draftSource === 'pipeline'
        ? current.sg_draft_source
        : draftSource;
    const mergedLlmModel = llmModel || current?.sg_draft_llm_model || null;

    const { error } = await this.client
      .from('__seo_gamme')
      .update({
        sg_content_draft: finalContent,
        sg_draft_source: mergedDraftSource,
        sg_draft_updated_at: new Date().toISOString(),
        sg_draft_llm_model: mergedLlmModel,
      })
      .eq('sg_pg_id', pgId);

    if (error) {
      this.logger.warn(
        `Failed to write sg_content_draft for pgId=${pgId}: ${error.message}`,
      );
    } else {
      this.logger.log(
        `sg_content_draft written for pgId=${pgId} (${finalContent.length} chars, source=${mergedDraftSource})`,
      );
    }

    // Fallback: generate sg_descrip_draft if ConseilEnricher didn't run
    if (!current?.sg_descrip_draft) {
      await this.writeSeoDescripDraftFallback(
        pgId,
        gammeName,
        conservativeMode,
      );
    }
  }

  /**
   * Fallback: generate sg_descrip_draft when ConseilEnricher (R3_conseils) was skipped.
   * Uses a simple template from the gamme name + optional LLM polish.
   */
  private async writeSeoDescripDraftFallback(
    pgId: string,
    gammeName: string,
    conservativeMode = false,
  ): Promise<void> {
    const label = gammeName.replace(/-/g, ' ');
    const templateDescrip = `${label.charAt(0).toUpperCase() + label.slice(1)} : sélectionnez votre véhicule pour les références compatibles. Livraison 24-48h.`;

    let finalDescrip = templateDescrip;
    let draftSource = conservativeMode ? 'pipeline:conservative' : 'pipeline';
    let llmModel: string | null = null;

    if (this.aiContentService && !conservativeMode) {
      try {
        // Brief-aware template selection (Phase 2)
        const brief =
          process.env.BRIEF_AWARE_ENABLED === 'true'
            ? await this.pageBriefService?.getActiveBrief(parseInt(pgId), 'R1')
            : null;

        const result = await this.aiContentService.generateContent({
          type: brief ? 'seo_descrip_R1' : 'seo_descrip_polish',
          prompt: `Polish meta description for ${gammeName}`,
          tone: 'professional',
          language: 'fr',
          maxLength: 200,
          temperature: 0.3,
          context: brief
            ? { draft: templateDescrip, gammeName: label, brief }
            : { draft: templateDescrip, gammeName: label },
          useCache: true,
        });
        const polished = result.content.trim();
        if (polished.length > 0 && polished.length <= 160) {
          finalDescrip = polished;
          draftSource = brief ? 'pipeline+llm+brief' : 'pipeline+llm';
          llmModel = result.metadata.model;
          this.logger.log(
            `LLM polished sg_descrip (fallback) for pgId=${pgId} (${polished.length} chars, brief=${brief ? 'R1' : 'none'})`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `LLM descrip fallback failed for pgId=${pgId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Only update descrip columns, preserve content columns
    const { data: currentState } = await this.client
      .from('__seo_gamme')
      .select('sg_draft_source, sg_draft_llm_model')
      .eq('sg_pg_id', pgId)
      .single();

    const mergedSource =
      draftSource.includes('pipeline+llm') ||
      currentState?.sg_draft_source?.includes('pipeline+llm')
        ? draftSource.includes('pipeline+llm')
          ? draftSource
          : (currentState?.sg_draft_source ?? draftSource)
        : draftSource;

    await this.client
      .from('__seo_gamme')
      .update({
        sg_descrip_draft: finalDescrip,
        sg_draft_source: mergedSource,
        sg_draft_updated_at: new Date().toISOString(),
        sg_draft_llm_model:
          llmModel || currentState?.sg_draft_llm_model || null,
      })
      .eq('sg_pg_id', pgId);

    this.logger.log(
      `sg_descrip_draft fallback written for pgId=${pgId} (${finalDescrip.length} chars, source=${mergedSource})`,
    );
  }

  // ── Claim Ledger MVP: extract numeric claims from enriched sections ──

  /**
   * Extract claims (mileage, dimension, percentage, norm) from enriched sections.
   * Each claim is matched against the evidence pack to determine verified/unverified status.
   * Unverified claims will be stripped by SectionCompiler (block-early).
   */
  private extractClaims(
    sections: Record<string, SectionValidationResult>,
    sources: string[],
    evidenceEntries: EvidenceEntry[],
    brief?: import('./page-brief.service').PageBrief | null,
  ): ClaimEntry[] {
    const claims: ClaimEntry[] = [];

    // Build a set of sourced numeric values from evidence for verification
    const sourcedValues = new Set<string>();
    for (const entry of evidenceEntries) {
      if (entry.rawExcerpt) {
        const nums = entry.rawExcerpt.match(
          /\d+(?:[.,\s]\d+)*\s*(?:mm|cm|km|m|Nm|bar|°C|ans?|%|€|litres?|kg)\b/gi,
        );
        if (nums) {
          for (const n of nums) {
            sourcedValues.add(this.normalizeClaimValue(n));
          }
        }
      }
    }

    // Claim extraction patterns by kind
    const CLAIM_PATTERNS: Array<{
      kind: ClaimKind;
      regex: RegExp;
      unit: string;
    }> = [
      // Mileage: "120 000 km", "60000 km", "30 000 - 60 000 km"
      {
        kind: 'mileage',
        regex:
          /(\d[\d\s.,]*\d?\s*(?:-|à|a)\s*\d[\d\s.,]*\d?\s*km|\d[\d\s.,]*\d?\s*km)\b/gi,
        unit: 'km',
      },
      // Dimension: "mm", "cm", "Nm", "bar", "°C"
      {
        kind: 'dimension',
        regex: /(\d+(?:[.,]\d+)?\s*(?:mm|cm|Nm|bar|°C))\b/gi,
        unit: '',
      },
      // Percentage
      { kind: 'percentage', regex: /(\d+(?:[.,]\d+)?\s*%)/gi, unit: '%' },
      // Norms: ISO/ECE/FMVSS + number
      {
        kind: 'norm',
        regex: /\b((?:ISO|ECE|FMVSS|NF|EN)\s*[\w.-]+)\b/gi,
        unit: '',
      },
    ];

    for (const [sectionKey, section] of Object.entries(sections)) {
      if (!section.ok || !section.rawAnswer) continue;

      const rawText =
        typeof section.content === 'string'
          ? section.content
          : section.rawAnswer;

      if (!rawText) continue;

      const plainText = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

      for (const { kind, regex, unit } of CLAIM_PATTERNS) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(plainText)) !== null) {
          const rawClaimText = match[1] || match[0];
          const normalizedValue = this.normalizeClaimValue(rawClaimText);
          const claimUnit = unit || this.inferUnit(rawClaimText);

          // Determine if this claim is sourced
          const isVerified = sourcedValues.has(normalizedValue);

          // Build stable hash for dedup
          const id = createHash('sha256')
            .update(`${kind}:${normalizedValue}:${sectionKey}`)
            .digest('hex')
            .substring(0, 16);

          // Find matching evidence entry
          const matchingEvidence = evidenceEntries.find(
            (e) =>
              e.heading === sectionKey &&
              e.rawExcerpt?.includes(rawClaimText.substring(0, 20)),
          );

          claims.push({
            id,
            kind,
            rawText: rawClaimText.trim(),
            value: normalizedValue,
            unit: claimUnit,
            sectionKey,
            sourceRef: isVerified
              ? `rag:${sources[0] || 'unknown'}#${sectionKey}`
              : null,
            evidenceId: matchingEvidence
              ? `${matchingEvidence.docId}#${matchingEvidence.heading}`
              : null,
            status: isVerified ? 'verified' : 'unverified',
          });
        }
      }
    }

    // Deduplicate by id
    const seen = new Set<string>();
    const dedupedClaims = claims.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // Log brief-aware filtering info
    if (brief && dedupedClaims.length > 0) {
      const unverifiedCount = dedupedClaims.filter(
        (c) => c.status === 'unverified',
      ).length;
      this.logger.log(
        `Claims extracted: ${dedupedClaims.length} total, ${unverifiedCount} unverified (brief: ${brief.page_role} v${brief.version})`,
      );
    }

    return dedupedClaims;
  }

  /** Normalize a claim value for comparison: strip spaces, lowercase */
  private normalizeClaimValue(raw: string): string {
    return raw.replace(/\s+/g, '').replace(/,/g, '.').toLowerCase().trim();
  }

  /** Infer unit from raw claim text */
  private inferUnit(text: string): string {
    const unitMatch = text.match(/(mm|cm|km|Nm|bar|°C|%|€|litres?|kg|ans?)$/i);
    return unitMatch ? unitMatch[1].toLowerCase() : '';
  }

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
