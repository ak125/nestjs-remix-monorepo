import {
  type BrandItem,
  type BlogArticle,
  type CatalogFamily,
  BLOG,
  CATS,
  IMG_PROXY_FAMILIES,
  IMG_PROXY_LOGOS,
  MARQUES,
} from "~/components/home/constants";
import { getFamilyTheme } from "~/utils/family-theme";
import { logger } from "~/utils/logger";
import {
  HomepageRpcSchema,
  type HomepageRpcData,
  type HomepageBrand,
  type HomepageEquipementier,
  type HomepageBlogArticle,
} from "./homepage-rpc.schema";

// ─── Constants ──────────────────────────────────────────
/** Max gammes per family in initial SSR (rest loaded on expand) */
const INITIAL_GAMMES_PER_FAMILY = 3;

// ─── Loader data shape ──────────────────────────────────
export interface SlimFamily {
  mf_id: number;
  mf_name: string;
  mf_pic?: string | null;
  mf_description?: string | null;
  gammes: Array<{
    pg_id: number;
    pg_alias: string;
    pg_name: string;
    pg_img?: string | null;
  }>;
  gammes_count: number;
}

export interface HomepageLoaderData {
  families: SlimFamily[];
  brands: BrandItem[];
  equipementiers: Array<{ name: string; logo?: string }>;
  blogArticles: HomepageBlogArticle[];
}

// ─── RPC → Loader data (with Zod validation, logging-only) ──
export function mapHomepageRpcToLoaderData(
  rpcRaw: unknown,
): HomepageLoaderData {
  if (!rpcRaw) {
    return { families: [], brands: [], equipementiers: [], blogArticles: [] };
  }

  const zodResult = HomepageRpcSchema.safeParse(rpcRaw);
  if (!zodResult.success) {
    logger.warn("[homepage-rpc] Zod drift:", {
      issues: zodResult.error.issues.slice(0, 5).map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  const data = rpcRaw as HomepageRpcData;

  // Slim families: limit gammes to INITIAL_GAMMES_PER_FAMILY, strip pg_name_meta
  const families: SlimFamily[] = (data.catalog?.families ?? []).map((f) => {
    const allGammes = f.gammes ?? [];
    return {
      mf_id: Number(f.mf_id),
      mf_name: f.mf_name,
      mf_pic: f.mf_pic,
      mf_description: f.mf_description,
      gammes: allGammes.slice(0, INITIAL_GAMMES_PER_FAMILY).map((g) => ({
        pg_id: g.pg_id,
        pg_alias: g.pg_alias,
        pg_name: g.pg_name,
        pg_img: g.pg_img,
      })),
      gammes_count: allGammes.length,
    };
  });

  const brands: BrandItem[] = (data.brands ?? []).map((b: HomepageBrand) => ({
    id: b.marque_id,
    name: b.marque_name,
    slug: b.marque_alias,
    logo: b.marque_logo ? `${IMG_PROXY_LOGOS}/${b.marque_logo}` : undefined,
  }));

  const equipementiers = (data.equipementiers ?? []).map(
    (e: HomepageEquipementier) => ({
      name: e.pm_name,
      logo: e.pm_logo
        ? `/img/uploads/equipementiers-automobiles/${e.pm_logo}`
        : undefined,
    }),
  );

  const blogArticles: HomepageBlogArticle[] = data.blog_articles ?? [];

  return { families, brands, equipementiers, blogArticles };
}

// ─── Split endpoint mappers (Phase 1 perf) ──────────────

/** Map /homepage-families response to SlimFamily[] */
export function mapFamiliesFromSplit(raw: unknown): SlimFamily[] {
  if (!raw || typeof raw !== "object") return [];
  const data = raw as { catalog?: { families?: unknown[] } };
  const families = data.catalog?.families;
  if (!Array.isArray(families)) return [];

  return families.map((f: any) => {
    const allGammes = f.gammes ?? [];
    return {
      mf_id: Number(f.mf_id),
      mf_name: f.mf_name,
      mf_pic: f.mf_pic,
      mf_description: f.mf_description,
      gammes: allGammes.slice(0, INITIAL_GAMMES_PER_FAMILY).map((g: any) => ({
        pg_id: g.pg_id,
        pg_alias: g.pg_alias,
        pg_name: g.pg_name,
        pg_img: g.pg_img,
      })),
      gammes_count: f.gammes_count ?? allGammes.length,
    };
  });
}

/** Map /homepage-below-fold response to below-fold data */
export function mapBelowFoldData(raw: unknown): {
  brands: BrandItem[];
  equipementiers: Array<{ name: string; logo?: string }>;
  blogArticles: HomepageBlogArticle[];
} {
  if (!raw || typeof raw !== "object") {
    return { brands: [], equipementiers: [], blogArticles: [] };
  }
  const data = raw as Record<string, any>;

  const brands: BrandItem[] = (data.brands ?? []).map((b: HomepageBrand) => ({
    id: b.marque_id,
    name: b.marque_name,
    slug: b.marque_alias,
    logo: b.marque_logo ? `${IMG_PROXY_LOGOS}/${b.marque_logo}` : undefined,
  }));

  const equipementiers = (data.equipementiers ?? []).map(
    (e: HomepageEquipementier) => ({
      name: e.pm_name,
      logo: e.pm_logo
        ? `/img/uploads/equipementiers-automobiles/${e.pm_logo}`
        : undefined,
    }),
  );

  return {
    brands,
    equipementiers,
    blogArticles: data.blog_articles ?? [],
  };
}

// ─── Families → CatalogFamily[] (with fallback) ─────────
export function mapFamiliesToCatalog(families: SlimFamily[]): CatalogFamily[] {
  if (families.length > 0) {
    return families.map((f) => ({
      mf_id: f.mf_id,
      img: f.mf_pic ? `${IMG_PROXY_FAMILIES}/${f.mf_pic}` : undefined,
      i: "\u{1F4E6}",
      n: f.mf_name,
      desc: f.mf_description || "",
      color: getFamilyTheme(f.mf_name).gradient,
      gammes: (f.gammes ?? []).map((g) => ({
        name: g.pg_name,
        link: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
      })),
      gammes_count: f.gammes_count,
    }));
  }

  return CATS.map((c) => ({
    ...c,
    desc: c.desc || "",
    color: getFamilyTheme(c.n).gradient,
    img: c.pic ? `${IMG_PROXY_FAMILIES}/${c.pic}` : undefined,
    gammes: c.sub.map((s) => ({ name: s, link: "#" })),
  }));
}

// ─── Brands fallback ────────────────────────────────────
export function mapBrandsWithFallback(brands: BrandItem[]): BrandItem[] {
  if (brands.length > 0) return brands;
  return MARQUES.map((m) => ({
    id: 0,
    name: m.n,
    slug: m.n.toLowerCase().replace(/\s/g, "-"),
    logo: undefined,
  }));
}

// ─── Blog articles → BlogArticle[] (with fallback) ──────
export function mapBlogArticles(
  articles: HomepageBlogArticle[],
  families: SlimFamily[],
): BlogArticle[] {
  if (articles.length === 0) {
    return BLOG.map((b) => ({ ...b, link: "/blog-pieces-auto" }));
  }

  const gammeImgMap = new Map<string, string>();
  for (const f of families) {
    for (const g of f.gammes ?? []) {
      if (g.pg_img) gammeImgMap.set(g.pg_alias, g.pg_img);
    }
  }

  return articles.map((a) => ({
    ico: "\u{1F4F0}",
    t: a.ba_title,
    d: a.ba_descrip || a.ba_preview || "",
    tag: a.pg_name || a.ba_category || "Guide",
    link: `/blog-pieces-auto/conseils/${a.pg_alias || a.ba_alias}`,
    img:
      a.pg_alias && gammeImgMap.get(a.pg_alias)
        ? `/img/uploads/articles/gammes-produits/catalogue/${gammeImgMap.get(a.pg_alias)}`
        : undefined,
  }));
}
