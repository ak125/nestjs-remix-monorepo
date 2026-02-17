/**
 * Route : /reference-auto/:slug
 * Affiche la page Référence (R4) - Définition canonique d'une pièce auto
 *
 * Rôle SEO : R4 - RÉFÉRENCE
 * Intention : Définition officielle / vérité mécanique
 *
 * Exemple :
 * /reference-auto/kit-embrayage
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  ArrowLeft,
  BookOpen,
  AlertTriangle,
  Wrench,
  Layers,
  ExternalLink,
  FileText,
  ShoppingCart,
  XCircle,
  Shield,
  Info,
} from "lucide-react";

// UI Components
import { Badge } from "../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Error404 } from "~/components/errors/Error404";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { getInternalApiUrl } from "~/utils/internal-api.server";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 * Permet l'ajout automatique de data-attributes sur <body>
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R4_REFERENCE, {
    clusterId: "reference", // Sera dynamique via loader si besoin
    canonicalEntity: "reference-auto",
  }),
};

// Types
interface Reference {
  slug: string;
  title: string;
  metaDescription: string | null;
  definition: string;
  roleMecanique: string | null;
  roleNegatif: string | null; // NOUVEAU: "Ce que ça NE fait PAS"
  composition: string[] | null;
  confusionsCourantes: string[] | null;
  symptomesAssocies: string[] | null;
  reglesMetier: string[] | null; // NOUVEAU: Règles anti-erreur
  scopeLimites: string | null; // NOUVEAU: Variantes et limitations
  contentHtml: string | null;
  schemaJson: Record<string, unknown> | null;
  gamme: {
    pgId: number | null;
    name: string | null;
    url: string | null;
  };
  relatedReferences: number[] | null;
  blogSlugs: string[] | null;
  canonicalUrl: string;
  updatedAt: string;
}

interface RelatedRef {
  slug: string;
  title: string;
}

interface LoaderData {
  reference: Reference;
  relatedRefs: RelatedRef[];
}

/* ===========================
   Meta
=========================== */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data?.reference) {
    return [
      { title: "Référence non trouvée - Pièces Auto" },
      { name: "robots", content: "noindex" },
    ];
  }

  const { reference } = data;
  const canonicalUrl = `https://www.automecanik.com${reference.canonicalUrl}`;
  const description =
    reference.metaDescription || reference.definition.substring(0, 155);

  // Extraire le cluster ID du slug (ex: kit-embrayage → embrayage)
  const clusterId = reference.slug
    .replace(/^kit-/, "")
    .replace(/^set-/, "")
    .replace(/^jeu-de-/, "");

  const result: ReturnType<MetaFunction> = [
    { title: reference.title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
    // Open Graph
    { property: "og:title", content: reference.title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonicalUrl },
    // Twitter
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: reference.title },
    { name: "twitter:description", content: description },
    // Article meta (Open Graph enrichi)
    { property: "article:modified_time", content: reference.updatedAt },
    { property: "article:section", content: "Référence Auto" },
    {
      property: "article:tag",
      content: reference.title.replace(/ :.*$/, ""),
    },
    // SEO Role Signals (Phase 5 - Quasi-Incopiable)
    { name: "x-page-role", content: "R4" },
    { name: "x-page-intent", content: "definition" },
    { name: "x-content-type", content: "reference" },
    { name: "x-cluster-id", content: clusterId },
  ];

  return result;
};

/* ===========================
   Loader
=========================== */
export async function loader({ params }: LoaderFunctionArgs) {
  const { slug } = params;

  if (!slug) {
    throw new Response("Slug manquant", { status: 400 });
  }

  try {
    const backendUrl = getInternalApiUrl("");

    const res = await fetch(`${backendUrl}/api/seo/reference/${slug}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      throw new Response("Référence non trouvée", { status: 404 });
    }

    const reference = await res.json();

    if (!reference || !reference.slug) {
      throw new Response("Référence non trouvée", { status: 404 });
    }

    // Fetch related references (non-blocking — empty array on error)
    let relatedRefs: RelatedRef[] = [];
    try {
      const relRes = await fetch(
        `${backendUrl}/api/seo/reference/${slug}/related`,
        { headers: { "Content-Type": "application/json" } },
      );
      if (relRes.ok) {
        const relData = await relRes.json();
        relatedRefs = (relData.related || []).map(
          (r: { slug: string; title: string }) => ({
            slug: r.slug,
            title: r.title,
          }),
        );
      }
    } catch {
      // Silently ignore — related refs are optional
    }

    return json<LoaderData>({ reference, relatedRefs });
  } catch (error) {
    logger.error("Erreur chargement référence:", error);
    throw new Response("Référence non trouvée", { status: 404 });
  }
}

/* ===========================
   JSON-LD Schema
=========================== */
function SchemaJsonLd({ reference }: { reference: Reference }) {
  const shortTitle = reference.title.replace(/ :.*$/, "");
  const canonicalUrl = `https://automecanik.com${reference.canonicalUrl}`;

  // Schema 1: DefinedTerm (semantic definition)
  const definedTermSchema = reference.schemaJson || {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: shortTitle,
    description: reference.definition.substring(0, 300),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Référence Auto - Pièces Automobiles",
      url: "https://automecanik.com/reference-auto",
    },
    url: canonicalUrl,
  };

  // Schema 2: TechArticle (technical content - Phase 5 SEO Signal)
  const techArticleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: reference.title,
    description:
      reference.metaDescription || reference.definition.substring(0, 155),
    url: canonicalUrl,
    author: {
      "@type": "Organization",
      name: "Automecanik",
      url: "https://automecanik.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Automecanik",
      logo: {
        "@type": "ImageObject",
        url: "https://automecanik.com/logo.png",
      },
    },
    dateModified: reference.updatedAt,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    about: {
      "@type": "Thing",
      name: shortTitle,
      description: reference.definition.substring(0, 200),
    },
    // Technical article specifics
    proficiencyLevel: "Beginner",
    dependencies: reference.composition?.join(", ") || undefined,
  };

  // Schema 3: Breadcrumbs JSON-LD
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: "https://automecanik.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Référence Auto",
        item: "https://automecanik.com/reference-auto",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: shortTitle,
        item: canonicalUrl,
      },
    ],
  };

  // Schema 4: FAQPage from confusions courantes (rich snippets)
  const faqSchema =
    reference.confusionsCourantes && reference.confusionsCourantes.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: reference.confusionsCourantes.map((item) => {
            const parts = item.split(" : ");
            const questionPart = parts[0]
              .replace(/\s*≠\s*/g, " et ")
              .replace(/\s*!=\s*/g, " et ");
            return {
              "@type": "Question",
              name: `Quelle est la différence entre ${questionPart} ?`,
              acceptedAnswer: {
                "@type": "Answer",
                text: parts.length > 1 ? parts.slice(1).join(" : ") : item,
              },
            };
          }),
        }
      : null;

  return (
    <>
      {/* DefinedTerm - Semantic definition signal */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTermSchema) }}
      />
      {/* TechArticle - Technical content signal (Phase 5) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleSchema) }}
      />
      {/* BreadcrumbList - Navigation signal */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {/* FAQPage - Rich snippets for confusions courantes */}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
    </>
  );
}

/* ===========================
   Component
=========================== */
export default function ReferenceDetailPage() {
  const { reference, relatedRefs } = useLoaderData<typeof loader>();

  const shortTitle = reference.title.replace(/ :.*$/, "");
  // Cluster ID pour les signaux SEO (ex: kit-embrayage → embrayage)
  const clusterId = reference.slug
    .replace(/^kit-/, "")
    .replace(/^set-/, "")
    .replace(/^jeu-de-/, "");

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50"
      // Phase 5: Data attributes pour signaux SEO explicites
      data-page-role="R4"
      data-page-intent="definition"
      data-content-type="reference"
      data-canonical-entity={reference.slug}
      data-cluster-id={clusterId}
    >
      {/* Schema.org JSON-LD (DefinedTerm + TechArticle + Breadcrumbs) */}
      <SchemaJsonLd reference={reference} />

      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-12">
        <div className="container mx-auto px-4">
          {/* Breadcrumbs */}
          <nav className="text-sm mb-4 text-indigo-200">
            <ol className="flex items-center gap-2">
              <li>
                <Link to="/" className="hover:text-white transition-colors">
                  Accueil
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link
                  to="/reference-auto"
                  className="hover:text-white transition-colors"
                >
                  Référence Auto
                </Link>
              </li>
              <li>/</li>
              <li className="text-white font-medium">{shortTitle}</li>
            </ol>
          </nav>

          {/* Title */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <Badge className="mb-2 bg-white/20 text-white border-0">
                Référence Auto
              </Badge>
              <h1 className="text-3xl md:text-4xl font-bold">
                {reference.title}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Back Button */}
      <section className="py-4 border-b bg-white">
        <div className="container mx-auto px-4">
          <Link
            to="/reference-auto"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Toutes les références
          </Link>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - article tag for R4 semantic signal */}
          <article className="lg:col-span-2 space-y-8">
            {/* Definition - Using semantic HTML (dl/dt/dd + dfn) for R4 signal */}
            <Card className="shadow-lg border-2 border-indigo-100">
              <CardHeader className="bg-indigo-50/50">
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <FileText className="w-5 h-5" />
                  Définition
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <dl>
                  <dt className="sr-only">Terme</dt>
                  <dd>
                    <dfn className="not-italic font-normal text-lg text-gray-700 leading-relaxed">
                      {reference.definition}
                    </dfn>
                  </dd>
                </dl>
              </CardContent>
            </Card>

            {/* Role Mecanique */}
            {reference.roleMecanique && (
              <Card className="shadow-lg border-2 border-green-100">
                <CardHeader className="bg-green-50/50">
                  <CardTitle className="flex items-center gap-2 text-green-900">
                    <Wrench className="w-5 h-5" />
                    Rôle mécanique
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {reference.roleMecanique}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Composition */}
            {reference.composition && reference.composition.length > 0 && (
              <Card className="shadow-lg border-2 border-blue-100">
                <CardHeader className="bg-blue-50/50">
                  <CardTitle className="flex items-center gap-2 text-blue-900">
                    <Layers className="w-5 h-5" />
                    Composition
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-2">
                    {reference.composition.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Confusions Courantes */}
            {reference.confusionsCourantes &&
              reference.confusionsCourantes.length > 0 && (
                <Card className="shadow-lg border-2 border-amber-100">
                  <CardHeader className="bg-amber-50/50">
                    <CardTitle className="flex items-center gap-2 text-amber-900">
                      <AlertTriangle className="w-5 h-5" />
                      Confusions courantes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <ul className="space-y-3">
                      {reference.confusionsCourantes.map((item, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg"
                        >
                          <span className="text-amber-600 font-bold text-lg">
                            !
                          </span>
                          <span className="text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

            {/* Ce que ça NE fait PAS (roleNegatif en liste) */}
            {reference.roleNegatif && (
              <Card className="shadow-lg border-2 border-red-100">
                <CardHeader className="bg-red-50/50">
                  <CardTitle className="flex items-center gap-2 text-red-900">
                    <XCircle className="w-5 h-5" />
                    Ce que ça NE fait PAS
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {reference.roleNegatif
                      .split(/\.\s+/)
                      .filter((s) => s.trim().length > 10)
                      .map((point, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 p-3 bg-red-50 rounded-lg"
                        >
                          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">
                            {point.trim().replace(/\.$/, "")}
                          </span>
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Règles Métier (anti-erreur) */}
            {reference.reglesMetier && reference.reglesMetier.length > 0 && (
              <Card className="shadow-lg border-2 border-purple-100">
                <CardHeader className="bg-purple-50/50">
                  <CardTitle className="flex items-center gap-2 text-purple-900">
                    <Shield className="w-5 h-5" />
                    Règles métier (anti-erreur)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {reference.reglesMetier.map((rule, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg"
                      >
                        <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-gray-700">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* NOUVEAU: Scope et Limites */}
            {reference.scopeLimites && (
              <Card className="shadow-lg border-2 border-slate-200 bg-slate-50/50">
                <CardHeader className="bg-slate-100/50">
                  <CardTitle className="flex items-center gap-2 text-slate-700">
                    <Info className="w-5 h-5" />
                    Scope et limites
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                    {reference.scopeLimites}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Content HTML (if any) */}
            {reference.contentHtml && (
              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <HtmlContent
                    html={reference.contentHtml}
                    className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4 prose-p:text-gray-700 prose-a:text-indigo-600"
                    trackLinks={true}
                  />
                </CardContent>
              </Card>
            )}
          </article>

          {/* Sidebar - using aside for complementary content */}
          <aside className="space-y-6">
            {/* Lien vers Gamme (R1) */}
            {reference.gamme.url && (
              <Card className="shadow-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                <CardHeader>
                  <CardTitle className="text-lg text-indigo-900">
                    Trouver cette pièce
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link
                    to={reference.gamme.url}
                    className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-md transition-all group"
                  >
                    <ShoppingCart className="w-6 h-6 text-indigo-600" />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {reference.gamme.name || shortTitle}
                      </span>
                      <p className="text-sm text-gray-500">
                        Voir les pièces disponibles
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Liens vers Blog (R3) */}
            {reference.blogSlugs && reference.blogSlugs.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-green-600" />
                    Guides et articles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {reference.blogSlugs.map((slug, index) => (
                      <li key={index}>
                        <Link
                          to={`/blog-pieces-auto/conseils/${slug}`}
                          className="flex items-center gap-2 p-2 rounded hover:bg-green-50 text-gray-700 hover:text-green-700 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          <span className="text-sm">
                            Conseil : {slug.replace(/-/g, " ")}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Symptomes (lien vers R5 Diagnostic) */}
            {reference.symptomesAssocies &&
              reference.symptomesAssocies.length > 0 && (
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Symptômes associés
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {reference.symptomesAssocies.map((symptome, index) => (
                        <li key={index}>
                          <Link
                            to={`/diagnostic-auto/${symptome}`}
                            className="flex items-center gap-2 p-2 rounded hover:bg-orange-50 text-gray-700 hover:text-orange-700 transition-colors text-sm"
                          >
                            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                            <span>
                              {symptome
                                .replace(/-/g, " ")
                                .replace(/^\w/, (c) => c.toUpperCase())}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

            {/* Références liées (maillage R4↔R4) */}
            {relatedRefs && relatedRefs.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    Références liées
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {relatedRefs.map((ref) => (
                      <li key={ref.slug}>
                        <Link
                          to={`/reference-auto/${ref.slug}`}
                          className="flex items-center gap-2 p-2 rounded hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 transition-colors text-sm"
                        >
                          <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                          <span>
                            {ref.title.replace(/ : Fiche technique$/, "")}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Info Box */}
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-gray-500 text-center">
                  Dernière mise à jour :{" "}
                  {new Date(reference.updatedAt).toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Error Boundary
=========================== */
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
