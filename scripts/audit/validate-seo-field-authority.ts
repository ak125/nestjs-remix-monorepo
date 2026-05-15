/**
 * PR-B — Validate the SEO Field Authority Registry (YAML canon + JSON projection).
 *
 * Two modes :
 *   --lenient (default in PR-B) : warn on missing service references, allow
 *                                 forward declarations (e.g. h1-deterministic-builder
 *                                 doesn't exist until Phase C).
 *   --strict (PR-C+ via CI)     : every `authoritative_writers[].service` must
 *                                 resolve to an existing file under backend/src/.
 *                                 Fails CI if any reference is missing.
 *
 * Always-on checks (both modes) :
 *   - YAML parses cleanly
 *   - schemaVersion matches expected
 *   - Each field has required keys (field_path, roles, physical_columns,
 *     authoritative_writers, denied_writers)
 *   - physical_columns is non-empty, each entry has table + column
 *   - authoritative_writers contains at least one entry, kinds are valid enum
 *   - denied_writers contains at least `llm_generated_direct` (canon enforcement)
 *   - lock_default_duration_days > 0 (either inline or via defaults)
 *   - JSON projection at audit/registry/seo-field-authority.json matches
 *     `build-seo-field-authority.ts --check`
 *
 * Usage:
 *   pnpm tsx scripts/audit/validate-seo-field-authority.ts
 *   pnpm tsx scripts/audit/validate-seo-field-authority.ts --strict
 *
 * Exit codes :
 *   0 — all checks pass (warnings allowed in lenient mode)
 *   1 — hard error (always-on check failed, or strict mode missing service)
 *
 * Plan : §5 Phase B + §15 anti-scope-creep (no runtime NestJS code)
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import * as yaml from 'js-yaml';

const REPO_ROOT = path.resolve(__dirname, '../..');
const YAML_PATH = path.join(
  REPO_ROOT,
  '.spec/00-canon/repository-registry/seo-field-authority.yaml',
);
const BACKEND_SRC = path.join(REPO_ROOT, 'backend/src');
const BUILD_SCRIPT = path.join(__dirname, 'build-seo-field-authority.ts');

const EXPECTED_SCHEMA_VERSION = '1.0.0';
const ALLOWED_WRITER_KINDS = new Set([
  'deterministic_builder',
  'human_curated',
  'human_validated_llm',
  'legacy_recovery',
  'llm_generated_direct',
]);
const REQUIRED_DENIED_KINDS = new Set(['llm_generated_direct']);

// ── Logging ─────────────────────────────────────────────────────────────────

const errors: string[] = [];
const warnings: string[] = [];

function fail(msg: string): void {
  errors.push(msg);
  process.stderr.write(`[FAIL] ${msg}\n`);
}
function warn(msg: string): void {
  warnings.push(msg);
  process.stderr.write(`[WARN] ${msg}\n`);
}
function info(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

// ── Types ───────────────────────────────────────────────────────────────────

interface PhysicalColumn {
  table?: unknown;
  column?: unknown;
  role_filter?: unknown;
}

interface Writer {
  kind?: unknown;
  service?: unknown;
  via?: unknown;
  notes?: unknown;
}

interface FieldEntry {
  field_path?: unknown;
  description?: unknown;
  roles?: unknown;
  physical_columns?: unknown;
  authoritative_writers?: unknown;
  denied_writers?: unknown;
  lock_default_duration_days?: unknown;
  review_cadence_days?: unknown;
}

interface AuthorityDoc {
  schemaVersion?: unknown;
  defaults?: {
    lock_default_duration_days?: unknown;
    review_cadence_days?: unknown;
  };
  fields?: unknown;
}

// ── Service path resolution (NestJS dotted → backend/src/ file path) ──────────
//
// 'backend.modules.seo.builders.h1-deterministic-builder' → looks for
// backend/src/modules/seo/builders/h1-deterministic-builder.{service,}.ts

function resolveServicePath(dotted: string): { exists: boolean; tried: string[] } {
  // Strip leading 'backend.' if present (it's a canonical prefix)
  const stripped = dotted.startsWith('backend.') ? dotted.slice('backend.'.length) : dotted;
  const segments = stripped.split('.');
  const filename = segments.pop()!;
  const dir = path.join(BACKEND_SRC, ...segments);
  const candidates = [
    path.join(dir, `${filename}.service.ts`),
    path.join(dir, `${filename}.ts`),
    path.join(dir, filename, 'index.ts'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return { exists: true, tried: candidates };
  }
  return { exists: false, tried: candidates };
}

// ── Checks ──────────────────────────────────────────────────────────────────

function checkPhysicalColumns(field_path: string, physicalColumns: unknown): void {
  if (!Array.isArray(physicalColumns) || physicalColumns.length === 0) {
    fail(`field "${field_path}" : physical_columns must be a non-empty array`);
    return;
  }
  for (const [i, col] of physicalColumns.entries()) {
    const c = col as PhysicalColumn;
    if (typeof c.table !== 'string' || !c.table) {
      fail(`field "${field_path}".physical_columns[${i}] : table missing/invalid`);
    }
    if (typeof c.column !== 'string' || !c.column) {
      fail(`field "${field_path}".physical_columns[${i}] : column missing/invalid`);
    }
  }
}

function checkAuthoritativeWriters(
  field_path: string,
  writers: unknown,
  strict: boolean,
): void {
  if (!Array.isArray(writers) || writers.length === 0) {
    fail(`field "${field_path}" : authoritative_writers must be non-empty`);
    return;
  }
  for (const [i, w] of writers.entries()) {
    const writer = w as Writer;
    if (typeof writer.kind !== 'string' || !ALLOWED_WRITER_KINDS.has(writer.kind)) {
      fail(
        `field "${field_path}".authoritative_writers[${i}] : kind invalid (got ${JSON.stringify(writer.kind)}, expected one of ${[...ALLOWED_WRITER_KINDS].join(', ')})`,
      );
      continue;
    }
    // A writer must reference either a service or a via origin.
    const hasService = typeof writer.service === 'string' && writer.service.length > 0;
    const hasVia = typeof writer.via === 'string' && writer.via.length > 0;
    if (!hasService && !hasVia) {
      fail(
        `field "${field_path}".authoritative_writers[${i}] (kind=${writer.kind}) : must declare either 'service' or 'via'`,
      );
      continue;
    }
    if (hasService) {
      const resolved = resolveServicePath(writer.service as string);
      if (!resolved.exists) {
        const msg = `field "${field_path}".authoritative_writers[${i}] (kind=${writer.kind}) : service "${String(writer.service)}" not found under backend/src/ (tried ${resolved.tried.map((p) => path.relative(REPO_ROOT, p)).join(', ')})`;
        if (strict) {
          fail(msg);
        } else {
          warn(`${msg} — lenient: PR-B accepts forward declaration, will fail in --strict (PR-C+)`);
        }
      }
    }
  }
}

function checkDeniedWriters(field_path: string, writers: unknown): void {
  if (!Array.isArray(writers) || writers.length === 0) {
    fail(`field "${field_path}" : denied_writers must be non-empty`);
    return;
  }
  const kinds = new Set<string>();
  for (const [i, w] of writers.entries()) {
    const writer = w as Writer;
    if (typeof writer.kind !== 'string' || !ALLOWED_WRITER_KINDS.has(writer.kind)) {
      fail(
        `field "${field_path}".denied_writers[${i}] : kind invalid (got ${JSON.stringify(writer.kind)})`,
      );
      continue;
    }
    kinds.add(writer.kind);
  }
  for (const required of REQUIRED_DENIED_KINDS) {
    if (!kinds.has(required)) {
      fail(
        `field "${field_path}" : denied_writers must include "${required}" (canon enforcement, memory feedback_no_touch_meta_h1_if_optimized)`,
      );
    }
  }
}

function checkLockDuration(
  field_path: string,
  field: FieldEntry,
  doc: AuthorityDoc,
): void {
  const inline = field.lock_default_duration_days;
  const fallback = doc.defaults?.lock_default_duration_days;
  const value = typeof inline === 'number' ? inline : typeof fallback === 'number' ? fallback : null;
  if (value === null) {
    fail(`field "${field_path}" : no lock_default_duration_days (inline or defaults)`);
    return;
  }
  if (value <= 0) {
    fail(`field "${field_path}" : lock_default_duration_days must be > 0 (got ${value})`);
  }
}

function checkField(field: FieldEntry, doc: AuthorityDoc, strict: boolean): void {
  if (typeof field.field_path !== 'string' || !field.field_path) {
    fail(`field entry has no field_path`);
    return;
  }
  const fp = field.field_path;
  if (!Array.isArray(field.roles) || field.roles.length === 0) {
    fail(`field "${fp}" : roles must be a non-empty array`);
  }
  checkPhysicalColumns(fp, field.physical_columns);
  checkAuthoritativeWriters(fp, field.authoritative_writers, strict);
  checkDeniedWriters(fp, field.denied_writers);
  checkLockDuration(fp, field, doc);
}

function checkJsonProjection(): void {
  const result = spawnSync('npx', ['tsx', BUILD_SCRIPT, '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(
      `JSON projection audit/registry/seo-field-authority.json is stale vs YAML canon. ` +
        `Run \`pnpm tsx scripts/audit/build-seo-field-authority.ts\` to regenerate.\n` +
        `--check output:\n${result.stderr || result.stdout}`,
    );
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const mode = strict ? 'strict' : 'lenient';

  info(`▶ Validating SEO Field Authority Registry (mode=${mode})`);

  if (!fs.existsSync(YAML_PATH)) {
    fail(`YAML canon not found at ${path.relative(REPO_ROOT, YAML_PATH)}`);
    process.exit(1);
  }

  let doc: AuthorityDoc;
  try {
    doc = yaml.load(fs.readFileSync(YAML_PATH, 'utf8')) as AuthorityDoc;
  } catch (err) {
    fail(`YAML parse error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (doc.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    fail(
      `schemaVersion mismatch: expected "${EXPECTED_SCHEMA_VERSION}", got ${JSON.stringify(doc.schemaVersion)}`,
    );
  }

  if (!Array.isArray(doc.fields) || doc.fields.length === 0) {
    fail(`doc.fields must be a non-empty array`);
    process.exit(1);
  }

  // Check each field.
  for (const f of doc.fields) {
    checkField(f as FieldEntry, doc, strict);
  }

  // Check JSON projection consistency (drift detection).
  checkJsonProjection();

  // Summary.
  info('');
  if (errors.length === 0) {
    info(`✓ Validation passed (${warnings.length} warnings) in ${mode} mode`);
    process.exit(0);
  }
  process.stderr.write(`✗ Validation failed : ${errors.length} errors, ${warnings.length} warnings\n`);
  process.exit(1);
}

main();
