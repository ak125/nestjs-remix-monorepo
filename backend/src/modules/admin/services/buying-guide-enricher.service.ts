import { Injectable, Logger, Optional } from '@nestjs/common';
import { RagFoundationGateService } from '../../rag-proxy/services/rag-foundation-gate.service';
import {
  ContentWriteGateService,
  type WriteGateResult,
} from '../../../config/content-write-gate.service';
import { SOURCE_TIER } from '../../../config/source-provenance.constants';
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
  ClaimExtractor,
  type EnrichDryRunSection,
  type EnrichDryRunResult,
} from './buying-guide';
import { RoleId } from '../../../config/role-ids';

// Re-export types for backward compatibility
export type { EnrichDryRunSection, EnrichDryRunResult } from './buying-guide';

/**
 * Thin orchestrator for buying guide enrichment.
 * Delegates heavy work to specialized sub-services:
 * - BuyingGuideRagFetcherService: RAG content fetching + parsing
 * - BuyingGuideQualityGatesService: quality validation gates
 * - BuyingGuideDbService: DB reads + payload shaping
 * - ClaimExtractor: static claims/evidence extraction
 * Writes go through ContentWriteGateService only (see persistBuyingGuide).
 */
@Injectable()
export class BuyingGuideEnricherService {
  private readonly logger = new Logger(BuyingGuideEnricherService.name);

  constructor(
    private readonly ragFetcher: BuyingGuideRagFetcherService,
    private readonly qualityGates: BuyingGuideQualityGatesService,
    private readonly dbService: BuyingGuideDbService,
    private readonly writeGate: ContentWriteGateService,
    @Optional() private readonly pageBriefService?: PageBriefService,
    @Optional()
    private readonly foundationGate?: RagFoundationGateService,
  ) {}

  /**
   * Enrich one or more buying guides using RAG-sourced content.
   * dryRun=true → returns preview with quality gates
   * dryRun=false → governed write, refused for RAG provenance (0 rows,
   *   `updated: false`, `reason: 'rag_provenance_refused'`)
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
    _conservativeMode = false,
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

    // 7. Governed write (refused for RAG provenance — see persistBuyingGuide)
    const okSections = Object.entries(sectionResults).filter(([, r]) => r.ok);
    const skippedSections = Object.entries(sectionResults)
      .filter(([, r]) => !r.ok)
      .map(([key]) => key);

    if (okSections.length === 0) {
      // ── Metadata-only gatekeeper write ──
      // Even when all RAG sections are skipped (anti-wiki / anti-dup / pollution),
      // the gate verdict is still computed from those RAG sections, so it goes
      // through the same governed write as content (RAG provenance → refused).
      const gatekeeper = this.qualityGates.computeGatekeeperScore({
        sectionResults,
        qualityFlags: uniqueFlags,
        qualityScore,
        antiWikiGate,
      });
      const gateOnlyPayload: Record<string, unknown> = {
        sgpg_gatekeeper_score: gatekeeper.score,
        sgpg_gatekeeper_flags: [...gatekeeper.flags, 'ALL_SECTIONS_SKIPPED'],
        sgpg_gatekeeper_checks: {
          ...gatekeeper.checks,
          all_sections_skipped: true,
        },
        sgpg_source_verified: false,
        sgpg_source_verified_by: 'pipeline:rag-enrich-skipped',
        sgpg_source_verified_at: new Date().toISOString(),
      };
      const gateOnlyWrite = await this.persistBuyingGuide(
        pgId,
        gateOnlyPayload,
        `enrich-skipped-${pgId}-${Date.now().toString(36)}`,
      );

      return {
        pgId,
        sections: {},
        averageConfidence: 0,
        updated: false,
        sectionsUpdated: 0,
        skippedSections: gateOnlyWrite.written
          ? Object.keys(sectionResults)
          : [
              ...Object.keys(sectionResults),
              writeRefusalFlag(gateOnlyWrite.reason),
            ],
        reason: gateOnlyWrite.written ? undefined : gateOnlyWrite.reason,
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

    // Gatekeeper verdict — same shape as the former R1EnricherService fields
    // (r1s_gatekeeper_{score,flags}); that service was removed 2026-07 (RAG→R1).
    // Persisted in the same UPDATE as content columns so the BEFORE UPDATE
    // trigger `trg_invalidate_sgpg_gatekeeper` keeps our fresh values instead
    // of nulling them out.
    const gatekeeper = this.qualityGates.computeGatekeeperScore({
      sectionResults,
      qualityFlags: uniqueFlags,
      qualityScore,
      antiWikiGate,
    });
    updatePayload.sgpg_gatekeeper_score = gatekeeper.score;
    updatePayload.sgpg_gatekeeper_flags = gatekeeper.flags;
    updatePayload.sgpg_gatekeeper_checks = gatekeeper.checks;

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

    const write = await this.persistBuyingGuide(
      pgId,
      updatePayload,
      `enrich-${pgId}-${Date.now().toString(36)}`,
    );
    if (!write.written) {
      return {
        pgId,
        sections: {},
        averageConfidence: avgConfidence,
        updated: false,
        sectionsUpdated: 0,
        skippedSections: [...skippedSections, writeRefusalFlag(write.reason)],
        reason: write.reason,
        evidencePack: evidenceEntries,
      };
    }

    // Architecture: BuyingGuideEnricher (R6) must NOT write sg_content_draft to __seo_gamme (R1).
    // R1 content is exclusively managed by R1ContentPipelineService.
    // sg_content_draft write REMOVED to prevent dual-write conflicts and content regression.
    this.logger.log(
      `sg_content_draft SKIPPED for pgId=${pgId} — R1 content managed by R1ContentPipelineService`,
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

  /**
   * Persist a buying-guide payload through the governed write gate.
   *
   * Buying-guide sections — and the gatekeeper verdict computed from them — are
   * sourced from legacy RAG gamme docs (ADR-031/046): they must never reach the
   * served `__seo_gamme_purchase_guide` table. The write is stamped
   * `provenance = RAG_LEGACY`, which the gate refuses (0 rows) — there is no
   * direct-update fallback (writeGate is a required dependency). Same shape as
   * R2EnricherService.persistR2KeywordPlan.
   */
  private persistBuyingGuide(
    pgId: string,
    payload: Record<string, unknown>,
    correlationId: string,
  ): Promise<WriteGateResult> {
    return this.writeGate.writeToTarget({
      roleId: RoleId.R6_GUIDE_ACHAT,
      target: 'purchase_guide_main',
      pkValue: pgId,
      payload,
      correlationId,
      provenance: SOURCE_TIER.RAG_LEGACY,
    });
  }
}

/** skippedSections marker for a refused write (same flags as the R2 enricher). */
function writeRefusalFlag(reason: string | undefined): string {
  return reason === 'rag_provenance_refused'
    ? 'RAG_SOURCE_REFUSED'
    : 'WRITE_GATE_BLOCKED';
}
