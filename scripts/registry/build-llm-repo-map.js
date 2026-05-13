#!/usr/bin/env node
/**
 * scripts/registry/build-llm-repo-map.js — Layer 3 → LLM entrypoint.
 *
 * Reads `audit/registry/canonical.json` (PR-E projection) and generates
 * `.claude/knowledge/REPO_MAP.md` — a humain-readable index used by Claude
 * Code agents to answer « qui possède X » without grep.
 *
 * Per ADR-058 §PR-F :
 *   - Generated file, do_not_edit: true
 *   - Extends existing `.claude/knowledge/` (no namespace parallèle)
 *   - Idempotent across 2 runs (only header date changes if regen forced)
 *   - Sourced from canonical.json (couple Layer 1 auto + Layer 2 overlay)
 *
 * Structure of REPO_MAP.md :
 *   - Frontmatter YAML (title, kind=registry-index, source, source_sha256,
 *     schema_version, do_not_edit)
 *   - Section per domain D1..D15 (skip empty domains)
 *   - Per domain : owners, file counts by kind, table counts, RPC counts,
 *     links to .claude/knowledge/modules/*.md when matching
 *
 * Usage:
 *   node scripts/registry/build-llm-repo-map.js [--quiet]
 *
 * Output: .claude/knowledge/REPO_MAP.md
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  MONOREPO_ROOT,
  REGISTRY_DIR,
  readJsonSafe,
  makeLogger,
} = require("./lib/utils");

const log = makeLogger("llm-repo-map");

const CANONICAL_PATH = path.join(REGISTRY_DIR, "canonical.json");
const OUT_PATH = path.join(MONOREPO_ROOT, ".claude", "knowledge", "REPO_MAP.md");
const KNOWLEDGE_MODULES_DIR = path.join(
  MONOREPO_ROOT,
  ".claude",
  "knowledge",
  "modules"
);

// Human-readable names per domain (mirror .spec/00-canon/repository-registry/domains.yaml)
const DOMAIN_NAMES = {
  D1: "Catalog Core",
  D2: "Legacy / XTR Migration",
  D3: "SEO & Sitemap",
  D4: "Vehicle / Compatibility",
  D5: "Blog / Content",
  D6: "RAG & AI Engine",
  D7: "Knowledge Graph & Diagnostic",
  D8: "Read Model / Serving (RM)",
  D9: "Import / ETL / Normalisation",
  D10: "Quality, Monitoring & Observabilité",
  D11: "Commerce & Users",
  D12: "Marketing & Video",
  D13: "Config & System",
  D14: "Gamme Aggregates & V-Level",
  D15: "Security & Governance",
  UNKNOWN: "Unknown (overlay non résolu)",
};

const DOMAIN_ORDER = [
  "D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8",
  "D9", "D10", "D11", "D12", "D13", "D14", "D15", "UNKNOWN",
];

function listKnowledgeModules() {
  if (!fs.existsSync(KNOWLEDGE_MODULES_DIR)) return new Set();
  const set = new Set();
  for (const f of fs.readdirSync(KNOWLEDGE_MODULES_DIR)) {
    if (f.endsWith(".md")) set.add(f.replace(/\.md$/, ""));
  }
  return set;
}

function groupByDomain(canonical) {
  const groups = {};
  for (const id of DOMAIN_ORDER) {
    groups[id] = { files: [], tables: [], rpc: [], runtime: [] };
  }
  for (const f of canonical.files) {
    if (!groups[f.domain]) groups[f.domain] = { files: [], tables: [], rpc: [], runtime: [] };
    groups[f.domain].files.push(f);
  }
  for (const t of canonical.db.tables) {
    const d = t.domain || "UNKNOWN";
    if (!groups[d]) groups[d] = { files: [], tables: [], rpc: [], runtime: [] };
    groups[d].tables.push(t);
  }
  for (const r of canonical.db.rpc) {
    const d = r.domain || "UNKNOWN";
    if (!groups[d]) groups[d] = { files: [], tables: [], rpc: [], runtime: [] };
    groups[d].rpc.push(r);
  }
  for (const r of canonical.runtime) {
    const f = canonical.files.find((x) => x.path === r.path);
    const d = (f && f.domain) || "UNKNOWN";
    if (!groups[d]) groups[d] = { files: [], tables: [], rpc: [], runtime: [] };
    groups[d].runtime.push(r);
  }
  return groups;
}

function topOwners(entries, n = 3) {
  const counts = new Map();
  for (const e of entries) {
    counts.set(e.owner, (counts.get(e.owner) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, n).map(([owner, c]) => `${owner} (${c})`);
}

function kindBreakdown(files) {
  const counts = new Map();
  for (const f of files) counts.set(f.kind, (counts.get(f.kind) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, c]) => `${k}=${c}`)
    .join(", ");
}

function knowledgeLinkForDomain(domainId, files, knownModules) {
  // Heuristic: find a module .md whose name appears in some file path under this domain
  const moduleHits = new Set();
  for (const f of files) {
    const parts = f.path.split("/");
    // Look at modules/* segment
    const idx = parts.indexOf("modules");
    if (idx >= 0 && parts[idx + 1]) {
      const name = parts[idx + 1].replace(/\.[^.]+$/, "");
      if (knownModules.has(name)) moduleHits.add(name);
    }
  }
  if (moduleHits.size === 0) return "";
  const sorted = [...moduleHits].sort();
  return sorted
    .map((m) => `[\`${m}\`](modules/${m}.md)`)
    .join(", ");
}

function renderDomainSection(domainId, group, knownModules) {
  const name = DOMAIN_NAMES[domainId] || domainId;
  const fileCount = group.files.length;
  const tableCount = group.tables.length;
  const rpcCount = group.rpc.length;
  const runtimeCount = group.runtime.length;
  const total = fileCount + tableCount + rpcCount;
  if (total === 0 && runtimeCount === 0) return ""; // skip empty domains

  const owners = topOwners(group.files);
  const kinds = kindBreakdown(group.files);
  const knowledgeLinks = knowledgeLinkForDomain(
    domainId,
    group.files,
    knownModules
  );

  let section = `### ${domainId} — ${name}\n\n`;
  section += `- **Files**: ${fileCount}`;
  if (kinds) section += ` (${kinds})`;
  section += "\n";
  if (tableCount > 0) section += `- **DB tables**: ${tableCount}\n`;
  if (rpcCount > 0) section += `- **DB RPC**: ${rpcCount}\n`;
  if (runtimeCount > 0) section += `- **Runtime entrypoints**: ${runtimeCount}\n`;
  if (owners.length > 0) {
    section += `- **Top owners**: ${owners.join(", ")}\n`;
  }
  if (knowledgeLinks) {
    section += `- **Knowledge prose**: ${knowledgeLinks}\n`;
  }
  // Status breakdown (transparency on UNKNOWN coverage)
  const statusCounts = new Map();
  for (const f of group.files) {
    statusCounts.set(f.status, (statusCounts.get(f.status) || 0) + 1);
  }
  const statusLine = [...statusCounts.entries()]
    .sort()
    .map(([s, c]) => `${s}=${c}`)
    .join(", ");
  if (statusLine) section += `- **Status**: ${statusLine}\n`;

  return section + "\n";
}

function renderRepoMap(canonical, sourceSha) {
  const knownModules = listKnowledgeModules();
  const groups = groupByDomain(canonical);

  const totalFiles = canonical.files.length;
  const totalTables = canonical.db.tables.length;
  const totalRpc = canonical.db.rpc.length;
  const totalDeps = canonical.deps.length;
  const totalRuntime = canonical.runtime.length;

  // Frontmatter (PR-D plan §PR-F spec)
  const frontmatter =
    `---\n` +
    `title: Repository Map\n` +
    `kind: registry-index\n` +
    `generated_at: "1970-01-01T00:00:00.000Z"\n` + // V1-2 deterministic placeholder
    `source: audit/registry/canonical.json\n` +
    `source_sha256: ${sourceSha}\n` +
    `schema_version: "1.0.0"\n` +
    `do_not_edit: true   # généré par scripts/registry/build-llm-repo-map.js (ADR-058 PR-F)\n` +
    `---\n\n`;

  let body = `# Repository Map\n\n`;
  body +=
    `> **LLM entrypoint** (ADR-058) : pour répondre à toute question « qui ` +
    `possède X » / « quel domaine » / « où vit Y », **lire ce fichier d'abord** ` +
    `puis fall-back grep si non couvert.\n\n`;
  body +=
    `> **Source de vérité** = couple Layer 1 auto + Layer 2 overlay manuel. ` +
    `Ce fichier est une **projection canonique générée** depuis ` +
    `\`audit/registry/canonical.json\` — JAMAIS l'éditer à la main.\n\n`;
  body += `## Statistiques globales\n\n`;
  body += `| Layer | Count |\n|---|---|\n`;
  body += `| Files (Layer 1) | ${totalFiles} |\n`;
  body += `| DB tables (Layer 1) | ${totalTables} |\n`;
  body += `| DB RPC (Layer 1) | ${totalRpc} |\n`;
  body += `| Dependencies (Layer 1) | ${totalDeps} |\n`;
  body += `| Runtime entrypoints (Layer 1) | ${totalRuntime} |\n`;
  body += `\nSource sotFingerprint: \`${canonical.meta.sotFingerprint}\`.\n\n`;
  body += `## Comment l'utiliser\n\n`;
  body += `1. Identifier le **domaine** D1..D15 (voir ci-dessous)\n`;
  body += `2. Lire \`audit/registry/canonical.json\` pour la query précise (programmatique)\n`;
  body += `3. Lire \`.claude/knowledge/modules/<module>.md\` pour la prose détaillée\n`;
  body += `4. Fall-back grep si question hors registry\n\n`;
  body += `## Domaines (D1..D15 + UNKNOWN)\n\n`;

  for (const domainId of DOMAIN_ORDER) {
    const group = groups[domainId] || { files: [], tables: [], rpc: [], runtime: [] };
    body += renderDomainSection(domainId, group, knownModules);
  }

  body += `## Voir aussi\n\n`;
  body += `- [README.md](README.md) — index navigation knowledge\n`;
  body += `- [\`audit/registry/canonical.json\`](../../audit/registry/canonical.json) — SoT machine-readable\n`;
  body += `- [\`.spec/00-canon/repository-registry/\`](../../.spec/00-canon/repository-registry/) — Layer 2 overlay manuel\n`;
  body += `- ADR-058 (vault) — Repository Control Plane V1\n`;

  return frontmatter + body;
}

function sha256OfFile(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function main() {
  const canonical = readJsonSafe(CANONICAL_PATH);
  if (!canonical) {
    throw new Error(
      `${CANONICAL_PATH} absent. Run \`npm run registry\` first.`
    );
  }
  const sourceSha = sha256OfFile(CANONICAL_PATH);
  log(
    `loading canonical (${canonical.files.length} files, sotFp ${canonical.meta.sotFingerprint})`
  );

  const content = renderRepoMap(canonical, sourceSha);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, content, "utf8");

  const sha = crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
  log(`wrote ${OUT_PATH} (${content.length} bytes, sha256:${sha})`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[registry/llm-repo-map] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { main, renderRepoMap, groupByDomain };
