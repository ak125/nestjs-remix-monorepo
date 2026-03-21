/**
 * Route R6 V2 : /blog-pieces-auto/guide-achat/:pg_alias
 * Single-endpoint "page engine" — 1 fetch to GET /api/r6-guide/:pg_alias
 *
 * Role SEO : R6_GUIDE_ACHAT (Buying Guide)
 * Intention : Choisir la bonne piece
 *
 * Redirect 301 vers le slug canonical si le backend résout une variante.
 * 404 noindex si aucun guide trouvé.
 * Dual-mode : V1 legacy rendering OU V2 buying-guide sections.
 */

import {
  json,
  redirect,
  type HeadersFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
} from "@remix-run/react";
import {
  ArrowLeft,
  BookOpen,
  AlertTriangle,
  Clock,
  Shield,
  Zap,
  Heart,
  Star,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

// V2 components

// Existing shared components
import { ArticleActionsBar } from "~/components/blog/ArticleActionsBar";
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import {
  R6HeroDecisionSection,
  R6QualityTiersTable,
  R6CompatibilityChecklist,
  R6PriceGuide,
  R6BrandsGuide,
  R6WhenPro,
  R6FurtherReading,
  R6InternalLinks,
  R6MediaSlotRenderer,
} from "~/components/blog/guide-achat";
import { ScrollToTop } from "~/components/blog/ScrollToTop";
import { TableOfContents } from "~/components/blog/TableOfContents";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import {
  R6QuizAssistant,
  R6CriteriaTable,
  R6FaqAccordion,
  R6SourcesBlock,
  SoftCTA,
  annotateGlossaryTerms,
  buildR6GuideSchemas,
} from "~/components/guide";
import { HeroBlog } from "~/components/heroes";
import { HtmlContent } from "~/components/seo/HtmlContent";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";

// Utils
import { type R6GuidePayload } from "~/types/r6-guide.types";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { buildCanonicalUrl } from "~/utils/seo/canonical";
import { stripHtmlForMeta } from "~/utils/seo-clean.utils";

// ── Handle ──────────────────────────────────────────────

export const handle = {
  pageRole: createPageRoleMeta(PageRole.R6_GUIDE_ACHAT, {
    clusterId: "guide-achat",
  }),
};

// ── Loader (NO 301 — always 404 noindex on failure) ─────

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { pg_alias } = params;

  if (!pg_alias) {
    throw json({ message: "Alias manquant" }, { status: 404 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    // 1) Try R6 guide endpoint (purchase guides)
    const r6Url = getInternalApiUrlFromRequest(
      `/api/r6-guide/${pg_alias}`,
      request,
    );
    const r6Response = await fetch(r6Url, { signal: controller.signal });

    if (r6Response.ok) {
      clearTimeout(timeoutId);
      const result = await r6Response.json();

      // Handle slug redirect (e.g. "disque-frein" → "disque-de-frein")
      if (result?.redirect) {
        return redirect(
          `/blog-pieces-auto/guide-achat/${result.redirect}`,
          301,
        );
      }

      const guide = result?.data as R6GuidePayload | null;

      if (guide && (!guide.intentType || guide.intentType === "R6")) {
        return json({ guide, pg_alias });
      }
    }

    // 2) Fallback: blog guide endpoint (manual guides from __blog_guide)
    const blogUrl = getInternalApiUrlFromRequest(
      `/api/blog/guides/slug/${pg_alias}`,
      request,
    );
    const blogResponse = await fetch(blogUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!blogResponse.ok) {
      throw json(
        { message: `Guide "${pg_alias}" non trouve` },
        { status: 404 },
      );
    }

    const blogResult = await blogResponse.json();
    const blogGuide = blogResult?.data;

    if (!blogGuide) {
      throw json(
        { message: `Guide "${pg_alias}" non disponible` },
        { status: 404 },
      );
    }

    // Convert BlogArticle → R6GuidePayload (V1 format for rendering)
    const guide: R6GuidePayload = {
      intentType: "R6",
      pageRole: "R6_BUYING_GUIDE",
      canonicalRoleUrl: `/blog-pieces-auto/guide-achat/${pg_alias}`,
      roleVersion: "v1",
      page: {
        pg_alias: blogGuide.slug || pg_alias,
        pg_id: blogGuide.legacy_id || 0,
        title: blogGuide.title || pg_alias,
        heroSubtitle: blogGuide.excerpt || null,
        metaTitle:
          blogGuide.seo_data?.meta_title || blogGuide.title || pg_alias,
        metaDescription:
          blogGuide.seo_data?.meta_description || blogGuide.excerpt || "",
        featuredImage: blogGuide.featuredImage || null,
        updatedAt:
          blogGuide.updatedAt ||
          blogGuide.publishedAt ||
          new Date().toISOString(),
        readingTime: blogGuide.readingTime || 5,
      },
      howToChoose: (blogGuide.sections || [])
        .filter((s: { level: number }) => s.level === 2)
        .map(
          (s: { title: string; content: string }) =>
            `<h2>${s.title}</h2>\n${s.content}`,
        )
        .join("\n\n"),
      faq: [],
      sourceType: "manual",
      sourceVerified: true,
    };

    return json({ guide, pg_alias });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Response) throw error;
    logger.error(`[R6 Guide] Error loading guide for: ${pg_alias}`, error);
    throw json(
      { message: `Erreur chargement guide "${pg_alias}"` },
      { status: 500 },
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

// ── Meta (noindex if no data) ───────────────────────────

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data) {
    return [
      { title: "Guide non trouve" },
      { name: "robots", content: "noindex, nofollow" },
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

  const { articleSchema, faqSchema, breadcrumbSchema } = buildR6GuideSchemas(
    page,
    guide.faq,
    canonicalUrl,
  );

  const result: Array<Record<string, string | object>> = [
    { title },
    { name: "description", content: cleanDescription },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
    { name: "author", content: "Automecanik - Experts Automobile" },
    { property: "og:title", content: title },
    { property: "og:description", content: cleanDescription },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonicalUrl },
    {
      property: "og:image",
      content:
        page.featuredImage ||
        "https://www.automecanik.com/images/og/guide-achat.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    {
      property: "article:modified_time",
      content: page.updatedAt,
    },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: cleanDescription },
    { "script:ld+json": articleSchema },
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

// ── Argument icon mapper (V1) ───────────────────────────

const ARG_ICONS = [Shield, Zap, Heart, Star];

// ── TOC sections builder (dual V1/V2) ───────────────────

function buildTocSections(guide: R6GuidePayload) {
  const sections: Array<{ level: 2 | 3; title: string; anchor: string }> = [];

  if (guide.roleVersion === "v2") {
    if (guide.heroDecision) {
      sections.push({
        level: 2,
        title: "Decision d'achat",
        anchor: "decision-achat",
      });
    }
    if (guide.summaryPickFast && guide.summaryPickFast.length > 0) {
      sections.push({
        level: 2,
        title: "Comment choisir",
        anchor: "quiz-assistant",
      });
    }
    if (guide.qualityTiers && guide.qualityTiers.length > 0) {
      sections.push({
        level: 2,
        title: "Niveaux de qualite",
        anchor: "niveaux-qualite",
      });
    }
    if (guide.compatibilityAxes) {
      const axes = Array.isArray(guide.compatibilityAxes)
        ? guide.compatibilityAxes
        : (guide.compatibilityAxes as Record<string, unknown>).axes;
      if (Array.isArray(axes) && axes.length > 0) {
        sections.push({
          level: 2,
          title: "Compatibilite",
          anchor: "compatibilite",
        });
      }
    }
    if (guide.priceGuide) {
      sections.push({
        level: 2,
        title: "Guide des prix",
        anchor: "guide-prix",
      });
    }
    if (guide.brandsGuide) {
      sections.push({
        level: 2,
        title: "Guide des marques",
        anchor: "guide-marques",
      });
    }
    if (guide.pitfalls && guide.pitfalls.length > 0) {
      sections.push({
        level: 2,
        title: "Pieges a eviter",
        anchor: "pieges-eviter",
      });
    }
    const whenProCases = guide.whenPro
      ? Array.isArray(guide.whenPro)
        ? guide.whenPro
        : (guide.whenPro as Record<string, unknown>).cases
      : null;
    if (Array.isArray(whenProCases) && whenProCases.length > 0) {
      sections.push({
        level: 2,
        title: "Quand faire appel a un pro",
        anchor: "quand-pro",
      });
    }
    if (guide.faq.length > 0) {
      sections.push({ level: 2, title: "FAQ", anchor: "faq" });
    }
    if (guide.ctaFinal?.links?.length) {
      sections.push({
        level: 2,
        title: "Pour aller plus loin",
        anchor: "pour-aller-plus-loin",
      });
    }
    return sections;
  }

  // V1 TOC
  if (guide.risk?.explanation) {
    sections.push({ level: 2, title: "Risques", anchor: "risques" });
  }
  if (guide.timing?.years || guide.timing?.km) {
    sections.push({
      level: 2,
      title: "Quand remplacer",
      anchor: "quand-remplacer",
    });
  }
  if (guide.arguments && guide.arguments.length > 0) {
    sections.push({
      level: 2,
      title: "Pourquoi remplacer",
      anchor: "pourquoi-remplacer",
    });
  }
  if (guide.decisionTree && guide.decisionTree.length > 0) {
    sections.push({
      level: 2,
      title: "Assistant de choix",
      anchor: "quiz-assistant",
    });
  }
  if (guide.selectionCriteria && guide.selectionCriteria.length > 0) {
    sections.push({
      level: 2,
      title: "Criteres de selection",
      anchor: "criteres-selection",
    });
  }
  if (guide.symptoms && guide.symptoms.length > 0) {
    sections.push({ level: 2, title: "Symptomes", anchor: "symptomes" });
  }
  if (guide.antiMistakes && guide.antiMistakes.length > 0) {
    sections.push({
      level: 2,
      title: "Erreurs a eviter",
      anchor: "erreurs-eviter",
    });
  }
  if (guide.faq.length > 0) {
    sections.push({ level: 2, title: "FAQ", anchor: "faq" });
  }

  return sections;
}

// ── Component ───────────────────────────────────────────

export default function R6GuidePage() {
  const { guide, pg_alias } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const page = guide.page;

  const tocSections = buildTocSections(guide);
  const isV2 = guide.roleVersion === "v2";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Navigation */}
      <BlogPiecesAutoNavigation />

      {/* Hero */}
      <HeroBlog
        title={page.title}
        description={page.heroSubtitle ?? undefined}
        metaLine={`Mis a jour le ${new Date(page.updatedAt).toLocaleDateString("fr-FR")} · ${page.readingTime} min de lecture`}
        ctaSoft={{
          label: "Voir les pieces compatibles",
          href: `/pieces/${pg_alias}-${page.pg_id}.html`,
        }}
        breadcrumb={[
          { label: "Blog", href: "/blog-pieces-auto" },
          { label: "Guides d'Achat" },
          { label: page.title },
        ]}
      />

      <div className="container mx-auto px-4 max-w-6xl py-8">
        <button
          onClick={() => navigate("/blog-pieces-auto")}
          className="mb-6 px-4 py-2 bg-white hover:bg-gray-50 rounded-lg transition-all flex items-center gap-2 border border-gray-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-medium text-gray-700">Retour au blog</span>
        </button>
      </div>

      {/* Main content */}
      <div className="bg-gray-50 min-h-screen py-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Article — 3 columns */}
            <article className="lg:col-span-3 order-2 lg:order-1">
              <Card className="shadow-xl border-0 overflow-hidden">
                <CardContent className="p-8 lg:p-12">
                  {isV2 ? (
                    <V2Sections guide={guide} pgAlias={pg_alias} />
                  ) : (
                    <V1Sections guide={guide} pgAlias={pg_alias} />
                  )}

                  {/* FAQ (shared V1/V2) */}
                  {guide.faq.length > 0 && <R6FaqAccordion items={guide.faq} />}

                  {/* Cross-link R3 encadre */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 mb-8">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <p className="text-sm text-gray-700">
                        Procedure de remplacement ?{" "}
                        <Link
                          to={`/blog-pieces-auto/conseils/${pg_alias}`}
                          className="font-medium text-blue-600 hover:text-blue-800 underline"
                          rel="noopener"
                        >
                          Consultez le guide conseil {page.title}
                        </Link>
                      </p>
                    </div>
                  </div>

                  {/* Sources (E-E-A-T) */}
                  <R6SourcesBlock
                    sourceType={guide.sourceType}
                    sourceVerified={guide.sourceVerified}
                    updatedAt={page.updatedAt}
                  />

                  {/* Actions (share + save) */}
                  <ArticleActionsBar
                    articleId={String(page.pg_id)}
                    articleTitle={page.title}
                    articleExcerpt={stripHtmlForMeta(page.metaDescription, 200)}
                  />

                  {/* Cross-link R3 (anti-cannibalization) */}
                  {guide.crossLinks?.r3Url && (
                    <div className="mt-8 p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">
                          Procedure complete :
                        </span>{" "}
                        <Link
                          to={guide.crossLinks.r3Url}
                          className="text-amber-700 hover:text-amber-900 underline underline-offset-2"
                        >
                          {guide.crossLinks.r3Label}
                        </Link>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </article>

            {/* Sidebar (1/4) — Sticky */}
            <aside className="lg:col-span-1 order-1 lg:order-2">
              <div className="lg:sticky lg:top-20 space-y-6">
                {tocSections.length > 0 && (
                  <TableOfContents sections={tocSections} />
                )}

                <Card className="border-blue-200 bg-blue-50/50">
                  <div className="p-4">
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Trouvez votre piece
                    </p>
                    <SoftCTA
                      label="Voir les pieces compatibles"
                      href={`/pieces/${pg_alias}-${page.pg_id}.html`}
                    />
                  </div>
                </Card>

                <Card className="border-indigo-200 bg-indigo-50/50">
                  <div className="p-4">
                    <Link
                      to="/reference-auto"
                      className="flex items-center gap-3 group"
                    >
                      <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                          Glossaire pieces auto
                        </p>
                        <p className="text-xs text-gray-500">
                          138 definitions techniques
                        </p>
                      </div>
                    </Link>
                  </div>
                </Card>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <ScrollToTop />
    </div>
  );
}

// ── V2 Sections ─────────────────────────────────────────

function V2Sections({
  guide,
  pgAlias,
}: {
  guide: R6GuidePayload;
  pgAlias: string;
}) {
  const page = guide.page;
  const ms = guide.mediaSlots;
  const gn = page.title;

  return (
    <>
      {/* Hero media slot */}
      {ms?._hero && <R6MediaSlotRenderer slots={ms._hero} gammeName={gn} />}

      {/* 1. Hero Decision */}
      {guide.heroDecision && (
        <R6HeroDecisionSection
          heroDecision={guide.heroDecision}
          gammeName={gn}
          pgAlias={pgAlias}
          pgId={page.pg_id}
        />
      )}
      {ms?.hero_decision && (
        <R6MediaSlotRenderer slots={ms.hero_decision} gammeName={gn} />
      )}

      {/* 2. Summary Pick Fast (quiz) */}
      {guide.summaryPickFast && guide.summaryPickFast.length > 0 && (
        <R6QuizAssistant
          nodes={guide.summaryPickFast}
          gammeName={gn}
          pgAlias={pgAlias}
          pgId={page.pg_id}
        />
      )}
      {ms?.summary_pick_fast && (
        <R6MediaSlotRenderer slots={ms.summary_pick_fast} gammeName={gn} />
      )}

      {/* 3. Quality Tiers */}
      {guide.qualityTiers && guide.qualityTiers.length > 0 && (
        <R6QualityTiersTable tiers={guide.qualityTiers} gammeName={gn} />
      )}
      {ms?.quality_tiers && (
        <R6MediaSlotRenderer slots={ms.quality_tiers} gammeName={gn} />
      )}

      {/* 4. Compatibility — data may be array or {axes: [...]} wrapper */}
      {guide.compatibilityAxes && (
        <R6CompatibilityChecklist
          axes={
            Array.isArray(guide.compatibilityAxes)
              ? guide.compatibilityAxes
              : (((guide.compatibilityAxes as Record<string, unknown>)
                  .axes as typeof guide.compatibilityAxes) ?? [])
          }
          gammeName={gn}
        />
      )}
      {ms?.compatibility && (
        <R6MediaSlotRenderer slots={ms.compatibility} gammeName={gn} />
      )}

      {/* 5. Price Guide */}
      {guide.priceGuide && (
        <R6PriceGuide priceGuide={guide.priceGuide} gammeName={gn} />
      )}
      {ms?.price_guide && (
        <R6MediaSlotRenderer slots={ms.price_guide} gammeName={gn} />
      )}

      {/* 6. Brands Guide */}
      {guide.brandsGuide && (
        <R6BrandsGuide brandsGuide={guide.brandsGuide} gammeName={gn} />
      )}
      {ms?.brands_guide && (
        <R6MediaSlotRenderer slots={ms.brands_guide} gammeName={gn} />
      )}

      {/* 7. Pitfalls */}
      {guide.pitfalls && guide.pitfalls.length > 0 && (
        <section id="pieges-eviter" className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-red-400">
            Pieges a eviter
          </h2>
          <div className="flex flex-wrap gap-2">
            {guide.pitfalls.map((m, i) => (
              <Badge
                key={i}
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200 px-3 py-1.5 text-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 inline" />
                {m}
              </Badge>
            ))}
          </div>
        </section>
      )}
      {ms?.pitfalls && (
        <R6MediaSlotRenderer slots={ms.pitfalls} gammeName={gn} />
      )}

      {/* 8. When Pro — data may be array or {cases: [...]} wrapper */}
      {guide.whenPro && (
        <R6WhenPro
          cases={
            Array.isArray(guide.whenPro)
              ? guide.whenPro
              : (((guide.whenPro as Record<string, unknown>)
                  .cases as typeof guide.whenPro) ?? [])
          }
          gammeName={gn}
        />
      )}
      {ms?.when_pro && (
        <R6MediaSlotRenderer slots={ms.when_pro} gammeName={gn} />
      )}

      {/* 9. CTA Final — Further Reading + Internal Links */}
      {guide.ctaFinal?.links && guide.ctaFinal.links.length > 0 && (
        <R6FurtherReading links={guide.ctaFinal.links} />
      )}
      {guide.ctaFinal?.internal_links &&
        guide.ctaFinal.internal_links.length > 0 && (
          <R6InternalLinks links={guide.ctaFinal.internal_links} />
        )}
    </>
  );
}

// ── V1 Legacy Sections ──────────────────────────────────

function V1Sections({
  guide,
  pgAlias,
}: {
  guide: R6GuidePayload;
  pgAlias: string;
}) {
  const page = guide.page;

  return (
    <>
      {/* A. Risk Section */}
      {guide.risk?.explanation && (
        <section id="risques" className="mb-8">
          <div className="rounded-xl border-2 border-red-200 overflow-hidden shadow-lg">
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-red-100 mb-0.5">
                  Attention
                </div>
                <h2 className="text-xl font-bold leading-tight">
                  {guide.risk.title}
                </h2>
              </div>
            </div>
            <div className="bg-red-50 px-6 py-5">
              <HtmlContent
                html={annotateGlossaryTerms(guide.risk.explanation)}
                className="text-sm text-red-900 leading-relaxed [&_p]:mb-3 [&_strong]:font-bold [&_strong]:text-red-800 [&_a]:text-red-700 [&_a]:underline"
                trackLinks={true}
              />
              {guide.risk.consequences.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {guide.risk.consequences.map((c, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="bg-red-100 text-red-800 border-red-300 text-xs"
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
              {guide.risk.costRange && (
                <p className="mt-3 text-xs text-red-700 font-medium">
                  Cout moyen : {guide.risk.costRange}
                </p>
              )}
              {guide.risk.conclusion && (
                <HtmlContent
                  html={annotateGlossaryTerms(guide.risk.conclusion)}
                  className="mt-3 text-sm text-red-800 leading-relaxed font-medium [&_strong]:text-red-900"
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* B. Timing Section */}
      {(guide.timing?.years || guide.timing?.km) && (
        <section id="quand-remplacer" className="mb-8">
          <div className="rounded-xl border-2 border-amber-200 overflow-hidden shadow-lg">
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-amber-100 mb-0.5">
                  Periodicite
                </div>
                <h2 className="text-xl font-bold leading-tight">
                  {guide.timing!.title}
                </h2>
              </div>
            </div>
            <div className="bg-amber-50/50 px-6 py-5">
              <div className="flex flex-wrap gap-3 mb-3">
                {guide.timing!.years && (
                  <Badge
                    variant="outline"
                    className="bg-amber-100 text-amber-800 border-amber-300 text-sm px-3 py-1"
                  >
                    <Clock className="w-3.5 h-3.5 mr-1.5 inline" />
                    Tous les {guide.timing!.years}
                  </Badge>
                )}
                {guide.timing!.km && (
                  <Badge
                    variant="outline"
                    className="bg-amber-100 text-amber-800 border-amber-300 text-sm px-3 py-1"
                  >
                    Tous les {guide.timing!.km}
                  </Badge>
                )}
              </div>
              {guide.timing!.note && (
                <HtmlContent
                  html={annotateGlossaryTerms(guide.timing!.note)}
                  className="text-sm text-gray-700 leading-relaxed [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-gray-900"
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* C. Arguments */}
      {guide.arguments && guide.arguments.length > 0 && (
        <section id="pourquoi-remplacer" className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">
            Pourquoi remplacer votre {page.title.toLowerCase()}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {guide.arguments.map((arg, idx) => {
              const Icon = ARG_ICONS[idx % ARG_ICONS.length];
              return (
                <Card
                  key={idx}
                  className="border-blue-100 hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 bg-blue-50 rounded-lg">
                        <Icon className="w-4 h-4 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {arg.title}
                      </h3>
                    </div>
                    <HtmlContent
                      html={annotateGlossaryTerms(arg.content)}
                      className="text-sm text-gray-600 leading-relaxed [&_strong]:font-semibold [&_strong]:text-gray-800 [&_a]:text-blue-600 [&_a]:underline"
                      trackLinks={true}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* D. Quiz Assistant */}
      {guide.decisionTree && guide.decisionTree.length > 0 && (
        <R6QuizAssistant
          nodes={guide.decisionTree}
          gammeName={page.title}
          pgAlias={pgAlias}
          pgId={page.pg_id}
        />
      )}

      {/* E. Criteria Table */}
      {guide.selectionCriteria && guide.selectionCriteria.length > 0 && (
        <R6CriteriaTable
          criteria={guide.selectionCriteria}
          gammeName={page.title}
        />
      )}

      {/* F. Symptoms */}
      {guide.symptoms && guide.symptoms.length > 0 && (
        <section id="symptomes" className="mb-8">
          <div className="rounded-xl border-2 border-orange-200 overflow-hidden shadow-lg">
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-orange-100 mb-0.5">
                  Signes d&apos;usure
                </div>
                <h2 className="text-xl font-bold leading-tight">
                  Symptomes a surveiller
                </h2>
              </div>
            </div>
            <div className="bg-orange-50/50 px-6 py-5">
              <ul className="space-y-2">
                {guide.symptoms.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* G. Anti-Mistakes */}
      {guide.antiMistakes && guide.antiMistakes.length > 0 && (
        <section id="erreurs-eviter" className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-red-400">
            Erreurs a eviter
          </h2>
          <div className="flex flex-wrap gap-2">
            {guide.antiMistakes.map((m, i) => (
              <Badge
                key={i}
                variant="outline"
                className="bg-red-50 text-red-700 border-red-200 px-3 py-1.5 text-sm"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 inline" />
                {m}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ── Error Boundary (404 noindex — NO 301) ───────────────

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
