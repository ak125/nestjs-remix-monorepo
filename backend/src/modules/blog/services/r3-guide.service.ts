/**
 * R3GuideService — Page engine orchestrator for R3 conseil guide pages.
 * Single method composes 5 existing services into one typed R3GuidePayload.
 * Replaces 5 separate HTTP calls from the Remix route.
 *
 * Cache layer:
 *   - Redis cache via CacheService (TTL en secondes)
 *   - Single-flight via inflight Map (anti-stampede)
 *   - Invalidation event-driven via @OnEvent('article.published'|'article.updated')
 *   - Instrumentation hit/miss/coalesced/duration via Logger structuré
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CacheService } from '../../../cache/cache.service';
import { BlogArticleDataService } from './blog-article-data.service';
import { BlogSeoService } from './blog-seo.service';
import { BlogArticleRelationService } from './blog-article-relation.service';
import type { BlogArticle, BlogSection } from '../interfaces/blog.interfaces';
import type {
  R3GuidePayload,
  R3GuidePage,
  R3GuideSection,
} from '../interfaces/r3-guide.interfaces';
import {
  slugifyTitle,
  normalizeStepHtml,
  normalizeDangerHtml,
  deduplicateWords,
  CANONICAL_ORDER,
  calcReadingTime,
  deriveDifficulty,
} from '../utils/html-normalize.utils';
import { PRIX_PAS_CHER } from '../../seo/seo-v4.types';
import { InternalLinkingService } from '../../seo/internal-linking.service';

/** Cache key prefix versionnée — bump v1→v2 invalide tous les payloads.
 *  v2 (2026-05-24) : compatible vehicles capped à 24 (LCP /blog-pieces-auto/conseils/* — voir PR LCP-R3-PR1). */
const R3_CACHE_PREFIX = 'r3-guide:v2:';

/** TTL fresh window (seconds) — CacheService utilise ioredis SETEX en secondes. */
const R3_CACHE_TTL_SECONDS = 30 * 60;

@Injectable()
export class R3GuideService {
  private readonly logger = new Logger(R3GuideService.name);

  /**
   * Single-flight in-memory dedup. N requêtes concurrentes en cache miss
   * sur la même clé partagent un seul compute (1 round-trip Supabase × 9
   * sources, pas 20). Multi-instance : dedup local par replica ; le store
   * Redis partagé visibilise le résultat aux autres replicas après écriture.
   */
  private readonly inflight = new Map<string, Promise<R3GuidePayload | null>>();

  /** Tunable for tests — production code uses default. */
  private cacheTtlSeconds: number = R3_CACHE_TTL_SECONDS;

  constructor(
    private readonly cacheService: CacheService,
    private readonly dataService: BlogArticleDataService,
    private readonly seoService: BlogSeoService,
    private readonly relationService: BlogArticleRelationService,
    private readonly internalLinkingService: InternalLinkingService,
  ) {}

  /**
   * Tests-only override — production code MUST NOT call this.
   *
   * `CacheService.set` calls `redisClient.setex(key, ttl, ...)` which expects
   * an INTEGER number of seconds. Sub-second TTLs (e.g. `0.1`) only work when
   * the underlying CacheService is stubbed — calling this with a non-integer
   * against the real Redis would raise `ERR value is not an integer`.
   *
   * @internal Reserved for unit tests to avoid 30-minute sleeps.
   */
  setCacheTtlForTest(ttlSeconds: number): void {
    this.cacheTtlSeconds = ttlSeconds;
  }

  /**
   * Public entry — Redis cache + single-flight + invalidation events.
   *   1. Cache hit → return immediately (no Supabase round-trip)
   *   2. Cache miss + inflight → coalesce on the running Promise
   *   3. Cache miss + no inflight → compute, store, dedup concurrent callers
   *
   * Negative results (article not found / `null`) are NOT cached —
   * recomputed each call, by design. Trade-off: 404 storms re-execute the
   * 9-fanout, but cached null risks delaying legitimate publishes.
   */
  async getR3GuidePayload(pg_alias: string): Promise<R3GuidePayload | null> {
    const cacheKey = `${R3_CACHE_PREFIX}${pg_alias}`;
    const startedAt = Date.now();

    const cached = await this.cacheService.get<R3GuidePayload | null>(cacheKey);
    if (cached !== null) {
      this.logger.debug(
        `[r3-cache] hit key=${cacheKey} duration_ms=${Date.now() - startedAt}`,
      );
      return cached;
    }

    const existing = this.inflight.get(cacheKey);
    if (existing) {
      this.logger.debug(`[r3-cache] coalesced key=${cacheKey}`);
      return existing;
    }

    const promise = (async () => {
      const computeStart = Date.now();
      try {
        const payload = await this.computeLegacyPayload(pg_alias);
        if (payload !== null) {
          // Cache write is best-effort: a Redis blip must not 500 a request
          // that already has a valid payload in hand. Inconsistent with
          // CacheService.set rethrow semantics; isolate the failure here.
          try {
            await this.cacheService.set(
              cacheKey,
              payload,
              this.cacheTtlSeconds,
            );
          } catch (cacheErr) {
            this.logger.error(
              `[r3-cache] set-failed key=${cacheKey} — payload returned uncached`,
              cacheErr instanceof Error ? cacheErr.stack : String(cacheErr),
            );
          }
        }
        this.logger.log(
          `[r3-cache] miss key=${cacheKey} duration_ms=${Date.now() - computeStart} cached=${payload !== null}`,
        );
        return payload;
      } catch (err) {
        this.logger.error(
          `[r3-cache] miss-error key=${cacheKey} duration_ms=${Date.now() - computeStart}`,
          err instanceof Error ? err.stack : String(err),
        );
        throw err;
      } finally {
        this.inflight.delete(cacheKey);
      }
    })();

    this.inflight.set(cacheKey, promise);
    return promise;
  }

  /**
   * Invalidate the cached payload when an article is published/updated.
   * Wire emitters in admin endpoints: `eventEmitter.emit('article.published', { pg_alias })`.
   * If no event is wired, cache falls back to TTL expiration only.
   */
  @OnEvent('article.published')
  @OnEvent('article.updated')
  async onArticleChanged(payload: { pg_alias?: string } | undefined) {
    const pg_alias = payload?.pg_alias;
    if (!pg_alias) {
      // Loud no-op : a malformed event leaves the cache stale until TTL.
      // Log so an operator can spot a broken emitter contract.
      this.logger.warn(
        `[r3-cache] article event received without pg_alias — invalidation skipped (payload=${JSON.stringify(payload)})`,
      );
      return;
    }
    const cacheKey = `${R3_CACHE_PREFIX}${pg_alias}`;
    await this.cacheService.del(cacheKey);
    this.logger.log(`[r3-cache] invalidated key=${cacheKey} on article event`);
  }

  /**
   * Original implementation extracted intact — composes 9 Supabase round-trips.
   * Structural debt to be addressed in a separate plan
   * (R3GuideService fanout reduction via PostgreSQL RPC).
   */
  private async computeLegacyPayload(
    pg_alias: string,
  ): Promise<R3GuidePayload | null> {
    // Step 1 — Resolve article by gamme (blocking)
    const { article, gammeData } =
      await this.dataService.getArticleByGamme(pg_alias);

    if (!article || !gammeData) {
      this.logger.warn(`No article found for pg_alias="${pg_alias}"`);
      return null;
    }

    this.logger.log(
      `R3 Guide: ${pg_alias} → article "${article.title}" (pg_id=${gammeData.pg_id})`,
    );

    // Step 2 — Parallel fetch of all supplementary data
    const [
      conseil,
      seoSwitches,
      relatedArticles,
      vehicles,
      adjacent,
      seoBrief,
      hasR6Guide,
    ] = await Promise.all([
      this.seoService.getGammeConseil(gammeData.pg_id),
      this.seoService.getSeoItemSwitches(gammeData.pg_id),
      this.dataService.getRelatedArticles(article.legacy_id),
      // LCP fix R3 conseils : carrousel affiche 12 par défaut (PAGE_SIZE), pagination locale +12.
      // Cap 24 = 2× safety margin → -150 KB payload SSR mobile vs 1000 véhicules (~80% du JSON).
      // Trade-off documenté : count "X motorisations" affiché reflète désormais le sample (24 max),
      // pas le total catalogue compat — accepté (les vehicle pages sont déjà dans sitemap.xml).
      this.relationService.getCompatibleVehicles(gammeData.pg_id, 24, pg_alias),
      this.dataService.getAdjacentArticles(article.slug),
      this.seoService.getSeoBrief(gammeData.pg_id),
      this.seoService.hasPublishedR6Guide(gammeData.pg_id),
    ]);

    // Step 3 — Resolve canonical sections (port of frontend resolveCanonicalSections)
    const { s1Sections, bodySections, metaSections, sourceType } =
      await this.resolveCanonicalSections(conseil, article.sections, article);

    // Step 3b — Inject approved images into sections
    const approvedImages = await this.seoService.getApprovedImages(
      gammeData.pg_id,
    );
    const imageMap = new Map(approvedImages.map((img) => [img.sectionId, img]));
    const heroImg = imageMap.get('HERO');

    for (const section of [...s1Sections, ...bodySections]) {
      const img = imageMap.get(section.sectionType ?? '');
      if (img) {
        section.image = {
          src: img.src,
          alt: img.alt,
          caption: img.caption ?? undefined,
          aspectRatio: img.aspectRatio,
          loading: section.sectionType === 'S1' ? 'eager' : 'lazy',
        };
      }
    }

    // Step 4 — Compute page metrics
    const allSections = [...s1Sections, ...bodySections, ...metaSections];
    const readingTime = calcReadingTime(allSections);
    const { difficulty, durationMin, safetyLevel } =
      deriveDifficulty(bodySections);

    // Step 5 — Assemble page metadata
    // Priority chain: pipeline seo_brief > legacy seo_data > h1/excerpt fallback
    const page: R3GuidePage = {
      pg_alias,
      pg_id: gammeData.pg_id,
      title: article.h1 || article.title,
      metaTitle:
        seoBrief?.meta_title ||
        article.seo_data?.meta_title ||
        article.h1 ||
        article.title,
      metaDescription: this.stripPricingFromHero(
        seoBrief?.meta_description ||
          article.seo_data?.meta_description ||
          article.excerpt,
      ),
      excerpt: this.stripPricingFromHero(article.excerpt),
      keywords: article.keywords || [],
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt || article.publishedAt,
      featuredImage: heroImg?.src || article.featuredImage || null,
      viewsCount: article.viewsCount || 0,
      readingTime,
      difficulty,
      durationMin,
      safetyLevel,
      sourceType,
      tags: article.tags || [],
      cta_link: article.cta_link || null,
      cta_anchor: article.cta_anchor || null,
      hasR6Guide,
    };

    return {
      page,
      s1Sections,
      bodySections,
      metaSections,
      related: relatedArticles || [],
      vehicles: vehicles || [],
      seoSwitches: seoSwitches || [],
      adjacent: {
        previous: adjacent.previous || null,
        next: adjacent.next || null,
      },
    };
  }

  // ── Private: canonical section resolution ──────────────────────

  private async resolveCanonicalSections(
    conseil: Array<{
      title: string;
      content: string;
      sectionType: string | null;
      order: number | null;
      qualityScore: number | null;
      sources: string[];
    }>,
    articleSections: BlogSection[],
    _article: BlogArticle,
  ): Promise<{
    s1Sections: R3GuideSection[];
    bodySections: R3GuideSection[];
    metaSections: R3GuideSection[];
    sourceType: 'conseil' | 'article';
  }> {
    const hasConseil = conseil.some(
      (c) =>
        c.sectionType && c.sectionType !== 'S1' && c.sectionType !== 'META',
    );

    if (hasConseil) {
      return this.resolveConseilMode(conseil);
    }

    return this.resolveArticleMode(articleSections, conseil);
  }

  private async resolveConseilMode(
    conseil: Array<{
      title: string;
      content: string;
      sectionType: string | null;
      order: number | null;
      qualityScore: number | null;
      sources: string[];
    }>,
  ): Promise<{
    s1Sections: R3GuideSection[];
    bodySections: R3GuideSection[];
    metaSections: R3GuideSection[];
    sourceType: 'conseil';
  }> {
    const s1 = conseil.filter((c) => c.sectionType === 'S1');
    const meta = conseil.filter((c) => c.sectionType === 'META');
    const body = conseil
      .filter(
        (c) =>
          c.sectionType && c.sectionType !== 'S1' && c.sectionType !== 'META',
      )
      .sort((a, b) => {
        const oa = CANONICAL_ORDER[a.sectionType ?? ''] ?? 90;
        const ob = CANONICAL_ORDER[b.sectionType ?? ''] ?? 90;
        return oa - ob;
      });

    const [s1Sections, bodySections, metaSections] = await Promise.all([
      Promise.all(s1.map((s, i) => this.mapConseilSection(s, i))),
      Promise.all(body.map((s, i) => this.mapConseilSection(s, i))),
      Promise.all(meta.map((s, i) => this.mapConseilSection(s, i))),
    ]);

    return { s1Sections, bodySections, metaSections, sourceType: 'conseil' };
  }

  private async resolveArticleMode(
    articleSections: BlogSection[],
    conseil: Array<{
      title: string;
      content: string;
      sectionType: string | null;
      order: number | null;
      qualityScore: number | null;
      sources: string[];
    }>,
  ): Promise<{
    s1Sections: R3GuideSection[];
    bodySections: R3GuideSection[];
    metaSections: R3GuideSection[];
    sourceType: 'article';
  }> {
    // Even in article mode, S1 sections from conseil may exist
    const s1 = conseil.filter((c) => c.sectionType === 'S1');

    // Resolve #LinkGamme tokens in article body sections too
    const bodySections: R3GuideSection[] = await Promise.all(
      articleSections.map(async (s, i) => ({
        sectionType: null,
        level: s.level as 2 | 3,
        title: s.title,
        anchor: s.anchor || slugifyTitle(s.title),
        order: i,
        html: deduplicateWords(
          await this.internalLinkingService.processLinkGamme(s.content),
        ),
        sources: [],
        qualityScore: null,
      })),
    );

    return {
      s1Sections: await Promise.all(
        s1.map((s, i) => this.mapConseilSection(s, i)),
      ),
      bodySections,
      metaSections: [],
      sourceType: 'article',
    };
  }

  private async mapConseilSection(
    s: {
      title: string;
      content: string;
      sectionType: string | null;
      order: number | null;
      qualityScore: number | null;
      sources: string[];
    },
    index: number,
  ): Promise<R3GuideSection> {
    // Pre-normalize HTML for S4 and S5 sections
    let html = s.content;
    if (s.sectionType === 'S4_DEPOSE' || s.sectionType === 'S4_REPOSE') {
      html = normalizeStepHtml(html);
    } else if (s.sectionType === 'S5') {
      html = normalizeDangerHtml(html);
    }

    // Resolve #LinkGamme_#### tokens → <a> links
    html = await this.internalLinkingService.processLinkGamme(html);

    // Clean accidental word duplicates from RAG/enrichment ("km km" → "km")
    html = deduplicateWords(html);

    return {
      sectionType: s.sectionType,
      title: s.title,
      anchor: slugifyTitle(s.title),
      order: s.order ?? index,
      html,
      sources: s.sources,
      qualityScore: s.qualityScore,
    };
  }

  // ── Private: anti-cannibalization pricing filter ────────────

  private static readonly PRICING_RE = new RegExp(
    PRIX_PAS_CHER.join('|'),
    'gi',
  );

  private stripPricingFromHero(text: string | undefined | null): string {
    if (!text) return '';
    return text
      .replace(R3GuideService.PRICING_RE, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}
