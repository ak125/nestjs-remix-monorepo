/**
 * 📚 Section Articles Liés pour Route Pièces
 * 
 * Affiche les articles de blog/conseils liés à la gamme et au véhicule.
 * Ces articles sont générés par generateRelatedArticles() dans pieces-route.utils.ts
 * 
 * Fonctionnalités SEO:
 * - Liens internes vers le blog pour maillage de contenu
 * - Textes d'ancrage pertinents pour la gamme
 * - Structure sémantique avec article/h3
 * - Tracking des clics et impressions
 */

import { Link } from '@remix-run/react';
import { BookOpen, Clock, ArrowRight, Newspaper } from 'lucide-react';
import { useEffect } from 'react';
import { type BlogArticle } from '../../types/pieces-route.types';
import { useSeoLinkTracking } from '../../hooks/useSeoLinkTracking';

interface PiecesRelatedArticlesProps {
  articles: BlogArticle[];
  gammeName?: string;
  vehicleName?: string;
}

/**
 * Section Articles Conseils avec design moderne
 */
export function PiecesRelatedArticles({ 
  articles, 
  gammeName = 'pièces',
  vehicleName 
}: PiecesRelatedArticlesProps) {
  const { trackClick, trackImpression } = useSeoLinkTracking();

  // Track les impressions au montage (doit être avant le return conditionnel)
  useEffect(() => {
    if (articles && articles.length > 0) {
      trackImpression('RelatedArticles', articles.length);
    }
  }, [articles, trackImpression]);

  // Ne rien afficher si pas d'articles
  if (!articles || articles.length === 0) {
    return null;
  }

  // Handler pour tracker les clics avec ancres SEO enrichies
  const handleArticleClick = (article: BlogArticle) => {
    // Ancre enrichie avec contexte gamme/véhicule
    const seoAnchor = vehicleName 
      ? `${article.title} - Guide ${gammeName} ${vehicleName}`
      : `${article.title} - Conseils ${gammeName}`;
    trackClick('RelatedArticles', `/blog-pieces-auto/article/${article.slug}`, {
      anchorText: seoAnchor,
      position: 'content'
    });
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-8">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
        <h2 className="text-xl font-bold text-blue-900 flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          Articles & Conseils {gammeName}
        </h2>
        <p className="text-sm text-blue-700 mt-1 ml-12">
          {articles.length} article{articles.length > 1 ? 's' : ''} pour vous aider
          {vehicleName && ` avec votre ${vehicleName}`}
        </p>
      </div>

      {/* Grille d'articles */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((article, index) => (
            <article 
              key={article.id}
              className="group relative bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 overflow-hidden"
            >
              {/* Image optionnelle */}
              {article.image && (
                <div className="h-40 overflow-hidden">
                  <img 
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Contenu */}
              <div className="p-5">
                {/* Badge numéro */}
                <div className="absolute top-4 right-4 w-8 h-8 bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </div>

                {/* Titre */}
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors pr-10 line-clamp-2 mb-2">
                  {article.title}
                </h3>

                {/* Extrait */}
                <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                  {article.excerpt}
                </p>

                {/* Footer avec métadonnées */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {article.readTime} min
                    </span>
                    {article.date && (
                      <span className="flex items-center gap-1">
                        <Newspaper className="w-3.5 h-3.5" />
                        {new Date(article.date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    )}
                  </div>

                  {/* Lien vers l'article - Ancre SEO optimisée */}
                  <Link
                    to={`/blog-pieces-auto/article/${article.slug}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 group-hover:gap-2 transition-all"
                    title={`Lire notre guide complet: ${article.title}`}
                  >
                    Lire l'article
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Overlay lien sur toute la carte - Ancre SEO enrichie */}
              <Link 
                to={`/blog-pieces-auto/article/${article.slug}`}
                className="absolute inset-0"
                aria-label={`Guide complet: ${article.title} - Conseils ${gammeName}`}
                title={`${article.title} - Découvrez nos conseils pour ${gammeName}`}
                onClick={() => handleArticleClick(article)}
              />
            </article>
          ))}
        </div>

        {/* Lien vers tous les articles - Ancre descriptive */}
        <div className="mt-6 text-center">
          <Link
            to="/blog-pieces-auto"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors"
            title="Découvrez tous nos guides et conseils pour entretenir votre véhicule"
          >
            <BookOpen className="w-4 h-4" />
            Tous nos guides entretien auto
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default PiecesRelatedArticles;
