/**
 * RelatedArticlesSidebar — "On vous propose" sidebar panel
 * Displays cross-linked related articles with thumbnails, views, and dates.
 */

import { Link } from "@remix-run/react";
import { Eye, Calendar } from "lucide-react";
import { Card } from "~/components/ui/card";

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  pg_alias?: string | null;
  excerpt: string;
  featuredImage?: string | null;
  wall?: string | null;
  viewsCount: number;
  updatedAt: string;
}

interface RelatedArticlesSidebarProps {
  articles: RelatedArticle[];
}

export function RelatedArticlesSidebar({
  articles,
}: RelatedArticlesSidebarProps) {
  if (articles.length === 0) return null;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow">
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          On vous propose
        </h3>
        <div className="h-1 w-16 bg-primary rounded mb-4" />
        <div className="space-y-3">
          {articles.map((related) => (
            <Link
              key={related.id}
              to={
                related.pg_alias
                  ? `/blog-pieces-auto/conseils/${related.pg_alias}`
                  : `/blog-pieces-auto/article/${related.slug}`
              }
            >
              <Card className="overflow-hidden hover:shadow-md transition-all group border-gray-200">
                <div className="flex gap-3 p-3">
                  {related.featuredImage ? (
                    <img
                      src={related.featuredImage}
                      alt={related.title}
                      className="w-20 h-16 object-cover rounded-md flex-shrink-0 border-2 border-gray-200 group-hover:scale-105 transition-transform"
                      loading="lazy"
                      width="80"
                      height="64"
                    />
                  ) : related.wall && related.wall !== "no.jpg" ? (
                    <img
                      src={`/upload/blog/guide/mini/${related.wall}`}
                      alt={related.title}
                      className="w-20 h-16 object-cover rounded-md flex-shrink-0 border-2 border-gray-200 group-hover:scale-105 transition-transform"
                      loading="lazy"
                      width="80"
                      height="64"
                    />
                  ) : (
                    <div className="w-20 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-md flex-shrink-0 flex items-center justify-center border-2 border-gray-200">
                      <span className="text-xl text-blue-400">
                        <Eye className="w-5 h-5" />
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-1">
                      {related.title}
                    </h4>
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                      {related.excerpt}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Eye className="w-3 h-3" />
                      <span>{related.viewsCount.toLocaleString()} vues</span>
                      {related.updatedAt && (
                        <>
                          <span>·</span>
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(related.updatedAt).toLocaleDateString(
                              "fr-FR",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}
