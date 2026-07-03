/**
 * SeoFingerprintCore — empreinte PURE des balises réellement émises (title/description/h1).
 *
 * Brique D-1 du control plane anti-duplicate des balises (Track A). Consomme un
 * {@link ResolvedPageSeo} (les valeurs déjà résolues, PAS de ré-extraction) et émet,
 * **par champ**, des empreintes déterministes :
 *
 *  • `exactHash`      — sha256 du texte BRUT → collision EXACTE = seul signal **HARD**
 *                       (avant calibration P-7, l'égalité exacte est la seule règle bloquante).
 *  • `normalizedHash` — sha256 de `normalizeSeoText` (SoT accent/casse/espaces, @repo/seo-roles)
 *                       → collision insensible à la casse/accents/espaces (diagnostic, non-HARD).
 *  • `tokens`         — tokens triés+uniques, base du near-dup LEXICAL (Jaccard JS, report-only).
 *
 * **100 % pur** : aucune I/O, aucune dépendance DB, **aucun pg_trgm**. Le near-dup `pg_trgm`
 * (similarity côté Postgres) vit dans `SeoNearDuplicateAnalyzer` (DB/offline), JAMAIS ici —
 * pg_trgm est une extension PG, pas une lib JS. Le seul calcul de proximité fourni ici est
 * un Jaccard de tokens en JS (même esprit que `R2CatalogSignatureService.jaccardOverlap`).
 *
 * Réutilise `normalizeSeoText`/`tokenize` (@repo/seo-roles) — la normalize **testée et
 * accent-correcte**, jamais une normalize Unicode-naïve ad-hoc.
 *
 * Sits alongside `seo-field-gate.ts` (même module utils, même style pur statique).
 */

import { createHash } from 'node:crypto';
import { normalizeSeoText, tokenize } from '@repo/seo-roles';

import type { ResolvedPageSeo } from '../types/resolved-seo-field';

/** Version de l'empreinte — estampillée sur chaque page (bump si la forme change). */
export const SEO_FINGERPRINT_VERSION = 'seo-fingerprint-core.v1';

/** Les trois champs de balise couverts (twitter hérite d'og ; og = pass-through title/desc). */
export type SeoFingerprintField = 'title' | 'description' | 'h1';

const FINGERPRINT_FIELDS: readonly SeoFingerprintField[] = [
  'title',
  'description',
  'h1',
];

/** Empreinte déterministe d'un seul champ de balise. */
export interface SeoFieldFingerprint {
  field: SeoFingerprintField;
  /** Texte émis BRUT (verbatim, byte-exact). */
  raw: string;
  /** `normalizeSeoText(raw)` — accent/casse/espaces unifiés (SoT @repo/seo-roles). */
  normalized: string;
  /** sha256(raw) — collision EXACTE = signal HARD. */
  exactHash: string;
  /** sha256(normalized) — collision normalisée = signal diagnostic (non-HARD). */
  normalizedHash: string;
  /** Tokens triés + uniques (near-dup lexical Jaccard JS — analyzer pg_trgm séparé). */
  tokens: string[];
}

/** Empreinte d'une page (triplet title/description/h1) + provenance surface/entité. */
export interface SeoPageFingerprint {
  surface: ResolvedPageSeo['surface'];
  entityKey: string;
  fields: Record<SeoFingerprintField, SeoFieldFingerprint>;
  version: string;
}

export class SeoFingerprintCore {
  /** sha256 hex déterministe (UTF-8), même primitive que `R2CatalogSignatureService`. */
  static sha256(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }

  /**
   * Empreinte d'un champ : raw + normalized + 2 hashes + tokens triés/uniques.
   *
   * `''` est une valeur LÉGITIME (balise manquante → COVERAGE_GAP en aval). En revanche
   * un non-string (null/undefined depuis un resolver dégradé) est une **violation de contrat** :
   * on **échoue bruyamment** plutôt que de coercer en `''` silencieusement (sinon tous les
   * champs malformés collisionneraient sur le même `sha256('')` sans signal — no-silent-fallback).
   * Branche inatteignable via le type `string`, donc assertion défensive à coût nul.
   */
  static computeField(
    field: SeoFingerprintField,
    rawValue: string,
  ): SeoFieldFingerprint {
    if (typeof rawValue !== 'string') {
      throw new Error(
        `SeoFingerprintCore.computeField: champ "${field}" — value doit être un string, ` +
          `reçu ${rawValue === null ? 'null' : typeof rawValue}. Un ResolvedSeoField dégradé ` +
          `porte un string (même ''), jamais null/undefined (no-silent-fallback).`,
      );
    }
    const raw = rawValue;
    const normalized = normalizeSeoText(raw);
    const tokens = [...new Set(tokenize(raw))].sort();

    return {
      field,
      raw,
      normalized,
      exactHash: SeoFingerprintCore.sha256(raw),
      normalizedHash: SeoFingerprintCore.sha256(normalized),
      tokens,
    };
  }

  /** Empreinte d'une page complète depuis un `ResolvedPageSeo` (extension, pas ré-extraction). */
  static compute(page: ResolvedPageSeo): SeoPageFingerprint {
    return {
      surface: page.surface,
      entityKey: page.entityKey,
      fields: {
        title: SeoFingerprintCore.computeField('title', page.title.value),
        description: SeoFingerprintCore.computeField(
          'description',
          page.description.value,
        ),
        h1: SeoFingerprintCore.computeField('h1', page.h1.value),
      },
      version: SEO_FINGERPRINT_VERSION,
    };
  }

  /** Liste ordonnée des champs couverts (utilitaire pour les itérations déterministes). */
  static fields(): readonly SeoFingerprintField[] {
    return FINGERPRINT_FIELDS;
  }

  /**
   * Collision EXACTE (HARD) entre deux empreintes de champ — seul signal bloquant
   * avant la calibration des seuils near-dup (P-7).
   */
  static isExactCollision(
    a: SeoFieldFingerprint,
    b: SeoFieldFingerprint,
  ): boolean {
    return a.exactHash === b.exactHash;
  }

  /**
   * Collision NORMALISÉE (accent/casse/espaces) — diagnostic, jamais HARD par elle-même.
   * Deux balises « Filtre à huile » / « FILTRE A HUILE » collisionnent ici mais pas en exact.
   */
  static isNormalizedCollision(
    a: SeoFieldFingerprint,
    b: SeoFieldFingerprint,
  ): boolean {
    return a.normalizedHash === b.normalizedHash;
  }

  /**
   * Jaccard de tokens en JS — proximité LEXICALE pure (report-only, jamais HARD).
   *
   * NB : le near-dup de production passe par `SeoNearDuplicateAnalyzer` (pg_trgm,
   * DB/offline). Ce Jaccard JS sert au cœur pur (tests, pré-tri offline), pas au gate dur.
   * Retourne [0,1] ; deux ensembles vides → 0 (même convention que `jaccardOverlap`).
   */
  static tokenJaccard(a: SeoFieldFingerprint, b: SeoFieldFingerprint): number {
    const setA = new Set(a.tokens);
    const setB = new Set(b.tokens);
    if (setA.size === 0 && setB.size === 0) return 0;

    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
