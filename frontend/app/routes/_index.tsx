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
import {
  mapHomepageRpcToLoaderData,
  mapFamiliesToCatalog,
  mapBrandsWithFallback,
  mapBlogArticles,
} from "~/utils/homepage-rpc.mapper";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
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

// ─── Loader ──────────────────────────────────────────────
// Above-fold: families (slim, 3 gammes/family) → awaited (blocks SSR)
// Below-fold: brands, equipementiers, blogArticles, faqs → deferred (streamed)
export async function loader({ request }: LoaderFunctionArgs) {
  const faqPromise = fetch(
    getInternalApiUrlFromRequest(
      "/api/support/faq?status=published&limit=5",
      request,
    ),
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

  try {
    const rpcRes = await fetch(
      getInternalApiUrlFromRequest("/api/catalog/homepage-rpc", request),
    );

    if (!rpcRes.ok) {
      logger.warn("[homepage-rpc] Non-OK status:", {
        status: rpcRes.status,
        statusText: rpcRes.statusText,
      });
    }

    const rpcRaw = rpcRes.ok ? await rpcRes.json() : null;
    const { families, brands, equipementiers, blogArticles } =
      mapHomepageRpcToLoaderData(rpcRaw);

    // Above-fold data is synchronous (already resolved)
    // Below-fold data wrapped as resolved promises for defer() streaming
    return defer({
      families,
      belowFold: Promise.resolve({ brands, equipementiers, blogArticles }),
      faqs: faqPromise,
    });
  } catch (err) {
    logger.error("[homepage-rpc] Fetch failed:", {
      error: err instanceof Error ? err.message : String(err),
    });
    const fallback = mapHomepageRpcToLoaderData(null);
    return defer({
      families: fallback.families,
      belowFold: Promise.resolve({
        brands: fallback.brands,
        equipementiers: fallback.equipementiers,
        blogArticles: fallback.blogArticles,
      }),
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

function _BlogCarouselSkeleton() {
  return (
    <div className="py-8 px-4">
      <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mx-auto mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="h-40 bg-slate-100 rounded-xl animate-pulse mb-3" />
            <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse mb-2" />
            <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
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
    <div className="min-h-screen bg-[#f5f7fa] font-v9-body pb-20 lg:pb-0">
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
