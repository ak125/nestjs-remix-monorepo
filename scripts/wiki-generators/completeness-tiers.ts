/**
 * completeness-tiers.ts — loader + evaluator for the RAW completeness profiles.
 *
 * Profiles live in the automecanik-raw repo (PR-A of the « RAW Encyclopédie »
 * plan, owner 2026-06-12) under `_schemas/completeness/{gamme,vehicle,diagnostic}.yaml`
 * and follow `_schemas/completeness/completeness-profile.schema.json` :
 *   - tiers cumulatifs BRONZE → ARGENT → OR (ARGENT suppose BRONZE, OR suppose ARGENT)
 *   - component `where` : `frontmatter:<dot.path>` ('.'=racine) | `body:h2`
 *     (titres dans required_fields) | `file:<path>` (`<slug>` interpolé)
 *   - component `check` : present_non_empty | items_have_required_fields |
 *     sections_present | min_two_distinct_source_kinds | file_exists |
 *     covers_db_set | all_resolved
 *
 * READ-ONLY + deterministic (fs reads only, no DB, no LLM, no network). Warn-only :
 * un profil mesure, il ne bloque rien. Fallbacks explicites — JAMAIS de crash,
 * JAMAIS de skip silencieux :
 *   - profil absent      → status NOT_CONFIGURED (compté dans le rapport agrégé)
 *   - profil illisible   → status PROFILE_PARSE_ERROR (raison conservée)
 *   - check inconnu      → composant fail-closed + warning au chargement
 *   - covers_db_set      → l'ensemble de référence DB (SELECT only) n'est PAS
 *     accessible à cet inventaire filesystem-only : évalué depuis l'ensemble
 *     fiche-local (`motorizations[]` → engine_code, cf. notes du profil vehicle)
 *     quand présent, sinon dégradé en present_non_empty + warning explicite.
 *
 * Section H2 « non-vide » = contenu ≥ 20 caractères utiles (hors espaces),
 * conformément au contrat PR-B du plan.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { load as loadYaml } from 'js-yaml';

export const TIERS_ORDER = ['BRONZE', 'ARGENT', 'OR'] as const;
export type TierName = (typeof TIERS_ORDER)[number];

/** Tier reached by a fiche (NONE = BRONZE not met ; NOT_CONFIGURED = no usable profile). */
export type TierResult = 'NONE' | TierName | 'NOT_CONFIGURED';

const KNOWN_CHECKS = new Set([
  'present_non_empty',
  'items_have_required_fields',
  'sections_present',
  'min_two_distinct_source_kinds',
  'file_exists',
  'covers_db_set',
  'all_resolved',
]);

export interface ProfileComponent {
  id: string;
  where: string;
  check: string;
  required_fields?: string[];
}

export interface CompletenessProfile {
  entity_type: string;
  tiers: Record<TierName, { components: ProfileComponent[] }>;
}

export type ProfileLoad =
  | { status: 'OK'; profile: CompletenessProfile; content_hash: string; warnings: string[] }
  | { status: 'NOT_CONFIGURED'; reason: string }
  | { status: 'PROFILE_PARSE_ERROR'; reason: string; content_hash: string | null };

export interface FicheContext {
  slug: string;
  /** Parsed YAML frontmatter (null on parse error — frontmatter checks then fail, body checks still run). */
  fm: unknown;
  /** Markdown body AFTER the frontmatter block. */
  body: string;
  /** Absolute RAW repo root (for file: checks). */
  rawRoot: string;
}

export interface TierEvaluation {
  tier: TierResult;
  /** Failing component ids of the tier ABOVE the one reached ([] at OR). */
  missing_for_next_tier: string[];
}

/**
 * Load `_schemas/completeness/<entityType>.yaml` from the RAW repo root.
 * Never throws ; absence and unreadability are explicit statuses.
 */
export function loadCompletenessProfile(rawRoot: string, entityType: string): ProfileLoad {
  const rel = path.join('_schemas', 'completeness', `${entityType}.yaml`);
  const abs = path.join(rawRoot, rel);
  if (!fs.existsSync(abs)) {
    return { status: 'NOT_CONFIGURED', reason: `profile file absent (${rel.split(path.sep).join('/')})` };
  }
  const bytes = fs.readFileSync(abs);
  const content_hash = 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');

  let doc: unknown;
  try {
    doc = loadYaml(bytes.toString('utf8'));
  } catch (e) {
    return { status: 'PROFILE_PARSE_ERROR', reason: 'yaml_parse_error: ' + String((e as Error).message || e), content_hash };
  }
  if (!isPlainObject(doc)) {
    return { status: 'PROFILE_PARSE_ERROR', reason: 'profile is not a YAML mapping', content_hash };
  }

  const warnings: string[] = [];
  if (doc.entity_type !== entityType) {
    warnings.push(`entity_type mismatch: profile says '${String(doc.entity_type)}', expected '${entityType}'`);
  }
  const tiersNode = (doc as Record<string, unknown>).tiers;
  if (!isPlainObject(tiersNode)) {
    return { status: 'PROFILE_PARSE_ERROR', reason: "missing or invalid 'tiers' mapping", content_hash };
  }

  const tiers = {} as CompletenessProfile['tiers'];
  for (const tierName of TIERS_ORDER) {
    const node = (tiersNode as Record<string, unknown>)[tierName];
    const componentsRaw = isPlainObject(node) ? (node as Record<string, unknown>).components : undefined;
    if (!Array.isArray(componentsRaw) || componentsRaw.length === 0) {
      return { status: 'PROFILE_PARSE_ERROR', reason: `tier ${tierName} missing or has no components`, content_hash };
    }
    const components: ProfileComponent[] = [];
    for (const c of componentsRaw) {
      if (!isPlainObject(c) || typeof c.id !== 'string' || !c.id || typeof c.where !== 'string' || typeof c.check !== 'string') {
        return { status: 'PROFILE_PARSE_ERROR', reason: `invalid component in tier ${tierName} (id/where/check required)`, content_hash };
      }
      if (!KNOWN_CHECKS.has(c.check)) {
        warnings.push(`unknown check '${c.check}' on ${tierName}/${c.id} — fail-closed`);
      }
      if (c.check === 'covers_db_set') {
        warnings.push(
          `covers_db_set on ${tierName}/${c.id}: DB reference set (SELECT only) not available in this ` +
            `filesystem-only inventory — evaluated from fiche-local motorizations[] when present, else degraded to present_non_empty`,
        );
      }
      if (c.check === 'sections_present' && !Array.isArray(c.required_fields)) {
        warnings.push(`sections_present on ${tierName}/${c.id} has no required_fields (section titles) — fail-closed`);
      }
      components.push({
        id: c.id,
        where: c.where,
        check: c.check,
        required_fields: Array.isArray(c.required_fields) ? c.required_fields.map(String) : undefined,
      });
    }
    tiers[tierName] = { components };
  }

  return { status: 'OK', profile: { entity_type: entityType, tiers }, content_hash, warnings };
}

/**
 * Evaluate the cumulative tiers of a fiche against a loaded profile.
 * Tier T is reached iff every component of every tier ≤ T passes.
 */
export function evaluateTiers(profile: CompletenessProfile, ctx: FicheContext): TierEvaluation {
  const failedByTier = {} as Record<TierName, string[]>;
  for (const tierName of TIERS_ORDER) {
    failedByTier[tierName] = profile.tiers[tierName].components
      .filter((c) => !checkComponent(c, ctx))
      .map((c) => c.id);
  }
  let reachedIdx = -1;
  for (let i = 0; i < TIERS_ORDER.length; i++) {
    if (failedByTier[TIERS_ORDER[i]].length === 0) reachedIdx = i;
    else break;
  }
  const tier: TierResult = reachedIdx === -1 ? 'NONE' : TIERS_ORDER[reachedIdx];
  const nextTier = TIERS_ORDER[reachedIdx + 1];
  return { tier, missing_for_next_tier: nextTier ? failedByTier[nextTier] : [] };
}

/** Evaluate one profile component. Unknown check / unknown where → fail-closed. */
export function checkComponent(c: ProfileComponent, ctx: FicheContext): boolean {
  if (c.check === 'file_exists') {
    if (!c.where.startsWith('file:')) return false;
    const rel = c.where.slice('file:'.length).split('<slug>').join(ctx.slug);
    return fs.existsSync(path.join(ctx.rawRoot, rel));
  }
  if (c.check === 'sections_present') {
    if (c.where !== 'body:h2' || !c.required_fields || c.required_fields.length === 0) return false;
    const sections = extractH2Sections(ctx.body);
    return c.required_fields.every((title) => {
      const content = sections.get(normalizeTitle(title));
      return content !== undefined && usefulLength(content) >= 20;
    });
  }

  if (!c.where.startsWith('frontmatter:')) return false;
  const node = resolveFmPath(ctx.fm, c.where.slice('frontmatter:'.length));

  switch (c.check) {
    case 'present_non_empty': {
      if (c.required_fields && c.required_fields.length > 0) {
        if (!isPlainObject(node)) return false;
        return c.required_fields.every((f) => isNonEmpty((node as Record<string, unknown>)[f]));
      }
      return isNonEmpty(node);
    }
    case 'items_have_required_fields': {
      if (!Array.isArray(node) || node.length === 0) return false;
      const required = c.required_fields ?? [];
      return node.every((item) => isPlainObject(item) && required.every((f) => isNonEmpty((item as Record<string, unknown>)[f])));
    }
    case 'min_two_distinct_source_kinds': {
      if (!Array.isArray(node)) return false;
      const kinds = new Set(
        node
          .map((item) => (isPlainObject(item) ? String((item as Record<string, unknown>).type ?? (item as Record<string, unknown>).kind ?? '') : ''))
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      );
      return kinds.size >= 2;
    }
    case 'all_resolved': {
      // « aucune entrée ouverte » : absent / vide = rien d'ouvert → pass ;
      // toute entrée non explicitement resolved/closed = ouverte → fail.
      if (node === undefined || node === null) return true;
      if (!Array.isArray(node)) return false;
      return node.every(
        (item) =>
          isPlainObject(item) &&
          typeof (item as Record<string, unknown>).status === 'string' &&
          ['resolved', 'closed'].includes(((item as Record<string, unknown>).status as string).toLowerCase()),
      );
    }
    case 'covers_db_set': {
      // Filesystem-only : pas de SELECT. Ensemble de référence fiche-local
      // (motorizations[].engine_code) quand présent ; sinon dégradé non-vide
      // (warning émis au chargement du profil — jamais silencieux).
      if (!Array.isArray(node) || node.length === 0) return false;
      const ref = engineCodes((ctx.fm as Record<string, unknown> | null)?.motorizations);
      if (ref.length > 0) {
        const got = new Set(engineCodes(node));
        return ref.every((code) => got.has(code));
      }
      return true;
    }
    default:
      return false; // unknown check — fail-closed (warning emitted at profile load)
  }
}

/** Extract H2 sections of a markdown body → Map<normalized title, content until next H1/H2>. */
export function extractH2Sections(body: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = body.split('\n');
  let currentTitle: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (currentTitle !== null && !sections.has(currentTitle)) sections.set(currentTitle, buffer.join('\n'));
    buffer = [];
  };
  for (const line of lines) {
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      flush();
      currentTitle = normalizeTitle(h2[1]);
      continue;
    }
    if (/^#\s/.test(line)) {
      flush();
      currentTitle = null;
      continue;
    }
    if (currentTitle !== null) buffer.push(line);
  }
  flush();
  return sections;
}

/** Normalize an H2 title for matching: straight apostrophes, collapsed spaces, lowercase. */
export function normalizeTitle(title: string): string {
  return title.replace(/[’ʼ‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Useful character count of a section: everything except whitespace. */
export function usefulLength(content: string): number {
  return content.replace(/\s+/g, '').length;
}

/** Resolve a dot-path inside the frontmatter ('.' = root). */
function resolveFmPath(fm: unknown, dotPath: string): unknown {
  if (fm === null || fm === undefined) return undefined;
  if (dotPath === '.' || dotPath === '') return fm;
  let node: unknown = fm;
  for (const key of dotPath.split('.')) {
    if (!isPlainObject(node)) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** Non-empty: trimmed string, non-empty array, non-empty object, finite number, boolean. */
function isNonEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'boolean') return true;
  if (isPlainObject(v)) return Object.keys(v).length > 0;
  return false;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Distinct non-empty engine_code values of an array of items (order preserved). */
function engineCodes(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    const code = (item as Record<string, unknown>).engine_code;
    if (typeof code === 'string' && code.trim().length > 0 && !out.includes(code.trim())) out.push(code.trim());
  }
  return out;
}
