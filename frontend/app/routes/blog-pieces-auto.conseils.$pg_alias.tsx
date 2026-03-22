/**
 * Route R3 : /blog-pieces-auto/conseils/:pg_alias
 * Single-endpoint "page engine" — 1 fetch to GET /api/r3-guide/:pg_alias
 *
 * Rôle SEO : R3 - BLOG
 * Intention : Comprendre comment installer/entretenir une pièce
 */

import {
  defer,
  json,
  type HeadersFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Await,
  Link,
  useLoaderData,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
} from "@remix-run/react";
import { ArrowLeft, Tag, BookOpen, ExternalLink } from "lucide-react";
import { lazy, Suspense, useEffect, useRef } from "react";

// Components
import { ArticleActionsBar } from "~/components/blog/ArticleActionsBar";
import { ArticleNavigation } from "~/components/blog/ArticleNavigation";
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { ConseilSections } from "~/components/blog/conseil/ConseilSections";
import { MetaLinksSection } from "~/components/blog/conseil/MetaLinksSection";
import {
  type GammeConseil,
  type HeroBadge,
} from "~/components/blog/conseil/section-config";
import { SourcesDisclaimer } from "~/components/blog/conseil/SourcesDisclaimer";
import { SummarySnippet } from "~/components/blog/conseil/SummarySnippet";
import CTAButton from "~/components/blog/CTAButton";
import { ScrollToTop } from "~/components/blog/ScrollToTop";
import { TableOfContents } from "~/components/blog/TableOfContents";
import { type CompatibleVehicle } from "~/components/blog/VehicleCarousel";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import {
  GuideHero,
  GuideChecklist,
  buildGuideSchemas,
} from "~/components/guide";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { resolveSlogan } from "~/config/visual-intent";

// Conseil components

// Utils
import {
  type R3GuidePayload,
  type R3GuideSection,
  type R3GuidePage,
} from "~/types/r3-guide.types";
import { trackArticleView, trackReadingTime } from "~/utils/analytics";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { getOgImageUrl } from "~/utils/og-image.utils";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { buildCanonicalUrl } from "~/utils/seo/canonical";
import { stripHtmlForMeta } from "~/utils/seo-clean.utils";
const RelatedArticlesSidebar = lazy(() =>
  import("~/components/blog/RelatedArticlesSidebar").then((m) => ({
    default: m.RelatedArticlesSidebar,
  })),
);
const VehicleCarousel = lazy(() => import("~/components/blog/VehicleCarousel"));

// Types

/**
 * Handle export pour propager le rôle SEO au root Layout
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R3_BLOG, {
    clusterId: "conseils",
  }),
};

// ── Adapters ─────────────────────────────────────────────

/** Map R3GuideSection → GammeConseil (html→content) for legacy components */
function toConseil(s: R3GuideSection): GammeConseil {
  return {
    title: s.title,
    content: s.html,
    sectionType: s.sectionType,
    order: s.order,
    qualityScore: s.qualityScore,
    sources: s.sources,
    anchor: s.anchor,
    image: s.image ?? null,
  };
}

/** Build hero badges from pre-computed page metadata */
function buildHeroBadges(page: R3GuidePage): HeroBadge[] {
  const badges: HeroBadge[] = [];

  if (page.difficulty) {
    const map: Record<string, { v: string; c: HeroBadge["color"] }> = {
      facile: { v: "Facile", c: "green" },
      moyen: { v: "Intermédiaire", c: "amber" },
      difficile: { v: "Avancé", c: "red" },
    };
    const m = map[page.difficulty];
    if (m) badges.push({ label: "Difficulté", value: m.v, color: m.c });
  }

  if (page.durationMin) {
    badges.push({
      label: "Temps estimé",
      value:
        page.durationMin < 60
          ? `~${page.durationMin} min`
          : `~${Math.round(page.durationMin / 60)}h`,
      color: "blue",
    });
  }

  if (page.safetyLevel) {
    const smap: Record<string, { v: string; c: HeroBadge["color"] }> = {
      faible: { v: "Standard", c: "green" },
      moyen: { v: "Précautions requises", c: "amber" },
      élevé: { v: "Précautions requises", c: "red" },
    };
    const m = smap[page.safetyLevel];
    if (m) badges.push({ label: "Sécurité", value: m.v, color: m.c });
  }

  return badges;
}

// ── Loader ───────────────────────────────────────────────

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { pg_alias } = params;

  if (!pg_alias) {
    throw json({ message: "Alias manquant" }, { status: 404 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const apiUrl = getInternalApiUrlFromRequest(
      `/api/r3-guide/${pg_alias}`,
      request,
    );
    const response = await fetch(apiUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw json(
          { message: `Guide R3 introuvable: ${pg_alias}` },
          { status: 404 },
        );
      }
      throw new Error(`R3 guide endpoint returned ${response.status}`);
    }

    const result = await response.json();
    const guide = result?.data as R3GuidePayload | null;

    if (!guide) {
      throw json(
        { message: `Pas de donnees R3 pour: ${pg_alias}` },
        { status: 404 },
      );
    }

    // Fetch R4 reference as a deferred promise (non-blocking for TTFB)
    const r4ReferencePromise = (async (): Promise<{
      slug: string;
      title: string;
      definition: string;
      roleMecanique: string | null;
      canonicalUrl: string | null;
    } | null> => {
      try {
        const pgId = guide.page.pg_id;
        if (!pgId) return null;

        const r4Controller = new AbortController();
        const r4Timeout = setTimeout(() => r4Controller.abort(), 2000);

        const byGammeUrl = getInternalApiUrlFromRequest(
          `/api/seo/reference/by-gamme/${pgId}`,
          request,
        );
        const byGammeRes = await fetch(byGammeUrl, {
          signal: r4Controller.signal,
        });
        if (!byGammeRes.ok) {
          clearTimeout(r4Timeout);
          return null;
        }

        const { slug: r4Slug } = await byGammeRes.json();
        if (!r4Slug) {
          clearTimeout(r4Timeout);
          return null;
        }

        const refUrl = getInternalApiUrlFromRequest(
          `/api/seo/reference/${r4Slug}`,
          request,
        );
        const refRes = await fetch(refUrl, { signal: r4Controller.signal });
        clearTimeout(r4Timeout);
        if (!refRes.ok) return null;

        const refData = await refRes.json();
        const ref = refData?.data ?? refData;
        return {
          slug: r4Slug,
          title: ref.title ?? "",
          definition: ref.definition ?? "",
          roleMecanique: ref.roleMecanique ?? ref.role_mecanique ?? null,
          canonicalUrl: `/reference-auto/${r4Slug}`,
        };
      } catch {
        return null; // R4 reference is optional — fail silently
      }
    })();

    return defer(
      { guide, pg_alias, r4Reference: r4ReferencePromise },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Response) throw error;
    logger.error(`[R3 Guide] Error loading guide for: ${pg_alias}`, error);
    throw json(
      { message: `Erreur chargement guide R3: ${pg_alias}` },
      { status: 404 },
    );
  }
}

// Cache — 5min browser + 1h stale (contenu stable)
export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
});

// Skip revalidation when navigating back to same guide
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentParams,
  nextParams,
  defaultShouldRevalidate,
}) => {
  if (currentParams.pg_alias === nextParams.pg_alias) return false;
  return defaultShouldRevalidate;
};

// ── Meta ─────────────────────────────────────────────────

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data) {
    return [
      { title: "Article non trouvé" },
      { name: "robots", content: "noindex" },
    ];
  }

  const { guide } = data;
  const page = guide.page;
  const canonicalUrl = buildCanonicalUrl({
    baseUrl: location.pathname,
    includeHost: true,
  });
  const cleanDescription = stripHtmlForMeta(page.metaDescription);
  const title = page.metaTitle || page.title;

  // Adapter sections → GammeConseil[] for schema builder
  const allConseil: GammeConseil[] = [
    ...guide.s1Sections.map(toConseil),
    ...guide.bodySections.map(toConseil),
    ...guide.metaSections.map(toConseil),
  ];

  const { articleSchema, howToSchema, faqSchema, breadcrumbSchema } =
    buildGuideSchemas(
      {
        title: page.title,
        meta_title: page.metaTitle,
        meta_description: cleanDescription,
        publishedAt: page.publishedAt,
        updatedAt: page.updatedAt,
        keywords: page.keywords,
        readingTime: page.readingTime,
        viewsCount: page.viewsCount,
        featuredImage: page.featuredImage ?? undefined,
        pg_alias: page.pg_alias,
      },
      page.sourceType === "conseil" ? allConseil : null,
      canonicalUrl,
    );

  const result: Array<Record<string, string | object>> = [
    { title },
    { name: "description", content: cleanDescription },
    ...(page.keywords.length > 0
      ? [{ name: "keywords", content: page.keywords.join(", ") }]
      : []),
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
    { name: "author", content: "Automecanik - Experts Automobile" },
    { property: "og:title", content: title },
    { property: "og:description", content: cleanDescription },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonicalUrl },
    {
      property: "og:image",
      content: getOgImageUrl(data.guide.page.featuredImage, "blog-conseil"),
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "article:published_time", content: page.publishedAt },
    {
      property: "article:modified_time",
      content: page.updatedAt || page.publishedAt,
    },
    ...page.keywords.slice(0, 8).map((k) => ({
      property: "article:tag",
      content: k,
    })),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: cleanDescription },
    {
      name: "twitter:image",
      content: "https://www.automecanik.com/images/og/blog-conseil.webp",
    },
    { "script:ld+json": articleSchema },
    ...(howToSchema ? [{ "script:ld+json": howToSchema }] : []),
    ...(faqSchema ? [{ "script:ld+json": faqSchema }] : []),
    { "script:ld+json": breadcrumbSchema },
  ];

  if (page.featuredImage) {
    result.push({
      tagName: "link",
      rel: "preload",
      as: "image",
      href: page.featuredImage,
    });
  }

  return result;
};

// ── R4 Fallback (glossaire générique) ──────────────────────
function R4FallbackCard() {
  return (
    <Card className="border-indigo-200 bg-indigo-50/50">
      <div className="p-4">
        <Link to="/reference-auto" className="flex items-center gap-3 group">
          <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
            <BookOpen className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
              Glossaire pieces auto
            </p>
            <p className="text-xs text-gray-500">138 definitions techniques</p>
          </div>
        </Link>
      </div>
    </Card>
  );
}

// ── Component ────────────────────────────────────────────

export default function R3GuidePage() {
  const { guide, pg_alias, r4Reference } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const page = guide.page;

  // Sections already split server-side
  const { s1Sections, bodySections, metaSections } = guide;
  const sourceType = page.sourceType;

  // Hero badges from pre-computed metadata
  const heroBadges = buildHeroBadges(page);

  // Adapter sections → GammeConseil for legacy components
  const conseilForSnippet: GammeConseil[] | null =
    sourceType === "conseil"
      ? [
          ...s1Sections.map(toConseil),
          ...bodySections.map(toConseil),
          ...metaSections.map(toConseil),
        ]
      : null;

  // SSR-safe: Use ref for startTime to avoid hydration mismatch
  const startTimeRef = useRef<number>(0);

  // Analytics : vue après 3s + temps de lecture au cleanup
  useEffect(() => {
    startTimeRef.current = Date.now();

    const viewTimer = setTimeout(() => {
      trackArticleView(String(page.pg_id), page.title);
    }, 3000);

    return () => {
      clearTimeout(viewTimer);
      if (!startTimeRef.current) return;
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (duration > 5) {
        trackReadingTime(String(page.pg_id), duration, page.title);
      }
    };
  }, [page.pg_id, page.title]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Navigation */}
      <BlogPiecesAutoNavigation />

      {/* Hero Blog — Guide design system */}
      <GuideHero
        title={page.title}
        description={
          s1Sections.length === 0
            ? stripHtmlForMeta(page.excerpt, 300)
            : undefined
        }
        slogan={resolveSlogan("blog-conseil", pg_alias)}
        metaLine={`${new Date(page.publishedAt).toLocaleDateString("fr-FR")} · ${page.readingTime} min${
          page.viewsCount > 0
            ? ` · ${page.viewsCount.toLocaleString()} vues`
            : ""
        }`}
        badges={heroBadges}
        ctaSoft={
          sourceType === "conseil" && pg_alias
            ? {
                label: "Voir les pièces compatibles",
                href: `/pieces/${pg_alias}-${page.pg_id}.html`,
              }
            : undefined
        }
      />

      <div className="container mx-auto px-4 max-w-6xl py-8">
        {/* Bouton retour */}
        <button
          onClick={() => navigate("/blog-pieces-auto/conseils")}
          className="mb-6 px-4 py-2 bg-white hover:bg-gray-50 rounded-lg transition-all flex items-center gap-2 border border-gray-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium text-gray-700">Retour au blog</span>
        </button>

        {/* Featured Image */}
        {page.featuredImage && (
          <Card className="mb-8 border shadow-lg overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-gray-50 via-white to-gray-100 p-6 flex items-center justify-center">
                <img
                  src={page.featuredImage}
                  alt={page.title}
                  width={800}
                  height={256}
                  sizes="(max-width: 640px) 100vw, 800px"
                  className="w-full h-64 object-contain drop-shadow-lg"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {page.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {page.tags.slice(0, 6).map((tag) => (
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
            {/* Article - 3 colonnes */}
            <article className="lg:col-span-3 order-2 lg:order-1">
              <Card className="shadow-xl border-0 overflow-hidden">
                <CardContent className="p-8 lg:p-12">
                  {/* Sections S1 — Avant de commencer */}
                  {s1Sections.map((s1, idx) => (
                    <GuideChecklist
                      key={idx}
                      section={toConseil(s1)}
                      variant="before"
                    />
                  ))}

                  {/* Résumé en N points — featured snippet */}
                  {sourceType === "conseil" && (
                    <SummarySnippet conseil={conseilForSnippet} />
                  )}

                  {/* CTA Principal — masqué en mode conseil */}
                  {sourceType !== "conseil" &&
                    page.cta_link &&
                    page.cta_anchor && (
                      <CTAButton
                        anchor={page.cta_anchor}
                        link={page.cta_link}
                      />
                    )}

                  {/* Sections H2/H3 (article fallback — pas de conseil S2-S8) */}
                  {sourceType === "article" &&
                    bodySections.map((section, index) => (
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

                        <HtmlContent
                          html={section.html}
                          className={`max-w-none ${section.level === 3 ? "ml-4" : ""}
                            [&_p]:text-gray-700 [&_p]:leading-relaxed
                            [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline
                            [&_strong]:font-semibold
                            [&_ul]:list-disc [&_ul]:pl-6
                            [&_li]:text-gray-700`}
                          trackLinks={true}
                        />
                      </section>
                    ))}

                  {/* Sections conseil S2-S8 */}
                  {sourceType === "conseil" && (
                    <ConseilSections
                      sections={bodySections.map(toConseil)}
                      pgAlias={pg_alias}
                      pgId={page.pg_id}
                      hasR6Guide={page.hasR6Guide}
                    />
                  )}

                  {/* Sources / responsabilité */}
                  {sourceType === "conseil" && <SourcesDisclaimer />}

                  {/* Pour aller plus loin (META sections) */}
                  {sourceType === "conseil" && metaSections.length > 0 && (
                    <MetaLinksSection sections={metaSections.map(toConseil)} />
                  )}

                  {/* Cross-link R6 guide d'achat */}
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 mb-8">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-sm text-gray-700">
                        Choisir la bonne piece ?{" "}
                        <Link
                          to={`/blog-pieces-auto/guide-achat/${pg_alias}`}
                          className="font-medium text-emerald-600 hover:text-emerald-800 underline"
                          rel="noopener"
                        >
                          Consultez le guide d&apos;achat {page.title}
                        </Link>
                      </p>
                    </div>
                  </div>

                  {/* Actions (partager + enregistrer) */}
                  <ArticleActionsBar
                    articleId={String(page.pg_id)}
                    articleTitle={page.title}
                    articleExcerpt={page.excerpt}
                  />
                </CardContent>
              </Card>
            </article>

            {/* Véhicules Compatibles */}
            {guide.vehicles.length > 0 && (
              <div className="lg:col-span-3 order-3">
                <Suspense
                  fallback={
                    <div className="h-48 animate-pulse bg-gray-100 rounded-lg" />
                  }
                >
                  <VehicleCarousel
                    vehicles={guide.vehicles as unknown as CompatibleVehicle[]}
                    gamme={pg_alias}
                    seoSwitches={
                      guide.seoSwitches as unknown as Array<{
                        sis_id: string;
                        sis_pg_id: string;
                        sis_alias: string;
                        sis_content: string;
                      }>
                    }
                  />
                </Suspense>
              </div>
            )}

            {/* Sidebar (1/3) - Sticky */}
            <aside className="lg:col-span-1 order-1 lg:order-2">
              <div className="lg:sticky lg:top-20 space-y-6">
                {/* Table des matières — anchors pré-calculés */}
                {(s1Sections.length > 0 || bodySections.length > 0) && (
                  <TableOfContents
                    sections={[
                      ...s1Sections.map((s) => ({
                        level: 2 as const,
                        title: s.title,
                        anchor: s.anchor,
                      })),
                      ...bodySections.map((s) => ({
                        level: (s.level ?? 2) as 2 | 3,
                        title: s.title,
                        anchor: s.anchor,
                      })),
                    ]}
                  />
                )}

                {/* Fiche technique R4 (spécifique) ou Glossaire (fallback) — streamed via defer */}
                <Suspense
                  fallback={
                    <Card className="border-indigo-200 bg-indigo-50/50">
                      <div className="p-4 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-lg" />
                          <div className="flex-1 space-y-1">
                            <div className="h-4 bg-indigo-100 rounded w-3/4" />
                            <div className="h-3 bg-indigo-50 rounded w-1/2" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  }
                >
                  <Await
                    resolve={r4Reference}
                    errorElement={<R4FallbackCard />}
                  >
                    {(resolvedR4) =>
                      resolvedR4 ? (
                        <Card className="border-indigo-200 bg-indigo-50/50">
                          <div className="p-4">
                            <Link
                              to={`/reference-auto/${resolvedR4.slug}`}
                              className="flex items-start gap-3 group"
                            >
                              <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
                                <BookOpen className="w-4 h-4 text-indigo-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                                  {resolvedR4.title}
                                </p>
                                {resolvedR4.roleMecanique && (
                                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                    {resolvedR4.roleMecanique}
                                  </p>
                                )}
                                <p className="text-xs text-indigo-600 mt-1 font-medium">
                                  Voir la fiche technique
                                </p>
                              </div>
                            </Link>
                          </div>
                        </Card>
                      ) : (
                        <R4FallbackCard />
                      )
                    }
                  </Await>
                </Suspense>
                {/* END R4 deferred block — was previously blocking TTFB by 200-400ms */}

                {/* Articles Croisés */}
                {guide.related.length > 0 && (
                  <Suspense
                    fallback={
                      <div className="h-32 animate-pulse bg-gray-100 rounded-lg" />
                    }
                  >
                    <RelatedArticlesSidebar
                      articles={guide.related as never[]}
                    />
                  </Suspense>
                )}
              </div>
            </aside>
          </div>

          {/* Navigation entre articles (précédent/suivant) */}
          <div className="max-w-6xl mx-auto mt-8">
            <ArticleNavigation
              previous={guide.adjacent.previous as never}
              next={guide.adjacent.next as never}
            />
          </div>
        </div>
      </div>

      {/* Bouton retour en haut */}
      <ScrollToTop />
    </div>
  );
}

// ── Error Boundary ───────────────────────────────────────

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
