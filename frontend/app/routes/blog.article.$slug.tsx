import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useParams } from "@remix-run/react";
import { ArrowLeft, Clock, Eye, Share2, Calendar, Tag } from 'lucide-react';
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.article) {
    return [
      { title: "Article introuvable - Blog Automecanik" },
    ];
  }

  const article = data.article;
  return [
    { title: `${article.title} - Blog Automecanik` },
    { name: "description", content: article.excerpt || "Lisez cet article sur notre blog automobile." },
    { name: "keywords", content: article.tags?.join(", ") || "automobile, réparation, entretien" },
    { property: "og:title", content: article.title },
    { property: "og:description", content: article.excerpt || "" },
    { property: "og:type", content: "article" },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const { slug } = params;
  
  if (!slug) {
    throw new Response("Slug manquant", { status: 400 });
  }

  try {
    // Récupérer l'article depuis l'API
    const response = await fetch(`http://localhost:3000/api/blog/article/${slug}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Response("Article introuvable", { status: 404 });
    }

    const apiResponse = await response.json();
    
    if (!apiResponse.success || !apiResponse.data?.article) {
      throw new Response("Article introuvable", { status: 404 });
    }

    return json({ 
      article: apiResponse.data.article,
      success: true 
    });
  } catch (error) {
    console.error('Erreur lors du chargement de l\'article:', error);
    throw new Response("Erreur lors du chargement", { status: 500 });
  }
}

export default function BlogArticle() {
  const { article } = useLoaderData<typeof loader>();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatReadingTime = (minutes: number) => {
    return `${minutes} min de lecture`;
  };

  const formatViews = (views: number) => {
    if (views > 1000) {
      return `${Math.floor(views / 1000)}k vues`;
    }
    return `${views} vues`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header avec navigation */}
      <section className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link 
              to="/blog" 
              className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Retour au blog
            </Link>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Partager
            </Button>
          </div>
        </div>
      </section>

      {/* Contenu de l'article */}
      <article className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* En-tête de l'article */}
            <header className="mb-12 text-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {article.type === 'advice' ? 'Conseil' : 
                   article.type === 'guide' ? 'Guide' : 'Article'}
                </Badge>
                {article.tags && article.tags.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-500" />
                    {article.tags.slice(0, 3).map((tag: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                {article.title}
              </h1>

              {article.excerpt && (
                <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-3xl mx-auto">
                  {article.excerpt}
                </p>
              )}

              {/* Métadonnées */}
              <div className="flex items-center justify-center gap-8 text-gray-500">
                {article.publishedAt && (
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(article.publishedAt)}
                  </div>
                )}
                {article.readingTime && (
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    {formatReadingTime(article.readingTime)}
                  </div>
                )}
                {article.viewsCount && (
                  <div className="flex items-center">
                    <Eye className="w-4 h-4 mr-2" />
                    {formatViews(article.viewsCount)}
                  </div>
                )}
              </div>
            </header>

            {/* Image à la une */}
            {article.featuredImage && (
              <div className="mb-12 rounded-2xl overflow-hidden shadow-lg">
                <img 
                  src={article.featuredImage} 
                  alt={article.title}
                  className="w-full h-64 md:h-96 object-cover"
                />
              </div>
            )}

            {/* Contenu de l'article */}
            <Card className="mb-12 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardContent className="p-8 md:p-12">
                <div className="prose prose-lg max-w-none">
                  {/* Si le contenu est en HTML */}
                  {article.content && (
                    <div 
                      className="text-gray-700 leading-relaxed space-y-6"
                      dangerouslySetInnerHTML={{ 
                        __html: typeof article.content === 'string' 
                          ? article.content 
                          : JSON.stringify(article.content) 
                      }} 
                    />
                  )}

                  {/* Sections structurées */}
                  {article.sections && article.sections.length > 0 && (
                    <div className="mt-8">
                      {article.sections.map((section: any, index: number) => (
                        <div key={index} className="mb-8">
                          <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            {section.title}
                          </h2>
                          <div 
                            className="text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: section.content }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Méta-données SEO si disponibles */}
            {(article.h1 || article.h2) && (
              <Card className="mb-8 border border-blue-200 bg-blue-50/50">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">Points clés de l'article</h3>
                  {article.h1 && (
                    <div className="mb-3">
                      <strong className="text-blue-800">Objectif principal :</strong> {article.h1}
                    </div>
                  )}
                  {article.h2 && (
                    <div className="mb-3">
                      <strong className="text-blue-800">Focus :</strong> {article.h2}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Navigation vers d'autres articles */}
            <div className="text-center mt-16">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Vous pourriez aussi aimer</h3>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/blog">
                  <Button variant="outline" size="lg" className="px-8">
                    Tous les articles
                  </Button>
                </Link>
                <Link to="/blog/category/advice">
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8">
                    Plus de conseils
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
