import { Injectable, Logger } from '@nestjs/common';

import type {
  RagConflictEntry,
  RagConflictType,
  RagSourceRef,
} from '../types/rag-lifecycle.types';

/**
 * Liste des champs de gamme.md pour lesquels une divergence de valeur DOIT
 * être classifiée comme `safety_conflict` (priorité Tech Lead).
 *
 * Cf. ADR-029 §"Decision matrix" et conflict.schema.yaml §"Owner de revue".
 *
 * Tout ajout à cette liste doit être discuté en ADR — c'est un domaine
 * sensible (procédure / sécurité / conséquences mécaniques).
 */
const SAFETY_CRITICAL_FIELDS = new Set<string>([
  'rendering.risk_explanation',
  'rendering.risk_consequences',
  'maintenance.do_not',
  'installation.common_errors',
  'diagnostic.causes',
]);

/**
 * Liste de regex de fields traités comme `technical_conflict` quand la valeur
 * diverge de manière non-mineure. Tout ce qui n'est pas matché ni dans
 * SAFETY_CRITICAL_FIELDS sera classifié `minor_variation` par défaut.
 */
const TECHNICAL_FIELD_PATTERNS: RegExp[] = [
  /^maintenance\.interval(\.|$)/,
  /^selection\.cost_range(\.|$)/,
  /^selection\.criteria(\[|\.|$)/,
  /^diagnostic\.symptoms\[\d+\]\.severity$/,
  /^domain\.must_be_true(\[|\.|$)/,
  /^domain\.must_not_contain(\[|\.|$)/,
];

interface DetectInput {
  /** Gamme slug (= pg_alias). */
  alias: string;
  /** UUID v4 of the current run. */
  runId: string;
  /** Map field.path → existing value (string-coerced). */
  existingValues: Record<string, string>;
  /** Map field.path → new value found this run (string-coerced). */
  newValues: Record<string, string>;
  /** Map field.path → sources for the existing value. */
  existingSources: Record<string, RagSourceRef[]>;
  /** Map field.path → sources for the new value. */
  newSources: Record<string, RagSourceRef[]>;
  /** ISO date YYYY-MM-DD. Defaults to today. */
  runDate?: string;
}

/**
 * RagConflictDetectorService — ADR-029 P1.
 *
 * Détecte les divergences entre la valeur actuelle d'un champ frontmatter
 * gamme.md et la nouvelle valeur produite par le pipeline d'enrichissement.
 * Classifie chaque divergence en `safety_conflict`, `technical_conflict` ou
 * `minor_variation` selon :
 *
 *   1. Liste explicite SAFETY_CRITICAL_FIELDS → safety
 *   2. Patterns TECHNICAL_FIELD_PATTERNS → technical
 *   3. Sinon → minor (sera traitée comme normalisation, ne bloque pas L1)
 *
 * Le service est pur : il ne lit ni n'écrit le frontmatter. Le caller
 * (P2 Audit / P3 QA) est responsable d'appliquer les conflits détectés au
 * bloc `_conflicts[]` du fichier .md.
 */
@Injectable()
export class RagConflictDetectorService {
  private readonly logger = new Logger(RagConflictDetectorService.name);

  /**
   * Détecte les conflits entre `existingValues` et `newValues`.
   * Retourne une entrée par champ divergent (selon les règles de
   * classification ci-dessus).
   */
  detect(input: DetectInput): RagConflictEntry[] {
    const today = input.runDate ?? new Date().toISOString().slice(0, 10);
    const conflicts: RagConflictEntry[] = [];

    // L'union des deux espaces de clés pour ne rien manquer
    const allFields = new Set<string>([
      ...Object.keys(input.existingValues),
      ...Object.keys(input.newValues),
    ]);

    for (const field of allFields) {
      const existing = input.existingValues[field];
      const next = input.newValues[field];

      // Champ absent d'un côté : ce n'est PAS un conflit (c'est un ajout
      // ou une suppression, géré par les blocks[].action du report).
      if (existing === undefined || next === undefined) continue;

      if (areEquivalent(existing, next)) continue;

      const conflictType = classifyConflict(field, existing, next);
      const block = extractBlock(field);

      if (!block) {
        this.logger.warn(
          `Skipping conflict for field='${field}' — cannot extract block prefix`,
        );
        continue;
      }

      conflicts.push({
        block,
        field,
        conflict_type: conflictType,
        run_id: input.runId,
        existing_value: existing,
        new_value: next,
        existing_sources: input.existingSources[field] ?? [],
        new_sources: input.newSources[field] ?? [],
        resolution_status: 'open',
        human_review_required:
          conflictType === 'technical_conflict' ||
          conflictType === 'safety_conflict',
        created_at: today,
        resolved_by: null,
        resolution: null,
        resolved_at: null,
      });
    }

    if (conflicts.length > 0) {
      this.logger.log(
        `[${input.alias}] detected ${conflicts.length} conflict(s): ` +
          summarizeByType(conflicts),
      );
    }

    return conflicts;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if two values represent the same business meaning. Trims and
 * collapses whitespace, lowercase compare. Used to skip false positives.
 */
function areEquivalent(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function classifyConflict(
  field: string,
  existing: string,
  next: string,
): RagConflictType {
  if (SAFETY_CRITICAL_FIELDS.has(stripIndices(field))) {
    return 'safety_conflict';
  }
  if (TECHNICAL_FIELD_PATTERNS.some((re) => re.test(field))) {
    return 'technical_conflict';
  }
  // Existing != next mais ni safety ni technical : on regarde si c'est
  // simplement une variation typographique acceptable.
  if (isMinorTypographical(existing, next)) {
    return 'minor_variation';
  }
  return 'minor_variation';
}

/** `selection.criteria[2]` → `selection.criteria` (array index agnostic). */
function stripIndices(field: string): string {
  return field.replace(/\[\d+\]/g, '');
}

/** Extract the top-level block from a dot-path field (`domain.role` → `domain`). */
function extractBlock(field: string): RagConflictEntry['block'] | null {
  const head = field.split('.')[0];
  switch (head) {
    case 'domain':
    case 'selection':
    case 'diagnostic':
    case 'maintenance':
    case 'installation':
    case 'rendering':
      return head;
    default:
      return null;
  }
}

/**
 * Heuristic — true if both strings are equal modulo case/whitespace/punctuation.
 * Used as a hint for `minor_variation` (the default fallback already returns
 * minor_variation, so this helper is informational only for now and reserved
 * for future expansion of the classifier).
 */
function isMinorTypographical(a: string, b: string): boolean {
  const stripPunct = (s: string) => s.replace(/[.,;:!?'"()«»\[\]]/g, '');
  return normalize(stripPunct(a)) === normalize(stripPunct(b));
}

function summarizeByType(conflicts: RagConflictEntry[]): string {
  const counts = { safety: 0, technical: 0, minor: 0 };
  for (const c of conflicts) {
    if (c.conflict_type === 'safety_conflict') counts.safety += 1;
    else if (c.conflict_type === 'technical_conflict') counts.technical += 1;
    else counts.minor += 1;
  }
  return `safety=${counts.safety} technical=${counts.technical} minor=${counts.minor}`;
}
