/* eslint-disable no-console -- READ-ONLY Golda tariff downloader (ops CLI): the per-publication report to stdout IS its output */
/**
 * Golda tariff downloader — READ-ONLY on the subscriber portal. NO DB access.
 *
 * Logs in ONCE to the Golda subscriber area, opens the tariff page of each fiche
 * in GOLDA_TARIFF_IDS and downloads the COMPLETE CSV of every publication (the
 * current tariff, and the next one when announced) that the store does not hold
 * yet. Each download is checked BEFORE anything is stored: a zip with exactly one
 * CSV member (`extractGoldaTariffCsv`), read by `parseGoldaTariffCsv` — the parser
 * the import uses — and the fiche's "Tarif complet" count compared with the file.
 * Only a download that passes all three goes to
 * OUT_DIR/<slug>/<applicationDate>/<variant>/ (zip, `extrait/<csv>`,
 * `SOURCE.jsonl`); placement rules in `golda-tariff-store.ts`. A refused download
 * is kept as evidence under OUT_DIR/_fetch/refused/<run>/, which the store never
 * indexes. A stored file is never overwritten: a new version goes to a new folder.
 *
 * Read-only by construction: every browser request and every download goes
 * through the `goldaRequestVerdict` allowlist — the credential POST during login
 * only; GETs of the subscriber page, fiche pages, CSV downloads and same-host
 * static assets; everything else is aborted (account-writing links, other hosts,
 * XHR). Downloads do not follow redirects. Playwright does not route the redirect
 * hops of browser requests: each hop is checked against the same allowlist when
 * it is issued (a page may also land on a logged-out landing page), and a refused
 * hop — already sent, so reported, not aborted — stops the run. A tariff whose
 * password the account has not been granted is reported PROTECTED and never
 * requested.
 *
 * Env (required): GOLDA_USER, GOLDA_PASSWORD (backend/.env only, never committed),
 *   GOLDA_TARIFF_IDS (csv of fiche ids, e.g. "12,34"),
 *   OUT_DIR (the store root, absolute and existing, e.g. /opt/automecanik/data/tecdoc/golda).
 * Refused: DEBUG or PWDEBUG set — Playwright's debug log prints typed values and
 *   request headers without redaction.
 *
 * State in OUT_DIR/_fetch/: `.run.lock` (one run at a time), `logins.jsonl` (at
 * most 6 login attempts a day, each recorded before the credentials are sent),
 * `LOCK_LOGIN_*` (a refused login blocks every later run until a human removes
 * the file; LOCK_LOGIN_UNKNOWN is written before the credentials are sent and
 * removed once the session is confirmed), `runs/<ISO>.json` (statuses of the run,
 * written even when the run fails), `refused/`. No session is saved. Output never
 * contains a URL or a credential.
 *
 * Exit: 0 = every publication FETCHED or ALREADY_PRESENT; 2 = any other status,
 * or a refused redirect hop (see the report); 1 = fatal (lock, login, unreadable
 * store, unexpected error).
 *
 * Run: GOLDA_TARIFF_IDS=12,34 OUT_DIR=/opt/automecanik/data/tecdoc/golda \
 *      npx tsx -r dotenv/config backend/src/workers/golda-tariff-fetch.ts dotenv_config_path=backend/.env
 */
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import type { APIResponse, Browser, BrowserContext, Page } from 'playwright';
import {
  GOLDA_ORIGIN,
  GoldaPageFormatError,
  goldaCsvDownloadUrl,
  goldaFicheUrl,
  goldaRequestVerdict,
  isGoldaLandingUrl,
  isGoldaLoggedOutUrl,
  parseGoldaFichePage,
  type GoldaFichePage,
  type GoldaPhase,
  type GoldaPublication,
  type GoldaRequest,
} from '../modules/pricing/services/golda-portal';
import {
  extractGoldaTariffCsv,
  type GoldaCsvMember,
} from '../modules/pricing/services/golda-tariff-archive';
import {
  parseGoldaTariffCsv,
  type GoldaParseReport,
} from '../modules/pricing/services/golda-tariff-parse';
import {
  goldaSourceLine,
  goldaZipFileName,
  indexGoldaStore,
  planGoldaStore,
  type GoldaSourceFile,
  type GoldaStoreIndex,
} from '../modules/pricing/services/golda-tariff-store';

const ENTRY = `${GOLDA_ORIGIN}/espace-abonnes.php`;
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_LOGINS_PER_DAY = 6;
const LOGIN_LOCKS = [
  'LOCK_LOGIN_FAILED',
  'LOCK_LOGIN_CAPTCHA',
  'LOCK_LOGIN_UNKNOWN',
] as const;
/** Largest real zip ≈ 1.8 MB. */
const MAX_ZIP_BYTES = 50 * 1024 * 1024;
const PAUSE_MS: [number, number] = [2000, 4000];
const DOWNLOAD_TIMEOUT_MS = 180_000;

function req(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`missing required env ${k}`);
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pause = () =>
  sleep(PAUSE_MS[0] + Math.floor(Math.random() * (PAUSE_MS[1] - PAUSE_MS[0])));
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** Hides every form of the credentials, request-header lines carrying a session, then every URL. */
export function makeRedactor(secrets: string[]): (text: string) => string {
  const forms = new Set<string>();
  for (const s of secrets) {
    forms.add(s);
    forms.add(encodeURIComponent(s));
    forms.add(encodeURIComponent(s).replace(/%20/g, '+'));
    forms.add(new URLSearchParams({ s }).toString().slice(2));
    forms.add(JSON.stringify(s).slice(1, -1));
  }
  const list = [...forms].filter(Boolean).sort((a, b) => b.length - a.length);
  return (text) => {
    let t = text;
    for (const f of list) t = t.split(f).join('***');
    return t
      .replace(
        /^([\t -]*)(cookie|set-cookie|authorization)\s*:.*$/gim,
        '$1$2: ***',
      )
      .replace(/\bhttps?:\/\/[^\s"'<>)]+/gi, '<url>');
  };
}

/**
 * An error as text, without Playwright's "Call log" (it lists every request
 * header, the session cookie included); `stack` adds the stack frames.
 */
export function errorText(e: unknown, stack = false): string {
  if (!(e instanceof Error)) return String(e);
  const head = `${e.name}: ${e.message.split('\nCall log:')[0]}`;
  if (!stack) return head;
  const frames = (e.stack ?? '').split('\n').filter((l) => /^\s+at /.test(l));
  return [head, ...frames].join('\n');
}

/** Login attempts recorded in `logins.jsonl` on `day` (YYYY-MM-DD, UTC); an unreadable line is fatal. */
export function loginAttemptsOn(jsonl: string, day: string): number {
  let n = 0;
  for (const [i, line] of jsonl.split('\n').entries()) {
    if (line === '') continue;
    let rec: { ts?: unknown; outcome?: unknown } | null = null;
    try {
      rec = JSON.parse(line) as typeof rec;
    } catch {
      /* reported just below */
    }
    if (rec === null || typeof rec !== 'object' || typeof rec.ts !== 'string')
      throw new Error(
        `logins.jsonl line ${i + 1} unreadable: repair it by hand before any new login`,
      );
    if (rec.ts.startsWith(day) && rec.outcome === 'attempt') n++;
  }
  return n;
}

/** The fiche's "Tarif complet" count is the file's data lines minus its SUP (removed) lines. */
export function countVerdict(
  report: Pick<GoldaParseReport, 'dataLines' | 'rejectedLines' | 'byStatus'>,
  completCount: number,
): { ok: boolean; dataLines: number; sup: number; rejected: number } {
  const sup = report.byStatus.SUP;
  return {
    ok: report.dataLines - sup === completCount,
    dataLines: report.dataLines,
    sup,
    rejected: report.rejectedLines,
  };
}

/**
 * Verdict for a browser redirect hop (Playwright never routes hops): the
 * allowlist, plus the landing pages a page may be redirected to.
 */
export function redirectHopAllowed(
  r: GoldaRequest,
  phase: GoldaPhase,
): boolean {
  if (
    r.resourceType === 'document' &&
    r.method === 'GET' &&
    isGoldaLandingUrl(r.url)
  )
    return true;
  return goldaRequestVerdict(r, phase).allowed === true;
}

type Status =
  | 'FETCHED'
  | 'ALREADY_PRESENT'
  | 'PARSE_REFUSED'
  | 'COUNT_MISMATCH'
  | 'NO_CSV_LINK'
  | 'PROTECTED'
  | 'PAGE_FORMAT_UNKNOWN'
  | 'PAGE_NOT_REACHED'
  | 'SESSION_LOST'
  | 'NOT_RUN'
  | 'DOWNLOAD_FAILED'
  | 'HTML_RESPONSE'
  | 'FILE_NAME_REFUSED'
  | 'TOO_LARGE'
  | 'ARCHIVE_REFUSED'
  | 'STORE_CONFLICT'
  | 'STORE_WRITE_FAILED'
  | `HTTP_${number}`;

const OK: ReadonlySet<Status> = new Set<Status>(['FETCHED', 'ALREADY_PRESENT']);

interface Row {
  fiche: number;
  kind: string;
  status: Status;
  detail?: string;
  dir?: string;
  /** Where a refused download was kept, relative to OUT_DIR. */
  evidence?: string;
  applicationDate?: string;
  lastUpdated?: string | null;
  completCount?: number;
  dataLines?: number;
  sup?: number;
  rejected?: number;
}

function acquireRunLock(path: string): void {
  try {
    writeFileSync(
      path,
      `pid ${process.pid} since ${new Date().toISOString()}\n`,
      { flag: 'wx', mode: 0o600 },
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    throw new Error(
      `another golda-tariff-fetch run holds ${path} (${readFileSync(path, 'utf8').trim()}) — ` +
        `delete the file only if that run is dead`,
    );
  }
  process.on('exit', () => {
    try {
      unlinkSync(path);
    } catch {
      /* already removed */
    }
  });
  process.on('SIGINT', () => process.exit(130));
  process.on('SIGTERM', () => process.exit(143));
}

/** Every `<slug>/<date>/<variant>/SOURCE.jsonl` of the store (`_*` and `.*` entries skipped). */
function readStore(root: string): GoldaStoreIndex {
  const files: GoldaSourceFile[] = [];
  const dirs = (p: string) =>
    readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !/^[_.]/.test(d.name))
      .map((d) => d.name);
  for (const slug of dirs(root))
    for (const date of dirs(join(root, slug)))
      for (const variant of dirs(join(root, slug, date))) {
        const rel = `${slug}/${date}/${variant}/SOURCE.jsonl`;
        const abs = join(root, rel);
        if (existsSync(abs))
          files.push({ path: rel, content: readFileSync(abs, 'utf8') });
      }
  return indexGoldaStore(files);
}

class LoginGuard {
  constructor(
    private readonly dir: string,
    private readonly redact: (t: string) => string,
  ) {}

  assertAllowed(): void {
    for (const l of LOGIN_LOCKS)
      if (existsSync(join(this.dir, l)))
        throw new Error(
          `${l} present in the fetch state folder: no new login until a human removes it`,
        );
    const f = join(this.dir, 'logins.jsonl');
    const n = existsSync(f)
      ? loginAttemptsOn(
          readFileSync(f, 'utf8'),
          new Date().toISOString().slice(0, 10),
        )
      : 0;
    if (n >= MAX_LOGINS_PER_DAY)
      throw new Error(`${MAX_LOGINS_PER_DAY} login attempts already today`);
  }

  /** Right before the credentials leave: the attempt counts, and LOCK_LOGIN_UNKNOWN stays until the outcome is known. */
  begin(): void {
    this.assertAllowed();
    this.record('attempt');
    this.writeLock(
      'LOCK_LOGIN_UNKNOWN',
      'credential POST sent, outcome never confirmed (run interrupted?)',
    );
  }

  succeeded(): void {
    this.record('ok');
    unlinkSync(join(this.dir, 'LOCK_LOGIN_UNKNOWN'));
  }

  lock(name: (typeof LOGIN_LOCKS)[number], detail: string): never {
    this.writeLock(name, detail);
    if (name !== 'LOCK_LOGIN_UNKNOWN')
      rmSync(join(this.dir, 'LOCK_LOGIN_UNKNOWN'), { force: true });
    this.record(name, detail);
    throw new Error(
      `Golda login refused (${name}) — lock written, no new attempt`,
    );
  }

  private record(outcome: string, detail = ''): void {
    appendFileSync(
      join(this.dir, 'logins.jsonl'),
      JSON.stringify({
        ts: new Date().toISOString(),
        outcome,
        detail: this.redact(detail).slice(0, 200),
      }) + '\n',
      { mode: 0o600 },
    );
  }

  private writeLock(name: (typeof LOGIN_LOCKS)[number], detail: string): void {
    writeFileSync(
      join(this.dir, name),
      `${new Date().toISOString()} ${this.redact(detail).slice(0, 300)}\n`,
      { mode: 0o600 },
    );
  }
}

const urlPath = (raw: string): string => {
  try {
    const u = new URL(raw);
    return u.origin === GOLDA_ORIGIN ? u.pathname : '<other host>';
  } catch {
    return '<unparsable>';
  }
};

/** Fail-closed: exactly one "remember me" box, readable, and not ticked. */
async function assertRememberMeOff(page: Page): Promise<void> {
  const box = page.locator('#cx_cookie');
  if ((await box.count()) !== 1)
    throw new Error(
      'login form changed: "remember me" box not found exactly once — refusing to log in',
    );
  if (await box.isChecked({ timeout: 5_000 }))
    throw new Error('"remember me" is ticked: refusing to log in');
}

async function login(
  page: Page,
  setPhase: (p: GoldaPhase) => void,
  creds: { user: string; password: string },
  guard: LoginGuard,
): Promise<void> {
  await page.goto(ENTRY, { waitUntil: 'domcontentloaded' });
  if (page.url() === ENTRY) return; // already in session (never the case without a saved session)
  if (!isGoldaLandingUrl(page.url()))
    throw new Error(`unexpected page before login: ${urlPath(page.url())}`);
  const form = page.locator('form#login');
  if (
    !(await form
      .locator('#cx_mdp')
      .isVisible()
      .catch(() => false))
  )
    await page.locator('#js_connexion_member_link').click();
  await form.locator('#cx_login').waitFor({ state: 'visible' });
  if (!isGoldaLandingUrl(page.url()))
    throw new Error(`unexpected page before login: ${urlPath(page.url())}`);
  await assertRememberMeOff(page);
  await form.locator('#cx_login').fill(creds.user);
  await form.locator('#cx_mdp').fill(creds.password);
  await assertRememberMeOff(page);

  // The form's own button is disabled by the site's script: the jQuery UI dialog's
  // "Valider" button POSTs /js_treat_cx.php (answers: `unknown_error` = refused).
  guard.begin();
  setPhase('login');
  const answerP = page
    .waitForResponse(
      (r) =>
        urlPath(r.url()) === '/js_treat_cx.php' &&
        r.request().method() === 'POST',
      {
        timeout: 30_000,
      },
    )
    .catch(() => null);
  await page
    .locator(
      '.ui-dialog:has(#js_connexion_member_dialog) .ui-dialog-buttonpane button:has-text("Valider")',
    )
    .click();
  const resp = await answerP;
  setPhase('read');
  const answer = resp ? (await resp.text().catch(() => '')).trim() : '';
  if (!resp)
    guard.lock('LOCK_LOGIN_UNKNOWN', 'no answer to the credential POST');
  if (answer === 'unknown_error')
    guard.lock('LOCK_LOGIN_FAILED', 'credentials refused (unknown_error)');
  if (answer === 'cookie_error')
    guard.lock('LOCK_LOGIN_UNKNOWN', 'cookie_error');

  await page
    .waitForURL((u) => u.href === ENTRY, { timeout: 30_000 })
    .catch(() => undefined);
  await pause();
  await page.goto(ENTRY, { waitUntil: 'domcontentloaded' });
  if (page.url() === ENTRY) {
    guard.succeeded();
    return;
  }
  if (/captcha/i.test(await page.content()))
    guard.lock('LOCK_LOGIN_CAPTCHA', urlPath(page.url()));
  guard.lock(
    'LOCK_LOGIN_FAILED',
    `not logged in after the credential POST, landed on ${urlPath(page.url())}`,
  );
}

type Download =
  | {
      ok: true;
      bytes: Buffer;
      contentType: string | null;
      fileName: string;
      fetchedAt: string;
    }
  | { ok: false; status: Status; detail?: string };

async function download(
  context: BrowserContext,
  url: string,
  redact: (t: string) => string,
): Promise<Download> {
  const verdict = goldaRequestVerdict(
    { url, method: 'GET', resourceType: 'download' },
    'read',
  );
  if (verdict.allowed === false)
    throw new Error(
      `download URL refused by the allowlist (${verdict.reason})`,
    );
  let resp: APIResponse;
  try {
    resp = await context.request.get(url, {
      maxRedirects: 0,
      timeout: DOWNLOAD_TIMEOUT_MS,
      failOnStatusCode: false,
    });
  } catch (e) {
    return {
      ok: false,
      status: 'DOWNLOAD_FAILED',
      detail: redact(errorText(e)).slice(0, 200),
    };
  }
  try {
    if (resp.status() !== 200)
      return { ok: false, status: `HTTP_${resp.status()}` };
    const h = resp.headers();
    const contentType = h['content-type'] ?? null;
    const fileName = goldaZipFileName(h['content-disposition']);
    if (!fileName)
      return {
        ok: false,
        status: /text\/html/i.test(contentType ?? '')
          ? 'HTML_RESPONSE'
          : 'FILE_NAME_REFUSED',
      };
    if (Number(h['content-length'] ?? 0) > MAX_ZIP_BYTES)
      return { ok: false, status: 'TOO_LARGE' };
    const bytes = await resp.body();
    if (bytes.length > MAX_ZIP_BYTES) return { ok: false, status: 'TOO_LARGE' };
    return {
      ok: true,
      bytes,
      contentType,
      fileName,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    await resp.dispose().catch(() => undefined);
  }
}

class StoreFolderExists extends Error {}

/** Writes the files into a temporary sibling, then renames it into place. */
function store(
  root: string,
  dir: string,
  files: {
    zipName: string;
    zip: Buffer;
    csv?: { name: string; bytes: Buffer };
    source: string;
  },
): void {
  const final = resolve(root, dir);
  if (!final.startsWith(resolve(root) + sep))
    throw new Error('store folder outside its root');
  const parent = dirname(final);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const tmp = join(parent, `.partial-${basename(final)}-${process.pid}`);
  mkdirSync(tmp, { mode: 0o700 });
  try {
    writeFileSync(join(tmp, files.zipName), files.zip, {
      flag: 'wx',
      mode: 0o600,
    });
    if (files.csv) {
      mkdirSync(join(tmp, 'extrait'), { mode: 0o700 });
      writeFileSync(join(tmp, 'extrait', files.csv.name), files.csv.bytes, {
        flag: 'wx',
        mode: 0o600,
      });
    }
    writeFileSync(join(tmp, 'SOURCE.jsonl'), files.source, {
      flag: 'wx',
      mode: 0o600,
    });
    if (existsSync(final))
      throw new StoreFolderExists('store folder appeared during the run');
    renameSync(tmp, final);
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
}

interface FetchDirs {
  /** The store (OUT_DIR). */
  root: string;
  /** This run's evidence folder for refused downloads (never indexed). */
  refused: string;
}

async function fetchPublication(
  context: BrowserContext,
  dirs: FetchDirs,
  fiche: { id: number; title: string },
  pub: GoldaPublication,
  redact: (t: string) => string,
): Promise<Row> {
  const row: Row = {
    fiche: fiche.id,
    kind: pub.kind,
    status: 'NOT_RUN',
    applicationDate: pub.applicationDate,
    lastUpdated: pub.lastUpdated,
    completCount: pub.completCount,
  };
  if (!pub.csv) return { ...row, status: 'NO_CSV_LINK' };
  if (pub.csv.access === 'protected') return { ...row, status: 'PROTECTED' };
  // Re-read for every publication: a folder stored earlier in this run must count.
  const plan = planGoldaStore(
    readStore(dirs.root),
    fiche.id,
    fiche.title,
    pub,
    (d) => existsSync(join(dirs.root, d)),
  );
  if (plan.action === 'present')
    return { ...row, status: 'ALREADY_PRESENT', dir: plan.dir };
  if (plan.action === 'conflict')
    return { ...row, status: 'STORE_CONFLICT', detail: plan.reason };

  await pause();
  const url = goldaCsvDownloadUrl({
    idt: pub.csv.idt,
    idv: pub.csv.idv,
    kind: pub.kind,
    protect: pub.csv.protect,
  });
  const dl = await download(context, url, redact);
  if (dl.ok === false) return { ...row, status: dl.status, detail: dl.detail };
  const files = (member: GoldaCsvMember | null) => ({
    zipName: dl.fileName,
    zip: dl.bytes,
    csv: member ? { name: member.name, bytes: member.bytes } : undefined,
    source: goldaSourceLine({
      url,
      httpStatus: 200,
      contentType: dl.contentType,
      contentDispositionFilename: dl.fileName,
      file: dl.fileName,
      bytes: dl.bytes.length,
      sha256: sha256(dl.bytes),
      fetchedAt: dl.fetchedAt,
      publication: pub,
      extractFile: member ? member.name : '',
      extractSha256: member ? sha256(member.bytes) : '',
    }),
  });
  // Every check runs before anything is stored; a refused download is kept as evidence only.
  const refuse = (
    status: Status,
    e: unknown,
    member: GoldaCsvMember | null,
  ): Row => {
    const dir = `${fiche.id}-${pub.kind}`;
    let evidence: string;
    try {
      store(dirs.refused, dir, files(member));
      evidence = relative(dirs.root, join(dirs.refused, dir));
    } catch (w) {
      evidence = `NOT KEPT: ${redact(errorText(w)).slice(0, 150)}`;
    }
    return {
      ...row,
      status,
      detail: redact(errorText(e)).slice(0, 200),
      evidence,
    };
  };

  let member: GoldaCsvMember;
  try {
    member = extractGoldaTariffCsv(dl.bytes);
  } catch (e) {
    // Any error, not only GoldaArchiveError: the bytes are untrusted.
    return refuse('ARCHIVE_REFUSED', e, null);
  }
  let counted: ReturnType<typeof countVerdict>;
  try {
    counted = countVerdict(
      parseGoldaTariffCsv(member.bytes).report,
      pub.completCount,
    );
  } catch (e) {
    return refuse('PARSE_REFUSED', e, member);
  }
  const measured = {
    dataLines: counted.dataLines,
    sup: counted.sup,
    rejected: counted.rejected,
  };
  if (!counted.ok)
    return {
      ...refuse(
        'COUNT_MISMATCH',
        'file lines minus SUP ≠ the fiche count',
        member,
      ),
      ...measured,
    };
  try {
    store(dirs.root, plan.dir, files(member));
  } catch (e) {
    return {
      ...row,
      ...measured,
      status:
        e instanceof StoreFolderExists
          ? 'STORE_CONFLICT'
          : 'STORE_WRITE_FAILED',
      detail: redact(errorText(e)).slice(0, 200),
    };
  }
  return { ...row, ...measured, status: 'FETCHED', dir: plan.dir };
}

async function main(): Promise<number> {
  if (process.env.DEBUG || process.env.PWDEBUG)
    throw new Error(
      'DEBUG or PWDEBUG is set: Playwright would print typed values and request headers unredacted — unset it',
    );
  const creds = { user: req('GOLDA_USER'), password: req('GOLDA_PASSWORD') };
  const redact = makeRedactor([creds.user, creds.password]);
  const idsRaw = req('GOLDA_TARIFF_IDS');
  if (!/^[1-9]\d{0,9}(,[1-9]\d{0,9})*$/.test(idsRaw))
    throw new Error('GOLDA_TARIFF_IDS: csv of positive integers');
  const ids = [...new Set(idsRaw.split(',').map(Number))];
  const root = req('OUT_DIR');
  if (!isAbsolute(root) || !statSync(root).isDirectory())
    throw new Error('OUT_DIR: an existing absolute folder');

  const stateDir = join(root, '_fetch');
  mkdirSync(join(stateDir, 'runs'), { recursive: true, mode: 0o700 });
  acquireRunLock(join(stateDir, '.run.lock'));
  const guard = new LoginGuard(stateDir, redact);
  guard.assertAllowed();
  readStore(root); // an unreadable store fails here, before any login
  const startedAt = new Date().toISOString();
  const runStamp = startedAt.replace(/[:.]/g, '-');
  const dirs: FetchDirs = {
    root,
    refused: join(stateDir, 'refused', runStamp),
  };

  let phase: GoldaPhase = 'anon';
  const blocked = new Map<string, number>();
  const refusedHops: string[] = [];
  const rows: Row[] = [];
  let sessionCheck = 'not run';
  let fatal: string | undefined;

  let browser: Browser | undefined;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      userAgent: USER_AGENT,
      acceptDownloads: false,
      serviceWorkers: 'block',
    });
    await context.route('**/*', (route) => {
      const r = route.request();
      const v = goldaRequestVerdict(
        { url: r.url(), method: r.method(), resourceType: r.resourceType() },
        phase,
      );
      if (v.allowed === true) return route.continue();
      const key = `${v.reason} ${r.method()} ${r.resourceType()} ${urlPath(r.url())}`;
      blocked.set(key, (blocked.get(key) ?? 0) + 1);
      return route.abort('blockedbyclient');
    });
    // Redirect hops bypass context.route: each one is checked when it is issued.
    context.on('request', (r) => {
      if (!r.redirectedFrom()) return;
      const hop = {
        url: r.url(),
        method: r.method(),
        resourceType: r.resourceType(),
      };
      if (!redirectHopAllowed(hop, phase))
        refusedHops.push(
          `${hop.method} ${hop.resourceType} ${urlPath(hop.url)}`,
        );
    });
    await context.routeWebSocket(/.*/, (ws) => ws.close());
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(45_000);
    page.setDefaultTimeout(30_000);
    page.on('dialog', (d) => void d.dismiss().catch(() => undefined));
    context.on('page', (p) => {
      if (p !== page) void p.close().catch(() => undefined);
    });

    await login(page, (p) => (phase = p), creds, guard);

    let sessionLost = false;
    const stopped = (): string | null =>
      refusedHops.length > 0
        ? 'a redirect hop the allowlist refuses was sent earlier in the run'
        : sessionLost
          ? 'session lost earlier in the run'
          : null;
    for (const id of ids) {
      const why = stopped();
      if (why) {
        rows.push({ fiche: id, kind: '-', status: 'NOT_RUN', detail: why });
        continue;
      }
      await pause();
      const url = goldaFicheUrl(id);
      const resp = await page
        .goto(url, { waitUntil: 'domcontentloaded' })
        .catch((e: Error) => e);
      if (resp instanceof Error) {
        rows.push({
          fiche: id,
          kind: '-',
          status: 'PAGE_NOT_REACHED',
          detail: redact(errorText(resp)).slice(0, 200),
        });
        continue;
      }
      if (isGoldaLoggedOutUrl(page.url())) {
        sessionLost = true;
        rows.push({ fiche: id, kind: '-', status: 'SESSION_LOST' });
        continue;
      }
      if (page.url() !== url || resp?.status() !== 200) {
        rows.push({
          fiche: id,
          kind: '-',
          status: 'PAGE_NOT_REACHED',
          detail: `HTTP ${resp?.status() ?? '-'} on ${urlPath(page.url())}`,
        });
        continue;
      }
      let fiche: GoldaFichePage;
      try {
        fiche = parseGoldaFichePage(await page.content(), id);
      } catch (e) {
        if (!(e instanceof GoldaPageFormatError)) throw e;
        rows.push({
          fiche: id,
          kind: '-',
          status: 'PAGE_FORMAT_UNKNOWN',
          detail: e.message,
        });
        continue;
      }
      for (const pub of fiche.publications) {
        const stop = stopped();
        rows.push(
          stop
            ? { fiche: id, kind: pub.kind, status: 'NOT_RUN', detail: stop }
            : await fetchPublication(
                context,
                dirs,
                { id, title: fiche.title },
                pub,
                redact,
              ),
        );
      }
    }

    // A session lost without a redirect turns "authorized" links into "protected": check it held.
    if (refusedHops.length === 0) {
      await pause();
      await page
        .goto(ENTRY, { waitUntil: 'domcontentloaded' })
        .catch(() => undefined);
      sessionCheck = page.url() === ENTRY ? 'held' : 'LOST';
    }
  } catch (e) {
    fatal = errorText(e, true);
  } finally {
    await browser?.close().catch((e: unknown) => {
      fatal ??= `browser close: ${errorText(e, true)}`;
    });
  }

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    ids,
    fatal: fatal ?? null,
    sessionCheck,
    refusedRedirectHops: refusedHops,
    rows,
    blocked: Object.fromEntries(blocked),
  };
  writeFileSync(
    join(stateDir, 'runs', `${runStamp}.json`),
    redact(JSON.stringify(report, null, 1)),
    {
      flag: 'wx',
      mode: 0o600,
    },
  );

  console.log(
    [
      'fiche',
      'kind',
      'status',
      'dir',
      'count',
      'data-SUP',
      'rejected',
      'detail',
    ].join('\t'),
  );
  for (const r of rows)
    console.log(
      redact(
        [
          r.fiche,
          r.kind,
          r.status,
          r.dir ?? r.evidence ?? '',
          r.completCount ?? '',
          r.dataLines === undefined ? '' : r.dataLines - (r.sup ?? 0),
          r.rejected ?? '',
          r.detail ?? '',
        ].join('\t'),
      ),
    );
  console.log(
    redact(
      `session at the end: ${sessionCheck}; blocked requests: ${blocked.size} kinds; ` +
        `refused redirect hops: ${refusedHops.length}`,
    ),
  );
  for (const [k, n] of blocked) console.log(redact(`  blocked ×${n}: ${k}`));
  for (const h of refusedHops) console.log(redact(`  REFUSED HOP SENT: ${h}`));
  if (fatal !== undefined) {
    console.error('golda-tariff-fetch FAIL', redact(fatal));
    return 1;
  }
  const allOk =
    sessionCheck === 'held' &&
    refusedHops.length === 0 &&
    rows.every((r) => OK.has(r.status));
  return allOk ? 0 : 2;
}

// Only run when invoked directly, never on import (keeps the pure helpers unit-testable).
if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (e: unknown) => {
      const secrets = [
        process.env.GOLDA_USER,
        process.env.GOLDA_PASSWORD,
      ].filter((s): s is string => !!s);
      console.error(
        'golda-tariff-fetch FAIL',
        makeRedactor(secrets)(errorText(e, true)),
      );
      process.exit(1);
    },
  );
}
