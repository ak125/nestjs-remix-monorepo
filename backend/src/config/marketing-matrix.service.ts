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
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  MarketingAgentEntry,
  MarketingBusinessUnit,
  MarketingChannel,
  MarketingConversionGoal,
  MarketingGateLevel,
  MarketingInvariant,
  MarketingInvariantKey,
  MarketingMatrix,
  MarketingMatrixSourcesHash,
} from './marketing-matrix.types';

/** Path scanné pour les agents marketing (workspace dédié, pas seo-batch). */
const MARKETING_AGENT_PATHS = ['workspaces/marketing/.claude/agents'] as const;

/** Hash file = canon distribué localement (pas filesystem vault qui est read-only sur PROD/AI-COS). */
const SOURCE_FILES: Record<keyof MarketingMatrixSourcesHash, string> = {
  matrixTypes: 'backend/src/config/marketing-matrix.types.ts',
  marketingVoiceCanon: '.claude/rules/marketing-voice.md',
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
 * Agents Phase 1-2 attendus selon ADR-036.
 * Ils peuvent ne pas exister encore au filesystem (Phase 1.5 PR-1.5 les crée).
 */
const AGENTS_EXPECTED: ReadonlyArray<string> = [
  'customer-retention-agent',
  'local-business-agent',
  'marketing-lead-agent',
];

/**
 * Scope autorisé par agent (ADR-036 §"Verdict & approche retenue").
 * Sert au DTO Zod runtime + au snapshot.
 */
const AGENT_SCOPES: Record<string, ReadonlyArray<MarketingBusinessUnit>> = {
  'customer-retention-agent': [
    MarketingBusinessUnit.ECOMMERCE,
    MarketingBusinessUnit.HYBRID,
  ],
  'local-business-agent': [MarketingBusinessUnit.LOCAL],
  'marketing-lead-agent': [
    MarketingBusinessUnit.ECOMMERCE,
    MarketingBusinessUnit.LOCAL,
  ],
};

interface AgentScanResult {
  agents: MarketingAgentEntry[];
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
    lines.push('| Agent | Scope | Présent ? |');
    lines.push('|---|---|---|');
    for (const exp of snap.agentsExpected) {
      const found = snap.agents.find((a) => a.name === exp);
      const scope = (AGENT_SCOPES[exp] || []).join(' / ');
      const present = found?.present ? '✅' : '⏳ (pas encore créé)';
      lines.push(`| \`${exp}\` | ${scope} | ${present} |`);
    }
    lines.push('');
    if (snap.agentScanSkipped) {
      lines.push(`> ⚠️  agent scan skipped (\`${snap.agentScanSkipReason}\`)`);
    }
    return lines.join('\n');
  }

  // ── Private helpers ──────────────────────────────────────────────

  private scanAgents(): AgentScanResult {
    if (this.skipAgentScan) {
      return {
        agents: [],
        scannedPaths: [],
        skipped: true,
        skipReason: 'production_default',
      };
    }

    const scannedPaths: string[] = [];
    const found = new Map<string, boolean>();

    for (const expected of AGENTS_EXPECTED) {
      found.set(expected, false);
    }

    for (const rel of MARKETING_AGENT_PATHS) {
      const abs = path.join(this.repoRoot, rel);
      if (!fs.existsSync(abs)) continue;
      scannedPaths.push(rel);
      try {
        const entries = fs.readdirSync(abs, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
          const name = entry.name.replace(/\.md$/, '');
          if (found.has(name)) {
            found.set(name, true);
          }
        }
      } catch (e) {
        this.logger.warn(`scan failed at ${rel}: ${(e as Error).message}`);
      }
    }

    if (scannedPaths.length === 0) {
      return {
        agents: AGENTS_EXPECTED.map((name) => ({
          name,
          present: false,
          scope: AGENT_SCOPES[name] || [],
        })),
        scannedPaths: [],
        skipped: true,
        skipReason: 'no_paths_found',
      };
    }

    const agents: MarketingAgentEntry[] = AGENTS_EXPECTED.map((name) => ({
      name,
      present: found.get(name) === true,
      scope: AGENT_SCOPES[name] || [],
    }));

    return { agents, scannedPaths, skipped: false };
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
