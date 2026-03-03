/**
 * R3 Guide Page Engine — Frontend types (mirror of backend R3GuidePayload).
 */

export interface R3GuidePage {
  pg_alias: string;
  pg_id: number;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  keywords: string[];
  publishedAt: string;
  updatedAt: string;
  featuredImage: string | null;
  viewsCount: number;
  readingTime: number;
  difficulty: "facile" | "moyen" | "difficile" | null;
  durationMin: number | null;
  safetyLevel: "faible" | "moyen" | "élevé" | null;
  sourceType: "conseil" | "article";
  tags: string[];
  cta_link: string | null;
  cta_anchor: string | null;
}

export interface R3GuideSection {
  sectionType: string | null;
  level?: 2 | 3;
  title: string;
  anchor: string;
  order: number;
  html: string;
  sources: string[];
  qualityScore: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArticle = any;

export interface R3GuidePayload {
  page: R3GuidePage;
  s1Sections: R3GuideSection[];
  bodySections: R3GuideSection[];
  metaSections: R3GuideSection[];
  /** Full article objects for RelatedArticlesSidebar */
  related: AnyArticle[];
  vehicles: Record<string, unknown>[];
  seoSwitches: Record<string, unknown>[];
  /** Full article objects for ArticleNavigation */
  adjacent: {
    previous: AnyArticle | null;
    next: AnyArticle | null;
  };
}
