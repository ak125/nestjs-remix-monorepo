import { createHash } from 'node:crypto';
import type { DiffSample } from './types';

export type Fingerprint = NonNullable<DiffSample['v4_fingerprint']>;

export function hashContent(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

export function normalizeForHash(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function makeFingerprint(input: { title: string; h1: string; content: string; canonical: string; robots: string }): Fingerprint {
  return {
    title_hash: hashContent(normalizeForHash(input.title)),
    h1_hash: hashContent(normalizeForHash(input.h1)),
    content_hash: hashContent(normalizeForHash(input.content)),
    canonical: input.canonical,
    robots: input.robots,
  };
}

export function computeDiffVerdict(current: Fingerprint, v4: Fingerprint | null): DiffSample['diff_verdict'] {
  if (v4 === null) return 'v4_unavailable';
  if (
    current.title_hash === v4.title_hash &&
    current.h1_hash === v4.h1_hash &&
    current.content_hash === v4.content_hash &&
    current.canonical === v4.canonical &&
    current.robots === v4.robots
  ) {
    return 'exact_match';
  }
  const diffs = [
    current.title_hash !== v4.title_hash,
    current.h1_hash !== v4.h1_hash,
    current.content_hash !== v4.content_hash,
  ].filter(Boolean).length;
  return diffs >= 2 ? 'divergent' : 'similar';
}

/**
 * Sample contract (sample-urls.json) — schéma aligné aux contrats HTTP réels :
 *   - GET /api/rm/page-v2 attend `?gamme_id=NUM&vehicle_id=NUM&limit=NUM`
 *   - POST /api/seo-dynamic-v4/generate-complete attend body { pgId, typeId, variables }
 *
 * D'où les champs gamme_id/vehicle_id (RM) + pgId/typeId/variables (V4) dans chaque sample.
 */
export interface DiffSampleInput {
  url: string;
  surface_key: string;
  gamme_id: number;
  vehicle_id: number;
  pgId: number;
  typeId: number;
  variables: Record<string, unknown>;
  category: string;
}

export interface DiffOptions {
  baseUrl: string;
  rmEndpoint: string; // ex: '/api/rm/page-v2'
  v4Endpoint: string; // ex: '/api/seo-dynamic-v4/generate-complete'
  samples: DiffSampleInput[];
  fetchImpl?: typeof fetch;
}

export async function runDiffVolet(opts: DiffOptions): Promise<DiffSample[]> {
  const fetcher = opts.fetchImpl ?? fetch;
  const out: DiffSample[] = [];
  for (const sample of opts.samples) {
    const current = await fetchSeoFromRm(fetcher, opts.baseUrl, opts.rmEndpoint, sample);
    const v4 = await fetchSeoFromV4(fetcher, opts.baseUrl, opts.v4Endpoint, sample);
    out.push({
      url: sample.url,
      surface_key: sample.surface_key,
      current_fingerprint: current,
      v4_fingerprint: v4,
      diff_verdict: computeDiffVerdict(current, v4),
    });
  }
  return out;
}

async function fetchSeoFromRm(
  fetcher: typeof fetch,
  baseUrl: string,
  rmEndpoint: string,
  sample: DiffSampleInput,
): Promise<Fingerprint> {
  const apiUrl = new URL(rmEndpoint, baseUrl);
  apiUrl.searchParams.set('gamme_id', String(sample.gamme_id));
  apiUrl.searchParams.set('vehicle_id', String(sample.vehicle_id));
  apiUrl.searchParams.set('limit', '200');
  try {
    const res = await fetcher(apiUrl.toString());
    if (!res.ok) {
      return makeFingerprint({ title: '', h1: '', content: '', canonical: '', robots: `rm_${res.status}` });
    }
    const json = (await res.json()) as {
      seo?: { title?: string; h1?: string; description?: string; canonical?: string; robots?: string };
    };
    const seo = json.seo ?? {};
    return makeFingerprint({
      title: seo.title ?? '',
      h1: seo.h1 ?? '',
      content: seo.description ?? '',
      canonical: seo.canonical ?? '',
      robots: seo.robots ?? '',
    });
  } catch {
    return makeFingerprint({ title: '', h1: '', content: '', canonical: '', robots: 'rm_fetch_error' });
  }
}

async function fetchSeoFromV4(
  fetcher: typeof fetch,
  baseUrl: string,
  v4Endpoint: string,
  sample: DiffSampleInput,
): Promise<Fingerprint | null> {
  try {
    const res = await fetcher(new URL(v4Endpoint, baseUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pgId: sample.pgId,
        typeId: sample.typeId,
        variables: sample.variables,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { title?: string; h1?: string; content?: string; preview?: string; canonical?: string; robots?: string };
      title?: string;
      h1?: string;
      content?: string;
      preview?: string;
      canonical?: string;
      robots?: string;
    };
    // V4 réponse : champs au top-level OU enveloppés dans .data — supporte les 2.
    const seo = json.data ?? json;
    return makeFingerprint({
      title: seo.title ?? '',
      h1: seo.h1 ?? '',
      content: seo.content ?? seo.preview ?? '',
      canonical: seo.canonical ?? '',
      robots: seo.robots ?? '',
    });
  } catch {
    return null;
  }
}
