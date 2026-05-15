/**
 * PR-B — Generate `audit/registry/seo-field-authority.json` from the YAML canon.
 *
 * Deterministic projection : sorted keys, stable formatting, idempotent.
 * The YAML in `.spec/00-canon/repository-registry/seo-field-authority.yaml`
 * is the Source of Truth. The JSON output is a machine-readable projection
 * for consumers (OPA bundle WASM, dashboards, audit queries).
 *
 * Usage:
 *   pnpm tsx scripts/audit/build-seo-field-authority.ts
 *   pnpm tsx scripts/audit/build-seo-field-authority.ts --check  # exit 1 if drift
 *
 * Plan : §5 Phase B Field Authority Registry
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const REPO_ROOT = path.resolve(__dirname, '../..');
const YAML_PATH = path.join(
  REPO_ROOT,
  '.spec/00-canon/repository-registry/seo-field-authority.yaml',
);
const JSON_PATH = path.join(REPO_ROOT, 'audit/registry/seo-field-authority.json');

// ── Logging (diagnostic → stderr) ───────────────────────────────────────────

function log(msg: string): void {
  process.stderr.write(msg + '\n');
}

// ── Types (mirror the YAML schema, kept loose so the validator owns enforcement) ──

interface PhysicalColumn {
  table: string;
  column: string;
  role_filter?: string;
}

interface Writer {
  kind: string;
  service?: string;
  via?: string;
  notes?: string;
}

interface FieldEntry {
  field_path: string;
  description?: string;
  roles: string[];
  physical_columns: PhysicalColumn[];
  authoritative_writers: Writer[];
  denied_writers: Writer[];
  lock_default_duration_days?: number;
  review_cadence_days?: number;
}

interface AuthorityDoc {
  schemaVersion: string;
  defaults?: {
    lock_default_duration_days?: number;
    review_cadence_days?: number;
  };
  fields: FieldEntry[];
}

// ── Deterministic stringify (sorted keys, 2-space indent, trailing newline) ──

function deterministicStringify(obj: unknown): string {
  const sorted = sortObjectKeys(obj);
  return JSON.stringify(sorted, null, 2) + '\n';
}

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortObjectKeys);
  if (obj === null || typeof obj !== 'object') return obj;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[k] = sortObjectKeys((obj as Record<string, unknown>)[k]);
  }
  return sorted;
}

// ── Build pipeline ──────────────────────────────────────────────────────────

function buildJson(): { content: string; doc: AuthorityDoc } {
  if (!fs.existsSync(YAML_PATH)) {
    throw new Error(`YAML canon not found at ${YAML_PATH}`);
  }
  const raw = fs.readFileSync(YAML_PATH, 'utf8');
  const doc = yaml.load(raw) as AuthorityDoc;

  // Enrich with generation metadata. The metadata block is at the top of the
  // JSON so consumers can detect staleness ; deterministic_hash captures only
  // the meaningful YAML content (computed elsewhere by the validator's diff).
  const enriched = {
    $generated: {
      from: '.spec/00-canon/repository-registry/seo-field-authority.yaml',
      by: 'scripts/audit/build-seo-field-authority.ts',
      schemaVersion: doc.schemaVersion,
      note: 'DO NOT EDIT BY HAND. Regenerate via `pnpm tsx scripts/audit/build-seo-field-authority.ts`.',
    },
    ...doc,
  };

  return { content: deterministicStringify(enriched), doc };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function main(): void {
  const argv = process.argv.slice(2);
  const checkMode = argv.includes('--check');

  log(`▶ Reading YAML canon : ${path.relative(REPO_ROOT, YAML_PATH)}`);
  const { content, doc } = buildJson();
  log(`  schemaVersion=${doc.schemaVersion}`);
  log(`  fields=${doc.fields.length} (${doc.fields.map((f) => f.field_path).join(', ')})`);

  fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
  const relJson = path.relative(REPO_ROOT, JSON_PATH);

  if (checkMode) {
    if (!fs.existsSync(JSON_PATH)) {
      process.stderr.write(`[FAIL] ${relJson} does not exist — run without --check to regenerate.\n`);
      process.exit(1);
    }
    const existing = fs.readFileSync(JSON_PATH, 'utf8');
    if (existing !== content) {
      process.stderr.write(`[FAIL] ${relJson} is stale vs YAML canon — regenerate.\n`);
      process.exit(1);
    }
    log(`✓ ${relJson} matches YAML canon`);
    process.exit(0);
  }

  fs.writeFileSync(JSON_PATH, content, 'utf8');
  log(`✓ Wrote ${relJson}`);
}

try {
  main();
} catch (err: unknown) {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[FATAL] ${msg}\n`);
  process.exit(1);
}
