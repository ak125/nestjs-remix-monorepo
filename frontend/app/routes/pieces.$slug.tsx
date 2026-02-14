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
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useNavigation,
  useLocation,
  useNavigate,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { CheckCircle2, Truck, Shield, Users, BookOpen } from "lucide-react";

// SEO Page Role (Phase 5 - Quasi-Incopiable)
import { useEffect, lazy, Suspense } from "react";
// 🆕 V2 UX Components

import { Breadcrumbs } from "../components/layout/Breadcrumbs";
// 🚀 LCP OPTIMIZATION: Lazy load below-fold components (économie ~200-400ms)
// Ces sections ne sont pas visibles au premier paint - différer leur chargement
// SEO Components - HtmlContent pour maillage interne
import { HtmlContent } from "../components/seo/HtmlContent";
import { SEOHelmet, type BreadcrumbItem } from "../components/ui/SEOHelmet";
import { VehicleFilterBadge } from "../components/vehicle/VehicleFilterBadge";
import VehicleSelector from "../components/vehicle/VehicleSelector";
import { hierarchyApi } from "../services/api/hierarchy.api";
// Note: generateGammeMeta supprimé - on utilise maintenant data.meta du backend
import { normalizeAlias } from "../utils/url-builder.utils";
import {
  getVehicleFromCookie,
  buildBreadcrumbWithVehicle,
  storeVehicleClient,
  type VehicleCookie,
} from "../utils/vehicle-cookie";
import { ScrollToTop } from "~/components/blog/ScrollToTop";
import { Error404 } from "~/components/errors/Error404";
import MobileStickyBar from "~/components/pieces/MobileStickyBar";
import TableOfContents from "~/components/pieces/TableOfContents";
import { pluralizePieceName } from "~/lib/seo-utils";
import { fetchGammePageData } from "~/services/api/gamme-api.service";
import { type GammeBuyingGuideV1 } from "~/types/gamme-content-contract.types";
import {
  applySectionFallbacks,
  validateGammeContract,
} from "~/utils/gamme-contract-qa.utils";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

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
// Guide d'achat V2 - structure orientée client (intro/risk/timing/arguments)
const PurchaseGuideSection = lazy(() =>
  import("../components/seo/PurchaseGuideSection").then((m) => ({
    default: m.PurchaseGuideSection,
  })),
);
const QuickGuideSection = lazy(() =>
  import("../components/pieces/QuickGuideSection").then((m) => ({
    default: m.default,
  })),
);
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
const ConseilsSection = lazy(() =>
  import("../components/pieces/ConseilsSection").then((m) => ({
    default: m.default,
  })),
);
const InformationsSection = lazy(() =>
  import("../components/pieces/InformationsSection").then((m) => ({
    default: m.default,
  })),
);

// 📖 Nouvelles sections SEO V2 (howToChoose, symptoms, FAQ)
const HowToChooseSection = lazy(() =>
  import("../components/seo/HowToChooseSection").then((m) => ({
    default: m.HowToChooseSection,
  })),
);
const SymptomsSection = lazy(() =>
  import("../components/seo/SymptomsSection").then((m) => ({
    default: m.SymptomsSection,
  })),
);
const AntiMistakesSection = lazy(() =>
  import("../components/seo/AntiMistakesSection").then((m) => ({
    default: m.AntiMistakesSection,
  })),
);
const FAQSection = lazy(() =>
  import("../components/seo/FAQSection").then((m) => ({
    default: m.FAQSection,
  })),
);

// 🎯 Encart anti-doute / réassurance conversion
const UXMessageBox = lazy(() =>
  import("../components/seo/UXMessageBox").then((m) => ({
    default: m.UXMessageBox,
  })),
);

interface LoaderData {
  status: number;
  selectedVehicle?: VehicleCookie | null;
  meta?: {
    title: string;
    description: string;
    keywords: string;
    robots: string;
    canonical: string;
    relfollow?: number;
  };
  breadcrumbs?: {
    items: Array<{
      label: string;
      href: string;
      current?: boolean;
    }>;
  };
  famille?: {
    mf_id: number;
    mf_name: string;
    mf_pic: string;
  };
  performance?: {
    total_time_ms: number;
    parallel_time_ms?: number;
    rpc_time_ms?: number;
    motorisations_count: number;
    catalogue_famille_count?: number;
    equipementiers_count?: number;
    conseils_count?: number;
    informations_count?: number;
    guide_available?: number;
    buying_guide_available?: number;
    buying_guide_source_verified?: number;
    buying_guide_quality_score?: number;
    buying_guide_fallback_used?: number;
    buying_guide_gate_ok?: number;
    buying_guide_gate_reasons?: string | null;
  };
  content?: {
    h1: string;
    content: string;
    pg_name: string;
    pg_alias: string;
    pg_pic: string;
    pg_wall: string;
  };
  guide?: {
    id: number;
    title: string;
    alias: string;
    preview: string;
    wall: string;
    date: string;
    image: string;
    link: string;
    h2_content?: string;
  };
  motorisations?: {
    title: string;
    items: Array<{
      title: string;
      description: string;
      image: string;
      link: string;
      marque_name: string;
      modele_name: string;
      type_name: string;
      puissance: string;
      periode: string;
      advice: string;
    }>;
  };
  catalogueMameFamille?: {
    title: string;
    items: Array<{
      name: string;
      link: string;
      image: string;
      description: string;
      meta_description: string;
      sort?: number;
    }>;
  };
  equipementiers?: {
    title: string;
    items: Array<{
      pm_id: number;
      pm_name: string;
      pm_logo: string;
      title: string;
      image: string;
      description: string;
    }>;
  };
  conseils?: {
    title: string;
    content: string;
    items: Array<{
      id: number;
      title: string;
      content: string;
    }>;
  };
  informations?: {
    title: string;
    content: string;
    items: string[];
  };
  // 🔗 SEO Switches pour maillage interne (ancres variées)
  seoSwitches?: {
    verbs: Array<{ id: string; content: string }>;
    nouns: Array<{ id: string; content: string }>;
    verbCount: number;
    nounCount: number;
  };
  // 🛒 Contrat orienté achat (nouvelle source de vérité data)
  gammeBuyingGuide?: GammeBuyingGuideV1 | null;
  // 🔄 Données de substitution (Moteur 200 Always)
  substitution?: {
    httpStatus: number;
    robots?: string;
    seo?: {
      canonical?: string;
    };
    lock?: {
      type: "vehicle" | "technology" | "ambiguity" | "precision";
      missing: string;
      known: {
        gamme?: { id: number; name: string; alias: string };
        marque?: { id: number; name: string };
        modele?: { id: number; name: string };
      };
      options: Array<{
        id: number;
        label: string;
        url: string;
        description?: string;
      }>;
    };
    substitute?: {
      piece_id: number;
      name: string;
      price: number;
      priceFormatted?: string;
      image?: string;
      brand?: string;
      ref?: string;
      url: string;
    };
    relatedParts?: Array<{
      pg_id: number;
      pg_name: string;
      pg_alias: string;
      pg_pic?: string;
      url: string;
    }>;
  } | null;
}

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

function buildNoindexErrorResponse(status: 404 | 410): Response {
  return new Response(status === 404 ? "Not Found" : "Gone", {
    status,
    headers: { "X-Robots-Tag": "noindex, follow" },
  });
}

function buildUpstreamErrorResponse(rawStatus: number): Response {
  const status = rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  if (status === 404 || status === 410) {
    return buildNoindexErrorResponse(status);
  }
  if (status === 503) {
    return new Response("Service Unavailable", { status });
  }
  return new Response("Internal Server Error", { status });
}

function resolveGammeId(
  slug: string,
  substitutionResponse: LoaderData["substitution"] | null | undefined,
): string | null {
  // 1) Source backend: lock.known.gamme.id
  const knownGammeId = substitutionResponse?.lock?.known?.gamme?.id;
  if (typeof knownGammeId === "number") return String(knownGammeId);

  // 2) Source backend: seo.canonical
  const canonical = substitutionResponse?.seo?.canonical;
  if (canonical) {
    const canonicalMatch = canonical.match(/-(\d+)\.html$/);
    if (canonicalMatch?.[1]) return canonicalMatch[1];
  }

  // 3) Format local slug: /pieces/alias-123.html
  const slugMatch = slug.match(/-(\d+)\.html$/);
  if (slugMatch?.[1]) return slugMatch[1];

  return null;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) {
    throw new Response("Not Found", { status: 404 });
  }

  // /pieces/catalogue: page supprimée sans équivalent direct
  // On renvoie 410 + noindex pour éviter un soft-404 vers une page non pertinente
  if (slug === "catalogue") {
    throw buildNoindexErrorResponse(410);
  }

  try {
    // 🚀 Configuration API depuis variables d'environnement
    // ⚠️ Timeout réduit de 180s à 30s pour compatibilité Googlebot (~30s patience)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const API_URL = getInternalApiUrl("");
      const currentUrl = new URL(request.url);
      const pathname = currentUrl.pathname;

      // 1) Source de vérité statuts métier: API substitution
      const [selectedVehicle, substitutionResponse] = await Promise.all([
        getVehicleFromCookie(request.headers.get("Cookie")),
        fetch(
          `${API_URL}/api/substitution/check?url=${encodeURIComponent(pathname)}`,
          { signal: controller.signal },
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ]);

      logger.log(
        "🚗 Véhicule depuis cookie:",
        selectedVehicle
          ? `${selectedVehicle.marque_name} ${selectedVehicle.modele_name}`
          : "Aucun véhicule sélectionné",
      );

      if (substitutionResponse) {
        logger.log(
          `🔄 Substitution API: httpStatus=${substitutionResponse.httpStatus}, lock=${substitutionResponse.lock?.type || "none"}`,
        );
      }

      if (substitutionResponse?.httpStatus === 404) {
        throw buildNoindexErrorResponse(404);
      }
      if (substitutionResponse?.httpStatus === 410) {
        throw buildNoindexErrorResponse(410);
      }

      // 2) Résoudre gammeId depuis backend (fallback slug/canonical)
      const gammeId = resolveGammeId(slug, substitutionResponse);
      if (!gammeId) {
        logger.error(
          `❌ Impossible de résoudre gammeId pour /pieces/${slug} (substitution=200)`,
        );
        throw new Response("Service Unavailable", { status: 503 });
      }

      // 3) Charger données page + switches SEO
      const [apiData, switchesResponse] = await Promise.all([
        fetchGammePageData(gammeId, { signal: controller.signal }),
        fetch(`${API_URL}/api/blog/seo-switches/${gammeId}`, {
          signal: controller.signal,
        })
          .then((res) => (res.ok ? res.json() : { data: [] }))
          .catch(() => ({ data: [] })),
      ]);

      const upstreamStatus = (apiData as { status?: number }).status;
      const apiStatus =
        typeof upstreamStatus === "number" ? upstreamStatus : 200;
      if (apiStatus !== 200) {
        throw buildUpstreamErrorResponse(apiStatus);
      }

      // 🔗 Mapper les switches SEO pour ancres variées
      interface SeoSwitch {
        sis_id: string;
        sis_alias?: string;
        sis_content: string;
      }
      const rawSwitches: SeoSwitch[] = switchesResponse?.data || [];
      const verbSwitches = rawSwitches
        .filter(
          (s) =>
            s.sis_alias?.startsWith("verb_") || s.sis_alias?.includes("action"),
        )
        .map((s) => ({ id: s.sis_id, content: s.sis_content }));
      const nounSwitches = rawSwitches
        .filter(
          (s) =>
            s.sis_alias?.startsWith("noun_") ||
            !s.sis_alias?.startsWith("verb_"),
        )
        .map((s) => ({ id: s.sis_id, content: s.sis_content }));

      const seoSwitches =
        rawSwitches.length > 0
          ? {
              verbs:
                verbSwitches.length > 0
                  ? verbSwitches
                  : rawSwitches.map((s) => ({
                      id: s.sis_id,
                      content: s.sis_content,
                    })),
              nouns: nounSwitches,
              verbCount: verbSwitches.length || rawSwitches.length,
              nounCount: nounSwitches.length,
            }
          : undefined;

      logger.log(
        `🔗 SEO Switches chargés: ${rawSwitches.length} (verbs: ${seoSwitches?.verbCount || 0})`,
      );

      // 🔄 Mapper les données de l'API RPC V2 vers le format attendu par le frontend
      const heroData = apiData.hero as
        | {
            h1: string;
            content: string;
            image: string;
            wall: string;
            famille_info?: { mf_id: number; mf_name: string; mf_pic: string };
            pg_name?: string;
            pg_alias?: string;
          }
        | undefined;

      // Note: API returns different shapes than LoaderData, using type assertion for compatibility
      const data = {
        ...apiData,
        status: apiStatus,
        content: heroData
          ? {
              h1: heroData.h1,
              content: heroData.content,
              pg_name: heroData.pg_name || heroData.famille_info?.mf_name || "",
              pg_alias: heroData.pg_alias || "",
              pg_pic: toProxyImageUrl(heroData.image),
              pg_wall: toProxyImageUrl(heroData.wall),
            }
          : undefined,
        famille: apiData.hero?.famille_info,
        guide: apiData.guideAchat
          ? {
              ...apiData.guideAchat,
              date: apiData.guideAchat.updated,
            }
          : undefined,
      } as unknown as LoaderData;

      // Mode E2E deterministe (non prod): simuler les cas guide absent / source non verifiee
      const e2eGuideMode = currentUrl.searchParams.get("__e2eBuyingGuide");
      if (process.env.NODE_ENV !== "production") {
        if (e2eGuideMode === "absent") {
          data.gammeBuyingGuide = null;
        } else if (e2eGuideMode === "unverified" && data.gammeBuyingGuide) {
          data.gammeBuyingGuide = {
            ...data.gammeBuyingGuide,
            quality: {
              ...(data.gammeBuyingGuide.quality || {
                score: 0,
                flags: [],
                version: "GammeBuyingGuide.v1",
                source: "db:test-unverified",
              }),
              source:
                data.gammeBuyingGuide.quality?.source || "db:test-unverified",
              verified: false,
            },
          };
        }
      }

      // 🛡️ QA hook contrat gamme: fallback sectionnel sans toucher au H1
      const contractInput = data.gammeBuyingGuide || null;
      if (!contractInput) {
        logger.warn(
          `🧯 Aucun gammeBuyingGuide exploitable (gamme=${gammeId}), sections guide masquées`,
        );
      }
      const qc = validateGammeContract(contractInput, {
        famille: data.famille,
        pgName: data.content?.pg_name,
      });
      const missingSourceProvenance = qc.flags.includes(
        "MISSING_SOURCE_PROVENANCE",
      );
      const isBackendFallback =
        data.performance?.buying_guide_fallback_used === 1 ||
        contractInput?.quality?.source?.startsWith("fallback://");
      const forceStrictSourceGate = e2eGuideMode === "unverified";
      const safeBuyingGuide =
        missingSourceProvenance && (forceStrictSourceGate || !isBackendFallback)
          ? null
          : applySectionFallbacks(contractInput, qc);
      data.gammeBuyingGuide = safeBuyingGuide;

      if (
        missingSourceProvenance &&
        (forceStrictSourceGate || !isBackendFallback)
      ) {
        logger.warn(
          `🛡️ QA contrat gamme rejeté: provenance source manquante/non fiable (gamme=${gammeId})`,
        );
      } else if (missingSourceProvenance && isBackendFallback) {
        logger.warn(
          `🛡️ QA contrat gamme: provenance non vérifiée acceptée car fallback backend explicite (gamme=${gammeId})`,
        );
      }

      logger.log(
        `🛡️ QA contrat gamme: score=${qc.score}, flags=${qc.flags.join(",") || "none"}`,
      );

      // 🍞 Construire breadcrumb de base (sans niveau "Pièces" intermédiaire)
      const baseBreadcrumb = [
        { label: "Accueil", href: "/" },
        { label: data.content?.pg_name || "Pièce", current: true },
      ];

      // 🍞 Pour les pages gamme seules, NE PAS inclure le véhicule du cookie
      // (évite hydration mismatch serveur/client)
      const breadcrumbItems = buildBreadcrumbWithVehicle(
        baseBreadcrumb,
        null, // Pas de véhicule sur page gamme seule
      );

      logger.log(
        "🍞 Breadcrumb généré:",
        breadcrumbItems.map((i) => i.label).join(" → "),
      );

      const successRobotsTag =
        data.meta?.robots || "index, follow, max-image-preview:large";

      // Retourner data avec breadcrumb mis à jour, véhicule, switches SEO, substitution et prix
      return json(
        {
          ...data,
          breadcrumbs: { items: breadcrumbItems },
          selectedVehicle,
          seoSwitches,
          substitution: substitutionResponse,
        },
        {
          headers: {
            "Cache-Control":
              "public, max-age=3600, stale-while-revalidate=86400",
            "X-Robots-Tag": successRobotsTag,
          },
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Propager les Response HTTP (404, etc.) telles quelles
    if (error instanceof Response) {
      throw error;
    }
    logger.error("Erreur lors du chargement des données:", error);
    throw new Response("Internal Server Error", { status: 500 });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data || data.status !== 200) {
    return [
      { title: "Page non trouvée" },
      { name: "description", content: "La page demandée n'a pas été trouvée." },
      { name: "robots", content: "noindex, follow" },
    ];
  }

  // Construire l'URL canonique
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;

  // ✅ Utiliser les données SEO du backend (priorité absolue)
  // Les titres/descriptions viennent de __seo_gamme_car via l'API RPC
  const title = data.meta?.title || data.content?.pg_name || "Pièces Auto";
  const description =
    data.meta?.description ||
    `${data.content?.pg_name || "Pièces"} de qualité au meilleur prix.`;
  const keywords =
    data.meta?.keywords || data.content?.pg_name?.toLowerCase() || "";

  // 📊 Schema @graph pour page catégorie/recherche - CollectionPage + ItemList
  // Note: Pas de schéma Product car c'est une page de recherche sans prix affichés
  // Les pages avec prix (véhicule+gamme) utilisent pieces.$gamme.$marque.$modele.$type[.]html.tsx
  const gammeSchema = data.content?.pg_name
    ? {
        "@context": "https://schema.org",
        "@graph": [
          // 1️⃣ CollectionPage - La page catalogue de cette gamme
          {
            "@type": "CollectionPage",
            "@id": canonicalUrl,
            name: data.content.pg_name,
            description: description,
            url: canonicalUrl,
            mainEntity: { "@id": `${canonicalUrl}#list` },
            ...(data.content.pg_pic && { image: data.content.pg_pic }),
            // Breadcrumb pour navigation
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Accueil",
                  item: "https://www.automecanik.com",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Pièces Auto",
                  item: "https://www.automecanik.com/pieces",
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: data.content.pg_name,
                  item: canonicalUrl,
                },
              ],
            },
          },
          // 2️⃣ ItemList - Liste des véhicules/motorisations compatibles (liens vers pages produits)
          {
            "@type": "ItemList",
            "@id": `${canonicalUrl}#list`,
            name: `${data.content.pg_name} - Véhicules compatibles`,
            numberOfItems: data.motorisations?.items?.length || 0,
            itemListElement: (data.motorisations?.items || [])
              .slice(0, 15)
              .map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: `${data.content?.pg_name} ${item.marque_name} ${item.modele_name} ${item.type_name}`,
                url: item.link
                  ? `https://www.automecanik.com${item.link}`
                  : canonicalUrl,
              })),
          },
        ],
      }
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

  // Keywords
  if (keywords) {
    result.push({ name: "keywords", content: keywords });
  }

  // Open Graph
  result.push({ property: "og:title", content: title });
  result.push({ property: "og:description", content: description });
  result.push({ property: "og:url", content: canonicalUrl });
  result.push({ property: "og:type", content: "website" });

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

  // 🚀 LCP OPTIMIZATION: Preload hero image pour réduire LCP
  if (data.content?.pg_wall) {
    result.push({
      tagName: "link",
      rel: "preload",
      as: "image",
      href: data.content.pg_wall,
    });
  } else if (data.content?.pg_pic) {
    result.push({
      tagName: "link",
      rel: "preload",
      as: "image",
      href: data.content.pg_pic,
    });
  }

  return result;
};

export function headers({
  loaderHeaders,
  errorHeaders,
}: {
  loaderHeaders: Headers;
  errorHeaders: Headers | undefined;
}) {
  const cacheControl =
    loaderHeaders.get("Cache-Control") ||
    "public, max-age=3600, stale-while-revalidate=86400";
  const robotsTag =
    errorHeaders?.get("X-Robots-Tag") || loaderHeaders.get("X-Robots-Tag");

  return robotsTag
    ? {
        "Cache-Control": cacheControl,
        "X-Robots-Tag": robotsTag,
      }
    : {
        "Cache-Control": cacheControl,
      };
}

export default function PiecesDetailPage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const location = useLocation();
  const navigate = useNavigate();

  // Afficher un indicateur de chargement si les données sont en cours de chargement
  const isLoading = navigation.state === "loading";

  useEffect(() => {
    if (isLoading) {
      logger.log("⏳ Chargement des données en cours...");
    }
  }, [isLoading]);

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
  const breadcrumbs: BreadcrumbItem[] = data.breadcrumbs?.items.map((item) => ({
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

  // 📋 Préparer ItemList schema pour SEO (liste des motorisations/produits)
  const itemListData =
    data.motorisations?.items && data.motorisations.items.length > 0
      ? {
          name: `${data.content?.pg_name || "Pièces"} - Véhicules compatibles`,
          description: `Liste des ${data.motorisations.items.length} véhicules compatibles avec ${data.content?.pg_name || "cette pièce"}`,
          items: data.motorisations.items.slice(0, 50).map((item, index) => ({
            name: `${item.title} - ${item.marque_name} ${item.modele_name}`,
            url: item.link,
            description: item.description,
            position: index + 1,
          })),
        }
      : undefined;
  const buyingGuide = data.gammeBuyingGuide || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* ⏳ Indicateur de chargement global */}
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-semantic-info animate-pulse">
          <div className="h-full bg-gradient-to-r from-semantic-info via-secondary-500 to-semantic-info bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]"></div>
        </div>
      )}

      {/* SEO avec schemas JSON-LD enrichis */}
      <SEOHelmet
        seo={{
          title: data.meta?.title || "",
          description: data.meta?.description || "",
          canonicalUrl: data.meta?.canonical,
          keywords: data.meta?.keywords ? [data.meta.keywords] : undefined,
          breadcrumbs,
          organization: {
            name: "Automecanik",
            logo: "https://www.automecanik.com/logo.png",
            url: "https://www.automecanik.com",
            contactPoint: {
              telephone: "+33-1-XX-XX-XX-XX",
              contactType: "Service Client",
              email: "contact@automecanik.com",
            },
            sameAs: [
              "https://www.facebook.com/automecanik",
              "https://twitter.com/automecanik",
            ],
          },
          itemList: itemListData,
        }}
      />

      {/* Breadcrumbs visuels */}
      <div className="container mx-auto px-4 pt-4">
        <Breadcrumbs items={breadcrumbs} enableSchema={false} />
      </div>

      {/* 🎯 HERO SECTION - Avec couleur de la famille */}
      <section
        className={`relative overflow-hidden bg-gradient-to-br ${familleColor} text-white py-12 md:py-16 lg:py-20`}
        aria-label="Sélection véhicule"
      >
        {/* Image wallpaper en arrière-plan (si disponible) */}
        {data.content?.pg_wall && (
          <div className="absolute inset-0 z-0">
            <img
              src={data.content.pg_wall}
              alt={data.content.pg_name || ""}
              width={1920}
              height={400}
              className="w-full h-full object-cover opacity-25"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                e.currentTarget.src = "/images/placeholder-hero.webp";
                e.currentTarget.onerror = null;
              }}
            />
            {/* Overlay gradient pour assurer la lisibilité du texte */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-transparent"></div>
          </div>
        )}

        {/* Effet mesh gradient adaptatif */}
        <div
          className="absolute inset-0 z-[1] opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 50%),
                             radial-gradient(circle at 75% 75%, rgba(0,0,0,0.15) 0%, transparent 50%)`,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 z-[1] opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px),
                             linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)`,
            backgroundSize: "3rem 3rem",
          }}
          aria-hidden="true"
        />

        {/* Formes décoratives organiques - animations retirées pour LCP */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 bg-white/[0.07] rounded-full blur-3xl z-[1]"
          aria-hidden="true"
        ></div>
        <div
          className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-black/[0.08] rounded-full blur-3xl z-[1]"
          aria-hidden="true"
        ></div>

        <div className="relative z-10 container mx-auto px-4 max-w-7xl">
          {/* Badges contextuels en haut */}
          <div className="flex flex-wrap justify-center items-center gap-3 mb-6 md:mb-8 animate-in fade-in duration-700">
            {data.famille && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-lg">
                <div
                  className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${familleColor} animate-pulse shadow-lg`}
                ></div>
                <span className="text-white/95 font-semibold text-sm tracking-wide">
                  {data.famille.mf_name}
                </span>
              </div>
            )}
            {data.famille?.mf_name.toLowerCase().includes("frein") && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-lg">
                <Shield className="w-4 h-4 text-red-300" />
                <span className="text-white/95 text-sm font-semibold">
                  Votre sécurité est notre priorité
                </span>
              </div>
            )}
          </div>

          {/* Titre H1 dynamique optimisé SEO */}
          <div className="text-center mb-6 md:mb-8 animate-in fade-in duration-700 delay-100">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-white via-white to-white/90 bg-clip-text text-transparent drop-shadow-2xl">
                {(() => {
                  // Priorité: h1 CMS/DB > fallback
                  const rawH1 =
                    data.content?.h1 ||
                    `${data.content?.pg_name || "Pièces auto"} pas cher`;
                  // Nettoyer les balises HTML (<b>, </b>, etc.)
                  return rawH1.replace(/<[^>]*>/g, "");
                })()}
              </span>
            </h1>
          </div>

          {/* 🎯 Encart anti-doute / réassurance - lève le verrou mental avant sélection */}
          <Suspense fallback={null}>
            <UXMessageBox
              gammeName={data.content?.pg_name}
              className="mt-6 mb-4"
            />
          </Suspense>

          {/* Cadre glassmorphism contenant Image + VehicleSelector */}
          <div className="max-w-5xl mx-auto mb-8 md:mb-10 animate-in fade-in duration-1000 delay-200">
            <div className="bg-gradient-to-br from-white/[0.18] to-white/[0.10] backdrop-blur-xl rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.4)] p-6 md:p-8 border border-white/30 hover:border-white/50 transition-all duration-500">
              {/* Sous-titre dynamique en haut du cadre */}
              <div className="text-center mb-6">
                <p className="text-white/95 text-base md:text-lg font-semibold drop-shadow-lg">
                  {(() => {
                    const name = data.content?.pg_name?.toLowerCase() || "";
                    const pluralName = pluralizePieceName(name);
                    return name
                      ? `On affiche uniquement les ${pluralName} compatibles avant/arriere pour votre vehicule`
                      : "Trouvez la référence compatible avec votre véhicule";
                  })()}
                </p>
              </div>

              {/* Layout horizontal : Image + VehicleSelector côte à côte */}
              <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
                {/* Image produit à gauche */}
                <div className="flex-shrink-0 w-full lg:w-80">
                  <div className="relative group">
                    {/* Cercle décoratif arrière-plan */}
                    <div className="absolute inset-0 -z-10">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-white/10 rounded-full blur-3xl group-hover:bg-white/15 transition-all duration-700"></div>
                    </div>

                    {/* Container image */}
                    <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg group-hover:border-white/40 transition-all duration-500">
                      <div className="w-full aspect-square flex items-center justify-center">
                        <img
                          src={
                            data.content?.pg_pic ||
                            "/images/categories/default.svg"
                          }
                          alt={data.content?.pg_name || "Pièce auto"}
                          width={400}
                          height={400}
                          className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-105 transition-all duration-700"
                          loading="eager"
                          decoding="async"
                          fetchPriority="high"
                          onError={(e) => {
                            e.currentTarget.src =
                              "/images/categories/default.svg";
                            e.currentTarget.onerror = null;
                          }}
                        />
                      </div>
                    </div>

                    {/* Particule décorative - animation retirée pour LCP */}
                    <div
                      className="absolute -bottom-4 -right-4 w-10 h-10 bg-white/15 rounded-full blur-xl"
                      aria-hidden="true"
                    ></div>
                  </div>
                </div>

                {/* VehicleSelector à droite */}
                <div
                  id="vehicle-selector"
                  className="flex-1 w-full animate-in fade-in slide-in-from-right duration-1000 delay-400"
                >
                  <VehicleSelector
                    enableTypeMineSearch={true}
                    context="pieces"
                    redirectOnSelect={false}
                    onVehicleSelect={(vehicle) => {
                      // Construire les slugs avec format alias-id
                      const brandSlug = `${vehicle.brand.marque_alias || normalizeAlias(vehicle.brand.marque_name)}-${vehicle.brand.marque_id}`;
                      const modelSlug = `${vehicle.model.modele_alias || normalizeAlias(vehicle.model.modele_name)}-${vehicle.model.modele_id}`;
                      const typeSlug = `${vehicle.type.type_alias || normalizeAlias(vehicle.type.type_name)}-${vehicle.type.type_id}`;

                      // Gamme depuis l'URL actuelle
                      const gammeSlug =
                        location.pathname
                          .split("/")
                          .pop()
                          ?.replace(".html", "") || "";

                      // Sauvegarder le véhicule en cookie pour persistance
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

                      // Navigation fluide avec Remix
                      const url = `/pieces/${gammeSlug}/${brandSlug}/${modelSlug}/${typeSlug}.html`;
                      navigate(url);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Trust badges premium - Grid responsive pour mobile - Design Tokens */}
          <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-space-3 md:gap-space-4 max-w-3xl mx-auto animate-in fade-in duration-700 delay-400">
            <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">
                400 000+ pièces
              </span>
            </div>
            <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Truck className="w-4 h-4 text-primary-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">
                Livraison 24-48h
              </span>
            </div>
            <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Shield className="w-4 h-4 text-secondary-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">
                Paiement sécurisé
              </span>
            </div>
            <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Users className="w-4 h-4 text-orange-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">
                Experts gratuits
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ⚡ Bloc "Comment choisir en 20 sec" placé au-dessus de la ligne de flottaison */}
      {buyingGuide && (
        <div className="container mx-auto px-4 -mt-2 md:-mt-4 relative z-20">
          <Suspense
            fallback={
              <div className="h-48 bg-gray-50 animate-pulse rounded-lg mb-6" />
            }
          >
            <QuickGuideSection
              guide={buyingGuide}
              gammeName={data.content?.pg_name}
            />
          </Suspense>
        </div>
      )}

      {/* 📑 Sommaire ancré - Navigation rapide vers toutes les sections */}
      <div className="container mx-auto px-4 py-4">
        <TableOfContents
          gammeName={data.content?.pg_name}
          hasMotorizations={!!data.motorisations?.items?.length}
          hasSymptoms={!!buyingGuide?.symptoms?.length}
          hasAntiMistakes={!!buyingGuide?.antiMistakes?.length}
          hasGuide={!!buyingGuide}
          hasInformations={!!data.informations?.items?.length}
          hasConseils={!!data.conseils?.items?.length}
          hasEquipementiers={!!data.equipementiers?.items?.length}
          hasFaq={!!buyingGuide?.faq?.length}
          hasCatalogue={!!data.catalogueMameFamille?.items?.length}
        />
      </div>

      {/* 💡 Guide d'achat V2 complet - Contenu orienté client (pour SEO longue traîne) */}
      {buyingGuide && (
        <Suspense
          fallback={
            <div className="container mx-auto px-4 mb-space-6">
              <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
                <div className="h-12 bg-gray-200 rounded-lg w-2/3 mx-auto"></div>
                <div className="h-64 bg-gray-100 rounded-2xl"></div>
                <div className="h-96 bg-gray-100 rounded-2xl"></div>
              </div>
            </div>
          }
        >
          <PurchaseGuideSection
            guide={buyingGuide}
            gammeName={data.content?.pg_name}
            className="mb-space-6"
          />
        </Suspense>
      )}

      {/* 📖 Comment choisir - Étape 2: critères et cas d'usage */}
      {buyingGuide && (
        <Suspense
          fallback={
            <div className="h-48 bg-gray-50 animate-pulse rounded-lg" />
          }
        >
          <HowToChooseSection
            guide={buyingGuide}
            gammeName={data.content?.pg_name || "cette pièce"}
          />
        </Suspense>
      )}

      {/* 🎯 Étape 3: envoyer vers la sélection véhicule */}
      <div className="container mx-auto px-4">
        <section className="mb-8 rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 to-secondary-50 p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm md:text-base font-semibold text-neutral-900">
                Validez votre véhicule pour afficher uniquement les références
                compatibles.
              </p>
              <p className="text-sm text-neutral-600">
                Vérifiez d'abord le véhicule, puis comparez les options
                proposées pour votre configuration.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="#vehicle-selector"
                className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                Sélectionner mon véhicule
              </a>
              <a
                href="#compatibilities"
                className="inline-flex items-center rounded-lg border border-primary-300 bg-white px-4 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50"
              >
                Voir les compatibilités
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* 🚗 Motorisations compatibles - Étape 3: compatibilités filtrées */}
      <div className="container mx-auto px-4">
        <section id="compatibilities">
          <Suspense
            fallback={
              <div className="h-96 bg-gray-50 animate-pulse rounded-lg mb-8" />
            }
          >
            <MotorisationsSection
              motorisations={data.motorisations}
              familleColor={familleColor}
              familleName={data.content?.pg_name || "pièces"}
            />
          </Suspense>
        </section>
      </div>

      {/* 🚗 Badge véhicule actif (si présent) */}
      {data.selectedVehicle && (
        <div className="container mx-auto px-4 mt-4">
          <VehicleFilterBadge
            vehicle={data.selectedVehicle}
            showDetails={true}
          />
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Contenu principal de la gamme */}
        <section className="bg-white rounded-xl shadow-lg mb-6 md:mb-8 overflow-hidden">
          {/* Contenu SEO */}
          {data.content?.content && (
            <div className="p-4 md:p-6 lg:p-8">
              <HtmlContent
                html={data.content.content}
                trackLinks={true}
                className="prose prose-lg max-w-none text-neutral-700 leading-relaxed"
              />
            </div>
          )}
        </section>

        {/* 🚀 Sections below-fold lazy-loaded avec IDs pour navigation ancres */}

        {/* 📖 Symptômes d'usure - Position 5 */}
        {buyingGuide?.symptoms && buyingGuide.symptoms.length > 0 && (
          <section id="symptoms">
            <Suspense
              fallback={
                <div className="h-48 bg-gray-50 animate-pulse rounded-lg" />
              }
            >
              <SymptomsSection
                symptoms={buyingGuide.symptoms}
                gammeName={data.content?.pg_name || "cette pièce"}
              />
            </Suspense>
          </section>
        )}

        {/* ⛔ Erreurs à éviter - Position 5 bis */}
        {buyingGuide?.antiMistakes && buyingGuide.antiMistakes.length > 0 && (
          <section id="anti-mistakes">
            <Suspense
              fallback={
                <div className="h-48 bg-gray-50 animate-pulse rounded-lg" />
              }
            >
              <AntiMistakesSection
                antiMistakes={buyingGuide.antiMistakes}
                gammeName={data.content?.pg_name || "cette pièce"}
              />
            </Suspense>
          </section>
        )}

        {/* 📚 Informations essentielles - Position 6 */}
        <section id="essentials">
          <Suspense
            fallback={
              <div className="h-64 bg-gray-50 animate-pulse rounded-lg" />
            }
          >
            <InformationsSection
              informations={data.informations}
              catalogueFamille={data.catalogueMameFamille?.items}
              gammeName={data.content?.pg_name}
            />
          </Suspense>
        </section>

        {/* Glossaire */}
        <div className="flex items-center gap-2 px-4 py-3 text-sm bg-indigo-50 rounded-lg">
          <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="text-gray-600">Besoin de clarifier un terme ?</span>
          <Link
            to="/reference-auto"
            className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            Voir le glossaire
          </Link>
        </div>

        {/* 💡 Conseils d'entretien - Position 7 */}
        <section id="advice">
          <Suspense
            fallback={
              <div className="h-64 bg-gray-50 animate-pulse rounded-lg" />
            }
          >
            <ConseilsSection
              conseils={data.conseils}
              catalogueFamille={data.catalogueMameFamille?.items}
              gammeName={data.content?.pg_name}
            />
          </Suspense>
        </section>

        {/* 🔧 Équipementiers - Position 8 */}
        <section id="brands">
          <Suspense
            fallback={
              <div className="h-48 bg-gray-50 animate-pulse rounded-lg" />
            }
          >
            <EquipementiersSection equipementiers={data.equipementiers} />
          </Suspense>
        </section>

        {/* 📦 Catalogue Même Famille - Position 9 */}
        <section id="family">
          <Suspense
            fallback={
              <div className="h-48 bg-gray-50 animate-pulse rounded-lg" />
            }
          >
            <CatalogueSection
              catalogueMameFamille={data.catalogueMameFamille}
              verbSwitches={data.seoSwitches?.verbs?.map((v) => ({
                id: v.id,
                content: v.content,
              }))}
            />
          </Suspense>
        </section>

        {/* 📖 FAQ avec Schema.org - Position 10 (fin pour SEO longue traîne) */}
        {buyingGuide?.faq && buyingGuide.faq.length > 0 && (
          <section id="faq">
            <Suspense
              fallback={
                <div className="h-48 bg-gray-50 animate-pulse rounded-lg" />
              }
            >
              <FAQSection
                faq={buyingGuide.faq}
                gammeName={data.content?.pg_name || "cette pièce"}
              />
            </Suspense>
          </section>
        )}

        {/* Bouton Scroll To Top */}
        <ScrollToTop />
      </div>

      {/* 📱 Barre sticky mobile - CTA sélection véhicule + compatibilités */}
      <MobileStickyBar
        gammeName={data.content?.pg_name}
        hasCompatibilities={!!data.motorisations?.items?.length}
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
