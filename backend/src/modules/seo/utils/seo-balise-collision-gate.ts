/**
 * SeoBaliseCollisionGate — verdict PUR de collision de balises entre pages sœurs.
 *
 * Brique D-3 (Track A) du control plane anti-duplicate des balises émises. Gouvernée par
 * **ADR-095** (vault, Accepted 2026-06-28) : « gate dure anti-duplicate des balises émises ».
 *
 * Cette gate **compose** les primitives pures de {@link SeoFingerprintCore} (D-1) avec
 * l'indexabilité effective de chaque page — elle n'invente RIEN, ne crée aucun système
 * parallèle, ne lit aucune DB, ne mute jamais URL/canonical/robots/noindex.
 *
 * Décision ADR-095 appliquée verbatim :
 *  • §1 Périmètre HARD = `indexable_effective` (le caller fournit le booléen, calculé LIVE via
 *       `computeIndexabilityVerdict()` — jamais le snapshot async). Une page hors INDEX_FOLLOW
 *       est hors-scope du blocage (ses collisions restent report-only).
 *  • §2 HARD **uniquement** sur la collision EXACTE de `title` / `h1` (champs identité). La
 *       `description` est report-only. Le near-dup (normalisé/lexical) = `CALIBRATION_PENDING`
 *       jusqu'à P-7 — jamais bloquant. Catalogue/FAQ factuellement partagés (`catalogueExempt`,
 *       exemption gouvernée R-SEO-09) = report-only.
 *  • §3 « Bloque le changement, pas la page » : cette gate renvoie un VERDICT (`blocking`) ;
 *       elle n'applique aucune action. Le caller (slice 2, gated `SEO_CHAIN_DUPLICATE_GATE_MODE`)
 *       décide en mode `shadow` (log seul) vs `on` (refuse l'application du changement).
 *
 * **100 % pur** : aucune I/O, aucune dépendance DB, aucun pg_trgm. Réutilise `SeoFingerprintCore`.
 * Sits alongside `seo-fingerprint-core.ts` / `seo-field-gate.ts` (même module utils, style pur statique).
 */

import {
  SeoFingerprintCore,
  type SeoFingerprintField,
  type SeoPageFingerprint,
} from './seo-fingerprint-core';

/**
 * Champs HARD-bloquants (ADR-095 §2 : title/H1 = identité de la page). La `description`
 * n'est jamais bloquante par elle-même (report-only).
 */
const HARD_FIELDS: readonly SeoFingerprintField[] = ['title', 'h1'];

export type BaliseGateDecision =
  | 'CLEAN'
  | 'COLLISION_EXACTE'
  | 'COLLISION_PROCHE'
  | 'COVERAGE_GAP';

/**
 * Une page sœur déjà publiée (même groupe : motorisations d'un modèle R8, ou pg×modèle R2),
 * avec son indexabilité effective — calculée LIVE par le caller (`computeIndexabilityVerdict`),
 * jamais déduite ici.
 */
export interface BaliseSibling {
  fingerprint: SeoPageFingerprint;
  /** `computeIndexabilityVerdict(...).kind === INDEX_FOLLOW` (autorité live, pas le snapshot). */
  indexableEffective: boolean;
  /** Catalogue/FAQ factuellement partagé (exemption gouvernée R-SEO-09) → jamais HARD. */
  catalogueExempt?: boolean;
}

/** Proximité report-only (jamais bloquante ; `CALIBRATION_PENDING` jusqu'à P-7). */
export interface BaliseNearDup {
  field: SeoFingerprintField;
  entityKey: string;
  /** Jaccard de tokens [0,1] (exact normalisé → reporté avec son recouvrement lexical). */
  jaccard: number;
  /** `exact` (hash brut égal mais hors-scope HARD) | `normalized` (casse/accents) | `lexical`. */
  kind: 'exact' | 'normalized';
}

export interface BaliseGateVerdict {
  decision: BaliseGateDecision;
  /**
   * `true` UNIQUEMENT pour une collision EXACTE d'un champ HARD (title/h1) entre deux pages
   * `indexable_effective` non-exemptes. Tout le reste est `false` (report-only). Le caller
   * ne refuse le changement QUE si `blocking && mode === 'on'`.
   */
  blocking: boolean;
  /** Champ HARD en collision exacte (présent ssi `blocking`). */
  field?: SeoFingerprintField;
  /** `entityKey` de la sœur en collision exacte (présent ssi `blocking`). */
  collidingEntityKey?: string;
  reasonCode: string;
  /** Toutes les proximités report-only détectées (diagnostic/observabilité). */
  nearDup: BaliseNearDup[];
}

export interface BaliseGateInput {
  /** Le changement en cours d'application (publication / flip / remplacement de balise). */
  candidate: SeoPageFingerprint;
  /** Indexabilité effective du candidat (LIVE). Hors INDEX_FOLLOW → jamais bloquant. */
  candidateIndexableEffective: boolean;
  /** Candidat catalogue/FAQ partagé (exemption gouvernée) → jamais HARD. */
  candidateCatalogueExempt?: boolean;
  /** Les sœurs déjà publiées du même groupe. */
  siblings: readonly BaliseSibling[];
}

export class SeoBaliseCollisionGate {
  /** Champs identité bloquants (title/h1) — exposé pour les itérations déterministes/tests. */
  static readonly HARD_FIELDS = HARD_FIELDS;

  /**
   * Évalue le candidat contre ses sœurs. Pur, déterministe, sans I/O.
   *
   * Précédence du verdict : `COLLISION_EXACTE` (HARD, bloquant) > `COVERAGE_GAP` (champ HARD
   * vide sur candidat indexable) > `COLLISION_PROCHE` (≥1 near-dup report-only) > `CLEAN`.
   * `nearDup` est toujours peuplé avec TOUTES les proximités détectées, même quand une
   * collision HARD est retournée (observabilité complète).
   */
  static evaluate(input: BaliseGateInput): BaliseGateVerdict {
    const {
      candidate,
      candidateIndexableEffective,
      candidateCatalogueExempt = false,
      siblings,
    } = input;

    const nearDup: BaliseNearDup[] = [];
    let hardHit: { field: SeoFingerprintField; entityKey: string } | null =
      null;

    for (const field of SeoFingerprintCore.fields()) {
      const candFp = candidate.fields[field];
      const isHardField = HARD_FIELDS.includes(field);

      for (const sib of siblings) {
        const sibFp = sib.fingerprint.fields[field];

        // Champ vide d'un côté → aucune collision signifiante : l'absence d'une balise est
        // un COVERAGE_GAP (traité plus bas), jamais un duplicate (sinon deux titres vides
        // se « collisionneraient » sur sha256('') → faux-blocage). No-silent-fallback : le
        // vide est un signal distinct, pas une égalité.
        if (candFp.raw.trim() === '' || sibFp.raw.trim() === '') continue;

        const bothIndexable =
          candidateIndexableEffective && sib.indexableEffective;
        const exempt = candidateCatalogueExempt || sib.catalogueExempt === true;

        if (SeoFingerprintCore.isExactCollision(candFp, sibFp)) {
          // HARD ssi : champ identité (title/h1) ∧ les deux indexables ∧ non exempt.
          if (isHardField && bothIndexable && !exempt && hardHit === null) {
            hardHit = { field, entityKey: sib.fingerprint.entityKey };
          } else {
            // Exact mais hors-scope HARD (description, non-indexable, ou exempt) → report-only.
            nearDup.push({
              field,
              entityKey: sib.fingerprint.entityKey,
              jaccard: 1,
              kind: 'exact',
            });
          }
          continue;
        }

        // Collision NORMALISÉE (casse/accents/espaces) sans exact → report-only (CALIBRATION_PENDING).
        if (SeoFingerprintCore.isNormalizedCollision(candFp, sibFp)) {
          nearDup.push({
            field,
            entityKey: sib.fingerprint.entityKey,
            jaccard: SeoFingerprintCore.tokenJaccard(candFp, sibFp),
            kind: 'normalized',
          });
        }
      }
    }

    if (hardHit !== null) {
      return {
        decision: 'COLLISION_EXACTE',
        blocking: true,
        field: hardHit.field,
        collidingEntityKey: hardHit.entityKey,
        reasonCode: `BALISE_EXACT_${hardHit.field.toUpperCase()}_COLLISION`,
        nearDup,
      };
    }

    // COVERAGE_GAP : un champ HARD vide sur une page indexable (la balise identité manque).
    if (candidateIndexableEffective) {
      const missingHard = HARD_FIELDS.find(
        (f) => candidate.fields[f].raw.trim() === '',
      );
      if (missingHard) {
        return {
          decision: 'COVERAGE_GAP',
          blocking: false,
          field: missingHard,
          reasonCode: `BALISE_MISSING_${missingHard.toUpperCase()}`,
          nearDup,
        };
      }
    }

    if (nearDup.length > 0) {
      return {
        decision: 'COLLISION_PROCHE',
        blocking: false,
        reasonCode: 'BALISE_NEAR_DUP_CALIBRATION_PENDING',
        nearDup,
      };
    }

    return {
      decision: 'CLEAN',
      blocking: false,
      reasonCode: 'BALISE_CLEAN',
      nearDup,
    };
  }
}
