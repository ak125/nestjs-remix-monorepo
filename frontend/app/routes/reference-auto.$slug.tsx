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
  Sparkles,
  ListChecks,
  HelpCircle,
  Tag,
} from "lucide-react";
import { type ReactNode } from "react";

// UI Components
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import {
  SectionImage,
  SectionWithImage,
} from "~/components/content/SectionImage";
import { Error404 } from "~/components/errors/Error404";
import { HeroReference, HeroRole } from "~/components/heroes";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  resolveSlogan,
  getSectionImageConfig,
  resolveAltText,
} from "~/config/visual-intent";
import { getInternalApiUrl } from "~/utils/internal-api.server";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

// --- SEO URL helpers ---
const SITE_ORIGIN = "https://www.automecanik.com";
function absUrl(pathname: string): string {
  return `${SITE_ORIGIN}${pathname}`;
}

function getClusterIdFromSlug(slug: string): string {
  return slug
    .replace(/^(kit|set|jeu|jeu-de|kit-de|pack|lot)-/i, "")
    .replace(/-?(avant|arriere|gauche|droite)$/i, "")
    .trim();
}

function smartSnippet(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastDot = cut.lastIndexOf(".");
  return (lastDot > 80 ? cut.slice(0, lastDot + 1) : cut).trim();
}

const R4_FORBIDDEN_KEYWORDS = [
  "installation",
  "procédure",
  "outils nécessaires",
  "temps estimé",
  "difficulté",
  "rodage",
  "erreurs de montage",
  "vérifications post-montage",
];

function isR4SafeHtml(html: string): boolean {
  const lower = html.toLowerCase();
  return !R4_FORBIDDEN_KEYWORDS.some((k) => lower.includes(k));
}

// --- R4Section: composant section Card reutilisable ---
type R4Tone =
  | "indigo"
  | "green"
  | "blue"
  | "amber"
  | "red"
  | "purple"
  | "slate";

const TONES: Record<R4Tone, { border: string; header: string; title: string }> =
  {
    indigo: {
      border: "border-indigo-100",
      header: "bg-indigo-50/50",
      title: "text-indigo-900",
    },
    green: {
      border: "border-green-100",
      header: "bg-green-50/50",
      title: "text-green-900",
    },
    blue: {
      border: "border-blue-100",
      header: "bg-blue-50/50",
      title: "text-blue-900",
    },
    amber: {
      border: "border-amber-100",
      header: "bg-amber-50/50",
      title: "text-amber-900",
    },
    red: {
      border: "border-red-100",
      header: "bg-red-50/50",
      title: "text-red-900",
    },
    purple: {
      border: "border-purple-100",
      header: "bg-purple-50/50",
      title: "text-purple-900",
    },
    slate: {
      border: "border-slate-200",
      header: "bg-slate-100/50",
      title: "text-slate-700",
    },
  };

function R4Section({
  id,
  icon,
  title,
  tone = "indigo",
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  tone?: R4Tone;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <Card id={id} className={`shadow-lg border-2 ${t.border}`}>
      <CardHeader className={t.header}>
        <CardTitle className={`flex items-center gap-2 ${t.title}`}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

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
    pgImg?: string;
    productCount?: number;
  };
  relatedReferences: number[] | null;
  blogSlugs: string[] | null;
  canonicalUrl: string;
  takeaways: string[] | null;
  synonyms: string[] | null;
  variants: { name: string; description: string }[] | null;
  keySpecs:
    | { label: string; value: string; note?: string; source?: string }[]
    | null;
  commonQuestions: { q: string; a: string }[] | null;
  contaminationFlags: string[] | null;
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

/**
 * S16 — HeroRole vs HeroReference
 * HeroRole (pedagogique) si le texte roleMecanique est riche ET la piece a des interactions cross-gamme.
 * Proxy cross_gammes: relatedRefs (liens R4↔R4 vers autres references mecaniquement liees).
 */
function shouldUseHeroRole(
  roleMecanique: string | null,
  relatedRefsCount: number,
): boolean {
  if (!roleMecanique) return false;
  const wordCount = roleMecanique.split(/\s+/).filter(Boolean).length;
  return wordCount >= 100 && relatedRefsCount >= 2;
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
  const canonicalUrl = absUrl(reference.canonicalUrl);
  const description =
    reference.metaDescription || smartSnippet(reference.definition);

  const clusterId = getClusterIdFromSlug(reference.slug);

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
    {
      property: "og:image",
      content: absUrl("/images/og/glossaire-reference.webp"),
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    // Twitter
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: reference.title },
    { name: "twitter:description", content: description },
    {
      name: "twitter:image",
      content: absUrl("/images/og/glossaire-reference.webp"),
    },
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

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Response("Slug invalide", { status: 400 });
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

    return json<LoaderData>(
      { reference, relatedRefs },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
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
  const canonicalUrl = absUrl(reference.canonicalUrl);

  // Schema 1: DefinedTerm (semantic definition)
  const definedTermSchema = reference.schemaJson || {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: shortTitle,
    description: reference.definition.substring(0, 300),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Référence Auto - Pièces Automobiles",
      url: absUrl("/reference-auto"),
    },
    url: canonicalUrl,
  };

  // Schema 2: TechArticle (technical content - Phase 5 SEO Signal)
  const techArticleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: reference.title,
    description:
      reference.metaDescription || smartSnippet(reference.definition),
    url: canonicalUrl,
    author: {
      "@type": "Organization",
      name: "Automecanik",
      url: SITE_ORIGIN,
    },
    publisher: {
      "@type": "Organization",
      name: "Automecanik",
      logo: {
        "@type": "ImageObject",
        url: absUrl("/logo.png"),
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
        item: absUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Référence Auto",
        item: absUrl("/reference-auto"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: shortTitle,
        item: canonicalUrl,
      },
    ],
  };

  // Schema 4: FAQPage — prefer structured commonQuestions, fallback to parsed confusionsCourantes
  const faqSchema = (() => {
    if (reference.commonQuestions && reference.commonQuestions.length > 0) {
      return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: reference.commonQuestions.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      };
    }
    if (
      reference.confusionsCourantes &&
      reference.confusionsCourantes.length > 0
    ) {
      return {
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
      };
    }
    return null;
  })();

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
  const clusterId = getClusterIdFromSlug(reference.slug);

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50"
      // Phase 5: Data attributes pour signaux SEO explicites
      data-page-role="R4"
      data-page-intent="definition"
      data-content-type="reference"
      data-canonical-entity={reference.slug}
      data-cluster-id={clusterId}
      data-family={reference.gamme.name || undefined}
      data-gamme-id={reference.gamme.pgId || undefined}
      data-content-html-present={reference.contentHtml ? "true" : undefined}
      data-content-filtered={
        reference.contentHtml && !isR4SafeHtml(reference.contentHtml)
          ? "true"
          : undefined
      }
    >
      <BlogPiecesAutoNavigation />
      {/* Schema.org JSON-LD (DefinedTerm + TechArticle + Breadcrumbs) */}
      <SchemaJsonLd reference={reference} />

      {/* Breadcrumb */}
      <nav className="bg-white border-b" aria-label="Breadcrumb">
        <div className="container mx-auto px-4 py-3">
          <ol className="flex items-center gap-2 text-sm text-gray-500">
            <li>
              <Link to="/" className="hover:text-gray-700">
                Accueil
              </Link>
            </li>
            <li className="text-gray-300">/</li>
            <li>
              <Link to="/reference-auto" className="hover:text-gray-700">
                Référence Auto
              </Link>
            </li>
            <li className="text-gray-300">/</li>
            <li className="text-gray-900 font-medium truncate">{shortTitle}</li>
          </ol>
        </div>
      </nav>

      {/* Hero — S16: HeroRole (pedagogique) si role riche, sinon HeroReference (neutre) */}
      {shouldUseHeroRole(reference.roleMecanique, relatedRefs.length) ? (
        <HeroRole
          title={reference.title}
          description={reference.definition}
          slogan={resolveSlogan("role-piece", reference.gamme.name)}
          familyName={reference.gamme.name || undefined}
          illustration={
            reference.gamme.pgImg
              ? {
                  src: reference.gamme.pgImg,
                  alt: resolveAltText("role-piece", reference.gamme.name),
                }
              : undefined
          }
        />
      ) : (
        <HeroReference
          title={reference.title}
          categoryBadge={reference.gamme.name || undefined}
          slogan={resolveSlogan("glossaire-reference", reference.gamme.name)}
        />
      )}

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

      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main Content - article tag for R4 semantic signal */}
          <article className="min-w-0 max-w-3xl space-y-8">
            {/* Sommaire dynamique */}
            {(() => {
              const tocItems = [
                { id: "definition", label: "Définition", present: true },
                {
                  id: "takeaways",
                  label: "À retenir",
                  present: !!reference.takeaways?.length,
                },
                {
                  id: "synonyms",
                  label: "Synonymes",
                  present: !!reference.synonyms?.length,
                },
                {
                  id: "role",
                  label: "Rôle mécanique",
                  present: !!reference.roleMecanique,
                },
                {
                  id: "composition",
                  label: "Composition",
                  present: !!reference.composition?.length,
                },
                {
                  id: "variants",
                  label: "Variantes & types",
                  present: !!reference.variants?.length,
                },
                {
                  id: "key-specs",
                  label: "Valeurs & critères",
                  present: !!reference.keySpecs?.length,
                },
                {
                  id: "confusions",
                  label: "Confusions courantes",
                  present: !!reference.confusionsCourantes?.length,
                },
                {
                  id: "faq",
                  label: "Questions fréquentes",
                  present: !!reference.commonQuestions?.length,
                },
                {
                  id: "ne-fait-pas",
                  label: "Ce que ça ne fait pas",
                  present: !!reference.roleNegatif,
                },
                {
                  id: "regles",
                  label: "Règles métier",
                  present: !!reference.reglesMetier?.length,
                },
                {
                  id: "scope",
                  label: "Scope & limites",
                  present: !!reference.scopeLimites,
                },
              ].filter((s) => s.present);

              return tocItems.length > 2 ? (
                <nav
                  aria-label="Sommaire"
                  className="rounded-xl border bg-white p-4"
                >
                  <p className="text-sm font-medium text-gray-900">Sommaire</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {tocItems.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className="text-indigo-700 hover:underline"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null;
            })()}

            <R4Section
              id="definition"
              icon={<FileText className="w-5 h-5" />}
              title="Définition"
              tone="indigo"
            >
              <dl>
                <dt className="sr-only">Terme</dt>
                <dd>
                  <dfn className="not-italic font-normal text-lg text-gray-700 leading-relaxed">
                    {reference.definition}
                  </dfn>
                </dd>
              </dl>
            </R4Section>

            {reference.takeaways && reference.takeaways.length > 0 && (
              <R4Section
                id="takeaways"
                icon={<Sparkles className="w-5 h-5" />}
                title="À retenir"
                tone="indigo"
              >
                <ul className="space-y-2">
                  {reference.takeaways.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-indigo-500 mt-1">•</span>
                      <span className="text-gray-700 font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </R4Section>
            )}

            {reference.synonyms && reference.synonyms.length > 0 && (
              <R4Section
                id="synonyms"
                icon={<Tag className="w-5 h-5" />}
                title="Synonymes & appellations"
                tone="slate"
              >
                <div className="flex flex-wrap gap-2">
                  {reference.synonyms.map((term) => (
                    <Badge
                      key={term}
                      variant="secondary"
                      className="text-sm px-3 py-1"
                    >
                      {term}
                    </Badge>
                  ))}
                </div>
              </R4Section>
            )}

            {reference.roleMecanique &&
              (() => {
                const imgConfig = reference.gamme.pgImg
                  ? getSectionImageConfig(
                      "glossaire-reference",
                      "roleMecanique",
                    )
                  : undefined;
                const textContent = (
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {reference.roleMecanique}
                  </p>
                );
                return (
                  <R4Section
                    id="role"
                    icon={<Wrench className="w-5 h-5" />}
                    title="Rôle mécanique"
                    tone="green"
                  >
                    {imgConfig && reference.gamme.pgImg ? (
                      <SectionWithImage>
                        <SectionImage
                          src={reference.gamme.pgImg}
                          alt={resolveAltText(
                            "glossaire-reference",
                            reference.gamme.name,
                          )}
                          placement={imgConfig.placement}
                          size={imgConfig.size}
                        />
                        {textContent}
                      </SectionWithImage>
                    ) : (
                      textContent
                    )}
                  </R4Section>
                );
              })()}

            {reference.composition && reference.composition.length > 0 && (
              <R4Section
                id="composition"
                icon={<Layers className="w-5 h-5" />}
                title="Composition"
                tone="blue"
              >
                <ul className="space-y-2">
                  {reference.composition.map((item, index) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </R4Section>
            )}

            {reference.variants && reference.variants.length > 0 && (
              <R4Section
                id="variants"
                icon={<ListChecks className="w-5 h-5" />}
                title="Variantes & types"
                tone="blue"
              >
                <dl className="space-y-4">
                  {reference.variants.map((v) => (
                    <div key={v.name} className="p-3 bg-blue-50 rounded-lg">
                      <dt className="font-semibold text-blue-900">{v.name}</dt>
                      <dd className="mt-1 text-gray-700">{v.description}</dd>
                    </div>
                  ))}
                </dl>
              </R4Section>
            )}

            {reference.keySpecs && reference.keySpecs.length > 0 && (
              <R4Section
                id="key-specs"
                icon={<Info className="w-5 h-5" />}
                title="Valeurs & critères"
                tone="slate"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-2 pr-4 font-medium text-slate-600">
                          Critère
                        </th>
                        <th className="text-left py-2 pr-4 font-medium text-slate-600">
                          Valeur
                        </th>
                        <th className="text-left py-2 font-medium text-slate-600">
                          Note
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reference.keySpecs.map((spec) => (
                        <tr
                          key={spec.label}
                          className="border-b border-slate-100"
                        >
                          <td className="py-2 pr-4 font-medium text-gray-900">
                            {spec.label}
                          </td>
                          <td className="py-2 pr-4 text-gray-700">
                            {spec.value}
                          </td>
                          <td className="py-2 text-gray-500 text-xs">
                            {spec.note || ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </R4Section>
            )}

            {reference.confusionsCourantes &&
              reference.confusionsCourantes.length > 0 && (
                <R4Section
                  id="confusions"
                  icon={<AlertTriangle className="w-5 h-5" />}
                  title="Confusions courantes"
                  tone="amber"
                >
                  <ul className="space-y-3">
                    {reference.confusionsCourantes.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg"
                      >
                        <span className="text-amber-600 font-bold text-lg">
                          !
                        </span>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </R4Section>
              )}

            {reference.commonQuestions &&
              reference.commonQuestions.length > 0 && (
                <R4Section
                  id="faq"
                  icon={<HelpCircle className="w-5 h-5" />}
                  title="Questions fréquentes"
                  tone="amber"
                >
                  <dl className="space-y-4">
                    {reference.commonQuestions.map((faq) => (
                      <div key={faq.q} className="p-4 bg-amber-50 rounded-lg">
                        <dt className="font-semibold text-amber-900">
                          {faq.q}
                        </dt>
                        <dd className="mt-2 text-gray-700">{faq.a}</dd>
                      </div>
                    ))}
                  </dl>
                </R4Section>
              )}

            {reference.roleNegatif && (
              <R4Section
                id="ne-fait-pas"
                icon={<XCircle className="w-5 h-5" />}
                title="Ce que ça NE fait PAS"
                tone="red"
              >
                <ul className="space-y-3">
                  {reference.roleNegatif
                    .split(/\.\s+/)
                    .filter((s) => s.trim().length > 10)
                    .map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-3 p-3 bg-red-50 rounded-lg"
                      >
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">
                          {point.trim().replace(/\.$/, "")}
                        </span>
                      </li>
                    ))}
                </ul>
              </R4Section>
            )}

            {reference.reglesMetier && reference.reglesMetier.length > 0 && (
              <R4Section
                id="regles"
                icon={<Shield className="w-5 h-5" />}
                title="Règles métier (anti-erreur)"
                tone="purple"
              >
                <ul className="space-y-3">
                  {reference.reglesMetier.map((rule, index) => (
                    <li
                      key={rule}
                      className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg"
                    >
                      <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{rule}</span>
                    </li>
                  ))}
                </ul>
              </R4Section>
            )}

            {reference.scopeLimites && (
              <R4Section
                id="scope"
                icon={<Info className="w-5 h-5" />}
                title="Scope et limites"
                tone="slate"
              >
                <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                  {reference.scopeLimites}
                </p>
              </R4Section>
            )}

            {reference.contentHtml && isR4SafeHtml(reference.contentHtml) && (
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
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {/* Lien vers Gamme (R1) */}
            {reference.gamme.url && (
              <Card className="shadow-lg border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                <CardHeader>
                  <CardTitle className="text-lg text-indigo-900 flex items-center gap-2">
                    Trouver cette pièce
                    <Badge
                      variant="outline"
                      className="text-xs text-indigo-600 border-indigo-200"
                    >
                      Catalogue
                    </Badge>
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
                        {reference.gamme.productCount
                          ? `${reference.gamme.productCount} pièces disponibles`
                          : "Voir les pièces disponibles"}
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
                    {reference.blogSlugs.map((slug) => (
                      <li key={slug}>
                        <Link
                          to={`/blog-pieces-auto/conseils/${slug}`}
                          className="flex items-center gap-2 p-2 rounded hover:bg-green-50 text-gray-700 hover:text-green-700 transition-colors"
                        >
                          <Badge
                            variant="outline"
                            className="text-xs text-green-600 border-green-200 flex-shrink-0"
                          >
                            Guide
                          </Badge>
                          <span className="text-sm">
                            {slug
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
                      {reference.symptomesAssocies.map((symptome) => (
                        <li key={symptome}>
                          <Link
                            to={`/diagnostic-auto/${symptome}`}
                            className="flex items-center gap-2 p-2 rounded hover:bg-orange-50 text-gray-700 hover:text-orange-700 transition-colors text-sm"
                          >
                            <Badge
                              variant="outline"
                              className="text-xs text-orange-600 border-orange-200 flex-shrink-0"
                            >
                              Diagnostic
                            </Badge>
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
                          <Badge
                            variant="outline"
                            className="text-xs text-indigo-600 border-indigo-200 flex-shrink-0"
                          >
                            Réf.
                          </Badge>
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
