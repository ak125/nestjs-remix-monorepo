import { Injectable, Logger, Optional } from '@nestjs/common';
import { RagFoundationGateService } from '../../rag-proxy/services/rag-foundation-gate.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { PageBriefService } from './page-brief.service';
import type {
  SectionResult,
  EnrichmentResult,
} from '../dto/buying-guide-enrich.dto';
import type { GammeContentQualityFlag } from '../../../config/buying-guide-quality.constants';
import {
  FLAG_PENALTIES,
  MIN_QUALITY_SCORE,
} from '../../../config/buying-guide-quality.constants';
import {
  BuyingGuideRagFetcherService,
  BuyingGuideQualityGatesService,
  BuyingGuideDbService,
  BuyingGuideSeoDraftService,
  ClaimExtractor,
  type EnrichDryRunSection,
  type EnrichDryRunResult,
} from './buying-guide';

// Re-export types for backward compatibility
export type { EnrichDryRunSection, EnrichDryRunResult } from './buying-guide';

/**
 * Thin orchestrator for buying guide enrichment.
 * Delegates heavy work to specialized sub-services:
 * - BuyingGuideRagFetcherService: RAG content fetching + parsing
 * - BuyingGuideQualityGatesService: quality validation gates
 * - BuyingGuideDbService: DB read/write operations
 * - BuyingGuideSeoDraftService: SEO draft generation
 * - ClaimExtractor: static claims/evidence extraction
 */
@Injectable()
export class BuyingGuideEnricherService {
  private readonly logger = new Logger(BuyingGuideEnricherService.name);

  constructor(
    private readonly ragFetcher: BuyingGuideRagFetcherService,
    private readonly qualityGates: BuyingGuideQualityGatesService,
    private readonly dbService: BuyingGuideDbService,
    private readonly seoDraft: BuyingGuideSeoDraftService,
    private readonly flags: FeatureFlagsService,
    @Optional() private readonly pageBriefService?: PageBriefService,
    @Optional()
    private readonly foundationGate?: RagFoundationGateService,
  ) {}

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
    const meta = await this.dbService.fetchGammeMetadata(pgId);
    if (!meta) {
      throw new Error(`Gamme not found for pgId=${pgId}`);
    }
    const { gammeName, family, pgAlias } = meta;

    // F1-GATE: Foundation Write Lock — refuse enrichment if Phase 1 not passed
    if (!dryRun && pgAlias && this.foundationGate) {
      const gate = await this.foundationGate.guardWriteForGamme(pgAlias);
      if (!gate.passed && gate.total > 0) {
        this.logger.warn(
          `F1-GATE: skipping R2 enrichment for "${pgAlias}" — ${gate.blockedSources.length}/${gate.total} docs blocked`,
        );
        return {
          pgId,
          sections: {},
          averageConfidence: 0,
          updated: false,
          sectionsUpdated: 0,
          skippedSections: ['F1_GATE_BLOCKED'],
        };
      }
    }

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
          brief = await this.pageBriefService.getActiveBrief(
            parseInt(pgId),
            'R1',
          );
        }
        if (brief) {
          this.logger.log(
            `Brief loaded: canonicalRole=R6_GUIDE_ACHAT, legacyInput=${brief.page_role}, pgId=${pgId}, v=${brief.version}, confidence=${brief.confidence_score}`,
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
    } = await this.ragFetcher.enrichFromRag(
      gammeName,
      family,
      supplementaryFiles,
      brief,
    );

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
    const antiWikiGate = this.qualityGates.checkAntiWikiGate(sectionResults);

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
    const updatePayload = this.dbService.buildUpdatePayload(
      sectionResults,
      sourceUri,
      sourceRef,
      avgConfidence,
      qualityScore,
    );

    // Guard: skip intro_role write if content describes a different piece
    if (
      typeof updatePayload.sgpg_intro_role === 'string' &&
      ClaimExtractor.isIntroRoleMismatch(
        updatePayload.sgpg_intro_role as string,
        gammeName,
      )
    ) {
      this.logger.warn(
        `INTRO_ROLE_MISMATCH for pgId=${pgId}: intro_role describes different piece than "${gammeName}", skipping intro_role write`,
      );
      delete updatePayload.sgpg_intro_role;
    }

    await this.dbService.upsertBuyingGuide(pgId, updatePayload);

    // Generate sg_content_draft from enriched sections
    await this.seoDraft.writeSeoContentDraft(
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
}
