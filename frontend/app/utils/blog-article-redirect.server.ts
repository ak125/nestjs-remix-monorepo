/**
 * Adresse canonique d'un article du blog, et résolution des anciennes adresses
 * d'un conseil par son `ba_alias`.
 *
 * Un conseil (`__blog_advice`) est servi sur `/blog-pieces-auto/conseils/{pg_alias}`
 * quand il est rattaché à une gamme, sinon sur `/blog-pieces-auto/article/{ba_alias}`.
 * Les anciennes adresses construites sur le `ba_alias` (`/blog-pieces-auto/{ba_alias}`,
 * `/blog-pieces-auto/conseils/{ba_alias}`) n'ont pas de route : elles sont résolues ici
 * à partir de l'article lui-même (`/api/blog/article/{slug}`), jamais d'un motif d'URL.
 */
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";

/** Champs de la réponse `/api/blog/article/{slug}` qui décident de l'adresse. */
export interface BlogArticleAddress {
  type: string;
  slug: string;
  pg_alias?: string | null;
  legacy_table?: string;
}

/** Adresse canonique d'un article : la route qui le sert en 200. */
export function canonicalBlogArticlePath(article: BlogArticleAddress): string {
  if (article.type === "advice" && article.pg_alias) {
    return `/blog-pieces-auto/conseils/${article.pg_alias}`;
  }
  if (article.legacy_table === "__blog_guide") {
    return `/blog-pieces-auto/guide-achat/${article.slug}`;
  }
  return `/blog-pieces-auto/article/${article.slug}`;
}

export type LegacyAdviceAliasResolution =
  | { status: "found"; location: string }
  | { status: "not_found" }
  | { status: "unavailable"; reason: string };

/** Au-delà, la recherche est abandonnée et l'adresse répond 503 (jamais 404). */
const ARTICLE_LOOKUP_TIMEOUT_MS = 8000;

/**
 * Résout un `ba_alias` de conseil vers l'adresse canonique du conseil.
 * - `found` : un conseil porte cet alias ;
 * - `not_found` : aucun conseil (l'API répond 404, ou l'article est un guide) ;
 * - `unavailable` : l'API n'a pas pu répondre (5xx, 429, délai, réseau) — l'appelant
 *   répond 503 : une absence n'est jamais déduite d'une panne.
 */
export async function resolveLegacyAdviceAlias(
  slug: string,
  request: Request,
): Promise<LegacyAdviceAliasResolution> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    ARTICLE_LOOKUP_TIMEOUT_MS,
  );
  try {
    const response = await fetch(
      getInternalApiUrlFromRequest(
        `/api/blog/article/${encodeURIComponent(slug)}`,
        request,
      ),
      { headers: { "Internal-Call": "true" }, signal: controller.signal },
    );
    if (response.status === 404) return { status: "not_found" };
    if (!response.ok) {
      return {
        status: "unavailable",
        reason: `/api/blog/article a répondu ${response.status}`,
      };
    }
    const body = await response.json();
    const article = (body?.data ?? null) as BlogArticleAddress | null;
    if (!article || article.type !== "advice") return { status: "not_found" };
    return { status: "found", location: canonicalBlogArticlePath(article) };
  } catch (error) {
    return {
      status: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
