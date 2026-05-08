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

export interface DiffOptions {
  baseUrl: string;
  v4Endpoint: string;
  samples: Array<{ url: string; surface_key: string; endpoint_actuel: string; category: string }>;
  fetchImpl?: typeof fetch;
}

export async function runDiffVolet(opts: DiffOptions): Promise<DiffSample[]> {
  const fetcher = opts.fetchImpl ?? fetch;
  const out: DiffSample[] = [];
  for (const sample of opts.samples) {
    const current = await fetchSeoFromCurrent(fetcher, opts.baseUrl, sample);
    const v4 = await fetchSeoFromV4(fetcher, opts.baseUrl, sample, opts.v4Endpoint);
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

async function fetchSeoFromCurrent(
  fetcher: typeof fetch,
  baseUrl: string,
  sample: { url: string; endpoint_actuel: string },
): Promise<Fingerprint> {
  const apiUrl = new URL(sample.endpoint_actuel, baseUrl).toString();
  try {
    const res = await fetcher(`${apiUrl}?source_url=${encodeURIComponent(sample.url)}`);
    if (!res.ok) {
      return makeFingerprint({ title: '', h1: '', content: '', canonical: '', robots: 'unavailable' });
    }
    const json = (await res.json()) as { seo?: { title?: string; h1?: string; description?: string; canonical?: string; robots?: string } };
    const seo = json.seo ?? {};
    return makeFingerprint({
      title: seo.title ?? '',
      h1: seo.h1 ?? '',
      content: seo.description ?? '',
      canonical: seo.canonical ?? '',
      robots: seo.robots ?? '',
    });
  } catch {
    return makeFingerprint({ title: '', h1: '', content: '', canonical: '', robots: 'fetch_error' });
  }
}

async function fetchSeoFromV4(
  fetcher: typeof fetch,
  baseUrl: string,
  sample: { url: string; surface_key: string },
  v4Endpoint: string,
): Promise<Fingerprint | null> {
  try {
    const res = await fetcher(new URL(v4Endpoint, baseUrl).toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: sample.url, surface_key: sample.surface_key }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { title?: string; h1?: string; content?: string; canonical?: string; robots?: string };
    return makeFingerprint({
      title: json.title ?? '',
      h1: json.h1 ?? '',
      content: json.content ?? '',
      canonical: json.canonical ?? '',
      robots: json.robots ?? '',
    });
  } catch {
    return null;
  }
}
