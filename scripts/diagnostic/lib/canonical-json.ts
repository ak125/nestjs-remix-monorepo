/**
 * canonical-json — sérialisation déterministe + checksum (PR-2 Knowledge Reproducibility).
 *
 * PUR (aucune dépendance hors `node:crypto`) → testable sans DB.
 * Garantie : pour un même ENSEMBLE de lignes, le sha256 est stable quel que soit
 *  - l'ordre des clés d'un objet (trié récursivement),
 *  - l'ordre de retour des lignes par la DB (cf. `sortRows`).
 * L'ordre INTERNE d'un tableau de colonne (ex. evidence_for) est PRÉSERVÉ (sémantique métier).
 */
import { createHash } from "node:crypto";

/** Chaîne canonique : clés d'objet triées récursivement, ordre des tableaux préservé. */
export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") +
      "}"
    );
  }
  // null / number / boolean / string ; undefined → null
  return JSON.stringify(value ?? null);
}

/** Trie un tableau de lignes par leur forme canonique → ordre indépendant de la DB. */
export function sortRows<T>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ca = canonicalize(a);
    const cb = canonicalize(b);
    return ca < cb ? -1 : ca > cb ? 1 : 0;
  });
}

/** sha256 hex de la forme canonique. */
export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalize(value), "utf8").digest("hex");
}
