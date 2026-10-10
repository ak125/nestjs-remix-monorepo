/**
 * CAL (PF Préférence Seine, Société CAL 92) — Layer 1 I/O adapter.
 *
 * Live-verified flow (2026-05-23):
 *  1) GET /login.aspx → fill visible username + password → press Enter.
 *     The visible main form is selected; the hidden `CtrlLoginMini1` header
 *     widget is skipped by `:visible`. WebForms VIEWSTATE/EVENTVALIDATION are
 *     handled by the browser engine on form-submit.
 *  2) After login, the catalogue hides prices behind a per-session toggle
 *     `cmbShowPrices` (Ctrl+E in the UI). Triggered via __doPostBack since the
 *     link is in a collapsed header slider (not visible to a click).
 *  3) Per-ref lookup:
 *     a) Call /CallWS.aspx?origine=autocomplete (JSONP, cookies preserved) →
 *        returns { ref, marq, codemarq, qte (NOT stock), key (internal id) }.
 *        Exactly one item must carry the requested ref (and the brand, when the
 *        caller gave brand tokens) — never the first result (`matchCalItem`).
 *     b) Set txtRef + HiddenValue (the `key`) in the form, invoke __doPostBack
 *        on `cmdFired` (the autocomplete-select hidden button).
 *     c) Read ONLY the selected article's line: the `table.articleTemplateSelection`
 *        holding `.qteincart[codart=key]` (the page has 2 such tables — live
 *        2026-10-10). `.articlePrixBase` (public HT), `.articlePrixRemise` (CAL
 *        discount %), `.articlePrixNet` (purchase HT), stock icon. The icon is
 *        swapped in asynchronously after `ico_disposearch.gif`; we wait for it.
 *
 * Anti-bricolage: one warm browser context; postbacks driven directly so we
 * don't replay brittle UI animations; all selectors use stable CSS classes
 * (not the cryptic ctl00$... ASP.NET IDs). Safe degradation → parseError.
 */

import { Logger } from '@nestjs/common';
import type { Browser, BrowserContext, Page } from 'playwright';
import {
  type SupplierConnector,
  type SupplierCredentials,
  type SupplierObservation,
} from './supplier-connector.interface';
import {
  calLookupToObservation,
  matchCalItem,
  parseCalAutocomplete,
  type CalArticleRow,
  type CalLookup,
} from './cal-parse';
import { brandTokenSet } from './inoshop-search-parse';

const AUTOCOMPLETE_ROOT =
  'ctl00$ContentPlaceHolder1$CtrlCatalogueTecdocV3$CtrlSearchVehiculesTemplateSelector1$ctl00$CtrlSearchArtByRef1$CtrlAutoComplete1';
const CMD_FIRED = `${AUTOCOMPLETE_ROOT}$cmdFired`;
const ID_TXTREF = `${AUTOCOMPLETE_ROOT.replace(/\$/g, '_')}_txtRef`;
const ID_HIDDEN_VALUE = `${AUTOCOMPLETE_ROOT.replace(/\$/g, '_')}_HiddenValue`;
const ID_HIDDEN_SESSION = `${AUTOCOMPLETE_ROOT.replace(/\$/g, '_')}_HiddenSession`;
const SHOW_PRICES_POSTBACK =
  'ctl00$CtrlHeaderSlidingTemplateSelector$ctl00$cmbShowPrices';

/**
 * 🚨 SAFETY — postback targets that MUST NEVER be invoked by this READ-ONLY
 * connector. Adding an article to the CAL cart triggers a real, billable
 * order. The deny-list is enforced inside `postback()` (throws on match) so
 * even an accidental call upstream fails loud, never silently.
 */
const FORBIDDEN_POSTBACK =
  /panier|cart|ajouter|incart|cmdcde|cmdadd|cmdAjout|commande|valid.*panier|order/i;

/** Public guard — exported so the unit test pins the read-only contract. */
export function isForbiddenPostbackTarget(target: string): boolean {
  return FORBIDDEN_POSTBACK.test(target);
}

export interface CalConnectorOptions {
  supplierId: string;
  baseUrl: string;
  /** CAL brand labels and/or short codes to lock onto. */
  brandTokens?: string[];
  minRequestIntervalMs?: number;
  navigationTimeoutMs?: number;
  /** Bound on the wait for the async stock icon (placeholder → real icon). */
  iconSettleTimeoutMs?: number;
}

const DEFAULTS = {
  brandTokens: [] as string[],
  minRequestIntervalMs: 1500,
  navigationTimeoutMs: 30000,
  iconSettleTimeoutMs: 8000,
};
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export class CalConnector implements SupplierConnector {
  readonly platform = 'cal';
  readonly supplierId: string;
  private readonly logger = new Logger(CalConnector.name);
  private readonly baseUrl: string;
  private readonly opts: Required<CalConnectorOptions>;
  private browser?: Browser;
  private context?: BrowserContext;
  private catalogPage?: Page;
  private loggedIn = false;
  private readonly brandTokens: Set<string>;

  constructor(options: CalConnectorOptions) {
    this.supplierId = options.supplierId;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.opts = { ...DEFAULTS, ...options } as Required<CalConnectorOptions>;
    this.brandTokens = brandTokenSet({ tokens: this.opts.brandTokens });
  }

  async login(creds: SupplierCredentials): Promise<void> {
    // A re-login (classifier session recovery) must not leak the previous browser.
    await this.close();
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      locale: 'fr-FR',
      userAgent: USER_AGENT,
    });
    const page = await this.context.newPage();
    page.setDefaultNavigationTimeout(this.opts.navigationTimeoutMs);

    await page.goto(`${this.baseUrl}/login.aspx`, {
      waitUntil: 'domcontentloaded',
    });
    await page
      .locator('input[type="text"]:visible, input[type="email"]:visible')
      .first()
      .fill(creds.user);
    const pwd = page.locator('input[type="password"]:visible').first();
    await pwd.fill(creds.password);
    // Universal WebForms submit: Enter on the password field (cmdvalider is
    // styled away on some pages, but Enter always posts the parent form).
    await Promise.all([
      page.waitForLoadState('networkidle'),
      pwd.press('Enter'),
    ]);

    const url = page.url();
    const leftLogin = !/\/login\.aspx/i.test(url);
    if (!leftLogin) {
      await page.close();
      throw new Error(
        'CAL login failed (still on login.aspx) — check credentials',
      );
    }
    this.logger.log(`✅ CAL login ok (supplier ${this.supplierId})`);

    // Enable prices for this session (per-session toggle, server-stored).
    await this.postback(page, SHOW_PRICES_POSTBACK);

    // Warm catalogue page; re-used by fetchAvailability to avoid one nav/ref.
    await page.goto(`${this.baseUrl}/catalogue/1-pieces-auto.aspx`, {
      waitUntil: 'domcontentloaded',
    });
    this.catalogPage = page;
    this.loggedIn = true;
  }

  async fetchAvailability(refs: string[]): Promise<SupplierObservation[]> {
    this.assertLoggedIn();
    const out: SupplierObservation[] = [];
    for (const ref of refs) {
      try {
        const lookup = await this.lookup(ref);
        if (!lookup.item)
          this.logger.warn(`CAL lookup '${ref}': no article (${lookup.kind})`);
        out.push(calLookupToObservation(this.supplierId, lookup));
      } catch (e) {
        this.logger.warn(`CAL lookup '${ref}' failed: ${(e as Error).message}`);
        out.push(
          calLookupToObservation(this.supplierId, {
            ref,
            kind: 'NOT_FOUND',
            item: null,
            row: null,
          }),
        );
      }
      await this.jitterDelay();
    }
    return out;
  }

  /**
   * Per-ref lookup: autocomplete API → exact (brand-locked) item → form select
   * → read the selected article's line. Throws on a portal failure (HTTP error,
   * non-JSON body, line never rendered) so the caller can retry it; a ref that
   * is simply absent / foreign / ambiguous returns `item: null` with its kind.
   */
  async lookup(ref: string): Promise<CalLookup> {
    this.assertLoggedIn();
    const page = this.catalogPage!;
    const ctx = this.context!;

    // (a) Resolve the article's `key` via the JSONP autocomplete API.
    const idsession =
      (await page
        .locator(`input[id="${ID_HIDDEN_SESSION}"]`)
        .getAttribute('value', { timeout: 5000 })) ?? '';
    const params = new URLSearchParams({
      featureClass: 'P',
      style: 'full',
      limit: '20',
      // The UI prefixes the HiddenMarque input, which has no value in our
      // session (live 2026-10-10). Explicitly no brand prefix: the plain ref;
      // the brand is checked on the results instead (matchCalItem).
      name_startsWith: ref,
      idsession,
      succ: '01',
      privatepwd: 'wz7yH5STyWM=',
      interface: 'CYB',
      mode: 'RefWithCat',
      cattag: '',
      callback: 'jsonpCb',
    });
    const url = `${this.baseUrl}/CallWS.aspx?origine=autocomplete&${params}`;
    const resp = await ctx.request.get(url, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!resp.ok()) throw new Error(`autocomplete HTTP ${resp.status()}`);
    const items = parseCalAutocomplete(await resp.text());
    const { item, kind } = matchCalItem(items, ref, this.brandTokens);
    if (!item) return { ref, kind, item: null, row: null };

    // (b) Drive the autocomplete `select` callback: set txtRef + HiddenValue,
    //     then fire cmdFired's __doPostBack. Loads the article line with prices.
    await page.evaluate(
      ([refStr, key, idTxt, idHidden]) => {
        const t = document.getElementById(idTxt) as HTMLInputElement | null;
        const h = document.getElementById(idHidden) as HTMLInputElement | null;
        if (t) t.value = refStr;
        if (h) h.value = key;
      },
      [item.ref, item.key, ID_TXTREF, ID_HIDDEN_VALUE],
    );
    await this.postback(page, CMD_FIRED);

    // (c) The line of THIS article only. Waiting for its codart is also the
    //     race guard: the repeater can briefly show the PREVIOUS article.
    //     Not rendered → throw (the caller counts a failure), never read the page.
    const line = page
      .locator('table.articleTemplateSelection', {
        has: page.locator(`.qteincart[codart="${item.key}"]`),
      })
      .first();
    await line.waitFor({ state: 'attached', timeout: 10000 });
    const iconSettled = await line
      .locator(
        '[id*="ctrlStockStatus1_ImgDocStatus"] img:not([src*="ico_disposearch"])',
      )
      .first()
      .waitFor({ state: 'attached', timeout: this.opts.iconSettleTimeoutMs })
      .then(
        () => true,
        () => false,
      );
    if (!iconSettled)
      this.logger.warn(
        `CAL '${ref}': stock icon still loading after ${this.opts.iconSettleTimeoutMs}ms`,
      );
    // Plain DOM reads in one round-trip. No named helpers inside the callback:
    // tsx keepNames would inject a `__name` the browser does not define.
    const [
      marque,
      refcde,
      prixBaseText,
      remiseText,
      prixNetText,
      stockIconSrc,
    ] = await line.evaluate((el) =>
      [
        '.marque',
        '.refcde',
        '.articlePrixBase',
        '.articlePrixRemise',
        '.articlePrixNet',
      ]
        .map((sel) => {
          const n = el.querySelector(sel);
          return n ? (n.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
        })
        .concat(
          el
            .querySelector('[id*="ctrlStockStatus1_ImgDocStatus"] img')
            ?.getAttribute('src') ?? null,
        ),
    );
    const row: CalArticleRow = {
      marque,
      refcde,
      prixBaseText,
      remiseText,
      prixNetText,
      stockIconSrc,
      iconSettled,
    };
    return { ref, kind, item, row };
  }

  private assertLoggedIn(): void {
    if (!this.loggedIn || !this.catalogPage || !this.context) {
      throw new Error('CAL fetchAvailability called before login');
    }
  }

  /**
   * Invoke ASP.NET WebForms __doPostBack and wait for the resulting cycle.
   *
   * 🚨 SAFETY: hard-rejects any target matching cart/order patterns
   * (FORBIDDEN_POSTBACK). This connector is READ-ONLY by contract — adding to
   * the CAL cart triggers real, billable orders. Fail loud, never silently.
   */
  private async postback(page: Page, target: string, arg = ''): Promise<void> {
    if (FORBIDDEN_POSTBACK.test(target)) {
      throw new Error(
        `CAL connector refuses postback to forbidden target (cart/order): ${target}`,
      );
    }
    await page.evaluate(
      ([t, a]) =>
        (
          window as unknown as { __doPostBack: (t: string, a: string) => void }
        ).__doPostBack(t, a),
      [target, arg],
    );
    await page
      .waitForLoadState('networkidle', { timeout: 20000 })
      .catch(() => {});
  }

  async close(): Promise<void> {
    try {
      await this.catalogPage?.close();
      await this.context?.close();
    } finally {
      await this.browser?.close();
      this.browser = undefined;
      this.context = undefined;
      this.catalogPage = undefined;
      this.loggedIn = false;
    }
  }

  private async jitterDelay(): Promise<void> {
    const base = this.opts.minRequestIntervalMs;
    const jitter = Math.floor(Math.random() * base * 0.4);
    await new Promise((r) => setTimeout(r, base + jitter));
  }
}

/** Re-exported helper kept for unit tests (parses "12,15 €" / "12.15 €"). */
export { parseCalPriceHt as parsePriceFromText } from './cal-parse';
