/**
 * QA Audit H24 — 8 reusable check functions
 */
import type { Page, Response } from '@playwright/test';

export interface CheckResult {
  check_type: string;
  passed: boolean;
  severity: 'critical' | 'major' | 'minor';
  message: string;
  details?: Record<string, unknown>;
}

// ─── 1. HTTP Status ─────────────────────────────────────────────────────────

export function checkHttpStatus(
  response: Response | null,
  expectedStatus = 200,
): CheckResult {
  const actual = response?.status() ?? 0;
  const passed = actual === expectedStatus;
  return {
    check_type: 'http_status',
    passed,
    severity: 'critical',
    message: passed
      ? `HTTP ${actual} OK`
      : `Expected ${expectedStatus}, got ${actual}`,
    details: { actual, expected: expectedStatus },
  };
}

// ─── 2. Console Errors ──────────────────────────────────────────────────────

export function checkConsoleErrors(errors: string[]): CheckResult {
  const passed = errors.length === 0;
  return {
    check_type: 'console_errors',
    passed,
    severity: 'major',
    message: passed
      ? 'No JS errors'
      : `${errors.length} JS error(s)`,
    details: { errors: errors.slice(0, 5) },
  };
}

// ─── 3. Broken Images ───────────────────────────────────────────────────────

export async function checkBrokenImages(page: Page): Promise<CheckResult> {
  const broken = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src]');
    const bad: string[] = [];
    imgs.forEach((img) => {
      const el = img as HTMLImageElement;
      if (el.naturalWidth === 0 && el.offsetWidth > 0) {
        bad.push(el.src.substring(0, 120));
      }
    });
    return bad;
  });

  return {
    check_type: 'broken_images',
    passed: broken.length === 0,
    severity: 'major',
    message: broken.length === 0
      ? 'All images loaded'
      : `${broken.length} broken image(s)`,
    details: { broken: broken.slice(0, 10) },
  };
}

// ─── 4. Broken Links (sampled) ──────────────────────────────────────────────

export async function checkBrokenLinks(
  page: Page,
  baseUrl: string,
): Promise<CheckResult> {
  const links = await page.evaluate((base) => {
    const anchors = document.querySelectorAll('a[href]');
    const hrefs: string[] = [];
    anchors.forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      if (href.startsWith(base) && !href.includes('#') && !href.includes('mailto:')) {
        hrefs.push(href);
      }
    });
    // Deduplicate and sample max 20
    return [...new Set(hrefs)].slice(0, 20);
  }, baseUrl);

  const broken: { url: string; status: number }[] = [];
  for (const link of links) {
    try {
      const res = await page.request.head(link, { timeout: 5000 });
      const status = res.status();
      if (status >= 400 && status !== 410) {
        broken.push({ url: link.substring(0, 120), status });
      }
    } catch {
      broken.push({ url: link.substring(0, 120), status: 0 });
    }
  }

  return {
    check_type: 'broken_links',
    passed: broken.length === 0,
    severity: broken.length > 0 ? 'major' : 'minor',
    message: broken.length === 0
      ? `${links.length} links checked, all OK`
      : `${broken.length}/${links.length} broken link(s)`,
    details: { broken: broken.slice(0, 10), total_checked: links.length },
  };
}

// ─── 5. Meta SEO ────────────────────────────────────────────────────────────

export async function checkMetaSeo(page: Page): Promise<CheckResult> {
  const meta = await page.evaluate(() => {
    const title = document.title || '';
    const descEl = document.querySelector('meta[name="description"]');
    const description = descEl?.getAttribute('content') || '';
    const canonicalEl = document.querySelector('link[rel="canonical"]');
    const canonical = canonicalEl?.getAttribute('href') || '';
    return { title, description, canonical };
  });

  const issues: string[] = [];

  if (!meta.title) {
    issues.push('Missing <title>');
  } else if (meta.title.length < 20 || meta.title.length > 70) {
    issues.push(`Title length: ${meta.title.length} (ideal: 20-70)`);
  }

  if (!meta.description) {
    issues.push('Missing meta description');
  } else if (meta.description.length < 50 || meta.description.length > 170) {
    issues.push(`Description length: ${meta.description.length} (ideal: 50-170)`);
  }

  if (!meta.canonical) {
    issues.push('Missing canonical');
  }

  return {
    check_type: 'meta_seo',
    passed: issues.length === 0,
    severity: issues.length > 0 ? 'major' : 'minor',
    message: issues.length === 0
      ? 'Meta SEO OK'
      : issues.join('; '),
    details: { ...meta, issues },
  };
}

// ─── 6. Performance (TTFB) ──────────────────────────────────────────────────

export async function checkPerformance(
  page: Page,
  thresholdMs = 3000,
): Promise<CheckResult> {
  const ttfb = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav ? Math.round(nav.responseStart - nav.requestStart) : -1;
  });

  const passed = ttfb >= 0 && ttfb <= thresholdMs;
  return {
    check_type: 'performance_ttfb',
    passed,
    severity: ttfb > thresholdMs * 2 ? 'critical' : 'major',
    message: ttfb >= 0
      ? `TTFB: ${ttfb}ms (threshold: ${thresholdMs}ms)`
      : 'Could not measure TTFB',
    details: { ttfb_ms: ttfb, threshold_ms: thresholdMs },
  };
}

// ─── 7. Accessibility (basic) ───────────────────────────────────────────────

export async function checkAccessibility(page: Page): Promise<CheckResult> {
  const issues = await page.evaluate(() => {
    const problems: string[] = [];

    // Images without alt
    const imgs = document.querySelectorAll('img:not([alt])');
    if (imgs.length > 0) {
      problems.push(`${imgs.length} image(s) without alt`);
    }

    // Inputs without labels
    const inputs = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
    );
    let unlabeled = 0;
    inputs.forEach((input) => {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);
      if (!hasLabel && !ariaLabel && !ariaLabelledBy) unlabeled++;
    });
    if (unlabeled > 0) {
      problems.push(`${unlabeled} input(s) without label`);
    }

    // Heading hierarchy (h1 count)
    const h1s = document.querySelectorAll('h1');
    if (h1s.length === 0) {
      problems.push('No <h1> found');
    } else if (h1s.length > 1) {
      problems.push(`${h1s.length} <h1> tags (should be 1)`);
    }

    return problems;
  });

  return {
    check_type: 'accessibility',
    passed: issues.length === 0,
    severity: 'minor',
    message: issues.length === 0
      ? 'Basic a11y OK'
      : issues.join('; '),
    details: { issues },
  };
}

// ─── 8. Schema.org JSON-LD ──────────────────────────────────────────────────

export async function checkSchemaOrg(page: Page): Promise<CheckResult> {
  const schemas = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const parsed: Array<{ type: string; valid: boolean; error?: string }> = [];
    scripts.forEach((script) => {
      try {
        const json = JSON.parse(script.textContent || '');
        const type = json['@type'] || (Array.isArray(json['@graph']) ? 'Graph' : 'Unknown');
        parsed.push({ type, valid: true });
      } catch (e) {
        parsed.push({ type: 'ParseError', valid: false, error: String(e) });
      }
    });
    return parsed;
  });

  const invalid = schemas.filter((s) => !s.valid);
  const hasSchemas = schemas.length > 0;

  return {
    check_type: 'schema_org',
    passed: hasSchemas && invalid.length === 0,
    severity: !hasSchemas ? 'minor' : invalid.length > 0 ? 'major' : 'minor',
    message: !hasSchemas
      ? 'No JSON-LD found'
      : invalid.length > 0
        ? `${invalid.length}/${schemas.length} invalid JSON-LD`
        : `${schemas.length} valid JSON-LD (${schemas.map((s) => s.type).join(', ')})`,
    details: { schemas },
  };
}
