import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { RagProxyService } from '../../../rag-proxy/rag-proxy.service';
import { EnricherTextUtils } from '../enricher-text-utils.service';
import { EnricherYamlParser } from '../enricher-yaml-parser.service';
import { BuyingGuideSectionExtractor } from './buying-guide-section-extractor.service';
import { BuyingGuideQualityGatesService } from './buying-guide-quality-gates.service';
import { ClaimExtractor } from './claim-extractor.util';
import { UseCaseSchema } from '../../dto/buying-guide-enrich.dto';
import { RAG_KNOWLEDGE_PATH } from '../../../../config/rag.config';
import type { SectionValidationResult } from './buying-guide.types';
import type {
  EvidenceEntry,
  ClaimEntry,
} from '../../../../workers/types/content-refresh.types';
import {
  MIN_ANTI_MISTAKES_BUYING_GUIDE as MIN_ANTI_MISTAKES,
  MIN_SELECTION_CRITERIA,
  MIN_DECISION_NODES,
  MIN_FAQS,
  ADVISORY_FAQ_COUNT,
} from '../../../../config/buying-guide-quality.constants';

/**
 * RAG content fetching and parsing for buying guide enrichment.
 * Fetches knowledge docs from RAG API (with disk fallback), parses markdown
 * into structured sections, validates them, and extracts claims.
 */
@Injectable()
export class BuyingGuideRagFetcherService {
  private readonly logger = new Logger(BuyingGuideRagFetcherService.name);
  private readonly RAG_GAMMES_DIR = `${RAG_KNOWLEDGE_PATH}/gammes`;

  constructor(
    private readonly ragService: RagProxyService,
    private readonly textUtils: EnricherTextUtils,
    private readonly yamlParser: EnricherYamlParser,
    private readonly sectionExtractor: BuyingGuideSectionExtractor,
    private readonly qualityGates: BuyingGuideQualityGatesService,
  ) {}

  async enrichFromRag(
    gammeName: string,
    family: string,
    supplementaryFiles: string[] = [],
    brief?: import('../page-brief.service').PageBrief | null,
  ): Promise<{
    sections: Record<string, SectionValidationResult>;
    evidencePack: EvidenceEntry[];
    claims: ClaimEntry[];
  }> {
    const results: Record<string, SectionValidationResult> = {};

    // Build slug from gamme name: "Disque de frein" → "disque-de-frein"
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
    const guideDocId = await this.findGuideDocId(slug);
    if (guideDocId) {
      try {
        const guideDoc = await this.ragService.getKnowledgeDoc(guideDocId);
        guideContent = guideDoc.content || '';
        sources.push(guideDoc.source_path);
        this.logger.log(
          `Loaded guide doc: ${guideDocId} (${guideContent.length} chars, truth=${guideDoc.truth_level})`,
        );
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
      const empty = this.qualityGates.failedSection(
        'all',
        'No knowledge docs found',
      );
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
          body = body.replace(/^---\n[\s\S]*?\n---\n?/, '');
          if (body.trim().length < 50) continue;
          body = this.textUtils.anonymizeContent(body);
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
      : this.yamlParser.parsePageContractYaml(gammeContent);

    // ── Extract anti_mistakes ──
    const errorsSection = this.sectionExtractor.extractSection(
      allContent,
      'Erreurs a eviter',
    );
    const antiMistakes = errorsSection
      ? this.textUtils.extractBulletList(errorsSection)
      : [];
    if (antiMistakes.length === 0) {
      const errorsAlt = this.sectionExtractor.extractSection(
        allContent,
        'Erreurs à éviter',
      );
      if (errorsAlt)
        antiMistakes.push(...this.textUtils.extractBulletList(errorsAlt));
    }
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
    const solutionsSection =
      this.sectionExtractor.extractSection(allContent, 'Solutions') ||
      this.sectionExtractor.extractSection(allContent, 'Solutions (par ordre');
    if (solutionsSection) {
      const solutionItems = this.textUtils.extractBulletList(solutionsSection);
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
    const cleanAntiMistakes =
      BuyingGuideSectionExtractor.sanitizeStringArray(antiMistakes);
    const antiMistakesValidation = this.qualityGates.validateSection(
      'anti_mistakes',
      cleanAntiMistakes,
      family,
    );
    results['anti_mistakes'] = {
      ok:
        antiMistakesValidation.ok &&
        cleanAntiMistakes.length >= MIN_ANTI_MISTAKES,
      flags: antiMistakesValidation.flags,
      content: cleanAntiMistakes,
      sources,
      confidence,
      sourcesCitation: citation,
      rawAnswer: errorsSection || '',
    };

    // ── Extract selection_criteria ──
    const checklistSection = this.sectionExtractor.extractSection(
      allContent,
      'Check-list compatibilite',
    );
    const checklistAlt = this.sectionExtractor.extractSection(
      allContent,
      'Check-list compatibilité',
    );
    const checklistAlias =
      this.sectionExtractor.extractSection(
        allContent,
        'Criteres de Compatibilite',
      ) ||
      this.sectionExtractor.extractSection(
        allContent,
        'Critères de Compatibilité',
      );
    const checklistItems = this.textUtils.extractBulletList(
      checklistSection || checklistAlt || checklistAlias || '',
    );
    const selectionCriteria =
      this.sectionExtractor.buildCriteriaFromCheckList(checklistItems);
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
    const criteriaValidation = this.qualityGates.validateSection(
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
    const replaceSection = this.sectionExtractor.extractSection(
      allContent,
      'Quand remplacer immediatement',
    );
    const replaceAlt = this.sectionExtractor.extractSection(
      allContent,
      'Quand remplacer immédiatement',
    );
    const testsSection = this.sectionExtractor.extractSection(
      allContent,
      'Tests simples (sans outil)',
    );
    const testsAtelierSection = this.sectionExtractor.extractSection(
      allContent,
      'Tests atelier',
    );
    const decisionTree = this.sectionExtractor.buildDecisionTree(
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
    // Fallback: "Procédure de Diagnostic" heading (v4 auto-generated docs)
    if (decisionTree.length < MIN_DECISION_NODES) {
      const diagSection =
        this.sectionExtractor.extractSection(
          allContent,
          'Procedure de Diagnostic',
        ) ||
        this.sectionExtractor.extractSection(
          allContent,
          'Procédure de Diagnostic',
        );
      if (diagSection) {
        const diagSteps =
          this.sectionExtractor.extractNumberedList(diagSection);
        if (diagSteps.length >= 2) {
          decisionTree.push({
            id: 'diag-procedure',
            question: 'Procédure de diagnostic recommandée',
            options: diagSteps.slice(0, 4).map((step, i) => ({
              label: step.replace(/^\*\*(.+?)\*\*\s*[-–]?\s*/, '$1: ').trim(),
              outcome:
                i === Math.min(diagSteps.length, 4) - 1
                  ? ('replace' as const)
                  : ('check' as const),
            })),
          });
        }
      }
    }

    const treeValidation = this.qualityGates.validateSection(
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
    const profileHeadings = [
      { id: 'city', heading: 'Conduite urbaine' },
      { id: 'highway', heading: 'Route et autoroute' },
      { id: 'mountain', heading: 'Montagne et charge' },
      { id: 'sport', heading: 'Conduite sportive' },
    ];
    let useCases: z.infer<typeof UseCaseSchema>[] = [];
    let useCasesRaw = '';
    for (const profile of profileHeadings) {
      const section = this.sectionExtractor.extractSection(
        allContent,
        profile.heading,
      );
      if (section) {
        const advantages =
          this.sectionExtractor.extractSubSection(section, 'Avantages') || '';
        const inconvenients =
          this.sectionExtractor.extractSubSection(section, 'Inconvenients') ||
          this.sectionExtractor.extractSubSection(section, 'Inconvénients') ||
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
      const percesSection =
        this.sectionExtractor.extractSection(allContent, 'Disques perces') ||
        this.sectionExtractor.extractSection(allContent, 'Disques percés');
      const rainuresSection =
        this.sectionExtractor.extractSection(allContent, 'Disques rainures') ||
        this.sectionExtractor.extractSection(allContent, 'Disques rainurés');
      const standardSection =
        this.sectionExtractor.extractSection(
          allContent,
          'Disques pleins/ventiles standard',
        ) ||
        this.sectionExtractor.extractSection(
          allContent,
          'Disques pleins/ventilés standard',
        );
      useCases = this.sectionExtractor.buildUseCases(
        percesSection || '',
        rainuresSection || '',
        standardSection || '',
      );
      useCasesRaw =
        (percesSection || '') +
        '\n' +
        (rainuresSection || '') +
        '\n' +
        (standardSection || '');
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

    const useCasesValidation = this.qualityGates.validateSection(
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
    const guideFaqs =
      this.sectionExtractor.extractFaqFromMarkdown(guideContent);
    const fmFaqs = v4Data?.faq?.length
      ? v4Data.faq
      : this.yamlParser.parseFrontmatterFaq(gammeContent);
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
    const faqValidation = this.qualityGates.validateSection(
      'faq',
      allFaqs,
      family,
    );
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

    if (allFaqs.length >= MIN_FAQS && allFaqs.length < ADVISORY_FAQ_COUNT) {
      this.logger.warn(
        `FAQ advisory for ${gammeName}: ${allFaqs.length} FAQs (recommended: ${ADVISORY_FAQ_COUNT}+)`,
      );
    }

    // ── Extract how_to_choose ──
    let howToChooseContent: string | null = null;

    if (v4Data?.howToChoose) {
      howToChooseContent = v4Data.howToChoose;
    }
    if (!howToChooseContent && pageContract?.howToChoose) {
      howToChooseContent = pageContract.howToChoose;
    }
    if (!howToChooseContent) {
      const choixSection =
        this.sectionExtractor.extractSection(allContent, 'Criteres de choix') ||
        this.sectionExtractor.extractSection(allContent, 'Critères de choix') ||
        this.sectionExtractor.extractSection(allContent, 'Comment choisir') ||
        this.sectionExtractor.extractSection(allContent, 'Guide de choix') ||
        this.sectionExtractor.extractSection(allContent, 'Bien choisir');
      if (choixSection) {
        const items = this.textUtils.extractBulletList(choixSection);
        if (items.length >= 2) {
          howToChooseContent = items.slice(0, 5).join('. ') + '.';
        }
      }
    }

    if (howToChooseContent) {
      const htcValidation = this.qualityGates.validateSection(
        'how_to_choose',
        howToChooseContent,
        family,
      );
      results['how_to_choose'] = {
        ok: htcValidation.ok,
        flags: htcValidation.flags,
        content: howToChooseContent,
        sources,
        confidence,
        sourcesCitation: citation,
        rawAnswer: howToChooseContent,
      };
    }

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
    const claims = ClaimExtractor.extractClaims(
      results,
      sources,
      evidenceEntries,
      brief,
    );

    if (brief && claims.length > 0) {
      const unverifiedCount = claims.filter(
        (c) => c.status === 'unverified',
      ).length;
      this.logger.log(
        `Claims extracted: ${claims.length} total, ${unverifiedCount} unverified (brief: ${brief.page_role} v${brief.version})`,
      );
    }

    return { sections: results, evidencePack: evidenceEntries, claims };
  }

  // ── Guide doc ID resolver ──

  /**
   * Find the guide doc ID for a gamme slug by trying multiple variants.
   */
  private static readonly RAG_GUIDES_DIR = `${RAG_KNOWLEDGE_PATH}/guides`;

  /** Cached list of guide filenames on disk (loaded once). */
  private guideFilesCache: string[] | null = null;

  private getGuideFiles(): string[] {
    if (this.guideFilesCache) return this.guideFilesCache;
    try {
      this.guideFilesCache = readdirSync(
        BuyingGuideRagFetcherService.RAG_GUIDES_DIR,
      )
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace(/\.md$/, ''));
    } catch {
      this.guideFilesCache = [];
    }
    return this.guideFilesCache;
  }

  async findGuideDocId(slug: string): Promise<string | null> {
    // ── Step 1: Build slug variants ──
    const variants: string[] = [
      slug,
      slug.replace(/-de-|-du-|-des-|-d-|-la-|-le-|-les-|-l-/g, '-'),
    ];

    const parts = slug.split('-');
    if (parts.length > 0 && !parts[0].endsWith('s')) {
      variants.push(parts[0] + 's-' + parts.slice(1).join('-'));
      variants.push(
        (parts[0] + 's-' + parts.slice(1).join('-')).replace(
          /-de-|-du-|-des-|-d-|-la-|-le-|-les-|-l-/g,
          '-',
        ),
      );
      variants.push(parts[0] + 's');
    }

    if (parts.length > 1) {
      variants.push(parts[0]);
      if (!parts[0].endsWith('s')) {
        variants.push(parts[0] + 's');
      }
    }

    const uniqueVariants = [
      ...new Set(
        variants
          .map((v) => v.replace(/--+/g, '-').replace(/^-|-$/g, ''))
          .filter(Boolean),
      ),
    ];

    // ── Step 2: Disk-first resolution (zero API calls) ──
    const guideFiles = this.getGuideFiles();

    // Exact match against disk files
    for (const variant of uniqueVariants) {
      const fileName = `choisir-${variant}`;
      if (guideFiles.includes(fileName)) {
        const docId = `guides.${fileName}`;
        this.logger.log(
          `Found guide doc on disk: ${docId} (variant: ${variant})`,
        );
        return docId;
      }
    }

    // Fuzzy match against disk files (word overlap)
    const slugWords = slug
      .replace(/-/g, ' ')
      .split(' ')
      .filter((w) => w.length > 2);

    if (slugWords.length > 0 && guideFiles.length > 0) {
      let bestMatch: string | null = null;
      let bestScore = 0;

      for (const fileName of guideFiles) {
        if (!fileName.startsWith('choisir-')) continue;
        const docWords = fileName.replace('choisir-', '').split('-');

        const score = slugWords.filter((w) =>
          docWords.some((dw) => dw.startsWith(w) || w.startsWith(dw)),
        ).length;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = `guides.${fileName}`;
        }
      }

      if (bestMatch && bestScore >= 1) {
        this.logger.log(
          `Fuzzy matched guide doc on disk: ${bestMatch} (score=${bestScore})`,
        );
        return bestMatch;
      }
    }

    // No guide doc exists on disk for this gamme
    return null;
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

  // ── v4 schema frontmatter parser (js-yaml) ──

  /**
   * Parse v4 schema frontmatter using js-yaml.
   * Detects v4 via `rendering.quality.version === 'GammeContentContract.v4'`
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
      const fmBlock = this.yamlParser.extractFrontmatterBlock(content);
      if (!fmBlock) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fm = yaml.load(fmBlock) as Record<string, any>;
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

      const args: Array<{ title: string; content: string }> = (
        rendering.arguments || []
      )
        .map((a: { title?: string; icon?: string; source_ref?: string }) => ({
          title: a.title || '',
          content: a.title || '',
        }))
        .filter((a: { title: string }) => a.title);

      const antiMistakes: string[] = (selection.anti_mistakes || []).filter(
        (s: unknown) => typeof s === 'string' && s.length > 0,
      );

      const symptoms: string[] = (diagnostic.symptoms || [])
        .map((s: { label?: string } | string) =>
          typeof s === 'string' ? s : s?.label || '',
        )
        .filter((s: string) => s.length > 0);

      const selectionCriteria: string[] = (selection.criteria || []).filter(
        (s: unknown) => typeof s === 'string' && s.length > 0,
      );

      const howToChoose =
        selectionCriteria.length > 0 ? selectionCriteria.join('. ') : null;

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

  private isNonFrenchContent(content: string): boolean {
    const fmBlock = this.yamlParser.extractFrontmatterBlock(content);
    if (fmBlock) {
      const langMatch = fmBlock.match(/^lang:\s*(\w+)/m);
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
}
