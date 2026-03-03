/**
 * Route R6 : /blog-pieces-auto/guide-achat/:pg_alias
 * Single-endpoint "page engine" — 1 fetch to GET /api/r6-guide/:pg_alias
 *
 * Role SEO : R6_GUIDE_ACHAT
 * Intention : Choisir la bonne piece
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
} from "lucide-react";

// Components
import { ArticleActionsBar } from "~/components/blog/ArticleActionsBar";
import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { ScrollToTop } from "~/components/blog/ScrollToTop";
import { TableOfContents } from "~/components/blog/TableOfContents";
import { Error404 } from "~/components/errors/Error404";
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

// ── Loader ──────────────────────────────────────────────

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { pg_alias } = params;

  if (!pg_alias) {
    return redirect("/blog-pieces-auto", 301);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const apiUrl = getInternalApiUrlFromRequest(
      `/api/r6-guide/${pg_alias}`,
      request,
    );
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return redirect("/blog-pieces-auto", 301);
      }
      throw new Error(`R6 guide endpoint returned ${response.status}`);
    }

    const result = await response.json();
    const guide = result?.data as R6GuidePayload | null;

    if (!guide) {
      return redirect("/blog-pieces-auto", 301);
    }

    return json({ guide, pg_alias });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Response) throw error;
    logger.error(`[R6 Guide] Error loading guide for: ${pg_alias}`, error);
    return redirect("/blog-pieces-auto", 302);
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

// ── Meta ────────────────────────────────────────────────

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data) {
    return [
      { title: "Guide non trouve" },
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

// ── Argument icon mapper ────────────────────────────────

const ARG_ICONS = [Shield, Zap, Heart, Star];

// ── TOC sections builder ────────────────────────────────

function buildTocSections(guide: R6GuidePayload) {
  const sections: Array<{ level: 2 | 3; title: string; anchor: string }> = [];

  if (guide.risk.explanation) {
    sections.push({ level: 2, title: "Risques", anchor: "risques" });
  }
  if (guide.timing.years || guide.timing.km) {
    sections.push({
      level: 2,
      title: "Quand remplacer",
      anchor: "quand-remplacer",
    });
  }
  if (guide.arguments.length > 0) {
    sections.push({
      level: 2,
      title: "Pourquoi remplacer",
      anchor: "pourquoi-remplacer",
    });
  }
  if (guide.decisionTree.length > 0) {
    sections.push({
      level: 2,
      title: "Assistant de choix",
      anchor: "quiz-assistant",
    });
  }
  if (guide.selectionCriteria.length > 0) {
    sections.push({
      level: 2,
      title: "Criteres de selection",
      anchor: "criteres-selection",
    });
  }
  if (guide.symptoms.length > 0) {
    sections.push({ level: 2, title: "Symptomes", anchor: "symptomes" });
  }
  if (guide.antiMistakes.length > 0) {
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
        {/* Back button */}
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
                  {/* A. Risk Section */}
                  {guide.risk.explanation && (
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
                              html={annotateGlossaryTerms(
                                guide.risk.conclusion,
                              )}
                              className="mt-3 text-sm text-red-800 leading-relaxed font-medium [&_strong]:text-red-900"
                            />
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* B. Timing Section */}
                  {(guide.timing.years || guide.timing.km) && (
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
                              {guide.timing.title}
                            </h2>
                          </div>
                        </div>
                        <div className="bg-amber-50/50 px-6 py-5">
                          <div className="flex flex-wrap gap-3 mb-3">
                            {guide.timing.years && (
                              <Badge
                                variant="outline"
                                className="bg-amber-100 text-amber-800 border-amber-300 text-sm px-3 py-1"
                              >
                                <Clock className="w-3.5 h-3.5 mr-1.5 inline" />
                                Tous les {guide.timing.years}
                              </Badge>
                            )}
                            {guide.timing.km && (
                              <Badge
                                variant="outline"
                                className="bg-amber-100 text-amber-800 border-amber-300 text-sm px-3 py-1"
                              >
                                Tous les {guide.timing.km}
                              </Badge>
                            )}
                          </div>
                          {guide.timing.note && (
                            <HtmlContent
                              html={annotateGlossaryTerms(guide.timing.note)}
                              className="text-sm text-gray-700 leading-relaxed [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-gray-900"
                            />
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  {/* C. Arguments */}
                  {guide.arguments.length > 0 && (
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

                  {/* D. Quiz Assistant (trio gagnant #1) */}
                  {guide.decisionTree.length > 0 && (
                    <R6QuizAssistant
                      nodes={guide.decisionTree}
                      gammeName={page.title}
                      pgAlias={pg_alias}
                      pgId={page.pg_id}
                    />
                  )}

                  {/* E. Criteria Table (trio gagnant #2) */}
                  {guide.selectionCriteria.length > 0 && (
                    <R6CriteriaTable
                      criteria={guide.selectionCriteria}
                      gammeName={page.title}
                    />
                  )}

                  {/* F. Symptoms */}
                  {guide.symptoms.length > 0 && (
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
                                <span className="text-sm text-gray-700">
                                  {s}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* G. Anti-Mistakes */}
                  {guide.antiMistakes.length > 0 && (
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

                  {/* H. FAQ Accordion (trio gagnant #3 - FAQ) */}
                  {guide.faq.length > 0 && <R6FaqAccordion items={guide.faq} />}

                  {/* I. Sources Block (trio gagnant #3 - E-E-A-T) */}
                  <R6SourcesBlock
                    sourceType={guide.sourceType}
                    sourceVerified={guide.sourceVerified}
                    updatedAt={page.updatedAt}
                  />

                  {/* J. Actions (share + save) */}
                  <ArticleActionsBar
                    articleId={String(page.pg_id)}
                    articleTitle={page.title}
                    articleExcerpt={stripHtmlForMeta(page.metaDescription, 200)}
                  />
                </CardContent>
              </Card>
            </article>

            {/* Sidebar (1/4) — Sticky */}
            <aside className="lg:col-span-1 order-1 lg:order-2">
              <div className="lg:sticky lg:top-20 space-y-6">
                {/* Table of Contents with scroll-spy */}
                {tocSections.length > 0 && (
                  <TableOfContents sections={tocSections} />
                )}

                {/* CTA pièces */}
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

                {/* Glossaire link */}
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

// ── Error Boundary ──────────────────────────────────────

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
