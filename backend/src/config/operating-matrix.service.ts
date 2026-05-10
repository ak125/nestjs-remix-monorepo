/**
 * OperatingMatrixService — single source of the SEO Agent Operating Matrix.
 *
 * Consumed by:
 *  - WriteGuardModule.onModuleInit (boot invariant — same logs as before)
 *  - GovernanceMatrixController (admin endpoint)
 *  - scripts/seo/dump-agent-matrix.ts (CLI dump)
 *
 * Zero filesystem I/O on the canon side: registry/catalog are imported objects.
 * Filesystem is only touched for (a) hashing source files and (b) scanning
 * `.claude/agents/` directories — both gated by skipAgentScan in production.
 *
 * @see plan: /home/deploy/.claude/plans/verifier-analyse-plus-delegated-globe.md
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import matter from 'gray-matter';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  parseAgentFrontmatter,
  safeParseAgentFrontmatter,
} from './agent-frontmatter.schema';
import {
  EXECUTION_REGISTRY,
  EXECUTION_REGISTRY_VERSION,
} from './execution-registry.constants';
import {
  FIELD_CATALOG,
  GROUP_TABLE_MAP,
  deriveWriteScope,
} from './field-catalog.constants';
import { ROLE_ID_LIST, RoleId } from './role-ids';
import type {
  MatrixAnomaly,
  MatrixGap,
  MatrixRoleEntry,
  MatrixRoleRegistrySnapshot,
  MatrixRoleWriteScope,
  MatrixSourcesHash,
  OperatingMatrix,
} from './operating-matrix.types';

const AGENT_PATHS = [
  'workspaces/seo-batch/.claude/agents',
  '.claude/agents',
  'backend/.claude/agents',
] as const;

const SOURCE_FILES: Record<keyof MatrixSourcesHash, string> = {
  executionRegistry: 'backend/src/config/execution-registry.constants.ts',
  executionRegistryTypes: 'backend/src/config/execution-registry.types.ts',
  fieldCatalog: 'backend/src/config/field-catalog.constants.ts',
  roleIds: 'backend/src/config/role-ids.ts',
};

/** Roles flagged @deprecated in role-ids.ts. Kept here as the single canon set used by the matrix. */
const DEPRECATED_ROLES: ReadonlySet<RoleId> = new Set<RoleId>([
  RoleId.R3_GUIDE,
  RoleId.R9_GOVERNANCE,
]);

/**
 * Roles that intentionally have NO `EXECUTION_REGISTRY` entry because their
 * agents are validators / orchestration templates / shared utilities, not
 * writers. Excluded from `gaps[]` — they are not "registry-missing" defects,
 * they are by-design.
 *
 * Inventory evidence (2026-04-30):
 *  - R0_HOME: r0-home-execution.md + r0-home-validator.md → JSON output only
 *  - R6_SUPPORT: r6-support-validator.md → JSON output only, "n'est pas un
 *    rôle éditorial canonique cœur" (file body L8)
 *  - AGENTIC_ENGINE (ADR-037): agentic-critic/planner/solver — orchestrators
 *  - FOUNDATION (ADR-037): brief-enricher, keyword-planner, research-agent…
 *    — utilitaires partagés cross-rôle, pas de scope d'écriture exclusif
 *
 * If a NEW writing agent appears under these roles, the role must be added
 * to EXECUTION_REGISTRY and removed from this set.
 */
const NON_WRITING_ROLES: ReadonlySet<RoleId> = new Set<RoleId>([
  RoleId.R0_HOME,
  RoleId.R6_SUPPORT,
  RoleId.AGENTIC_ENGINE,
  RoleId.FOUNDATION,
]);

interface AgentFile {
  source: string;
  file: string;
  /** Resolved RoleId from the file's frontmatter `role:` (ADR-037). */
  role: RoleId;
}

interface AgentParseError {
  source: string;
  file: string;
  message: string;
}

interface AgentScanResult {
  agents: AgentFile[];
  errors: AgentParseError[];
  scannedPaths: string[];
  skipped: boolean;
  skipReason?: 'production_default' | 'no_paths_found';
}

/**
 * Recursive canonicalisation: sort object keys alphabetically at all depths.
 * Arrays preserved in their incoming order — the service sorts arrays
 * explicitly with a domain-aware comparator before passing data through here.
 */
function canonicalize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => canonicalize(v)) as unknown as T;
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    (value as object).constructor === Object
  ) {
    const src = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) {
      sorted[k] = canonicalize(src[k]);
    }
    return sorted as T;
  }
  return value;
}

@Injectable()
export class OperatingMatrixService {
  private readonly logger = new Logger(OperatingMatrixService.name);
  private readonly repoRoot: string;
  private readonly skipAgentScan: boolean;

  constructor(private readonly configService: ConfigService) {
    this.repoRoot =
      this.configService.get<string>('REPO_ROOT') ??
      path.resolve(__dirname, '../../..');

    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const optIn =
      this.configService.get<string>('OPERATING_MATRIX_SCAN_AGENTS') === '1';
    this.skipAgentScan = isProd && !optIn;
  }

  /** Canonical snapshot — basis for both Markdown and JSON outputs. */
  snapshot(): OperatingMatrix {
    const scan = this.scanAllAgents();
    const agentsByRole = this.groupAgentsByRole(scan.agents);

    const roles: MatrixRoleEntry[] = ROLE_ID_LIST.map((roleId) =>
      this.buildRoleEntry(roleId, agentsByRole.get(roleId) ?? []),
    );

    const agentsIndex = this.buildAgentsIndex(scan.agents);
    const gaps = this.detectGaps(roles);
    const anomalies = this.detectAnomalies(roles);

    const matrix: OperatingMatrix = {
      registryVersion: EXECUTION_REGISTRY_VERSION,
      catalogFieldCount: FIELD_CATALOG.length,
      sourcesHash: this.hashSourceFiles(),
      agentScanSkipped: scan.skipped,
      agentScanSkipReason: scan.skipReason,
      agentScanRootsConfigured: [...AGENT_PATHS],
      agentScanRootsFound: scan.scannedPaths.length
        ? scan.scannedPaths
        : undefined,
      roles,
      agentsIndex,
      gaps,
      anomalies,
    };

    return matrix;
  }

  /** JSON output (stable across runs — relied on by `seo:matrix:check` CI). */
  formatJson(): OperatingMatrix {
    const snap = this.snapshot();
    // Strip filesystem-dependent field for committed JSON (R6 determinism).
    const { agentScanRootsFound: _drop, ...stable } = snap;
    return canonicalize(stable as OperatingMatrix);
  }

  /** Stable JSON serialised — what the CLI writes to disk. */
  formatJsonString(): string {
    return JSON.stringify(this.formatJson(), null, 2) + '\n';
  }

  /** Markdown for humans. Includes timestamp + filesystem-found paths. */
  formatMarkdown(): string {
    const snap = this.snapshot();
    return this.renderMarkdown(snap);
  }

  /**
   * Boot log lines reproducing the legacy WriteGuardModule.onModuleInit format.
   * Returned as an ordered list so the consumer can `logger.log` / `logger.warn`
   * / `logger.error` each line preserving the original log levels.
   *
   * Since ADR-037, agent frontmatter parse errors are surfaced as `level: 'error'`
   * BEFORE the registry summary — fail-fast at boot if any agent has a missing
   * or invalid `role:` frontmatter key.
   */
  formatBootLog(): Array<{ level: 'log' | 'warn' | 'error'; message: string }> {
    const lines: Array<{
      level: 'log' | 'warn' | 'error';
      message: string;
    }> = [];

    // ADR-037: fail-fast on agent frontmatter parse errors. Surfaced first so
    // a broken agent doesn't get masked by the rest of the registry summary.
    const scan = this.scanAllAgents();
    for (const err of scan.errors) {
      lines.push({
        level: 'error',
        message: `WriteGuard: agent frontmatter invalid — ${err.source}/${err.file}: ${err.message}`,
      });
    }

    const rolesSeen = new Set<string>();
    let fieldsTotal = 0;

    for (const entry of Object.values(EXECUTION_REGISTRY)) {
      const scope = deriveWriteScope(entry.roleId);
      if (scope.ownedFields.length === 0) {
        lines.push({
          level: 'warn',
          message: `WriteGuard: role ${entry.roleId} has no owned fields in FIELD_CATALOG`,
        });
      } else {
        lines.push({
          level: 'log',
          message:
            `WriteGuard: role ${entry.roleId} owns ${scope.ownedFields.length} fields ` +
            `across ${scope.resourceGroups.length} groups (${scope.resourceGroups.join(', ')})`,
        });
      }
      rolesSeen.add(entry.roleId);
      fieldsTotal += scope.ownedFields.length;
    }

    const orphanRoles = new Set<string>();
    for (const field of FIELD_CATALOG) {
      if (!rolesSeen.has(field.ownerRole)) {
        orphanRoles.add(field.ownerRole);
      }
    }
    if (orphanRoles.size > 0) {
      lines.push({
        level: 'warn',
        message: `WriteGuard: FIELD_CATALOG references roles not in registry: ${[...orphanRoles].join(', ')}`,
      });
    }

    lines.push({
      level: 'log',
      message:
        `WriteGuard: initialized — ${FIELD_CATALOG.length} catalog entries, ` +
        `${fieldsTotal} owned fields across ${rolesSeen.size} roles`,
    });

    return lines;
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Scan tous les agents `.claude/agents/**\/*.md` et résout leur RoleId
   * depuis le frontmatter `role:` (ADR-037). Plus aucune extraction par
   * regex sur filename — la convention filename reste informative pour les
   * humains, mais le frontmatter est la seule source de vérité.
   *
   * Gray-matter + Zod : un fichier sans frontmatter / sans `role:` / avec
   * un `role:` non listé dans `ROLE_ID_LIST` produit une `AgentParseError`
   * qui est ensuite propagée par `formatBootLog()` en `level: 'error'`.
   *
   * Le scan utilise un cache mémoire `mtime → result` par fichier — invalidé
   * dès qu'un fichier est modifié. Pour 39 agents le coût initial est
   * sub-100ms total.
   */
  private agentScanCache: Map<
    string,
    { mtimeMs: number; agent: AgentFile | null; error: AgentParseError | null }
  > = new Map();

  private scanAllAgents(): AgentScanResult {
    if (this.skipAgentScan) {
      return {
        agents: [],
        errors: [],
        scannedPaths: [],
        skipped: true,
        skipReason: 'production_default',
      };
    }
    const scannedPaths: string[] = [];
    const agents: AgentFile[] = [];
    const errors: AgentParseError[] = [];

    for (const rel of AGENT_PATHS) {
      const abs = path.resolve(this.repoRoot, rel);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
      scannedPaths.push(rel);

      for (const file of fs.readdirSync(abs)) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(abs, file);

        // mtime cache lookup — avoid re-parsing unchanged files on
        // repeated `snapshot()` calls (admin endpoint, CLI dump, tests).
        const mtimeMs = fs.statSync(filePath).mtimeMs;
        const cached = this.agentScanCache.get(filePath);
        if (cached && cached.mtimeMs === mtimeMs) {
          if (cached.agent) agents.push(cached.agent);
          if (cached.error) errors.push(cached.error);
          continue;
        }

        const result = this.parseAgentFile(rel, file, filePath);
        this.agentScanCache.set(filePath, { mtimeMs, ...result });
        if (result.agent) agents.push(result.agent);
        if (result.error) errors.push(result.error);
      }
    }

    if (scannedPaths.length === 0) {
      return {
        agents: [],
        errors: [],
        scannedPaths: [],
        skipped: true,
        skipReason: 'no_paths_found',
      };
    }
    return { agents, errors, scannedPaths, skipped: false };
  }

  /**
   * Parse a single agent .md file. Returns either an AgentFile (success) or
   * an AgentParseError (Zod validation or YAML parse failure). Never throws.
   */
  private parseAgentFile(
    source: string,
    file: string,
    filePath: string,
  ): { agent: AgentFile | null; error: AgentParseError | null } {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      return {
        agent: null,
        error: {
          source,
          file,
          message: `cannot read file: ${(e as Error).message}`,
        },
      };
    }

    let data: unknown;
    try {
      data = matter(raw).data;
    } catch (e) {
      return {
        agent: null,
        error: {
          source,
          file,
          message: `frontmatter parse error: ${(e as Error).message}`,
        },
      };
    }

    const result = safeParseAgentFrontmatter(data);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; ');
      return {
        agent: null,
        error: {
          source,
          file,
          message: `Zod validation failed — ${issues}`,
        },
      };
    }

    return {
      agent: { source, file, role: result.data.role as RoleId },
      error: null,
    };
  }

  /**
   * Strict variant used by the migration script and tests — parses an agent
   * frontmatter raw object and throws on failure. Re-exports the Zod
   * parser via the service so callers don't import the schema directly.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static _parseAgentFrontmatter = parseAgentFrontmatter;

  private groupAgentsByRole(agents: AgentFile[]): Map<RoleId, string[]> {
    const map = new Map<RoleId, string[]>();
    for (const a of agents) {
      const baseName = a.file.replace(/\.md$/, '');
      const list = map.get(a.role) ?? [];
      list.push(baseName);
      map.set(a.role, list);
    }
    for (const [k, v] of map) {
      map.set(
        k,
        v.slice().sort((x, y) => x.localeCompare(y)),
      );
    }
    return map;
  }

  private buildAgentsIndex(agents: AgentFile[]): Record<string, RoleId> {
    const entries: Array<[string, RoleId]> = agents.map((a) => [
      a.file.replace(/\.md$/, ''),
      a.role,
    ]);
    entries.sort(([x], [y]) => x.localeCompare(y));
    return Object.fromEntries(entries);
  }

  private buildRoleEntry(roleId: RoleId, agents: string[]): MatrixRoleEntry {
    const registry = this.buildRegistrySnapshot(roleId);
    const writeScope = this.buildWriteScope(roleId);
    const deprecated = DEPRECATED_ROLES.has(roleId);
    const healthScore = this.computeHealthScore({
      registry,
      writeScope,
      agentCount: agents.length,
      deprecated,
    });
    return {
      roleId,
      deprecated,
      registry,
      writeScope,
      agents,
      healthScore,
    };
  }

  private buildRegistrySnapshot(roleId: RoleId): MatrixRoleRegistrySnapshot {
    const entry = EXECUTION_REGISTRY[roleId];
    if (!entry) return { present: false };
    return {
      present: true,
      contractSchemaRef: entry.contractSchemaRef,
      enricherServiceKey: entry.enricherServiceKey,
      agentFiles: entry.agentFiles,
      allowedModes: entry.allowedModes,
      defaultWriteMode: entry.defaultWriteMode,
      stopPolicy: entry.stopPolicy,
    };
  }

  private buildWriteScope(roleId: RoleId): MatrixRoleWriteScope {
    const scope = deriveWriteScope(roleId);
    const ownedTables = scope.resourceGroups
      .map((g) => GROUP_TABLE_MAP[g]?.table)
      .filter((t): t is string => Boolean(t));
    return {
      resourceGroups: scope.resourceGroups,
      ownedTables,
      ownedFieldsCount: scope.ownedFields.length,
    };
  }

  private computeHealthScore(args: {
    registry: MatrixRoleRegistrySnapshot;
    writeScope: MatrixRoleWriteScope;
    agentCount: number;
    deprecated: boolean;
  }): number {
    let score = 0;
    if (args.registry.present) score += 30;
    if (args.agentCount >= 1) score += 20;
    if (args.writeScope.ownedFieldsCount > 0) score += 30;
    if (!args.deprecated) score += 20;
    return score;
  }

  private detectGaps(roles: MatrixRoleEntry[]): MatrixGap[] {
    return roles
      .filter(
        (r) =>
          !r.registry.present &&
          r.agents.length > 0 &&
          // Validators / orchestration templates are by-design without registry.
          // Excluding them means the gaps[] list reflects ACTIONABLE defects
          // only — a non-empty gaps[] means "someone needs to add a registry
          // entry", not "we have read-only agents lying around".
          !NON_WRITING_ROLES.has(r.roleId),
      )
      .map((r) => ({
        roleId: r.roleId,
        reason: 'agents_without_registry' as const,
        agentCount: r.agents.length,
        agents: r.agents,
      }))
      .sort((a, b) => a.roleId.localeCompare(b.roleId));
  }

  private detectAnomalies(roles: MatrixRoleEntry[]): MatrixAnomaly[] {
    const out: MatrixAnomaly[] = [];

    // 1. Deprecated roles still in registry.
    for (const r of roles) {
      if (r.deprecated && r.registry.present) {
        out.push({ roleId: r.roleId, reason: 'deprecated_but_in_registry' });
      }
    }

    // 2. Duplicate (table.field) in FIELD_CATALOG (Map last-write-wins masks them).
    const seen = new Set<string>();
    for (const f of FIELD_CATALOG) {
      const key = `${f.table}.${f.field}`;
      if (seen.has(key)) {
        out.push({
          table: f.table,
          field: f.field,
          reason: 'duplicate_field_in_catalog',
        });
      } else {
        seen.add(key);
      }
    }

    // 3. Tables in FIELD_CATALOG with no GROUP_TABLE_MAP entry for their group.
    const ungroupedTables = new Set<string>();
    for (const f of FIELD_CATALOG) {
      const target = GROUP_TABLE_MAP[f.resourceGroup];
      if (!target) ungroupedTables.add(f.table);
    }
    for (const t of [...ungroupedTables].sort()) {
      out.push({ table: t, reason: 'in_field_catalog_but_no_group_table_map' });
    }

    return out.sort((a, b) => {
      const ka = (a.roleId ?? a.table ?? '') + '|' + a.reason;
      const kb = (b.roleId ?? b.table ?? '') + '|' + b.reason;
      return ka.localeCompare(kb);
    });
  }

  private hashSourceFiles(): MatrixSourcesHash {
    const out = {} as MatrixSourcesHash;
    for (const [key, rel] of Object.entries(SOURCE_FILES) as Array<
      [keyof MatrixSourcesHash, string]
    >) {
      const abs = path.resolve(this.repoRoot, rel);
      let raw = '';
      try {
        raw = fs.readFileSync(abs, 'utf-8');
      } catch (err) {
        this.logger.warn(
          `OperatingMatrix: cannot hash ${rel} (${(err as Error).message})`,
        );
      }
      out[key] = 'sha256:' + createHash('sha256').update(raw).digest('hex');
    }
    return out;
  }

  // ── Markdown rendering ───────────────────────────────────────────

  private renderMarkdown(snap: OperatingMatrix): string {
    const lines: string[] = [];
    lines.push('# SEO Agent Operating Matrix');
    lines.push('');
    lines.push(`> Généré le : ${new Date().toISOString()}`);
    lines.push(
      `> Sources hash : registry=${this.shortHash(snap.sourcesHash.executionRegistry)} ` +
        `types=${this.shortHash(snap.sourcesHash.executionRegistryTypes)} ` +
        `catalog=${this.shortHash(snap.sourcesHash.fieldCatalog)} ` +
        `roleIds=${this.shortHash(snap.sourcesHash.roleIds)}`,
    );
    lines.push(
      `> Registry version : ${snap.registryVersion} — Field catalog : ${snap.catalogFieldCount} entrées`,
    );
    lines.push('');

    if (snap.agentScanSkipped) {
      const reason =
        snap.agentScanSkipReason === 'production_default'
          ? "désactivé en production. Set `OPERATING_MATRIX_SCAN_AGENTS=1` pour l'activer."
          : 'aucun chemin agent trouvé sur le filesystem.';
      lines.push(`> ⚠️ **Agent scan désactivé** — ${reason}`);
      lines.push('');
    }

    lines.push('## Matrice principale');
    lines.push('');
    lines.push(
      '| Rôle | Health | Registry | Agents | Tables ownées | # Fields |',
    );
    lines.push('|---|---|---|---|---|---|');
    for (const r of snap.roles) {
      const reg = r.registry.present ? '✅' : '❌';
      const dep = r.deprecated ? ' (deprecated)' : '';
      const agents = r.agents.length ? r.agents.join(', ') : '—';
      const tables = r.writeScope.ownedTables.length
        ? r.writeScope.ownedTables.join(', ')
        : '—';
      lines.push(
        `| ${r.roleId}${dep} | ${r.healthScore} | ${reg} | ${agents} | ${tables} | ${r.writeScope.ownedFieldsCount} |`,
      );
    }
    lines.push('');

    lines.push('## Gaps (agents sans entrée registry)');
    lines.push('');
    if (snap.gaps.length === 0) {
      lines.push('_Aucun gap détecté._');
    } else {
      for (const g of snap.gaps) {
        lines.push(
          `- ❌ **${g.roleId}** : ${g.agentCount} agent(s) — ${g.agents.join(', ')}`,
        );
      }
    }
    lines.push('');

    lines.push('## Anomalies');
    lines.push('');
    if (snap.anomalies.length === 0) {
      lines.push('_Aucune anomalie._');
    } else {
      for (const a of snap.anomalies) {
        const id = a.roleId
          ? a.roleId
          : a.field
            ? `${a.table}.${a.field}`
            : a.table;
        lines.push(`- ⚠️ **${id}** — ${a.reason}`);
      }
    }
    lines.push('');

    lines.push('## Index inverse (agent → rôle)');
    lines.push('');
    if (Object.keys(snap.agentsIndex).length === 0) {
      lines.push('_Vide (scan désactivé ou aucun agent trouvé)._');
    } else {
      lines.push('| Agent | Rôle résolu |');
      lines.push('|---|---|');
      for (const [agent, roleId] of Object.entries(snap.agentsIndex)) {
        lines.push(`| ${agent} | ${roleId} |`);
      }
    }
    lines.push('');

    lines.push('---');
    lines.push('');
    lines.push(
      `_Paths agent configurés : ${snap.agentScanRootsConfigured.join(', ')}_`,
    );
    if (snap.agentScanRootsFound?.length) {
      lines.push(
        `_Paths agent effectivement scannés : ${snap.agentScanRootsFound.join(', ')}_`,
      );
    }
    lines.push('');
    lines.push(
      '_Source : OperatingMatrixService (`backend/src/config/operating-matrix.service.ts`). Régénérer via `npm run seo:matrix`._',
    );

    return lines.join('\n') + '\n';
  }

  private shortHash(full: string): string {
    return full.startsWith('sha256:') ? full.slice(7, 15) : full.slice(0, 8);
  }
}
