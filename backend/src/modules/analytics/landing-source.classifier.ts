/**
 * First-party landing attribution classifier (Étape 0 — PR-INST-1).
 * Pure function: (Referer + UTM/click-id params) → closed-enum LandingSource.
 * Complements GA4 (ga_client_id) — survives consent refusal / ad-blockers.
 */

export type LandingSource =
  | 'organic'
  | 'paid'
  | 'social'
  | 'email'
  | 'referral'
  | 'direct'
  | 'campaign';

export interface LandingAttribution {
  source: LandingSource;
  /** URL pathname only — never the query string (PII-safe). */
  path: string;
  /** ISO timestamp of the first hit. */
  firstSeenAt: string;
}

const PAID_CLICK_IDS = ['gclid', 'gbraid', 'wbraid', 'msclkid'];
const PAID_MEDIUMS = [
  'cpc',
  'ppc',
  'paid',
  'paidsearch',
  'paid-search',
  'display',
];

const SEARCH_HOST_RE =
  /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|qwant|yandex|baidu)\./i;
const SOCIAL_HOST_RE =
  /(^|\.)(facebook|instagram|twitter|linkedin|pinterest|youtube|tiktok|reddit|snapchat)\.|(^|\.)t\.co$|(^|\.)x\.com$|(^|\.)lnkd\.in$/i;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function classifyLandingSource(input: {
  referer?: string;
  query?: Record<string, unknown>;
  selfHost: string;
}): LandingSource {
  const q = input.query ?? {};
  const utmMedium = str(q.utm_medium)?.toLowerCase();
  const utmSource = str(q.utm_source);
  const refHost = hostOf(input.referer);
  const selfHost = input.selfHost.toLowerCase();

  // 1. Paid: explicit click ids or paid medium win over everything.
  if (PAID_CLICK_IDS.some((k) => str(q[k]))) return 'paid';
  if (utmMedium && PAID_MEDIUMS.includes(utmMedium)) return 'paid';

  // 2. Email.
  if (utmMedium === 'email') return 'email';

  // 3. Social: explicit medium or known social referer.
  if (utmMedium === 'social') return 'social';
  if (refHost && SOCIAL_HOST_RE.test(refHost)) return 'social';

  // 4. Organic: explicit medium or known search-engine referer.
  if (utmMedium === 'organic') return 'organic';
  if (refHost && SEARCH_HOST_RE.test(refHost)) return 'organic';

  // 5. Tagged campaign with an otherwise-unknown source.
  if (utmSource) return 'campaign';

  // 6. External referral (not search/social/self).
  if (refHost && refHost !== selfHost) return 'referral';

  // 7. No signal: direct (includes internal navigation).
  return 'direct';
}
