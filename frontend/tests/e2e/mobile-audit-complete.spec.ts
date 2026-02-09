/**
 * Audit Mobile Complet — Test automatise de toutes les pages publiques
 *
 * 7 categories de tests x 23 pages x 3 viewports = rapport exhaustif
 *
 * Lancer :
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/mobile-audit-complete.spec.ts --reporter=html
 *
 * Rapport :
 *   npx playwright show-report
 */

import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ───────────────────────────────────────────────────────────

const PAGES = [
  // Core
  { name: "Homepage", url: "/" },
  { name: "Search", url: "/search?q=filtre" },
  { name: "Search CNIT", url: "/search/cnit" },

  // Catalogue
  { name: "Brands", url: "/brands" },
  { name: "Catalogue", url: "/catalogue" },
  { name: "Marques", url: "/marques" },

  // Blog / Content
  { name: "Blog Home", url: "/blog-pieces-auto" },
  { name: "References", url: "/reference-auto" },
  { name: "Diagnostics", url: "/diagnostic-auto" },

  // Legal
  { name: "Mentions legales", url: "/mentions-legales" },
  { name: "Politique confidentialite", url: "/politique-confidentialite" },
  { name: "Politique cookies", url: "/politique-cookies" },
  { name: "CGV", url: "/conditions-generales-de-vente.html" },
  { name: "Contact", url: "/contact" },
  { name: "Plan du site", url: "/plan-du-site" },

  // Auth
  { name: "Login", url: "/login" },
  { name: "Register", url: "/register" },
  { name: "Forgot password", url: "/forgot-password" },

  // Commerce
  { name: "Cart", url: "/cart" },
  { name: "Checkout", url: "/checkout" },

  // Support
  { name: "Support", url: "/support" },
  { name: "Aide", url: "/aide" },

  // Error
  { name: "404 page", url: "/page-qui-nexiste-pas-12345" },
];

const VIEWPORTS = [
  { name: "iPhone_SE", width: 320, height: 568 },
  { name: "iPhone_X", width: 375, height: 812 },
  { name: "iPhone_14_Pro_Max", width: 430, height: 932 },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Issue {
  type:
    | "horizontal-scroll"
    | "overflow-element"
    | "touch-target"
    | "input-zoom"
    | "image-overflow"
    | "js-error"
    | "truncated-text";
  severity: "error" | "warning" | "info";
  message: string;
  element?: string;
}

interface PageResult {
  page: string;
  url: string;
  viewport: string;
  status: number;
  loadTime: number;
  issues: Issue[];
  screenshot: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function runMobileAudit(page: Page, viewportWidth: number): Promise<Issue[]> {
  try {
    return await page.evaluate((vw: number) => {
      const issues: {type: string; severity: string; message: string; element?: string}[] = [];

      // 1. Scroll horizontal
      const scrollWidth = document.documentElement.scrollWidth;
      if (scrollWidth > vw + 2) {
        issues.push({
          type: "horizontal-scroll",
          severity: "error",
          message: `scrollWidth ${scrollWidth}px > viewport ${vw}px (delta: ${scrollWidth - vw}px)`,
        });
      }

      // 2. Elements qui debordent (limiter a 500 elements pour perf)
      const allElements = document.querySelectorAll("body > *, body > * > *, body > * > * > *");
      const overflowing = new Set<string>();
      let checked = 0;
      for (const el of allElements) {
        if (checked++ > 500) break;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > vw + 2) {
          const tag = el.tagName.toLowerCase();
          const cls = el.className ? `.${String(el.className).split(" ").slice(0, 2).join(".")}` : "";
          const selector = `${tag}${cls}`;
          if (!overflowing.has(selector) && overflowing.size < 5) {
            overflowing.add(selector);
            issues.push({
              type: "overflow-element",
              severity: "error",
              message: `right=${Math.round(rect.right)}px > ${vw}px`,
              element: selector.substring(0, 80),
            });
          }
        }
      }

      // 3. Touch targets < 44px (limiter a 50 elements)
      const interactives = document.querySelectorAll('a[href], button, [role="button"]');
      let smallTargets = 0;
      let checkedTargets = 0;
      for (const el of interactives) {
        if (checkedTargets++ > 50) break;
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 5 && (rect.height < 44 || rect.width < 44)) {
          smallTargets++;
          if (smallTargets <= 3) {
            const text = (el.textContent || "").trim().substring(0, 25);
            issues.push({
              type: "touch-target",
              severity: "warning",
              message: `${Math.round(rect.width)}x${Math.round(rect.height)}px < 44px`,
              element: `${el.tagName.toLowerCase()}: "${text}"`,
            });
          }
        }
      }
      if (smallTargets > 3) {
        issues.push({ type: "touch-target", severity: "warning", message: `+${smallTargets - 3} autres < 44px` });
      }

      // 4. Inputs font-size < 16px (zoom iOS)
      const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
      for (const el of inputs) {
        const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
        if (fontSize < 16) {
          const name = (el as HTMLInputElement).name || (el as HTMLInputElement).placeholder || el.tagName;
          issues.push({ type: "input-zoom", severity: "error", message: `font-size ${fontSize}px < 16px`, element: name.substring(0, 40) });
        }
      }

      // 5. Images qui debordent
      for (const img of document.querySelectorAll("img")) {
        const rect = img.getBoundingClientRect();
        if (rect.width > vw + 2) {
          issues.push({ type: "image-overflow", severity: "error", message: `img ${Math.round(rect.width)}px > ${vw}px`, element: (img.alt || img.src || "").substring(0, 60) });
        }
      }

      return issues;
    }, viewportWidth) as Issue[];
  } catch {
    return [{ type: "js-error" as const, severity: "warning" as const, message: "page.evaluate failed (navigation/redirect)" }];
  }
}

// ─── Rapport HTML ────────────────────────────────────────────────────────────

function generateHtmlReport(results: PageResult[]): string {
  const totalPages = new Set(results.map((r) => r.page)).size;
  const totalTests = results.length;
  const totalErrors = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "error").length,
    0
  );
  const totalWarnings = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "warning").length,
    0
  );
  const cleanPages = results.filter(
    (r) => r.issues.filter((i) => i.severity === "error").length === 0
  ).length;

  // Group by page
  const byPage = new Map<string, PageResult[]>();
  results.forEach((r) => {
    const arr = byPage.get(r.page) || [];
    arr.push(r);
    byPage.set(r.page, arr);
  });

  // Issue type stats
  const issueTypes = new Map<string, number>();
  results.forEach((r) => {
    r.issues.forEach((i) => {
      issueTypes.set(i.type, (issueTypes.get(i.type) || 0) + 1);
    });
  });

  const sortedIssueTypes = [...issueTypes.entries()].sort((a, b) => b[1] - a[1]);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit Mobile Complet — AutoMecanik</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.5; padding: 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.2rem; margin: 2rem 0 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
  h3 { font-size: 1rem; margin: 1rem 0 0.5rem; }

  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
  .card { padding: 1.25rem; border-radius: 0.75rem; background: white; border: 1px solid #e2e8f0; text-align: center; }
  .card .value { font-size: 2rem; font-weight: 700; }
  .card .label { font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .card.green .value { color: #16a34a; }
  .card.red .value { color: #dc2626; }
  .card.orange .value { color: #ea580c; }
  .card.blue .value { color: #2563eb; }

  table { width: 100%; border-collapse: collapse; background: white; border-radius: 0.5rem; overflow: hidden; margin: 1rem 0; }
  th, td { padding: 0.6rem 0.8rem; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem; }
  th { background: #f8fafc; font-weight: 600; color: #475569; }
  tr:hover { background: #f8fafc; }

  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  .badge.error { background: #fee2e2; color: #dc2626; }
  .badge.warning { background: #fef3c7; color: #d97706; }
  .badge.info { background: #dbeafe; color: #2563eb; }
  .badge.pass { background: #dcfce7; color: #16a34a; }

  .heatmap td.clean { background: #dcfce7; text-align: center; }
  .heatmap td.warn { background: #fef3c7; text-align: center; }
  .heatmap td.fail { background: #fee2e2; text-align: center; }

  .page-detail { background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.25rem; margin: 1rem 0; }
  .page-detail h3 { margin-top: 0; }
  .issue-list { list-style: none; }
  .issue-list li { padding: 0.3rem 0; font-size: 0.85rem; }
  .issue-list .element { color: #64748b; font-family: monospace; font-size: 0.8rem; }

  .meta { color: #94a3b8; font-size: 0.8rem; margin-top: 2rem; }
  .screenshots { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.5rem 0; }
  .screenshots img { max-width: 120px; border: 1px solid #e2e8f0; border-radius: 0.25rem; }
</style>
</head>
<body>

<h1>Audit Mobile Complet</h1>
<p style="color:#64748b">AutoMecanik — ${new Date().toLocaleDateString("fr-FR")} ${new Date().toLocaleTimeString("fr-FR")}</p>

<div class="summary">
  <div class="card blue"><div class="value">${totalPages}</div><div class="label">Pages testees</div></div>
  <div class="card blue"><div class="value">${totalTests}</div><div class="label">Tests (page x viewport)</div></div>
  <div class="card green"><div class="value">${cleanPages}/${totalTests}</div><div class="label">Sans erreur</div></div>
  <div class="card red"><div class="value">${totalErrors}</div><div class="label">Erreurs</div></div>
  <div class="card orange"><div class="value">${totalWarnings}</div><div class="label">Warnings</div></div>
</div>

<h2>Heatmap — Pages x Viewports</h2>
<table class="heatmap">
<thead><tr><th>Page</th>${VIEWPORTS.map((v) => `<th>${v.name}</th>`).join("")}</tr></thead>
<tbody>
${[...byPage.entries()]
  .map(([pageName, pageResults]) => {
    const cells = VIEWPORTS.map((v) => {
      const r = pageResults.find((pr) => pr.viewport === v.name);
      if (!r) return '<td>-</td>';
      const errors = r.issues.filter((i) => i.severity === "error").length;
      const warnings = r.issues.filter((i) => i.severity === "warning").length;
      if (errors > 0) return `<td class="fail">${errors}E ${warnings}W</td>`;
      if (warnings > 0) return `<td class="warn">${warnings}W</td>`;
      return '<td class="clean">OK</td>';
    }).join("");
    return `<tr><td>${pageName}</td>${cells}</tr>`;
  })
  .join("\n")}
</tbody>
</table>

<h2>Top Issues par Type</h2>
<table>
<thead><tr><th>Type</th><th>Count</th></tr></thead>
<tbody>
${sortedIssueTypes.map(([type, count]) => `<tr><td>${type}</td><td>${count}</td></tr>`).join("\n")}
</tbody>
</table>

<h2>Detail par Page</h2>
${[...byPage.entries()]
  .map(
    ([pageName, pageResults]) => `
<div class="page-detail">
  <h3>${pageName}</h3>
  ${pageResults
    .map(
      (r) => `
  <div style="margin:0.5rem 0">
    <strong>${r.viewport}</strong> — ${r.status} — ${r.loadTime}ms
    ${
      r.issues.length === 0
        ? ' <span class="badge pass">PASS</span>'
        : `
    <ul class="issue-list">
      ${r.issues
        .map(
          (i) =>
            `<li><span class="badge ${i.severity}">${i.severity}</span> [${i.type}] ${i.message}${i.element ? ` <span class="element">${i.element}</span>` : ""}</li>`
        )
        .join("")}
    </ul>`
    }
  </div>`
    )
    .join("")}
</div>`
  )
  .join("\n")}

<p class="meta">Genere par mobile-audit-complete.spec.ts — Playwright ${new Date().toISOString()}</p>

</body>
</html>`;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

const REPORT_DIR = path.join(__dirname, "reports");
const JSON_PATH = path.join(REPORT_DIR, "mobile-audit-results.json");

function appendResult(result: PageResult) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  let results: PageResult[] = [];
  try {
    results = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
  } catch { /* first run */ }
  results.push(result);
  fs.writeFileSync(JSON_PATH, JSON.stringify(results, null, 2), "utf-8");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// Clean previous results
try { fs.unlinkSync(JSON_PATH); } catch { /* ok */ }

for (const viewport of VIEWPORTS) {
  test.describe(`Mobile Audit — ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    for (const pageInfo of PAGES) {
      test(`${pageInfo.name} (${pageInfo.url})`, async ({ page }) => {
        // Setup viewport
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        // Capture JS errors
        const jsErrors: string[] = [];
        page.on("pageerror", (err) => jsErrors.push(err.message));

        // Navigate
        const startTime = Date.now();
        let status = 200;
        try {
          const response = await page.goto(pageInfo.url, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });
          status = response?.status() || 0;
        } catch {
          status = 0;
        }

        // Wait for hydration
        await page.waitForTimeout(1000);

        const loadTime = Date.now() - startTime;

        // Run audit
        const issues = await runMobileAudit(page, viewport.width);

        // Add JS errors
        jsErrors.forEach((err) => {
          issues.push({
            type: "js-error",
            severity: "error",
            message: err.substring(0, 200),
          });
        });

        // Screenshot
        const screenshotDir = path.join(REPORT_DIR, "screenshots");
        fs.mkdirSync(screenshotDir, { recursive: true });

        const safeName = pageInfo.name.replace(/\s+/g, "-").toLowerCase();
        const screenshotFile = `${safeName}_${viewport.name}.png`;
        await page.screenshot({ path: path.join(screenshotDir, screenshotFile), fullPage: false });

        // Save result to JSON file
        const result: PageResult = {
          page: pageInfo.name,
          url: pageInfo.url,
          viewport: viewport.name,
          status,
          loadTime,
          issues,
          screenshot: `screenshots/${screenshotFile}`,
        };
        appendResult(result);

        // Attach issues as test info
        const errors = issues.filter((i) => i.severity === "error");
        test.info().annotations.push({
          type: "issues",
          description: `${errors.length} errors, ${issues.length - errors.length} warnings`,
        });
      });
    }
  });
}

// ─── Rapport final ───────────────────────────────────────────────────────────

test.describe("Rapport", () => {
  test("Generer rapport HTML", async () => {
    let allResults: PageResult[] = [];
    try {
      allResults = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
    } catch {
      test.skip(true, "Pas de resultats a reporter");
      return;
    }

    const html = generateHtmlReport(allResults);
    const reportPath = path.join(REPORT_DIR, "mobile-audit-report.html");
    fs.writeFileSync(reportPath, html, "utf-8");

    const totalErrors = allResults.reduce(
      (s, r) => s + r.issues.filter((i) => i.severity === "error").length, 0
    );
    console.log(`\n📱 Rapport: ${reportPath}`);
    console.log(`   ${allResults.length} tests, ${totalErrors} erreurs`);
  });
});
