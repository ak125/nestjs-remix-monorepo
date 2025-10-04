/**
 * Route legacy : /blog-pieces-auto/conseils/:pg_alias
 * Affiche l'article directement avec l'URL originale (pas de redirection)
 * 
 * Exemple :
 * /blog-pieces-auto/conseils/alternateur 
 * → Affiche l'article "Comment changer votre alternateur"
 */

import { 
  json,
  type LoaderFunctionArgs, 
  type MetaFunction 
} from "@remix-run/node";
import { 
  Link, 
  useLoaderData,
  useNavigate 
} from "@remix-run/react";
import { 
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Share2,
  Bookmark,
  ChevronRight,
  Tag
} from 'lucide-react';
import { useState, useEffect } from "react";

// UI Components
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";

// Blog components
import CTAButton from "~/components/blog/CTAButton";
import { ScrollToTop } from "~/components/blog/ScrollToTop";
import { TableOfContents } from "~/components/blog/TableOfContents";
import VehicleCarousel from "~/components/blog/VehicleCarousel";
import { ArticleNavigation } from "~/components/blog/ArticleNavigation";

// Analytics
import { trackArticleView, trackReadingTime, trackShareArticle, trackBookmark } from "~/utils/analytics";

// Types
interface CompatibleVehicle {
  type_id: number;
  type_alias: string;
  type_name: string;
  type_power: number;
  type_fuel: string;
  type_body: string;
  period: string;
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_pic: string | null;
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_logo: string | null;
  catalog_url: string;
}

interface _BlogArticle {
  id: string;
  title: string;
  slug: string;
  pg_alias?: string | null;
  excerpt: string;
  content: string;
  h1: string;
  h2: string;
  keywords: string[];
  tags: string[];
  publishedAt: string;
  updatedAt: string;
  viewsCount: number;
  featuredImage?: string | null;
  sections: BlogSection[];
  cta_anchor?: string | null;
  cta_link?: string | null;
  relatedArticles?: _BlogArticle[];
  compatibleVehicles?: CompatibleVehicle[];
  seo_data: {
    meta_title: string;
    meta_description: string;
  };
}

interface BlogSection {
  level: 2 | 3;
  title: string;
  content: string;
  anchor: string;
  cta_anchor?: string | null;
  cta_link?: string | null;
  wall?: string | null;
}

interface GammeConseil {
  title: string;
  content: string;
}

type ConseilArray = GammeConseil[];

// Loader
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { pg_alias } = params;
  
  if (!pg_alias) {
    throw new Response("Not Found", { status: 404 });
  }

  try {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    
    // 1️⃣ Essayer d'abord par slug (pour les liens depuis la liste)
    let response = await fetch(
      `${baseUrl}/api/blog/article/${pg_alias}`,
      {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      }
    );

    // 2️⃣ Si échec, essayer par gamme (legacy URLs)
    if (!response.ok) {
      response = await fetch(
        `${baseUrl}/api/blog/article/by-gamme/${pg_alias}`,
        {
          headers: {
            cookie: request.headers.get('cookie') || '',
          },
        }
      );
    }

    if (!response.ok) {
      throw new Response("Article Not Found", { status: 404 });
    }

    const { data: article } = await response.json();

    if (!article) {
      throw new Response("Article Not Found", { status: 404 });
    }

    // Charger les articles adjacents (précédent/suivant)
    let adjacentArticles = { previous: null, next: null };
    try {
      const adjacentResponse = await fetch(
        `${baseUrl}/api/blog/article/${article.slug}/adjacent`,
        {
          headers: {
            cookie: request.headers.get('cookie') || '',
          },
        }
      );
      
      if (adjacentResponse.ok) {
        const adjacentData = await adjacentResponse.json();
        adjacentArticles = adjacentData.data;
      }
    } catch (error) {
      console.error('[Adjacent] Error loading adjacent articles', error);
      // Silently fail - not critical
    }

    // Charger les switches SEO pour cette gamme (pg_id)
    let seoSwitches = [];
    if (article.pg_id) {
      try {
        const switchesResponse = await fetch(
          `${baseUrl}/api/blog/seo-switches/${article.pg_id}`,
          {
            headers: {
              cookie: request.headers.get('cookie') || '',
            },
          }
        );
        
        if (switchesResponse.ok) {
          const switchesData = await switchesResponse.json();
          seoSwitches = switchesData.data || [];
        }
      } catch (error) {
        console.error('[SEO] Error loading SEO switches', error);
        // Silently fail - not critical
      }
    }

    // Charger les conseils de remplacement pour cette gamme (pg_id)
    let conseil = null;
    if (article.pg_id) {
      try {
        const conseilResponse = await fetch(
          `${baseUrl}/api/blog/conseil/${article.pg_id}`,
          {
            headers: {
              cookie: request.headers.get('cookie') || '',
            },
          }
        );
        
        if (conseilResponse.ok) {
          const conseilData = await conseilResponse.json();
          conseil = conseilData.data;
        }
      } catch (error) {
        console.error('[CONSEIL] Error loading conseil', error);
        // Silently fail - not critical
      }
    }

    return json({ 
      article, 
      pg_alias, 
      adjacentArticles, 
      seoSwitches: seoSwitches || [], 
      conseil: (conseil || []) as ConseilArray
    });
    
  } catch (error) {
    console.error(`[Legacy URL] Error loading article for gamme: ${pg_alias}`, error);
    throw new Response("Internal Server Error", { status: 500 });
  }
}

// Meta tags
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: "Article non trouvé" },
    ];
  }

  const { article } = data;
  
  return [
    { title: article.seo_data.meta_title },
    { name: "description", content: article.seo_data.meta_description },
    { name: "keywords", content: article.keywords.join(", ") },
    { property: "og:title", content: article.title },
    { property: "og:description", content: article.excerpt },
    { property: "og:type", content: "article" },
  ];
};

// Composant principal - Réutilise le même design que blog.article.$slug.tsx
export default function LegacyBlogArticle() {
  const { article, pg_alias, adjacentArticles, seoSwitches, conseil } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [startTime] = useState(Date.now());

  // Calculer le temps de lecture (approximatif)
  const _readingTime = Math.ceil(
    (article.content.length + article.sections.reduce((acc, s) => acc + s.content.length, 0)) / 1000
  );

  // 🆕 Analytics tracking
  useEffect(() => {
    // Track vue d'article après 3 secondes (évite les bounces)
    const viewTimer = setTimeout(() => {
      trackArticleView(article.id, article.title);
    }, 3000);

    // Track temps de lecture au départ
    return () => {
      clearTimeout(viewTimer);
      const duration = Math.floor((Date.now() - startTime) / 1000);
      if (duration > 5) {
        trackReadingTime(article.id, duration, article.title);
      }
    };
  }, [article.id, article.title, startTime]);

  // Gérer le bookmark avec tracking
  const handleBookmark = () => {
    const newState = !isBookmarked;
    setIsBookmarked(newState);
    trackBookmark(article.id, newState ? 'add' : 'remove', article.title);
  };

  // Gérer le partage avec tracking
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.excerpt,
        url: window.location.href,
      }).then(() => {
        trackShareArticle('native', article.id, article.title);
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      trackShareArticle('copy', article.id, article.title);
      alert('Lien copié dans le presse-papier !');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Navigation */}
      <BlogPiecesAutoNavigation />
      
      {/* Header Compact */}
      <CompactBlogHeader
        title={article.h1}
        description={`Publié le ${new Date(article.publishedAt).toLocaleDateString('fr-FR')} • ${article.viewsCount.toLocaleString()} vues`}
        breadcrumb={[
          { label: "Accueil", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: "Conseils", href: "/blog-pieces-auto/conseils" },
          { label: article.title },
        ]}
        stats={[
          { icon: Eye, value: article.viewsCount.toLocaleString(), label: "Vues" },
          { icon: Clock, value: `${Math.ceil(article.content.split(' ').length / 200)} min`, label: "Lecture" },
        ]}
        gradientFrom="from-purple-600"
        gradientTo="to-pink-600"
      />

      <div className="container mx-auto px-4 max-w-6xl py-8">
        {/* Bouton retour */}
        <button
          onClick={() => navigate('/blog')}
          className="mb-6 px-4 py-2 bg-white hover:bg-gray-50 rounded-lg transition-all flex items-center gap-2 border border-gray-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium text-gray-700">Retour au blog</span>
        </button>

        {/* Featured Image */}
        {article.featuredImage && (
          <Card className="mb-8 border shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-gray-50 via-white to-gray-100 p-6 flex items-center justify-center">
                <img
                  src={article.featuredImage}
                  alt={article.title}
                  className="w-full h-64 object-contain drop-shadow-lg"
                  loading="eager"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {article.tags.slice(0, 6).map((tag) => (
              <Badge 
                key={tag} 
                variant="secondary"
                className="px-3 py-1 text-sm"
              >
                <Tag className="w-3 h-3 mr-1.5 inline" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Contenu Principal */}
      <div className="bg-gray-50 min-h-screen py-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Article - 3 colonnes (meilleure lecture) */}
          <article className="lg:col-span-3 order-2 lg:order-1">
            <Card className="shadow-xl border-0 overflow-hidden">
              <CardContent className="p-8 lg:p-12">
                
                {/* Section Rôle (AU DÉBUT de l'article si disponible) */}
                {conseil && conseil.length > 0 && conseil.find(c => c.title.toLowerCase().includes('rôle')) && (
                  <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {conseil.find(c => c.title.toLowerCase().includes('rôle'))!.title}
                    </h2>
                    <div 
                      className="prose prose-lg max-w-none
                        prose-p:text-gray-700 prose-p:leading-relaxed
                        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-gray-900 prose-strong:font-semibold"
                      dangerouslySetInnerHTML={{ __html: conseil.find(c => c.title.toLowerCase().includes('rôle'))!.content }}
                    />
                  </div>
                )}

                {/* Contenu principal */}
                <div 
                  className="prose prose-lg max-w-none mb-8
                    prose-headings:text-gray-900 prose-headings:font-bold
                    prose-p:text-gray-700 prose-p:leading-relaxed
                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-gray-900 prose-strong:font-semibold
                    prose-ul:list-disc prose-ul:pl-6
                    prose-li:text-gray-700"
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />

                {/* CTA Principal (après le contenu principal) */}
                {article.cta_link && article.cta_anchor && (
                  <CTAButton 
                    anchor={article.cta_anchor} 
                    link={article.cta_link}
                  />
                )}

                {/* Sections H2/H3 */}
                {article.sections.map((section, index) => (
                  <section key={index} id={section.anchor} className="mb-8">
                    {section.level === 2 ? (
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">
                        {section.title}
                      </h2>
                    ) : (
                      <h3 className="text-xl font-semibold text-gray-800 mb-3 ml-4">
                        {section.title}
                      </h3>
                    )}
                    
                    {/* Image de la section (style moderne avec Card) */}
                    {section.wall && section.wall !== 'no.jpg' && (
                      <Card className="float-left mr-6 mb-4 overflow-hidden shadow-lg hover:shadow-xl transition-shadow border-2 border-gray-100" style={{ width: '240px' }}>
                        <CardContent className="p-0">
                          <img 
                            src={`/upload/blog/guide/mini/${section.wall}`}
                            alt={section.title}
                            width={240}
                            height={176}
                            className="w-full h-auto object-cover"
                            loading="lazy"
                          />
                        </CardContent>
                      </Card>
                    )}
                    
                    <div 
                      className={`prose prose-lg max-w-none ${section.level === 3 ? 'ml-4' : ''}
                        prose-p:text-gray-700 prose-p:leading-relaxed
                        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                        prose-strong:font-semibold
                        prose-ul:list-disc prose-ul:pl-6
                        prose-li:text-gray-700`}
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />

                    {/* Clear float après l'image */}
                    {section.wall && section.wall !== 'no.jpg' && (
                      <div className="clear-both" />
                    )}

                    {/* CTA de section (si présent) */}
                    {section.cta_link && section.cta_anchor && (
                      <CTAButton 
                        anchor={section.cta_anchor} 
                        link={section.cta_link}
                        className={section.level === 3 ? 'ml-4' : ''}
                      />
                    )}
                  </section>
                ))}

                {/* Actions */}
                <hr className="my-4 border-gray-200" />
                <div className="flex items-center justify-between mt-8">
                  <div className="flex gap-2">
                    <button 
                      onClick={handleShare}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      Partager
                    </button>
                    <button
                      onClick={handleBookmark}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                      {isBookmarked ? 'Enregistré' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </article>

          {/* Sections de Montage/Démontage (tous les conseils sauf "Rôle") */}
          {conseil && conseil.length > 0 && conseil.filter(c => !c.title.toLowerCase().includes('rôle')).length > 0 && (
            <div className="lg:col-span-3 order-2 mb-8 space-y-6">
              {conseil.filter(c => !c.title.toLowerCase().includes('rôle')).map((conseilItem, index) => (
                <Card key={index} className="shadow-xl border-2 border-green-200 overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {conseilItem.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div 
                      className="prose prose-lg max-w-none
                        prose-headings:text-gray-900 prose-headings:font-bold
                        prose-p:text-gray-700 prose-p:leading-relaxed
                        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-gray-900 prose-strong:font-semibold
                        prose-ul:list-disc prose-ul:pl-6
                        prose-ol:list-decimal prose-ol:pl-6
                        prose-li:text-gray-700 prose-li:mb-2"
                      dangerouslySetInnerHTML={{ __html: conseilItem.content }}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Véhicules Compatibles (Pleine largeur, après l'article) */}
          {article.compatibleVehicles && article.compatibleVehicles.length > 0 && (
            <div className="lg:col-span-3 order-3">
              <VehicleCarousel 
                vehicles={article.compatibleVehicles} 
                gamme={pg_alias}
                seoSwitches={seoSwitches}
              />
            </div>
          )}

          {/* Sidebar (1/3) - Sticky pour toujours visible */}
          <aside className="lg:col-span-1 order-1 lg:order-2">
            <div className="lg:sticky lg:top-20 space-y-6">
              
              {/* 🆕 Table des matières avec scroll spy */}
              {article.sections.length > 0 && (
                <TableOfContents 
                  sections={article.sections.map(s => ({
                    level: s.level,
                    title: s.title,
                    anchor: s.anchor
                  }))}
                />
              )}

            {/* Articles Croisés - "On vous propose" */}
            {article.relatedArticles && article.relatedArticles.length > 0 && (
              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    📰 On vous propose
                  </h3>
                  <div className="h-1 w-16 bg-blue-600 rounded mb-4" />
                  <div className="space-y-3">
                    {article.relatedArticles.map((related) => (
                      <Link
                        key={related.id}
                        to={related.pg_alias ? `/blog-pieces-auto/conseils/${related.pg_alias}` : `/blog/article/${related.slug}`}
                      >
                        <Card className="overflow-hidden hover:shadow-md transition-all group border-gray-200">
                          <div className="flex gap-3 p-3">
                        {/* 🆕 Image mini optimisée - featured image si disponible */}
                        {related.featuredImage ? (
                          <img 
                            src={related.featuredImage}
                            alt={related.title}
                            className="w-20 h-16 object-cover rounded-md flex-shrink-0 border-2 border-gray-200 group-hover:scale-105 transition-transform"
                            loading="lazy"
                            width="80"
                            height="64"
                          />
                        ) : (related as any).wall && (related as any).wall !== 'no.jpg' ? (
                          <img 
                            src={`/upload/blog/guide/mini/${(related as any).wall}`}
                            alt={related.title}
                            className="w-20 h-16 object-cover rounded-md flex-shrink-0 border-2 border-gray-200 group-hover:scale-105 transition-transform"
                            loading="lazy"
                            width="80"
                            height="64"
                          />
                        ) : (
                          <div className="w-20 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-md flex-shrink-0 flex items-center justify-center border-2 border-gray-200">
                            <span className="text-xl">📄</span>
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
                            {/* 🆕 Date de publication */}
                            {(related as any).updatedAt && (
                              <>
                                <span>•</span>
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {new Date((related as any).updatedAt).toLocaleDateString('fr-FR', { 
                                    day: '2-digit', 
                                    month: '2-digit', 
                                    year: 'numeric' 
                                  })}
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
            )}

            </div>
          </aside>
        </div>

        {/* ⬅️➡️ Navigation entre articles (précédent/suivant) */}
        <div className="max-w-6xl mx-auto mt-8">
          <ArticleNavigation
            previous={adjacentArticles.previous}
            next={adjacentArticles.next}
          />
        </div>
        </div>
      </div>

      {/* 🆕 Bouton retour en haut */}
      <ScrollToTop />
    </div>
  );
}
