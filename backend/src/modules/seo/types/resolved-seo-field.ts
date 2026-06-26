/**
 * ResolvedSeoField / ResolvedPageSeo — contrat typé du resolver SEO unifié (Phase 11).
 *
 * UN seul vocabulaire de provenance pour title/description/h1 sur toutes les surfaces
 * (R1/R2/R3/R8), produit par UNE cascade : projection_wiki → runtime_db →
 * legacy_switch_validated → fallback_deterministic. Cf. audit
 * `audit/seo-producer-chain-unified-verify-2026-06-26.md`.
 *
 * Statut actuel : introduit en SHADOW (observe-only) pour R1 title/desc. Le live reste
 * émis par le chemin legacy tant que le flip n'est pas owner-validé (cf. SeoFieldGate).
 */

/** Étage de la cascade unifiée ayant produit la valeur (la provenance, jamais silencieuse). */
export type SeoSourceStage =
  | 'projection_wiki'
  | 'runtime_db'
  | 'legacy_switch_validated'
  | 'fallback_deterministic';

/** Un champ SEO résolu + sa provenance complète (observable, fail-closed). */
export interface ResolvedSeoField<T = string> {
  value: T;
  sourceStage: SeoSourceStage;
  /** Niveau de vérité indicatif (2=draft validé, 1=legacy/dynamique, 0=fallback). */
  truthLevel: number;
  /** Identifiant de la source ayant gagné (nom de colonne/table), ou null. */
  sourceId: string | null;
  /** Cross-refs des sources WIKI (base du LINEAGE_PASS, vide tant que projection dark). */
  evidenceIds: string[];
  /** Version du resolver ayant produit la valeur (traçabilité). */
  resolverVersion: string;
  /** true si on a dû dégrader (jamais silencieux : degradeReason renseigné). */
  degraded: boolean;
  degradeReason: string | null;
}

/** Le triplet SEO d'une page résolu en une passe, avec sa surface + clé d'entité. */
export interface ResolvedPageSeo {
  title: ResolvedSeoField;
  description: ResolvedSeoField;
  h1: ResolvedSeoField;
  surface: 'R1' | 'R2' | 'R3' | 'R8';
  entityKey: string;
}
