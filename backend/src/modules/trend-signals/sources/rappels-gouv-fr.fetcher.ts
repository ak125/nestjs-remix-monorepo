/**
 * rappels.gouv.fr fetcher — light public-source ingestion for `__trend_signals`.
 *
 * Cf. spec docs/superpowers/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md §4.6
 * Task 1.10 — middle-ground trend signals. NO auto content gen, signal-only.
 *
 * Graceful degradation : tout échec (network, non-OK, JSON malformé) renvoie [].
 * Le caller (TrendSignalsService) écrit ce qu'il a, jamais d'exception.
 */

export type TrendSignalSource =
  | 'rappels_gouv_fr'
  | 'obd_codes_frequent'
  | 'saisonnalite_ct';

export type TrendSignalRow = {
  source: TrendSignalSource;
  label: string;
  freq: number | null;
  link: string | null;
  metadata: Record<string, unknown>;
};

const API_URL =
  'https://data.economie.gouv.fr/api/records/1.0/search/?dataset=rappel-conso-marchandises-automobile&rows=50';

export async function fetchRappelsGouvFr(
  opts: { fetch?: typeof globalThis.fetch } = {},
): Promise<TrendSignalRow[]> {
  const fetcher = opts.fetch ?? globalThis.fetch;
  try {
    const res = await fetcher(API_URL);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      records?: Array<{ fields?: Record<string, unknown> }>;
    };
    return (data.records ?? []).map((r) => ({
      source: 'rappels_gouv_fr' as const,
      label: `${r.fields?.modele_commercial ?? '?'} — ${r.fields?.nature_du_defaut ?? '?'}`,
      freq: null,
      link: API_URL,
      metadata: r.fields ?? {},
    }));
  } catch {
    return [];
  }
}
