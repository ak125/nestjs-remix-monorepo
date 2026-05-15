/**
 * PR-A1 — H1 forensic audit engine (READ-ONLY)
 *
 * Per-asset evidence-tier classification + heuristic scoring for SEO H1 values.
 * No DDL, no DB writes — pure analysis returning AuditRow objects.
 *
 * Plan : /home/deploy/.claude/plans/lors-du-audite-seo-concurrent-swan.md §4 Phase A1
 * Memory : feedback_forensic_strict_readonly_before_infra, feedback_deterministic_evidence_tiers_over_bayesian
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export type EvidenceTier =
  | 'exact_match_snapshot'
  | 'exact_match_event_log'
  | 'exact_match_blog_advice'
  | 'exact_match_builder_template'
  | 'heuristic_recent_change'
  | 'unknown';

export type Confidence = 'high' | 'medium' | 'low';

export type RoleId = 'R1_ROUTER' | 'R3_CONSEILS' | 'R6_GUIDE_ACHAT';

export interface AssetIdentifier {
  asset_id: string; // 'r1_router:pg:filtres-huile'
  field_path: 'h1';
  pg_numeric_id: number;
  pg_alias: string;
  gamme_label: string;
  role_id: RoleId;
  url: string;
  physical: {
    table: string;
    column: string;
  };
}

export interface HeuristicScore {
  length: number;
  length_ok: boolean;       // 35-65 chars
  has_gamme_name: boolean;
  pas_cher_count: number;
  pas_cher_penalty: boolean; // >=2 occurrences
  has_html_residue: boolean;
  all_caps: boolean;
  word_count: number;
  word_count_ok: boolean;    // >=3 words
  composite: number;         // /6
}

export interface AuditRow {
  asset: AssetIdentifier;
  observed_value: string;
  observed_value_normalized: string;
  observed_hash: string;
  evidence_tier: EvidenceTier;
  confidence: Confidence;
  source_details: Record<string, unknown>;
  legacy_candidate?: string;
  legacy_source?: string;
  scores: {
    current: HeuristicScore;
    legacy?: HeuristicScore;
    score_delta?: number; // legacy.composite - current.composite (positive = legacy better)
  };
  observed_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const H1_LENGTH_MIN = 35;
const H1_LENGTH_MAX = 65;
const PAS_CHER_THRESHOLD = 2;
const RECENT_CHANGE_WINDOW_DAYS = 90;

/** Deterministic builder template detection patterns (R7/R8 templates, etc.) */
const BUILDER_TEMPLATE_PATTERNS: ReadonlyArray<RegExp> = [
  /^Catalogue pièces auto /i,                       // r7-brand-enricher
  /\b\d+\s*ch\s*\(\d{4}-(\d{4}|auj\.)\)\s*$/i,      // r8-vehicle (buildR8H1)
];

/** "Pas cher" pattern (case-insensitive, accent-insensitive via separate normalize) */
const PAS_CHER_PATTERN = /\bpas\s+cher\b/gi;

/** HTML residue patterns (legacy contamination cleaned 2026-01-05 migration) */
const HTML_RESIDUE_PATTERN = /<\/?[a-z][a-z0-9]*\b[^>]*>/i;

// ── Normalization & hashing ──────────────────────────────────────────────────

/**
 * Normalize a string for hash-based equality: NFC + trim + collapse whitespace
 * + lowercase. Same normalization applied on both sides of hash comparisons.
 */
export function normalize(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function hashValue(normalized: string): string {
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

// ── Heuristic scoring ────────────────────────────────────────────────────────

/**
 * Score an H1 value on 6 binary criteria (composite /6).
 * Pure function, no I/O, no DB.
 *
 * - +1 length within [35, 65]
 * - +1 contains gamme name (case-insensitive)
 * - +1 no "pas cher" repetition (<2 occurrences)
 * - +1 no HTML residue
 * - +1 not entirely uppercase
 * - +1 word_count >= 3
 */
export function scoreHeuristic(h1: string, gammeLabel: string): HeuristicScore {
  const trimmed = h1.trim();
  const length = trimmed.length;
  const length_ok = length >= H1_LENGTH_MIN && length <= H1_LENGTH_MAX;

  const lowerH1 = trimmed.toLowerCase();
  const lowerGamme = gammeLabel.trim().toLowerCase();
  const has_gamme_name = lowerGamme.length > 0 && lowerH1.includes(lowerGamme);

  const pas_cher_count = (trimmed.match(PAS_CHER_PATTERN) ?? []).length;
  const pas_cher_penalty = pas_cher_count >= PAS_CHER_THRESHOLD;

  const has_html_residue = HTML_RESIDUE_PATTERN.test(trimmed);
  const all_caps =
    trimmed.length > 0 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);

  const words = trimmed.split(/\s+/).filter(Boolean);
  const word_count = words.length;
  const word_count_ok = word_count >= 3;

  // has_gamme_name pondéré à 3 (topic relevance = critère sémantique dominant)
  // total /8 — un H1 off-topic ne peut pas scorer haut, même si tous les autres critères passent
  const composite =
    (length_ok ? 1 : 0) +
    (has_gamme_name ? 3 : 0) +
    (!pas_cher_penalty ? 1 : 0) +
    (!has_html_residue ? 1 : 0) +
    (!all_caps ? 1 : 0) +
    (word_count_ok ? 1 : 0);

  return {
    length,
    length_ok,
    has_gamme_name,
    pas_cher_count,
    pas_cher_penalty,
    has_html_residue,
    all_caps,
    word_count,
    word_count_ok,
    composite,
  };
}

export const COMPOSITE_MAX = 8;

// ── Evidence search — find best legacy candidate AND classify its tier ──────
//
// Ordered cascade : first source returning a candidate (different from current
// AND with non-empty content) determines the evidence_tier. This matches plan
// §4 step 2 (ordered lookup) AND step 5 (strong candidate = evidence_tier ∈
// exact_match_*).
//
// Semantics : evidence_tier reflects the STRENGTH of the legacy evidence, NOT
// the provenance of the current value. A `unknown` tier means "no authoritative
// legacy candidate found", regardless of whether current is corrupted or not.

interface LegacyEvidence {
  evidence_tier: EvidenceTier;
  confidence: Confidence;
  source_details: Record<string, unknown>;
  legacy_value?: string;
  legacy_source?: string;
}

export async function findBestLegacyEvidence(
  supabase: SupabaseClient,
  asset: AssetIdentifier,
  currentHash: string,
  context: { current_value: string; updated_at?: string | null; pas_cher_count: number },
): Promise<LegacyEvidence> {
  // Tier 1 — synthetic snapshot (different value from current = drift signal)
  const { data: snap } = await supabase
    .from('__seo_snapshot_synthetic')
    .select('id, h1_text, created_at')
    .eq('url', asset.url)
    .not('h1_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (snap) {
    for (const row of snap as Array<{ id: number; h1_text: string; created_at: string }>) {
      if (hashValue(normalize(row.h1_text)) !== currentHash) {
        return {
          evidence_tier: 'exact_match_snapshot',
          confidence: 'high',
          source_details: { snapshot_id: row.id, snapshot_created_at: row.created_at },
          legacy_value: row.h1_text,
          legacy_source: '__seo_snapshot_synthetic',
        };
      }
    }
  }

  // Tier 2 — event_log (payload contains H1 value)
  const { data: evt } = await supabase
    .from('__seo_event_log')
    .select('id, event_type, payload, created_at')
    .or(`payload->>pg_alias.eq.${asset.pg_alias},payload->>pg_id.eq.${asset.pg_alias}`)
    .not('payload->>h1', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (evt) {
    for (const row of evt as Array<{
      id: string;
      event_type: string;
      payload: Record<string, unknown>;
      created_at: string;
    }>) {
      const h1 = row.payload?.['h1'];
      if (typeof h1 === 'string' && hashValue(normalize(h1)) !== currentHash) {
        return {
          evidence_tier: 'exact_match_event_log',
          confidence: 'high',
          source_details: {
            event_log_id: row.id,
            event_type: row.event_type,
            event_created_at: row.created_at,
          },
          legacy_value: h1,
          legacy_source: '__seo_event_log',
        };
      }
    }
  }

  // Tier 3 — blog_advice legacy
  try {
    const { data: blog } = await supabase
      .from('__blog_advice')
      .select('ba_id, ba_h1, ba_title')
      .eq('ba_pg_id', asset.pg_numeric_id)
      .limit(10);

    if (blog) {
      for (const row of blog as Array<{
        ba_id: number;
        ba_h1: string | null;
        ba_title: string | null;
      }>) {
        for (const candidate of [row.ba_h1, row.ba_title]) {
          if (candidate && hashValue(normalize(candidate)) !== currentHash) {
            return {
              evidence_tier: 'exact_match_blog_advice',
              confidence: 'high',
              source_details: { blog_advice_id: row.ba_id },
              legacy_value: candidate,
              legacy_source: '__blog_advice',
            };
          }
        }
      }
    }
  } catch {
    // Table may not exist or shape differs — silent skip, fall through to next tier
  }

  // Tier 4 — current matches a known builder template. Legacy = current itself
  // (informational : current was deterministically built, no separate legacy)
  for (const pattern of BUILDER_TEMPLATE_PATTERNS) {
    if (pattern.test(context.current_value)) {
      return {
        evidence_tier: 'exact_match_builder_template',
        confidence: 'high',
        source_details: { pattern: pattern.source },
        legacy_value: context.current_value,
        legacy_source: 'deterministic_builder',
      };
    }
  }

  // Tier 5 — heuristic recent change. No legacy found, but current shows
  // LLM-touched signs (recent updated_at + "pas cher" repetition).
  if (context.updated_at && context.pas_cher_count >= PAS_CHER_THRESHOLD) {
    const updatedDate = new Date(context.updated_at);
    const ageDays = (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < RECENT_CHANGE_WINDOW_DAYS) {
      return {
        evidence_tier: 'heuristic_recent_change',
        confidence: 'medium',
        source_details: {
          updated_at: context.updated_at,
          age_days: Math.round(ageDays * 10) / 10,
          pas_cher_count: context.pas_cher_count,
        },
      };
    }
  }

  // Tier 6 — unknown
  return { evidence_tier: 'unknown', confidence: 'low', source_details: {} };
}

// ── Audit a single asset (top-level entry) ───────────────────────────────────

export async function auditAsset(
  supabase: SupabaseClient,
  asset: AssetIdentifier,
  current: { value: string; updated_at?: string | null },
): Promise<AuditRow> {
  const observed_value_normalized = normalize(current.value);
  const observed_hash = hashValue(observed_value_normalized);
  const currentScore = scoreHeuristic(current.value, asset.gamme_label);

  const evidence = await findBestLegacyEvidence(supabase, asset, observed_hash, {
    current_value: current.value,
    updated_at: current.updated_at ?? null,
    pas_cher_count: currentScore.pas_cher_count,
  });

  let legacyScore: HeuristicScore | undefined;
  let scoreDelta: number | undefined;
  if (evidence.legacy_value) {
    legacyScore = scoreHeuristic(evidence.legacy_value, asset.gamme_label);
    scoreDelta = legacyScore.composite - currentScore.composite;
  }

  return {
    asset,
    observed_value: current.value,
    observed_value_normalized,
    observed_hash,
    evidence_tier: evidence.evidence_tier,
    confidence: evidence.confidence,
    source_details: evidence.source_details,
    legacy_candidate: evidence.legacy_value,
    legacy_source: evidence.legacy_source,
    scores: {
      current: currentScore,
      ...(legacyScore ? { legacy: legacyScore } : {}),
      ...(scoreDelta !== undefined ? { score_delta: scoreDelta } : {}),
    },
    observed_at: new Date().toISOString(),
  };
}

// ── Asset loader (R1_ROUTER for now ; R3/R6 extension noted in plan) ─────────

export async function loadR1Assets(
  supabase: SupabaseClient,
  options: { limit?: number; pg_alias_filter?: string } = {},
): Promise<Array<AssetIdentifier & { _h1Source: { value: string; updated_at?: string | null } }>> {
  // 232 G1/G2 gammes via __pg_gammes
  let gammeQuery = supabase
    .from('__pg_gammes')
    .select('id, pg_alias, label')
    .not('pg_alias', 'is', null);

  if (options.pg_alias_filter) {
    gammeQuery = gammeQuery.eq('pg_alias', options.pg_alias_filter);
  }
  if (options.limit) {
    gammeQuery = gammeQuery.limit(options.limit);
  }

  const { data: gammes, error: gammeErr } = await gammeQuery;
  if (gammeErr || !gammes) {
    throw new Error(`Failed to load gammes from __pg_gammes: ${gammeErr?.message ?? 'no data'}`);
  }

  const assets: Array<AssetIdentifier & { _h1Source: { value: string; updated_at?: string | null } }> = [];
  for (const g of gammes as Array<{ id: number; pg_alias: string; label: string | null }>) {
    // R1 H1 lives in __seo_r1_gamme_slots.r1s_h1_override (if exists),
    // else falls back to __seo_gamme.sg_h1.
    const { data: r1Slot } = await supabase
      .from('__seo_r1_gamme_slots')
      .select('r1s_h1_override, updated_at')
      .eq('r1s_pg_id', g.id)
      .maybeSingle();

    let h1Value: string | null = null;
    let h1UpdatedAt: string | null = null;
    if (r1Slot && (r1Slot as { r1s_h1_override: string | null }).r1s_h1_override) {
      h1Value = (r1Slot as { r1s_h1_override: string }).r1s_h1_override;
      h1UpdatedAt = (r1Slot as { updated_at: string | null }).updated_at;
    } else {
      const { data: legacyRow } = await supabase
        .from('__seo_gamme')
        .select('sg_h1, sg_updated_at')
        .eq('sg_id', g.id)
        .maybeSingle();
      if (legacyRow && (legacyRow as { sg_h1: string | null }).sg_h1) {
        h1Value = (legacyRow as { sg_h1: string }).sg_h1;
        h1UpdatedAt = (legacyRow as { sg_updated_at: string | null }).sg_updated_at;
      }
    }

    if (!h1Value) continue; // skip gammes without H1 (out of scope for audit)

    const physical = r1Slot
      ? { table: '__seo_r1_gamme_slots', column: 'r1s_h1_override' }
      : { table: '__seo_gamme', column: 'sg_h1' };

    assets.push({
      asset_id: `r1_router:pg:${g.pg_alias}`,
      field_path: 'h1',
      pg_numeric_id: g.id,
      pg_alias: g.pg_alias,
      gamme_label: g.label ?? g.pg_alias,
      role_id: 'R1_ROUTER',
      url: `https://automecanik.com/pieces/${g.pg_alias}`,
      physical,
      _h1Source: { value: h1Value, updated_at: h1UpdatedAt },
    });
  }
  return assets;
}
