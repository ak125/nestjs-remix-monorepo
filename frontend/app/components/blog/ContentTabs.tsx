/**
 * ContentTabs — Tabs populaires / récents / catégories
 */
import { Link } from "@remix-run/react";
import {
  TrendingUp,
  Clock,
  Eye,
  ArrowRight,
  Hash,
  Calendar,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ArticleBadges } from "./ArticleBadges";
import {
  type BlogArticle,
  type BlogCategory,
  getArticleUrl,
  formatReadingTime,
  formatViews,
  formatDate,
  getTypeLabel,
} from "./blog-helpers";

interface ContentTabsProps {
  filteredArticles: BlogArticle[];
  recentArticles: BlogArticle[];
  categories: BlogCategory[];
}

export function ContentTabs({
  filteredArticles,
  recentArticles,
  categories,
}: ContentTabsProps) {
  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-slate-50">
      <div className="container mx-auto px-4">
        <Tabs defaultValue="popular" className="w-full">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Découvrez nos contenus
              </h2>
              <p className="text-xl text-gray-600">
                Articles, guides et conseils pour tous les niveaux
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <TabsList className="grid grid-cols-2 md:grid-cols-3 w-full md:w-auto">
                <TabsTrigger
                  value="popular"
                  className="flex items-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  Populaires
                </TabsTrigger>
                <TabsTrigger value="recent" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Récents
                </TabsTrigger>
                <TabsTrigger
                  value="categories"
                  className="flex items-center gap-2"
                >
                  <Hash className="w-4 h-4" />
                  Catégories
                </TabsTrigger>
              </TabsList>
              <Link
                to="/reference-auto"
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                Glossaire
              </Link>
            </div>
          </div>

          {/* Articles populaires */}
          <TabsContent value="popular" className="mt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredArticles.slice(0, 9).map((article) => (
                <div
                  key={article.id}
                  className="hover:-translate-y-1 transition-transform duration-300"
                >
                  <Card className="group h-full hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm overflow-hidden">
                    {article.featuredImage && (
                      <div className="h-48 relative overflow-hidden">
                        <img
                          src={article.featuredImage}
                          alt={article.title}
                          width={400}
                          height={192}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {article.isPopular && (
                          <div className="absolute top-3 right-3">
                            <Badge className="bg-gradient-to-r from-pink-500 to-red-500 text-white">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              Populaire
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}

                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between mb-3">
                        <Badge
                          variant="secondary"
                          className="bg-info/20 text-info"
                        >
                          {getTypeLabel(article.type)}
                        </Badge>
                        <div className="flex items-center text-sm text-gray-500">
                          <Eye className="w-4 h-4 mr-1" />
                          {formatViews(article.viewsCount)} vues
                        </div>
                      </div>
                      <ArticleBadges badges={article.badges} maxBadges={2} />
                      <CardTitle className="text-xl group-hover:text-blue-600 transition-colors line-clamp-2 mt-1">
                        {article.title}
                      </CardTitle>
                    </CardHeader>

                    <CardContent>
                      <p className="text-gray-600 mb-4 line-clamp-3 leading-relaxed">
                        {article.excerpt}
                      </p>

                      <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatReadingTime(article.readingTime)}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(article)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Link
                          prefetch="intent"
                          to={getArticleUrl(article)}
                          className="text-blue-600 hover:text-blue-800 font-medium group-hover:underline inline-flex items-center"
                        >
                          Lire la suite
                          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
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
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>

            {filteredArticles.length > 9 && (
              <div className="text-center mt-12">
                <Link to="/blog-pieces-auto/popular">
                  <Button
                    size="lg"
                    variant="outline"
                    className="group px-8 py-4 text-lg"
                  >
                    Voir tous les articles populaires
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            )}
          </TabsContent>

          {/* Articles récents */}
          <TabsContent value="recent" className="mt-8">
            {recentArticles && recentArticles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recentArticles.slice(0, 6).map((article) => (
                  <div
                    key={article.id}
                    className="hover:translate-x-1 transition-transform duration-200"
                  >
                    <Card className="group flex flex-row h-32 hover:shadow-lg transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm overflow-hidden">
                      {article.featuredImage && (
                        <div className="w-32 h-full relative overflow-hidden">
                          <img
                            src={article.featuredImage}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs">
                              {getTypeLabel(article.type)}
                            </Badge>
                          </div>
                          <h3 className="font-semibold line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {article.title}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{formatReadingTime(article.readingTime)}</span>
                          <div className="flex items-center gap-2">
                            {article.pg_alias && (
                              <Link
                                to={`/pieces/${article.pg_alias}`}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                              >
                                Pièces →
                              </Link>
                            )}
                            <Link
                              prefetch="intent"
                              to={getArticleUrl(article)}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Lire →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Aucun article récent disponible</p>
              </div>
            )}
          </TabsContent>

          {/* Catégories */}
          <TabsContent value="categories" className="mt-8">
            {categories && categories.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="hover:-translate-y-1 hover:scale-105 transition-all duration-200"
                  >
                    <Link to={`/blog-pieces-auto/category/${category.slug}`}>
                      <Card className="group text-center h-full hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-purple-50">
                        <CardHeader>
                          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold group-hover:scale-110 transition-transform duration-300">
                            {category.icon || category.name.charAt(0)}
                          </div>
                          <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">
                            {category.name}
                          </CardTitle>
                          <p className="text-gray-600 mt-2 line-clamp-2">
                            {category.description}
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-blue-600 mb-2">
                            {category.articlesCount || 0}
                          </div>
                          <div className="text-gray-500 flex items-center justify-center">
                            articles disponibles
                            <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Hash className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Aucune catégorie disponible</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
