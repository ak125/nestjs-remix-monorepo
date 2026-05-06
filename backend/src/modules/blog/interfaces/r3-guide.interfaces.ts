/**
 * R3 Guide Page Engine — Typed payload contract.
 * Single endpoint GET /api/r3-guide/:pg_alias returns this structure.
 *
 * @deprecated Misnamed legacy: this contract serves R3_CONSEILS canonical
 * content (per @repo/seo-roles), not the deprecated R3_GUIDE role. Will be
 * renamed to `R3ConseilsPage` / `R3ConseilsPayload` after a 30-day
 * deprecation window (post-2026-06-05). See ADR-044 (vault).
 */

import type { BlogArticle } from './blog.interfaces';

/**
 * @deprecated Renamed to `R3ConseilsPage` post-2026-06-05 per ADR-044.
 */
export interface R3GuidePage {
  pg_alias: string;
  pg_id: number;
  title: string; // h1
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  keywords: string[];
  publishedAt: string;
  updatedAt: string;
  featuredImage: string | null;
  viewsCount: number;
  readingTime: number;
  difficulty: 'facile' | 'moyen' | 'difficile' | null;
  durationMin: number | null;
  safetyLevel: 'faible' | 'moyen' | 'élevé' | null;
  sourceType: 'conseil' | 'article';
  tags: string[];
  cta_link: string | null;
  cta_anchor: string | null;
  hasR6Guide: boolean;
}

export interface R3GuideSectionImage {
  src: string;
  alt: string;
  caption?: string;
  aspectRatio: '16:9' | '4:3';
  loading: 'eager' | 'lazy';
}

export interface R3GuideSection {
  sectionType: string | null; // S1, S2, S4_DEPOSE... null for article H2/H3
  level?: 2 | 3; // only when sourceType=article
  title: string;
  anchor: string; // pre-computed server-side
  order: number;
  html: string; // pre-normalized for S4/S5
  sources: string[];
  qualityScore: number | null;
  image?: R3GuideSectionImage | null;
}

export interface R3GuidePayload {
  page: R3GuidePage;
  s1Sections: R3GuideSection[];
  bodySections: R3GuideSection[];
  metaSections: R3GuideSection[];
  /** Full BlogArticle objects for RelatedArticlesSidebar */
  related: BlogArticle[];
  vehicles: Record<string, unknown>[];
  seoSwitches: Record<string, unknown>[];
  /** Full BlogArticle objects for ArticleNavigation */
  adjacent: {
    previous: BlogArticle | null;
    next: BlogArticle | null;
  };
}
