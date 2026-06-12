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
 *        returns { ref, marq, qte (stock), key (internal id) }.
 *     b) Set txtRef + HiddenValue (the `key`) in the form, invoke __doPostBack
 *        on `cmdFired` (the autocomplete-select hidden button).
 *     c) Page now renders the article line with `.articlePrixBase` (public HT),
 *        `.articlePrixRemise` (CAL discount %), `.articlePrixNet` (purchase HT).
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
  calProductToObservation,
  parseCalPriceHt,
  parseCalRemisePct,
} from './cal-parse';

const AUTOCOMPLETE_ROOT =
  'ctl00$ContentPlaceHolder1$CtrlCatalogueTecdocV3$CtrlSearchVehiculesTemplateSelector1$ctl00$CtrlSearchArtByRef1$CtrlAutoComplete1';
const CMD_FIRED = `${AUTOCOMPLETE_ROOT}$cmdFired`;
const ID_TXTREF = `${AUTOCOMPLETE_ROOT.replace(/\$/g, '_')}_txtRef`;
const ID_HIDDEN_VALUE = `${AUTOCOMPLETE_ROOT.replace(/\$/g, '_')}_HiddenValue`;
const ID_HIDDEN_MARQUE = `${AUTOCOMPLETE_ROOT.replace(/\$/g, '_')}_HiddenMarque`;
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
  minRequestIntervalMs?: number;
  navigationTimeoutMs?: number;
}

const DEFAULTS = { minRequestIntervalMs: 1500, navigationTimeoutMs: 30000 };
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

  constructor(options: CalConnectorOptions) {
    this.supplierId = options.supplierId;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.opts = { ...DEFAULTS, ...options } as Required<CalConnectorOptions>;
  }

  async login(creds: SupplierCredentials): Promise<void> {
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
    if (!this.loggedIn || !this.catalogPage || !this.context) {
      throw new Error('CAL fetchAvailability called before login');
    }
    const out: SupplierObservation[] = [];
    for (const ref of refs) {
      try {
        out.push(await this.lookupOne(ref));
      } catch (e) {
        this.logger.warn(`CAL lookup '${ref}' failed: ${(e as Error).message}`);
        out.push(
          calProductToObservation({
            supplierId: this.supplierId,
            rawRef: ref,
            prixNetHt: null,
            dispoLabel: null,
          }),
        );
      }
      await this.jitterDelay();
    }
    return out;
  }

  /** Per-ref lookup: autocomplete API → form select → parse the article line. */
  private async lookupOne(ref: string): Promise<SupplierObservation> {
    const page = this.catalogPage!;
    const ctx = this.context!;

    // (a) Resolve the article's `key` and stock via the JSONP autocomplete API.
    const idsession =
      (await page
        .locator(`input[id="${ID_HIDDEN_SESSION}"]`)
        .getAttribute('value')
        .catch(() => null)) ?? '';
    const hiddenMarque =
      (await page
        .locator(`input[id="${ID_HIDDEN_MARQUE}"]`)
        .getAttribute('value')
        .catch(() => '')) ?? '';
    const params = new URLSearchParams({
      featureClass: 'P',
      style: 'full',
      limit: '20',
      name_startsWith: hiddenMarque + ref,
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
    const body = (await resp.text())
      .replace(/^[^(]*\(/, '')
      .replace(/\);?\s*$/, '');
    const parsed = JSON.parse(body) as {
      result?: Array<{ ref: string; key: string; marq: string; qte: string }>;
    };
    const item =
      (parsed.result ?? []).find((r) => r.ref === ref) ?? parsed.result?.[0];
    if (!item) {
      // No match → never had a tariff at CAL for this ref. Safe parseError.
      return calProductToObservation({
        supplierId: this.supplierId,
        rawRef: ref,
        prixNetHt: null,
        dispoLabel: null,
      });
    }
    // (b) Drive the autocomplete `select` callback: set txtRef + HiddenValue,
    //     then fire cmdFired's __doPostBack. Loads the article line with prices.
    await page.evaluate(
      ([refStr, key, idTxt, idHidden]) => {
        const t = document.getElementById(idTxt) as HTMLInputElement | null;
        const h = document.getElementById(idHidden) as HTMLInputElement | null;
        if (t) t.value = refStr;
        if (h) h.value = key;
      },
      [ref, item.key, ID_TXTREF, ID_HIDDEN_VALUE],
    );
    await this.postback(page, CMD_FIRED);

    // Race guard: networkidle alone is insufficient — the WebForms repeater
    // can briefly display the PREVIOUS article while the new one re-renders,
    // causing us to read stale prices. Wait until the article line carries the
    // codart attribute matching THIS ref's key (verified live 2026-05-23).
    await page
      .locator(`.qteincart[codart="${item.key}"]`)
      .first()
      .waitFor({ state: 'attached', timeout: 10000 })
      .catch(() => {
        /* fallback: read whatever is there; race protection is best-effort */
      });

    // (c) Extract from stable CSS classes (article repeater template). The
    // AUTHORITATIVE stock signal is the icon image src in ctrlStockStatus —
    // owner-verified 2026-05-23: `qte` from the API is NOT actual stock.
    const [prixNetText, prixBaseText, remiseText, stockIconSrc] =
      await Promise.all([
        page
          .locator('.articlePrixNet')
          .first()
          .textContent()
          .catch(() => null),
        page
          .locator('.articlePrixBase')
          .first()
          .textContent()
          .catch(() => null),
        page
          .locator('.articlePrixRemise')
          .first()
          .textContent()
          .catch(() => null),
        page
          .locator('[id*="ctrlStockStatus1_ImgDocStatus"] img')
          .first()
          .getAttribute('src')
          .catch(() => null),
      ]);

    return calProductToObservation({
      supplierId: this.supplierId,
      rawRef: ref,
      prixNetHt: parseCalPriceHt(prixNetText),
      prixBaseHt: parseCalPriceHt(prixBaseText),
      remisePct: parseCalRemisePct(remiseText),
      dispoLabel: null, // icon is authoritative, no text needed
      stockIconSrc,
    });
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
