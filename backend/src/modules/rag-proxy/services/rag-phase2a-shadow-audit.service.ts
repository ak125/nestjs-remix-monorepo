/**
 * RagPhase2aShadowAuditService — Phase 2A Legacy Adapted Shadow Audit.
 *
 * Non-destructive audit that projects legacy artifacts onto canonical roles R0-R8,
 * detects collisions, applies governance G1-G5, and produces readiness verdicts.
 *
 * Position: Phase 1.6 (admissibility) → Phase 2A (shadow audit) → Phase 2 (exploitation)
 *
 * Invariants:
 *  1. Non-destruction: read-only on code and DB (writes only to __phase2a_audit_reports)
 *  2. Non-publication: no output can be published as a page
 *  3. Non-usurpation: legacy does not become canonical by resemblance
 *  4. Traceability: every projection preserves source, detected role, proposed role, reasons
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  RoleId,
  normalizeRoleId,
  assertCanonicalRole,
  LEGACY_ROLE_ALIASES,
  FORBIDDEN_ROLE_IDS,
} from '../../../config/role-ids';
import {
  PHASE2A_VERSION,
  CONFIDENCE_THRESHOLDS,
  CONTRACT_SCHEMA_MAP,
  KEYWORD_PLAN_MAP,
  CODE_SCAN_PATHS,
  FRONTEND_SCAN_PATHS,
  BARE_ROLE_REGEX,
  ROUTE_TO_ROLE,
  G2_CONCENTRATION_THRESHOLD,
  confidenceToBand,
  inferArtifactScope,
} from '../../../config/phase2a-shadow-audit.constants';
import { DOC_FAMILY_ELIGIBLE_ROLES } from '../../../config/admissibility-gate.constants';
import type {
  Phase2aArtifactType,
  Phase2aArtifactFinding,
  Phase2aCollision,
  Phase2aGovernanceFlag,
  Phase2aReadinessVerdict,
  Phase2aRecommendedAction,
  Phase2aCanonVerdict,
  Phase2aBlockingFamily,
  Phase2aAuditReport,
  Phase2aAuditSummary,
  Phase2aAuditRequest,
  ConfidenceBand,
} from '../types/rag-phase2a.types';
import { PHASE2A_CANON_VERDICTS } from '../types/rag-phase2a.types';

/** Project root for file system operations */
const PROJECT_ROOT = '/opt/automecanik/app';

@Injectable()
export class RagPhase2aShadowAuditService extends SupabaseBaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  // ── Main Entry Point ────────────────────────────────────

  async runAudit(request?: Phase2aAuditRequest): Promise<Phase2aAuditReport> {
    const auditId = randomUUID();
    const startedAt = new Date().toISOString();
    const dryRun = request?.dryRun ?? false;
    const filterTypes = request?.artifactTypes ?? null;

    this.logger.log(
      `Phase 2A audit started: auditId=${auditId}, dryRun=${dryRun}, filter=${filterTypes?.join(',') ?? 'all'}`,
    );

    let findings: Phase2aArtifactFinding[] = [];

    try {
      // P2A-0: Scan all artifact sources
      const scanners: {
        types: Phase2aArtifactType[];
        fn: () => Promise<Phase2aArtifactFinding[]>;
      }[] = [
        {
          types: ['code_service', 'code_schema', 'code_constant', 'code_route'],
          fn: () => this.scanCodeArtifacts(),
        },
        {
          types: ['db_page_role', 'db_page_type'],
          fn: () => this.scanDbArtifacts(),
        },
        {
          types: ['doc_agent', 'doc_spec'],
          fn: () => this.scanDocArtifacts(),
        },
        {
          types: ['frontend_label', 'frontend_route'],
          fn: () => this.scanFrontendArtifacts(),
        },
      ];

      for (const scanner of scanners) {
        if (
          filterTypes &&
          !scanner.types.some((t) => filterTypes.includes(t))
        ) {
          continue;
        }
        const results = await scanner.fn();
        findings.push(...results);
      }

      // Filter by requested types if specified
      if (filterTypes) {
        findings = findings.filter((f) => filterTypes.includes(f.artifactType));
      }

      // P2A-4: Cross-artifact collision detection
      this.detectCrossArtifactCollisions(findings);

      // P2A-5: Compute derived fields, governance G2/G3, upstream blocking, verdicts
      for (const finding of findings) {
        finding.confidenceBand = confidenceToBand(finding.confidence);
        finding.artifactScope = inferArtifactScope(
          finding.artifactPath,
          finding.canonicalRoleCandidate,
        );

        // G2 Diversite (requires all findings for distribution check)
        finding.governanceFlags.push(this.checkG2Diversite(finding, findings));

        // G3 Anti-cannibalisation
        finding.governanceFlags.push(this.checkG3AntiCannibalisation(finding));

        // Upstream blocking (DB artifacts only)
        finding.blockingFamily = await this.checkUpstreamReadiness(finding);

        // T3: Contract candidate inference
        finding.canonicalContractCandidate =
          this.inferContractCandidate(finding);

        // Readiness verdict + recommended action
        finding.readinessVerdict = this.computeReadinessVerdict(finding);
        finding.recommendedAction = this.computeRecommendedAction(finding);

        // Canonical verdict (spec-aligned semantic layer)
        finding.canonVerdict = this.computeCanonVerdict(finding);
      }

      const summary = this.computeSummary(findings);
      const report: Phase2aAuditReport = {
        auditId,
        version: PHASE2A_VERSION,
        startedAt,
        completedAt: new Date().toISOString(),
        totalArtifactsScanned: findings.length,
        totalLegacyDetected: findings.filter(
          (f) => f.legacyLabelsDetected.length > 0,
        ).length,
        totalCollisions: findings.reduce(
          (sum, f) => sum + f.collisions.length,
          0,
        ),
        totalBlockers: findings.filter((f) =>
          f.readinessVerdict.startsWith('BLOCKED_'),
        ).length,
        findings,
        summary,
        phase2aStatus: 'audit_complete',
      };

      // Persist if not dry run
      if (!dryRun) {
        await this.persistReport(report);
      }

      this.logger.log(
        `Phase 2A audit complete: ${report.totalArtifactsScanned} scanned, ${report.totalLegacyDetected} legacy, ${report.totalCollisions} collisions, ${report.totalBlockers} blockers`,
      );

      return report;
    } catch (error) {
      this.logger.error(`Phase 2A audit failed: ${error}`);
      const failedReport: Phase2aAuditReport = {
        auditId,
        version: PHASE2A_VERSION,
        startedAt,
        completedAt: new Date().toISOString(),
        totalArtifactsScanned: findings.length,
        totalLegacyDetected: 0,
        totalCollisions: 0,
        totalBlockers: 0,
        findings: [],
        summary: {
          readyCount: 0,
          blockedCount: 0,
          reviewRequiredCount: 0,
          holdCount: 0,
          escalateCount: 0,
          outOfScopeCount: 0,
        },
        phase2aStatus: 'audit_failed',
      };
      if (!dryRun) {
        await this.persistReport(failedReport).catch(() => {});
      }
      return failedReport;
    }
  }

  // ── P2A-0: Scanners ────────────────────────────────────

  private async scanCodeArtifacts(): Promise<Phase2aArtifactFinding[]> {
    const findings: Phase2aArtifactFinding[] = [];

    // Scan page contract schemas
    for (const [roleId, schemaFile] of Object.entries(CONTRACT_SCHEMA_MAP)) {
      const fullPath = path.join(
        PROJECT_ROOT,
        'backend/src/config',
        schemaFile,
      );
      const exists = fs.existsSync(fullPath);
      const finding = this.createFinding(
        `backend/src/config/${schemaFile}`,
        'code_schema',
      );

      if (exists) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        finding.legacyLabelsDetected = this.detectLegacyLabels(content);
        finding.canonicalRoleCandidate = roleId as RoleId;
        finding.confidence = CONFIDENCE_THRESHOLDS.HIGH;
      } else {
        finding.canonicalRoleCandidate = roleId as RoleId;
        finding.confidence = 0;
        finding.blockReasons.push(`Schema file not found: ${schemaFile}`);
      }

      finding.governanceFlags = this.checkGovernance(finding);
      findings.push(finding);
    }

    // Scan services that reference roles
    for (const servicePath of CODE_SCAN_PATHS.services) {
      const fullPath = path.join(PROJECT_ROOT, servicePath);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, 'utf-8');
      const finding = this.createFinding(servicePath, 'code_service');
      finding.legacyLabelsDetected = this.detectLegacyLabels(content);

      // Project canonical role from detected labels
      const projection = this.projectCanonicalRole(
        finding.legacyLabelsDetected,
        servicePath,
        'code_service',
      );
      finding.canonicalRoleCandidate = projection.role;
      finding.confidence = projection.confidence;
      finding.governanceFlags = this.checkGovernance(finding);
      findings.push(finding);
    }

    // Scan role definition files
    for (const defPath of CODE_SCAN_PATHS.roleDefinitions) {
      const fullPath = path.join(PROJECT_ROOT, defPath);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, 'utf-8');
      const finding = this.createFinding(defPath, 'code_constant');
      finding.legacyLabelsDetected = this.detectLegacyLabels(content);

      // Role definition files are multi-role by design
      finding.canonicalRoleCandidate = null;
      finding.confidence = CONFIDENCE_THRESHOLDS.HIGH;
      finding.governanceFlags = this.checkGovernance(finding);
      findings.push(finding);
    }

    return findings;
  }

  private async scanDbArtifacts(): Promise<Phase2aArtifactFinding[]> {
    const findings: Phase2aArtifactFinding[] = [];

    // Scan distinct role/type values from DB tables
    const dbScans: {
      name: string;
      table: string;
      column: string;
      type: Phase2aArtifactType;
    }[] = [
      {
        name: 'seoPageRoles',
        table: '__seo_page',
        column: 'page_role',
        type: 'db_page_role',
      },
      {
        name: 'seoConseilPageTypes',
        table: '__seo_gamme_conseil',
        column: 'page_type',
        type: 'db_page_type',
      },
      {
        name: 'seoPurchaseGuideRoles',
        table: '__seo_gamme_purchase_guide',
        column: 'page_role',
        type: 'db_page_role',
      },
    ];

    for (const scan of dbScans) {
      try {
        const { data, error } = await this.supabase
          .from(scan.table)
          .select(scan.column)
          .not(scan.column, 'is', null);

        if (error || !data) continue;

        // Extract distinct values (data is any[] from Supabase)
        const distinctValues = [
          ...new Set(
            (data as unknown as Record<string, string>[])
              .map((row) => row[scan.column])
              .filter(Boolean),
          ),
        ];

        for (const value of distinctValues) {
          const finding = this.createFinding(
            `db:${scan.table}.${scan.column}=${value}`,
            scan.type,
          );

          // Check if value is legacy
          const normalized = normalizeRoleId(value);
          if (normalized && normalized !== value) {
            finding.legacyLabelsDetected = [value];
            finding.canonicalRoleCandidate = normalized;
            finding.confidence = CONFIDENCE_THRESHOLDS.MEDIUM;
          } else if (normalized) {
            finding.canonicalRoleCandidate = normalized;
            finding.confidence = CONFIDENCE_THRESHOLDS.HIGH;
          } else {
            finding.legacyLabelsDetected = [value];
            finding.canonicalRoleCandidate = null;
            finding.confidence = CONFIDENCE_THRESHOLDS.AMBIGUOUS;
            finding.blockReasons.push(`Unrecognized role value: "${value}"`);
          }

          finding.governanceFlags = this.checkGovernance(finding);
          findings.push(finding);
        }
      } catch {
        this.logger.warn(`DB scan failed for: ${scan.name}`);
      }
    }

    return findings;
  }

  private async scanDocArtifacts(): Promise<Phase2aArtifactFinding[]> {
    const findings: Phase2aArtifactFinding[] = [];

    // Scan agent files
    const agentDir = path.join(PROJECT_ROOT, '.claude/agents');
    if (fs.existsSync(agentDir)) {
      const agentFiles = fs
        .readdirSync(agentDir)
        .filter((f) => f.endsWith('.md'));

      for (const file of agentFiles) {
        const fullPath = path.join(agentDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Read first 80 lines for role detection
        const header = content.split('\n').slice(0, 80).join('\n');

        const finding = this.createFinding(
          `.claude/agents/${file}`,
          'doc_agent',
        );
        finding.legacyLabelsDetected = this.detectLegacyLabels(header);

        const projection = this.projectCanonicalRole(
          finding.legacyLabelsDetected,
          `.claude/agents/${file}`,
          'doc_agent',
        );
        finding.canonicalRoleCandidate = projection.role;
        finding.confidence = projection.confidence;
        finding.governanceFlags = this.checkGovernance(finding);
        findings.push(finding);
      }
    }

    // Scan spec files
    const specDir = path.join(PROJECT_ROOT, '.spec/00-canon');
    if (fs.existsSync(specDir)) {
      const specFiles = this.globSync(specDir, '**/*.md');

      for (const file of specFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const header = content.split('\n').slice(0, 80).join('\n');
        const relativePath = path.relative(PROJECT_ROOT, file);

        const finding = this.createFinding(relativePath, 'doc_spec');
        finding.legacyLabelsDetected = this.detectLegacyLabels(header);

        const projection = this.projectCanonicalRole(
          finding.legacyLabelsDetected,
          relativePath,
          'doc_spec',
        );
        finding.canonicalRoleCandidate = projection.role;
        finding.confidence = projection.confidence;
        finding.governanceFlags = this.checkGovernance(finding);
        findings.push(finding);
      }
    }

    // Scan skill reference files
    const skillRefDir = path.join(
      PROJECT_ROOT,
      '.claude/skills/seo-content-architect/references',
    );
    if (fs.existsSync(skillRefDir)) {
      const refFiles = fs
        .readdirSync(skillRefDir)
        .filter((f) => f.endsWith('.md'));

      for (const file of refFiles) {
        const fullPath = path.join(skillRefDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const header = content.split('\n').slice(0, 80).join('\n');

        const finding = this.createFinding(
          `.claude/skills/seo-content-architect/references/${file}`,
          'doc_spec',
        );
        finding.legacyLabelsDetected = this.detectLegacyLabels(header);

        const projection = this.projectCanonicalRole(
          finding.legacyLabelsDetected,
          finding.artifactPath,
          'doc_spec',
        );
        finding.canonicalRoleCandidate = projection.role;
        finding.confidence = projection.confidence;
        finding.governanceFlags = this.checkGovernance(finding);
        findings.push(finding);
      }
    }

    return findings;
  }

  private async scanFrontendArtifacts(): Promise<Phase2aArtifactFinding[]> {
    const findings: Phase2aArtifactFinding[] = [];

    // Scan page-role.types.ts
    const pageRolePath = path.join(
      PROJECT_ROOT,
      FRONTEND_SCAN_PATHS.pageRoleTypes,
    );
    if (fs.existsSync(pageRolePath)) {
      const content = fs.readFileSync(pageRolePath, 'utf-8');
      const finding = this.createFinding(
        FRONTEND_SCAN_PATHS.pageRoleTypes,
        'frontend_label',
      );
      finding.legacyLabelsDetected = this.detectLegacyLabels(content);
      // Multi-role file by design
      finding.canonicalRoleCandidate = null;
      finding.confidence = CONFIDENCE_THRESHOLDS.HIGH;
      finding.governanceFlags = this.checkGovernance(finding);
      findings.push(finding);
    }

    // Scan route files
    const routesDir = path.join(PROJECT_ROOT, 'frontend/app/routes');
    if (fs.existsSync(routesDir)) {
      const routeFiles = fs
        .readdirSync(routesDir)
        .filter(
          (f) =>
            f.startsWith('pieces.') ||
            f.startsWith('reference-auto.') ||
            f.startsWith('diagnostic.'),
        );

      for (const file of routeFiles) {
        const fullPath = path.join(routesDir, file);
        if (!fs.statSync(fullPath).isFile()) continue;

        const content = fs.readFileSync(fullPath, 'utf-8');
        const finding = this.createFinding(
          `frontend/app/routes/${file}`,
          'frontend_route',
        );
        finding.legacyLabelsDetected = this.detectLegacyLabels(content);

        // Infer role from route prefix
        const matchedPrefix = Object.keys(ROUTE_TO_ROLE).find((prefix) =>
          file.startsWith(prefix),
        );
        if (matchedPrefix) {
          finding.canonicalRoleCandidate = ROUTE_TO_ROLE[matchedPrefix];
          finding.confidence = CONFIDENCE_THRESHOLDS.MEDIUM;
        }

        finding.governanceFlags = this.checkGovernance(finding);
        findings.push(finding);
      }
    }

    return findings;
  }

  // ── P2A-1: Legacy Label Detection ──────────────────────

  private detectLegacyLabels(content: string): string[] {
    const legacyLabels = new Set<string>();
    const legacyAliasKeys = new Set(Object.keys(LEGACY_ROLE_ALIASES));
    const forbiddenIds = new Set(FORBIDDEN_ROLE_IDS as readonly string[]);

    // Detect known legacy aliases
    for (const alias of legacyAliasKeys) {
      if (content.includes(alias)) {
        legacyLabels.add(alias);
      }
    }

    // Detect bare ambiguous roles (R3, R6, R9 without suffix)
    const bareMatches = content.match(BARE_ROLE_REGEX);
    if (bareMatches) {
      for (const match of bareMatches) {
        if (forbiddenIds.has(match)) {
          legacyLabels.add(match);
        }
      }
    }

    return [...legacyLabels];
  }

  // ── P2A-2: Canonical Role Projection ──────────────────

  private projectCanonicalRole(
    legacyLabels: string[],
    artifactPath: string,
    artifactType: Phase2aArtifactType,
  ): { role: RoleId | null; confidence: number } {
    // If no legacy labels, try to infer from path
    if (legacyLabels.length === 0) {
      return this.inferRoleFromPath(artifactPath, artifactType);
    }

    // Try to normalize the most specific label
    const canonicalCandidates = new Map<RoleId, number>();

    for (const label of legacyLabels) {
      const normalized = normalizeRoleId(label);
      if (normalized) {
        const isDirectCanonical = Object.values(RoleId).includes(
          label as RoleId,
        );
        const confidence = isDirectCanonical
          ? CONFIDENCE_THRESHOLDS.HIGH
          : CONFIDENCE_THRESHOLDS.MEDIUM;
        const existing = canonicalCandidates.get(normalized) ?? 0;
        canonicalCandidates.set(normalized, Math.max(existing, confidence));
      }
    }

    if (canonicalCandidates.size === 1) {
      const [role, confidence] = [...canonicalCandidates.entries()][0];
      return { role, confidence };
    }

    if (canonicalCandidates.size > 1) {
      // Multiple roles detected — pick highest confidence, flag collision
      let bestRole: RoleId | null = null;
      let bestConfidence = 0;
      for (const [role, confidence] of canonicalCandidates) {
        if (confidence > bestConfidence) {
          bestRole = role;
          bestConfidence = confidence;
        }
      }
      // Lower confidence since ambiguous
      return { role: bestRole, confidence: bestConfidence * 0.7 };
    }

    return { role: null, confidence: CONFIDENCE_THRESHOLDS.AMBIGUOUS };
  }

  private inferRoleFromPath(
    artifactPath: string,
    _artifactType: Phase2aArtifactType,
  ): { role: RoleId | null; confidence: number } {
    const filename = path.basename(artifactPath);

    // Match schema file pattern: page-contract-rN.schema.ts
    const schemaMatch = filename.match(/page-contract-r(\d)\.schema\.ts/);
    if (schemaMatch) {
      const roleNum = schemaMatch[1];
      const roleMap: Record<string, RoleId> = {
        '1': RoleId.R1_ROUTER,
        '3': RoleId.R3_GUIDE,
        '4': RoleId.R4_REFERENCE,
        '5': RoleId.R5_DIAGNOSTIC,
        '6': RoleId.R6_GUIDE_ACHAT,
        '7': RoleId.R7_BRAND,
        '8': RoleId.R8_VEHICLE,
      };
      if (roleMap[roleNum]) {
        return {
          role: roleMap[roleNum],
          confidence: CONFIDENCE_THRESHOLDS.HIGH,
        };
      }
    }

    // Match keyword plan pattern: rN-keyword-plan.constants.ts
    const kwMatch = filename.match(/r(\d)-keyword-plan\.constants\.ts/);
    if (kwMatch) {
      const roleNum = kwMatch[1];
      const roleMap: Record<string, RoleId> = {
        '1': RoleId.R1_ROUTER,
        '2': RoleId.R2_PRODUCT,
        '4': RoleId.R4_REFERENCE,
        '6': RoleId.R6_GUIDE_ACHAT,
        '7': RoleId.R7_BRAND,
        '8': RoleId.R8_VEHICLE,
      };
      if (roleMap[roleNum]) {
        return {
          role: roleMap[roleNum],
          confidence: CONFIDENCE_THRESHOLDS.HIGH,
        };
      }
    }

    // Match route pattern
    for (const [prefix, role] of Object.entries(ROUTE_TO_ROLE)) {
      if (filename.startsWith(prefix)) {
        return { role, confidence: CONFIDENCE_THRESHOLDS.LOW };
      }
    }

    return { role: null, confidence: 0 };
  }

  // ── P2A-3 + P2A-4: Collision Detection ────────────────

  private detectCrossArtifactCollisions(
    findings: Phase2aArtifactFinding[],
  ): void {
    // Detect label collisions: same artifact path prefix, different roles
    const routeFindings = findings.filter(
      (f) => f.artifactType === 'frontend_route',
    );
    for (let i = 0; i < routeFindings.length; i++) {
      for (let j = i + 1; j < routeFindings.length; j++) {
        const a = routeFindings[i];
        const b = routeFindings[j];
        if (
          a.canonicalRoleCandidate &&
          b.canonicalRoleCandidate &&
          a.canonicalRoleCandidate !== b.canonicalRoleCandidate
        ) {
          // Check if routes share a prefix
          const prefixA = a.artifactPath.split('.')[0];
          const prefixB = b.artifactPath.split('.')[0];
          if (prefixA === prefixB) {
            const collision: Phase2aCollision = {
              type: 'route_collision',
              description: `Routes ${a.artifactPath} (${a.canonicalRoleCandidate}) and ${b.artifactPath} (${b.canonicalRoleCandidate}) share prefix "${prefixA}" but map to different roles`,
              severity: 'warning',
              relatedArtifact: b.artifactPath,
            };
            a.collisions.push(collision);
            b.collisions.push({
              ...collision,
              relatedArtifact: a.artifactPath,
            });
          }
        }
      }
    }

    // Detect theory→repo gap: DB value doesn't match code definition
    const dbFindings = findings.filter(
      (f) =>
        f.artifactType === 'db_page_role' || f.artifactType === 'db_page_type',
    );
    for (const dbFinding of dbFindings) {
      if (
        dbFinding.legacyLabelsDetected.length > 0 &&
        dbFinding.canonicalRoleCandidate
      ) {
        dbFinding.collisions.push({
          type: 'theory_repo_gap',
          description: `DB stores legacy value "${dbFinding.legacyLabelsDetected[0]}" but canonical is "${dbFinding.canonicalRoleCandidate}"`,
          severity: 'warning',
        });
      }
    }
  }

  // ── Governance Checks (G1-G5) ─────────────────────────

  private checkGovernance(
    finding: Phase2aArtifactFinding,
  ): Phase2aGovernanceFlag[] {
    const flags: Phase2aGovernanceFlag[] = [];

    flags.push(this.checkG1Purete(finding));
    flags.push(this.checkG4PromotionControl(finding));
    flags.push(this.checkG5ReviewEscalation(finding));

    return flags;
  }

  /** G1: Purity — does the artifact target exactly one canonical role? */
  private checkG1Purete(
    finding: Phase2aArtifactFinding,
  ): Phase2aGovernanceFlag {
    // Multi-role files (role definitions, type files) are exempt
    if (
      finding.artifactType === 'code_constant' &&
      (finding.artifactPath.includes('role-ids') ||
        finding.artifactPath.includes('page-role.types'))
    ) {
      return {
        layer: 'G1_PURETE',
        verdict: 'PASS',
        reason: 'Multi-role definition file (exempt)',
        evidence: [],
      };
    }

    // Check for forbidden bare roles
    const forbiddenDetected = finding.legacyLabelsDetected.filter((l) =>
      (FORBIDDEN_ROLE_IDS as readonly string[]).includes(l),
    );
    if (forbiddenDetected.length > 0) {
      return {
        layer: 'G1_PURETE',
        verdict: 'FAIL',
        reason: `Forbidden bare roles detected: ${forbiddenDetected.join(', ')}`,
        evidence: forbiddenDetected,
      };
    }

    // Check if canonical role candidate is valid
    if (finding.canonicalRoleCandidate) {
      try {
        assertCanonicalRole(finding.canonicalRoleCandidate);
        return {
          layer: 'G1_PURETE',
          verdict: finding.legacyLabelsDetected.length > 0 ? 'WARN' : 'PASS',
          reason:
            finding.legacyLabelsDetected.length > 0
              ? `Legacy labels present but resolvable: ${finding.legacyLabelsDetected.join(', ')}`
              : 'Canonical role verified',
          evidence: finding.legacyLabelsDetected,
        };
      } catch {
        return {
          layer: 'G1_PURETE',
          verdict: 'FAIL',
          reason: `assertCanonicalRole() rejected: ${finding.canonicalRoleCandidate}`,
          evidence: [finding.canonicalRoleCandidate],
        };
      }
    }

    // No canonical candidate — only FAIL if there were legacy labels
    if (finding.legacyLabelsDetected.length > 0) {
      return {
        layer: 'G1_PURETE',
        verdict: 'WARN',
        reason: `Legacy labels detected but no canonical mapping: ${finding.legacyLabelsDetected.join(', ')}`,
        evidence: finding.legacyLabelsDetected,
      };
    }

    return {
      layer: 'G1_PURETE',
      verdict: 'PASS',
      reason: 'No role labels detected (non-role artifact)',
      evidence: [],
    };
  }

  /** G4: Promotion Control — does a contract schema exist for Phase 2 real promotion? */
  private checkG4PromotionControl(
    finding: Phase2aArtifactFinding,
  ): Phase2aGovernanceFlag {
    if (!finding.canonicalRoleCandidate) {
      return {
        layer: 'G4_PROMOTION_CONTROL',
        verdict: 'PASS',
        reason: 'No specific role — G4 not applicable',
        evidence: [],
      };
    }

    const schemaFile = CONTRACT_SCHEMA_MAP[finding.canonicalRoleCandidate];
    if (!schemaFile) {
      // Roles without contracts (R0, R2, R6_SUPPORT) are not editorial — pass
      return {
        layer: 'G4_PROMOTION_CONTROL',
        verdict: 'PASS',
        reason: `Role ${finding.canonicalRoleCandidate} has no required contract schema (non-editorial or support)`,
        evidence: [],
      };
    }

    const fullPath = path.join(PROJECT_ROOT, 'backend/src/config', schemaFile);
    if (fs.existsSync(fullPath)) {
      return {
        layer: 'G4_PROMOTION_CONTROL',
        verdict: 'PASS',
        reason: `Contract schema exists: ${schemaFile}`,
        evidence: [schemaFile],
      };
    }

    return {
      layer: 'G4_PROMOTION_CONTROL',
      verdict: 'FAIL',
      reason: `Missing contract schema: ${schemaFile}`,
      evidence: [schemaFile],
    };
  }

  /** G5: Review/Escalation — low confidence or unresolved collisions? */
  private checkG5ReviewEscalation(
    finding: Phase2aArtifactFinding,
  ): Phase2aGovernanceFlag {
    if (finding.confidence < CONFIDENCE_THRESHOLDS.LOW) {
      return {
        layer: 'G5_REVIEW_ESCALATION',
        verdict: 'FAIL',
        reason: `Low confidence (${finding.confidence}) — requires human review`,
        evidence: [],
      };
    }

    const blockingCollisions = finding.collisions.filter(
      (c) => c.severity === 'blocking',
    );
    if (blockingCollisions.length > 0) {
      return {
        layer: 'G5_REVIEW_ESCALATION',
        verdict: 'FAIL',
        reason: `${blockingCollisions.length} blocking collision(s) — requires human review`,
        evidence: blockingCollisions.map((c) => c.description),
      };
    }

    return {
      layer: 'G5_REVIEW_ESCALATION',
      verdict: 'PASS',
      reason: 'Sufficient confidence and no blocking collisions',
      evidence: [],
    };
  }

  /** G2: Diversite — is the role distribution over-concentrated? */
  private checkG2Diversite(
    finding: Phase2aArtifactFinding,
    allFindings: Phase2aArtifactFinding[],
  ): Phase2aGovernanceFlag {
    if (
      !finding.canonicalRoleCandidate ||
      finding.artifactScope !== 'editorial'
    ) {
      return {
        layer: 'G2_DIVERSITE',
        verdict: 'PASS',
        reason: 'Non-editorial or no role — G2 not applicable',
        evidence: [],
      };
    }

    const editorialFindings = allFindings.filter(
      (f) => f.artifactScope === 'editorial' && f.canonicalRoleCandidate,
    );
    if (editorialFindings.length < 3) {
      return {
        layer: 'G2_DIVERSITE',
        verdict: 'PASS',
        reason: 'Too few editorial findings for distribution analysis',
        evidence: [],
      };
    }

    const roleCount = editorialFindings.filter(
      (f) => f.canonicalRoleCandidate === finding.canonicalRoleCandidate,
    ).length;
    const ratio = roleCount / editorialFindings.length;

    if (ratio > G2_CONCENTRATION_THRESHOLD) {
      return {
        layer: 'G2_DIVERSITE',
        verdict: 'WARN',
        reason: `Role ${finding.canonicalRoleCandidate} is over-concentrated: ${(ratio * 100).toFixed(0)}% of editorial artifacts (threshold: ${G2_CONCENTRATION_THRESHOLD * 100}%)`,
        evidence: [
          `${roleCount}/${editorialFindings.length} editorial artifacts`,
        ],
      };
    }

    return {
      layer: 'G2_DIVERSITE',
      verdict: 'PASS',
      reason: `Role distribution acceptable: ${(ratio * 100).toFixed(0)}%`,
      evidence: [],
    };
  }

  /** G3: Anti-cannibalisation — is the projected role eligible for this artifact's family? */
  private checkG3AntiCannibalisation(
    finding: Phase2aArtifactFinding,
  ): Phase2aGovernanceFlag {
    // Only applicable to DB artifacts with a doc_family inference
    if (
      finding.artifactType !== 'db_page_role' &&
      finding.artifactType !== 'db_page_type'
    ) {
      // For non-DB artifacts, check if route collisions were detected
      const hasRouteCollision = finding.collisions.some(
        (c) => c.type === 'route_collision',
      );
      if (hasRouteCollision) {
        return {
          layer: 'G3_ANTI_CANNIBALISATION',
          verdict: 'WARN',
          reason: 'Route collision detected — potential cannibalisation',
          evidence: finding.collisions
            .filter((c) => c.type === 'route_collision')
            .map((c) => c.description),
        };
      }
      return {
        layer: 'G3_ANTI_CANNIBALISATION',
        verdict: 'PASS',
        reason: 'No cannibalisation signal detected',
        evidence: [],
      };
    }

    // For DB artifacts, cross-check doc_family eligibility
    if (!finding.canonicalRoleCandidate) {
      return {
        layer: 'G3_ANTI_CANNIBALISATION',
        verdict: 'PASS',
        reason: 'No canonical role — G3 cross-check not applicable',
        evidence: [],
      };
    }

    // Infer doc_family from artifact path pattern (db:table.column=value)
    const docFamily = this.inferDocFamilyFromArtifact(finding);
    if (!docFamily) {
      return {
        layer: 'G3_ANTI_CANNIBALISATION',
        verdict: 'PASS',
        reason: 'No doc_family inferrable — G3 cross-check skipped',
        evidence: [],
      };
    }

    const eligibleRoles = DOC_FAMILY_ELIGIBLE_ROLES[docFamily];
    if (!eligibleRoles) {
      return {
        layer: 'G3_ANTI_CANNIBALISATION',
        verdict: 'PASS',
        reason: `Unknown doc_family "${docFamily}" — no eligibility constraint`,
        evidence: [],
      };
    }

    if (eligibleRoles.includes(finding.canonicalRoleCandidate)) {
      return {
        layer: 'G3_ANTI_CANNIBALISATION',
        verdict: 'PASS',
        reason: `Role ${finding.canonicalRoleCandidate} is eligible for family "${docFamily}"`,
        evidence: [docFamily, ...eligibleRoles],
      };
    }

    return {
      layer: 'G3_ANTI_CANNIBALISATION',
      verdict: 'FAIL',
      reason: `Role ${finding.canonicalRoleCandidate} is NOT eligible for family "${docFamily}". Eligible: ${eligibleRoles.join(', ')}`,
      evidence: [docFamily, ...eligibleRoles],
    };
  }

  /** Infer doc_family from DB artifact path pattern */
  private inferDocFamilyFromArtifact(
    finding: Phase2aArtifactFinding,
  ): string | null {
    const artifactPath = finding.artifactPath;
    if (artifactPath.includes('__seo_gamme_conseil')) return 'gamme';
    if (artifactPath.includes('__seo_gamme_purchase_guide')) return 'gamme';
    if (artifactPath.includes('__seo_page')) return 'gamme'; // most __seo_page entries are gamme
    return null;
  }

  // ── Upstream Blocking ─────────────────────────────────

  /** Check if upstream phases (1, 1.5, 1.6) have unresolved blockers for DB artifacts */
  private async checkUpstreamReadiness(
    finding: Phase2aArtifactFinding,
  ): Promise<Phase2aBlockingFamily | null> {
    // Only check upstream for DB artifacts
    if (
      finding.artifactType !== 'db_page_role' &&
      finding.artifactType !== 'db_page_type'
    ) {
      return null;
    }

    try {
      // Query __rag_knowledge for upstream phase status
      const { data, error } = await this.supabase
        .from('__rag_knowledge')
        .select('phase15_status, phase16_status')
        .not('phase15_status', 'is', null)
        .limit(5);

      if (error || !data || data.length === 0) return null;

      const rows = data as unknown as {
        phase15_status: string | null;
        phase16_status: string | null;
      }[];

      // Check for blocked upstream phases
      const hasPhase15Block = rows.some(
        (r) =>
          r.phase15_status === 'blocked' || r.phase15_status === 'quarantined',
      );
      if (hasPhase15Block) return 'phase15';

      const hasPhase16Block = rows.some((r) => r.phase16_status === 'blocked');
      if (hasPhase16Block) return 'phase16';
    } catch {
      this.logger.warn('Upstream readiness check failed — skipping');
    }

    return null;
  }

  // ── T3: Contract Candidate Inference ──────────────────

  /** Infer the probable target contract from the projected canonical role */
  private inferContractCandidate(
    finding: Phase2aArtifactFinding,
  ): string | null {
    if (!finding.canonicalRoleCandidate) return null;

    // Primary: page-contract schema
    const schema = CONTRACT_SCHEMA_MAP[finding.canonicalRoleCandidate];
    if (schema) return schema;

    // Fallback: keyword plan constants
    const kwPlan = KEYWORD_PLAN_MAP[finding.canonicalRoleCandidate];
    if (kwPlan) return kwPlan;

    return null;
  }

  // ── P2A-5: Readiness Verdict ──────────────────────────

  private computeReadinessVerdict(
    finding: Phase2aArtifactFinding,
  ): Phase2aReadinessVerdict {
    // Artifacts with no canonical target and no legacy labels → out of canon scope
    if (
      !finding.canonicalRoleCandidate &&
      finding.legacyLabelsDetected.length === 0 &&
      finding.confidence === 0
    ) {
      return 'NO_CANON_TARGET';
    }

    // Upstream blocking takes priority
    if (finding.blockingFamily) {
      return 'BLOCKED_CONTAMINATION';
    }

    const g1 = finding.governanceFlags.find((f) => f.layer === 'G1_PURETE');
    const g2 = finding.governanceFlags.find((f) => f.layer === 'G2_DIVERSITE');
    const g3 = finding.governanceFlags.find(
      (f) => f.layer === 'G3_ANTI_CANNIBALISATION',
    );
    const g4 = finding.governanceFlags.find(
      (f) => f.layer === 'G4_PROMOTION_CONTROL',
    );
    const g5 = finding.governanceFlags.find(
      (f) => f.layer === 'G5_REVIEW_ESCALATION',
    );

    // Priority order: G5 > G1 > G3 > G4 > G2 > ready

    if (g5?.verdict === 'FAIL') return 'ESCALATE_G5';
    if (g1?.verdict === 'FAIL') return 'BLOCKED_ROLE_AMBIGUITY';
    if (g3?.verdict === 'FAIL') return 'REVIEW_REQUIRED_G3';
    if (g4?.verdict === 'FAIL') return 'BLOCKED_CONTRACT_MISSING';

    if (g1?.verdict === 'WARN') return 'REVIEW_REQUIRED_G1';
    if (g2?.verdict === 'WARN') return 'REVIEW_REQUIRED_G2';

    if (
      finding.confidence >= CONFIDENCE_THRESHOLDS.HIGH &&
      finding.collisions.length === 0
    ) {
      return 'READY_FOR_PHASE2_REAL';
    }

    if (finding.collisions.some((c) => c.severity === 'warning')) {
      return 'REVIEW_REQUIRED_G3';
    }

    return 'READY_FOR_PHASE2_REAL';
  }

  private computeRecommendedAction(
    finding: Phase2aArtifactFinding,
  ): Phase2aRecommendedAction {
    switch (finding.readinessVerdict) {
      case 'READY_FOR_PHASE2_REAL':
        return 'ready_for_phase2_real';
      case 'NO_CANON_TARGET':
        return 'mark_out_of_scope';
      case 'BLOCKED_ROLE_AMBIGUITY':
        return 'fix_phase15_taxonomy';
      case 'BLOCKED_CONTRACT_MISSING':
        return 'remap_contract';
      case 'BLOCKED_CONTAMINATION':
        return 'fix_phase16_admissibility';
      case 'REVIEW_REQUIRED_G1':
        return finding.legacyLabelsDetected.length > 0
          ? 'fix_phase15_taxonomy'
          : 'split_role';
      case 'REVIEW_REQUIRED_G2':
        return 'split_role';
      case 'REVIEW_REQUIRED_G3':
        return 'split_role';
      case 'HOLD_G4':
        return 'mark_shadow_only';
      case 'ESCALATE_G5':
        return 'escalate_human_review';
      default:
        return 'escalate_human_review';
    }
  }

  // ── Canon Verdict (spec-aligned semantic layer) ──────

  private computeCanonVerdict(
    finding: Phase2aArtifactFinding,
  ): Phase2aCanonVerdict {
    // Upstream blocking
    if (finding.blockingFamily) return 'BLOCKED_UPSTREAM';

    switch (finding.readinessVerdict) {
      case 'READY_FOR_PHASE2_REAL':
        return finding.legacyLabelsDetected.length > 0
          ? 'CANONICAL_MATCH_WITH_WARNINGS'
          : 'CANONICAL_MATCH';

      case 'REVIEW_REQUIRED_G1':
        // G1 warn = legacy labels or multi-role
        if (finding.legacyLabelsDetected.length > 0) {
          return 'LEGACY_REMAP_REQUIRED';
        }
        return 'ROLE_SPLIT_REQUIRED';

      case 'REVIEW_REQUIRED_G2':
        return 'GOVERNANCE_SPLIT_REQUIRED';

      case 'REVIEW_REQUIRED_G3':
        return finding.collisions.some((c) => c.type === 'route_collision')
          ? 'ROLE_SPLIT_REQUIRED'
          : 'LEGACY_REMAP_REQUIRED';

      case 'BLOCKED_ROLE_AMBIGUITY':
        return 'ROLE_SPLIT_REQUIRED';

      case 'BLOCKED_CONTRACT_MISSING':
        return 'CONTRACT_REMAP_REQUIRED';

      case 'BLOCKED_CONTAMINATION':
        return 'BLOCKED_UPSTREAM';

      case 'HOLD_G4':
        return 'CONTRACT_REMAP_REQUIRED';

      case 'ESCALATE_G5':
        return 'ESCALATION_REQUIRED';

      case 'NO_CANON_TARGET':
        return 'ESCALATION_REQUIRED'; // Out of scope → needs human decision

      default:
        return 'ESCALATION_REQUIRED';
    }
  }

  // ── Summary ───────────────────────────────────────────

  private computeSummary(
    findings: Phase2aArtifactFinding[],
  ): Phase2aAuditSummary {
    // Compute canon verdict counts
    const canonVerdictCounts = {} as Record<string, number>;
    for (const v of PHASE2A_CANON_VERDICTS) {
      canonVerdictCounts[v] = findings.filter(
        (f) => f.canonVerdict === v,
      ).length;
    }

    return {
      readyCount: findings.filter(
        (f) => f.readinessVerdict === 'READY_FOR_PHASE2_REAL',
      ).length,
      blockedCount: findings.filter((f) =>
        f.readinessVerdict.startsWith('BLOCKED_'),
      ).length,
      reviewRequiredCount: findings.filter((f) =>
        f.readinessVerdict.startsWith('REVIEW_REQUIRED_'),
      ).length,
      holdCount: findings.filter((f) => f.readinessVerdict === 'HOLD_G4')
        .length,
      escalateCount: findings.filter(
        (f) => f.readinessVerdict === 'ESCALATE_G5',
      ).length,
      outOfScopeCount: findings.filter(
        (f) => f.readinessVerdict === 'NO_CANON_TARGET',
      ).length,
      canonVerdictCounts,
    };
  }

  // ── Persistence ───────────────────────────────────────

  private async persistReport(report: Phase2aAuditReport): Promise<void> {
    const { error } = await this.supabase
      .from('__phase2a_audit_reports')
      .insert({
        id: report.auditId,
        version: report.version,
        status:
          report.phase2aStatus === 'audit_complete'
            ? 'complete'
            : report.phase2aStatus === 'audit_partial'
              ? 'partial'
              : 'failed',
        total_artifacts: report.totalArtifactsScanned,
        total_legacy_detected: report.totalLegacyDetected,
        total_collisions: report.totalCollisions,
        total_blockers: report.totalBlockers,
        summary: report.summary,
        report: report as unknown as Record<string, unknown>,
        started_at: report.startedAt,
        completed_at: report.completedAt,
        triggered_by: 'admin',
      });

    if (error) {
      this.logger.warn(`Failed to persist audit report: ${error.message}`);
    }
  }

  // ── Helpers ───────────────────────────────────────────

  private createFinding(
    artifactPath: string,
    artifactType: Phase2aArtifactType,
  ): Phase2aArtifactFinding {
    return {
      artifactPath,
      artifactType,
      artifactScope: inferArtifactScope(artifactPath, null),
      legacyLabelsDetected: [],
      canonicalRoleCandidate: null,
      confidence: 0,
      confidenceBand: 'UNSAFE' as ConfidenceBand,
      collisions: [],
      governanceFlags: [],
      canonicalContractCandidate: null,
      readinessVerdict: 'ESCALATE_G5', // Default — overwritten by computeReadinessVerdict
      recommendedAction: 'escalate_human_review', // Default — overwritten by computeRecommendedAction
      blockReasons: [],
      blockingFamily: null,
      canonVerdict: null,
    };
  }

  /** Simple recursive glob for .md files */
  private globSync(dir: string, _pattern: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.globSync(fullPath, _pattern));
      } else if (entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
    return results;
  }
}
