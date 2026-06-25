/**
 * SyntheticCrawlerService — L1 Collector du SEO Production Control Plane.
 *
 * Crawl un échantillon stratifié d'URLs par criticality tier sous UA
 * identifiable (JAMAIS spoof Googlebot). Capture HTTP code, latency,
 * CF cache headers, et signaux HTML (title/h1/canonical/robots).
 *
 * ADR-064 §Architecture L1 — read-only, pure data ingestion. Pas
 * d'évaluation (= L2), pas d'action (= L3). Écrit dans
 * `__seo_snapshot_synthetic` uniquement.
 *
 * Sampling :
 *   - URLs source = sitemap PROD (`sitemap-pieces-*.xml`,
 *     `sitemap-categories.xml`, `sitemap-vehicules.xml`).
 *   - Stratification par tier via `CriticalityLoaderService.classify()`.
 *   - Poids `sampling_weight` lu depuis L4 governance (criticality.yaml).
 *
 * Sécurité runtime :
 *   - UA identifiable obligatoire (cf. feedback_synthetic_bot_ua_never_spoof_googlebot)
 *   - Concurrency pool = 10 (limite Supabase RPC chaud non-stampede)
 *   - Timeout 15s par URL (au-delà = error 'timeout')
 *   - Aucune écriture autre que __seo_snapshot_synthetic
 *
 * Discipline 4-layer : aucune lecture L2/L3, aucune écriture L4.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { TierId } from '@repo/registry';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { CriticalityLoaderService } from '../../services/criticality-loader.service';
import { SyntheticProbeCredentialService } from '../../synthetic-probe-credential.service';
import {
  SYNTHETIC_USER_AGENT,
  SYNTHETIC_PROBE_HEADER,
  SYNTHETIC_PROBE_ENABLED_KEY,
  type SyntheticCrawlJobData,
  type SyntheticRunResult,
  type SyntheticSnapshot,
} from '../../types';

const PROD_BASE_DEFAULT = 'https://www.automecanik.com';
const SUB_PATTERN =
  /(sitemap-pieces-\d+|sitemap-categories|sitemap-vehicules)\.xml$/;

interface UrlCandidate {
  url: string;
  route_path: string;
  tier: TierId;
}

@Injectable()
export class SyntheticCrawlerService extends SupabaseBaseService {
  // override base logger to use this service's name in logs
  protected readonly logger = new Logger(SyntheticCrawlerService.name);
  // local alias avoiding base's optional `configService` typing
  private readonly cfg: ConfigService;

  constructor(
    private readonly criticality: CriticalityLoaderService,
    configService: ConfigService,
    private readonly probeCredential: SyntheticProbeCredentialService,
  ) {
    super(configService);
    this.cfg = configService;
  }

  /**
   * En-têtes de sonde : UA identifiable + (si le credential est actif) un HMAC
   * `x-synthetic-probe` signé sur (GET|pathname|fenêtre) pour être exempté du
   * rate-limiter sans usurper d'UA. Si l'exemption est OFF/non provisionnée, le
   * header est omis (la sonde sera throttlée — surfacé par l'alerte 429 du run).
   */
  private buildProbeHeaders(url: string): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': SYNTHETIC_USER_AGENT,
    };
    if (this.probeCredential.isActive()) {
      try {
        const { pathname } = new URL(url);
        headers[SYNTHETIC_PROBE_HEADER] = this.probeCredential.sign(
          'GET',
          pathname,
        );
      } catch {
        // URL malformée — pas de header ; la sonde sera throttlée (observable).
      }
    }
    return headers;
  }

  /**
   * Exécute un run complet : sitemap fetch → stratification → probe pool →
   * INSERT batch. Retourne un résumé agrégé pour l'audit-trail BullMQ.
   */
  async run(job: SyntheticCrawlJobData): Promise<SyntheticRunResult> {
    const startedAtMs = Date.now();
    const runId = randomUUID();
    const seed = job.seed ?? Date.now();
    const sampleSize = job.sampleSize ?? this.defaultSampleSize();

    const result: SyntheticRunResult = {
      run_id: runId,
      started_at: new Date(startedAtMs).toISOString(),
      finished_at: '',
      duration_ms: 0,
      triggered_by: job.triggeredBy,
      sample_size_requested: sampleSize,
      sample_size_effective: 0,
      seed,
      totals: { http_2xx: 0, http_3xx: 0, http_4xx: 0, http_5xx: 0, error: 0 },
      by_tier: {
        tier0: { probed: 0, rate_5xx: 0 },
        tier1: { probed: 0, rate_5xx: 0 },
        tier2: { probed: 0, rate_5xx: 0 },
      },
    };

    this.logger.log(
      `🤖 synthetic-crawler run starting (run_id=${runId} seed=${seed} sample=${sampleSize} triggeredBy=${job.triggeredBy})`,
    );

    let candidates: UrlCandidate[];
    try {
      candidates = await this.collectCandidates();
    } catch (err) {
      this.logger.error(
        `❌ sitemap fetch failed: ${this.errMsg(err)} — aborting run`,
      );
      result.skipped = 'no_sitemap';
      result.errorMessage = this.errMsg(err);
      return this.finalize(result, startedAtMs);
    }

    const sampled = this.stratifiedSample(candidates, seed, sampleSize);
    result.sample_size_effective = sampled.length;

    if (sampled.length === 0) {
      this.logger.warn(
        `⚠️ stratified sample empty (sitemap returned ${candidates.length} candidates) — aborting`,
      );
      result.skipped = 'no_sitemap';
      return this.finalize(result, startedAtMs);
    }

    const snapshots = await this.probeAll(sampled, runId, seed);

    // Aggregate
    const tierCounts: Record<TierId, { probed: number; fail_5xx: number }> = {
      tier0: { probed: 0, fail_5xx: 0 },
      tier1: { probed: 0, fail_5xx: 0 },
      tier2: { probed: 0, fail_5xx: 0 },
    };
    let http429 = 0;
    for (const s of snapshots) {
      if (s.error_kind != null || s.http_code === 0) result.totals.error++;
      else if (s.http_code >= 500) result.totals.http_5xx++;
      else if (s.http_code >= 400) result.totals.http_4xx++;
      else if (s.http_code >= 300) result.totals.http_3xx++;
      else if (s.http_code >= 200) result.totals.http_2xx++;
      if (s.http_code === 429) http429++;
      const t = tierCounts[s.tier];
      t.probed++;
      if (s.http_code >= 500) t.fail_5xx++;
    }

    // 🚨 Observabilité anti silent-fallback : si une part anormale des sondes est
    // throttlée (429), l'exemption rate-limit est probablement inactive (flag OFF,
    // secret non provisionné) ou a dérivé → le monitoring L1 redevient AVEUGLE.
    // On le rend BRUYANT (log.error, visible Sentry) plutôt que de dégrader en
    // silence (incident 2026-06-25 : 89,7 % de 429 jamais alertés).
    if (snapshots.length > 0) {
      const rate429 = http429 / snapshots.length;
      if (rate429 > 0.2) {
        this.logger.error(
          `🚨 synthetic-crawler: ${(rate429 * 100).toFixed(1)}% des sondes throttlées ` +
            `(${http429}/${snapshots.length} en 429). L'exemption rate-limit est ` +
            `probablement inactive (${SYNTHETIC_PROBE_ENABLED_KEY}/secret) ou a dérivé — ` +
            `monitoring L1 dégradé.`,
        );
      }
    }
    for (const tier of ['tier0', 'tier1', 'tier2'] as TierId[]) {
      const t = tierCounts[tier];
      result.by_tier[tier] = {
        probed: t.probed,
        rate_5xx: t.probed > 0 ? t.fail_5xx / t.probed : 0,
      };
    }

    // Persist
    try {
      await this.persist(snapshots);
    } catch (err) {
      this.logger.error(
        `❌ persist failed (${snapshots.length} snapshots): ${this.errMsg(err)} — run aggregate still returned but rows lost`,
      );
      result.errorMessage = `persist: ${this.errMsg(err)}`;
    }

    return this.finalize(result, startedAtMs);
  }

  /** Lit + parse le sitemap PROD, retourne les URLs candidate-classifiées. */
  private async collectCandidates(): Promise<UrlCandidate[]> {
    const base = this.cfg.get<string>('SEO_CP_PROD_BASE', PROD_BASE_DEFAULT);
    const indexXml = await this.fetchText(`${base}/sitemap.xml`, 15_000);
    const subUrls: string[] = [];
    for (const m of indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (SUB_PATTERN.test(m[1])) subUrls.push(m[1]);
    }

    const allUrls: string[] = [];
    for (const sub of subUrls) {
      try {
        const xml = await this.fetchText(sub, 15_000);
        for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
          allUrls.push(m[1]);
        }
      } catch (err) {
        this.logger.warn(
          `sub-sitemap fetch failed (${sub}): ${this.errMsg(err)}`,
        );
      }
    }

    const out: UrlCandidate[] = [];
    for (const u of allUrls) {
      try {
        const parsed = new URL(u);
        const tierResult = this.criticality.classify(parsed.pathname);
        if (tierResult === 'excluded' || tierResult === null) continue;
        out.push({ url: u, route_path: parsed.pathname, tier: tierResult });
      } catch {
        // skip malformed
      }
    }
    return out;
  }

  /**
   * Sample stratifié par sampling_weight (lu de L4). Seedé (mulberry32)
   * pour reproductibilité.
   */
  private stratifiedSample(
    candidates: UrlCandidate[],
    seed: number,
    total: number,
  ): UrlCandidate[] {
    const config = this.criticality.getConfig();
    const rng = this.mulberry32(seed);
    const out: UrlCandidate[] = [];
    const tiers: TierId[] = ['tier0', 'tier1', 'tier2'];

    for (const tier of tiers) {
      const weight = config.tiers[tier].sampling_weight;
      const want = Math.max(1, Math.floor(total * weight));
      const pool = candidates.filter((c) => c.tier === tier);
      const shuffled = this.shuffle(pool, rng);
      out.push(...shuffled.slice(0, want));
    }
    return out;
  }

  /** Probe HTTP+HTML pour chaque URL, pool de concurrency. */
  private async probeAll(
    cands: UrlCandidate[],
    runId: string,
    seed: number,
  ): Promise<SyntheticSnapshot[]> {
    const concurrency = this.cfg.get<number>('SEO_CP_CONCURRENCY', 10);
    const timeoutMs = this.cfg.get<number>('SEO_CP_TIMEOUT_MS', 15_000);
    const results: SyntheticSnapshot[] = [];
    let i = 0;

    const worker = async (): Promise<void> => {
      while (i < cands.length) {
        const idx = i++;
        results[idx] = await this.probe(cands[idx], runId, seed, timeoutMs);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
  }

  /** Single URL probe — fetch + HTML parse (regex minimal, no full DOM). */
  private async probe(
    cand: UrlCandidate,
    runId: string,
    seed: number,
    timeoutMs: number,
  ): Promise<SyntheticSnapshot> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const t0 = Date.now();
    try {
      const res = await fetch(cand.url, {
        signal: ctrl.signal,
        headers: this.buildProbeHeaders(cand.url),
        redirect: 'manual',
      });
      const ttfb = Date.now() - t0;
      const body = await res.text();
      const html = body.slice(0, 200_000); // cap pour mémoire — title/h1/canonical sont en head
      const title = this.extractFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
      const h1 = this.extractFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const canonical = this.extractAttr(
        html,
        /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
      );
      const robotsMeta = this.extractAttr(
        html,
        /<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i,
      );

      return {
        url: cand.url,
        route_path: cand.route_path,
        tier: cand.tier,
        http_code: res.status,
        ttfb_ms: ttfb,
        content_length: body.length,
        cache_control: res.headers.get('cache-control'),
        cf_cache_status: res.headers.get('cf-cache-status'),
        cf_ray: res.headers.get('cf-ray'),
        age_seconds: this.parseInt(res.headers.get('age')),
        has_title: title !== null,
        title_text: title ? title.slice(0, 500) : null,
        has_h1: h1 !== null,
        // Store raw inner content truncated to 500 chars. We intentionally
        // do NOT strip nested HTML tags : regex stripping is brittle on
        // nested/malformed markup (CodeQL js/incomplete-multi-character-
        // sanitization) and not security-critical here — L2 drift engine
        // compares raw strings, doesn't render them. If a real DOM strip is
        // needed later, use cheerio or domhandler.
        h1_text: h1 ? h1.slice(0, 500) : null,
        has_canonical: canonical !== null,
        canonical_url: canonical,
        robots_meta: robotsMeta,
        x_robots_tag: res.headers.get('x-robots-tag'),
        error_kind: null,
        error_message: null,
        run_id: runId,
        seed,
        user_agent: SYNTHETIC_USER_AGENT,
        created_at: new Date().toISOString(),
      };
    } catch (err) {
      const name = err instanceof Error ? err.name : 'unknown';
      const errorKind: SyntheticSnapshot['error_kind'] =
        name === 'AbortError' || name === 'TimeoutError'
          ? 'timeout'
          : 'network';
      return {
        url: cand.url,
        route_path: cand.route_path,
        tier: cand.tier,
        http_code: 0,
        ttfb_ms: Date.now() - t0,
        content_length: null,
        cache_control: null,
        cf_cache_status: null,
        cf_ray: null,
        age_seconds: null,
        has_title: null,
        title_text: null,
        has_h1: null,
        h1_text: null,
        has_canonical: null,
        canonical_url: null,
        robots_meta: null,
        x_robots_tag: null,
        error_kind: errorKind,
        error_message: this.errMsg(err).slice(0, 500),
        run_id: runId,
        seed,
        user_agent: SYNTHETIC_USER_AGENT,
        created_at: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * INSERT batch dans __seo_snapshot_synthetic. `this.supabase` est exposé
   * par SupabaseBaseService et utilise déjà le service-role key.
   */
  private async persist(snapshots: SyntheticSnapshot[]): Promise<void> {
    if (snapshots.length === 0) return;
    const { error } = await this.supabase
      .from('__seo_snapshot_synthetic')
      .insert(snapshots);
    if (error) throw new Error(`Supabase insert error: ${error.message}`);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private defaultSampleSize(): number {
    return this.cfg.get<number>('SEO_CP_SAMPLE_SIZE', 500);
  }

  private async fetchText(url: string, timeoutMs: number): Promise<string> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: this.buildProbeHeaders(url),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private finalize(
    r: SyntheticRunResult,
    startedAtMs: number,
  ): SyntheticRunResult {
    r.finished_at = new Date().toISOString();
    r.duration_ms = Date.now() - startedAtMs;
    const total = r.sample_size_effective || 1;
    this.logger.log(
      `✅ run ${r.run_id} done in ${r.duration_ms}ms — ` +
        `${r.totals.http_2xx} 2xx / ${r.totals.http_3xx} 3xx / ${r.totals.http_4xx} 4xx / ` +
        `${r.totals.http_5xx} 5xx / ${r.totals.error} err — ` +
        `rate_5xx tier0=${(r.by_tier.tier0.rate_5xx * 100).toFixed(2)}% ` +
        `tier1=${(r.by_tier.tier1.rate_5xx * 100).toFixed(2)}% ` +
        `tier2=${(r.by_tier.tier2.rate_5xx * 100).toFixed(2)}% ` +
        `(sample=${total})`,
    );
    return r;
  }

  private mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private shuffle<T>(arr: T[], rng: () => number): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  private extractFirst(html: string, re: RegExp): string | null {
    const m = html.match(re);
    return m ? m[1].trim() : null;
  }

  private extractAttr(html: string, re: RegExp): string | null {
    const m = html.match(re);
    return m ? m[1].trim() : null;
  }

  private parseInt(v: string | null): number | null {
    if (v == null) return null;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
