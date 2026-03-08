import {
  defer,
  type HeadersFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

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
    const loaderData = mapHomepageRpcToLoaderData(rpcRaw);

    return defer({
      ...loaderData,
      faqs: faqPromise,
    });
  } catch (err) {
    logger.error("[homepage-rpc] Fetch failed:", {
      error: err instanceof Error ? err.message : String(err),
    });
    return defer({
      ...mapHomepageRpcToLoaderData(null),
      faqs: faqPromise,
    });
  }
}

export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
});

// ─── Page Component ──────────────────────────────────────
export default function Homepage() {
  const loaderData = useLoaderData<typeof loader>();

  const catalogFamilies = mapFamiliesToCatalog(loaderData.families);
  const brandsList = mapBrandsWithFallback(loaderData.brands);
  const blogList = mapBlogArticles(
    loaderData.blogArticles,
    loaderData.families,
  );

  return (
    <div className="min-h-screen bg-[#f5f7fa] font-v9-body pb-20 lg:pb-0">
      <HomepageJsonLd />
      <HeroSection />
      <QuickAccessGrid />
      <CatalogueSection families={catalogFamilies} />
      <DiagnosticBanner />
      <HomeResourcesAndVideoSection />
      <BrandsGrid
        brands={brandsList}
        equipementiers={loaderData.equipementiers}
      />
      <WhyAutomecanikSection />
      <BlogCarousel articles={blogList} />
      <PopularSearches />
      <FaqSection faqsPromise={loaderData.faqs} />
      <Footer />
    </div>
  );
}
