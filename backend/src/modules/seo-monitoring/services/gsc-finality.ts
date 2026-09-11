/**
 * Finalité des jours GSC — fonctions PURES (no I/O).
 *
 * POURQUOI : une requête Search Analytics en `dataState` par défaut (`final`)
 * renvoie 0 ligne pour un jour pas encore finalisé ; l'ancien fetcher écrivait
 * alors `property_total = 0`, indiscernable d'un vrai jour sans trafic.
 *
 * Contrat API (searchconsole v1, `Schema$Metadata`) : `firstIncompleteDate` n'est
 * renseigné que si `dataState = 'all'`, groupé par `date`, ET si la plage contient
 * des jours incomplets. La sonde se termine donc sur la veille UTC, normalement
 * encore incomplète : 1 seul appel par run couvre toute la plage planifiée.
 * Capture 2026-09-11 (googleapis 164.1.0, lecture seule) : firstIncompleteDate =
 * J-2 UTC ; la même requête sans `dataState: 'all'` ne renvoie AUCUNE metadata.
 * Fin effective d'une reprise = veille de firstIncompleteDate, jamais une ancre
 * fixe (« veille », « J-2 ») ; metadata absente → aucune finalité supposée.
 *
 *   jour > fin de sonde | jour >= firstIncompleteDate  → skip_not_final (0 écriture)
 *   jour final + données                               → fetch (preuve : metadata)
 *   jour final + aucune donnée                         → real_zero (zéro explicite)
 *   metadata absente + données                         → fetch, commit SEULEMENT si
 *                                                        la requête `final` renvoie des lignes
 *   metadata absente + aucune donnée                   → skip_finality_unknown (0 écriture)
 */

export interface GscFinalityProbe {
  /** Dernier jour inclus dans la sonde. */
  endDate: string;
  /** Premier jour encore en collecte (null si l'API ne l'a pas renvoyé). */
  firstIncompleteDate: string | null;
  /** Jours ayant au moins une impression dans la sonde `dataState: 'all'`. */
  datesWithData: ReadonlySet<string>;
}

export interface GscFinalityProbeResponse {
  rows?: Array<{
    keys?: string[] | null;
    impressions?: number | null;
  }> | null;
  metadata?: { firstIncompleteDate?: string | null } | null;
}

export function parseFinalityProbe(
  resp: GscFinalityProbeResponse,
  endDate: string,
): GscFinalityProbe {
  const datesWithData = new Set<string>();
  for (const row of resp.rows ?? []) {
    const date = row.keys?.[0];
    if (date && (row.impressions ?? 0) > 0) datesWithData.add(date);
  }
  return {
    endDate,
    firstIncompleteDate: resp.metadata?.firstIncompleteDate ?? null,
    datesWithData,
  };
}

export type GscDayDecision =
  | { kind: 'fetch'; finalityProof: 'metadata' | 'final_rows_required' }
  | { kind: 'real_zero' }
  | { kind: 'skip_not_final' }
  | { kind: 'skip_finality_unknown' };

export function resolveGscDayDecision(
  date: string,
  probe: GscFinalityProbe,
): GscDayDecision {
  if (date > probe.endDate) return { kind: 'skip_not_final' };
  const hasData = probe.datesWithData.has(date);
  if (probe.firstIncompleteDate) {
    if (date >= probe.firstIncompleteDate) return { kind: 'skip_not_final' };
    return hasData
      ? { kind: 'fetch', finalityProof: 'metadata' }
      : { kind: 'real_zero' };
  }
  return hasData
    ? { kind: 'fetch', finalityProof: 'final_rows_required' }
    : { kind: 'skip_finality_unknown' };
}
