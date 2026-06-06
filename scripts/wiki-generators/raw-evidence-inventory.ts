/**
 * raw-evidence-inventory.ts — READ-ONLY, DETERMINISTIC RAW evidence inventory.
 *
 * Answers « le RAW a-t-il le droit de devenir un wiki/une page ? » for a gamme
 * subject, by measuring per-block coverage (v4 canon A–E + 5.0 superset) and
 * provenance against `automecanik-raw/recycled/rag-knowledge/`. It is the diagnostic
 * step immediately UPSTREAM of promote-raw-gammes-to-wiki.py (hence this dir).
 *
 * STRICTLY read-only of the RAW repo ; writes only the evidence artefact under
 * `audit/content/raw-evidence/`. No fact extraction, no LLM, no generation, no
 * DB/wiki/RAG write, no URL/canonical/redirect. Deterministic + idempotent: same
 * RAW → bit-identical artefact (writeDeterministicJson, content_hash from source
 * bytes, no builder timestamp).
 *
 * Pattern: build-command-center-snapshot.js (deterministic builder) + diag-canon
 * Zod→JSON projection. seo-readiness.ts borrowed only for verdict/NEXT_ACTION shape.
 *
 * Usage:
 *   npx tsx scripts/wiki-generators/raw-evidence-inventory.ts <subject> [--json]
 *   npx tsx scripts/wiki-generators/raw-evidence-inventory.ts --all
 *   npx tsx scripts/wiki-generators/raw-evidence-inventory.ts --emit-schema   # regenerate JSON Schema projection
 *   npx tsx scripts/wiki-generators/raw-evidence-inventory.ts --check         # fail if committed schema drifted
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { load as loadYaml } from 'js-yaml';
import { zodToJsonSchema as _zodToJsonSchema } from 'zod-to-json-schema';

import { RawEvidenceSchema, type RawEvidence } from './raw-evidence.schema';
import {
  BLOCK_DEFS,
  SUPERSET_BLOCKS_5_0,
  GUIDE_MAP,
  assessBlock,
  pickNextAction,
  type BlockStatus,
} from './raw-block-schema';

const require = createRequire(import.meta.url);
// Reuse the shared deterministic writer (sortKeysDeep + 2-space + trailing \n + sha256).
const { writeDeterministicJson, sortKeysDeep } = require('../registry/lib/utils.js');

// Type-erased cast (TS2589 mitigation), mirroring diag-canon-jsonschema.ts.
const zodToJsonSchema = _zodToJsonSchema as (schema: unknown, options?: unknown) => object;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..');
const RAW_ROOT = process.env.AUTOMECANIK_RAW_PATH || '/opt/automecanik/automecanik-raw';
const KB = path.join(RAW_ROOT, 'recycled', 'rag-knowledge');
const GAMMES_DIR = path.join(KB, 'gammes');
const GUIDES_DIR = path.join(KB, 'guides');
const EVIDENCE_DIR = path.join(KB, '_raw', 'evidence');
const OUT_DIR = path.join(MONOREPO_ROOT, 'audit', 'content', 'raw-evidence');
const SCHEMA_PATH = path.join(__dirname, 'raw-evidence.schema.json');

const FOLD_READINESS = {
  R4_to_R3: 'BLOCKED_PENDING_ADR',
  R5_to_R3: 'READY_ADR_027',
  R6_to_R3: 'BLOCKED_PENDING_ADR',
} as const;
const FOLD_NOTE =
  'R4/R6→R3 = direction owner souhaitée, PENDING_ADR (étend ADR-027) ; pas canon. R5 déjà replié (ADR-027).';

type Source = { path: string; kind: 'gamme' | 'guide' | 'evidence'; content_hash: string };

function sha256File(absPath: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

function relToRaw(absPath: string): string {
  return path.relative(RAW_ROOT, absPath).split(path.sep).join('/');
}

/** Parse YAML frontmatter from a `---`-delimited markdown file. Never throws. */
function parseFrontmatter(raw: string): { fm: any | null; error: string | null } {
  if (!raw.startsWith('---')) return { fm: null, error: 'no_frontmatter_delimiter' };
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return { fm: null, error: 'unterminated_frontmatter' };
  try {
    return { fm: loadYaml(raw.slice(3, end)) ?? null, error: null };
  } catch (e) {
    return { fm: null, error: 'yaml_parse_error: ' + String((e as Error).message || e) };
  }
}

function discoverSources(subject: string): { sources: Source[]; unlinked: string[] } {
  const sources: Source[] = [];
  const gammePath = path.join(GAMMES_DIR, `${subject}.md`);
  if (fs.existsSync(gammePath)) {
    sources.push({ path: relToRaw(gammePath), kind: 'gamme', content_hash: sha256File(gammePath) });
  }
  const evidencePath = path.join(EVIDENCE_DIR, `${subject}.yml`);
  if (fs.existsSync(evidencePath)) {
    sources.push({ path: relToRaw(evidencePath), kind: 'evidence', content_hash: sha256File(evidencePath) });
  }
  const unlinked: string[] = [];
  const guideSlug = GUIDE_MAP[subject];
  if (guideSlug) {
    const guidePath = path.join(GUIDES_DIR, `${guideSlug}.md`);
    if (fs.existsSync(guidePath)) {
      sources.push({ path: relToRaw(guidePath), kind: 'guide', content_hash: sha256File(guidePath) });
    }
  } else {
    // No deterministic guide link (guides carry no pg_id/gamme field) — honest, not silent.
    unlinked.push('guide');
  }
  sources.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { sources, unlinked };
}

type CoverageEntry = {
  block: string;
  status: BlockStatus;
  canon_role: string;
  r3_section: string | null;
  fold_status: 'PENDING_ADR' | 'LIVE' | 'NATIVE' | 'NOT_FOLDED';
  warnings: string[];
};

function buildCoverage(fm: any): CoverageEntry[] {
  const coverage: CoverageEntry[] = [];
  // v4 canon blocks A–E.
  for (const def of BLOCK_DEFS) {
    const { status, warnings } = assessBlock(def.key, fm);
    coverage.push({
      block: def.id,
      status,
      canon_role: def.canon_role,
      r3_section: def.r3_section,
      fold_status: def.fold_status,
      warnings,
    });
  }
  // 5.0 superset blocks — recensés (present → NOT_MAPPED), never silently dropped.
  for (const key of SUPERSET_BLOCKS_5_0) {
    if (fm?.[key] !== undefined && fm?.[key] !== null) {
      coverage.push({ block: `5.0:${key}`, status: 'NOT_MAPPED', canon_role: '—', r3_section: null, fold_status: 'NOT_FOLDED', warnings: [] });
    }
  }
  if (fm?.diagnostic?.depose_steps !== undefined && fm?.diagnostic?.depose_steps !== null) {
    coverage.push({ block: '5.0:diagnostic.depose_steps', status: 'NOT_MAPPED', canon_role: '—', r3_section: null, fold_status: 'NOT_FOLDED', warnings: [] });
  }
  // Compatibility — catalog/DB only, never in RAW, never a RAW blocker.
  coverage.push({ block: 'compatibility', status: 'BLOCKED_CATALOG_REQUIRED', canon_role: 'R1/R2', r3_section: null, fold_status: 'NOT_FOLDED', warnings: [] });
  return coverage;
}

function rawVerdict(coverage: CoverageEntry[]): RawEvidence['raw_verdict'] {
  const abcde = coverage.filter((c) => /^[A-E]\./.test(c.block));
  if (abcde.every((c) => c.status === 'PRESENT')) return 'READY';
  return 'PARTIAL_READY';
}

/** Build the (deterministic) evidence artefact for one subject. Read-only; no write. */
export function buildEvidence(subject: string): RawEvidence {
  const gammePath = path.join(GAMMES_DIR, `${subject}.md`);
  const base = {
    schema_version: 'raw-evidence.v1' as const,
    subject,
    fold_readiness: FOLD_READINESS,
    fold_note: FOLD_NOTE,
  };

  if (!fs.existsSync(gammePath)) {
    return RawEvidenceSchema.parse({
      ...base,
      pg_id: null,
      inventory_status: 'NO_RAW',
      intent_targets: [],
      provenance: { source_type: null, truth_level: null, verification_status: null, completeness_profile: null, sources: [], unlinked_source_types: [] },
      coverage: [],
      raw_verdict: 'NO_RAW',
      next_action: 'SOURCE_FIRST',
    });
  }

  const { sources, unlinked } = discoverSources(subject);
  const { fm, error } = parseFrontmatter(fs.readFileSync(gammePath, 'utf8'));

  if (error || !fm) {
    return RawEvidenceSchema.parse({
      ...base,
      pg_id: null,
      inventory_status: 'RAW_PARSE_ERROR',
      intent_targets: [],
      provenance: { source_type: null, truth_level: null, verification_status: null, completeness_profile: null, sources, unlinked_source_types: unlinked },
      coverage: [],
      raw_verdict: 'RAW_PARSE_ERROR',
      next_action: `FIX_RAW_FRONTMATTER (${error ?? 'empty_frontmatter'})`,
    });
  }

  const coverage = buildCoverage(fm);
  const intentTargets = Array.isArray(fm.intent_targets) ? fm.intent_targets.map(String) : [];
  const pgIdRaw = Number(fm.pg_id);
  const pg_id = Number.isFinite(pgIdRaw) ? pgIdRaw : null;

  return RawEvidenceSchema.parse({
    ...base,
    pg_id,
    inventory_status: 'DIAGNOSTIC_READY',
    intent_targets: intentTargets,
    provenance: {
      source_type: fm.source_type ?? null,
      truth_level: fm.truth_level ?? null,
      verification_status: fm.verification_status ?? null,
      completeness_profile: fm.completeness_profile ?? null,
      sources,
      unlinked_source_types: unlinked,
    },
    coverage,
    raw_verdict: rawVerdict(coverage),
    next_action: pickNextAction(
      coverage.map((c) => ({ block: c.block, status: c.status })),
      intentTargets,
    ),
  });
}

function buildSchemaJson(): object {
  return zodToJsonSchema(RawEvidenceSchema, { target: 'jsonSchema7', $refStrategy: 'none' });
}

function serialize(obj: unknown): string {
  return JSON.stringify(sortKeysDeep(obj), null, 2) + '\n';
}

function listSubjects(): string[] {
  return fs
    .readdirSync(GAMMES_DIR)
    .filter((f) => f.endsWith('.md')) // excludes *.manifest.yaml / *.html
    .map((f) => f.slice(0, -3))
    .sort();
}

function writeArtefact(ev: RawEvidence): string {
  const out = path.join(OUT_DIR, `${ev.subject}.raw-evidence.json`);
  return writeDeterministicJson(out, ev);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--emit-schema')) {
    const sha = writeDeterministicJson(SCHEMA_PATH, buildSchemaJson());
    process.stdout.write(`emitted ${path.relative(MONOREPO_ROOT, SCHEMA_PATH)} (sha256:${sha})\n`);
    return;
  }

  if (args.includes('--check')) {
    const expected = serialize(buildSchemaJson());
    const actual = fs.existsSync(SCHEMA_PATH) ? fs.readFileSync(SCHEMA_PATH, 'utf8') : '';
    if (actual !== expected) {
      process.stderr.write('raw-evidence.schema.json DRIFTED from the Zod source. Run --emit-schema.\n');
      process.exit(1);
    }
    process.stdout.write('raw-evidence.schema.json is in sync with the Zod source.\n');
    return;
  }

  if (args.includes('--all')) {
    const subjects = listSubjects();
    for (const subject of subjects) {
      const ev = buildEvidence(subject);
      const sha = writeArtefact(ev);
      process.stdout.write(`${subject}: ${ev.inventory_status} · ${ev.raw_verdict} · ${ev.next_action} (sha256:${sha})\n`);
    }
    process.stdout.write(`\n${subjects.length} subjects.\n`);
    return;
  }

  const subject = args.find((a) => !a.startsWith('--'));
  if (!subject) {
    process.stderr.write('Usage: raw-evidence-inventory.ts <subject> [--json] | --all | --emit-schema | --check\n');
    process.exit(2);
  }

  const ev = buildEvidence(subject!);
  const sha = writeArtefact(ev);

  if (args.includes('--json')) {
    process.stdout.write(serialize(ev));
    return;
  }
  process.stdout.write(`\nRAW_EVIDENCE ${subject} — read-only\n`);
  process.stdout.write(`  inventory_status: ${ev.inventory_status}\n`);
  process.stdout.write(`  raw_verdict:      ${ev.raw_verdict}\n`);
  for (const c of ev.coverage) {
    const w = c.warnings.length ? `  warnings:[${c.warnings.join('; ')}]` : '';
    process.stdout.write(`  ${c.block.padEnd(28)} ${c.status}${w}\n`);
  }
  process.stdout.write(`  fold_readiness:   R4=${ev.fold_readiness.R4_to_R3} R5=${ev.fold_readiness.R5_to_R3} R6=${ev.fold_readiness.R6_to_R3}\n`);
  process.stdout.write(`  next_action:      ${ev.next_action}   (owner-gated)\n`);
  process.stdout.write(`  artefact:         audit/content/raw-evidence/${subject}.raw-evidence.json (sha256:${sha})\n`);
}

const invokedDirect =
  !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirect) main();
