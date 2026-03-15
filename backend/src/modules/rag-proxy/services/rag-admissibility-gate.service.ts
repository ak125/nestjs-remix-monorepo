import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RagFoundationGateService } from './rag-foundation-gate.service';
import { RoleId } from '../../../config/role-ids';
import {
  EVIDENCE_POLICY_MATRIX,
  DOC_FAMILY_ELIGIBLE_ROLES,
  ROLE_REQUIRED_BLOCKS,
  SUFFICIENCY_THRESHOLDS,
  EVIDENCE_BONUS,
  ROLE_FORBIDDEN_VOCABULARY,
  FRESHNESS_THRESHOLDS,
  REFRESH_REQUIRED_RISK,
  POLICY_TO_MAX_USAGE,
  capUsageLevel,
  USAGE_TO_ALLOWED_ACTIONS,
  ROLE_SEMANTIC_LIMITS,
  ADMISSIBILITY_RULESET_VERSION,
} from '../../../config/admissibility-gate.constants';
import { RAG_SECTION_REQUIREMENTS } from '../../../config/keyword-plan.constants';
import type {
  ReadinessRecord,
  EvidencePolicy,
  RoleSufficiency,
  BlockAdmissibility,
  ContaminationFinding,
  FreshnessAssessment,
  UsagePolicy,
  StalenessRisk,
  RoleAdmissibilityStatus,
  DownstreamUsageLevel,
  PrimaryGenerationLevel,
  DecisionTrace,
} from '../types/rag-readiness.types';

/**
 * RagAdmissibilityGateService — Phase 1.6 Business Admissibility Gate.
 *
 * Transforms a canonical resource (Phase 1.5 passed) into an authorized
 * or unauthorized resource for downstream pipeline consumption.
 *
 * Determines:
 *   - For which roles the document is admissible
 *   - For which blocks it is admissible
 *   - With what level of evidence
 *   - With what limits
 *   - Why it is refused elsewhere
 *
 * 6 sub-steps:
 *   1.6.1 resolveEvidencePolicy()
 *   1.6.2 computeRoleSufficiency()
 *   1.6.3 mapBlockAdmissibility()
 *   1.6.4 detectContamination()
 *   1.6.5 assessFreshness()
 *   1.6.6 computeFinalDecision()
 *
 * Rule: No phase 2+ can read a resource as business input if Phase 1.6
 * has not produced an explicit ALLOWED or ALLOWED_WITH_LIMITS decision.
 */
@Injectable()
export class RagAdmissibilityGateService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    RagAdmissibilityGateService.name,
  );

  constructor(
    configService: ConfigService,
    @Inject(forwardRef(() => RagFoundationGateService))
    private readonly foundationGateService: RagFoundationGateService,
  ) {
    super(configService);
  }

  // ── Main Entry Point ──────────────────────────────────────────

  /**
   * Evaluate business admissibility for a document.
   * Pre-condition: phase15_status IN ('normalized', 'normalized_with_warnings').
   */
  async evaluate(source: string): Promise<ReadinessRecord> {
    const now = new Date().toISOString();

    // Pre-condition: Phase 1.5 must be passed
    const { data: doc } = await this.supabase
      .from('__rag_knowledge')
      .select(
        'id, source, content, truth_level, doc_family, target_surface, updated_at, phase15_status, pipeline_version',
      )
      .eq('source', source)
      .eq('status', 'active')
      .maybeSingle();

    if (!doc) {
      return this.buildBlockedRecord(source, now, [
        'DOCUMENT_NOT_FOUND_OR_INACTIVE',
      ]);
    }

    // Check Phase 1.5 pre-condition
    const validPhase15 = ['normalized', 'normalized_with_warnings'];
    if (doc.phase15_status && !validPhase15.includes(doc.phase15_status)) {
      return this.buildBlockedRecord(source, now, [
        `PHASE15_NOT_PASSED: ${doc.phase15_status}`,
      ]);
    }

    // Parse deep frontmatter for RAG block extraction
    const frontmatter = this.parseDeepFrontmatter(doc.content ?? '');
    const ragBlocks = this.extractRagBlocks(frontmatter);

    // Resolve validation status from frontmatter or default
    const validationStatus = this.resolveValidationStatus(frontmatter);

    // ── 1.6.1 Evidence Policy ─────────────────────────────────
    const truthLevel = (doc.truth_level || 'L2') as 'L1' | 'L2' | 'L3' | 'L4';
    const evidencePolicy = this.resolveEvidencePolicy(
      truthLevel,
      validationStatus,
    );

    // ── 1.6.2 Sufficiency by Role (base scoring) ─────────────
    const docFamily = doc.doc_family || 'gamme';
    const roleSufficiency = this.computeRoleSufficiency(
      docFamily,
      ragBlocks,
      evidencePolicy,
    );

    // ── 1.6.3 Block Admissibility ─────────────────────────────
    const blockAdmissibility = this.mapBlockAdmissibility(
      ragBlocks,
      roleSufficiency,
      evidencePolicy,
    );

    // ── 1.6.4 Contamination Guard ─────────────────────────────
    const contentBody = this.extractContentBody(doc.content ?? '');
    const eligibleRoles = roleSufficiency.map((r) => r.roleId);
    const contaminationFindings = this.detectContamination(
      contentBody,
      eligibleRoles,
    );

    // ── 1.6.5 Freshness Gate ──────────────────────────────────
    const freshness = this.assessFreshness(doc.updated_at ?? now);

    // ── Post-process: compute A+B+D+E+F+G fields (need contamination + freshness) ──
    this.enhanceRoleSufficiency(
      roleSufficiency,
      evidencePolicy,
      contaminationFindings,
      freshness,
    );

    // ── Build requiredEnrichmentsByRole convenience map ───────
    const requiredEnrichmentsByRole: Record<string, string[]> = {};
    for (const rs of roleSufficiency) {
      if (rs.requiredEnrichments.length > 0) {
        requiredEnrichmentsByRole[rs.roleId] = rs.requiredEnrichments;
      }
    }

    // ── 1.6.6 Final Decision ──────────────────────────────────
    const decision = this.computeFinalDecision(
      evidencePolicy,
      roleSufficiency,
      contaminationFindings,
      freshness,
    );

    // ── Passage eligibility: can this doc proceed to Phase 2? ──
    const phase2Eligible =
      (decision.phase16Status === 'admissible' ||
        decision.phase16Status === 'admissible_with_limits') &&
      roleSufficiency.some((r) => r.allowedNextPhaseActions.length > 0);

    // ── R4: Decision trace ──────────────────────────────────
    const decisionTrace: DecisionTrace = {
      decisionId: crypto.randomUUID(),
      decidedBy: 'phase16_admissibility_gate',
      decidedAt: now,
      pipelineVersion: (doc.pipeline_version as string) ?? '1.0',
      rulesetVersion: ADMISSIBILITY_RULESET_VERSION,
    };

    const record: ReadinessRecord = {
      documentStatus: decision.documentStatus,
      evidencePolicy,
      roleSufficiency,
      blockAdmissibility,
      contaminationFindings,
      freshness,
      requiredEnrichmentsByRole:
        Object.keys(requiredEnrichmentsByRole).length > 0
          ? requiredEnrichmentsByRole
          : undefined,
      phase2Eligible,
      publicationTargetReady: decision.publicationTargetReady,
      phase16Status: decision.phase16Status,
      blockReasons: decision.blockReasons,
      evaluatedAt: now,
      decisionTrace,
    };

    // Persist
    await this.persistReadinessRecord(source, record);

    this.logger.log(
      `evaluate: "${source}" → ${decision.phase16Status} (doc=${decision.documentStatus}, roles=${
        roleSufficiency
          .filter(
            (r) =>
              r.roleStatus === 'ALLOWED' ||
              r.roleStatus === 'ALLOWED_WITH_LIMITS',
          )
          .map((r) => r.roleId)
          .join(',') || 'none'
      })`,
    );

    return record;
  }

  // ── 1.6.1 — Evidence Policy Resolution ────────────────────────

  private resolveEvidencePolicy(
    truthLevel: 'L1' | 'L2' | 'L3' | 'L4',
    validationStatus: 'valid' | 'pending_review' | 'quarantined',
  ): EvidencePolicy {
    const matrix = EVIDENCE_POLICY_MATRIX[truthLevel];
    const usagePolicy: UsagePolicy = matrix
      ? (matrix[validationStatus] ?? 'support_only')
      : 'support_only';

    return { truthLevel, validationStatus, usagePolicy };
  }

  // ── 1.6.2 — Sufficiency by Role ──────────────────────────────

  private computeRoleSufficiency(
    docFamily: string,
    ragBlocks: Map<string, { present: boolean; itemCount: number }>,
    evidencePolicy: EvidencePolicy,
  ): RoleSufficiency[] {
    const eligibleRoles = DOC_FAMILY_ELIGIBLE_ROLES[docFamily] ?? [];
    if (eligibleRoles.length === 0) {
      return [];
    }

    const evidBonus = EVIDENCE_BONUS[evidencePolicy.usagePolicy] ?? 0;

    return eligibleRoles.map((roleId) => {
      const requirements = ROLE_REQUIRED_BLOCKS[roleId] ?? [];
      if (requirements.length === 0) {
        return {
          roleId,
          score: 0,
          missingAxes: ['NO_REQUIREMENTS_DEFINED'],
          thinContentFlags: [],
          roleStatus: 'NOT_ENOUGH_EVIDENCE' as const,
          primaryGenerationLevel: 'blocked' as PrimaryGenerationLevel,
          downstreamUsageLevel: 'blocked' as DownstreamUsageLevel,
          requiredEnrichments: [],
          allowedNextPhaseActions: [],
          roleLimits: [],
        };
      }

      const maxScore = requirements.reduce((sum, r) => sum + r.weight, 0);
      let rawScore = 0;
      const missingAxes: string[] = [];
      const thinContentFlags: string[] = [];
      let requiredMissing = false;

      for (const req of requirements) {
        const block = ragBlocks.get(req.blockId);
        if (!block || !block.present) {
          missingAxes.push(req.blockId);
          if (req.required) requiredMissing = true;
          continue;
        }
        if (block.itemCount < req.minItems) {
          thinContentFlags.push(
            `${req.blockId}: ${block.itemCount}/${req.minItems}`,
          );
          // Partial credit
          rawScore += req.weight * (block.itemCount / req.minItems);
          continue;
        }
        rawScore += req.weight;
      }

      // Normalize to 0-100 and add evidence bonus
      const normalizedScore = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
      const score = Math.max(0, Math.min(100, normalizedScore + evidBonus));

      // Determine role status
      let roleStatus: RoleAdmissibilityStatus;
      if (evidencePolicy.usagePolicy === 'blocked') {
        roleStatus = 'BLOCKED';
      } else if (
        requiredMissing &&
        score < SUFFICIENCY_THRESHOLDS.NOT_ENOUGH_COVERAGE
      ) {
        roleStatus = 'NOT_ENOUGH_COVERAGE';
      } else if (score >= SUFFICIENCY_THRESHOLDS.ALLOWED) {
        roleStatus = 'ALLOWED';
      } else if (score >= SUFFICIENCY_THRESHOLDS.ALLOWED_WITH_LIMITS) {
        roleStatus = 'ALLOWED_WITH_LIMITS';
      } else if (score >= SUFFICIENCY_THRESHOLDS.NOT_ENOUGH_COVERAGE) {
        roleStatus = 'NOT_ENOUGH_COVERAGE';
      } else if (evidencePolicy.usagePolicy === 'support_only') {
        roleStatus = 'NOT_ENOUGH_EVIDENCE';
      } else {
        roleStatus = 'NOT_ENOUGH_EVIDENCE';
      }

      return {
        roleId,
        score: Math.round(score * 10) / 10,
        missingAxes,
        thinContentFlags,
        roleStatus,
        // Placeholders — computed by enhanceRoleSufficiency() after contamination
        primaryGenerationLevel: 'blocked' as PrimaryGenerationLevel,
        downstreamUsageLevel: 'blocked' as DownstreamUsageLevel,
        requiredEnrichments: [] as string[],
        allowedNextPhaseActions: [] as string[],
        roleLimits: [] as string[],
      };
    });
  }

  // ── Post-process: A + B + D enhancement ───────────────────────

  /**
   * Compute primaryGenerationEligible (A), downstreamUsageLevel (B),
   * and requiredEnrichments (D) for each role — requires contamination
   * results, so runs after detectContamination().
   * Mutates roleSufficiency in place.
   */
  private enhanceRoleSufficiency(
    roleSufficiency: RoleSufficiency[],
    evidencePolicy: EvidencePolicy,
    contaminationFindings: ContaminationFinding[],
    freshness: FreshnessAssessment,
  ): void {
    // Index contamination by role for fast lookup
    const blockingByRole = new Map<RoleId, boolean>();
    const warningByRole = new Map<RoleId, boolean>();
    for (const f of contaminationFindings) {
      if (f.severity === 'blocking') blockingByRole.set(f.roleId, true);
      if (f.severity === 'warning') warningByRole.set(f.roleId, true);
    }

    // Document-level max usage
    const docMaxUsage = POLICY_TO_MAX_USAGE[evidencePolicy.usagePolicy];

    for (const rs of roleSufficiency) {
      const hasBlockingContam = blockingByRole.get(rs.roleId) ?? false;
      const hasWarningContam = warningByRole.get(rs.roleId) ?? false;

      // ── B: downstreamUsageLevel — start from doc max, then degrade ──
      let usage: DownstreamUsageLevel = docMaxUsage;

      if (hasBlockingContam) {
        usage = capUsageLevel(usage, 'exploration_only');
      } else if (hasWarningContam) {
        usage = capUsageLevel(usage, 'enrichment_only');
      }

      if (rs.roleStatus === 'BLOCKED' || rs.roleStatus === 'ROLE_MISMATCH') {
        usage = capUsageLevel(usage, 'blocked');
      } else if (
        rs.roleStatus === 'NOT_ENOUGH_EVIDENCE' ||
        rs.roleStatus === 'NOT_ENOUGH_COVERAGE'
      ) {
        usage = capUsageLevel(usage, 'support_only');
      } else if (rs.roleStatus === 'ALLOWED_WITH_LIMITS') {
        usage = capUsageLevel(usage, 'generation_limited');
      }
      // ALLOWED keeps the doc-level usage (no degradation from score)

      rs.downstreamUsageLevel = usage;

      // ── R3: primaryGenerationLevel (5-tier) ──
      rs.primaryGenerationLevel = this.computePrimaryGenerationLevel(
        rs.roleStatus,
        evidencePolicy.usagePolicy,
        rs.score,
        hasBlockingContam,
        hasWarningContam,
        freshness.refreshNeeded,
      );

      // ── D: requiredEnrichments ──
      if (rs.roleStatus === 'ALLOWED') {
        rs.requiredEnrichments = [];
      } else if (rs.roleStatus === 'ALLOWED_WITH_LIMITS') {
        // Missing axes + thin content blocks = what Phase 2 must enrich
        rs.requiredEnrichments = [
          ...rs.missingAxes,
          ...rs.thinContentFlags.map((f) => f.split(':')[0]),
        ];
      } else if (
        rs.roleStatus === 'NOT_ENOUGH_COVERAGE' ||
        rs.roleStatus === 'NOT_ENOUGH_EVIDENCE'
      ) {
        rs.requiredEnrichments = [...rs.missingAxes];
      } else {
        // ROLE_MISMATCH, BLOCKED — enrichment won't help
        rs.requiredEnrichments = [];
      }

      // ── F: allowedNextPhaseActions ──
      rs.allowedNextPhaseActions = [
        ...(USAGE_TO_ALLOWED_ACTIONS[rs.downstreamUsageLevel] ?? []),
      ];

      // ── G: roleLimits ──
      const limitsKey = `${rs.roleId}_${rs.roleStatus}`;
      const baseLimits = ROLE_SEMANTIC_LIMITS[limitsKey] ?? [];
      rs.roleLimits = [...baseLimits];
      if (hasWarningContam) {
        rs.roleLimits.push('contamination_risk_detected');
      }
    }
  }

  // ── R3: Primary Generation Level ──────────────────────────────

  private computePrimaryGenerationLevel(
    roleStatus: RoleAdmissibilityStatus,
    usagePolicy: UsagePolicy,
    score: number,
    hasBlockingContam: boolean,
    hasWarningContam: boolean,
    refreshNeeded: boolean,
  ): PrimaryGenerationLevel {
    if (
      roleStatus === 'BLOCKED' ||
      roleStatus === 'ROLE_MISMATCH' ||
      hasBlockingContam
    ) {
      return 'blocked';
    }

    if (
      roleStatus === 'NOT_ENOUGH_EVIDENCE' ||
      roleStatus === 'NOT_ENOUGH_COVERAGE' ||
      usagePolicy === 'support_only' ||
      hasWarningContam
    ) {
      return 'support_only';
    }

    if (
      roleStatus === 'ALLOWED_WITH_LIMITS' &&
      (usagePolicy === 'generation_limited' ||
        usagePolicy === 'generation_allowed') &&
      !hasBlockingContam
    ) {
      return 'primary_generation_limited';
    }

    if (
      roleStatus === 'ALLOWED' &&
      (usagePolicy === 'publish_candidate' ||
        usagePolicy === 'generation_allowed') &&
      score >= SUFFICIENCY_THRESHOLDS.ALLOWED &&
      !hasBlockingContam
    ) {
      if (usagePolicy === 'publish_candidate' && !refreshNeeded) {
        return 'primary_publication_candidate';
      }
      return 'primary_generation_allowed';
    }

    return 'support_only';
  }

  // ── 1.6.3 — Block Admissibility Mapping ───────────────────────

  private mapBlockAdmissibility(
    ragBlocks: Map<string, { present: boolean; itemCount: number }>,
    roleSufficiency: RoleSufficiency[],
    evidencePolicy: EvidencePolicy,
  ): BlockAdmissibility[] {
    const results: BlockAdmissibility[] = [];

    for (const roleSuff of roleSufficiency) {
      const requirements = ROLE_REQUIRED_BLOCKS[roleSuff.roleId] ?? [];

      for (const req of requirements) {
        const block = ragBlocks.get(req.blockId);

        let status: BlockAdmissibility['status'];
        let reason: string;

        if (
          evidencePolicy.usagePolicy === 'support_only' ||
          evidencePolicy.usagePolicy === 'blocked'
        ) {
          status = 'NOT_TRUSTED_ENOUGH';
          reason = `Evidence policy: ${evidencePolicy.usagePolicy}`;
        } else if (!block || !block.present) {
          status = 'INSUFFICIENT';
          reason = 'Block not found in document';
        } else if (block.itemCount < req.minItems) {
          status = 'USABLE_WITH_WARNING';
          reason = `Thin content: ${block.itemCount}/${req.minItems} items`;
        } else {
          status = 'USABLE';
          reason = 'Block present and sufficient';
        }

        results.push({
          blockId: req.blockId,
          roleId: roleSuff.roleId,
          status,
          reason,
        });
      }
    }

    return results;
  }

  // ── 1.6.4 — Boundary & Contamination Guard ───────────────────

  private detectContamination(
    content: string,
    eligibleRoles: RoleId[],
  ): ContaminationFinding[] {
    const findings: ContaminationFinding[] = [];
    const contentLower = content.toLowerCase();

    for (const roleId of eligibleRoles) {
      const rules = ROLE_FORBIDDEN_VOCABULARY[roleId];
      if (!rules) continue;

      for (const rule of rules) {
        const matchedTerms: string[] = [];
        for (const term of rule.terms) {
          if (contentLower.includes(term.toLowerCase())) {
            matchedTerms.push(term);
          }
        }

        if (matchedTerms.length > 0) {
          // Severity: blocking if >30% of forbidden terms match, warning otherwise
          const ratio = matchedTerms.length / rule.terms.length;
          const severity = ratio > 0.3 ? 'blocking' : 'warning';

          findings.push({
            type: 'vocabulary_leak',
            roleId,
            evidence: matchedTerms.slice(0, 10), // Cap at 10 for readability
            severity,
          });
        }
      }
    }

    return findings;
  }

  // ── 1.6.5 — Freshness & Stability Gate ────────────────────────

  private assessFreshness(updatedAt: string): FreshnessAssessment {
    const updatedDate = new Date(updatedAt);
    const now = new Date();
    const staleDays = Math.floor(
      (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let stalenessRisk: StalenessRisk = 'low';
    if (staleDays > FRESHNESS_THRESHOLDS.critical) {
      stalenessRisk = 'critical';
    } else if (staleDays > FRESHNESS_THRESHOLDS.high) {
      stalenessRisk = 'high';
    } else if (staleDays > FRESHNESS_THRESHOLDS.medium) {
      stalenessRisk = 'medium';
    }

    const refreshNeeded =
      stalenessRisk === REFRESH_REQUIRED_RISK || stalenessRisk === 'critical';

    return {
      lastModified: updatedAt,
      staleDays,
      stalenessRisk,
      refreshNeeded,
    };
  }

  // ── 1.6.6 — Final Admissibility Decision ─────────────────────

  private computeFinalDecision(
    evidencePolicy: EvidencePolicy,
    roleSufficiency: RoleSufficiency[],
    contaminationFindings: ContaminationFinding[],
    freshness: FreshnessAssessment,
  ): {
    documentStatus: ReadinessRecord['documentStatus'];
    phase16Status: ReadinessRecord['phase16Status'];
    publicationTargetReady: boolean;
    blockReasons: string[];
  } {
    const blockReasons: string[] = [];

    // Evidence-level blocks
    if (evidencePolicy.usagePolicy === 'blocked') {
      blockReasons.push('EVIDENCE_BLOCKED');
      return {
        documentStatus: 'BLOCKED',
        phase16Status: 'blocked',
        publicationTargetReady: false,
        blockReasons,
      };
    }

    if (evidencePolicy.usagePolicy === 'support_only') {
      blockReasons.push('EVIDENCE_SUPPORT_ONLY');
      return {
        documentStatus: 'SUPPORT_ONLY',
        phase16Status: 'blocked',
        publicationTargetReady: false,
        blockReasons,
      };
    }

    // Check for blocking contamination
    const blockingContam = contaminationFindings.filter(
      (f) => f.severity === 'blocking',
    );
    if (blockingContam.length > 0) {
      for (const c of blockingContam) {
        blockReasons.push(
          `CONTAMINATION_BLOCKING: ${c.roleId} (${c.evidence.slice(0, 3).join(', ')})`,
        );
      }
    }

    // Count role statuses
    const allowedRoles = roleSufficiency.filter(
      (r) => r.roleStatus === 'ALLOWED',
    );
    const limitedRoles = roleSufficiency.filter(
      (r) => r.roleStatus === 'ALLOWED_WITH_LIMITS',
    );
    const hasAllowed = allowedRoles.length > 0;
    const hasLimited = limitedRoles.length > 0;

    // Freshness penalty
    if (freshness.refreshNeeded) {
      blockReasons.push(`STALE_CONTENT: ${freshness.staleDays} days`);
    }

    // No role is admissible
    if (!hasAllowed && !hasLimited) {
      if (
        evidencePolicy.usagePolicy === 'generation_allowed' ||
        evidencePolicy.usagePolicy === 'generation_limited'
      ) {
        blockReasons.push('NO_ROLE_SUFFICIENT');
        return {
          documentStatus: 'ENRICHMENT_REQUIRED',
          phase16Status: 'enrichment_required',
          publicationTargetReady: false,
          blockReasons,
        };
      }
      blockReasons.push('ALL_ROLES_BLOCKED');
      return {
        documentStatus: 'BLOCKED',
        phase16Status: 'blocked',
        publicationTargetReady: false,
        blockReasons,
      };
    }

    // At least one role is admissible
    const warningContam = contaminationFindings.filter(
      (f) => f.severity === 'warning',
    );

    if (
      hasAllowed &&
      blockingContam.length === 0 &&
      !freshness.refreshNeeded &&
      evidencePolicy.usagePolicy === 'publish_candidate'
    ) {
      return {
        documentStatus: 'READY',
        phase16Status: 'admissible',
        publicationTargetReady: true,
        blockReasons,
      };
    }

    // Has admissible roles but with limits
    if (warningContam.length > 0) {
      for (const c of warningContam) {
        blockReasons.push(
          `CONTAMINATION_WARNING: ${c.roleId} (${c.evidence.slice(0, 3).join(', ')})`,
        );
      }
    }

    return {
      documentStatus: 'READY_WITH_LIMITS',
      phase16Status: 'admissible_with_limits',
      publicationTargetReady: true,
      blockReasons,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────

  /**
   * Parse deep YAML frontmatter from markdown content.
   * Returns full nested object (unlike flat parseFrontmatter in FrontmatterValidatorService).
   */
  private parseDeepFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    try {
      const parsed = yaml.load(match[1]);
      return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      this.logger.warn('parseDeepFrontmatter: YAML parse error');
      return {};
    }
  }

  /**
   * Extract RAG block presence and item counts from parsed frontmatter.
   * Uses dotted paths matching RAG_SECTION_REQUIREMENTS and ROLE_REQUIRED_BLOCKS.
   */
  private extractRagBlocks(
    frontmatter: Record<string, unknown>,
  ): Map<string, { present: boolean; itemCount: number }> {
    const blocks = new Map<string, { present: boolean; itemCount: number }>();

    // Collect all unique block IDs from ROLE_REQUIRED_BLOCKS
    const blockIds = new Set<string>();
    for (const requirements of Object.values(ROLE_REQUIRED_BLOCKS)) {
      for (const req of requirements) {
        blockIds.add(req.blockId);
      }
    }
    // Also add blocks from RAG_SECTION_REQUIREMENTS
    for (const reqs of Object.values(RAG_SECTION_REQUIREMENTS)) {
      for (const req of reqs) {
        blockIds.add(req.block);
      }
    }

    for (const blockId of blockIds) {
      const value = this.getNestedValue(frontmatter, blockId);

      if (value === undefined || value === null || value === '') {
        blocks.set(blockId, { present: false, itemCount: 0 });
        continue;
      }

      if (Array.isArray(value)) {
        blocks.set(blockId, {
          present: value.length > 0,
          itemCount: value.length,
        });
      } else if (typeof value === 'string') {
        blocks.set(blockId, {
          present: value.trim().length > 0,
          itemCount: value.trim().length > 0 ? 1 : 0,
        });
      } else if (typeof value === 'object') {
        const keys = Object.keys(value as Record<string, unknown>);
        blocks.set(blockId, {
          present: keys.length > 0,
          itemCount: keys.length,
        });
      } else {
        blocks.set(blockId, { present: true, itemCount: 1 });
      }
    }

    return blocks;
  }

  /**
   * Get nested value from object using dotted path (e.g., 'domain.role').
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== 'object'
      ) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  /**
   * Extract the markdown body (everything after frontmatter) for contamination scanning.
   */
  private extractContentBody(content: string): string {
    const fmEnd = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    if (fmEnd) {
      return content.substring(fmEnd[0].length);
    }
    return content;
  }

  /**
   * Resolve validation status from frontmatter or default.
   */
  private resolveValidationStatus(
    frontmatter: Record<string, unknown>,
  ): 'valid' | 'pending_review' | 'quarantined' {
    const vs = frontmatter.verification_status as string | undefined;
    if (vs === 'verified' || vs === 'valid') return 'valid';
    if (vs === 'quarantined') return 'quarantined';
    return 'pending_review'; // draft, pending, or missing → pending_review
  }

  // ── Persistence ───────────────────────────────────────────────

  private async persistReadinessRecord(
    source: string,
    record: ReadinessRecord,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('__rag_knowledge')
      .update({
        phase16_status: record.phase16Status,
        readiness_record: record,
        publication_target_ready: record.publicationTargetReady,
      })
      .eq('source', source);

    if (error) {
      this.logger.error(
        `persistReadinessRecord: failed for "${source}": ${error.message}`,
      );
      throw error;
    }
  }

  // ── Blocked Record Helper ─────────────────────────────────────

  private buildBlockedRecord(
    source: string,
    now: string,
    reasons: string[],
  ): ReadinessRecord {
    return {
      documentStatus: 'BLOCKED',
      evidencePolicy: {
        truthLevel: 'L4',
        validationStatus: 'quarantined',
        usagePolicy: 'blocked',
      },
      roleSufficiency: [],
      blockAdmissibility: [],
      contaminationFindings: [],
      freshness: {
        lastModified: now,
        staleDays: 0,
        stalenessRisk: 'low',
        refreshNeeded: false,
      },
      phase2Eligible: false,
      publicationTargetReady: false,
      phase16Status: 'blocked',
      blockReasons: reasons,
      evaluatedAt: now,
      decisionTrace: {
        decisionId: crypto.randomUUID(),
        decidedBy: 'phase16_admissibility_gate',
        decidedAt: now,
        pipelineVersion: '1.0',
        rulesetVersion: ADMISSIBILITY_RULESET_VERSION,
      },
    };
  }
}
