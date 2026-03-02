import {
  defer,
  type HeadersFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { lazy, Suspense } from "react";

import {
  HomepageJsonLd,
  HeroSearchSection,
  ConseilsDiagnosticSection,
  CatalogueSection,
  WhyAutomecanikSection,
  BlogGuidesSection,
  FaqSection,
} from "~/components/home";
import {
  BLOG,
  CATS,
  EQUIP,
  IMG_PROXY_EQUIP,
  IMG_PROXY_FAMILIES,
  IMG_PROXY_LOGOS,
  MARQUES,
} from "~/components/home/constants";

import { getFamilyTheme } from "~/utils/family-theme";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

const BrandsGridSection = lazy(
  () => import("~/components/home/BrandsGridSection"),
);
const StatsSection = lazy(() => import("~/components/home/StatsSection"));
const EquipementiersMarquee = lazy(
  () => import("~/components/home/EquipementiersMarquee"),
);

// ─── SEO page role ───────────────────────────────────────
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "homepage",
    canonicalEntity: "automecanik",
  }),
};

// ─── Meta tags ───────────────────────────────────────────
export const meta: MetaFunction = () => [
  {
    title:
      "Catalogue de pièces détachées auto – Toutes marques & modèles | Automecanik",
  },
  {
    name: "description",
    content:
      "Pièces détachées auto pas cher pour toutes marques. Catalogue 400 000+ références, livraison 24-48h, qualité garantie. Filtrez par véhicule.",
  },
  { tagName: "link", rel: "canonical", href: "https://www.automecanik.com/" },
  { property: "og:type", content: "website" },
  { property: "og:url", content: "https://www.automecanik.com/" },
  {
    property: "og:title",
    content: "Catalogue de pièces détachées auto | Automecanik",
  },
  {
    property: "og:description",
    content:
      "400 000+ pièces auto en stock pour toutes marques. Livraison 24-48h. Qualité garantie.",
  },
  {
    property: "og:image",
    content: "https://www.automecanik.com/logo-og.webp",
  },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  {
    property: "og:image:alt",
    content: "Automecanik - Pièces auto à prix pas cher",
  },
  { property: "og:locale", content: "fr_FR" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:site", content: "@automecanik" },
  { name: "twitter:title", content: "Catalogue pièces auto | Automecanik" },
  {
    name: "twitter:description",
    content:
      "400 000+ pièces auto en stock pour toutes marques. Livraison 24-48h.",
  },
  {
    name: "twitter:image",
    content: "https://www.automecanik.com/logo-og.webp",
  },
  { name: "robots", content: "index, follow" },
  { name: "googlebot", content: "index, follow" },
];

// ─── Loader ──────────────────────────────────────────────
export async function loader({ request }: LoaderFunctionArgs) {
  // FAQ fetch — deferred (below-the-fold, does not block HTML)
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
    // RPC fetch — synchronous (above-the-fold: families, brands, stats)
    const rpcRes = await fetch(
      getInternalApiUrlFromRequest("/api/catalog/homepage-rpc", request),
    );
    const rpcData = rpcRes.ok ? await rpcRes.json() : null;

    return defer({
      families: (rpcData?.catalog?.families || []) as Array<{
        mf_id: number;
        mf_name: string;
        mf_pic: string;
        mf_description?: string;
        gammes: Array<{ pg_id: number; pg_alias: string; pg_name: string }>;
      }>,
      brands: (rpcData?.brands || []).map((b: any) => ({
        id: b.marque_id as number,
        name: b.marque_name as string,
        slug: b.marque_alias as string,
        logo: b.marque_logo
          ? `${IMG_PROXY_LOGOS}/${b.marque_logo}`
          : (undefined as string | undefined),
      })),
      equipementiers: (rpcData?.equipementiers || []).map((e: any) => ({
        name:
          typeof e === "string"
            ? e
            : e.pm_name || e.name || e.eq_name || String(e),
        logo: e.pm_logo || null,
      })) as Array<{ name: string; logo: string | null }>,
      blogArticles: (rpcData?.blog_articles || []) as Array<{
        ba_id: number;
        ba_title: string;
        ba_alias: string;
        ba_descrip: string;
        ba_preview: string;
        ba_category?: string;
        pg_name?: string;
        pg_alias?: string;
      }>,
      faqs: faqPromise,
    });
  } catch {
    return defer({
      families: [],
      brands: [],
      equipementiers: [],
      blogArticles: [],
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

  // Transform API data → component props (with fallbacks)
  const catalogFamilies =
    loaderData.families.length > 0
      ? loaderData.families.map((f) => ({
          img: f.mf_pic ? `${IMG_PROXY_FAMILIES}/${f.mf_pic}` : undefined,
          i: "📦",
          n: f.mf_name,
          desc: f.mf_description || "",
          color: getFamilyTheme(f.mf_name).gradient,
          gammes: f.gammes.map((g) => ({
            name: g.pg_name,
            link: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
          })),
        }))
      : CATS.map((c) => ({
          ...c,
          desc: c.desc || "",
          color: getFamilyTheme(c.n).gradient,
          img: c.pic ? `${IMG_PROXY_FAMILIES}/${c.pic}` : undefined,
          gammes: c.sub.map((s) => ({ name: s, link: "#" })),
        }));

  const brandsList =
    loaderData.brands.length > 0
      ? loaderData.brands
      : MARQUES.map((m) => ({
          id: 0,
          name: m.n,
          slug: m.n.toLowerCase().replace(/\s/g, "-"),
          logo: undefined,
        }));

  const equipAll =
    loaderData.equipementiers.length > 0
      ? loaderData.equipementiers
      : EQUIP.map((name) => ({ name, logo: null as string | null }));

  const equipMarquee = equipAll.slice(0, 12).map((e) => ({
    name: e.name,
    logoUrl: `${IMG_PROXY_EQUIP}/${
      e.logo ||
      e.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + ".webp"
    }`,
  }));

  const blogList =
    loaderData.blogArticles.length > 0
      ? loaderData.blogArticles.map((a) => ({
          ico: "📰",
          t: a.ba_title,
          d: a.ba_descrip || a.ba_preview || "",
          tag: a.pg_name || a.ba_category || "Guide",
          link: `/blog-pieces-auto/conseils/${a.pg_alias || a.ba_alias}`,
        }))
      : BLOG.map((b) => ({ ...b, link: "#" }));

  const faqsPromise = loaderData.faqs;

  return (
    <div className="min-h-screen bg-white">
      <HomepageJsonLd />
      <HeroSearchSection />

      <ConseilsDiagnosticSection />
      <CatalogueSection families={catalogFamilies} />
      <WhyAutomecanikSection />
      <Suspense fallback={null}>
        <BrandsGridSection brands={brandsList} />
      </Suspense>
      <Suspense fallback={null}>
        <StatsSection />
      </Suspense>
      <BlogGuidesSection articles={blogList} />
      <FaqSection faqsPromise={faqsPromise} />
      <Suspense fallback={null}>
        <EquipementiersMarquee equipementiers={equipMarquee} />
      </Suspense>
    </div>
  );
}
