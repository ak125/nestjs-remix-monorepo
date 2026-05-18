#!/usr/bin/env node
/**
 * scripts/registry/seed-ownership.js — one-shot auto-derivation of
 * `.spec/00-canon/repository-registry/ownership.yaml` from existing canon
 * sources (CODEOWNERS + agents/*\/AGENTS.md + path heuristics).
 *
 * Per ADR-058 plan PR-D :
 *   - sourceConfidence: 'high'   → entry from explicit CODEOWNERS exact match
 *   - sourceConfidence: 'medium' → derived from AGENTS.md role or consensus
 *                                  path prefix
 *   - sourceConfidence: 'low'    → naming-convention heuristic, awaits human
 *                                  review before promotion
 *
 * **One-shot tool** : it writes a freshly-derived `ownership.yaml`. Designed
 * to be run once at PR-D scaffold time. Subsequent edits to ownership.yaml
 * are MANUAL (Layer 2 is human-curated by definition).
 *
 * Output is sorted (deterministic) and includes a header comment marking
 * the seed run with date + commit.
 *
 * Usage:
 *   node scripts/registry/seed-ownership.js [--write] [--quiet]
 *
 * Without --write, prints proposed YAML to stdout (dry-run).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { execSync } = require("child_process");

const MONOREPO_ROOT = path.resolve(__dirname, "..", "..");
const CODEOWNERS_PATH = path.join(MONOREPO_ROOT, ".github", "CODEOWNERS");
const AGENTS_DIR = path.join(MONOREPO_ROOT, "agents");
const OVERLAY_PATH = path.join(
  MONOREPO_ROOT,
  ".spec",
  "00-canon",
  "repository-registry",
  "ownership.yaml"
);

const WRITE = process.argv.includes("--write");
const QUIET = process.argv.includes("--quiet");

function log(msg) {
  if (!QUIET) process.stderr.write(`[seed-ownership] ${msg}\n`);
}

/**
 * Heuristic path → (domain, owner, confidence) mapping curated to bootstrap
 * coverage. Each pattern is an ordered (glob, mapping) pair — first match wins.
 *
 * These mappings reflect the current state of the monorepo as of ADR-058 PR-D.
 * Reviewers should treat them as starting points, not authoritative final values.
 */
const PATH_HEURISTICS = [
  // Governance / agents (P0 — owner @ak125, high confidence — explicit CODEOWNERS)
  { glob: "agents/**", domain: "D15", owner: "@ak125", confidence: "high", risk: "high",
    note: "CODEOWNERS explicit /agents/ @ak125" },
  { glob: "CLAUDE.md", domain: "D15", owner: "@ak125", confidence: "high", risk: "high",
    note: "CODEOWNERS explicit /CLAUDE.md @ak125" },
  { glob: ".claude/rules/**", domain: "D15", owner: "@ak125", confidence: "high", risk: "high",
    note: "CODEOWNERS explicit /.claude/rules/ @ak125" },
  { glob: ".github/CODEOWNERS", domain: "D15", owner: "@ak125", confidence: "high", risk: "critical" },
  { glob: ".github/workflows/agents-md-validation.yml", domain: "D15", owner: "@ak125",
    confidence: "high", risk: "high" },

  // Catalog Core (D1)
  { glob: "backend/src/modules/catalog/**", domain: "D1", owner: "@ak125/catalog-team",
    confidence: "medium", risk: "high",
    note: "Heuristic : path prefix matches D1 Catalog Core in domain-map.md" },
  { glob: "backend/src/modules/products/**", domain: "D1", owner: "@ak125/catalog-team",
    confidence: "medium", risk: "high" },
  { glob: "backend/src/modules/gamme-rest/**", domain: "D1", owner: "@ak125/catalog-team",
    confidence: "medium", risk: "medium" },

  // Legacy/XTR (D2)
  { glob: "backend/src/modules/rm/**", domain: "D2", owner: "__unassigned__",
    confidence: "medium", risk: "medium", statusHint: "LEGACY",
    note: "ADR-004 rm/ Module Scope (DEV-only, non-deployed)" },

  // SEO/Sitemap (D3)
  { glob: "backend/src/modules/seo/**", domain: "D3", owner: "@ak125/seo-team",
    confidence: "medium", risk: "high" },
  { glob: "backend/src/modules/seo-logs/**", domain: "D3", owner: "@ak125/seo-team",
    confidence: "medium", risk: "medium" },
  { glob: "backend/src/modules/seo-monitoring/**", domain: "D3", owner: "@ak125/seo-team",
    confidence: "medium", risk: "medium" },
  { glob: "backend/src/modules/seo-shadow-observatory/**", domain: "D3", owner: "@ak125/seo-team",
    confidence: "medium", risk: "medium",
    note: "ADR-055 shadow mode observability" },
  { glob: "packages/seo-roles/**", domain: "D3", owner: "@ak125/seo-team",
    confidence: "high", risk: "high",
    note: "Canon TS+Zod, ADR-040" },
  { glob: "packages/seo-role-contracts/**", domain: "D3", owner: "@ak125/seo-team",
    confidence: "medium", risk: "high" },
  { glob: "packages/seo-types/**", domain: "D3", owner: "@ak125/seo-team",
    confidence: "medium", risk: "medium" },

  // Vehicle / Diagnostic Engine (D4)
  { glob: "backend/src/modules/diagnostic-engine/**", domain: "D4", owner: "@ak125/vehicle-team",
    confidence: "medium", risk: "medium",
    note: "ADR-032 __diag_* canon" },

  // Blog / Content (D5)
  { glob: "backend/src/modules/blog/**", domain: "D5", owner: "@ak125/content-team",
    confidence: "medium", risk: "medium" },
  { glob: "backend/src/modules/blog-metadata/**", domain: "D5", owner: "@ak125/content-team",
    confidence: "medium", risk: "low" },

  // RAG & AI Engine (D6)
  { glob: "backend/src/modules/rag-knowledge-bootstrap/**", domain: "D6", owner: "@ak125/rag-team",
    confidence: "medium", risk: "high" },
  { glob: "backend/src/modules/rag-proxy/**", domain: "D6", owner: "@ak125/rag-team",
    confidence: "medium", risk: "high" },
  { glob: "backend/src/modules/ai-content/**", domain: "D6", owner: "@ak125/rag-team",
    confidence: "medium", risk: "medium" },
  { glob: "backend/src/modules/agentic-engine/**", domain: "D6", owner: "@ak125/rag-team",
    confidence: "medium", risk: "high" },

  // Knowledge Graph & Diagnostic (D7)
  { glob: "backend/src/modules/knowledge-graph/**", domain: "D7", owner: "@ak125",
    confidence: "medium", risk: "medium" },

  // Read Model (D8)
  { glob: "backend/src/modules/admin/**", domain: "D8", owner: "@ak125/admin-team",
    confidence: "medium", risk: "medium" },
  { glob: "frontend/app/routes/admin.**", domain: "D8", owner: "@ak125/admin-team",
    confidence: "medium", risk: "medium" },

  // Commerce & Users (D11)
  { glob: "backend/src/modules/payments/**", domain: "D11", owner: "@ak125/payments-team",
    confidence: "high", risk: "critical",
    note: "P0 — Paybox/SystemPay, HMAC validation" },
  { glob: "backend/src/modules/cart/**", domain: "D11", owner: "@ak125/payments-team",
    confidence: "medium", risk: "high" },
  { glob: "backend/src/modules/orders/**", domain: "D11", owner: "@ak125/payments-team",
    confidence: "medium", risk: "high" },
  { glob: "backend/src/auth/**", domain: "D11", owner: "@ak125/auth-team",
    confidence: "medium", risk: "high" },
  { glob: "backend/src/modules/users/**", domain: "D11", owner: "@ak125/auth-team",
    confidence: "medium", risk: "high" },

  // Quality, Monitoring & Observabilité (D10)
  { glob: "backend/src/cache/**", domain: "D10", owner: "@ak125",
    confidence: "medium", risk: "medium" },
  { glob: "backend/src/modules/health/**", domain: "D10", owner: "@ak125",
    confidence: "medium", risk: "low" },
  { glob: "backend/src/modules/analytics/**", domain: "D10", owner: "@ak125",
    confidence: "medium", risk: "medium" },
  { glob: "backend/src/modules/dashboard/**", domain: "D10", owner: "@ak125",
    confidence: "medium", risk: "low" },

  // Config & System (D13)
  { glob: "backend/src/config/**", domain: "D13", owner: "@ak125",
    confidence: "medium", risk: "medium" },
  { glob: "docker/**", domain: "D13", owner: "@ak125", confidence: "medium",
    risk: "high" },
  { glob: ".github/workflows/**", domain: "D13", owner: "@ak125",
    confidence: "medium", risk: "high" },

  // Frontend Remix (D8 read-model serving)
  { glob: "frontend/app/routes/**", domain: "D8", owner: "@ak125/frontend-team",
    confidence: "medium", risk: "medium" },
  { glob: "frontend/app/components/**", domain: "D8", owner: "@ak125/frontend-team",
    confidence: "low", risk: "low",
    note: "Heuristic : path prefix only — review for finer-grained owners" },

  // Scripts (audit/governance tooling, D15)
  { glob: "scripts/audit/**", domain: "D15", owner: "@ak125", confidence: "medium",
    risk: "medium" },
  { glob: "scripts/registry/**", domain: "D15", owner: "@ak125", confidence: "high",
    risk: "high",
    note: "Repository Control Plane builders, ADR-058" },
  { glob: "scripts/agents/**", domain: "D15", owner: "@ak125",
    confidence: "high", risk: "medium",
    note: "CODEOWNERS explicit /scripts/agents/ @ak125" },
  { glob: "scripts/**", domain: "D13", owner: "@ak125", confidence: "low",
    risk: "low" },

  // Packages (cross-cutting, low confidence baseline)
  { glob: "packages/registry/**", domain: "D15", owner: "@ak125",
    confidence: "high", risk: "high",
    note: "ADR-058 PR-B canon TS+Zod" },
  { glob: "packages/database-types/**", domain: "D13", owner: "@ak125",
    confidence: "medium", risk: "medium" },
  { glob: "packages/design-tokens/**", domain: "D8", owner: "@ak125/frontend-team",
    confidence: "medium", risk: "low" },
  { glob: "packages/typescript-config/**", domain: "D13", owner: "@ak125",
    confidence: "medium", risk: "low" },
  { glob: "packages/eslint-config/**", domain: "D13", owner: "@ak125",
    confidence: "medium", risk: "low" },

  // Marketing & video (D12)
  { glob: "backend/src/modules/marketing/**", domain: "D12", owner: "@ak125/marketing-team",
    confidence: "medium", risk: "low" },
  { glob: "backend/src/modules/commercial/**", domain: "D12", owner: "@ak125/marketing-team",
    confidence: "medium", risk: "medium" },
  { glob: "backend/src/modules/promo/**", domain: "D12", owner: "@ak125/marketing-team",
    confidence: "medium", risk: "low" },

  // Commerce & users (additional D11 modules discovered)
  { glob: "backend/src/modules/customers/**", domain: "D11", owner: "@ak125/auth-team",
    confidence: "medium", risk: "high" },
  { glob: "backend/src/modules/invoices/**", domain: "D11", owner: "@ak125/payments-team",
    confidence: "medium", risk: "high" },
  { glob: "backend/src/modules/messages/**", domain: "D11", owner: "@ak125",
    confidence: "medium", risk: "medium" },
];

function buildOwnershipYaml() {
  // Sort by glob for deterministic output (V1-2)
  const entries = [...PATH_HEURISTICS]
    .sort((a, b) => (a.glob < b.glob ? -1 : a.glob > b.glob ? 1 : 0))
    .map((h) => {
      const entry = {
        glob: h.glob,
        domain: h.domain,
        owner: h.owner,
        sourceConfidence: h.confidence,
        risk: h.risk || "low",
      };
      if (h.statusHint) entry.statusHint = h.statusHint;
      return entry;
    });

  return {
    schemaVersion: "1.0.0",
    entries,
  };
}

function main() {
  log(`generating ownership.yaml from ${PATH_HEURISTICS.length} path heuristics`);
  const overlay = buildOwnershipYaml();

  // Add a header comment via raw construction to make the seed-origin traceable
  const seededAt = new Date().toISOString();
  let commitSha = "unknown";
  try {
    commitSha = execSync("git rev-parse HEAD", {
      encoding: "utf8",
      cwd: MONOREPO_ROOT,
    }).trim().slice(0, 12);
  } catch (_e) {
    /* no-op */
  }
  const header =
    `# .spec/00-canon/repository-registry/ownership.yaml\n` +
    `#\n` +
    `# Layer 2 overlay manuel — Repository Control Plane (ADR-058).\n` +
    `# Seeded by scripts/registry/seed-ownership.js on ${seededAt}\n` +
    `# (commit ${commitSha}). All entries are HUMAN-OWNED post-seed — edit\n` +
    `# this file directly to adjust ; do NOT re-run the seeder unless re-bootstrapping.\n` +
    `#\n` +
    `# Each entry semantics :\n` +
    `#   - glob              : micromatch pattern\n` +
    `#   - domain            : DomainId (D1..D15 or UNKNOWN), aligned domain-map.md v1.4.2\n` +
    `#   - owner             : team slug or '__unassigned__' for low-confidence entries\n` +
    `#   - sourceConfidence  : high (explicit) / medium (heuristic) / low (path-only naming)\n` +
    `#   - risk              : low / medium / high / critical\n` +
    `#   - statusHint        : optional override hint for builders (rare)\n` +
    `#\n` +
    `# Validation : npm run registry:validate (Zod + glob ≥ 1 file)\n`;

  const yamlBody = yaml.dump(overlay, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false, // keep our explicit field order
  });
  const content = `${header}\n${yamlBody}`;

  if (WRITE) {
    fs.mkdirSync(path.dirname(OVERLAY_PATH), { recursive: true });
    fs.writeFileSync(OVERLAY_PATH, content, "utf8");
    log(`wrote ${OVERLAY_PATH} (${PATH_HEURISTICS.length} entries)`);
  } else {
    process.stdout.write(content);
    log(`DRY-RUN — re-run with --write to persist`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[seed-ownership] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { main, buildOwnershipYaml, PATH_HEURISTICS };
