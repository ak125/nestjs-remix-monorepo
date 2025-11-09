/**
 * 📰 HOME BLOG SECTION
 * 
 * Composant pour afficher les derniers articles du blog sur la page d'accueil
 * 
 * Features :
 * - Grille responsive de 3 articles
 * - Cards avec image, titre, extrait, metadata
 * - CTA vers la page blog complète
 * - Fallback si pas d'articles
 * 
 * Props :
 * - blogArticles: Données des articles depuis l'API
 */

import { Link } from "@remix-run/react";
import { Clock, Users, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface HomeBlogSectionProps {
  blogArticles: {
    data?: {
      articles?: Array<{
        id: string | number;
        title: string;
        slug: string;
        excerpt?: string;
        featuredImage?: string;
        readingTime?: number;
        viewsCount?: number;
      }>;
    };
  } | null;
}

export default function HomeBlogSection({ blogArticles }: HomeBlogSectionProps) {
  return (
    <section 
      id="blog-articles" 
      className="py-20 bg-white"
      aria-label="Derniers articles du blog"
    >
      <div className="container mx-auto px-4 max-w-7xl">
        {/* En-tête */}
        <div className="text-center mb-16 animate-in fade-in duration-700">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            Conseils & <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Actualités</span>
          </h2>
          <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded mb-6"></div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Retrouvez nos guides, tutoriels et actualités pour entretenir votre véhicule
          </p>
        </div>

        {/* Grid d'articles - Données réelles depuis l'API */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {blogArticles?.data?.articles?.slice(0, 3).map((article, idx: number) => (
            <Card 
              key={article.id}
              className="group overflow-hidden border-2 border-gray-200 hover:border-blue-400 hover:shadow-2xl transition-all duration-300 bg-white animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Image réelle de l'article */}
              <div className="relative w-full h-56 overflow-hidden">
                {article.featuredImage ? (
                  <>
                    <img 
                      src={article.featuredImage}
                      alt={article.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      loading="lazy"
                    />
                    {/* Overlay gradient sur hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </>
                ) : (
                  /* Fallback si pas d'image */
                  <div className="w-full h-full bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 flex items-center justify-center">
                    <div className="text-6xl opacity-20">📰</div>
                  </div>
                )}
                
                {/* Badge lecture */}
                <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg z-10">
                  {article.readingTime || 5} min de lecture
                </div>
              </div>

              <CardContent className="p-6">
                {/* Titre */}
                <h3 className="font-bold text-gray-900 text-xl mb-3 line-clamp-2 min-h-[3.5rem] group-hover:text-blue-600 transition-colors">
                  {article.title}
                </h3>

                {/* Extrait */}
                <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3">
                  {article.excerpt || "Découvrez nos conseils d'experts pour l'entretien de votre véhicule."}
                </p>

                {/* Meta info */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pt-4 border-t border-gray-100">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {article.readingTime || 5} min
                  </span>
                  {article.viewsCount && (
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {article.viewsCount} vues
                    </span>
                  )}
                </div>

                {/* CTA */}
                <Link 
                  to={`/blog/conseils/${article.slug}`}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm group/link"
                >
                  <span>Lire l'article</span>
                  <ChevronRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </CardContent>
            </Card>
          )) || (
            // Fallback si pas d'articles
            <div className="col-span-3 text-center py-12">
              <p className="text-gray-500">Chargement des articles...</p>
            </div>
          )}
        </div>

        {/* CTA voir tous les articles */}
        <div className="text-center animate-in fade-in duration-700 delay-300">
          <Button 
            asChild
            size="lg" 
            variant="outline"
            className="border-2 border-blue-300 text-blue-700 hover:bg-blue-50 px-8"
          >
            <Link to="/blog">
              Voir tous les articles
              <ChevronRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
