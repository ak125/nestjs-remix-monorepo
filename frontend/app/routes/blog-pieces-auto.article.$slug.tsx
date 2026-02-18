import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Share2,
  Bookmark,
  Tag,
} from "lucide-react";

import { useState } from "react";
import { toast } from "sonner";

// Error components
import { Error404 } from "~/components/errors/Error404";
import { Error410 } from "~/components/errors/Error410";

// UI Components
import { HtmlContent } from "~/components/seo/HtmlContent";
import { Alert } from "~/components/ui";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { logger } from "~/utils/logger";
import { stripHtmlForMeta } from "~/utils/seo-clean.utils";

// Types
interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  h1?: string;
  h2?: string;
  type: "advice" | "guide" | "constructeur" | "glossaire";
  keywords: string[];
  tags?: string[];
  publishedAt: string;
  updatedAt?: string;
  viewsCount: number;
  readingTime?: number;
  sections?: Array<{
    level: number;
    title: string;
    content: string;
    anchor: string;
  }>;
  legacy_id?: number;
  legacy_table?: string;
  pg_alias?: string | null;
  seo_data?: {
    meta_title?: string;
    meta_description?: string;
  };
}

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  type: string;
  viewsCount: number;
  readingTime: number;
}

interface LoaderData {
  article: BlogArticle | null;
  relatedArticles: RelatedArticle[];
  error?: string;
}

// Meta SEO
export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data?.article) {
    return [
      { title: "Article non trouvé - Blog Automecanik" },
      { name: "robots", content: "noindex" },
    ];
  }

  const article = data.article;
  const title = article.seo_data?.meta_title || article.h1 || article.title;
  const description = stripHtmlForMeta(
    article.seo_data?.meta_description || article.excerpt,
  );
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;

  // 📰 Schema TechArticle - Rich snippets pour articles techniques auto
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": article.type === "guide" ? "TechArticle" : "Article",
    "@id": canonicalUrl,
    headline: title,
    description: description,
    url: canonicalUrl,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt || article.publishedAt,
    // Auteur et éditeur
    author: {
      "@type": "Organization",
      name: "Automecanik",
      url: "https://www.automecanik.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Automecanik",
      url: "https://www.automecanik.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.automecanik.com/logo-navbar.webp",
      },
    },
    // Catégorie et mots-clés
    articleSection:
      article.type === "advice"
        ? "Conseils Auto"
        : article.type === "guide"
          ? "Guides Techniques"
          : article.type === "constructeur"
            ? "Constructeurs"
            : "Glossaire",
    keywords: article.keywords.join(", "),
    // Temps de lecture estimé
    ...(article.readingTime && { timeRequired: `PT${article.readingTime}M` }),
    // Page principale
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    // Compteur de vues (social proof)
    ...(article.viewsCount > 0 && {
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ReadAction",
        userInteractionCount: article.viewsCount,
      },
    }),
  };

  return [
    { title: `${title} - Blog Automecanik` },
    { name: "description", content: description },
    { name: "keywords", content: article.keywords.join(", ") },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonicalUrl },
    { property: "article:published_time", content: article.publishedAt },
    {
      property: "article:modified_time",
      content: article.updatedAt || article.publishedAt,
    },
    { property: "article:tag", content: article.keywords.join(", ") },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "author", content: "Automecanik - Experts Automobile" },
    { name: "robots", content: "index, follow" },
    // 📰 JSON-LD Schema Article
    { "script:ld+json": articleSchema },
  ];
};

// Loader
export async function loader({ params }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    return redirect("/blog-pieces-auto", 301);
  }

  // 🎯 Détection des URLs legacy "entretien-..." qui n'existent plus (78k URLs GSC)
  // Ces URLs ont été générées pour le sitemap mais le contenu n'a jamais été créé
  // Retourner 410 Gone pour que Google les retire de l'index
  const isLegacyEntretienUrl =
    slug.startsWith("entretien-") &&
    /-(ampoule|filtre|plaquette|courroie|frein|huile|bougie|batterie|essuie|disque|tambour|roulement|rotule|triangle|biellette|silentbloc|cardan|soufflet|cremaillere|direction|suspension|amortisseur|ressort|barre|stabilisateur|joint|culasse|soupape|segment|piston|bielle|vilebrequin|arbre|came|distribution|pompe|injecteur|turbo|echappement|catalyseur|sonde|capteur|thermostat|radiateur|ventilateur|durite|liquide|antigel|lave|glace|retroviseur|phare|clignotant|feu|stop|recul|antibrouillard|klaxon|avertisseur|demarreur|alternateur|bobine|allumage|faisceau|relais|fusible|contacteur|commodo|interrupteur|bouton|poignee|serrure|barillet|cle|telecommande|antenne|autoradio|haut|parleur|vitre|leve|moteur|mecanisme|regulateur|charniere|compas|verin|hayon|coffre|capot|portiere|aile|pare|choc|calandre|grille|enjoliveur|jante|roue|pneu|valve|ecrou|goujon|cache|enjoliveur)/i.test(
      slug,
    );

  if (isLegacyEntretienUrl) {
    // Retourner 410 Gone - Signal à Google que le contenu est définitivement supprimé
    throw new Response(
      JSON.stringify({
        error: "Content Permanently Removed",
        code: "CONTENT_GONE",
        message: "Ce contenu n'est plus disponible sur notre site.",
        suggestion:
          "Utilisez notre recherche pour trouver des guides similaires.",
        searchUrl:
          "/search?q=" +
          encodeURIComponent(
            slug
              .replace(/entretien-/i, "")
              .replace(/-/g, " ")
              .slice(0, 50),
          ),
      }),
      {
        status: 410,
        statusText: "Gone",
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let article: BlogArticle | null = null;
  let relatedArticles: RelatedArticle[] = [];

  // Timeout de 15s pour éviter les erreurs 5xx sur timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    // Récupérer l'article
    const articleResponse = await fetch(
      `http://127.0.0.1:3000/api/blog/article/${encodeURIComponent(slug)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );

    if (articleResponse.ok) {
      const articleData = await articleResponse.json();
      article = articleData.data || articleData;
    }

    // 301 : les articles advice et guide ont leur propre route canonique
    if (article?.type === "advice" && article?.pg_alias) {
      clearTimeout(timeoutId);
      return redirect(`/blog-pieces-auto/conseils/${article.pg_alias}`, 301);
    }
    if (article?.legacy_table === "__blog_guide") {
      clearTimeout(timeoutId);
      return redirect(`/blog-pieces-auto/guide-achat/${article.slug}`, 301);
    }

    // Récupérer articles similaires (optionnel, ne bloque pas)
    if (article) {
      try {
        const similarResponse = await fetch(
          `http://127.0.0.1:3000/api/blog/popular?limit=4`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          },
        );

        if (similarResponse.ok) {
          const similarData = await similarResponse.json();
          relatedArticles = similarData.data || similarData || [];
        }
      } catch (e) {
        logger.warn("Articles similaires non disponibles");
      }
    }

    clearTimeout(timeoutId);
  } catch (error) {
    clearTimeout(timeoutId);

    // Gestion spécifique des timeouts - retourne 503 au lieu de 500
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("Timeout fetching article:", slug);
      throw new Response("Service temporairement indisponible", {
        status: 503,
      });
    }

    logger.error("Erreur chargement article:", error);
    return redirect("/blog-pieces-auto", 302);
  }

  if (!article) {
    // 🔄 SEO: Article non trouvé → 301 redirect vers index du blog
    // Raison: 412 est traité comme 4xx par Google → désindexation
    // 301 préserve le PageRank et guide vers une page indexable
    return redirect("/blog-pieces-auto", 301);
  }

  return json<LoaderData>({
    article,
    relatedArticles,
  });
}

// Composant principal
export default function BlogArticle() {
  const { article, relatedArticles, error } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Erreur ou article non trouvé
  if (error || !article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Article non trouvé</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-6">
              {error ||
                "L'article que vous recherchez n'existe pas ou a été supprimé."}
            </p>
            <Button onClick={() => navigate("/blog")} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au blog
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fonctions utilitaires
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatViews = (views: number) => {
    if (views > 1000000) return `${(views / 1000000).toFixed(1)}M vues`;
    if (views > 1000) return `${(views / 1000).toFixed(1)}k vues`;
    return `${views} vues`;
  };

  const getTypeLabel = (type: string) => {
    const labels = {
      advice: "Conseil",
      guide: "Guide",
      constructeur: "Constructeur",
      glossaire: "Glossaire",
    };
    return labels[type as keyof typeof labels] || type;
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.excerpt,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Lien copié !", {
        description: "Le lien de l'article a été copié",
        duration: 2000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <PublicBreadcrumb
            items={[
              { label: "Blog", href: "/blog-pieces-auto" },
              { label: article.title },
            ]}
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contenu principal */}
          <div className="lg:col-span-2">
            <article className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* Header article */}
              <div className="p-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className="bg-white/20 text-white border-white/30">
                    {getTypeLabel(article.type)}
                  </Badge>

                  <div className="flex items-center gap-4 text-white/90 text-sm">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(article.publishedAt)}
                    </span>

                    {article.readingTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {article.readingTime} min
                      </span>
                    )}

                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {formatViews(article.viewsCount)}
                    </span>
                  </div>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
                  {article.h1 || article.title}
                </h1>

                {article.h2 && (
                  <p className="text-xl text-white/90 leading-relaxed">
                    {article.h2}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleShare}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Partager
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsBookmarked(!isBookmarked)}
                    className={`border-white/30 ${
                      isBookmarked
                        ? "bg-white text-blue-600"
                        : "bg-white/20 hover:bg-white/30 text-white"
                    }`}
                  >
                    <Bookmark
                      className={`w-4 h-4 mr-2 ${isBookmarked ? "fill-current" : ""}`}
                    />
                    {isBookmarked ? "Sauvegardé" : "Sauvegarder"}
                  </Button>
                </div>
              </div>

              {/* Contenu HTML de l'article */}
              <div className="p-8">
                {article.excerpt && (
                  <Alert intent="info">{article.excerpt}</Alert>
                )}

                {/* 🎯 AFFICHAGE DU CONTENU HTML - Utilise HtmlContent pour navigation SPA */}
                <HtmlContent
                  html={article.content}
                  className="prose prose-lg max-w-none
                    prose-headings:text-gray-900 prose-headings:font-bold
                    prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6
                    prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4
                    prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                    prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                    prose-strong:text-gray-900 prose-strong:font-semibold
                    prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6
                    prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6
                    prose-li:text-gray-700 prose-li:my-2
                    prose-img:rounded-xl prose-img:shadow-lg prose-img:my-8
                    prose-blockquote:border-l-4 prose-blockquote:border-blue-600 
                    prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-gray-700
                    prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded
                  "
                  trackLinks={true}
                />

                {/* Sections additionnelles (si structurées) */}
                {article.sections && article.sections.length > 0 && (
                  <div className="mt-12 space-y-8">
                    {article.sections.map((section, index) => (
                      <div key={index} id={section.anchor}>
                        <h3 className="text-2xl font-bold text-gray-900 mb-4">
                          {section.title}
                        </h3>
                        <HtmlContent
                          html={section.content}
                          className="prose prose-lg max-w-none text-gray-700"
                          trackLinks={true}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {article.keywords && article.keywords.length > 0 && (
                  <div className="mt-12 pt-8 border-t">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      Mots-clés
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {article.keywords.map((keyword, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-info/20 text-info hover:bg-primary/30"
                        >
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </article>

            {/* Navigation article précédent/suivant */}
            <div className="mt-8 flex justify-between">
              <Button
                variant="outline"
                onClick={() => navigate("/blog")}
                className="group"
              >
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Retour aux articles
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            {/* Articles similaires */}
            {relatedArticles && relatedArticles.length > 0 && (
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Articles similaires
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {relatedArticles.slice(0, 4).map((related) => (
                      <Link
                        key={related.id}
                        to={`/blog-pieces-auto/article/${related.slug}`}
                        className="block group"
                      >
                        <div className="p-4 rounded-lg border hover:border-blue-600 hover:bg-info/20 transition-all">
                          <Badge variant="secondary" className="mb-2 text-xs">
                            {getTypeLabel(related.type)}
                          </Badge>
                          <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
                            {related.title}
                          </h4>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {related.excerpt}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {related.readingTime || 5} min
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {formatViews(related.viewsCount)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <hr className="my-4 border-gray-200" />

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/blog")}
                  >
                    Voir tous les articles
                  </Button>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

// ErrorBoundary pour gérer les erreurs 410/404
export function ErrorBoundary() {
  const error = useRouteError();

  // Gérer les réponses HTTP (410, 404, etc.)
  if (isRouteErrorResponse(error)) {
    // 410 Gone - Contenu définitivement supprimé (URLs legacy "entretien-...")
    if (error.status === 410) {
      // Extraire les données JSON si disponibles
      let errorData: { searchUrl?: string; message?: string } = {};
      try {
        if (typeof error.data === "string") {
          errorData = JSON.parse(error.data);
        } else if (error.data) {
          errorData = error.data;
        }
      } catch {
        // Ignorer les erreurs de parsing
      }

      return (
        <Error410
          url={typeof window !== "undefined" ? window.location.href : undefined}
          isOldLink={true}
          redirectTo={errorData.searchUrl}
        />
      );
    }

    // 404 Not Found
    if (error.status === 404) {
      return (
        <Error404
          url={typeof window !== "undefined" ? window.location.href : undefined}
        />
      );
    }
  }

  // Erreur par défaut
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Une erreur est survenue
        </h1>
        <p className="text-gray-600 mb-6">
          Nous n'avons pas pu charger cet article. Veuillez réessayer.
        </p>
        <Link
          to="/blog-pieces-auto"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Retour aux articles
        </Link>
      </div>
    </div>
  );
}
