import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { createHash } from 'node:crypto';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { ConfigService } from '@nestjs/config';
import { BuyingGuideEnricherService } from '../../modules/admin/services/buying-guide-enricher.service';
import { ConseilEnricherService } from '../../modules/admin/services/conseil-enricher.service';
import { ReferenceService } from '../../modules/seo/services/reference.service';
import { DiagnosticService } from '../../modules/seo/services/diagnostic.service';
import { BriefGatesService } from '../../modules/admin/services/brief-gates.service';
import { HardGatesService } from '../../modules/admin/services/hard-gates.service';
import type {
  AnyContentRefreshJobData,
  ContentRefreshResult,
  ExtendedGateResult,
  RepairAction,
  RepairActionResult,
  AutoRepairAttempt,
  RepairResult,
  EvidenceEntry,
  SafeFallbackDraft,
} from '../types/content-refresh.types';

@Processor('seo-monitor')
export class ContentRefreshProcessor extends SupabaseBaseService {
  protected override readonly logger = new Logger(ContentRefreshProcessor.name);

  constructor(
    configService: ConfigService,
    private readonly buyingGuideEnricher: BuyingGuideEnricherService,
    private readonly conseilEnricher: ConseilEnricherService,
    private readonly referenceService: ReferenceService,
    private readonly diagnosticService: DiagnosticService,
    private readonly briefGatesService: BriefGatesService,
    private readonly hardGatesService: HardGatesService,
  ) {
    super(configService);
  }

  @Process({ name: 'content-refresh', concurrency: 1 })
  async handleContentRefresh(
    job: Job<AnyContentRefreshJobData>,
  ): Promise<ContentRefreshResult> {
    const { refreshLogId, pageType } = job.data;
    // R5 uses diagnosticSlug, gamme-based types use pgId/pgAlias
    const pgId = 'pgId' in job.data ? job.data.pgId : 0;
    const pgAlias = 'pgAlias' in job.data ? job.data.pgAlias : '';
    const diagnosticSlug =
      'diagnosticSlug' in job.data ? job.data.diagnosticSlug : '';
    const supplementaryFiles =
      'supplementaryFiles' in job.data
        ? ((job.data as { supplementaryFiles?: string[] }).supplementaryFiles ??
          [])
        : [];

    this.logger.log(
      `Processing content-refresh: ${diagnosticSlug || pgAlias}, pageType=${pageType}, logId=${refreshLogId}`,
    );

    // Mark as processing
    await this.client
      .from('__rag_content_refresh_log')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .eq('id', refreshLogId);

    try {
      let qualityScore: number | null = 0;
      let qualityFlags: string[] = [];
      let errorMessage: string | undefined;
      // RAG-as-Optional-Overlay: track when RAG is absent (normal condition)
      let ragSkipped = false;
      let ragSkipReason: string | undefined;

      switch (pageType) {
        case 'R1_pieces':
        case 'R3_guide_achat': {
          // Delegate to BuyingGuideEnricherService
          const enrichResults = await this.buyingGuideEnricher.enrich(
            [String(pgId)],
            false,
            supplementaryFiles,
          );
          const result = enrichResults[0];
          if (result && 'averageConfidence' in result) {
            const avgConf = (result as { averageConfidence: number })
              .averageConfidence;
            const skipped =
              (result as { skippedSections?: string[] }).skippedSections || [];
            const updated = (result as { updated?: boolean }).updated;
            const sections =
              (result as { sections?: Record<string, unknown> }).sections || {};

            if (
              !updated &&
              avgConf === 0 &&
              skipped.length > 0 &&
              skipped.length >= Object.keys(sections).length
            ) {
              // All sections skipped = no RAG data (NORMAL)
              ragSkipped = true;
              ragSkipReason = 'NO_RAG_DATA_AVAILABLE';
              qualityFlags = skipped.map(
                (s: string) => `SKIPPED_${s.toUpperCase()}`,
              );
            } else {
              qualityScore = avgConf >= 0.8 ? 85 : 60;
              qualityFlags = skipped.map(
                (s: string) => `SKIPPED_${s.toUpperCase()}`,
              );
            }
          } else if (result && 'qualityScore' in result) {
            qualityScore = (result as { qualityScore: number }).qualityScore;
            qualityFlags = (result as { qualityFlags: string[] }).qualityFlags;
          }
          break;
        }

        case 'R4_reference': {
          // Delegate to ReferenceService.refreshSingleGamme() for RAG-based enrichment
          const refResult =
            await this.referenceService.refreshSingleGamme(pgAlias);

          if (refResult.created) {
            qualityScore = 80;
            qualityFlags = ['NEW_ENTRY_CREATED'];
          } else if (refResult.updated) {
            qualityScore = 85;
            qualityFlags = ['EXISTING_ENTRY_UPDATED'];
          } else if (refResult.skipped) {
            // No RAG file = normal condition, not an error
            ragSkipped = true;
            ragSkipReason = 'NO_RAG_DATA_AVAILABLE';
            qualityFlags = ['NO_RAG_DATA_AVAILABLE'];
          }
          break;
        }

        case 'R3_conseils': {
          // Delegate to ConseilEnricherService
          const conseilResult = await this.conseilEnricher.enrichSingle(
            String(pgId),
            pgAlias,
            supplementaryFiles,
          );
          qualityScore = conseilResult.score;
          qualityFlags = conseilResult.flags;
          if (conseilResult.status === 'skipped') {
            if (
              conseilResult.reason === 'NO_RAG_DOC' ||
              conseilResult.reason === 'NO_PAGE_CONTRACT'
            ) {
              // No RAG doc or unparseable = normal, not an error
              ragSkipped = true;
              ragSkipReason = conseilResult.reason;
            } else if (conseilResult.reason === 'NO_ENRICHMENT_NEEDED') {
              // Already fully enriched, nothing to do
              ragSkipped = true;
              ragSkipReason = conseilResult.reason;
              qualityScore = 100;
            }
          }
          break;
        }

        case 'R5_diagnostic': {
          // R5 = symptom-slug-first, keyed by diagnosticSlug
          const diagResult =
            await this.diagnosticService.refreshFromRag(diagnosticSlug);

          if (diagResult.skipped) {
            ragSkipped = true;
            ragSkipReason = 'NO_DIAGNOSTIC_RAG_DOC';
            qualityFlags = ['NO_DIAGNOSTIC_RAG_DOC'];
          } else if (diagResult.updated) {
            qualityScore = diagResult.confidence >= 0.8 ? 85 : 65;
            qualityFlags = diagResult.flags;
          }
          break;
        }

        default:
          errorMessage = `Unknown page type: ${pageType}`;
          qualityFlags = ['UNKNOWN_PAGE_TYPE'];
      }

      // Inject internal link markers post-enrichment (Gap 3)
      // Skip when RAG is absent — no enriched content to scan
      if (
        !ragSkipped &&
        (qualityScore ?? 0) >= 70 &&
        pageType !== 'R4_reference'
      ) {
        try {
          const markersCount = await this.injectLinkMarkers(
            pgId,
            pgAlias,
            pageType,
          );
          if (markersCount > 0) {
            qualityFlags.push(`LINKS_INJECTED_${markersCount}`);
            this.logger.log(
              `Injected ${markersCount} link markers for ${pgAlias}/${pageType}`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Link marker injection failed for ${pgAlias}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }

      // Determine final status
      let finalStatus: ContentRefreshResult['status'];

      if (ragSkipped) {
        // RAG absent = neutral condition, not an error
        finalStatus = 'skipped';
      } else if ((qualityScore ?? 0) >= 70) {
        finalStatus = 'draft';
      } else {
        finalStatus = 'failed';
      }

      // Auto-publish if quality score >= 85 AND gates pass AND QA SEO guard passes
      const AUTO_PUBLISH_THRESHOLD = 85;
      let briefId: number | null = null;
      let briefVersion: number | null = null;
      let gateResults: unknown[] = [];
      let hardGateResults: ExtendedGateResult[] | null = null;
      let repairAttempts: AutoRepairAttempt[] | null = null;

      if (
        finalStatus === 'draft' &&
        (qualityScore ?? 0) >= AUTO_PUBLISH_THRESHOLD &&
        pageType !== 'R5_diagnostic'
      ) {
        // Soft gates (Phase 3 — brief-based)
        let softCanPublish = true;
        if (process.env.BRIEF_GATES_ENABLED === 'true') {
          const draftContent = await this.loadCurrentContent(
            pgId,
            pgAlias,
            pageType,
          );
          const gateOutput = await this.briefGatesService.runPrePublishGates(
            pgId,
            pgAlias,
            pageType,
            draftContent,
          );
          briefId = gateOutput.briefId;
          briefVersion = gateOutput.briefVersion;
          gateResults = gateOutput.gates;
          qualityFlags.push(...gateOutput.flags);
          softCanPublish = gateOutput.canPublish;

          if (!softCanPublish) {
            this.logger.log(
              `Brief gates blocked auto-publish for ${pgAlias}/${pageType} — staying draft`,
            );
          }
        }

        // Hedging soft gate (log only, never blocks alone)
        const draftForHedge = await this.loadCurrentContent(
          pgId,
          pgAlias,
          pageType,
        );
        const hedgeResult = this.hardGatesService.countHedges(draftForHedge);
        if (hedgeResult.count > 6) qualityFlags.push('HEDGING_FAIL');
        else if (hedgeResult.count > 2) qualityFlags.push('HEDGING_WARN');

        // Hard gates + auto-repair orchestration
        const result = await this.runHardGatesWithRepair(
          pgId,
          pgAlias,
          pageType,
          qualityScore ?? 0,
          qualityFlags,
          softCanPublish,
        );
        finalStatus = result.finalStatus;
        hardGateResults = result.hardGates;
        if (result.repairResult?.attempts?.length) {
          repairAttempts = result.repairResult.attempts;
        }
        qualityFlags.push(result.reason);

        if (finalStatus === 'auto_published') {
          await this.markAsPublished(pgId, pgAlias, pageType);
        }

        // Unified publish_decision log for rollout monitoring
        this.logger.log(
          JSON.stringify({
            event: 'publish_decision',
            pgAlias,
            pageType,
            finalStatus,
            reason: result.reason,
            qualityScore,
            isCanary:
              (process.env.CANARY_GAMMES || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .includes(pgAlias) ||
              (process.env.CANARY_GAMMES || '').trim() === '*',
            hardGatesEnabled: process.env.HARD_GATES_ENABLED === 'true',
            autoRepairEnabled: process.env.AUTO_REPAIR_ENABLED === 'true',
            repairPasses: result.repairResult?.totalPasses ?? 0,
            repairDurationMs: result.repairResult?.durationMs ?? 0,
            softCanPublish,
            hedgeCount: hedgeResult.count,
          }),
        );
      }

      // Update dependent tables — skip when RAG absent (no content changed)
      if (finalStatus !== 'skipped') {
        if (pageType === 'R1_pieces' || pageType === 'R3_guide_achat') {
          if (finalStatus === 'draft') {
            await this.client
              .from('__seo_gamme_purchase_guide')
              .update({ sgpg_is_draft: true })
              .eq('sgpg_pg_id', String(pgId));
          }
        }
      }

      // Update tracking log
      const now = new Date().toISOString();
      await this.client
        .from('__rag_content_refresh_log')
        .update({
          status: finalStatus,
          quality_score: ragSkipped ? null : qualityScore,
          quality_flags: qualityFlags,
          completed_at: now,
          error_message:
            finalStatus === 'failed'
              ? errorMessage || 'Quality score below threshold'
              : null,
          ...(finalStatus === 'auto_published'
            ? { published_at: now, published_by: 'auto' }
            : {}),
          // Brief traceability (Phase 2+3)
          brief_id: briefId,
          brief_version: briefVersion,
          gate_results: gateResults.length > 0 ? gateResults : null,
          // Auto-repair traceability (Phase 4+5)
          hard_gate_results: hardGateResults,
          repair_attempts: repairAttempts,
        })
        .eq('id', refreshLogId);

      this.logger.log(
        `Content-refresh complete: ${diagnosticSlug || pgAlias}/${pageType} → ${finalStatus}` +
          (ragSkipped
            ? ` (ragSkipped: ${ragSkipReason})`
            : ` (score=${qualityScore})`),
      );

      return {
        status: finalStatus,
        qualityScore: ragSkipped ? null : qualityScore,
        qualityFlags,
        errorMessage,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Content-refresh failed: ${pgAlias}/${pageType} — ${msg}`,
      );

      await this.client
        .from('__rag_content_refresh_log')
        .update({
          status: 'failed',
          error_message: msg,
          completed_at: new Date().toISOString(),
        })
        .eq('id', refreshLogId);

      return {
        status: 'failed',
        qualityScore: 0,
        qualityFlags: ['EXCEPTION'],
        errorMessage: msg,
      };
    }
  }

  /**
   * Scan enriched content for mentions of other gamme names
   * and inject #LinkGamme_{pg_id}# markers for InternalLinkingService.
   */
  private async injectLinkMarkers(
    pgId: number,
    pgAlias: string,
    pageType: string,
  ): Promise<number> {
    const { data: gammes } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_display', '1')
      .neq('pg_alias', pgAlias)
      .neq('pg_alias', '')
      .limit(200);

    if (!gammes?.length) return 0;

    let markersInserted = 0;

    if (pageType === 'R1_pieces' || pageType === 'R3_guide_achat') {
      const { data: guide } = await this.client
        .from('__seo_gamme_purchase_guide')
        .select('sgpg_id, sgpg_how_to_choose, sgpg_symptoms, sgpg_faq')
        .eq('sgpg_pg_id', String(pgId))
        .single();

      if (guide) {
        const fields = [
          'sgpg_how_to_choose',
          'sgpg_symptoms',
          'sgpg_faq',
        ] as const;
        for (const field of fields) {
          const content = guide[field] as string | null;
          if (!content) continue;
          const updated = this.insertMarkers(content, gammes, 3);
          if (updated !== content) {
            await this.client
              .from('__seo_gamme_purchase_guide')
              .update({ [field]: updated })
              .eq('sgpg_id', guide.sgpg_id);
            markersInserted++;
          }
        }
      }
    }

    if (pageType === 'R3_conseils') {
      // Conseil uses row-per-section model (sgc_content + sgc_section_type)
      const { data: sections } = await this.client
        .from('__seo_gamme_conseil')
        .select('sgc_id, sgc_content, sgc_section_type')
        .eq('sgc_pg_id', String(pgId));

      if (sections?.length) {
        for (const section of sections) {
          const content = section.sgc_content as string | null;
          if (!content) continue;
          const updated = this.insertMarkers(content, gammes, 3);
          if (updated !== content) {
            await this.client
              .from('__seo_gamme_conseil')
              .update({ sgc_content: updated })
              .eq('sgc_id', section.sgc_id);
            markersInserted++;
          }
        }
      }
    }

    return markersInserted;
  }

  /**
   * Replace first occurrence of gamme names in text with link markers.
   * Max `maxMarkers` replacements per text block.
   */
  private insertMarkers(
    text: string,
    gammes: Array<{ pg_id: number; pg_alias: string; pg_name: string }>,
    maxMarkers: number,
  ): string {
    let result = text;
    let count = 0;

    for (const g of gammes) {
      if (count >= maxMarkers) break;
      const name = (g.pg_name || '').trim();
      if (name.length < 4) continue; // skip very short names
      const marker = `#LinkGamme_${g.pg_id}#`;
      if (result.includes(marker)) continue; // already has this marker
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escaped})\\b`, 'i');
      if (regex.test(result)) {
        result = result.replace(regex, `$1 ${marker}`);
        count++;
      }
    }

    return result;
  }

  /**
   * QA SEO Guard: check if protected fields for a specific gamme
   * have been mutated since baseline was captured.
   * Returns true if safe to auto-publish, false if blocked.
   */
  private async checkQaGuardForGamme(
    pgId: number,
    pgAlias: string,
    pageType: string,
  ): Promise<boolean> {
    const { data: baseline } = await this.client
      .from('__qa_protected_meta_hash')
      .select('seo_hash, ref_hash, h1_override_hash')
      .eq('pg_alias', pgAlias)
      .single();

    // No baseline = gamme not protected → safe to publish
    if (!baseline) return true;

    // Check SEO fields (applies to R1, R3_guide, R3_conseils)
    if (
      pageType === 'R1_pieces' ||
      pageType === 'R3_guide_achat' ||
      pageType === 'R3_conseils'
    ) {
      const { data: seo } = await this.client
        .from('__seo_gamme')
        .select('sg_title, sg_h1, sg_descrip')
        .eq('sg_pg_id', String(pgId))
        .single();

      if (seo) {
        const hash = this.md5Gate(
          (seo.sg_title as string) || '',
          (seo.sg_h1 as string) || '',
          (seo.sg_descrip as string) || '',
        );
        if (hash !== baseline.seo_hash) return false;
      }
    }

    // Check H1 override (applies to R1, R3_guide)
    if (pageType === 'R1_pieces' || pageType === 'R3_guide_achat') {
      const { data: pg } = await this.client
        .from('__seo_gamme_purchase_guide')
        .select('sgpg_h1_override')
        .eq('sgpg_pg_id', String(pgId))
        .single();

      if (pg) {
        const hash = createHash('md5')
          .update((pg.sgpg_h1_override as string) || '')
          .digest('hex');
        if (hash !== baseline.h1_override_hash) return false;
      }
    }

    // Check reference fields (applies to R4)
    if (pageType === 'R4_reference') {
      const { data: ref } = await this.client
        .from('__seo_reference')
        .select('title, meta_description, canonical_url')
        .eq('slug', pgAlias)
        .single();

      if (ref) {
        const hash = this.md5Gate(
          (ref.title as string) || '',
          (ref.meta_description as string) || '',
          (ref.canonical_url as string) || '',
        );
        if (hash !== baseline.ref_hash) return false;
      }
    }

    return true;
  }

  /**
   * Mark dependent tables as published after auto-publish.
   * Mirrors logic from ContentRefreshService.publishRefresh().
   */
  private async markAsPublished(
    pgId: number,
    pgAlias: string,
    pageType: string,
  ): Promise<void> {
    if (pageType === 'R1_pieces' || pageType === 'R3_guide_achat') {
      await this.client
        .from('__seo_gamme_purchase_guide')
        .update({ sgpg_is_draft: false })
        .eq('sgpg_pg_id', String(pgId));
    }

    if (pageType === 'R4_reference') {
      await this.client
        .from('__seo_reference')
        .update({ is_published: true })
        .eq('slug', pgAlias);
    }
  }

  /** MD5 with '||' separator — mirrors PostgreSQL hash formula */
  private md5Gate(...fields: string[]): string {
    return createHash('md5').update(fields.join('||')).digest('hex');
  }

  // ══════════════════════════════════════════════════════════════════
  // Auto-Repair Orchestration (Phase 4+5)
  // ══════════════════════════════════════════════════════════════════

  private async runHardGatesWithRepair(
    pgId: number,
    pgAlias: string,
    pageType: string,
    qualityScore: number,
    qualityFlags: string[],
    softCanPublish: boolean,
  ): Promise<{
    finalStatus: ContentRefreshResult['status'];
    reason: string;
    hardGates: ExtendedGateResult[] | null;
    repairResult: RepairResult | null;
  }> {
    const maxPasses = Math.min(
      parseInt(process.env.AUTO_REPAIR_MAX_PASSES || '2', 10),
      3,
    );
    const autoRepair = process.env.AUTO_REPAIR_ENABLED === 'true';
    const safeFallback = process.env.SAFE_FALLBACK_ENABLED === 'true';
    const epEnabled = process.env.EVIDENCE_PACK_ENABLED === 'true';
    const hardGatesEnabled = process.env.HARD_GATES_ENABLED === 'true';
    const canaryList = (process.env.CANARY_GAMMES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const isCanary = canaryList.includes(pgAlias) || canaryList.includes('*');
    const hardGatesBlocking =
      hardGatesEnabled && (isCanary || canaryList.includes('*'));

    // (1) Soft gates already failed -> stop
    if (!softCanPublish) {
      return {
        finalStatus: 'draft',
        reason: 'SOFT_GATE_FAIL',
        hardGates: null,
        repairResult: null,
      };
    }

    // (2) Hard gates (observe or blocking)
    let hardGates: ExtendedGateResult[] = [];
    if (epEnabled) {
      const content = await this.loadCurrentContent(pgId, pgAlias, pageType);
      const ep = await this.loadEvidencePack(pgId, pgAlias);
      const allowlist = await this.buildAllowlist(pgId, pgAlias, ep);
      hardGates = this.hardGatesService.runAllHardGates(
        content,
        ep,
        allowlist,
        pgAlias,
        pageType,
        pgId,
      );

      // Check protected field mutations (seo_integrity extension)
      const fieldMutation = await this.checkProtectedFieldMutations(
        pgId,
        pgAlias,
        pageType,
      );
      if (fieldMutation) {
        const seoGate = hardGates.find((g) => g.gate === 'seo_integrity');
        if (seoGate) {
          seoGate.verdict = 'FAIL';
          seoGate.measured += 1;
          seoGate.details.push(fieldMutation);
          if (!seoGate.triggerItems) seoGate.triggerItems = [];
          seoGate.triggerItems.push({
            location: 'protected_field',
            issue: fieldMutation,
          });
        }
      }
    }

    // Log all hard gate results in quality_flags
    for (const g of hardGates) {
      const tag = g.gate.toUpperCase().replace(/_/g, '-');
      if (g.verdict === 'FAIL') qualityFlags.push(`AR-${tag}-FAIL`);
      else if (g.verdict === 'WARN') qualityFlags.push(`AR-${tag}-WARN`);
    }

    let failedGates = hardGates.filter((g) => g.verdict === 'FAIL');

    if (!hardGatesBlocking && failedGates.length > 0) {
      qualityFlags.push('HARD_GATES_OBSERVE_ONLY');
    }

    this.logger.log(
      JSON.stringify({
        event: 'hard_gates_result',
        pgAlias,
        pageType,
        mode: hardGatesBlocking ? 'blocking' : 'observe_only',
        gates: hardGates.map((g) => ({
          gate: g.gate,
          verdict: g.verdict,
          measured: g.measured,
        })),
      }),
    );

    // (3) No FAIL or observe-only -> publish path
    if (failedGates.length === 0 || !hardGatesBlocking) {
      if (isCanary) {
        return {
          finalStatus: 'draft',
          reason: 'CANARY_HOLD',
          hardGates,
          repairResult: null,
        };
      }
      const qaOk = await this.checkQaGuardForGamme(pgId, pgAlias, pageType);
      return qaOk
        ? {
            finalStatus: 'auto_published',
            reason: 'GATES_CLEAN',
            hardGates,
            repairResult: null,
          }
        : {
            finalStatus: 'draft',
            reason: 'QA_GUARD_BLOCKED',
            hardGates,
            repairResult: null,
          };
    }

    // (4) Auto-repair disabled -> draft
    if (!autoRepair) {
      return {
        finalStatus: 'draft',
        reason: 'REPAIR_DISABLED',
        hardGates,
        repairResult: null,
      };
    }

    // (5) REPAIR LOOP
    const startTs = Date.now();
    const attempts: AutoRepairAttempt[] = [];
    let content = await this.loadCurrentContent(pgId, pgAlias, pageType);
    let contentHash = this.md5Gate(content);
    const preRepairContent = content;
    let pass = 0;

    while (pass < maxPasses && failedGates.length > 0) {
      pass++;
      const passStart = new Date().toISOString();
      const hashBefore = contentHash;
      const failingBefore = failedGates.map((g) => g.gate);

      const plan = this.buildRepairPlan(failedGates, pass as 1 | 2);
      const actionResults: RepairActionResult[] = [];
      for (const action of plan) {
        const result = await this.executeRepairAction(
          action,
          pgId,
          pgAlias,
          pageType,
          preRepairContent,
        );
        actionResults.push(result);
      }

      // Anti-loop: content changed?
      content = await this.loadCurrentContent(pgId, pgAlias, pageType);
      const newHash = this.md5Gate(content);
      const changed = newHash !== hashBefore;
      contentHash = newHash;

      // Re-run ONLY failing gates
      const ep = await this.loadEvidencePack(pgId, pgAlias);
      const allowlist = await this.buildAllowlist(pgId, pgAlias, ep);
      const recheck = this.hardGatesService.runHardGatesSubset(
        content,
        ep,
        allowlist,
        pgAlias,
        pageType,
        pgId,
        failingBefore,
      );
      failedGates = recheck.filter((g) => g.verdict === 'FAIL');

      attempts.push({
        pass,
        startedAt: passStart,
        completedAt: new Date().toISOString(),
        failingGatesBefore: failingBefore,
        failingGatesAfter: failedGates.map((g) => g.gate),
        actions: actionResults,
        contentHashBefore: hashBefore,
        contentHashAfter: newHash,
        contentChanged: changed,
      });

      this.logger.log(
        JSON.stringify({
          event: 'auto_repair_pass',
          pgAlias,
          pageType,
          pass,
          maxPasses,
          failingGatesBefore: failingBefore,
          failingGatesAfter: failedGates.map((g) => g.gate),
          contentChanged: changed,
          durationMs: Date.now() - startTs,
        }),
      );

      if (!changed) {
        this.logger.warn(
          `Auto-repair pass ${pass}: no content change for ${pgAlias}, stopping`,
        );
        break;
      }

      // Min content length guard: abort if repair stripped too much
      const plainText = content.replace(/<[^>]+>/g, '').trim();
      if (plainText.length < 200) {
        this.logger.warn(
          `Auto-repair pass ${pass}: content too short (${plainText.length} chars) for ${pgAlias}, aborting repair`,
        );
        qualityFlags.push('REPAIR_CONTENT_TOO_SHORT');
        // Revert to pre-repair content
        await this.writeContentToDb(pgId, pgAlias, pageType, preRepairContent);
        content = preRepairContent;
        break;
      }
    }

    const repairResult: RepairResult = {
      allGatesPassed: failedGates.length === 0,
      totalPasses: pass,
      maxPasses,
      attempts,
      fallbackApplied: false,
      reasonCode:
        failedGates.length === 0
          ? 'REPAIRED'
          : attempts.length > 0 && !attempts[attempts.length - 1].contentChanged
            ? 'REPAIR_NO_PROGRESS'
            : 'REPAIR_EXHAUSTED',
      durationMs: Date.now() - startTs,
    };

    // (6) Post-repair decision
    if (failedGates.length === 0) {
      if (isCanary) {
        return {
          finalStatus: 'draft',
          reason: 'CANARY_REPAIRED_HOLD',
          hardGates,
          repairResult,
        };
      }
      const qaOk = await this.checkQaGuardForGamme(pgId, pgAlias, pageType);
      return qaOk
        ? {
            finalStatus: 'auto_published',
            reason: 'REPAIRED',
            hardGates,
            repairResult,
          }
        : {
            finalStatus: 'draft',
            reason: 'QA_GUARD_BLOCKED',
            hardGates,
            repairResult,
          };
    }

    if (safeFallback) {
      const fb = this.buildSafeFallbackDraft(pgAlias, pageType, pgId);
      await this.writeSafeFallbackToDb(pgId, pgAlias, pageType, fb);
      repairResult.fallbackApplied = true;
      repairResult.reasonCode = 'FALLBACK_APPLIED';
      return {
        finalStatus: 'draft',
        reason: 'FALLBACK_APPLIED',
        hardGates,
        repairResult,
      };
    }

    return {
      finalStatus: 'draft',
      reason: 'REPAIR_EXHAUSTED',
      hardGates,
      repairResult,
    };
  }

  // ── Repair Plan Builder ──

  private buildRepairPlan(
    failedGates: ExtendedGateResult[],
    passLevel: 1 | 2,
  ): RepairAction[] {
    const actions: RepairAction[] = [];

    for (const gate of failedGates) {
      switch (gate.gate) {
        case 'attribution':
          actions.push({
            gate: 'attribution',
            strategy:
              passLevel === 1
                ? 'retrieval_tighten_scope'
                : 'strip_unsourced_numbers',
            description:
              passLevel === 1
                ? 'Re-retrieve with tighter scope, conservative re-enrich'
                : 'Replace unsourced numbers with qualitative equivalents',
            passLevel,
            targets: gate.triggerItems?.map((t) => t.location),
          });
          break;
        case 'no_guess':
          actions.push({
            gate: 'no_guess',
            strategy:
              passLevel === 1
                ? 'retrieval_conservative_reenrich'
                : 'strip_novel_terms',
            description:
              passLevel === 1
                ? 'Re-enrich conservative (skip LLM polish)'
                : 'Strip novel technical terms not in allowlist',
            passLevel,
            targets: gate.triggerItems?.map((t) => t.location),
          });
          break;
        case 'scope_leakage':
          actions.push({
            gate: 'scope_leakage',
            strategy:
              passLevel === 1
                ? 'retrieval_tighten_scope'
                : 'remove_leaking_sentences',
            description:
              passLevel === 1
                ? 'Re-retrieve forcing doc_id = gamme target'
                : 'Remove sentences with cross-gamme technical payload',
            passLevel,
            targets: gate.triggerItems?.map((t) => t.location),
          });
          break;
        case 'contradiction':
          actions.push({
            gate: 'contradiction',
            strategy:
              passLevel === 1
                ? 'keep_evidenced_claim'
                : 'remove_both_contradictions',
            description:
              passLevel === 1
                ? 'Keep claim with highest evidence confidence'
                : 'Remove BOTH contradicting claims',
            passLevel,
            targets: gate.triggerItems?.map((t) => t.location),
          });
          break;
        case 'seo_integrity':
          actions.push({
            gate: 'seo_integrity',
            strategy:
              passLevel === 1
                ? 'restore_protected_fields'
                : 'revert_to_pre_repair',
            description:
              passLevel === 1
                ? 'Restore protected fields from baseline'
                : 'Full revert to pre-repair content',
            passLevel,
          });
          break;
      }
    }

    // seo_integrity always last (can revert other actions)
    actions.sort((a, b) =>
      a.gate === 'seo_integrity' ? 1 : b.gate === 'seo_integrity' ? -1 : 0,
    );

    return actions;
  }

  // ── Repair Action Executor ──

  private async executeRepairAction(
    action: RepairAction,
    pgId: number,
    pgAlias: string,
    pageType: string,
    preRepairContent: string,
  ): Promise<RepairActionResult> {
    try {
      switch (action.strategy) {
        // === PASS 1: Retrieval tightening ===
        case 'retrieval_tighten_scope':
        case 'retrieval_conservative_reenrich': {
          if (pageType === 'R3_conseils') {
            await this.conseilEnricher.enrichSingle(
              String(pgId),
              pgAlias,
              [],
              true,
            );
          } else {
            await this.buyingGuideEnricher.enrich(
              [String(pgId)],
              false,
              [],
              true,
            );
          }
          return {
            action,
            applied: true,
            itemsAffected: 1,
            detail: `Conservative re-enrichment for ${pgAlias}/${pageType}`,
          };
        }

        // === PASS 2: Conservative rewrites ===
        case 'strip_unsourced_numbers': {
          const content = await this.loadCurrentContent(
            pgId,
            pgAlias,
            pageType,
          );
          const stripped = this.stripUnsourcedNumbers(
            content,
            action.targets || [],
          );
          if (stripped !== content) {
            await this.writeContentToDb(pgId, pgAlias, pageType, stripped);
            return {
              action,
              applied: true,
              itemsAffected: (action.targets || []).length,
              detail: 'Stripped unsourced numbers',
            };
          }
          return {
            action,
            applied: false,
            itemsAffected: 0,
            detail: 'No unsourced numbers to strip',
          };
        }

        case 'strip_novel_terms': {
          const content = await this.loadCurrentContent(
            pgId,
            pgAlias,
            pageType,
          );
          const stripped = this.stripNovelTerms(content, action.targets || []);
          if (stripped !== content) {
            await this.writeContentToDb(pgId, pgAlias, pageType, stripped);
            return {
              action,
              applied: true,
              itemsAffected: (action.targets || []).length,
              detail: 'Stripped novel terms',
            };
          }
          return {
            action,
            applied: false,
            itemsAffected: 0,
            detail: 'No novel terms to strip',
          };
        }

        case 'remove_leaking_sentences': {
          const content = await this.loadCurrentContent(
            pgId,
            pgAlias,
            pageType,
          );
          const cleaned = this.removeLeakingSentences(
            content,
            action.targets || [],
          );
          if (cleaned !== content) {
            await this.writeContentToDb(pgId, pgAlias, pageType, cleaned);
            return {
              action,
              applied: true,
              itemsAffected: (action.targets || []).length,
              detail: 'Removed leaking sentences',
            };
          }
          return {
            action,
            applied: false,
            itemsAffected: 0,
            detail: 'No leaking sentences found',
          };
        }

        case 'keep_evidenced_claim':
        case 'remove_both_contradictions': {
          // Contradiction repair: for now, log and mark as attempted
          // Full implementation requires sentence-level claim matching with EP
          const _content = await this.loadCurrentContent(
            pgId,
            pgAlias,
            pageType,
          );
          this.logger.log(
            `Contradiction repair (${action.strategy}) attempted for ${pgAlias}`,
          );
          return {
            action,
            applied: false,
            itemsAffected: 0,
            detail: `Contradiction repair strategy ${action.strategy} — requires manual review`,
          };
        }

        case 'restore_protected_fields': {
          const restored = await this.restoreProtectedFields(
            pgId,
            pgAlias,
            pageType,
          );
          return {
            action,
            applied: restored,
            itemsAffected: restored ? 1 : 0,
            detail: restored
              ? 'Protected fields restored from baseline'
              : 'No restoration needed',
          };
        }

        case 'revert_to_pre_repair': {
          await this.writeContentToDb(
            pgId,
            pgAlias,
            pageType,
            preRepairContent,
          );
          return {
            action,
            applied: true,
            itemsAffected: 1,
            detail: 'Full revert to pre-repair content',
          };
        }

        default:
          return {
            action,
            applied: false,
            itemsAffected: 0,
            detail: `Unknown strategy: ${action.strategy}`,
          };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Repair action failed: ${action.strategy} for ${pgAlias} — ${msg}`,
      );
      return {
        action,
        applied: false,
        itemsAffected: 0,
        detail: `Error: ${msg}`,
      };
    }
  }

  // ── Content I/O ──

  private async loadCurrentContent(
    pgId: number,
    pgAlias: string,
    pageType: string,
  ): Promise<string> {
    if (pageType === 'R1_pieces' || pageType === 'R3_guide_achat') {
      const { data } = await this.client
        .from('__seo_gamme_purchase_guide')
        .select('sgpg_how_to_choose, sgpg_symptoms, sgpg_faq')
        .eq('sgpg_pg_id', String(pgId))
        .single();
      if (!data) return '';
      return [
        data.sgpg_how_to_choose || '',
        data.sgpg_symptoms || '',
        data.sgpg_faq || '',
      ].join('\n');
    }
    if (pageType === 'R3_conseils') {
      const { data } = await this.client
        .from('__seo_gamme_conseil')
        .select('sgc_content')
        .eq('sgc_pg_id', String(pgId))
        .order('sgc_order', { ascending: true });
      if (!data?.length) return '';
      return data.map((r) => (r.sgc_content as string) || '').join('\n');
    }
    if (pageType === 'R4_reference') {
      const { data } = await this.client
        .from('__seo_reference')
        .select('content')
        .eq('slug', pgAlias)
        .single();
      return (data?.content as string) || '';
    }
    return '';
  }

  private async writeContentToDb(
    pgId: number,
    pgAlias: string,
    pageType: string,
    content: string,
  ): Promise<void> {
    if (pageType === 'R1_pieces' || pageType === 'R3_guide_achat') {
      // Write to sg_content_draft (the primary SEO content field)
      await this.client
        .from('__seo_gamme')
        .update({ sg_content_draft: content })
        .eq('sg_pg_id', String(pgId));
    } else if (pageType === 'R4_reference') {
      await this.client
        .from('__seo_reference')
        .update({ content })
        .eq('slug', pgAlias);
    }
    // R3_conseils uses row-per-section model — conservative re-enrich handles it
  }

  // ── Evidence Pack ──

  private async loadEvidencePack(
    pgId: number,
    _pgAlias: string,
  ): Promise<EvidenceEntry[] | null> {
    // Load from latest refresh log with evidence_pack
    const { data } = await this.client
      .from('__rag_content_refresh_log')
      .select('evidence_pack')
      .eq('pg_id', pgId)
      .not('evidence_pack', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data?.evidence_pack) return null;
    return data.evidence_pack as EvidenceEntry[];
  }

  // ── Allowlist for no_guess gate ──

  private async buildAllowlist(
    pgId: number,
    pgAlias: string,
    evidencePack: EvidenceEntry[] | null,
  ): Promise<Set<string>> {
    const terms = new Set<string>();

    // (a) Template original words
    const { data: template } = await this.client
      .from('__seo_gamme')
      .select('sg_descrip')
      .eq('sg_pg_id', String(pgId))
      .maybeSingle();
    if (template?.sg_descrip) {
      this.extractTerms(template.sg_descrip as string).forEach((t) =>
        terms.add(t),
      );
    }

    // (b) EvidencePack excerpts
    if (evidencePack) {
      for (const entry of evidencePack) {
        if (entry.rawExcerpt) {
          this.extractTerms(entry.rawExcerpt).forEach((t) => terms.add(t));
        }
      }
    }

    // (c) FactsPack DB (optional table)
    const { data: facts } = await this.client
      .from('__gamme_facts')
      .select('term')
      .eq('pg_alias', pgAlias);
    if (facts) {
      for (const f of facts) terms.add((f.term as string).toLowerCase());
    }

    // (d) Family lexicon (optional table)
    const { data: gamme } = await this.client
      .from('pieces_gamme')
      .select('pg_family_id')
      .eq('pg_id', pgId)
      .maybeSingle();
    if (gamme?.pg_family_id) {
      const { data: lexicon } = await this.client
        .from('__gamme_family_lexicon')
        .select('term')
        .eq('family_id', gamme.pg_family_id);
      if (lexicon) {
        for (const l of lexicon) terms.add((l.term as string).toLowerCase());
      }
    }

    return terms;
  }

  private extractTerms(text: string): string[] {
    const stripped = text.replace(/<[^>]+>/g, ' ').toLowerCase();
    return stripped
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9àâäéèêëîïôùûüç-]/g, ''))
      .filter((w) => w.length > 4);
  }

  // ── Repair helpers (pass 2 — deterministic strip) ──

  private stripUnsourcedNumbers(content: string, targets: string[]): string {
    if (targets.length === 0) return content;
    let result = content;
    // Replace numeric claims with qualitative equivalents
    const numericPattern =
      /\d+(?:[.,]\d+)?\s*(?:mm|cm|km|m|Nm|bar|°C|ans?|%|€)\b/gi;
    result = result.replace(numericPattern, (match) => {
      // Replace with generic qualitative phrase
      if (/mm|cm|m\b/.test(match))
        return 'selon les spécifications constructeur';
      if (/km/.test(match)) return "selon l'intervalle préconisé";
      if (/Nm/.test(match)) return 'au couple spécifié';
      if (/bar/.test(match)) return 'à la pression recommandée';
      if (/°C/.test(match)) return 'à la température préconisée';
      if (/ans?/.test(match)) return "selon l'usure constatée";
      if (/%/.test(match)) return 'significativement';
      if (/€|EUR/.test(match)) return 'un tarif compétitif';
      return '';
    });
    // Clean up double spaces
    result = result.replace(/\s{2,}/g, ' ').trim();
    return result;
  }

  private stripNovelTerms(content: string, targets: string[]): string {
    if (targets.length === 0) return content;
    let result = content;

    // Collect all novel terms to check against
    const terms: string[] = [];
    for (const target of targets) {
      const term = target.startsWith('term:') ? target.slice(5) : target;
      if (term) terms.push(term.toLowerCase());
    }
    if (terms.length === 0) return result;

    // Split by HTML block elements to avoid orphaning tags
    // Match <p>, <li>, <div>, <h2-6>, <blockquote> blocks
    const blockRegex =
      /(<(?:p|li|div|h[2-6]|blockquote)[^>]*>)([\s\S]*?)(<\/(?:p|li|div|h[2-6]|blockquote)>)/gi;

    result = result.replace(
      blockRegex,
      (fullMatch, openTag, inner, _closeTag) => {
        const plainInner = inner.replace(/<[^>]+>/g, ' ').toLowerCase();
        // Check if any novel term appears in this block
        const hasNovelTerm = terms.some((t) => {
          const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`\\b${escaped}\\b`).test(plainInner);
        });
        if (hasNovelTerm) return ''; // Remove entire block
        return fullMatch;
      },
    );

    // Clean up leftover whitespace
    result = result.replace(/\n{3,}/g, '\n\n').trim();
    return result;
  }

  private removeLeakingSentences(content: string, targets: string[]): string {
    if (targets.length === 0) return content;
    let result = content;

    // Split content into HTML blocks for safe removal
    // We work on block-level elements to avoid orphaning HTML tags
    const blockTags =
      /<(?:p|li|div|h[2-6]|tr|blockquote)[^>]*>[\s\S]*?<\/(?:p|li|div|h[2-6]|tr|blockquote)>/gi;

    for (const target of targets) {
      // Extract the sentence excerpt from the triggerItem issue field
      // Format: "Technical procedure with numbers for non-target gamme: \"<excerpt>...\""
      const excerptMatch = target.match(/:\s*"([^"]{10,})\.{0,3}"/);
      if (!excerptMatch) continue;

      // Use first 40 chars of excerpt as match key (enough to identify uniquely)
      const excerpt = excerptMatch[1].substring(0, 40).toLowerCase().trim();
      if (!excerpt) continue;

      // Find and remove the HTML block containing this excerpt
      result = result.replace(blockTags, (block) => {
        const blockText = block
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .toLowerCase()
          .trim();
        if (blockText.includes(excerpt)) {
          return ''; // Remove entire block
        }
        return block;
      });
    }

    // Clean up empty whitespace left by removals
    result = result.replace(/\n{3,}/g, '\n\n').trim();
    return result;
  }

  // ── Protected field restoration ──

  private async restoreProtectedFields(
    pgId: number,
    pgAlias: string,
    pageType: string,
  ): Promise<boolean> {
    // Re-run QA guard check — if it passes, nothing to restore
    const qaOk = await this.checkQaGuardForGamme(pgId, pgAlias, pageType);
    if (qaOk) return false;

    // If QA guard fails, the fields have been mutated.
    // We cannot restore them here without a separate backup table.
    // Log for manual intervention.
    this.logger.warn(
      `Protected fields mutated for ${pgAlias}/${pageType} — needs manual review`,
    );
    return false;
  }

  private async checkProtectedFieldMutations(
    pgId: number,
    pgAlias: string,
    pageType: string,
  ): Promise<string | null> {
    const qaOk = await this.checkQaGuardForGamme(pgId, pgAlias, pageType);
    if (qaOk) return null;
    return `Protected field mutation detected for ${pgAlias}/${pageType}`;
  }

  // ── Safe Fallback Templates ──

  private buildSafeFallbackDraft(
    pgAlias: string,
    pageType: string,
    _pgId: number,
  ): SafeFallbackDraft {
    const gammeName = pgAlias.replace(/-/g, ' ');
    const familyLabel = 'automobile';

    let templateId: SafeFallbackDraft['templateId'];
    let content: string;

    switch (pageType) {
      case 'R1_pieces':
        templateId = 'safe_R1';
        content = this.getSafeTemplateR1(gammeName);
        break;
      case 'R3_guide_achat':
        templateId = 'safe_R3_guide';
        content = this.getSafeTemplateR3Guide(gammeName, familyLabel);
        break;
      case 'R3_conseils':
        templateId = 'safe_R3_conseils';
        content = this.getSafeTemplateR3Conseils(gammeName, familyLabel);
        break;
      case 'R4_reference':
        templateId = 'safe_R4';
        content = this.getSafeTemplateR4(gammeName, familyLabel);
        break;
      default:
        templateId = 'safe_R1';
        content = this.getSafeTemplateR1(gammeName);
    }

    return {
      content,
      templateId,
      gammeName,
      familyLabel,
      generatedAt: new Date().toISOString(),
    };
  }

  private async writeSafeFallbackToDb(
    pgId: number,
    pgAlias: string,
    pageType: string,
    fallback: SafeFallbackDraft,
  ): Promise<void> {
    await this.writeContentToDb(pgId, pgAlias, pageType, fallback.content);
    this.logger.log(
      `Safe fallback written for ${pgAlias}/${pageType} (template=${fallback.templateId})`,
    );
  }

  private getSafeTemplateR1(gammeName: string): string {
    return `<h2>Comment choisir vos ${gammeName} ?</h2>
<p>Pour sélectionner les ${gammeName} adaptés à votre véhicule :</p>
<ul>
<li><b>Vérifiez la compatibilité</b> — Renseignez votre véhicule (marque, modèle, année, motorisation) pour filtrer les références compatibles.</li>
<li><b>Consultez le carnet d'entretien</b> — Les spécifications du constructeur sont la référence obligatoire.</li>
<li><b>Privilégiez la qualité certifiée</b> — Les pièces homologuées respectent les normes de sécurité européennes.</li>
<li><b>Changez par paire si nécessaire</b> — Un remplacement par essieu garantit un comportement homogène.</li>
</ul>
<h2>Points de vigilance</h2>
<ul>
<li>Ne pas mélanger des références de marques différentes sur le même essieu</li>
<li>Respecter les préconisations constructeur pour les intervalles de remplacement</li>
<li>Faire contrôler les pièces associées lors du remplacement</li>
</ul>
<h2>Besoin d'aide ?</h2>
<p>Sélectionnez votre véhicule ci-dessus pour voir toutes les références de ${gammeName} compatibles. Livraison en 24-48h.</p>`;
  }

  private getSafeTemplateR3Guide(
    gammeName: string,
    familyLabel: string,
  ): string {
    return `<h2>Fonction des ${gammeName}</h2>
<p>Les ${gammeName} jouent un rôle dans le système ${familyLabel} de votre véhicule. Consultez le carnet d'entretien pour connaître les spécifications exactes.</p>
<h2>Quand remplacer les ${gammeName} ?</h2>
<p>Signes d'usure à surveiller :</p>
<ul>
<li>Bruits inhabituels lors de l'utilisation du système concerné</li>
<li>Comportement modifié du véhicule (vibrations, perte d'efficacité)</li>
<li>Témoin d'alerte au tableau de bord</li>
<li>Contrôle visuel révélant une usure ou une détérioration</li>
</ul>
<p>Consultez un professionnel pour un diagnostic précis.</p>
<h2>Conseils de remplacement</h2>
<ul>
<li>Respectez les intervalles préconisés par le constructeur</li>
<li>Utilisez des pièces conformes aux spécifications d'origine</li>
<li>Faites vérifier les composants associés</li>
</ul>`;
  }

  private getSafeTemplateR3Conseils(
    gammeName: string,
    familyLabel: string,
  ): string {
    return `<h2>À propos des ${gammeName}</h2>
<p>Les ${gammeName} font partie du système ${familyLabel}. Leur bon fonctionnement contribue à la sécurité et au confort de conduite.</p>
<h2>Signes d'usure</h2>
<ul>
<li>Bruits anormaux (grincement, sifflement, claquement)</li>
<li>Perte d'efficacité du système concerné</li>
<li>Vibrations ou comportement inhabituel</li>
<li>Témoin d'alerte au tableau de bord</li>
</ul>
<h2>Recommandations</h2>
<ul>
<li>Respectez les intervalles d'entretien du constructeur</li>
<li>Privilégiez des pièces aux spécifications d'origine</li>
<li>Faites réaliser l'intervention par un professionnel qualifié</li>
</ul>`;
  }

  private getSafeTemplateR4(gammeName: string, familyLabel: string): string {
    return `<h2>Définition : ${gammeName}</h2>
<p>Composant du système ${familyLabel} automobile. Les ${gammeName} assurent une fonction technique dont les caractéristiques varient selon le véhicule.</p>
<h2>Caractéristiques à vérifier</h2>
<ul>
<li>Dimensions conformes aux spécifications constructeur</li>
<li>Type et technologie adaptés au véhicule</li>
<li>Homologation et certification européenne</li>
</ul>
<h2>Entretien et remplacement</h2>
<p>Le remplacement se fait selon les préconisations du constructeur. Consultez le carnet d'entretien pour les intervalles spécifiques.</p>`;
  }
}
