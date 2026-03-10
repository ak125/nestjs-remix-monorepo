/**
 * QA Audit H24 — Custom Playwright Reporter → Supabase
 *
 * Writes run results and issues directly to Supabase tables:
 *   __qa_audit_runs, __qa_audit_issues, __qa_audit_alerts
 *
 * Env vars:
 *   SUPABASE_URL           — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (bypasses RLS)
 *   QA_ALERT_WEBHOOK_URL   — Optional webhook for critical alerts
 */

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

interface RunRecord {
  id?: string;
  suite: string;
  status: string;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  viewport: string;
  environment: string;
}

class SupabaseQaReporter implements Reporter {
  private supabaseUrl: string;
  private supabaseKey: string;
  private webhookUrl: string;
  private runId: string | null = null;
  private suiteName = 'unknown';
  private viewport = 'unknown';
  private counts = { total: 0, passed: 0, failed: 0, skipped: 0 };
  private criticalIssues: Array<{ page: string; message: string }> = [];

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.webhookUrl = process.env.QA_ALERT_WEBHOOK_URL || '';
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      apikey: this.supabaseKey,
      Authorization: `Bearer ${this.supabaseKey}`,
      Prefer: 'return=representation',
    };
  }

  private async supabaseInsert(table: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    if (!this.supabaseUrl || !this.supabaseKey) return null;
    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        console.error(`[QA Reporter] Insert ${table} failed: ${res.status} ${await res.text()}`);
        return null;
      }
      const rows = await res.json();
      return Array.isArray(rows) ? rows[0] : rows;
    } catch (e) {
      console.error(`[QA Reporter] Insert ${table} error:`, e);
      return null;
    }
  }

  private async supabaseUpdate(table: string, id: string, data: Record<string, unknown>): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) return;
    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...this.headers, Prefer: 'return=minimal' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        console.error(`[QA Reporter] Update ${table} failed: ${res.status}`);
      }
    } catch (e) {
      console.error(`[QA Reporter] Update ${table} error:`, e);
    }
  }

  async onBegin(_config: FullConfig, suite: Suite): Promise<void> {
    // Detect suite name from test file names
    const testFiles = suite.allTests().map((t) => t.location.file);
    if (testFiles.some((f) => f.includes('functional'))) this.suiteName = 'functional';
    else if (testFiles.some((f) => f.includes('visual'))) this.suiteName = 'visual';
    else if (testFiles.some((f) => f.includes('seo-tech'))) this.suiteName = 'seo-tech';

    // Detect viewport from project name
    const projects = suite.allTests().map((t) => t.parent?.project()?.name).filter(Boolean);
    this.viewport = projects[0] || 'unknown';

    this.counts = { total: suite.allTests().length, passed: 0, failed: 0, skipped: 0 };

    const row = await this.supabaseInsert('__qa_audit_runs', {
      suite: this.suiteName,
      status: 'running',
      viewport: this.viewport,
      environment: 'production',
    });

    if (row?.id) {
      this.runId = row.id as string;
      console.log(`[QA Reporter] Run created: ${this.runId} (${this.suiteName}/${this.viewport})`);
    }
  }

  async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
    if (result.status === 'passed') this.counts.passed++;
    else if (result.status === 'skipped') this.counts.skipped++;
    else this.counts.failed++;

    // Only record issues for failures
    if (result.status !== 'passed' && result.status !== 'skipped' && this.runId) {
      const pageUrl = this.extractPageUrl(test.title);
      const severity = this.inferSeverity(test, result);
      const message = result.errors.map((e) => e.message?.substring(0, 300) || 'Unknown error').join('; ') || test.title;

      await this.supabaseInsert('__qa_audit_issues', {
        run_id: this.runId,
        page_url: pageUrl,
        check_type: this.extractCheckType(test),
        severity,
        message: message.substring(0, 500),
        details: {
          test_title: test.title,
          duration_ms: result.duration,
          retry: result.retry,
          errors: result.errors.slice(0, 3).map((e) => e.message?.substring(0, 200)),
        },
        viewport: this.viewport,
      });

      if (severity === 'critical') {
        this.criticalIssues.push({ page: pageUrl, message: message.substring(0, 200) });
      }
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    const status = this.counts.failed > 0 ? 'fail' : 'pass';

    if (this.runId) {
      await this.supabaseUpdate('__qa_audit_runs', this.runId, {
        status,
        finished_at: new Date().toISOString(),
        total_tests: this.counts.total,
        passed: this.counts.passed,
        failed: this.counts.failed,
        skipped: this.counts.skipped,
      });
      console.log(`[QA Reporter] Run ${this.runId}: ${status} (${this.counts.passed}/${this.counts.total} passed)`);
    }

    // Send alert if critical issues found
    if (this.criticalIssues.length > 0) {
      await this.sendAlert();
    }
  }

  private async sendAlert(): Promise<void> {
    const payload = {
      text: `[QA Audit] ${this.criticalIssues.length} CRITICAL issue(s) in ${this.suiteName}/${this.viewport}`,
      suite: this.suiteName,
      viewport: this.viewport,
      run_id: this.runId,
      critical_count: this.criticalIssues.length,
      issues: this.criticalIssues.slice(0, 5),
      timestamp: new Date().toISOString(),
    };

    // Record alert in Supabase
    if (this.runId) {
      await this.supabaseInsert('__qa_audit_alerts', {
        run_id: this.runId,
        channel: 'webhook',
        payload,
        status: 'sent',
      });
    }

    // Send webhook
    if (this.webhookUrl) {
      try {
        await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        console.log(`[QA Reporter] Alert sent to webhook`);
      } catch (e) {
        console.error(`[QA Reporter] Webhook failed:`, e);
      }
    }
  }

  private extractPageUrl(testTitle: string): string {
    // Test titles follow pattern: "Page Name (url)" or contain url
    const match = testTitle.match(/\(([^)]+)\)/);
    return match?.[1] || testTitle.substring(0, 100);
  }

  private extractCheckType(test: TestCase): string {
    // Extract from parent describe block
    const parts = test.titlePath();
    // Look for known check types in the path
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower.includes('http status')) return 'http_status';
      if (lower.includes('console')) return 'console_errors';
      if (lower.includes('broken image')) return 'broken_images';
      if (lower.includes('broken link')) return 'broken_links';
      if (lower.includes('meta seo') || lower.includes('meta tag')) return 'meta_seo';
      if (lower.includes('performance') || lower.includes('ttfb')) return 'performance_ttfb';
      if (lower.includes('accessib') || lower.includes('a11y')) return 'accessibility';
      if (lower.includes('schema') || lower.includes('json-ld')) return 'schema_org';
      if (lower.includes('header') && lower.includes('footer')) return 'header_footer';
      if (lower.includes('overflow')) return 'overflow';
      if (lower.includes('touch')) return 'touch_targets';
      if (lower.includes('cta')) return 'cta_visibility';
      if (lower.includes('font')) return 'font_loading';
      if (lower.includes('responsive')) return 'responsive_images';
      if (lower.includes('https')) return 'https_redirect';
      if (lower.includes('robots')) return 'robots_txt';
      if (lower.includes('sitemap')) return 'sitemap_xml';
      if (lower.includes('open graph') || lower.includes('og:')) return 'open_graph';
      if (lower.includes('security header')) return 'security_headers';
    }
    return 'unknown';
  }

  private inferSeverity(test: TestCase, _result: TestResult): 'critical' | 'major' | 'minor' {
    const checkType = this.extractCheckType(test);
    // Critical: site down, HTTP errors, HTTPS broken
    if (['http_status', 'https_redirect'].includes(checkType)) return 'critical';
    // Major: broken content, SEO issues
    if (['console_errors', 'broken_images', 'broken_links', 'meta_seo', 'performance_ttfb'].includes(checkType)) return 'major';
    // Minor: a11y, schema, visual
    return 'minor';
  }
}

export default SupabaseQaReporter;
