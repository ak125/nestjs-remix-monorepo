/**
 * inoshop (DistriCash) connector — Layer 1 I/O adapter.
 *
 * WHY Playwright (not raw HTTP + cheerio): empirically the inoshop search is
 * STATEFUL and JS-driven — login is form-POST-able, but the results page is only
 * rendered after the autocomplete→select→submit flow (a bare `GET /search?query_search`
 * 302-redirects to home). Replaying that multi-step flow over raw HTTP is brittle
 * (bricolage-prone) and more bot-detectable. A headless browser drives the exact
 * working flow and is gentler on anti-automation. Business logic stays in the pure,
 * tested `articleToObservation` mapper — this class only logs in + extracts DOM fields.
 *
 * ⚠️ Requires `playwright` (declared in package.json) + `npx playwright install chromium`.
 * Selectors below are from the live capture (ELH4261); they MUST be verified on a first
 * real run. Any extraction failure degrades to `parseError` (never a false in-stock).
 *
 * Anti-ban: one warm browser context, per-supplier rate profile + jitter, working-set
 * refs only (enforced by the scheduler), never a full-catalog crawl.
 */

import { Logger } from '@nestjs/common';
import type { Browser, BrowserContext, Page } from 'playwright';
import {
  type SupplierConnector,
  type SupplierCredentials,
  type SupplierObservation,
} from './supplier-connector.interface';
import { articleToObservation, type InoshopArticle } from './inoshop-parse';

export interface InoshopConnectorOptions {
  supplierId: string;
  baseUrl: string;
  /** Min delay between reference searches (anti-ban). */
  minRequestIntervalMs?: number;
  navigationTimeoutMs?: number;
}

const DEFAULTS = { minRequestIntervalMs: 1500, navigationTimeoutMs: 20000 };

export class InoshopConnector implements SupplierConnector {
  readonly platform = 'inoshop';
  readonly supplierId: string;
  private readonly logger = new Logger(InoshopConnector.name);
  private readonly baseUrl: string;
  private readonly opts: Required<InoshopConnectorOptions>;
  private browser?: Browser;
  private context?: BrowserContext;
  private loggedIn = false;

  constructor(options: InoshopConnectorOptions) {
    this.supplierId = options.supplierId;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.opts = {
      ...DEFAULTS,
      ...options,
    } as Required<InoshopConnectorOptions>;
  }

  async login(creds: SupplierCredentials): Promise<void> {
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({
      locale: 'fr-FR',
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    });
    const page = await this.context.newPage();
    page.setDefaultNavigationTimeout(this.opts.navigationTimeoutMs);

    await page.goto(`${this.baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('input[name="login"]', creds.user);
    await page.fill('input[name="password"]', creds.password);
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.click('button[type="submit"], [type="submit"]'),
    ]);

    // Authenticated iff a logout affordance exists (no login form).
    const authed = (await page.locator('a[href*="logout"]').count()) > 0;
    await page.close();
    if (!authed) {
      throw new Error('inoshop login failed (no authenticated session)');
    }
    this.loggedIn = true;
    this.logger.log(`✅ inoshop login ok (supplier ${this.supplierId})`);
  }

  async fetchAvailability(refs: string[]): Promise<SupplierObservation[]> {
    if (!this.loggedIn || !this.context) {
      throw new Error('fetchAvailability called before login');
    }
    const out: SupplierObservation[] = [];
    const page = await this.context.newPage();
    page.setDefaultNavigationTimeout(this.opts.navigationTimeoutMs);
    try {
      for (const ref of refs) {
        try {
          out.push(...(await this.searchOne(page, ref)));
        } catch (e) {
          this.logger.warn(
            `inoshop fetch '${ref}' failed: ${(e as Error).message}`,
          );
          // safe degradation: emit a parseError observation, never a false in-stock
          out.push(
            articleToObservation({
              supplierId: this.supplierId,
              rawRef: ref,
              codeArticle: null,
              stock: null,
              dispoType: null,
              bestIcon: null,
            }),
          );
        }
        await this.jitterDelay();
      }
    } finally {
      await page.close();
    }
    return out;
  }

  /** Drive the stateful search via the autocomplete (the working browser flow). */
  private async searchOne(
    page: Page,
    ref: string,
  ): Promise<SupplierObservation[]> {
    await page.goto(`${this.baseUrl}/`, { waitUntil: 'domcontentloaded' });
    // type in the reference autocomplete (tagsinput) and submit
    const input = page.locator(
      '#autocompletion-invoker input[data-role="tagsinput"]',
    );
    await input.fill(ref);
    await input.press('Enter');
    await page.waitForLoadState('networkidle');

    // extract each rendered .ARTICLE row's data attributes (verified-on-first-run)
    const articles = (await page.$$eval('.ARTICLE', (nodes) =>
      nodes.map((n) => {
        const ds = (k: string) => n.getAttribute(k);
        const priceText =
          n.querySelector('[class*="prix-achat"], [class*="price-buy"]')
            ?.textContent ?? '';
        const icon =
          n.querySelector('img[src*="/stock/"]')?.getAttribute('src') ?? null;
        return {
          rawRef: ds('data-filtrecodearticle') || ds('data-ref') || '',
          codeArticle: ds('data-filtrecodearticle'),
          stockRaw: ds('data-stock'),
          dispoType: ds('data-dispo-type'),
          icon,
          priceText,
        };
      }),
    )) as {
      rawRef: string;
      codeArticle: string | null;
      stockRaw: string | null;
      dispoType: string | null;
      icon: string | null;
      priceText: string;
    }[];

    if (articles.length === 0) {
      // no rows rendered → unresolved/parse-degraded for this ref (safe)
      return [
        articleToObservation({
          supplierId: this.supplierId,
          rawRef: ref,
          codeArticle: null,
          stock: null,
          dispoType: null,
          bestIcon: null,
        }),
      ];
    }

    return articles.map((a) => {
      const article: InoshopArticle = {
        supplierId: this.supplierId,
        rawRef: a.rawRef || ref,
        codeArticle: a.codeArticle,
        stock: a.stockRaw != null ? Number.parseInt(a.stockRaw, 10) : null,
        dispoType: a.dispoType,
        bestIcon: a.icon,
        priceBuyHt: parsePriceHt(a.priceText),
      };
      return articleToObservation(article);
    });
  }

  private async jitterDelay(): Promise<void> {
    const base = this.opts.minRequestIntervalMs;
    const ms = base + Math.floor(Math.random() * base);
    await new Promise((r) => setTimeout(r, ms));
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.loggedIn = false;
  }
}

/** Parse "10,60 €" / "10.60€" → 10.6; null when absent. */
export function parsePriceHt(text: string): number | null {
  const m = (text || '').match(/(\d+)[.,](\d{2})/);
  if (!m) return null;
  return Number.parseFloat(`${m[1]}.${m[2]}`);
}
