/**
 * PillarArticlesGrid — 3 articles en vedette (piliers)
 */
import { Link, useFetcher } from "@remix-run/react";
import {
  Clock,
  Eye,
  Sparkles,
  ChevronRight,
  Share2,
  Bookmark,
  Star,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ArticleBadges } from "./ArticleBadges";
import {
  type BlogArticle,
  getArticleUrl,
  formatReadingTime,
  formatViews,
  getTypeLabel,
  getDifficultyColor,
} from "./blog-helpers";

interface PillarArticlesGridProps {
  articles: BlogArticle[];
}

export function PillarArticlesGrid({ articles }: PillarArticlesGridProps) {
  const fetcher = useFetcher();

  if (!articles || articles.length === 0) return null;

  return (
    <section className="py-20 bg-gradient-to-r from-blue-50 to-purple-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 text-lg">
            <Star className="w-4 h-4 mr-2" />À la une
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Articles en vedette
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Nos contenus les plus appréciés par la communauté
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.slice(0, 3).map((article, index) => (
            <div
              key={article.id}
              className="hover:-translate-y-2 transition-transform duration-300"
            >
              <Card className="group h-full overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500">
                {article.featuredImage && (
                  <div className="h-56 relative overflow-hidden">
                    <img
                      src={article.featuredImage}
                      alt={article.title}
                      width={400}
                      height={224}
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding={index === 0 ? "sync" : "async"}
                      fetchpriority={index === 0 ? "high" : undefined}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Featured
                      </Badge>
                    </div>
                  </div>
                )}

                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge
                      variant="secondary"
                      className="bg-info/20 text-info hover:bg-primary/30"
                    >
                      {getTypeLabel(article.type)}
                    </Badge>
                    {article.difficulty && (
                      <Badge className={getDifficultyColor(article.difficulty)}>
                        {article.difficulty}
                      </Badge>
                    )}
                  </div>
                  <ArticleBadges badges={article.badges} maxBadges={2} />
                  <CardTitle className="text-xl group-hover:text-blue-600 transition-colors line-clamp-2 leading-tight mt-2">
                    {article.title}
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-gray-600 mb-4 line-clamp-3 leading-relaxed">
                    {article.excerpt}
                  </p>

                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatReadingTime(article.readingTime)}
                      </div>
                      <div className="flex items-center">
                        <Eye className="w-4 h-4 mr-1" />
                        {formatViews(article.viewsCount)} vues
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Link
                        prefetch="intent"
                        to={getArticleUrl(article)}
                        className="text-blue-600 hover:text-blue-800 font-semibold group-hover:underline inline-flex items-center"
                      >
                        Lire l'article
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </Link>
                      {article.pg_alias && (
                        <Link
                          to={`/pieces/${article.pg_alias}`}
                          className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
                        >
                          Voir les pièces →
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="p-2 hover:bg-info/20"
                        onClick={() => {
                          fetcher.submit(
                            {
                              actionType: "bookmark",
                              articleId: article.id,
                            },
                            { method: "post" },
                          );
                        }}
                      >
                        <Bookmark className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="p-2 hover:bg-info/20"
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: article.title,
                              url: getArticleUrl(article),
                            });
                          }
                        }}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
