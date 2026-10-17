/**
 * L0 — Golda subscriber portal: page parser + request allowlist (pure, zero I/O).
 *
 * The `golda-tariff-fetch` worker reads tariff pages (`/tarifs/fiche.php?id=N`)
 * and downloads the COMPLETE CSV of each publication. This module holds what
 * the worker must get exactly right without a browser:
 *   - `parseGoldaFichePage`: one fiche page → its publications (current `tavi`,
 *     next `tapr`), dates, "Tarif complet" reference count and CSV link. Any
 *     structure it does not recognise throws `GoldaPageFormatError` — never a
 *     guess, never a partial result.
 *   - `goldaRequestVerdict`: the ALLOWLIST every browser request and every
 *     download goes through. Everything not listed is refused (fail-closed):
 *     the portal also serves links that write on the subscriber account
 *     (authorization removal, access requests, alerts, reviews, logout).
 *   - `goldaCsvDownloadUrl`: the download URL, rebuilt from validated integers
 *     (the page's own href is never followed as-is).
 *
 * Measured on the recon captures of 16 fiche pages; the captures stay outside
 * this public repo.
 */
import { decodeHtmlEntities } from '../../../utils/html-entities';

/** The only origin the worker talks to (credentials included). */
export const GOLDA_ORIGIN = 'https://www.golda.fr';
const GOLDA_HOST = 'www.golda.fr';

export type GoldaPublicationKind = 'tavi' | 'tapr';
/** Link title on the fiche page: public tariff, protected+granted, protected+not granted. */
export type GoldaCsvAccess = 'public' | 'authorized' | 'protected';
export type GoldaProtect = 'mdp' | 'nomdp';

export interface GoldaCsvLink {
  idt: number;
  idv: number;
  protect: GoldaProtect;
  access: GoldaCsvAccess;
}

export interface GoldaPublication {
  kind: GoldaPublicationKind;
  /** Date the tariff applies from (`Tarif en vigueur au` / `Prochain tarif au`), ISO. */
  applicationDate: string;
  firstPublished: string;
  lastUpdated: string | null;
  /** "Tarif complet" reference count shown on the page (Golda counts non-SUP lines). */
  completCount: number;
  /** `null` when the "Tarif complet" row offers no CSV link. */
  csv: GoldaCsvLink | null;
}

export interface GoldaFichePage {
  ficheId: number;
  title: string;
  publications: GoldaPublication[];
}

/** The page is not a fiche page this parser knows: the worker skips the fiche. */
export class GoldaPageFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoldaPageFormatError';
  }
}

const SECTIONS: Record<
  GoldaPublicationKind,
  { heading: string; summary: string }
> = {
  tavi: { heading: 'Tarif en vigueur', summary: 'Tarif en vigueur' },
  tapr: { heading: 'Prochain tarif', summary: 'Prochain tarif' },
};

const ACCESS_BY_TITLE: Record<string, GoldaCsvAccess> = {
  Télécharger: 'public',
  'Accès autorisé': 'authorized',
  'Accès protégé': 'protected',
};

const text = (html: string): string =>
  decodeHtmlEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/[\s ]+/g, ' ')
    .trim();

/** `DD/MM/YYYY` → `YYYY-MM-DD`, only for a real calendar day. */
function isoDate(ddmmyyyy: string, what: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy);
  if (!m) throw new GoldaPageFormatError(`${what}: not a DD/MM/YYYY date`);
  const [, d, mo, y] = m;
  const t = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (
    t.getUTCFullYear() !== Number(y) ||
    t.getUTCMonth() !== Number(mo) - 1 ||
    t.getUTCDate() !== Number(d)
  )
    throw new GoldaPageFormatError(`${what}: not a calendar day`);
  return `${y}-${mo}-${d}`;
}

const POSITIVE_INT = /^[1-9]\d{0,9}$/;

export interface GoldaDownloadParams {
  idt: number;
  idv: number;
  kind: GoldaPublicationKind;
  protect: GoldaProtect;
}

/**
 * Strict reading of a CSV download URL (absolute, or relative to `/tarifs/`):
 * exactly the keys idt, idv, format=csv, type, protect, each once. `null` for
 * anything else — including the Excel and delta-file links.
 */
export function parseGoldaDownloadUrl(
  href: string,
): GoldaDownloadParams | null {
  let u: URL;
  try {
    u = new URL(href, `${GOLDA_ORIGIN}/tarifs/`);
  } catch {
    return null;
  }
  if (
    u.origin !== GOLDA_ORIGIN ||
    u.pathname !== '/tarifs/download.php' ||
    u.hash
  )
    return null;
  const keys = [...u.searchParams.keys()];
  const want = ['idt', 'idv', 'format', 'type', 'protect'];
  if (
    keys.length !== want.length ||
    want.some((k) => u.searchParams.getAll(k).length !== 1)
  )
    return null;
  const p = (k: string): string => u.searchParams.get(k) ?? '';
  if (!POSITIVE_INT.test(p('idt')) || !POSITIVE_INT.test(p('idv'))) return null;
  if (p('format') !== 'csv') return null;
  const kind = p('type');
  const protect = p('protect');
  if (kind !== 'tavi' && kind !== 'tapr') return null;
  if (protect !== 'mdp' && protect !== 'nomdp') return null;
  return { idt: Number(p('idt')), idv: Number(p('idv')), kind, protect };
}

/** The download URL, rebuilt from validated integers in the page's own parameter order. */
export function goldaCsvDownloadUrl(p: GoldaDownloadParams): string {
  for (const [k, v] of [
    ['idt', p.idt],
    ['idv', p.idv],
  ] as const)
    if (!Number.isSafeInteger(v) || v <= 0) throw new Error(`invalid ${k}`);
  if (p.kind !== 'tavi' && p.kind !== 'tapr') throw new Error('invalid type');
  if (p.protect !== 'mdp' && p.protect !== 'nomdp')
    throw new Error('invalid protect');
  return `${GOLDA_ORIGIN}/tarifs/download.php?idt=${p.idt}&idv=${p.idv}&format=csv&type=${p.kind}&protect=${p.protect}`;
}

export function goldaFicheUrl(ficheId: number): string {
  if (!Number.isSafeInteger(ficheId) || ficheId <= 0)
    throw new Error('invalid fiche id');
  return `${GOLDA_ORIGIN}/tarifs/fiche.php?id=${ficheId}`;
}

/** One publication section, from its `<a name="…">` anchor to the end of its table. */
function parseSection(
  html: string,
  kind: GoldaPublicationKind,
  ficheId: number,
): GoldaPublication {
  const { heading, summary } = SECTIONS[kind];
  const anchors = html.split(`<a name="${kind}"></a>`);
  if (anchors.length > 2)
    throw new GoldaPageFormatError(`${kind}: anchor repeated`);
  const after = anchors[1];
  const end = after.indexOf('</table>');
  if (end < 0) throw new GoldaPageFormatError(`${kind}: no table`);
  const section = after.slice(0, end);
  if (section.includes('<a name="'))
    throw new GoldaPageFormatError(
      `${kind}: next section starts before this table`,
    );

  const h2 = /^\s*<h2>([^<]*)<\/h2>/.exec(section);
  if (!h2)
    throw new GoldaPageFormatError(
      `${kind}: heading not right after the anchor`,
    );
  const hm = new RegExp(`^${heading} au (\\d{2}/\\d{2}/\\d{4})$`).exec(
    text(h2[1]),
  );
  if (!hm) throw new GoldaPageFormatError(`${kind}: unexpected heading`);
  const applicationDate = isoDate(hm[1], `${kind} application date`);

  const pub =
    /Date initiale de publication\s*:\s*(\d{2}\/\d{2}\/\d{4})(\s*-\s*Derni(?:è|&egrave;)re mise (?:à|&agrave;) jour\s*:\s*(\d{2}\/\d{2}\/\d{4}))?\s*</.exec(
      section,
    );
  if (!pub) throw new GoldaPageFormatError(`${kind}: no publication date`);
  // The label only: the supplier's free text may say "Mise à jour du tarif …".
  if (!pub[3] && /Derni(?:è|e)re mise (?:à|a) jour/i.test(text(section)))
    throw new GoldaPageFormatError(`${kind}: update date not recognised`);
  const firstPublished = isoDate(pub[1], `${kind} first publication`);
  const lastUpdated = pub[3] ? isoDate(pub[3], `${kind} last update`) : null;

  const tables = section.split(/<table\b/);
  if (tables.length !== 2)
    throw new GoldaPageFormatError(`${kind}: expected one table`);
  if (!new RegExp(`^[^>]*\\ssummary="${summary}"`).test(tables[1]))
    throw new GoldaPageFormatError(`${kind}: table summary mismatch`);

  const rows = tables[1].split(/<tr\b/).slice(1);
  const complet = rows.filter((r) => {
    const first = /<td\b[^>]*>([\s\S]*?)<\/td>/.exec(r);
    return first !== null && text(first[1]) === 'Tarif complet';
  });
  if (complet.length !== 1)
    throw new GoldaPageFormatError(
      `${kind}: "Tarif complet" row not found once`,
    );
  const cells = [...complet[0].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(
    (m) => m[1],
  );
  const countText = text(cells[1] ?? '').replace(/ /g, '');
  if (!/^\d{1,9}$/.test(countText))
    throw new GoldaPageFormatError(`${kind}: reference count unreadable`);
  const completCount = Number(countText);

  const csvLinks = [...complet[0].matchAll(/<a\s([^>]*)>/g)]
    .map((m) => m[1])
    .filter((attrs) => /\bhref="[^"]*format=csv/.test(attrs));
  if (csvLinks.length > 1)
    throw new GoldaPageFormatError(`${kind}: several CSV links`);
  if (csvLinks.length === 0)
    return {
      kind,
      applicationDate,
      firstPublished,
      lastUpdated,
      completCount,
      csv: null,
    };

  const href = /\bhref="([^"]*)"/.exec(csvLinks[0]);
  const params = href
    ? parseGoldaDownloadUrl(decodeHtmlEntities(href[1]))
    : null;
  if (!params)
    throw new GoldaPageFormatError(`${kind}: CSV link not recognised`);
  if (params.idt !== ficheId)
    throw new GoldaPageFormatError(`${kind}: CSV link for another fiche`);
  if (params.kind !== kind)
    throw new GoldaPageFormatError(`${kind}: CSV link for another publication`);
  const title = /\btitle="([^"]*)"/.exec(csvLinks[0]);
  const access = title ? ACCESS_BY_TITLE[text(title[1])] : undefined;
  if (!access)
    throw new GoldaPageFormatError(`${kind}: CSV link title not recognised`);
  if ((params.protect === 'nomdp') !== (access === 'public'))
    throw new GoldaPageFormatError(
      `${kind}: link title and protection disagree`,
    );

  return {
    kind,
    applicationDate,
    firstPublished,
    lastUpdated,
    completCount,
    csv: { idt: params.idt, idv: params.idv, protect: params.protect, access },
  };
}

/**
 * Parse one fiche page. Requires one `<h1>` title and a current-tariff (`tavi`)
 * section; the next-tariff (`tapr`) section is optional.
 */
export function parseGoldaFichePage(
  html: string,
  ficheId: number,
): GoldaFichePage {
  if (!Number.isSafeInteger(ficheId) || ficheId <= 0)
    throw new Error('invalid fiche id');
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  if (h1.length !== 1) throw new GoldaPageFormatError('expected one <h1>');
  const title = text(h1[0][1]);
  if (!title) throw new GoldaPageFormatError('empty title');
  if (!html.includes('<a name="tavi"></a>'))
    throw new GoldaPageFormatError('no current tariff section');
  const publications = [parseSection(html, 'tavi', ficheId)];
  if (html.includes('<a name="tapr"></a>'))
    publications.push(parseSection(html, 'tapr', ficheId));
  else if (
    /\b(?:name|id)\s*=\s*["']?tapr\b/i.test(html) ||
    text(html).includes(SECTIONS.tapr.heading)
  )
    throw new GoldaPageFormatError('tapr: section not recognised');
  return { ficheId, title, publications };
}

// ───────────────────────── request allowlist ─────────────────────────

/** `anon` before the credential submit, `login` during it, `read` after it. */
export type GoldaPhase = 'anon' | 'login' | 'read';

export interface GoldaRequest {
  url: string;
  method: string;
  /** Playwright `resourceType()`; the worker passes `download` for its own CSV fetches. */
  resourceType: string;
}

export type GoldaVerdict =
  | { allowed: true }
  | { allowed: false; reason: string };

const STATIC_TYPES = new Set([
  'stylesheet',
  'script',
  'image',
  'font',
  'media',
]);
/** No dot in a directory name: `/x.php/a.gif` (PATH_INFO) would run `x.php`. */
const STATIC_PATH =
  /^\/(?:[\w-]+\/)*[\w.-]+\.(?:css|js|gif|png|jpe?g|svg|ico|webp|woff2?|ttf|eot)$/i;
/** A script extension anywhere in the path (`x.php.gif` runs on a multi-extension server). */
const SCRIPT_EXT = /\.(?:php\d?|phtml|phar|cgi|pl|aspx?|jsp)(?:[./]|$)/i;
/** Pages the worker opens (navigation targets). */
const PAGE_PATHS: Array<(u: URL) => boolean> = [
  (u) => u.pathname === '/espace-abonnes.php' && u.search === '',
  (u) =>
    u.pathname === '/tarifs/fiche.php' && /^\?id=[1-9]\d{0,9}$/.test(u.search),
];
/** Where a navigation may land after a server redirect (logged-out landing included). */
const LANDING_PATHS: Array<(u: URL) => boolean> = [
  ...PAGE_PATHS,
  (u) => (u.pathname === '/' || u.pathname === '/index.php') && u.search === '',
  (u) => u.pathname === '/index.php' && u.search === '?statut=notvalid',
];

function goldaUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (
      u.protocol !== 'https:' ||
      u.host !== GOLDA_HOST ||
      u.username ||
      u.password
    )
      return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * Allowlist for one request. Allowed:
 *   - the credential POST `/js_treat_cx.php`, in the `login` phase only;
 *   - GET of the two worker pages (document);
 *   - GET of a CSV download URL (`download` — the worker's own fetch);
 *   - GET of same-host static assets by type AND extension.
 * Everything else is refused: other hosts, other methods, other paths, XHR.
 */
export function goldaRequestVerdict(
  req: GoldaRequest,
  phase: GoldaPhase,
): GoldaVerdict {
  const u = goldaUrl(req.url);
  if (!u) return { allowed: false, reason: 'host' };
  if (req.method === 'POST') {
    return phase === 'login' &&
      u.pathname === '/js_treat_cx.php' &&
      u.search === ''
      ? { allowed: true }
      : { allowed: false, reason: 'write' };
  }
  if (req.method !== 'GET') return { allowed: false, reason: 'method' };
  if (u.hash) return { allowed: false, reason: 'path' };
  if (req.resourceType === 'document')
    return PAGE_PATHS.some((ok) => ok(u))
      ? { allowed: true }
      : { allowed: false, reason: 'path' };
  if (req.resourceType === 'download')
    return phase === 'read' && parseGoldaDownloadUrl(u.href) !== null
      ? { allowed: true }
      : { allowed: false, reason: 'path' };
  if (STATIC_TYPES.has(req.resourceType))
    return STATIC_PATH.test(u.pathname) &&
      !SCRIPT_EXT.test(u.pathname) &&
      u.search === ''
      ? { allowed: true }
      : { allowed: false, reason: 'path' };
  return { allowed: false, reason: 'type' };
}

/** Final URL of a page after redirects (redirect hops bypass the browser route guard). */
export function isGoldaLandingUrl(raw: string): boolean {
  const u = goldaUrl(raw);
  return u !== null && !u.hash && LANDING_PATHS.some((ok) => ok(u));
}

/** Logged-out landing: Golda redirects a page that needs a session to `?statut=notvalid`. */
export function isGoldaLoggedOutUrl(raw: string): boolean {
  const u = goldaUrl(raw);
  return u !== null && /[?&]statut=notvalid\b/.test(u.search);
}
