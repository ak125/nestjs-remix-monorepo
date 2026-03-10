/**
 * blog-helpers — Shared utility functions for blog components
 */

export type BlogIntent = "diagnostic" | "howto" | "buying" | "reference";
export type BlogBadgeType =
  | "nouveau"
  | "populaire"
  | "mis-a-jour"
  | "guide-complet";

export interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  alias?: string;
  pg_alias?: string | null;
  canonicalUrl?: string;
  intent?: BlogIntent;
  badges?: BlogBadgeType[];
  excerpt: string;
  content?: string;
  type: "advice" | "guide" | "constructeur" | "glossaire";
  featuredImage?: string;
  viewsCount: number;
  readingTime: number;
  publishedAt: string;
  updatedAt?: string;
  author?: {
    name: string;
    avatar?: string;
  };
  tags?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
  isPopular?: boolean;
  isFeatured?: boolean;
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  articlesCount: number;
  color?: string;
  icon?: string;
}

export interface BlogStats {
  totalArticles: number;
  totalViews: number;
  totalAdvice: number;
  totalGuides: number;
  totalConstructeurs?: number;
  totalGlossary?: number;
  avgReadingTime?: number;
}

export function getArticleUrl(article: BlogArticle): string {
  if (article.canonicalUrl) {
    return article.canonicalUrl.replace("https://www.automecanik.com", "");
  }
  return article.pg_alias
    ? `/blog-pieces-auto/conseils/${article.pg_alias}`
    : `/blog-pieces-auto/article/${article.slug || article.alias}`;
}

export function formatReadingTime(minutes: number | undefined): string {
  const m = Math.max(1, Math.round(minutes ?? 1));
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m} min de lecture`;
}

export function formatViews(views: number | undefined): string {
  if (!views) return "0";
  if (views > 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views > 1000) return `${(views / 1000).toFixed(1)}k`;
  return String(views);
}

export function formatDate(article: {
  publishedAt: string;
  updatedAt?: string;
}): string {
  if (article.updatedAt) {
    const pub = new Date(article.publishedAt).getTime();
    const upd = new Date(article.updatedAt).getTime();
    if (upd - pub > 86400000) {
      return `Mis à jour ${new Date(article.updatedAt).toLocaleDateString("fr-FR")}`;
    }
  }
  return new Date(article.publishedAt).toLocaleDateString("fr-FR");
}

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    advice: "Conseil",
    guide: "Guide",
    constructeur: "Constructeur",
    glossaire: "Glossaire",
  };
  return labels[type] || type;
}

export function getDifficultyColor(difficulty?: string): string {
  switch (difficulty) {
    case "beginner":
      return "success";
    case "intermediate":
      return "warning";
    case "advanced":
      return "error";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
