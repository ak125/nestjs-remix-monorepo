import { Injectable, Logger } from '@nestjs/common';
import {
  VIDEO_GATE_THRESHOLDS,
  VIDEO_DURATION_RANGES,
  MODE_CONSTRAINTS,
  FORBIDDEN_PATTERNS_SOCLE,
  FORBIDDEN_PATTERNS_SHORT,
  type VideoGateName,
  type GateVerdict,
  type VideoMode,
} from '../../../config/video-quality.constants';
import type {
  VideoGateResult,
  VideoGateOutput,
  VideoClaimEntry,
  VideoEvidenceEntry,
  DisclaimerPlan,
  ApprovalRecord,
  ArtefactCheckResult,
  VideoBrief,
} from '../types/video.types';

/**
 * VideoGatesService — 7 gates de gouvernance video (P0).
 *
 * Pattern identique a HardGatesService :
 *  - Chaque gate retourne VideoGateResult (verdict + measured + thresholds)
 *  - runAllGates() execute les 7 gates et retourne VideoGateOutput
 *  - canPublish = true ssi aucun gate FAIL
 *
 * @see backend/src/modules/admin/services/hard-gates.service.ts
 */
@Injectable()
export class VideoGatesService {
  private readonly logger = new Logger(VideoGatesService.name);

  // ── Public API ──

  /**
   * Execute les 7 gates et retourne le verdict global.
   */
  runAllGates(input: VideoGateInput): VideoGateOutput {
    const gates: VideoGateResult[] = [
      this.g1Truth(input),
      this.g2Safety(input),
      this.g3Brand(input),
      this.g4Platform(input),
      this.g5ReuseRisk(input),
      this.g6VisualRole(input),
      this.g7FinalQA(input),
    ];

    const flags: string[] = [];
    let canPublish = true;

    for (const g of gates) {
      if (g.verdict === 'FAIL') {
        canPublish = false;
        flags.push(`GATE_FAIL:${g.gate}`);
      } else if (g.verdict === 'WARN') {
        flags.push(`GATE_WARN:${g.gate}`);
      }
    }

    this.logger.log(
      `Gates result: ${gates.map((g) => `${g.gate}=${g.verdict}`).join(', ')} → canPublish=${canPublish}`,
    );

    return { canPublish, gates, flags };
  }

  /**
   * Verifie que les 5 artefacts obligatoires sont presents.
   * Appele avant toute execution de gates.
   */
  checkArtefacts(input: Partial<VideoGateInput>): ArtefactCheckResult {
    const missing: string[] = [];

    const hasBrief = !!input.brief;
    const hasClaimTable =
      Array.isArray(input.claims) && input.claims.length >= 0;
    const hasEvidencePack =
      Array.isArray(input.evidencePack) && input.evidencePack.length >= 0;
    const hasDisclaimerPlan =
      !!input.disclaimerPlan && Array.isArray(input.disclaimerPlan.disclaimers);
    const hasApprovalRecord =
      !!input.approvalRecord && Array.isArray(input.approvalRecord.stages);

    if (!hasBrief) missing.push('video_brief');
    if (!hasClaimTable) missing.push('claim_table');
    if (!hasEvidencePack) missing.push('evidence_pack');
    if (!hasDisclaimerPlan) missing.push('disclaimer_plan');
    if (!hasApprovalRecord) missing.push('approval_record');

    return {
      hasBrief,
      hasClaimTable,
      hasEvidencePack,
      hasDisclaimerPlan,
      hasApprovalRecord,
      canProceed: missing.length === 0,
      missingArtefacts: missing,
    };
  }

  // ── G1: Truth Gate ──

  private g1Truth(input: VideoGateInput): VideoGateResult {
    const { claims } = input;
    const { warn, fail } = VIDEO_GATE_THRESHOLDS.truth_attribution;

    if (!claims || claims.length === 0) {
      return this.makeResult('truth', 'PASS', 0, warn, fail, [
        'No claims to verify',
      ]);
    }

    const unsourced = claims.filter(
      (c) =>
        c.status === 'unverified' &&
        c.kind !== 'procedure' &&
        c.kind !== 'safety',
    );
    const ratio = unsourced.length / claims.length;

    const triggerItems = unsourced.map((c) => ({
      location: `claim:${c.sectionKey}`,
      issue: `Unsourced ${c.kind}: "${c.rawText}"`,
      evidenceRef: c.sourceRef ?? undefined,
    }));

    return this.makeResult(
      'truth',
      this.thresholdVerdict(ratio, warn, fail),
      ratio,
      warn,
      fail,
      [
        `${unsourced.length}/${claims.length} claims unsourced (ratio=${ratio.toFixed(2)})`,
      ],
      triggerItems,
    );
  }

  // ── G2: Safety Gate (STRICT) ──

  private g2Safety(input: VideoGateInput): VideoGateResult {
    const { claims } = input;
    const { warn, fail } = VIDEO_GATE_THRESHOLDS.safety_unvalidated;

    const safetyClaims = (claims ?? []).filter(
      (c) => c.kind === 'procedure' || c.kind === 'safety',
    );

    const unvalidated = safetyClaims.filter(
      (c) => c.requiresHumanValidation && !c.validatedBy,
    );

    const triggerItems = unvalidated.map((c) => ({
      location: `claim:${c.sectionKey}`,
      issue: `${c.kind} claim requires human validation: "${c.rawText}"`,
    }));

    return this.makeResult(
      'safety',
      this.thresholdVerdict(unvalidated.length, warn, fail),
      unvalidated.length,
      warn,
      fail,
      [
        `${unvalidated.length} procedure/safety claims without human validation`,
      ],
      triggerItems,
    );
  }

  // ── G3: Brand Gate ──

  private g3Brand(input: VideoGateInput): VideoGateResult {
    const { scriptText, brief } = input;
    const { warn, fail } = VIDEO_GATE_THRESHOLDS.brand_violations;

    if (!scriptText) {
      return this.makeResult('brand', 'PASS', 0, warn, fail, [
        'No script text to check',
      ]);
    }

    const mode: VideoMode = brief?.mode ?? 'socle';
    const constraints = MODE_CONSTRAINTS[mode];
    const patterns =
      mode === 'short' ? FORBIDDEN_PATTERNS_SHORT : FORBIDDEN_PATTERNS_SOCLE;

    const violations: Array<{ location: string; issue: string }> = [];

    // Check forbidden patterns
    const lines = scriptText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        if (pattern.test(lines[i])) {
          violations.push({
            location: `line:${i + 1}`,
            issue: `Forbidden pattern in ${mode} mode: "${lines[i].trim().slice(0, 80)}"`,
          });
        }
      }
    }

    // Check CTA constraint
    if (
      !constraints.allowCTA &&
      /\b(cliquez|inscrivez|abonnez|téléchargez)\b/i.test(scriptText)
    ) {
      violations.push({
        location: 'script',
        issue: `CTA detected in ${mode} mode (not allowed)`,
      });
    }

    return this.makeResult(
      'brand',
      this.thresholdVerdict(violations.length, warn, fail),
      violations.length,
      warn,
      fail,
      [`${violations.length} brand/mode violations found`],
      violations,
    );
  }

  // ── G4: Platform Gate ──

  private g4Platform(input: VideoGateInput): VideoGateResult {
    const { brief, actualDurationSec } = input;
    const tolerance = VIDEO_GATE_THRESHOLDS.platform_duration_tolerance;

    if (!brief || actualDurationSec == null) {
      return this.makeResult('platform', 'PASS', 0, 0, 1, [
        'No duration data — skipping platform gate',
      ]);
    }

    const range = VIDEO_DURATION_RANGES[brief.type];
    const minWithTolerance = range.min * (1 - tolerance);
    const maxWithTolerance = range.max * (1 + tolerance);

    const inRange =
      actualDurationSec >= minWithTolerance &&
      actualDurationSec <= maxWithTolerance;

    const deviation = inRange
      ? 0
      : actualDurationSec < minWithTolerance
        ? (minWithTolerance - actualDurationSec) / range.min
        : (actualDurationSec - maxWithTolerance) / range.max;

    return this.makeResult(
      'platform',
      inRange ? 'PASS' : 'FAIL',
      deviation,
      0,
      tolerance,
      [
        inRange
          ? `Duration ${actualDurationSec}s within ${range.min}-${range.max}s (±${tolerance * 100}%)`
          : `Duration ${actualDurationSec}s outside ${range.min}-${range.max}s (deviation=${(deviation * 100).toFixed(1)}%)`,
      ],
    );
  }

  // ── G5: Reuse Risk Gate ──

  private g5ReuseRisk(input: VideoGateInput): VideoGateResult {
    const { similarityScore } = input;
    const { warn, fail } = VIDEO_GATE_THRESHOLDS.reuse_similarity;

    const score = similarityScore ?? 0;

    return this.makeResult(
      'reuse_risk',
      this.thresholdVerdict(score, warn, fail),
      score,
      warn,
      fail,
      [`Script similarity score: ${score.toFixed(2)}`],
    );
  }

  // ── G6: Visual Role Gate (STRICT) ──

  private g6VisualRole(input: VideoGateInput): VideoGateResult {
    const { visualRoleViolations } = input;
    const { warn, fail } = VIDEO_GATE_THRESHOLDS.visual_role_violations;

    const count = visualRoleViolations?.length ?? 0;

    return this.makeResult(
      'visual_role',
      this.thresholdVerdict(count, warn, fail),
      count,
      warn,
      fail,
      [
        count === 0
          ? 'All visuals used as illustration (correct)'
          : `${count} visual(s) used as proof without validation`,
      ],
      visualRoleViolations?.map((v) => ({
        location: v.assetKey,
        issue: `${v.visualType} used as ${v.usedAs} (expected: illustration)`,
      })),
    );
  }

  // ── G7: Final QA Gate ──

  private g7FinalQA(input: VideoGateInput): VideoGateResult {
    const artefacts = this.checkArtefacts(input);
    const missing = artefacts.missingArtefacts;

    // Check approval: at least script_text must be approved
    const approvalOk =
      input.approvalRecord?.stages.some(
        (s) => s.stage === 'script_text' && s.status === 'approved',
      ) ?? false;

    if (!approvalOk) {
      missing.push('script_text_approval');
    }

    return this.makeResult(
      'final_qa',
      missing.length === 0 ? 'PASS' : 'FAIL',
      missing.length,
      0,
      1,
      [
        missing.length === 0
          ? 'All 5 artefacts present + script approved'
          : `Missing: ${missing.join(', ')}`,
      ],
      missing.map((m) => ({ location: 'artefact', issue: `Missing: ${m}` })),
    );
  }

  // ── Helpers ──

  private thresholdVerdict(
    measured: number,
    warn: number,
    fail: number,
  ): GateVerdict {
    if (measured >= fail) return 'FAIL';
    if (measured >= warn) return 'WARN';
    return 'PASS';
  }

  private makeResult(
    gate: VideoGateName,
    verdict: GateVerdict,
    measured: number,
    warnThreshold: number,
    failThreshold: number,
    details: string[],
    triggerItems?: Array<{
      location: string;
      issue: string;
      evidenceRef?: string;
    }>,
  ): VideoGateResult {
    return {
      gate,
      verdict,
      details,
      measured,
      warnThreshold,
      failThreshold,
      triggerItems,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Input type for gates execution
// ─────────────────────────────────────────────────────────────

export interface VideoGateInput {
  brief: VideoBrief;
  claims: VideoClaimEntry[];
  evidencePack: VideoEvidenceEntry[];
  disclaimerPlan: DisclaimerPlan;
  approvalRecord: ApprovalRecord;
  /** Full script text (for brand gate) */
  scriptText?: string;
  /** Actual rendered duration in seconds (for platform gate) */
  actualDurationSec?: number;
  /** Similarity score vs existing productions (0-1) */
  similarityScore?: number;
  /** Visual assets used as proof (for visual role gate) */
  visualRoleViolations?: Array<{
    assetKey: string;
    visualType: string;
    usedAs: string;
  }>;
}
