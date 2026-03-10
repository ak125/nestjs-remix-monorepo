/**
 * blog-helpers — Shared utility functions for blog components
 */
import { isValidImagePath, IMAGE_CONFIG } from "~/utils/image-optimizer";

export type BlogIntent = "diagnostic" | "howto" | "buying" | "reference";
export type BlogBadgeType =
  | "nouveau"
  | "populaire"
  | "mis-a-jour"
  | "guide-complet";

export type ContentType = "HOWTO" | "DIAGNOSTIC" | "BUYING_GUIDE" | "GLOSSARY";

export interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  alias?: string;
  pg_alias?: string | null;
  ba_pg_id?: string | null;
  canonicalUrl?: string;
  intent?: BlogIntent;
  badges?: BlogBadgeType[];
  excerpt: string;
  content?: string;
  type: "advice" | "guide" | "constructeur" | "glossaire";
  contentType?: ContentType;
  difficulty?: number; // 1-5
  timeMinutes?: number;
  toolsCount?: number;
  primaryGammeSlug?: string;
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

export function getDifficultyColor(difficulty?: string | number): string {
  if (typeof difficulty === "number") {
    if (difficulty <= 2) return "bg-green-100 text-green-800";
    if (difficulty <= 3) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  }
  switch (difficulty) {
    case "beginner":
      return "bg-green-100 text-green-800";
    case "intermediate":
      return "bg-yellow-100 text-yellow-800";
    case "advanced":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function getContentTypeLabel(type?: ContentType): string {
  const labels: Record<ContentType, string> = {
    HOWTO: "Montage",
    DIAGNOSTIC: "Diagnostic",
    BUYING_GUIDE: "Guide d\u2019achat",
    GLOSSARY: "D\u00e9finition",
  };
  return type ? labels[type] || type : "";
}

export function getContentTypeBadgeColor(type?: ContentType): string {
  switch (type) {
    case "HOWTO":
      return "bg-blue-100 text-blue-800";
    case "DIAGNOSTIC":
      return "bg-orange-100 text-orange-800";
    case "BUYING_GUIDE":
      return "bg-green-100 text-green-800";
    case "GLOSSARY":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function getDifficultyLabel(n?: number): string {
  if (!n) return "";
  if (n <= 2) return "Facile";
  if (n <= 3) return "Moyen";
  return "Avanc\u00e9";
}

export function formatTimeMinutes(minutes?: number): string {
  if (!minutes) return "";
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h${m.toString().padStart(2, "0")}` : `~${h}h`;
}

/**
 * Normalise l'URL d'image d'un article blog.
 * Utilise isValidImagePath + IMAGE_CONFIG (source unique frontend).
 */
export function getArticleImageUrl(
  featuredImage?: string | null,
): string | null {
  if (!isValidImagePath(featuredImage)) return null;
  if (featuredImage!.startsWith("/") || featuredImage!.startsWith("http"))
    return featuredImage!;
  return `${IMAGE_CONFIG.PROXY_BASE}/${IMAGE_CONFIG.BUCKETS.UPLOADS}/${IMAGE_CONFIG.PATHS.GAMMES}/${featuredImage}`;
}
