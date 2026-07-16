/**
 * R3 Guide Page Engine — Typed payload contract.
 * Single endpoint GET /api/r3-guide/:pg_alias returns this structure.
 */

import type { BlogArticle } from './blog.interfaces';
import type {
  R3BodySource,
  R3FallbackReason,
} from '../services/r3-projection-decision.service';

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

/**
 * Verdict de la chaîne de décision projection (P2-R3-D).
 *
 * **Présent UNIQUEMENT si la paire `R3_CONSEILS@gamme:<alias>` est ciblée par la canary** — sa
 * présence EST le signal de ciblage (elle commande le bypass de cache backend et le `no-store`
 * côté loader). Absent = hors canary = chemin legacy strictement inchangé.
 *
 * **P2-R3-D est une chaîne de décision, pas un rendu** : `decision: 'projection'` signifie « la
 * projection est complète et servable », PAS « le BODY ci-joint vient de la projection ». Le BODY
 * reste legacy dans TOUS les cas tant que le rendu md→HTML gouverné n'existe pas (P2-R3-E).
 */
export interface R3ProjectionMeta {
  decision: R3BodySource;
  fallbackReason: R3FallbackReason | null;
  mappedCount: number;
  invalidCount: number;
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
  /** Voir {@link R3ProjectionMeta} — absent hors canary (donc absent partout tant que les flags sont OFF). */
  projectionMeta?: R3ProjectionMeta;
}
