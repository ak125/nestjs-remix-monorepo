/**
 * R3GuideService — Page engine orchestrator for R3 conseil guide pages.
 * Single method composes 5 existing services into one typed R3GuidePayload.
 * Replaces 5 separate HTTP calls from the Remix route.
 *
 * @deprecated Misnamed legacy: serves R3_CONSEILS canonical content (per
 * @repo/seo-roles), not the deprecated R3_GUIDE role. Will be renamed to
 * `R3ConseilsService` after a 30-day deprecation window (post-2026-06-05).
 * See ADR-044 (vault). Do not extend this service — its successor will
 * delegate here during the rename phase.
 */

import { Injectable, Logger } from '@nestjs/common';
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

/**
 * @deprecated See file-level note. Replacement: `R3ConseilsService`
 * (post-2026-06-05, per ADR-044).
 */
@Injectable()
export class R3GuideService {
  private readonly logger = new Logger(R3GuideService.name);

  constructor(
    private readonly dataService: BlogArticleDataService,
    private readonly seoService: BlogSeoService,
    private readonly relationService: BlogArticleRelationService,
    private readonly internalLinkingService: InternalLinkingService,
  ) {}

  /**
   * Build the complete R3 Guide payload for a given pg_alias.
   * Returns null if no article is found for the gamme.
   */
  async getR3GuidePayload(pg_alias: string): Promise<R3GuidePayload | null> {
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
      this.relationService.getCompatibleVehicles(
        gammeData.pg_id,
        1000,
        pg_alias,
      ),
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
