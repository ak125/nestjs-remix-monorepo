/**
 * validate-gamme-schema.ts — Batch validator for gamme.md files
 *
 * Validates all gamme.md files against the v4 schema definition.
 * Reports version distribution, compliance, errors, and scoring summary.
 *
 * Usage: npx ts-node scripts/validate-gamme-schema.ts [--verbose]
 *
 * Ref: .spec/00-canon/gamme-md-schema.md
 */

import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require('js-yaml');

const GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';
const verbose = process.argv.includes('--verbose');

interface ValidationError {
  file: string;
  bloc: string;
  field: string;
  message: string;
  severity: 'BLOCK' | 'WARN' | 'INFO';
}

interface GammeReport {
  file: string;
  version: string;
  score: number;
  stage: string;
  priority: string;
  errors: ValidationError[];
}

// ── Generic patterns (BLOCK) ──
const GENERIC_PATTERNS = [
  /joue un r[oô]le essentiel/i,
  /Son entretien r[eé]gulier garantit/i,
  /assure le bon fonctionnement/i,
  /permet de garantir/i,
  /est un [eé]l[eé]ment (essentiel|important|cl[eé])/i,
];

function detectVersion(fm: any): string {
  const v =
    fm?.rendering?.quality?.version ||
    fm?.page_contract?.quality?.version ||
    fm?.quality?.version;
  if (v === 'GammeContentContract.v4') return 'v4';
  if (v === 'GammeContentContract.v3') return 'v3';
  return 'v1';
}

function validateV4(fm: any, filename: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const e = (bloc: string, field: string, message: string, severity: 'BLOCK' | 'WARN' | 'INFO' = 'WARN') =>
    errors.push({ file: filename, bloc, field, message, severity });

  // ── Bloc A: Domain ──
  const domain = fm.domain || {};
  const role = domain.role || '';
  if (!role || role.length < 80) {
    e('A', 'domain.role', `Role too short (${role.length} chars, min 80)`, 'BLOCK');
  } else if (GENERIC_PATTERNS.some((p) => p.test(role))) {
    e('A', 'domain.role', 'Generic role detected', 'BLOCK');
  }
  if (!domain.confusion_with || domain.confusion_with.length < 2) {
    e('A', 'domain.confusion_with', `Need >= 2, got ${domain.confusion_with?.length || 0}`);
  }
  if (!domain.must_be_true || domain.must_be_true.length < 2) {
    e('A', 'domain.must_be_true', `Need >= 2, got ${domain.must_be_true?.length || 0}`);
  }

  // ── Bloc B: Selection ──
  const sel = fm.selection || {};
  if (!sel.criteria || sel.criteria.length < 3) {
    e('B', 'selection.criteria', `Need >= 3, got ${sel.criteria?.length || 0}`);
  }
  if (!sel.checklist || sel.checklist.length < 3) {
    e('B', 'selection.checklist', `Need >= 3, got ${sel.checklist?.length || 0}`);
  }
  if (!sel.anti_mistakes || sel.anti_mistakes.length < 3) {
    e('B', 'selection.anti_mistakes', `Need >= 3, got ${sel.anti_mistakes?.length || 0}`);
  }
  if (sel.cost_range) {
    if (sel.cost_range.max > 10 * sel.cost_range.min && sel.cost_range.min > 0) {
      e('B', 'selection.cost_range', `Suspect range: ${sel.cost_range.min}-${sel.cost_range.max}`, 'BLOCK');
    }
  } else {
    e('B', 'selection.cost_range', 'Missing cost_range', 'BLOCK');
  }

  // ── Bloc C: Diagnostic ──
  const diag = fm.diagnostic || {};
  if (!diag.symptoms || diag.symptoms.length < 3) {
    e('C', 'diagnostic.symptoms', `Need >= 3, got ${diag.symptoms?.length || 0}`);
  }
  if (!diag.causes || diag.causes.length < 2) {
    e('C', 'diagnostic.causes', `Need >= 2, got ${diag.causes?.length || 0}`);
  }
  if (!diag.quick_checks || diag.quick_checks.length < 2) {
    e('C', 'diagnostic.quick_checks', `Need >= 2, got ${diag.quick_checks?.length || 0}`);
  }

  // ── Bloc D: Maintenance ──
  const maint = fm.maintenance || {};
  if (!maint.interval || !maint.interval.note) {
    e('D', 'maintenance.interval', 'Missing interval or note');
  }
  if (maint.interval?.unit !== 'km' && (!maint.usage_factors || maint.usage_factors.length === 0)) {
    e('D', 'maintenance.usage_factors', 'Required when unit != km');
  }

  // ── Bloc E: Installation (info only) ──
  if (fm.installation && fm.installation.steps?.length < 3) {
    e('E', 'installation.steps', `Need >= 3, got ${fm.installation.steps?.length || 0}`, 'INFO');
  }

  // ── Rendering ──
  const rend = fm.rendering || {};
  if (!rend.pgId) {
    e('rendering', 'rendering.pgId', 'Missing pgId', 'BLOCK');
  }
  if (rend.arguments) {
    for (const arg of rend.arguments) {
      if (/\d/.test(arg.title) && !arg.source_ref) {
        e('rendering', 'rendering.arguments', `Unsourced claim: "${arg.title}"`, 'BLOCK');
      }
    }
  }
  if (!rend.faq || rend.faq.length < 4) {
    e('rendering', 'rendering.faq', `Need >= 4, got ${rend.faq?.length || 0}`);
  }

  return errors;
}

function scoreV4(errors: ValidationError[], fm: any): number {
  let penalties = 0;
  let bonuses = 0;

  for (const err of errors) {
    if (err.severity === 'BLOCK') penalties += 10;
    else if (err.severity === 'WARN') penalties += 3;
  }

  // Bonuses (aligned with scoreRagDataV4 in reference.service.ts)
  if (fm.installation && fm.installation.steps?.length >= 3) bonuses += 5;
  if (fm.domain?.cross_gammes?.length >= 1) bonuses += 3;
  if (fm._sources && Object.keys(fm._sources).length >= 1) bonuses += 2;

  return Math.max(0, Math.min(100, 100 - penalties + bonuses));
}

// ── R1 readiness (WIKI_EXPORT dimension only) ──
// Validates the WIKI EXPORT .md (the source content-gen R1 actually reads), NOT RAG
// (__rag_knowledge / RagFoundationGate). Presence gates = hard BLOCK ; depth gates flag
// thin content. Reason codes align with the /r1-readiness verdict (see plan).
const R1_READINESS_THRESHOLDS = {
  criteriaMin: 5, // calibré sur exemplaires : filtre=10, disque=5 (rendent riche) ; colonne=3 (thin)
  mustBeTrueMin: 3,
};

// Calibration EMPIRIQUE (vérifiée sur exemplaires qui rendent 9-10K c) :
// `seo_cluster` + profondeur `criteria` prédisent la richesse du rendu ; `completeness_profile`
// et `verification_status` NE la prédisent PAS (disque-de-frein rend 9809c sans completeness_profile
// et en `draft`) → BLOCK sur seo_cluster/criteria ; les deux autres = warnings advisory (gouvernance).
export function r1WikiExportReadiness(fm: any): {
  status: 'READY' | 'BLOCKED';
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!fm?.seo_cluster) blockers.push('seo_cluster_missing');
  if ((fm?.selection?.criteria?.length ?? 0) < R1_READINESS_THRESHOLDS.criteriaMin)
    blockers.push('selection_criteria_thin');
  if (!fm?.completeness_profile) warnings.push('completeness_profile_missing');
  if (fm?.verification_status !== 'verified') warnings.push('verification_status_not_verified');
  if ((fm?.domain?.must_be_true?.length ?? 0) < R1_READINESS_THRESHOLDS.mustBeTrueMin)
    warnings.push('must_be_true_thin');
  return { status: blockers.length === 0 ? 'READY' : 'BLOCKED', blockers, warnings };
}

// Load + parse a gamme WIKI export frontmatter once (reused by all per-role gates).
export function loadGammeFrontmatter(alias: string): any | null {
  const filePath = path.join(GAMMES_DIR, `${alias}.md`);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? yaml.load(m[1]) : {};
}

const _len = (a: any): number => (Array.isArray(a) ? a.length : 0);
const _present = (v: any): boolean =>
  Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : !!v;

export type RoleWikiVerdict = { status: 'READY' | 'BLOCKED'; blockers: string[]; warnings: string[] };
const _verdict = (blockers: string[], warnings: string[]): RoleWikiVerdict => ({
  status: blockers.length === 0 ? 'READY' : 'BLOCKED',
  blockers,
  warnings,
});

// R3 (conseil / diagnostic / how-to) WIKI gate.
export function r3WikiExportReadiness(fm: any): RoleWikiVerdict {
  const b: string[] = [], w: string[] = [];
  if (!fm?.domain?.role) b.push('domain_role_missing');
  if (_len(fm?.diagnostic?.symptoms) < 3) b.push('diagnostic_symptoms_thin');
  if (_len(fm?.diagnostic?.causes) < 2) w.push('diagnostic_causes_thin');
  if (_len(fm?.diagnostic?.quick_checks) < 2) w.push('quick_checks_thin');
  if (!fm?.maintenance?.interval?.note) w.push('maintenance_note_missing');
  if (_len(fm?.rendering?.faq) < 4) w.push('faq_thin');
  return _verdict(b, w);
}

// R4 (référence / encyclopédique) WIKI gate.
export function r4WikiExportReadiness(fm: any): RoleWikiVerdict {
  const b: string[] = [], w: string[] = [];
  const role = fm?.domain?.role || '';
  if (!role || String(role).length < 80) b.push('domain_role_missing');
  if (_len(fm?.domain?.must_be_true) < 2) b.push('must_be_true_thin');
  if (_len(fm?.domain?.confusion_with) < 2) b.push('confusion_with_thin');
  if (!_present(fm?.domain?.related_parts)) w.push('related_parts_missing');
  return _verdict(b, w);
}

// R6 (guide d'achat / comparatif) WIKI gate.
export function r6WikiExportReadiness(fm: any): RoleWikiVerdict {
  const b: string[] = [], w: string[] = [];
  if (!_present(fm?.selection?.brands)) b.push('brands_missing');
  if (!_present(fm?.selection?.quality_tiers)) b.push('quality_tiers_missing');
  if (!_present(fm?.selection?.cost_range)) w.push('cost_range_missing');
  if (_len(fm?.selection?.criteria) < 3) w.push('selection_criteria_thin');
  return _verdict(b, w);
}

export interface WikiExportReadiness {
  found: boolean;
  status: 'READY' | 'BLOCKED';
  blockers: string[];
  warnings: string[];
  fields: {
    seo_cluster: boolean;
    completeness_profile: string | null;
    verification_status: string | null;
    criteria: number;
    must_be_true: number;
    schema: string;
  };
  score: number;
}

// Reusable WIKI_EXPORT verdict for one gamme (filesystem only — validates the WIKI export,
// NOT RAG). Imported by the /r1-readiness composer (scripts/seo/r1-readiness.ts) which adds
// the DB-backed KW / CONTENT / LIVE dimensions.
export function wikiExportReadiness(alias: string): WikiExportReadiness {
  const filePath = path.join(GAMMES_DIR, `${alias}.md`);
  if (!fs.existsSync(filePath)) {
    return {
      found: false,
      status: 'BLOCKED',
      blockers: ['export_missing'],
      warnings: [],
      fields: { seo_cluster: false, completeness_profile: null, verification_status: null, criteria: 0, must_be_true: 0, schema: 'none' },
      score: 0,
    };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = fmMatch ? yaml.load(fmMatch[1]) : {};
  const { status, blockers, warnings } = r1WikiExportReadiness(fm);
  const version = detectVersion(fm);
  const score = version === 'v4' ? scoreV4(validateV4(fm, alias), fm) : 0;
  return {
    found: true,
    status,
    blockers,
    warnings,
    fields: {
      seo_cluster: !!fm?.seo_cluster,
      completeness_profile: fm?.completeness_profile ?? null,
      verification_status: fm?.verification_status ?? null,
      criteria: fm?.selection?.criteria?.length ?? 0,
      must_be_true: fm?.domain?.must_be_true?.length ?? 0,
      schema: version,
    },
    score,
  };
}

// Single-gamme WIKI_EXPORT readiness (CLI). KW / CONTENT / LIVE dimensions are DB-backed and
// composed by scripts/seo/r1-readiness.ts — this script owns the WIKI_EXPORT dimension only.
function runSingleR1Readiness(alias: string): void {
  const r = wikiExportReadiness(alias);
  const { status, blockers, warnings, fields, score } = r;

  console.log(`\nR1_READINESS ${alias} (WIKI_EXPORT dimension — valide l'export WIKI, PAS le RAG)`);
  console.log(`- WIKI_EXPORT: ${status}${blockers.length ? `  blockers:[${blockers.join(', ')}]` : ''}`);
  if (warnings.length) console.log(`  warnings:[${warnings.join(', ')}]`);
  console.log(
    `  fields: seo_cluster=${fields.seo_cluster} completeness_profile=${fields.completeness_profile ?? 'null'} ` +
      `verification_status=${fields.verification_status ?? 'null'} criteria=${fields.criteria} ` +
      `must_be_true=${fields.must_be_true} schema=${fields.schema} score=${score}`,
  );
  console.log(
    `  NEXT_ACTION(WIKI): ${status === 'READY' ? 'none — vérifier KW/CONTENT/LIVE (dims DB, owner-gated)' : 'RUN_RAW_TO_WIKI'}`,
  );
  if (process.argv.includes('--json')) {
    console.log('--- JSON ---');
    console.log(JSON.stringify({ alias, dimension: 'WIKI_EXPORT', ...r }, null, 2));
  }
}

// ── Main ──

function main() {
  // Single-gamme R1 WIKI_EXPORT readiness verdict (read-only).
  const gIdx = process.argv.indexOf('--gamme');
  if (gIdx >= 0 && process.argv[gIdx + 1]) {
    runSingleR1Readiness(process.argv[gIdx + 1]);
    return;
  }

  const files = fs.readdirSync(GAMMES_DIR).filter((f) => f.endsWith('.md'));
  const reports: GammeReport[] = [];
  const versionCounts: Record<string, number> = { v1: 0, v3: 0, v4: 0 };
  const stageCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = { high: 0, medium: 0, low: 0, unknown: 0 };

  for (const file of files) {
    const filePath = path.join(GAMMES_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) {
        reports.push({ file, version: 'invalid', score: 0, stage: 'unknown', priority: 'unknown', errors: [{ file, bloc: 'meta', field: 'frontmatter', message: 'No YAML frontmatter', severity: 'BLOCK' }] });
        continue;
      }

      const fm = yaml.load(fmMatch[1]);
      const version = detectVersion(fm);
      versionCounts[version] = (versionCounts[version] || 0) + 1;

      const stage = fm?.lifecycle?.stage || 'auto_generated';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;

      const priority = fm?.business_priority || 'unknown';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

      let errors: ValidationError[] = [];
      let score = 0;

      if (version === 'v4') {
        errors = validateV4(fm, file);
        score = scoreV4(errors, fm);
      } else {
        // Legacy — basic checks
        const pc = fm?.page_contract || {};
        score = pc?.quality?.score || 0;
      }

      reports.push({ file, version, score, stage, priority, errors });
    } catch (err) {
      reports.push({ file, version: 'error', score: 0, stage: 'unknown', priority: 'unknown', errors: [{ file, bloc: 'meta', field: 'parse', message: `Parse error: ${err}`, severity: 'BLOCK' }] });
    }
  }

  // ── Summary ──
  const scores = reports.map((r) => r.score).filter((s) => s > 0);
  const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  console.log('\n=== GAMME SCHEMA VALIDATION REPORT ===\n');
  console.log(`Total files: ${reports.length}`);
  console.log(`\nBy version:`);
  for (const [v, count] of Object.entries(versionCounts)) {
    console.log(`  ${v}: ${count}`);
  }
  console.log(`\nBy lifecycle stage:`);
  for (const [s, count] of Object.entries(stageCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${s}: ${count}`);
  }
  console.log(`\nBy priority:`);
  for (const [p, count] of Object.entries(priorityCounts)) {
    if (count > 0) console.log(`  ${p}: ${count}`);
  }
  console.log(`\nScoring (files with score > 0):`);
  console.log(`  min: ${sorted[0] || 0}`);
  console.log(`  max: ${sorted[sorted.length - 1] || 0}`);
  console.log(`  avg: ${avg}`);
  console.log(`  median: ${median}`);

  // V4-specific errors
  const v4Reports = reports.filter((r) => r.version === 'v4');
  if (v4Reports.length > 0) {
    const allErrors = v4Reports.flatMap((r) => r.errors);
    const blockErrors = allErrors.filter((e) => e.severity === 'BLOCK');
    const warnErrors = allErrors.filter((e) => e.severity === 'WARN');

    console.log(`\nV4 validation:`);
    console.log(`  v4 files: ${v4Reports.length}`);
    console.log(`  BLOCK errors: ${blockErrors.length}`);
    console.log(`  WARN errors: ${warnErrors.length}`);

    if (verbose && allErrors.length > 0) {
      console.log(`\nDetailed errors:`);
      for (const err of allErrors) {
        console.log(`  [${err.severity}] ${err.file} → ${err.bloc}.${err.field}: ${err.message}`);
      }
    }
  }

  // Output JSON for programmatic use
  if (process.argv.includes('--json')) {
    console.log('\n--- JSON ---');
    console.log(JSON.stringify({
      total: reports.length,
      versions: versionCounts,
      stages: stageCounts,
      priorities: priorityCounts,
      scoring: { min: sorted[0] || 0, max: sorted[sorted.length - 1] || 0, avg, median },
      v4_errors: v4Reports.flatMap((r) => r.errors),
    }, null, 2));
  }
}

if (require.main === module) main();
