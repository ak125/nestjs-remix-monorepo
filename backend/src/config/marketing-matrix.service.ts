/**
 * MarketingMatrixService — single source of the Marketing Agent Operating Matrix.
 *
 * Pattern miroir de OperatingMatrixService (ADR-025) mais scope marketing distinct
 * (ADR-036 §"OperatingMatrixService étendu" — implémenté via service séparé pour
 * éviter le god-object et garder le snapshot JSON SEO figé inchangé).
 *
 * Consumed by:
 *  - GovernanceMatrixController (admin endpoint marketing — Phase 1.4 PR-1.4)
 *  - scripts/marketing/dump-marketing-matrix.ts (CLI dump — Phase 1.5 PR-1.5)
 *  - Brief validation invariant : tout brief inséré dans __marketing_brief
 *    doit satisfaire les 4 `requires` (vérifié DTO Zod côté NestJS).
 *
 * Filesystem touché uniquement pour :
 *   (a) hash des sources (déterminisme)
 *   (b) scan workspaces/marketing/.claude/agents/
 * Les 2 sont gated par `skipAgentScan` (production default).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import matter from 'gray-matter';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { safeParseMarketingAgentFrontmatter } from './marketing-agent-frontmatter.schema';
import {
  MarketingAgentEntry,
  MarketingAgentParseError,
  MarketingBusinessUnit,
  MarketingChannel,
  MarketingConversionGoal,
  MarketingGateLevel,
  MarketingInvariant,
  MarketingInvariantKey,
  MarketingMatrix,
  MarketingMatrixSourcesHash,
  MarketingRoleId,
} from './marketing-matrix.types';

/** Path scanné pour les agents marketing (workspace dédié, pas seo-batch). */
const MARKETING_AGENT_PATHS = ['workspaces/marketing/.claude/agents'] as const;

/** Hash file = canon distribué localement (pas filesystem vault qui est read-only sur PROD/AI-COS). */
const SOURCE_FILES: Record<keyof MarketingMatrixSourcesHash, string> = {
  matrixTypes: 'backend/src/config/marketing-matrix.types.ts',
  marketingVoiceCanon: '.claude/canon-mirrors/marketing-voice.md',
};

/**
 * Liste canon des invariants — alpha-sorted pour stabilité snapshot.
 * Source ADR-036 §"OperatingMatrixService étendu".
 */
const INVARIANT_REQUIRES: ReadonlyArray<MarketingInvariantKey> = [
  'aec_manifest',
  'brand_compliance_gate',
  'business_unit_defined',
  'conversion_goal_defined',
];

/**
 * Subdomains officiels du module — ECOMMERCE et LOCAL.
 * HYBRID est exceptionnel (cas cross-business strict) — pas un subdomain principal.
 */
const SUBDOMAINS: ReadonlyArray<MarketingBusinessUnit> = [
  MarketingBusinessUnit.ECOMMERCE,
  MarketingBusinessUnit.LOCAL,
];

/**
 * Agents Phase 1-2 attendus selon ADR-036, avec leur RoleId canonique attendu
 * (ADR-038). Si un fichier existe mais déclare un `role:` qui ne matche pas
 * cette table → erreur boot (cross-validation frontmatter ↔ canon code).
 *
 * Les agents peuvent ne pas exister encore au filesystem ; dans ce cas
 * `MarketingAgentEntry.present = false` et `role = null`.
 */
const EXPECTED_AGENT_ROLES: ReadonlyMap<string, MarketingRoleId> = new Map([
  ['customer-retention-agent', MarketingRoleId.CUSTOMER_RETENTION],
  ['local-business-agent', MarketingRoleId.LOCAL_BUSINESS],
  ['marketing-lead-agent', MarketingRoleId.MARKETING_LEAD],
]);

/** Liste alpha-sorted des agents attendus (dérivée d'EXPECTED_AGENT_ROLES). */
const AGENTS_EXPECTED: ReadonlyArray<string> = [
  ...EXPECTED_AGENT_ROLES.keys(),
].sort();

interface AgentScanResult {
  agents: MarketingAgentEntry[];
  parseErrors: MarketingAgentParseError[];
  scannedPaths: string[];
  skipped: boolean;
  skipReason?: 'production_default' | 'no_paths_found';
}

/** Recursive canonicalisation: alpha-sort object keys for stable JSON. */
function canonicalize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => canonicalize(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = canonicalize((value as Record<string, unknown>)[k]);
    }
    return out as T;
  }
  return value;
}

@Injectable()
export class MarketingMatrixService {
  private readonly logger = new Logger(MarketingMatrixService.name);
  private readonly skipAgentScan: boolean;
  private readonly repoRoot: string;
  /** Dernières parseErrors collectées par scanAgents() — exposées via formatBootLog(). */
  private lastParseErrors: ReadonlyArray<MarketingAgentParseError> = [];

  constructor(private readonly config: ConfigService) {
    // Production default : skip filesystem scan (matrix sans agents detected, invariants only).
    // Override via env MARKETING_MATRIX_SCAN_AGENTS=true for dev/CI.
    this.skipAgentScan =
      this.config.get<string>('MARKETING_MATRIX_SCAN_AGENTS') !== 'true' &&
      this.config.get<string>('NODE_ENV') === 'production';
    // repoRoot = .../backend/.. (2 levels up from src/config/)
    this.repoRoot = path.resolve(__dirname, '..', '..', '..');
  }

  /** Snapshot complet à instant T. */
  snapshot(): MarketingMatrix {
    const scan = this.scanAgents();
    this.lastParseErrors = scan.parseErrors;
    const sourcesHash = this.hashSourceFiles();

    const invariant: MarketingInvariant = {
      requires: INVARIANT_REQUIRES,
      subdomains: SUBDOMAINS,
    };

    const channels = Object.values(
      MarketingChannel,
    ).sort() as MarketingChannel[];
    const conversionGoals = Object.values(
      MarketingConversionGoal,
    ).sort() as MarketingConversionGoal[];
    const gateLevels = Object.values(
      MarketingGateLevel,
    ).sort() as MarketingGateLevel[];

    const matrix: MarketingMatrix = {
      version: '1.0.0',
      module: 'MARKETING',
      sourcesHash,
      invariant,
      channels,
      conversionGoals,
      gateLevels,
      agentsExpected: AGENTS_EXPECTED,
      agents: scan.agents,
      agentScanSkipped: scan.skipped,
      agentScanSkipReason: scan.skipReason,
      agentScanRootsFound: scan.scannedPaths.length
        ? scan.scannedPaths
        : undefined,
    };

    return matrix;
  }

  /** JSON déterministe (CI snapshot — `audit-reports/marketing-operating-matrix.json`). */
  formatJson(): MarketingMatrix {
    const snap = this.snapshot();
    // Strip filesystem-dependent field for committed JSON.
    const { agentScanRootsFound: _drop, ...stable } = snap;
    return canonicalize(stable as MarketingMatrix);
  }

  formatJsonString(): string {
    return JSON.stringify(this.formatJson(), null, 2) + '\n';
  }

  /** Markdown for humans (admin dashboard, CLI). */
  formatMarkdown(): string {
    const snap = this.snapshot();
    const lines: string[] = [];
    lines.push('# Marketing Operating Matrix');
    lines.push('');
    lines.push(`- module: \`${snap.module}\``);
    lines.push(`- version: \`${snap.version}\``);
    lines.push(`- subdomains: ${snap.invariant.subdomains.join(', ')}`);
    lines.push('');
    lines.push('## Invariants `requires`');
    lines.push('');
    for (const r of snap.invariant.requires) {
      lines.push(`- \`${r}\``);
    }
    lines.push('');
    lines.push('## Channels autorisés');
    lines.push('');
    lines.push(snap.channels.map((c) => `\`${c}\``).join(', '));
    lines.push('');
    lines.push('## Conversion goals');
    lines.push('');
    lines.push(snap.conversionGoals.map((g) => `\`${g}\``).join(', '));
    lines.push('');
    lines.push('## Agents');
    lines.push('');
    lines.push('| Agent | Role canon | Scope frontmatter | Présent ? |');
    lines.push('|---|---|---|---|');
    for (const exp of snap.agentsExpected) {
      const found = snap.agents.find((a) => a.name === exp);
      const expectedRole = EXPECTED_AGENT_ROLES.get(exp) ?? '?';
      const scope = found?.scope.length
        ? found.scope.join(' / ')
        : '— (pas encore créé)';
      const present = found?.present ? '✅' : '⏳ (pas encore créé)';
      lines.push(
        `| \`${exp}\` | \`${expectedRole}\` | ${scope} | ${present} |`,
      );
    }
    lines.push('');
    if (snap.agentScanSkipped) {
      lines.push(`> ⚠️  agent scan skipped (\`${snap.agentScanSkipReason}\`)`);
    }
    return lines.join('\n');
  }

  /**
   * Boot log lines (ADR-038) — surface frontmatter parse errors as `level: 'error'`
   * so MarketingModule can fail-fast at boot. Mirror du pattern OperatingMatrixService.formatBootLog().
   *
   * Doit être appelé APRÈS au moins un snapshot() (les parseErrors sont
   * collectées au scan).
   */
  formatBootLog(): Array<{ level: 'log' | 'warn' | 'error'; message: string }> {
    // Force a fresh snapshot to populate lastParseErrors.
    this.snapshot();
    const lines: Array<{
      level: 'log' | 'warn' | 'error';
      message: string;
    }> = [];

    for (const err of this.lastParseErrors) {
      lines.push({
        level: 'error',
        message: `MarketingMatrix: agent frontmatter invalid — ${err.path}: ${err.message}`,
      });
    }

    lines.push({
      level: 'log',
      message: `MarketingMatrix: initialized — ${AGENTS_EXPECTED.length} expected agents, ${this.lastParseErrors.length} parse errors`,
    });

    return lines;
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * ADR-038 : scan = lecture frontmatter via gray-matter + validation Zod fail-fast.
   * Le filename reste convention humaine, mais la source de vérité est `role:` +
   * `business_unit:` du frontmatter.
   *
   * Cross-validation : un agent attendu (ex: `local-business-agent`) doit déclarer
   * son rôle canonique exact (`LOCAL_BUSINESS`). Mismatch → parseError.
   *
   * Erreurs collectées (Zod, YAML, ENOENT non-attendu) sont exposées dans
   * `parseErrors[]` et surfacées par `formatBootLog()` au boot du MarketingModule.
   */
  private scanAgents(): AgentScanResult {
    if (this.skipAgentScan) {
      return {
        agents: [],
        parseErrors: [],
        scannedPaths: [],
        skipped: true,
        skipReason: 'production_default',
      };
    }

    const scannedPaths: string[] = [];
    const parseErrors: MarketingAgentParseError[] = [];
    /** Indexed par filename basename (sans .md). */
    const parsedByName = new Map<
      string,
      { role: MarketingRoleId; scope: ReadonlyArray<MarketingBusinessUnit> }
    >();

    for (const rel of MARKETING_AGENT_PATHS) {
      const abs = path.join(this.repoRoot, rel);
      if (!fs.existsSync(abs)) continue;
      scannedPaths.push(rel);

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(abs, { withFileTypes: true });
      } catch (e) {
        this.logger.warn(`scan failed at ${rel}: ${(e as Error).message}`);
        continue;
      }

      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
        const name = entry.name.replace(/\.md$/, '');
        const filePath = path.join(abs, entry.name);
        const result = this.parseAgentFile(rel, entry.name, filePath, name);
        if (result.error) {
          parseErrors.push(result.error);
          continue;
        }
        if (result.parsed) {
          parsedByName.set(name, result.parsed);
        }
      }
    }

    if (scannedPaths.length === 0) {
      return {
        agents: AGENTS_EXPECTED.map((name) => ({
          name,
          present: false,
          role: null,
          scope: [],
        })),
        parseErrors: [],
        scannedPaths: [],
        skipped: true,
        skipReason: 'no_paths_found',
      };
    }

    const agents: MarketingAgentEntry[] = AGENTS_EXPECTED.map((name) => {
      const parsed = parsedByName.get(name);
      return {
        name,
        present: parsed !== undefined,
        role: parsed?.role ?? null,
        scope: parsed?.scope ?? [],
      };
    });

    return { agents, parseErrors, scannedPaths, skipped: false };
  }

  /**
   * Parse un fichier agent — lit gray-matter, valide Zod, cross-check role
   * contre EXPECTED_AGENT_ROLES. Ne throw jamais ; agrège l'erreur sinon.
   */
  private parseAgentFile(
    rel: string,
    file: string,
    filePath: string,
    name: string,
  ): {
    parsed: {
      role: MarketingRoleId;
      scope: ReadonlyArray<MarketingBusinessUnit>;
    } | null;
    error: MarketingAgentParseError | null;
  } {
    const relPath = path.posix.join(rel, file);

    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // File disappeared between readdir and read — unusual but recoverable.
        return { parsed: null, error: null };
      }
      return {
        parsed: null,
        error: {
          path: relPath,
          file,
          message: `cannot read file: ${err.message}`,
        },
      };
    }

    let data: unknown;
    try {
      data = matter(raw).data;
    } catch (e) {
      return {
        parsed: null,
        error: {
          path: relPath,
          file,
          message: `frontmatter parse error: ${(e as Error).message}`,
        },
      };
    }

    const result = safeParseMarketingAgentFrontmatter(data);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; ');
      return {
        parsed: null,
        error: {
          path: relPath,
          file,
          message: `Zod validation failed — ${issues}`,
        },
      };
    }

    const role = result.data.role as MarketingRoleId;
    const expectedRole = EXPECTED_AGENT_ROLES.get(name);
    if (expectedRole !== undefined && role !== expectedRole) {
      return {
        parsed: null,
        error: {
          path: relPath,
          file,
          message: `role mismatch — frontmatter declares "${role}" but canon (EXPECTED_AGENT_ROLES) requires "${expectedRole}"`,
        },
      };
    }

    return {
      parsed: {
        role,
        scope: result.data
          .business_unit as ReadonlyArray<MarketingBusinessUnit>,
      },
      error: null,
    };
  }

  private hashSourceFiles(): MarketingMatrixSourcesHash {
    // Convention cohérente avec OperatingMatrixService : préfixe `sha256:`.
    const result: Partial<MarketingMatrixSourcesHash> = {};
    for (const [key, rel] of Object.entries(SOURCE_FILES)) {
      const abs = path.join(this.repoRoot, rel);
      if (!fs.existsSync(abs)) {
        // File missing (canon not yet distributed). Hash empty string for stability.
        result[key as keyof MarketingMatrixSourcesHash] =
          'sha256:' + createHash('sha256').update('').digest('hex');
        continue;
      }
      const buf = fs.readFileSync(abs);
      result[key as keyof MarketingMatrixSourcesHash] =
        'sha256:' + createHash('sha256').update(buf).digest('hex');
    }
    return result as MarketingMatrixSourcesHash;
  }
}
