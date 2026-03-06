/**
 * Route : /pieces/:slug
 * Page Gamme (R1 - ROUTEUR) - Sélection de pièces par famille
 *
 * Rôle SEO : R1 - ROUTEUR
 * Intention : Trouver la bonne pièce pour son véhicule
 *
 * Exemple :
 * /pieces/kit-d-embrayage-479.html
 */

import {
  defer,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Await,
  useLoaderData,
  useNavigation,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { useEffect, useState, Suspense } from "react";

import { Error404, Error410, ErrorGeneric } from "~/components/errors";
// V9 Design System Components
import {
  GammeHeroV9,
  GammeQuickNavV9,
  GammeDiagnosticCTA,
  GammeContentV9,
  GammeMotorisationsV9,
  GammeChecklistV9,
  GammeErrorsV9,
  GammeEquipementiersV9,
  GammeFamilleGridV9,
  GammeGuideCTA,
  GammeFaqV9,
} from "~/components/gamme-v9";
import { FooterV9 } from "~/components/home-v9";

import { fetchGammePageData } from "~/services/api/gamme-api.service";
import {
  type GammePageDataV1,
  GAMME_PAGE_CONTRACT_VERSION,
} from "~/types/gamme-page-contract.types";
import { parseGammePageData } from "~/utils/gamme-page-contract.utils";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { getOgImageUrl } from "~/utils/og-image.utils";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import {
  buildR1Breadcrumbs,
  buildProofData,
  buildGammeJsonLd,
  sanitizePurchaseGuideForR1,
  type R1PurchaseGuideData,
} from "~/utils/r1-builders";
import { inferFamilyKey } from "~/utils/r1-family-defaults";
import {
  buildR1SectionPack,
  type R1SectionPack,
} from "~/utils/r1-section-pack";
import {
  buildSourceMapFromPack,
  type R1SourceMap,
} from "~/utils/r1-source-tracker";
import { buildCanonicalUrl } from "~/utils/seo/canonical";
import { normalizeAlias } from "../utils/url-builder.utils";
import {
  getVehicleClient,
  storeVehicleClient,
  type VehicleCookie,
} from "../utils/vehicle-cookie";

/**
 * Handle export pour propager le rôle SEO au root Layout
 * Permet l'ajout automatique de data-attributes sur <body>
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "gamme",
    canonicalEntity: "pieces",
  }),
  hideGlobalFooter: true,
};

// R1 ROUTER: FAQ statiques orientées sélecteur véhicule (remplace les FAQ R3/guide-achat)
const R1_SELECTOR_FAQ = [
  {
    question: "Mon véhicule n'apparaît pas dans le sélecteur, que faire ?",
    answer:
      "Essayez de rechercher par la marque et le modèle exact. Si votre véhicule est très ancien ou importé hors Europe, il peut ne pas figurer dans notre base. Contactez-nous avec votre carte grise pour une recherche manuelle.",
  },
  {
    question: "Mon modèle a plusieurs motorisations, laquelle choisir ?",
    answer:
      "Vérifiez le code moteur sur votre carte grise (case D.2) ou sur la plaque constructeur. Deux motorisations proches (ex : 1.6 HDi 90 ch vs 110 ch) utilisent souvent des montages différents. En cas de doute, recherchez par VIN ou contactez notre équipe.",
  },
  {
    question:
      "Comment être sûr que la pièce est compatible avec mon véhicule ?",
    answer:
      "En sélectionnant votre véhicule exact dans notre sélecteur, seules les références 100% compatibles s'affichent. Nous vérifions la compatibilité via les bases techniques constructeur.",
  },
  {
    question: "Où trouver le CNIT ou le Type Mine de mon véhicule ?",
    answer:
      "Le CNIT (ex : M10RENCVP04E001) et le Type Mine figurent sur votre certificat d'immatriculation. Entrez-les dans notre recherche par Type Mine pour une identification précise.",
  },
];

// Contrat de donnees : voir frontend/app/types/gamme-page-contract.types.ts

/**
 * ✅ Migration 2026-01-21: Transforme les URLs Supabase en /img/* proxy
 * Avantages: Cache 1 an (Caddy), même comportement dev/prod (Vite proxy en dev)
 */
function createNoIndexHeaders(cacheControl: string) {
  return {
    "X-Robots-Tag": "noindex, follow",
    "Cache-Control": cacheControl,
  };
}

function toProxyImageUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  // Si c'est une URL Supabase, extraire le path et utiliser /img/*
  if (url.includes("supabase.co/storage")) {
    const match = url.match(/\/public\/(.+?)(?:\?|$)/);
    if (match) {
      return `/img/${match[1]}`;
    }
  }
  return url;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  // Redirect /pieces/catalogue → homepage (page supprimée)
  if (slug === "catalogue") {
    return redirect("/", 301);
  }

  // Extraire l'ID de la gamme depuis le slug (format: nom-gamme-ID.html)
  const match = slug.match(/-(\d+)\.html$/);

  // 🛑 410 Gone - URLs sans ID (ex: /pieces/suspension)
  // Ces pages n'existent plus - gammes sans véhicule supprimées
  if (!match) {
    logger.log(`🛑 [410] /pieces/${slug}`);
    throw new Response(null, {
      status: 410,
      headers: createNoIndexHeaders(
        "public, max-age=600, stale-while-revalidate=3600",
      ),
    });
  }

  const gammeId = match[1];

  // 🛑 404 — gamme_id=0 n'existe pas en base (parseUrlParam fallback)
  if (gammeId === "0") {
    throw new Response(null, {
      status: 404,
      headers: createNoIndexHeaders(
        "public, max-age=60, stale-while-revalidate=300",
      ),
    });
  }

  try {
    // 🚀 Configuration API depuis variables d'environnement
    // 🚀 Récupération des données avec fallback automatique RPC V2 → Classic
    // ⚠️ Timeout 15s — laisse ~15s de marge sur le budget Googlebot (~30s patience totale)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // 🚀 LCP V9: Substitution timeout séparé (3s) — ne bloque pas le gamme fetch
    const subController = new AbortController();
    const subTimeoutId = setTimeout(() => subController.abort(), 3000);

    // 🚀 Fetch en parallèle : données gamme + substitution (LCP optimization)
    const API_URL = getInternalApiUrl("");
    const currentUrl = new URL(request.url);
    const pathname = currentUrl.pathname;

    const [apiData, substitutionResponse] = await Promise.all([
      fetchGammePageData(gammeId, { signal: controller.signal }),
      // 🔄 Substitution API pour données enrichies (412/410 handling)
      fetch(
        `${API_URL}/api/substitution/check?url=${encodeURIComponent(pathname)}`,
        {
          signal: subController.signal,
        },
      )
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ]).finally(() => {
      clearTimeout(timeoutId);
      clearTimeout(subTimeoutId);
    });

    // Mapper hero → content
    const heroData = apiData.hero;
    const content = heroData
      ? {
          h1: heroData.h1,
          content: heroData.content,
          pg_name: heroData.pg_name || heroData.famille_info?.mf_name || "",
          pg_alias: heroData.pg_alias || "",
          pg_pic: toProxyImageUrl(heroData.image) ?? "",
          pg_wall: toProxyImageUrl(heroData.wall) ?? "",
        }
      : undefined;

    // 🔄 SEO: 301 redirect si le slug dans l'URL ne correspond pas au vrai pg_alias
    // Ex: /pieces/demarreur-402.html → 301 → /pieces/plaquette-de-frein-402.html
    // Ex: /pieces/gamme-2462.html → 301 → /pieces/rotule-de-suspension-2462.html
    const correctAlias =
      content?.pg_alias || normalizeAlias(content?.pg_name || "");
    if (correctAlias) {
      const correctSlug = `${correctAlias}-${gammeId}.html`;
      if (correctSlug !== slug) {
        logger.log(
          `🔄 [301] Slug mismatch: /pieces/${slug} → /pieces/${correctSlug}`,
        );
        return redirect(`/pieces/${correctSlug}`, 301);
      }
    }

    // Canonical URL calculée depuis les données API (pas location.pathname)
    // Utilise buildCanonicalUrl pour normalisation cohérente (tracking params, tri)
    const canonicalPath = buildCanonicalUrl({
      baseUrl: `/pieces/${correctAlias || slug.replace(/\.html$/, "")}-${gammeId}.html`,
    });

    // Breadcrumbs (sans vehicule sur page gamme seule — evite hydration mismatch)
    // Aligné avec le JSON-LD BreadcrumbList (3 niveaux: Accueil → Pièces Auto → gamme)
    const breadcrumbItems = buildR1Breadcrumbs(content?.pg_name || "Piece");

    // Substitution : 404/410 handling
    if (substitutionResponse) {
      logger.log(
        `🔄 Substitution: httpStatus=${substitutionResponse.httpStatus}, lock=${substitutionResponse.lock?.type || "none"}`,
      );
    }
    if (substitutionResponse?.httpStatus === 404) {
      throw new Response("Not Found", {
        status: 404,
        headers: createNoIndexHeaders(
          "public, max-age=60, stale-while-revalidate=300",
        ),
      });
    }
    if (substitutionResponse?.httpStatus === 410) {
      throw new Response("Gone", {
        status: 410,
        headers: createNoIndexHeaders(
          "public, max-age=600, stale-while-revalidate=3600",
        ),
      });
    }

    // Validation Zod avec degradation gracieuse
    const { data: pageData, degraded } = parseGammePageData({
      _v: GAMME_PAGE_CONTRACT_VERSION,
      pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
        clusterId: "gamme",
        canonicalEntity: `gamme:${gammeId}`,
      }),
      status: 200,
      meta: apiData.meta,
      content,
      breadcrumbs: { items: breadcrumbItems },
      famille: heroData?.famille_info,
      performance: apiData.performance,
      motorisations: apiData.motorisations,
      catalogueMameFamille: apiData.catalogueMameFamille,
      equipementiers: apiData.equipementiers,
      seoSwitches: apiData.seoSwitches,
      guide: apiData.guideAchat
        ? {
            ...apiData.guideAchat,
            date: (apiData.guideAchat as { updated?: string }).updated ?? "",
          }
        : undefined,
      purchaseGuideData: apiData.purchaseGuideData,
      substitution: substitutionResponse,
      reference: apiData.reference,
    });

    if (degraded.length > 0) {
      logger.warn(`[pieces/$slug] Sections degradees: ${degraded.join(", ")}`);
    }

    // ── LCP STREAMING: extractions légères pour above-fold ──
    // Evite de garder motorisations/equipementiers en sync (150-300KB → ~5KB)
    const motorItems = pageData.motorisations?.items || [];

    // JSON-LD ItemList: 30 items max (même limite que meta())
    const motorisationsSchema = motorItems.slice(0, 30).map((item) => ({
      marque_name: item.marque_name,
      modele_name: item.modele_name,
      type_name: item.type_name,
      link: item.link,
    }));

    // Période range pour proofs (calculé dans buildProofData)
    const allYears = motorItems
      .flatMap((m) => (m.periode || "").match(/\d{4}/g) || [])
      .map(Number)
      .filter((y) => y > 1900 && y < 2100);

    // Micro-preuves pour R1ReusableContent (S_BUY_ARGS)
    const equipNames = (pageData.equipementiers?.items || [])
      .map((e) => e.pm_name)
      .filter(Boolean);
    const proofData = buildProofData({
      motorItems,
      equipNames,
      allYears,
      motorisationsCount: pageData.performance?.motorisations_count,
    });

    // ── LCP STREAMING: defer() — above-fold sync, below-fold streamed ──
    // pageData sort du scope après defer() → GC naturel sans mutation
    const responseHeaders: Record<string, string> = {
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=7200",
    };

    const purchaseGuideData = sanitizePurchaseGuideForR1(
      pageData.purchaseGuideData,
    );
    const sectionPack = buildR1SectionPack({
      purchaseGuideData,
      proofData,
      gammeName: pageData.content?.pg_name?.toLowerCase() || "piece",
      familleName: pageData.famille?.mf_name || "",
      gammeId: parseInt(gammeId, 10),
      selectorFaq: R1_SELECTOR_FAQ,
    });
    const r1Sources = buildSourceMapFromPack(sectionPack);

    return defer(
      {
        // === SYNC (above-fold + meta/JSON-LD) — ~5-10KB ===
        _v: pageData._v,
        pageRole: pageData.pageRole,
        status: pageData.status,
        meta: pageData.meta,
        content: pageData.content,
        breadcrumbs: pageData.breadcrumbs,
        famille: pageData.famille,
        performance: pageData.performance,
        purchaseGuideData,
        sectionPack,
        r1Sources,
        substitution: pageData.substitution,
        reference: pageData.reference,
        canonicalPath,
        gammeId: parseInt(gammeId, 10),
        motorisationsSchema,
        proofData,

        // === DEFERRED (real Promises → Remix streaming via Suspense) — ~100-250KB ===
        motorisations: Promise.resolve(pageData.motorisations ?? null),
        equipementiers: Promise.resolve(pageData.equipementiers ?? null),
        catalogueMameFamille: Promise.resolve(
          pageData.catalogueMameFamille ?? null,
        ),
        seoSwitches: Promise.resolve(pageData.seoSwitches ?? null),
        guide: Promise.resolve(pageData.guide ?? null),
      },
      { headers: responseHeaders },
    );
  } catch (error) {
    // Propager les Response HTTP (404, etc.) telles quelles
    if (error instanceof Response) {
      throw error;
    }
    logger.error("Erreur lors du chargement des données:", error);
    throw new Response("Internal Server Error", { status: 500 });
  }
}

export const meta: MetaFunction<typeof loader> = ({
  data: rawData,
  location,
}) => {
  const data = rawData as PiecesPageSyncData | undefined;
  if (!data || data.status !== 200) {
    return [
      { title: "Page non trouvée" },
      { name: "description", content: "La page demandée n'a pas été trouvée." },
    ];
  }

  // Construire l'URL canonique depuis les données API (pas location.pathname)
  // Utilise buildCanonicalUrl pour garantir: même source meta/og:url/JSON-LD
  const canonicalUrl = buildCanonicalUrl({
    baseUrl: data.canonicalPath || location.pathname,
    includeHost: true,
  });

  // ✅ Utiliser les données SEO du backend (priorité absolue)
  // Les titres/descriptions viennent de __seo_gamme_car via l'API RPC
  const title =
    data.meta?.title ||
    `${data.content?.pg_name || "Pièces auto"} compatible véhicule | Prix & Livraison rapide`;
  const description =
    data.meta?.description ||
    `${data.content?.pg_name || "Pièces"} pour votre véhicule. Trouvez la référence compatible parmi nos équipementiers de confiance. Livraison rapide.`;

  // 📊 Schema @graph — CollectionPage + ItemList + FAQPage + Organization
  const gammeSchema = data.content?.pg_name
    ? buildGammeJsonLd({
        pgName: data.content.pg_name,
        pgPic: data.content.pg_pic,
        canonicalUrl,
        gammeId: data.gammeId,
        motorisationsSchema: data.motorisationsSchema,
        faq: data.purchaseGuideData?.faq,
        fallbackFaq: R1_SELECTOR_FAQ,
      })
    : null;

  // Construire le tableau de meta tags Remix
  const result: Array<{
    title?: string;
    name?: string;
    content?: string;
    property?: string;
    "script:ld+json"?: Record<string, unknown>;
    tagName?: string;
    rel?: string;
    href?: string;
    as?: string;
  }> = [];

  // Title
  result.push({ title });

  // Description
  result.push({ name: "description", content: description });

  // OG image — derive from pg_pic if available, fallback to transaction asset
  const ogImage = getOgImageUrl(data.content?.pg_pic, "transaction");

  // Open Graph
  result.push({ property: "og:title", content: title });
  result.push({ property: "og:description", content: description });
  result.push({ property: "og:url", content: canonicalUrl });
  result.push({ property: "og:type", content: "website" });
  result.push({ property: "og:image", content: ogImage });
  result.push({ property: "og:image:width", content: "1200" });
  result.push({ property: "og:image:height", content: "630" });
  result.push({ property: "og:image:alt", content: title });
  result.push({ property: "og:site_name", content: "Automecanik" });
  result.push({ property: "og:locale", content: "fr_FR" });

  // Twitter Cards
  result.push({ name: "twitter:card", content: "summary_large_image" });
  result.push({ name: "twitter:title", content: title });
  result.push({ name: "twitter:description", content: description });
  result.push({ name: "twitter:image", content: ogImage });
  result.push({ name: "twitter:site", content: "@automecanik" });

  // Canonical
  result.push({ tagName: "link", rel: "canonical", href: canonicalUrl });

  // Robots
  if (data.meta?.robots) {
    result.push({ name: "robots", content: data.meta.robots });
  } else {
    result.push({ name: "robots", content: "index, follow" });
  }

  // 📊 JSON-LD Schema
  if (gammeSchema) {
    result.push({ "script:ld+json": gammeSchema });
  }

  // 🚀 LCP: pg_wall est un fond décoratif (opacity-25) — PAS l'element LCP (= H1 texte)
  // Preload supprimé pour libérer la priorité browser vers CSS/fonts (vrais bloqueurs LCP)
  // pg_pic n'est pas non plus above-fold sur R1

  // Logo navbar preload (above-fold on all pages)
  result.push({
    tagName: "link",
    rel: "preload",
    as: "image",
    href: "https://www.automecanik.com/logo-navbar.webp",
  });

  return result;
};

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  const h: Record<string, string> = {
    "Cache-Control":
      loaderHeaders.get("Cache-Control") ||
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=7200",
  };
  const xr = loaderHeaders.get("X-Robots-Tag");
  if (xr) h["X-Robots-Tag"] = xr;
  return h;
}

// Sync data: disponible immediatement (above-fold + meta/JSON-LD)
type PiecesPageSyncData = Omit<
  GammePageDataV1,
  | "purchaseGuideData"
  | "motorisations"
  | "equipementiers"
  | "catalogueMameFamille"
  | "seoSwitches"
  | "guide"
> & {
  gammeId: number;
  canonicalPath?: string;
  purchaseGuideData?: R1PurchaseGuideData;
  sectionPack?: R1SectionPack;
  motorisationsSchema?: Array<{
    marque_name: string;
    modele_name: string;
    type_name: string;
    link: string;
  }>;
  proofData?: {
    topMarques: string[];
    topEquipementiers: string[];
    motorisationsCount: number;
    modelsCount: number;
    periodeRange: string;
    topMotorCodes: string[];
  };
  r1Sources?: R1SourceMap;
};

// Loader payload complet: sync + deferred Promises
type PiecesPageLoaderData = PiecesPageSyncData & {
  motorisations: Promise<GammePageDataV1["motorisations"] | null>;
  equipementiers: Promise<GammePageDataV1["equipementiers"] | null>;
  catalogueMameFamille: Promise<GammePageDataV1["catalogueMameFamille"] | null>;
  seoSwitches: Promise<GammePageDataV1["seoSwitches"] | null>;
  guide: Promise<GammePageDataV1["guide"] | null>;
};

export default function PiecesDetailPage() {
  const data = useLoaderData<
    typeof loader
  >() as unknown as PiecesPageLoaderData;
  const navigation = useNavigation();
  const navigate = useNavigate();

  // Afficher un indicateur de chargement si les données sont en cours de chargement
  const isLoading = navigation.state === "loading";

  // 🚗 Véhicule sélectionné — côté client uniquement (évite cache poisoning SSR)
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCookie | null>(
    null,
  );

  useEffect(() => {
    setSelectedVehicle(getVehicleClient());
  }, []);

  useEffect(() => {
    if (isLoading) {
      logger.log("⏳ Chargement des données en cours...");
    }
  }, [isLoading]);

  // Dev-guard: détecte les doublons data-section + log source tracking
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const sections = document.querySelectorAll("[data-section]");
    const vals = [...sections]
      .map((s) => s.getAttribute("data-section"))
      .filter(Boolean) as string[];
    const dupes = [...new Set(vals.filter((v, i) => vals.indexOf(v) !== i))];
    if (dupes.length)
      console.error(`[R1] Duplicate sections: ${dupes.join(", ")}`);

    // R1 Source Tracking log (mount-only debug, data stable from loader)
    if (data?.r1Sources) {
      const entries = Object.values(data.r1Sources);
      const prompt = entries.filter((s) => s?.source === "prompt").length;
      const fallback = entries.filter((s) => s?.source === "fallback").length;
      const api = entries.filter((s) => s?.source === "api").length;
      console.log(
        `[R1 Sources] prompt=${prompt}, fallback=${fallback}, api=${api}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data || data.status !== 200) {
    return <Error404 />;
  }

  // Construire les breadcrumbs depuis l'API (déjà avec véhicule si présent)
  const breadcrumbs: Array<{ label: string; href: string; current?: boolean }> =
    data.breadcrumbs?.items.map((item) => ({
      label: item.label,
      href: item.href || "",
      current: item.current,
    })) || [
      { label: "Accueil", href: "/" },
      {
        label: data.content?.pg_name || "Pièce",
        current: true as const,
      },
    ];

  return (
    <div className="min-h-screen bg-[#f5f7fa] font-v9-body">
      <a
        href="#hero-v9"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-blue-500 focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Aller au contenu principal
      </a>

      {/* ⏳ Indicateur de chargement */}
      {isLoading && (
        <div
          role="status"
          aria-label="Chargement en cours"
          className="fixed top-0 left-0 right-0 z-[60] h-1 bg-blue-500 animate-pulse"
        />
      )}

      <GammeHeroV9
        gammeName={
          data.sectionPack?.sections.hero.data.h1Override?.replace(
            /<[^>]*>/g,
            "",
          ) ||
          data.content?.h1?.replace(/<[^>]*>/g, "") ||
          data.content?.pg_name ||
          "Pièces auto"
        }
        familleTag={data.famille?.mf_name}
        subtitle={
          data.sectionPack?.sections.hero.data.heroSubtitle ||
          `Trouvez votre ${data.content?.pg_name?.toLowerCase() || "pièce"} compatible en quelques secondes`
        }
        pgPic={data.content?.pg_pic}
        breadcrumbs={breadcrumbs.map((b) => ({
          label: b.label,
          href: b.current ? undefined : b.href,
        }))}
        kpis={{
          motorisationsCount:
            data.proofData?.motorisationsCount ||
            data.performance?.motorisations_count ||
            0,
          modelsCount: data.proofData?.modelsCount || 0,
          equipCount: data.proofData?.topEquipementiers?.length || 0,
        }}
        onVehicleSelect={(vehicle) => {
          const brandSlug = `${vehicle.brand.marque_alias || normalizeAlias(vehicle.brand.marque_name)}-${vehicle.brand.marque_id}`;
          const modelSlug = `${vehicle.model.modele_alias || normalizeAlias(vehicle.model.modele_name)}-${vehicle.model.modele_id}`;
          const typeSlug = `${vehicle.type.type_alias || normalizeAlias(vehicle.type.type_name)}-${vehicle.type.type_id}`;
          const gammeSlug = `${data.content?.pg_alias || normalizeAlias(data.content?.pg_name || "")}-${data.gammeId}`;
          storeVehicleClient({
            marque_id: vehicle.brand.marque_id,
            marque_name: vehicle.brand.marque_name,
            marque_alias:
              vehicle.brand.marque_alias ||
              normalizeAlias(vehicle.brand.marque_name),
            modele_id: vehicle.model.modele_id,
            modele_name: vehicle.model.modele_name,
            modele_alias:
              vehicle.model.modele_alias ||
              normalizeAlias(vehicle.model.modele_name),
            type_id: vehicle.type.type_id,
            type_name: vehicle.type.type_name,
            type_alias:
              vehicle.type.type_alias || normalizeAlias(vehicle.type.type_name),
          });
          navigate(
            `/pieces/${gammeSlug}/${brandSlug}/${modelSlug}/${typeSlug}.html`,
          );
        }}
        selectedVehicle={selectedVehicle}
      />

      <GammeQuickNavV9 />

      <GammeDiagnosticCTA />

      <GammeContentV9
        gammeName={data.content?.pg_name || "Pièces auto"}
        content={data.content?.content}
        microSeoBlock={
          data.sectionPack?.sections.buyArgs.data.microSeoBlock ?? undefined
        }
        arguments={data.sectionPack?.sections.buyArgs.data.arguments}
        familyKey={inferFamilyKey(
          data.content?.pg_name || "",
          data.famille?.mf_name,
        )}
        pgAlias={data.content?.pg_alias}
      />

      {/* Motorisations compatibles — deferred */}
      <Suspense
        fallback={
          <div className="py-10 px-5">
            <div className="max-w-[1280px] mx-auto">
              <div className="h-96 bg-slate-100 animate-pulse rounded-2xl" />
            </div>
          </div>
        }
      >
        <Await resolve={data.motorisations}>
          {(motorisations) => (
            <GammeMotorisationsV9
              items={motorisations?.items || []}
              totalCount={data.performance?.motorisations_count}
              intro={
                data.sectionPack?.sections.motorisations.data
                  .compatibilitiesIntro ?? undefined
              }
            />
          )}
        </Await>
      </Suspense>

      <GammeChecklistV9
        gammeName={data.content?.pg_name}
        items={data.sectionPack?.sections.safeTable.data?.map((row) => ({
          label: row.element,
          desc: row.howToCheck,
        }))}
      />

      <GammeErrorsV9
        errors={data.sectionPack?.sections.compatErrors.data}
        gammeName={data.content?.pg_name}
      />

      {/* Équipementiers — deferred */}
      <Suspense
        fallback={
          <div className="py-10 bg-[#0d1b2a]">
            <div className="max-w-[1280px] mx-auto px-5">
              <div className="h-48 bg-white/5 animate-pulse rounded-2xl" />
            </div>
          </div>
        }
      >
        <Await resolve={data.equipementiers}>
          {(equipementiers) => (
            <GammeEquipementiersV9
              items={(equipementiers?.items || []).map(
                (e: {
                  title: string;
                  description?: string;
                  image?: string;
                }) => ({
                  name: e.title,
                  description: e.description,
                  logo: e.image,
                }),
              )}
              intro={
                data.sectionPack?.sections.equipementiers.data
                  .equipementiersLine ?? undefined
              }
            />
          )}
        </Await>
      </Suspense>

      {/* Catalogue même famille — deferred */}
      <Suspense
        fallback={
          <div className="py-10 px-5">
            <div className="max-w-[1280px] mx-auto">
              <div className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
            </div>
          </div>
        }
      >
        <Await resolve={data.catalogueMameFamille}>
          {(catalogueMameFamille) => (
            <GammeFamilleGridV9
              familleName={data.famille?.mf_name || "Pièces"}
              items={(catalogueMameFamille?.items || []).map((c) => ({
                name: c.name,
                link: c.link,
                img: c.image || undefined,
              }))}
              intro={
                data.sectionPack?.sections.catalogue.data
                  .familyCrossSellIntro ?? undefined
              }
            />
          )}
        </Await>
      </Suspense>

      <GammeFaqV9
        items={data.sectionPack?.sections.faq.data ?? R1_SELECTOR_FAQ}
      />

      <GammeGuideCTA
        gammeName={data.content?.pg_name || "Pièces auto"}
        pgAlias={data.content?.pg_alias}
      />

      <FooterV9 />
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP par status
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    const errorData = typeof error.data === "object" ? error.data : undefined;

    if (error.status === 410) {
      return (
        <Error410
          url={errorData?.url}
          isOldLink={errorData?.isOldLink}
          redirectTo={errorData?.redirectTo}
        />
      );
    }

    if (error.status >= 500) {
      return (
        <ErrorGeneric
          status={error.status}
          message={error.statusText || "Erreur serveur"}
        />
      );
    }

    return <Error404 url={errorData?.url} />;
  }

  return <Error404 />;
}
