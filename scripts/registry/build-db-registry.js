#!/usr/bin/env node
/**
 * scripts/registry/build-db-registry.js — Layer 1 producer (DbTableEntry[]).
 *
 * Reads `audit/db-usage-map.json` (produced by
 * `scripts/audit/build-db-usage-map.js`) and enriches each table with column
 * metadata parsed from `backend/supabase/migrations/*.sql` (regex on
 * `CREATE TABLE ... (...)` blocks — gracefully degrades for tables created by
 * functions or ad-hoc SQL).
 *
 * Per ADR-058 invariant V1-3 :
 *   - `sourceConfidence: 'high'` when columns + RLS info both available
 *   - `sourceConfidence: 'medium'` when usage map present but columns missing
 *   - `sourceConfidence: 'low'` when only the table name was inferred
 *   - `status: 'LIVE'` if has callsites OR present in migrations ; `'UNKNOWN'`
 *     otherwise (candidate orphan — never force 'LEGACY').
 *
 * Usage:
 *   node scripts/registry/build-db-registry.js [--quiet]
 *
 * Output: audit/registry/db.json
 */
"use strict";

const fs = require("fs");
const path = require("path");
const {
  MONOREPO_ROOT,
  AUDIT_DIR,
  REGISTRY_DIR,
  SCHEMA_VERSION,
  DEFAULT_OWNER,
  DEFAULT_DOMAIN,
  writeDeterministicJson,
  readJsonSafe,
  sortById,
  makeLogger,
} = require("./lib/utils");

const log = makeLogger("db");

const MIGRATIONS_DIR = path.join(
  MONOREPO_ROOT,
  "backend",
  "supabase",
  "migrations"
);

/**
 * Crude regex parse of `CREATE TABLE [IF NOT EXISTS] <schema>.<name> (...)`
 * blocks. Returns columns array (best-effort).
 *
 * Modes :
 *   - `columns.length > 0` : parsed OK (confidence high)
 *   - `columns.length === 0` && `tableMatch` : table exists but columns
 *     unparseable (confidence medium)
 */
function parseCreateTable(sql, tableName) {
  const re = new RegExp(
    `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:[\\w."]+\\.)?["']?${tableName.replace(/[.[\]\\^$*+?(){|}]/g, "\\$&")}["']?\\s*\\(([\\s\\S]*?)\\);`,
    "i"
  );
  const m = sql.match(re);
  if (!m) return { columns: [], parsed: false };

  const body = m[1];
  const columns = [];

  // Split by lines, skip CONSTRAINT / PRIMARY KEY / FOREIGN KEY / INDEX clauses
  const lines = body
    .split(/,(?![^()]*\))/) // split by commas not inside parens
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|INDEX|EXCLUDE|LIKE)\b/i.test(line)) {
      continue;
    }
    const colMatch = line.match(/^["']?(\w+)["']?\s+([\w()\[\]\s]+?)(?:\s+(NOT\s+NULL|NULL))?(?:\s+(DEFAULT\s+.+))?$/i);
    if (colMatch) {
      columns.push({
        name: colMatch[1],
        type: colMatch[2].trim(),
        nullable: !colMatch[3] || /NULL/i.test(colMatch[3]) && !/NOT\s+NULL/i.test(colMatch[3]),
        hasDefault: Boolean(colMatch[4]),
      });
    }
  }

  return { columns, parsed: true };
}

function loadAllMigrationsSql() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return "";
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const buffers = [];
  for (const f of files.sort()) {
    buffers.push(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
  }
  return buffers.join("\n\n");
}

function main() {
  const usageMap = readJsonSafe(path.join(AUDIT_DIR, "db-usage-map.json"));
  if (!usageMap) {
    throw new Error(
      `audit/db-usage-map.json absent. Run \`npm run audit:db-usage\` first.`
    );
  }

  const sql = loadAllMigrationsSql();
  const tables = usageMap.tables || {};
  const entries = [];

  for (const [tableName, info] of Object.entries(tables)) {
    const { columns, parsed } = parseCreateTable(sql, tableName);
    const hasUsage = (info.used_by_count || 0) > 0;
    const hasMigrations = Array.isArray(info.in_migrations) && info.in_migrations.length > 0;

    let sourceConfidence = "low";
    if (parsed && info.rls_present !== undefined) sourceConfidence = "high";
    else if (parsed || hasMigrations) sourceConfidence = "medium";

    const status = hasUsage || hasMigrations ? "LIVE" : "UNKNOWN";

    entries.push({
      schemaVersion: SCHEMA_VERSION,
      id: tableName,
      name: tableName,
      schema: "public",
      domain: DEFAULT_DOMAIN, // PR-D overlay resolves
      status,
      owner: DEFAULT_OWNER,
      sourceConfidence,
      columns: columns.map((c) => ({
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        hasDefault: c.hasDefault,
      })),
      indexes: [], // V1.5 : parse CREATE INDEX
      rlsEnabled: Boolean(info.rls_present),
      usedBy: Array.isArray(info.used_by) ? [...info.used_by].sort() : [],
      inMigrations: Array.isArray(info.in_migrations) ? [...info.in_migrations].sort() : [],
      deletePolicy: tableName.startsWith("__seo_") || tableName.startsWith("__diag_") || tableName.startsWith("kg_")
        ? "ADR_REQUIRED"
        : "FREE",
      risk: "low",
    });
  }

  log(`processed ${entries.length} tables`);

  const output = {
    schemaVersion: SCHEMA_VERSION,
    generatedBy: "scripts/registry/build-db-registry.js",
    entries: sortById(entries),
  };

  const outPath = path.join(REGISTRY_DIR, "db.json");
  const sha = writeDeterministicJson(outPath, output);
  log(`wrote ${outPath} (${entries.length} entries, sha256:${sha.slice(0, 12)})`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`[registry/db] FAILED: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { main, parseCreateTable };
