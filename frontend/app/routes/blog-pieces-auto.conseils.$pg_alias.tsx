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
import { useState } from "react";
import CTAButton from "~/components/blog/CTAButton";
import VehicleCarousel from "~/components/blog/VehicleCarousel";

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

// Loader
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { pg_alias } = params;
  
  if (!pg_alias) {
    throw new Response("Not Found", { status: 404 });
  }

  try {
    // Appeler l'API pour trouver l'article correspondant à cette gamme
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl}/api/blog/article/by-gamme/${pg_alias}`,
      {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      }
    );

    if (!response.ok) {
      throw new Response("Article Not Found", { status: 404 });
    }

    const { data: article } = await response.json();

    if (!article) {
      throw new Response("Article Not Found", { status: 404 });
    }

    return json({ article, pg_alias });
    
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
  const { article, pg_alias } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Calculer le temps de lecture (approximatif)
  const readingTime = Math.ceil(
    (article.content.length + article.sections.reduce((acc, s) => acc + s.content.length, 0)) / 1000
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <Link to="/" className="hover:text-primary transition-colors">
              Accueil
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link to="/blog" className="hover:text-primary transition-colors">
              Blog
            </Link>
            <ChevronRight className="w-4 h-4" />
            <Link to="/blog-pieces-auto/conseils" className="hover:text-primary transition-colors">
              Conseils
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900 font-medium capitalize">{pg_alias}</span>
          </nav>
        </div>
      </div>

      {/* En-tête Article */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-12">
        <div className="container mx-auto px-4">
          <button
            onClick={() => navigate('/blog')}
            className="mb-6 px-4 py-2 text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au blog
          </button>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            {article.h1}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-white/90">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                {new Date(article.publishedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{readingTime} min de lecture</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span>{article.viewsCount.toLocaleString()} vues</span>
            </div>
          </div>

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {article.tags.slice(0, 5).map((tag) => (
                <span 
                  key={tag} 
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-white/20 text-white hover:bg-white/30 transition-colors"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contenu Principal */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Article (2/3) */}
          <article className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-8">
                
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
                    
                    <div 
                      className={`prose prose-lg max-w-none ${section.level === 3 ? 'ml-4' : ''}
                        prose-p:text-gray-700 prose-p:leading-relaxed
                        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                        prose-strong:font-semibold
                        prose-ul:list-disc prose-ul:pl-6
                        prose-li:text-gray-700`}
                      dangerouslySetInnerHTML={{ __html: section.content }}
                    />

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
                    <button className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                      <Share2 className="w-4 h-4" />
                      Partager
                    </button>
                    <button
                      onClick={() => setIsBookmarked(!isBookmarked)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
                      {isBookmarked ? 'Enregistré' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
            </div>
          </article>

          {/* Véhicules Compatibles (Pleine largeur, après l'article) */}
          {article.compatibleVehicles && article.compatibleVehicles.length > 0 && (
            <div className="lg:col-span-3">
              <VehicleCarousel vehicles={article.compatibleVehicles} />
            </div>
          )}

          {/* Sidebar (1/3) */}
          <aside className="space-y-6">
            
            {/* Table des matières */}
            {article.sections.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg sticky top-4">
                <div className="p-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    📑 Sommaire
                  </h3>
                  <nav className="space-y-2">
                    {article.sections.map((section) => (
                      <a
                        key={section.anchor}
                        href={`#${section.anchor}`}
                        className={`
                          block text-sm hover:text-blue-600 transition-colors
                          ${section.level === 2 ? 'font-medium text-gray-900' : 'ml-4 text-gray-600'}
                        `}
                      >
                        {section.title}
                      </a>
                    ))}
                  </nav>
                </div>
              </div>
            )}

            {/* Articles Croisés - "On vous propose" */}
            {article.relatedArticles && article.relatedArticles.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    📰 On vous propose
                  </h3>
                  <div className="space-y-4">
                    {article.relatedArticles.map((related) => (
                      <Link
                        key={related.id}
                        to={related.pg_alias ? `/blog-pieces-auto/conseils/${related.pg_alias}` : `/blog/article/${related.slug}`}
                        className="block group hover:bg-gray-50 rounded-lg p-3 transition-colors"
                      >
                        <h4 className="font-medium text-sm text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
                          {related.title}
                        </h4>
                        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                          {related.excerpt}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Eye className="w-3 h-3" />
                          <span>{related.viewsCount.toLocaleString()} vues</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </aside>
        </div>
      </div>
    </div>
  );
}
