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
  useLocation,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { Shield } from "lucide-react";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { useEffect, useState, lazy, Suspense } from "react";
// 🆕 V2 UX Components

// 🚀 LCP OPTIMIZATION: Lazy load below-fold components (économie ~200-400ms)
// Ces sections ne sont pas visibles au premier paint - différer leur chargement
// V2: SEOHelmet retiré — meta() est la source unique pour tous les tags <head>
// Note: generateGammeMeta supprimé - on utilise maintenant data.meta du backend
import { ScrollToTop } from "~/components/blog/ScrollToTop";
import {
  SectionImage,
  SectionWithImage,
} from "~/components/content/SectionImage";
import { Error404 } from "~/components/errors/Error404";
import { HeroTransaction } from "~/components/heroes";
import DarkSection from "~/components/layout/DarkSection";
import PageSection from "~/components/layout/PageSection";
import Reveal from "~/components/layout/Reveal";
import SectionHeader from "~/components/layout/SectionHeader";
import MobileStickyBar from "~/components/pieces/MobileStickyBar";
import { R1CompatErrors } from "~/components/pieces/R1CompatErrors";
import { R1ProofStats } from "~/components/pieces/R1ProofStats";
import { R1QuickSteps } from "~/components/pieces/R1QuickSteps";
import { R1ReusableContent } from "~/components/pieces/R1ReusableContent";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import {
  getSectionImageConfig,
  resolveAltText,
  resolveSlogan,
} from "~/config/visual-intent";
import { R1Section, sectionAttr } from "~/constants/r1-sections";
import { pluralizePieceName } from "~/lib/seo-utils";
import { fetchGammePageData } from "~/services/api/gamme-api.service";
import {
  type GammePageDataV1,
  GAMME_PAGE_CONTRACT_VERSION,
} from "~/types/gamme-page-contract.types";
import {
  trackSelectorComplete,
  trackSelectorCTA,
  trackSelectorResume,
} from "~/utils/analytics";
import { parseGammePageData } from "~/utils/gamme-page-contract.utils";
import { ImageOptimizer } from "~/utils/image-optimizer";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { getOgImageUrl } from "~/utils/og-image.utils";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import {
  buildR1Breadcrumbs,
  buildProofData,
  buildGammeJsonLd,
  buildHeroProps,
  sanitizePurchaseGuideForR1,
  type R1PurchaseGuideData,
} from "~/utils/r1-builders";
import { buildCanonicalUrl } from "~/utils/seo/canonical";
import { VehicleFilterBadge } from "../components/vehicle/VehicleFilterBadge";
import VehicleSelector from "../components/vehicle/VehicleSelector";
import { hierarchyApi } from "../services/api/hierarchy.api";
import { normalizeAlias } from "../utils/url-builder.utils";
import {
  getVehicleClient,
  clearVehicleClient,
  buildBreadcrumbWithVehicle,
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
};

// 🚀 LCP OPTIMIZATION V7: Lazy load ALL below-fold components
// V2: QuickGuideSection, DecisionGridSection, ReferenceEncartSection retirés du R1
const MotorisationsSection = lazy(() =>
  import("../components/pieces/MotorisationsSection").then((m) => ({
    default: m.default,
  })),
);
const CatalogueSection = lazy(() =>
  import("../components/pieces/CatalogueSection").then((m) => ({
    default: m.default,
  })),
);
const EquipementiersSection = lazy(() =>
  import("../components/pieces/EquipementiersSection").then((m) => ({
    default: m.default,
  })),
);
const SafeCompatTable = lazy(() =>
  import("../components/pieces/SafeCompatTable").then((m) => ({
    default: m.default,
  })),
);
// R1 ROUTER: ConseilsSection (R3/conseils) et InformationsSection supprimes — hors-role

// R1 ROUTER: sections hors-role supprimees (SymptomsSection=R5, AntiMistakesSection=R3, PurchaseNarrativeSection=R3)
// Voir brief: .claude/skills/seo-content-architect/references/r1-router-role.md

// V2: DecisionGridSection + ReferenceEncartSection retirés — contenu redirigé vers cartes R1ReusableContent

// ✅ Bloc compatibilité véhicule (réassurance avant catalogue)
const CompatibilityConfirmationBlock = lazy(() =>
  import("../components/pieces/CompatibilityConfirmationBlock").then((m) => ({
    default: m.CompatibilityConfirmationBlock,
  })),
);

// 📖 FAQ Section avec Schema.org
const FAQSection = lazy(() =>
  import("../components/seo/FAQSection").then((m) => ({
    default: m.FAQSection,
  })),
);

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
      "Vérifiez le code moteur sur votre carte grise (case D.2) ou sur la plaque constructeur dans le compartiment moteur. Chaque motorisation peut avoir un montage différent.",
  },
  {
    question:
      "Comment être sûr que la pièce est compatible avec mon véhicule ?",
    answer:
      "En sélectionnant votre véhicule exact dans notre sélecteur, seules les références 100% compatibles s'affichent. Nous vérifions la compatibilité via les bases techniques constructeur.",
  },
  {
    question: "Où trouver le CNIT ou le Type Mine sur ma carte grise ?",
    answer:
      "Le CNIT se trouve dans le champ D.2 de votre carte grise (ex : M10RENCVP04E001). Le Type Mine est dans le champ D.2.1. Ces codes permettent d'identifier précisément votre motorisation et de vérifier la compatibilité des pièces.",
  },
  {
    question:
      "Mon véhicule a plusieurs motorisations proches, comment choisir ?",
    answer:
      "Deux motorisations proches (par ex. 1.6 HDi 90 ch vs 110 ch) utilisent souvent des montages différents. Repérez le code moteur dans le champ D.2 de votre carte grise ou sur la plaque constructeur du compartiment moteur. En cas de doute, notre équipe peut vérifier avec votre numéro VIN.",
  },
];

// Contrat de donnees : voir frontend/app/types/gamme-page-contract.types.ts

/**
 * ✅ Migration 2026-01-21: Transforme les URLs Supabase en /img/* proxy
 * Avantages: Cache 1 an (Caddy), même comportement dev/prod (Vite proxy en dev)
 */
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
      headers: {
        "X-Robots-Tag": "noindex, follow",
        "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
      },
    });
  }

  const gammeId = match[1];

  // 🛑 404 — gamme_id=0 n'existe pas en base (parseUrlParam fallback)
  if (gammeId === "0") {
    throw new Response(null, {
      status: 404,
      headers: {
        "X-Robots-Tag": "noindex, follow",
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
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
    const breadcrumbItems = buildBreadcrumbWithVehicle(
      buildR1Breadcrumbs(content?.pg_name || "Piece"),
      null,
    );

    // Substitution : 404/410 handling
    if (substitutionResponse) {
      logger.log(
        `🔄 Substitution: httpStatus=${substitutionResponse.httpStatus}, lock=${substitutionResponse.lock?.type || "none"}`,
      );
    }
    if (substitutionResponse?.httpStatus === 404) {
      throw new Response("Not Found", {
        status: 404,
        headers: {
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      });
    }
    if (substitutionResponse?.httpStatus === 410) {
      throw new Response("Gone", {
        status: 410,
        headers: {
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
        },
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
      .filter((y) => y > 1990 && y < 2100);

    // Micro-preuves pour R1ReusableContent (S_BUY_ARGS)
    const equipNames = (pageData.equipementiers?.items || [])
      .map((e) => e.pm_name)
      .filter(Boolean);
    const proofData = buildProofData({ motorItems, equipNames, allYears });

    // ── LCP STREAMING: defer() — above-fold sync, below-fold streamed ──
    // pageData sort du scope après defer() → GC naturel sans mutation
    const responseHeaders: Record<string, string> = {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
    };

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
        purchaseGuideData: sanitizePurchaseGuideForR1(
          pageData.purchaseGuideData,
        ),
        substitution: pageData.substitution,
        reference: pageData.reference,
        canonicalPath,
        gammeId: parseInt(gammeId, 10),
        motorisationsSchema,
        proofData,

        // === DEFERRED (valeurs sync, pas de streaming) — ~100-250KB ===
        motorisations: pageData.motorisations ?? null,
        equipementiers: pageData.equipementiers ?? null,
        catalogueMameFamille: pageData.catalogueMameFamille ?? null,
        seoSwitches: pageData.seoSwitches ?? null,
        guide: pageData.guide ?? null,
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
  const data = rawData as PiecesPageData | undefined;
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

  return result;
};

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  const h: Record<string, string> = {
    "Cache-Control":
      loaderHeaders.get("Cache-Control") ||
      "public, max-age=3600, stale-while-revalidate=7200",
  };
  const xr = loaderHeaders.get("X-Robots-Tag");
  if (xr) h["X-Robots-Tag"] = xr;
  return h;
}

// Type étendu pour les champs sync extraits dans le loader (LCP streaming)
// Omit<purchaseGuideData> remplacé par R1PurchaseGuideData strict (compile-time guard)
type PiecesPageData = Omit<GammePageDataV1, "purchaseGuideData"> & {
  gammeId: number;
  canonicalPath?: string;
  purchaseGuideData?: R1PurchaseGuideData;
  motorisationsSchema?: Array<{
    marque_name: string;
    modele_name: string;
    type_name: string;
    link: string;
  }>;
  proofData?: {
    topMarques: string[];
    topEquipementiers: string[];
    vehicleCount: number;
    periodeRange: string;
    topMotorCodes: string[];
  };
};

export default function PiecesDetailPage() {
  const data = useLoaderData<typeof loader>() as unknown as PiecesPageData;
  const navigation = useNavigation();
  const location = useLocation();
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

  // Dev-guard: détecte les doublons data-section dans le DOM
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const sections = document.querySelectorAll("[data-section]");
    const vals = [...sections]
      .map((s) => s.getAttribute("data-section"))
      .filter(Boolean) as string[];
    const dupes = [...new Set(vals.filter((v, i) => vals.indexOf(v) !== i))];
    if (dupes.length)
      throw new Error(`[R1] Duplicate sections: ${dupes.join(", ")}`);
  }, []);

  if (!data || data.status !== 200) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 mb-4">
            Page non trouvée
          </h1>
          <p className="text-neutral-600">Désolé, cette page n'existe pas.</p>
        </div>
      </div>
    );
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
        href: data.meta?.canonical || "",
      },
    ];

  // 🎨 Récupérer la couleur de la famille pour le hero
  const familleColor = data.famille
    ? hierarchyApi.getFamilyColor({
        mf_id: data.famille.mf_id,
        mf_name: data.famille.mf_name,
        mf_pic: data.famille.mf_pic,
      } as Parameters<typeof hierarchyApi.getFamilyColor>[0])
    : "from-primary-950 via-primary-900 to-secondary-900"; // Fallback avec design tokens

  // V2: itemListData + SEOHelmet retirés — meta() gère tout le <head>

  // LCP STREAMING: proofData extrait dans le loader (sync, ~1KB)
  // Remplace le calcul motorItems/allYears/periodeRange qui nécessitait motorisations (deferred)
  const periodeRange = data.proofData?.periodeRange || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      <a
        href="#hero-transaction"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-navy focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-semibold"
      >
        Aller au contenu principal
      </a>

      {/* ⏳ Indicateur de chargement global */}
      {isLoading && (
        <div
          role="status"
          aria-label="Chargement en cours"
          className="fixed top-0 left-0 right-0 z-50 h-1 bg-semantic-info animate-pulse"
        >
          <div className="h-full bg-gradient-to-r from-semantic-info via-secondary-500 to-semantic-info bg-[length:200%_100%] animate-pulse"></div>
        </div>
      )}

      {/* Breadcrumbs visuels */}
      <div className="container mx-auto px-page pt-4">
        <PublicBreadcrumb items={breadcrumbs} />
      </div>

      {/* 🎯 HERO SECTION - Avec couleur de la famille */}
      <HeroTransaction
        id="hero-transaction"
        {...sectionAttr(R1Section.HERO)}
        gradient={familleColor}
        slogan={resolveSlogan("transaction", data.content?.pg_name)}
        badges={
          buildHeroProps({
            purchaseGuideArgs: data.purchaseGuideData?.arguments,
            motorisationsCount: data.performance?.motorisations_count,
          }).badges
        }
        className="py-8 md:py-16 lg:py-20"
        backgroundSlot={
          <>
            {/* Wallpaper OFF par défaut — perf (LCP/INP) > esthétique sur 221+ pages
                Réactivable par gamme en Phase 2 via visual_plan.hero_wallpaper */}

            {/* Effet mesh gradient adaptatif */}
            <div
              className="absolute inset-0 z-[1] opacity-20"
              style={{
                backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 50%),
                                 radial-gradient(circle at 75% 75%, rgba(0,0,0,0.15) 0%, transparent 50%)`,
              }}
              aria-hidden="true"
            />
          </>
        }
      >
        {/* Badges contextuels en haut */}
        <div className="flex flex-wrap justify-center items-center gap-3 mb-6 md:mb-8 animate-in fade-in duration-700">
          {data.famille && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/20 shadow-lg">
              <div
                className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${familleColor} animate-pulse shadow-lg`}
              ></div>
              <span className="text-white/95 font-semibold text-sm tracking-wide">
                {data.famille.mf_name}
              </span>
            </div>
          )}
          {data.famille?.mf_name.toLowerCase().includes("frein") && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/20 shadow-lg">
              <Shield className="w-4 h-4 text-red-300" />
              <span className="text-white/95 text-sm font-semibold">
                Votre sécurité est notre priorité
              </span>
            </div>
          )}
        </div>

        {/* Titre H1 dynamique optimisé SEO - utilise h1Override si disponible */}
        <div className="text-center mb-6 md:mb-8 animate-in fade-in duration-700 delay-100">
          <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            <span className="bg-gradient-to-r from-white via-white to-white/90 bg-clip-text text-transparent">
              {(() => {
                // Priorité: h1Override > h1 existant > fallback
                const rawH1 =
                  data.purchaseGuideData?.h1Override ||
                  data.content?.h1 ||
                  `${data.content?.pg_name || "Pièces auto"} — trouvez la référence compatible avec votre véhicule`;
                // Nettoyer les balises HTML (<b>, </b>, etc.)
                return rawH1.replace(/<[^>]*>/g, "");
              })()}
            </span>
          </h1>
        </div>

        <p className="text-white/80 text-base md:text-lg font-medium text-center mt-3 max-w-2xl mx-auto">
          {data.purchaseGuideData?.heroSubtitle ||
            (() => {
              const name = data.content?.pg_name?.toLowerCase() || "";
              const pluralName = pluralizePieceName(name);
              return name
                ? `Trouvez vos ${pluralName} compatibles avec votre véhicule en quelques secondes`
                : "Trouvez la référence compatible avec votre véhicule en quelques secondes";
            })()}
        </p>

        {/* Cadre glassmorphism contenant Image + VehicleSelector */}
        <div className="max-w-5xl mx-auto mb-8 md:mb-10 animate-in fade-in duration-1000 delay-200">
          <div className="bg-gradient-to-br from-white/[0.18] to-white/[0.10] rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.4)] p-6 md:p-8 border border-white/30 hover:border-white/50 transition-all duration-500">
            {/* Layout horizontal : Image + VehicleSelector côte à côte */}
            <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
              {/* Image produit à gauche */}
              <div className="flex-shrink-0 w-full lg:w-80">
                <div className="relative group">
                  {/* Cercle décoratif retiré — LCP: blur-3xl force GPU compositing layer */}

                  {/* Container image */}
                  <div className="relative bg-white/10 rounded-2xl p-6 border border-white/20 shadow-lg">
                    <div className="w-full aspect-square flex items-center justify-center">
                      {(() => {
                        const imgPath = (data.content?.pg_pic || "").replace(
                          /^\/img\//,
                          "",
                        );
                        if (!imgPath) {
                          return (
                            <img
                              src="/images/categories/default.svg"
                              alt={data.content?.pg_name || "Pièce auto"}
                              width={400}
                              height={400}
                              className="w-full h-full object-contain"
                            />
                          );
                        }
                        const pictureSet = ImageOptimizer.getPictureImageSet(
                          imgPath,
                          {
                            widths: [200, 400, 600],
                            quality: 85,
                            sizes: "(max-width: 640px) 200px, 400px",
                            width: 400,
                            height: 400,
                          },
                        );
                        return (
                          <picture>
                            <source
                              srcSet={pictureSet.avifSrcSet}
                              type="image/avif"
                              sizes={pictureSet.sizes}
                            />
                            <source
                              srcSet={pictureSet.webpSrcSet}
                              type="image/webp"
                              sizes={pictureSet.sizes}
                            />
                            <img
                              src={pictureSet.fallbackSrc}
                              alt={data.content?.pg_name || "Pièce auto"}
                              width={400}
                              height={400}
                              className="w-full h-full object-contain"
                              loading="eager"
                              decoding="async"
                              fetchPriority="high"
                              onError={(e) => {
                                e.currentTarget.src =
                                  "/images/categories/default.svg";
                                e.currentTarget.onerror = null;
                              }}
                            />
                          </picture>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Particule décorative retirée — LCP: blur-xl force GPU layer */}
                </div>
              </div>

              {/* VehicleSelector ou Resume vehicule */}
              <div
                id="vehicle-selector"
                className="flex-1 w-full scroll-mt-20 animate-in fade-in slide-in-from-right duration-1000 delay-400"
              >
                {selectedVehicle ? (
                  <div className="space-y-4">
                    <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-5 border border-white/25">
                      <p className="text-white/70 text-sm mb-1">
                        Votre véhicule
                      </p>
                      <p className="text-white text-lg font-bold">
                        {selectedVehicle.marque_name}{" "}
                        {selectedVehicle.modele_name}
                      </p>
                      <p className="text-white/80 text-sm">
                        {selectedVehicle.type_name}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const gammeSlug =
                          location.pathname
                            .split("/")
                            .pop()
                            ?.replace(".html", "") || "";
                        const brandSlug = `${selectedVehicle.marque_alias}-${selectedVehicle.marque_id}`;
                        const modelSlug = `${selectedVehicle.modele_alias}-${selectedVehicle.modele_id}`;
                        const typeSlug = `${selectedVehicle.type_alias}-${selectedVehicle.type_id}`;
                        const vehicleLabel = `${selectedVehicle.marque_name} ${selectedVehicle.modele_name} ${selectedVehicle.type_name}`;
                        trackSelectorResume(
                          data.content?.pg_name || "unknown",
                          vehicleLabel,
                        );
                        navigate(
                          `/pieces/${gammeSlug}/${brandSlug}/${modelSlug}/${typeSlug}.html`,
                        );
                      }}
                      className="w-full py-3.5 px-6 bg-white text-gray-900 font-bold rounded-xl hover:bg-white/90 transition-all shadow-lg text-base"
                    >
                      Voir mes{" "}
                      {pluralizePieceName(
                        data.content?.pg_name?.toLowerCase() || "pièces",
                      )}{" "}
                      compatibles
                    </button>
                    <button
                      onClick={() => {
                        clearVehicleClient();
                        setSelectedVehicle(null);
                      }}
                      className="w-full py-2.5 text-white/70 text-sm hover:text-white transition-colors underline underline-offset-4"
                    >
                      Changer de véhicule
                    </button>
                  </div>
                ) : (
                  <>
                    <VehicleSelector
                      enableTypeMineSearch={true}
                      context="pieces"
                      redirectOnSelect={false}
                      onVehicleSelect={(vehicle) => {
                        const brandSlug = `${vehicle.brand.marque_alias || normalizeAlias(vehicle.brand.marque_name)}-${vehicle.brand.marque_id}`;
                        const modelSlug = `${vehicle.model.modele_alias || normalizeAlias(vehicle.model.modele_name)}-${vehicle.model.modele_id}`;
                        const typeSlug = `${vehicle.type.type_alias || normalizeAlias(vehicle.type.type_name)}-${vehicle.type.type_id}`;
                        const gammeSlug =
                          location.pathname
                            .split("/")
                            .pop()
                            ?.replace(".html", "") || "";
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
                            vehicle.type.type_alias ||
                            normalizeAlias(vehicle.type.type_name),
                        });
                        const vehicleLabel = `${vehicle.brand.marque_name} ${vehicle.model.modele_name} ${vehicle.type.type_name}`;
                        trackSelectorComplete(
                          data.content?.pg_name || "unknown",
                          vehicleLabel,
                        );
                        trackSelectorCTA(
                          data.content?.pg_name || "unknown",
                          vehicleLabel,
                        );
                        navigate(
                          `/pieces/${gammeSlug}/${brandSlug}/${modelSlug}/${typeSlug}.html`,
                        );
                      }}
                    />
                    <p className="text-center mt-3 text-white/60 text-sm">
                      Vous avez votre carte grise ?{" "}
                      <button
                        onClick={() =>
                          document
                            .getElementById("compatibility-check")
                            ?.scrollIntoView({ behavior: "smooth" })
                        }
                        className="text-white/90 underline underline-offset-4 hover:text-white"
                      >
                        Identifier par CNIT / Type Mine
                      </button>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </HeroTransaction>

      {/* ✅ Bloc compatibilité — réassurance avant catalogue */}
      <PageSection
        {...sectionAttr(R1Section.COMPAT)}
        className="py-4 sm:py-6"
        id="compatibility-check"
      >
        <Suspense
          fallback={
            <div className="h-24 bg-gray-50 animate-pulse motion-reduce:animate-none rounded-lg" />
          }
        >
          <Await resolve={data.motorisations}>
            {(motorisations) => (
              <CompatibilityConfirmationBlock
                selectedVehicle={selectedVehicle}
                motorisationItems={motorisations?.items || []}
                gammeName={
                  data.content?.pg_name?.toLowerCase() || "pièces auto"
                }
                periodeRange={periodeRange}
                gammeId={data.gammeId}
              />
            )}
          </Await>
        </Suspense>
      </PageSection>

      {/* Comment choisir en 15s — 4 étapes sélection véhicule */}
      <PageSection
        {...sectionAttr(R1Section.QUICK_STEPS)}
        maxWidth="5xl"
        className="py-4 sm:py-6"
      >
        <R1QuickSteps
          gammeName={data.content?.pg_name?.toLowerCase() || "pièce"}
        />
      </PageSection>

      {/* R1 micro-bloc: texte SEO utile (court) */}
      <PageSection
        {...sectionAttr(R1Section.BUY_ARGS)}
        maxWidth="5xl"
        className="py-6 sm:py-8"
      >
        {(() => {
          const imageConfig = data.content?.pg_pic
            ? getSectionImageConfig("transaction", "buyingGuide")
            : undefined;

          // LCP STREAMING: proofs depuis proofData (sync, extrait dans le loader)
          const proofs =
            data.proofData && data.proofData.vehicleCount > 0
              ? {
                  topMarques: data.proofData.topMarques,
                  topEquipementiers: data.proofData.topEquipementiers,
                  periodeRange: data.proofData.periodeRange,
                  vehicleCount: data.proofData.vehicleCount,
                  topMotorCodes: data.proofData.topMotorCodes,
                }
              : undefined;

          const r1Block = (
            <R1ReusableContent
              gammeName={data.content?.pg_name || "pièces auto"}
              familleName={data.famille?.mf_name || ""}
              alias={data.content?.pg_alias || ""}
              reference={data.reference}
              proofs={proofs}
              microSeoBlock={data.purchaseGuideData?.microSeoBlock}
            />
          );

          return imageConfig && data.content?.pg_pic ? (
            <SectionWithImage>
              <SectionImage
                src={data.content.pg_pic}
                alt={resolveAltText("transaction", data.content?.pg_name)}
                placement={imageConfig.placement}
                size={imageConfig.size}
              />
              {r1Block}
            </SectionWithImage>
          ) : (
            r1Block
          );
        })()}
      </PageSection>

      {/* Preuves en chiffres — stats visuelles compactes */}
      {data.proofData && data.proofData.vehicleCount > 0 && (
        <PageSection
          {...sectionAttr(R1Section.PROOF_STATS)}
          maxWidth="5xl"
          className="py-4 sm:py-6"
        >
          <R1ProofStats
            vehicleCount={data.proofData.vehicleCount}
            topMarques={data.proofData.topMarques}
            periodeRange={data.proofData.periodeRange}
            topEquipementiers={data.proofData.topEquipementiers}
          />
        </PageSection>
      )}

      {/* 🚗 Badge véhicule actif (si présent) */}
      {selectedVehicle && (
        <PageSection className="py-4 sm:py-4">
          <VehicleFilterBadge
            vehicle={selectedVehicle}
            onClear={() => setSelectedVehicle(null)}
            showDetails={true}
          />
        </PageSection>
      )}

      {/* Motorisations compatibles */}
      <PageSection
        {...sectionAttr(R1Section.MOTORISATIONS)}
        bg="slate"
        id="compatibilities"
        className="scroll-mt-20"
      >
        <Reveal>
          <Suspense
            fallback={
              <div className="h-96 bg-gray-50 animate-pulse motion-reduce:animate-none rounded-lg" />
            }
          >
            <Await resolve={data.motorisations}>
              {(motorisations) => (
                <MotorisationsSection
                  motorisations={motorisations}
                  familleColor={familleColor}
                  familleName={data.content?.pg_name || "pièces"}
                  totalCount={data.performance?.motorisations_count}
                  compatibilitiesIntro={
                    data.purchaseGuideData?.compatibilitiesIntro ?? undefined
                  }
                />
              )}
            </Await>
          </Suspense>
        </Reveal>
      </PageSection>

      {/* ✅ Tableau safe : vérifications compatibilité avant commande */}
      <PageSection {...sectionAttr(R1Section.SAFE_TABLE)} className="py-6">
        <Suspense
          fallback={
            <div className="h-32 bg-gray-50 animate-pulse motion-reduce:animate-none rounded-lg" />
          }
        >
          <SafeCompatTable
            rows={data.purchaseGuideData?.safeTableRows ?? undefined}
            gammeName={data.content?.pg_name}
          />
        </Suspense>
      </PageSection>

      {/* Erreurs fréquentes de compatibilité — checklist */}
      <PageSection
        {...sectionAttr(R1Section.COMPAT_ERRORS)}
        maxWidth="5xl"
        className="py-4 sm:py-6"
      >
        <R1CompatErrors
          compatErrors={data.purchaseGuideData?.compatErrors}
          gammeName={data.content?.pg_name?.toLowerCase() || "pièce"}
        />
      </PageSection>

      {/* 🔧 Équipementiers — DarkSection navy */}
      <DarkSection {...sectionAttr(R1Section.EQUIPEMENTIERS)}>
        <div className="space-y-12">
          <div id="brands" className="scroll-mt-20">
            <SectionHeader
              title="Marques équipementières de confiance"
              sub={
                data.purchaseGuideData?.equipementiersLine ||
                "Fabricants OE et qualité premium"
              }
              dark
            />
            <Reveal delay={100}>
              <Suspense
                fallback={
                  <div className="h-48 bg-white/5 animate-pulse motion-reduce:animate-none rounded-lg" />
                }
              >
                <Await resolve={data.equipementiers}>
                  {(equipementiers) => (
                    <EquipementiersSection
                      equipementiers={equipementiers}
                      isDarkMode
                      maxItems={5}
                    />
                  )}
                </Await>
              </Suspense>
            </Reveal>
          </div>
        </div>
      </DarkSection>

      {/* 📦 Catalogue Même Famille */}
      <PageSection
        {...sectionAttr(R1Section.CATALOGUE)}
        id="family"
        className="scroll-mt-20"
      >
        <Reveal>
          <Suspense
            fallback={
              <div className="h-48 bg-gray-50 animate-pulse motion-reduce:animate-none rounded-lg" />
            }
          >
            <Await resolve={data.catalogueMameFamille}>
              {(catalogueMameFamille) => (
                <Await resolve={data.seoSwitches}>
                  {(seoSwitches) => (
                    <CatalogueSection
                      catalogueMameFamille={catalogueMameFamille}
                      verbSwitches={seoSwitches?.verbs?.map(
                        (v: { id: string; content: string }) => ({
                          id: v.id,
                          content: v.content,
                        }),
                      )}
                      intro={data.purchaseGuideData?.familyCrossSellIntro}
                    />
                  )}
                </Await>
              )}
            </Await>
          </Suspense>
        </Reveal>
      </PageSection>

      {/* FAQ R1 — questions universelles sur le sélecteur véhicule */}
      <PageSection
        {...sectionAttr(R1Section.FAQ)}
        bg="slate"
        id="faq"
        className="scroll-mt-20"
      >
        <Reveal>
          <Suspense
            fallback={
              <div className="h-48 bg-slate-100 animate-pulse motion-reduce:animate-none rounded-lg" />
            }
          >
            <FAQSection
              faq={(data.purchaseGuideData?.faq?.length
                ? data.purchaseGuideData.faq
                : R1_SELECTOR_FAQ
              ).slice(0, 6)}
              gammeName={data.content?.pg_name || "cette pièce"}
              withJsonLd={false}
            />
          </Suspense>
        </Reveal>
      </PageSection>

      {/* Bouton Scroll To Top */}
      <ScrollToTop />

      {/* 📱 Barre sticky mobile - CTA sélection véhicule + compatibilités */}
      <MobileStickyBar
        gammeName={data.content?.pg_name}
        hasCompatibilities={(data.proofData?.vehicleCount || 0) > 0}
        hasFaq={
          !!(data.purchaseGuideData?.faq?.length || R1_SELECTOR_FAQ?.length)
        }
      />

      {/* Spacer pour éviter que le contenu soit masqué par la sticky bar */}
      <div className="h-20 md:hidden" />
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP avec composants
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
