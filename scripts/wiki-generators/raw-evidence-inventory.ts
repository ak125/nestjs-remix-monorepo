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
 * 3-types extension (plan « RAW Encyclopédie » PR-B, owner 2026-06-12) : `--all-types`
 * evaluates gamme + vehicle + diagnostic fiches against the completeness profiles
 * (`${RAW_ROOT}/_schemas/completeness/*.yaml`, PR-A) → tier NONE/BRONZE/ARGENT/OR per
 * fiche + aggregate `audit/content/raw-evidence/encyclopedia-coverage.json`. Profile
 * absent → NOT_CONFIGURED (counted, never a crash/silent skip). Legacy gamme modes and
 * artefact bytes are untouched.
 *
 * Usage:
 *   npx tsx scripts/wiki-generators/raw-evidence-inventory.ts <subject> [--json]
 *   npx tsx scripts/wiki-generators/raw-evidence-inventory.ts --all
 *   npx tsx scripts/wiki-generators/raw-evidence-inventory.ts --all-types     # 3 types (gamme+vehicle+diagnostic) + encyclopedia-coverage.json
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

import {
  RawEvidenceSchema,
  EncyclopediaCoverageSchema,
  TIER,
  type RawEvidence,
  type EncyclopediaCoverage,
} from './raw-evidence.schema';
import {
  BLOCK_DEFS,
  SUPERSET_BLOCKS_5_0,
  GUIDE_MAP,
  assessBlock,
  pickNextAction,
  type BlockStatus,
} from './raw-block-schema';
import {
  loadCompletenessProfile,
  evaluateTiers,
  type ProfileLoad,
  type TierResult,
} from './completeness-tiers';

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
const VEHICLES_DIR = path.join(KB, 'vehicles');
const DIAGNOSTIC_DIR = path.join(KB, 'diagnostic');
const OUT_DIR = path.join(MONOREPO_ROOT, 'audit', 'content', 'raw-evidence');
const COVERAGE_PATH = path.join(OUT_DIR, 'encyclopedia-coverage.json');
const SCHEMA_PATH = path.join(__dirname, 'raw-evidence.schema.json');

// 3 tiered entity types (plan « RAW Encyclopédie » PR-B). Gamme per-fiche artefacts keep
// their legacy location + byte-identical format ; vehicle/diagnostic artefacts live in
// sub-directories (slug collisions exist, e.g. disque-de-frein in gammes/ AND diagnostic/).
const TIERED_ENTITY_TYPES = ['gamme', 'vehicle', 'diagnostic'] as const;
type TieredEntityType = (typeof TIERED_ENTITY_TYPES)[number];
const ENTITY_SRC_DIR: Record<TieredEntityType, string> = {
  gamme: GAMMES_DIR,
  vehicle: VEHICLES_DIR,
  diagnostic: DIAGNOSTIC_DIR,
};
const ENTITY_OUT_DIR: Record<'vehicle' | 'diagnostic', string> = {
  vehicle: path.join(OUT_DIR, 'vehicles'),
  diagnostic: path.join(OUT_DIR, 'diagnostic'),
};

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

// ————————————————————————————————————————————————————————————————————————————
// 3-types extension — completeness tiers (plan « RAW Encyclopédie » PR-B).
// Profiles (PR-A) live in `${RAW_ROOT}/_schemas/completeness/{gamme,vehicle,diagnostic}.yaml`.
// Profile absent → tier NOT_CONFIGURED (never a crash, never a silent skip — counted
// in the aggregate report). Legacy gamme modes/artefacts are untouched (byte-identical).
// ————————————————————————————————————————————————————————————————————————————

/** Markdown body AFTER the `---`-delimited frontmatter block ('' if unterminated). */
function splitBody(raw: string): string {
  if (!raw.startsWith('---')) return raw;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return '';
  const eol = raw.indexOf('\n', end + 4);
  return eol === -1 ? '' : raw.slice(eol + 1);
}

interface TieredFiche {
  subject: string;
  family: string | null; // gamme frontmatter `category` ; null otherwise
  tier: TierResult;
  missing_for_next_tier: string[];
  parse_error: boolean;
  fm: any | null;
  parse_error_msg: string | null;
}

/** Parse + tier-evaluate one fiche (any entity type). Read-only ; never throws. */
function evaluateFiche(entityType: TieredEntityType, subject: string, profileLoad: ProfileLoad): TieredFiche {
  const srcPath = path.join(ENTITY_SRC_DIR[entityType], `${subject}.md`);
  const raw = fs.readFileSync(srcPath, 'utf8');
  const { fm, error } = parseFrontmatter(raw);
  const body = splitBody(raw);
  const tierEval =
    profileLoad.status === 'OK'
      ? evaluateTiers(profileLoad.profile, { slug: subject, fm, body, rawRoot: RAW_ROOT })
      : { tier: 'NOT_CONFIGURED' as TierResult, missing_for_next_tier: [] as string[] };
  const family =
    entityType === 'gamme' && typeof fm?.category === 'string' && fm.category.trim().length > 0
      ? fm.category.trim()
      : null;
  return {
    subject,
    family,
    tier: tierEval.tier,
    missing_for_next_tier: tierEval.missing_for_next_tier,
    parse_error: !!error || !fm,
    fm,
    parse_error_msg: error ?? (fm ? null : 'empty_frontmatter'),
  };
}

function tierVerdict(fiche: TieredFiche): RawEvidence['raw_verdict'] {
  if (fiche.parse_error) return 'RAW_PARSE_ERROR';
  if (fiche.tier === 'NOT_CONFIGURED') return 'NOT_CONFIGURED';
  // ARGENT+ = éligible WIKI candidate (porte ADR-083 ensuite) — BRONZE ≠ publication.
  return fiche.tier === 'ARGENT' || fiche.tier === 'OR' ? 'READY' : 'PARTIAL_READY';
}

function tierNextAction(fiche: TieredFiche): string {
  if (fiche.parse_error) return `FIX_RAW_FRONTMATTER (${fiche.parse_error_msg})`;
  switch (fiche.tier) {
    case 'NOT_CONFIGURED':
      return 'CONFIGURE_COMPLETENESS_PROFILE';
    case 'NONE':
      return 'ENRICH_RAW_TO_BRONZE';
    case 'BRONZE':
      return 'ENRICH_RAW_TO_ARGENT';
    default:
      return 'PROMOTE_RAW_TO_WIKI'; // ARGENT/OR — owner-gated (porte ADR-083)
  }
}

/** Build the deterministic per-fiche artefact for a vehicle/diagnostic subject. */
export function buildEntityEvidence(
  entityType: 'vehicle' | 'diagnostic',
  subject: string,
  profileLoad: ProfileLoad,
): RawEvidence {
  const srcPath = path.join(ENTITY_SRC_DIR[entityType], `${subject}.md`);
  const fiche = evaluateFiche(entityType, subject, profileLoad);
  return RawEvidenceSchema.parse({
    schema_version: 'raw-evidence.v1' as const,
    subject,
    entity_type: entityType,
    pg_id: null,
    inventory_status: fiche.parse_error ? 'RAW_PARSE_ERROR' : 'DIAGNOSTIC_READY',
    intent_targets: [],
    provenance: {
      source_type: fiche.fm?.source_type ?? null,
      truth_level: fiche.fm?.truth_level ?? null,
      verification_status: fiche.fm?.verification_status ?? null,
      completeness_profile: fiche.fm?.completeness_profile ?? null,
      sources: [{ path: relToRaw(srcPath), kind: entityType, content_hash: sha256File(srcPath) }],
      unlinked_source_types: [],
    },
    coverage: [], // v4 A–E blocks are gamme-specific — tier evaluation carries the signal here
    tier: fiche.tier,
    missing_for_next_tier: fiche.missing_for_next_tier,
    raw_verdict: tierVerdict(fiche),
    next_action: tierNextAction(fiche),
  });
}

function emptyTierCounts(): Record<(typeof TIER)[number], number> {
  return { NONE: 0, BRONZE: 0, ARGENT: 0, OR: 0, NOT_CONFIGURED: 0 };
}

function profileState(entityType: TieredEntityType, load: ProfileLoad): EncyclopediaCoverage['profiles']['gamme'] {
  return {
    path: `_schemas/completeness/${entityType}.yaml`,
    status: load.status,
    content_hash: load.status === 'NOT_CONFIGURED' ? null : load.content_hash,
    reason: load.status === 'OK' ? null : load.reason,
    warnings: load.status === 'OK' ? load.warnings : [],
  };
}

/** Run the 3-types inventory : per-fiche artefacts (vehicle/diagnostic) + legacy gamme artefacts + aggregate. */
function runAllTypes(): void {
  const loads = {
    gamme: loadCompletenessProfile(RAW_ROOT, 'gamme'),
    vehicle: loadCompletenessProfile(RAW_ROOT, 'vehicle'),
    diagnostic: loadCompletenessProfile(RAW_ROOT, 'diagnostic'),
  } as const;

  const byType = {} as EncyclopediaCoverage['by_type'];
  const byFamily: EncyclopediaCoverage['by_family'] = {};
  const fiches: EncyclopediaCoverage['fiches'] = [];

  for (const entityType of TIERED_ENTITY_TYPES) {
    const subjects = listSubjectsIn(ENTITY_SRC_DIR[entityType]);
    const tiers = emptyTierCounts();
    let parseErrors = 0;

    for (const subject of subjects) {
      const fiche = evaluateFiche(entityType, subject, loads[entityType]);
      tiers[fiche.tier] += 1;
      if (fiche.parse_error) parseErrors += 1;
      fiches.push({
        entity_type: entityType,
        subject,
        family: fiche.family,
        tier: fiche.tier,
        missing_for_next_tier: fiche.missing_for_next_tier,
      });
      if (entityType === 'gamme') {
        const familyKey = fiche.family ?? '__uncategorized__';
        byFamily[familyKey] ??= { total: 0, tiers: emptyTierCounts() };
        byFamily[familyKey].total += 1;
        byFamily[familyKey].tiers[fiche.tier] += 1;
        // Legacy per-fiche artefact — byte-identical to the historic gamme format (`--all`).
        writeArtefact(buildEvidence(subject));
      } else {
        const ev = buildEntityEvidence(entityType, subject, loads[entityType]);
        writeDeterministicJson(path.join(ENTITY_OUT_DIR[entityType], `${subject}.raw-evidence.json`), ev);
      }
    }

    byType[entityType] = { total: subjects.length, parse_errors: parseErrors, tiers };
    const profileNote = loads[entityType].status === 'OK' ? 'profile OK' : `profile ${loads[entityType].status}`;
    process.stdout.write(
      `${entityType}: ${subjects.length} fiches · ${profileNote} · ` +
        `NONE=${tiers.NONE} BRONZE=${tiers.BRONZE} ARGENT=${tiers.ARGENT} OR=${tiers.OR} NOT_CONFIGURED=${tiers.NOT_CONFIGURED}` +
        (parseErrors ? ` · parse_errors=${parseErrors}` : '') +
        '\n',
    );
  }

  fiches.sort((a, b) =>
    a.entity_type < b.entity_type ? -1 : a.entity_type > b.entity_type ? 1 : a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0,
  );

  const coverage = EncyclopediaCoverageSchema.parse({
    schema_version: 'encyclopedia-coverage.v1' as const,
    profiles: {
      gamme: profileState('gamme', loads.gamme),
      vehicle: profileState('vehicle', loads.vehicle),
      diagnostic: profileState('diagnostic', loads.diagnostic),
    },
    by_type: byType,
    by_family: byFamily,
    fiches,
  });
  const sha = writeDeterministicJson(COVERAGE_PATH, coverage);
  process.stdout.write(`\nencyclopedia-coverage: ${path.relative(MONOREPO_ROOT, COVERAGE_PATH)} (sha256:${sha})\n`);
}

function listSubjectsIn(dir: string): string[] {
  if (!fs.existsSync(dir)) return []; // honest empty set — counted as total: 0 in the aggregate
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md')) // excludes *.manifest.yaml / *.html
    .map((f) => f.slice(0, -3))
    .sort();
}

function buildSchemaJson(): object {
  return zodToJsonSchema(RawEvidenceSchema, { target: 'jsonSchema7', $refStrategy: 'none' });
}

function serialize(obj: unknown): string {
  return JSON.stringify(sortKeysDeep(obj), null, 2) + '\n';
}

function listSubjects(): string[] {
  return listSubjectsIn(GAMMES_DIR);
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

  if (args.includes('--all-types')) {
    runAllTypes();
    return;
  }

  const subject = args.find((a) => !a.startsWith('--'));
  if (!subject) {
    process.stderr.write('Usage: raw-evidence-inventory.ts <subject> [--json] | --all | --all-types | --emit-schema | --check\n');
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
