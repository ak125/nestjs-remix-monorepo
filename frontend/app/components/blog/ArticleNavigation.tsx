import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";

interface ArticlePreview {
  id: string;
  title: string;
  slug: string;
  /** Alias de gamme (pieces_gamme.pg_alias) — clé de la route canonique des conseils. */
  pg_alias?: string | null;
  excerpt: string;
  featuredImage?: string | null;
  publishedAt: string;
}

/**
 * URL d'un article adjacent. `slug` = ba_alias (« comment-changer-… ») : la route
 * des conseils est indexée sur pg_alias, donc `/blog-pieces-auto/{slug}` finit en 404.
 * Sans pg_alias, `/blog-pieces-auto/article/{slug}` est le résolveur existant
 * (301 vers /conseils/{pg_alias} ou /guide-achat/{slug}).
 */
export function articleHref(article: ArticlePreview): string {
  return article.pg_alias
    ? `/blog-pieces-auto/conseils/${article.pg_alias}`
    : `/blog-pieces-auto/article/${article.slug}`;
}

interface ArticleNavigationProps {
  previous: ArticlePreview | null;
  next: ArticlePreview | null;
  className?: string;
}

/**
 * 🔀 ArticleNavigation - Navigation entre articles précédent/suivant
 *
 * Features:
 * - Preview cards avec titre, excerpt, image
 * - Navigation clavier (← →)
 * - Design moderne avec gradients
 * - Responsive mobile
 *
 * @example
 * <ArticleNavigation previous={prevArticle} next={nextArticle} />
 */
export function ArticleNavigation({
  previous,
  next,
  className = "",
}: ArticleNavigationProps) {
  // 🎹 Navigation clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ne pas intercepter si on est dans un input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowLeft" && previous) {
        window.location.href = articleHref(previous);
      } else if (e.key === "ArrowRight" && next) {
        window.location.href = articleHref(next);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previous, next]);

  // Si ni previous ni next, ne rien afficher
  if (!previous && !next) {
    return null;
  }

  return (
    <nav
      className={`mt-12 mb-8 ${className}`}
      aria-label="Navigation entre articles"
    >
      <div className="border-t border-gray-200 pt-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Continuer la lecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 🔙 Article précédent */}
          {previous ? (
            <Link
              to={articleHref(previous)}
              className="group relative flex flex-col p-6 bg-gradient-to-br from-blue-50 hover:from-blue-100 hover: rounded-xl border border-blue-200 transition-all duration-300 hover:shadow-lg"
            >
              {/* Direction indicator */}
              <div className="flex items-center gap-2 text-sm font-medium text-blue-600 mb-3">
                <ChevronLeft className="w-4 h-4" />
                <span>Article précédent</span>
              </div>

              {/* Image featured (si disponible) */}
              {previous.featuredImage && (
                <div className="w-full h-32 mb-3 rounded-lg overflow-hidden">
                  <img
                    src={previous.featuredImage}
                    alt={previous.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              {/* Titre */}
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2 mb-2">
                {previous.title}
              </h3>

              {/* Excerpt */}
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                {previous.excerpt}
              </p>

              {/* Date */}
              <p className="text-xs text-gray-500 mt-auto">
                {new Date(previous.publishedAt).toLocaleDateString("fr-FR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 border-2 border-blue-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </Link>
          ) : (
            // Placeholder pour garder la grille alignée
            <div className="hidden md:block" />
          )}

          {/* ▶️ Article suivant */}
          {next && (
            <Link
              to={articleHref(next)}
              className="group relative flex flex-col p-6 bg-gradient-to-br to-pink-50 hover: hover:to-pink-100 rounded-xl border border-purple-200 transition-all duration-300 hover:shadow-lg"
            >
              {/* Direction indicator */}
              <div className="flex items-center justify-end gap-2 text-sm font-medium text-foreground mb-3">
                <span>Article suivant</span>
                <ChevronRight className="w-4 h-4" />
              </div>

              {/* Image featured (si disponible) */}
              {next.featuredImage && (
                <div className="w-full h-32 mb-3 rounded-lg overflow-hidden">
                  <img
                    src={next.featuredImage}
                    alt={next.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              {/* Titre */}
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-foreground transition-colors line-clamp-2 mb-2 text-right">
                {next.title}
              </h3>

              {/* Excerpt */}
              <p className="text-sm text-gray-600 line-clamp-2 mb-3 text-right">
                {next.excerpt}
              </p>

              {/* Date */}
              <p className="text-xs text-gray-500 mt-auto text-right">
                {new Date(next.publishedAt).toLocaleDateString("fr-FR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 border-2 border-purple-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </Link>
          )}
        </div>

        {/* 🎹 Raccourcis clavier hint */}
        <div className="mt-4 text-center text-xs text-gray-400">
          <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300">
            ←
          </kbd>{" "}
          et{" "}
          <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300">
            →
          </kbd>{" "}
          pour naviguer
        </div>
      </div>
    </nav>
  );
}
