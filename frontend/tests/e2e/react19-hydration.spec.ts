/**
 * Tests E2E — React 19 hydration integrity.
 *
 * STRICT replayable proof that the React 18.3.1 → 19.2.7 migration introduces no
 * hydration mismatch, no SSR/client divergence, no chunk-load failure, on the
 * real served build. Reuses ONLY the URL fixtures validated by the existing e2e
 * suites — and deliberately NONE of their permissive patterns (no `skipIf404`,
 * no `.catch(() => false)`, no `expect(true).toBe(true)`): any browser error
 * fails the test.
 *
 * Authoritative run = the PREPROD `e2e-smoke` CI job (added alongside
 * critical-path + url-validation). DEV run is a best-effort pre-PR pre-check
 * against a locally built+served worktree (NOT the shared DEV:3000 which serves
 * `main`). `webServer` is disabled in playwright.config — the server must be up;
 * the base URL comes from `PLAYWRIGHT_BASE_URL`.
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// Hydration / SSR-mismatch / chunk-load signatures. Kept IN SYNC with the
// runtime classifier `isHydrationRecoverableError` (react-error-handlers.client)
// and matched against the React 19 wording verified on the React source:
//   "Hydration failed because the server rendered HTML didn't match the client…"
//   "A tree hydrated but some attributes of the server rendered HTML didn't match…"
const FATAL_CONSOLE_RE =
  /hydration|server rendered html|did(?:n['’]t| not) match|does not match|failed to fetch dynamically imported module|loading chunk/i;

// Critical surfaces — reused from url-validation.spec.ts (all 200).
const CRITICAL_URLS = [
  "/",
  "/contact",
  "/cart",
  "/pieces/catalogue?category=freinage",
  "/pieces/plaquettes-de-frein-1.html",
] as const;

/**
 * Attach pageerror + console collectors. Returns the mutable error list — the
 * caller asserts it is empty AFTER each load / navigation (collect-then-assert,
 * never an inline `fail()` callback that Playwright cannot await).
 */
function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    const type = msg.type();
    if (
      (type === "error" || type === "warning") &&
      FATAL_CONSOLE_RE.test(msg.text())
    ) {
      errors.push(`console.${type}: ${msg.text()}`);
    }
  });
  return errors;
}

test.describe("React 19 hydration — initial SSR load", () => {
  for (const url of CRITICAL_URLS) {
    test(`hydrates cleanly: ${url}`, async ({ page }) => {
      const errors = collectBrowserErrors(page);
      const res = await page.goto(url, { waitUntil: "networkidle" });
      expect(res, `no response for ${url}`).not.toBeNull();
      expect(res!.status(), `unexpected status for ${url}`).toBeLessThan(400);
      // Give React a beat to flush any post-hydration recoverable error.
      await page.waitForTimeout(300);
      expect(errors, `hydration errors on ${url}`).toEqual([]);
    });
  }
});

test.describe("React 19 hydration — client-side navigation", () => {
  test("SPA navigation from home does not break hydration", async ({
    page,
  }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/", { waitUntil: "networkidle" });
    // Click the first visible same-origin link → exercises React Router client
    // transition + the destination's hydration consistency.
    const internalLink = page.locator('a[href^="/"]:visible').first();
    await expect(internalLink, "no internal link on homepage").toBeVisible();
    await internalLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    expect(errors, "errors during client navigation").toEqual([]);
  });
});

test.describe("React 19 — form action (no business side effect)", () => {
  test("invalid POST /contact returns 400 before any ticket", async ({
    request,
  }) => {
    // The /contact action validates first and returns 400 on invalid input,
    // BEFORE calling the support API — no ticket / DB write / email.
    const res = await request.post("/contact", {
      form: { name: "", email: "", subject: "", message: "", category: "" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("React 19 — Googlebot SSR (onAllReady bot path)", () => {
  test("renders for Googlebot without hydration/render errors", async ({
    browser,
  }) => {
    // Distinct context with a bot UA → server takes the `onAllReady` branch
    // (full-buffer SSR for crawlers) instead of `onShellReady`.
    const context: BrowserContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    });
    const page = await context.newPage();
    const errors = collectBrowserErrors(page);
    try {
      const res = await page.goto("/", { waitUntil: "networkidle" });
      expect(res!.status(), "Googlebot home status").toBeLessThan(400);
      await page.waitForTimeout(300);
      expect(errors, "errors on Googlebot render").toEqual([]);
    } finally {
      await context.close();
    }
  });
});
