import {
  defer,
  type HeadersFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";

import {
  HomepageJsonLd,
  HeroSection,
  QuickAccessGrid,
  HomeResourcesAndVideoSection,
  CatalogueSection,
  BrandsGrid,
  BlogCarousel,
  FaqSection,
  Footer,
  WhyAutomecanikSection,
  DiagnosticBanner,
  PopularSearches,
} from "~/components/home";
import { type BrandItem } from "~/components/home/constants";
import { getRemixApiService } from "~/server/remix-api.server";
import {
  type SlimFamily,
  mapFamiliesFromSplit,
  mapBelowFoldData,
  mapFamiliesToCatalog,
  mapBrandsWithFallback,
  mapBlogArticles,
} from "~/utils/homepage-rpc.mapper";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

// ─── SEO page role ───────────────────────────────────────
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R0_HOME, {
    clusterId: "homepage",
    canonicalEntity: "automecanik",
  }),
  hideGlobalFooter: true,
};

// ─── Meta tags ───────────────────────────────────────────
export const meta: MetaFunction = () => [
  {
    title: "Pièces auto neuves compatibles toutes marques | AutoMecanik",
  },
  {
    name: "description",
    content:
      "Trouvez la pièce compatible avec votre véhicule grâce à la recherche par véhicule, référence OE ou Type Mine. Pièces neuves, grandes marques, diagnostic assisté et livraison rapide.",
  },
  { tagName: "link", rel: "canonical", href: "https://www.automecanik.com/" },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://www.automecanik.com/" },
  { property: "og:site_name", content: "Automecanik" },
  {
    property: "og:title",
    content: "Pièces auto neuves compatibles toutes marques | AutoMecanik",
  },
  {
    property: "og:description",
    content:
      "Trouvez la pièce compatible avec votre véhicule. Recherche par véhicule, référence OE ou Type Mine. Grandes marques, livraison rapide.",
  },
  {
    property: "og:image",
    content: "https://www.automecanik.com/logo-og.webp",
  },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  {
    property: "og:image:alt",
    content: "AutoMecanik - Pièces auto neuves compatibles toutes marques",
  },
  { property: "og:locale", content: "fr_FR" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:site", content: "@automecanik" },
  {
    name: "twitter:title",
    content: "Pièces auto neuves compatibles toutes marques | AutoMecanik",
  },
  {
    name: "twitter:description",
    content:
      "Trouvez la pièce compatible avec votre véhicule. Recherche par véhicule, référence OE ou Type Mine. Grandes marques, livraison rapide.",
  },
  {
    name: "twitter:image",
    content: "https://www.automecanik.com/logo-og.webp",
  },
  {
    name: "twitter:image:alt",
    content: "AutoMecanik - Pièces auto neuves compatibles toutes marques",
  },
  { name: "robots", content: "index, follow" },
  { name: "googlebot", content: "index, follow" },
];

// ─── Loader (Phase 1 perf: split above-fold / below-fold) ─
// Above-fold: families via lightweight homepage-families → awaited (blocks SSR)
// Below-fold: brands, equipementiers, blog via homepage-below-fold → REAL deferred streaming
//
// Layer 2 perf: families + below-fold come from NestJS DI (no HTTP loopback).
// FAQ stays on internal HTTP because FaqService isn't exported by SupportModule
// — separate scope, deferred so non-blocking anyway.
export async function loader({ request, context }: LoaderFunctionArgs) {
  const remixApi = await getRemixApiService(context);

  // Below-fold: direct service call wrapped in a Promise so Remix can
  // still defer-stream it via <Await>. The await is captured *inside* the
  // Promise chain — the loader proceeds without blocking.
  const belowFoldPromise = Promise.resolve(remixApi.getHomepageBelowFold())
    .then((data: any) => {
      if (!data) return { brands: [], equipementiers: [], blogArticles: [] };
      return mapBelowFoldData(data);
    })
    .catch(() => ({
      brands: [] as BrandItem[],
      equipementiers: [] as Array<{ name: string; logo?: string }>,
      blogArticles: [] as any[],
    }));

  // FAQ: kept on HTTP (FaqService not exported by SupportModule yet)
  const faqPromise = fetch(
    getInternalApiUrl("/api/support/faq?status=published&limit=5"),
  )
    .then((res) => (res.ok ? res.json() : null))
    .then(
      (data) =>
        (data?.faqs || []) as Array<{
          id: string;
          question: string;
          answer: string;
        }>,
    )
    .catch(() => [] as Array<{ id: string; question: string; answer: string }>);

  // Above-fold: AWAIT families only (lightweight, fast). Direct service
  // call — bypasses TCP loopback handshake that previously cost ~10-50ms
  // cold per SSR and consumed a connection pool slot.
  try {
    const familiesRaw = await remixApi.getHomepageFamilies();
    const families = mapFamiliesFromSplit(familiesRaw);

    return defer({
      families,
      belowFold: belowFoldPromise,
      faqs: faqPromise,
    });
  } catch (err) {
    logger.error("[homepage-families] Service call failed:", {
      error: err instanceof Error ? err.message : String(err),
    });
    return defer({
      families: [] as SlimFamily[],
      belowFold: belowFoldPromise,
      faqs: faqPromise,
    });
  }
}

export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
});

// ─── Skeleton placeholders for below-fold sections ──────
function BrandsGridSkeleton() {
  return (
    <div className="py-8 px-4">
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mx-auto mb-6" />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 max-w-6xl mx-auto">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-2 pb-3"
          >
            <div className="h-[80px] bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-3 w-16 bg-slate-100 rounded animate-pulse mt-2 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────
export default function Homepage() {
  const loaderData = useLoaderData<typeof loader>();

  // Above-fold: families are synchronous (slim, 3 gammes each)
  const catalogFamilies = mapFamiliesToCatalog(loaderData.families);

  return (
    <div className="min-h-screen bg-neutral-50 font-body pb-20 lg:pb-0">
      <HomepageJsonLd />
      <HeroSection />
      <QuickAccessGrid />
      <CatalogueSection families={catalogFamilies} />
      <DiagnosticBanner />
      <HomeResourcesAndVideoSection />

      {/* Below-fold: streamed via defer() */}
      <Suspense fallback={<BrandsGridSkeleton />}>
        <Await
          resolve={loaderData.belowFold}
          errorElement={<BrandsGridSkeleton />}
        >
          {(belowFold: {
            brands: BrandItem[];
            equipementiers: Array<{ name: string; logo?: string }>;
            blogArticles: any[];
          }) => {
            const brandsList = mapBrandsWithFallback(belowFold.brands);
            const blogList = mapBlogArticles(
              belowFold.blogArticles,
              loaderData.families,
            );
            return (
              <>
                <BrandsGrid
                  brands={brandsList}
                  equipementiers={belowFold.equipementiers}
                />
                <WhyAutomecanikSection />
                <BlogCarousel articles={blogList} />
              </>
            );
          }}
        </Await>
      </Suspense>

      <PopularSearches />
      <FaqSection faqsPromise={loaderData.faqs} />
      <Footer />
    </div>
  );
}
