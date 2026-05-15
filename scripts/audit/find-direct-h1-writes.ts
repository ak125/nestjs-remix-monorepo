/**
 * PR-C — Scanner anti-bypass H1 writes
 *
 * Detects any direct write to the 4 canonical H1 columns that does NOT go
 * through `SeoContentWriteService.preflightH1(...)`. Closes the gap left by
 * a "gateway exists but legacy paths survive" scenario.
 *
 * Detection rule (in scope) :
 *   For every .ts / .js / .sql file under backend/, scripts/, frontend/ :
 *     If file contains a write to one of the canonical column names :
 *       - `mta_h1`, `sg_h1`, `r1s_h1_override`, `sgpg_h1_override`
 *     A "write" is :
 *       - property assignment in an object literal (`column: value`)
 *       - SQL `UPDATE ... SET column = ...` or `INSERT INTO ... (column ...)`
 *     Then :
 *       - If file is in EXPLICIT whitelist → OK
 *       - Else if file imports SeoContentWriteService AND calls
 *         `.preflightH1(` → OK (gateway-preflighted)
 *       - Else → VIOLATION
 *
 * Modes :
 *   --lenient (default) : warn per finding, exit 0
 *   --strict            : exit 1 on any violation (CI gate)
 *
 * Output : audit-reports/h1-write-paths/<date>/findings.json
 *
 * Memory : feedback_single_write_path_needs_bypass_scanner
 * Plan   : §6 Phase C step 6
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Configuration ───────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '../..');

/** Canonical H1 column names per seo-field-authority.yaml (PR-B). */
const CANONICAL_H1_COLUMNS = [
  'mta_h1',
  'sg_h1',
  'r1s_h1_override',
  'sgpg_h1_override',
] as const;

/** Files allowed to reference H1 columns even without gateway preflight. */
const EXPLICIT_WHITELIST = new Set([
  // The gateway itself
  'backend/src/modules/seo/governance/seo-content-write.service.ts',
  'backend/src/modules/seo/governance/opa-policy-engine.service.ts',
  'backend/src/modules/seo/governance/seo-governance.module.ts',
  // Low-level data abstractions (typed but column-agnostic — takes Record<string, any>)
  'backend/src/database/services/meta-tags-ariane-data.service.ts',
  // PR-A1 forensic engine (READ-only — reads column to compute hash, never writes)
  'scripts/seo/forensic/h1-audit.ts',
  'scripts/seo/forensic/h1-recovery-audit.ts',
  // PR-A2 persistence (writes audit table, reads canonical column names but never writes them)
  'scripts/seo/forensic/h1-persist.ts',
  // PR-C scanner itself (this file)
  'scripts/audit/find-direct-h1-writes.ts',
  // PR-C config builder (centralised h1 template strings, no DB writes)
  'backend/src/modules/seo/builders/h1-deterministic-builder.service.ts',
]);

/** Glob-like directory roots to scan. */
const SCAN_ROOTS = ['backend/src', 'scripts'] as const;

/** File extensions to consider. */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.sql'] as const;

/** Paths to skip entirely (no value in scanning). */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '__tests__',
  'tests',
  'test',
]);

/** Whitelist for migration files : they create/seed canonical columns
 *  but are by definition the canonical DDL — not a runtime bypass. */
const MIGRATION_DIR = 'backend/supabase/migrations';

// ── Logging ─────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

// ── Detection ───────────────────────────────────────────────────────────────

interface Finding {
  file: string;
  line: number;
  column: string;
  match: string;
  excerpt: string;
  reason: 'object_property_write' | 'sql_update' | 'sql_insert';
}

const PATTERNS = {
  // Property assignment in object literal : `mta_h1: value` (whitespace tolerant).
  objectProperty: (col: string) =>
    new RegExp(`\\b${col}\\s*:`, 'g'),
  // Property assignment via member access : `obj.mta_h1 = value` (variable
  // mutation pattern that often feeds an upsert call downstream).
  memberAssignment: (col: string) =>
    new RegExp(`\\.${col}\\s*=(?!=)`, 'g'),
  // SQL UPDATE ... SET column = ...
  sqlUpdateSet: (col: string) =>
    new RegExp(`UPDATE\\s+[\\w."]+\\s+SET[^;]*\\b${col}\\s*=`, 'is'),
  // SQL INSERT INTO ... (... column ...)
  sqlInsertColumn: (col: string) =>
    new RegExp(`INSERT\\s+INTO\\s+[\\w."]+\\s*\\([^)]*\\b${col}\\b[^)]*\\)`, 'is'),
};

function stripComments(source: string): string {
  // Replace comment characters with spaces (preserve newlines) so line
  // numbers in `lines[i]` and `linesStripped[i]` stay aligned.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) =>
      match.replace(/[^\n]/g, ' '),
    )
    .replace(/\/\/[^\n]*/g, (match) => match.replace(/./g, ' '));
}

/** Returns true if line `i` is inside a `.update()` / `.upsert()` / `.insert()`
 *  call context. Looks backwards up to MAX_LOOKBACK lines for an opening
 *  paren of one of those calls, counting paren depth to confirm we're inside.
 */
function isInsideWriteCall(linesStripped: string[], i: number): boolean {
  const MAX_LOOKBACK = 40;
  const writeCallRe = /\.(?:update|upsert|upsertWithoutReturn|insert)\s*\(/;
  let depth = 0;
  for (let j = i; j >= Math.max(0, i - MAX_LOOKBACK); j--) {
    const line = linesStripped[j] ?? '';
    // Count parens on this line (cheap heuristic, ignores string content).
    for (const ch of line) {
      if (ch === ')') depth++;
      else if (ch === '(') depth--;
    }
    if (writeCallRe.test(line) && depth <= 0) {
      return true;
    }
  }
  return false;
}

function scanFile(absPath: string, rel: string): Finding[] {
  const findings: Finding[] = [];
  const raw = fs.readFileSync(absPath, 'utf8');
  const stripped = stripComments(raw);
  const lines = raw.split('\n');
  const isSql = absPath.endsWith('.sql');

  for (const col of CANONICAL_H1_COLUMNS) {
    if (isSql) {
      if (PATTERNS.sqlUpdateSet(col).test(stripped)) {
        findings.push({
          file: rel,
          line: 1,
          column: col,
          match: `UPDATE ... SET ${col} = ...`,
          excerpt: lines[0] ?? '',
          reason: 'sql_update',
        });
      }
      if (PATTERNS.sqlInsertColumn(col).test(stripped)) {
        findings.push({
          file: rel,
          line: 1,
          column: col,
          match: `INSERT INTO ... (${col}, ...)`,
          excerpt: lines[0] ?? '',
          reason: 'sql_insert',
        });
      }
      continue;
    }

    // For non-SQL files, scan property-style writes line by line AND require
    // the property to be inside a write-call context (.update/.upsert/.insert)
    // OR a `.<col> =` member assignment (variable mutation).
    const linesStripped = stripped.split('\n');
    for (let i = 0; i < linesStripped.length; i++) {
      const line = linesStripped[i];
      const rawLine = lines[i] ?? '';
      // Skip type/interface declarations (column: TypeName, not a write).
      if (/\b(interface|type)\b/.test(line)) continue;
      // Skip explicit destructuring / SELECT-like .select('mta_h1, ...').
      if (/\.select\s*\(/.test(line)) continue;

      // Object-literal property writes (only inside .update/.upsert/.insert(...)).
      const reObject = PATTERNS.objectProperty(col);
      if (reObject.test(line) && isInsideWriteCall(linesStripped, i)) {
        findings.push({
          file: rel,
          line: i + 1,
          column: col,
          match: `${col}:`,
          excerpt: rawLine.trim().slice(0, 160),
          reason: 'object_property_write',
        });
        continue;
      }

      // Member-style assignments (`dbData.mta_h1 = value`).
      const reMember = PATTERNS.memberAssignment(col);
      if (reMember.test(line)) {
        findings.push({
          file: rel,
          line: i + 1,
          column: col,
          match: `.${col} =`,
          excerpt: rawLine.trim().slice(0, 160),
          reason: 'object_property_write',
        });
      }
    }
  }

  return findings;
}

function hasGatewayPreflight(absPath: string): boolean {
  if (!fs.existsSync(absPath)) return false;
  const src = fs.readFileSync(absPath, 'utf8');
  const stripped = stripComments(src);
  return (
    /\bSeoContentWriteService\b/.test(stripped) &&
    /\.preflightH1\s*\(/.test(stripped)
  );
}

function isWhitelisted(rel: string): { whitelisted: boolean; reason?: string } {
  if (EXPLICIT_WHITELIST.has(rel)) {
    return { whitelisted: true, reason: 'explicit_whitelist' };
  }
  if (rel.startsWith(MIGRATION_DIR + '/')) {
    return { whitelisted: true, reason: 'migration_file' };
  }
  // Auto-generated database type definitions — `interface` / `type` only.
  if (rel.endsWith('.types.ts') || rel.endsWith('.d.ts')) {
    return { whitelisted: true, reason: 'type_definitions' };
  }
  if (
    rel.endsWith('.spec.ts') ||
    rel.endsWith('.test.ts') ||
    rel.endsWith('.spec.tsx') ||
    rel.endsWith('.test.tsx') ||
    rel.includes('/__tests__/') ||
    rel.includes('/test/fixtures/')
  ) {
    return { whitelisted: true, reason: 'test_file' };
  }
  return { whitelisted: false };
}

function walk(root: string, abs: string, files: string[]): void {
  if (!fs.existsSync(abs)) return;
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    if (EXTENSIONS.some((ext) => abs.endsWith(ext))) {
      files.push(abs);
    }
    return;
  }
  if (!stat.isDirectory()) return;
  const base = path.basename(abs);
  if (SKIP_DIRS.has(base)) return;
  for (const entry of fs.readdirSync(abs)) {
    walk(root, path.join(abs, entry), files);
  }
}

// ── Reporting ───────────────────────────────────────────────────────────────

interface ReportSummary {
  generated_at: string;
  mode: 'lenient' | 'strict';
  total_files_scanned: number;
  total_findings: number;
  violations: Finding[]; // findings not whitelisted nor gateway-preflighted
  accepted_findings: Array<Finding & { acceptance_reason: string }>;
}

function writeReport(outputDir: string, summary: ReportSummary): void {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'findings.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  log(`✓ Wrote ${path.relative(REPO_ROOT, jsonPath)}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const argv = process.argv.slice(2);
  const mode: 'lenient' | 'strict' = argv.includes('--strict') ? 'strict' : 'lenient';
  const help = argv.includes('--help') || argv.includes('-h');

  if (help) {
    process.stdout.write(`PR-C anti-bypass scanner for H1 writes

Usage:
  pnpm tsx scripts/audit/find-direct-h1-writes.ts [--lenient|--strict]

Output : audit-reports/h1-write-paths/<YYYY-MM-DD>/findings.json

Detects direct writes to the 4 canonical H1 columns
(${CANONICAL_H1_COLUMNS.join(', ')}) that bypass SeoContentWriteService.preflightH1(...).

Whitelist :
  - The gateway service itself
  - The data service abstraction (Record<string, any> input)
  - Test files, __tests__, fixtures
  - Migration files (DDL canon)
  - Files that import SeoContentWriteService AND call .preflightH1(

Exit codes :
  0 (lenient) — always
  0 (strict)  — no violations
  1 (strict)  — at least one violation
`);
    process.exit(0);
  }

  log(`▶ Scanning H1 write paths (mode=${mode})`);

  const files: string[] = [];
  for (const root of SCAN_ROOTS) {
    walk(REPO_ROOT, path.join(REPO_ROOT, root), files);
  }
  log(`  ${files.length} files scanned`);

  const allFindings: Finding[] = [];
  for (const abs of files) {
    const rel = path.relative(REPO_ROOT, abs);
    const findings = scanFile(abs, rel);
    allFindings.push(...findings);
  }

  // Classify findings.
  const violations: Finding[] = [];
  const accepted: Array<Finding & { acceptance_reason: string }> = [];
  for (const f of allFindings) {
    const wl = isWhitelisted(f.file);
    if (wl.whitelisted) {
      accepted.push({ ...f, acceptance_reason: wl.reason ?? 'whitelist' });
      continue;
    }
    const abs = path.join(REPO_ROOT, f.file);
    if (hasGatewayPreflight(abs)) {
      accepted.push({ ...f, acceptance_reason: 'gateway_preflighted' });
      continue;
    }
    violations.push(f);
  }

  const today = new Date().toISOString().slice(0, 10);
  const outputDir = path.join(REPO_ROOT, 'audit-reports', 'h1-write-paths', today);
  const summary: ReportSummary = {
    generated_at: new Date().toISOString(),
    mode,
    total_files_scanned: files.length,
    total_findings: allFindings.length,
    violations,
    accepted_findings: accepted,
  };
  writeReport(outputDir, summary);

  log('');
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  log(`Total findings : ${allFindings.length}`);
  log(`Accepted       : ${accepted.length}`);
  log(`Violations     : ${violations.length}`);
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (violations.length > 0) {
    log('');
    log('Violations :');
    for (const v of violations.slice(0, 30)) {
      log(`  ${v.file}:${v.line} — ${v.column} (${v.reason})`);
      log(`    ${v.excerpt}`);
    }
    if (violations.length > 30) {
      log(`  … and ${violations.length - 30} more (see findings.json)`);
    }
  }

  if (mode === 'strict' && violations.length > 0) {
    log('');
    process.stderr.write(
      `✗ ${violations.length} violation(s) — strict mode fails CI.\n` +
        `  Either refactor the callsite to call SeoContentWriteService.preflightH1(...) first,\n` +
        `  or add the file to EXPLICIT_WHITELIST with justification.\n`,
    );
    process.exit(1);
  }
}

main();
