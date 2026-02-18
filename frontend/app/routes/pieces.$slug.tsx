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
  redirect,
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
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Shield,
  Truck,
  Users,
  Wrench,
} from "lucide-react";

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
} from "../utils/vehicle-cookie";
import { ScrollToTop } from "~/components/blog/ScrollToTop";
import { Error404 } from "~/components/errors/Error404";
import DarkSection from "~/components/layout/DarkSection";
import PageSection from "~/components/layout/PageSection";
import Reveal from "~/components/layout/Reveal";
import SectionHeader from "~/components/layout/SectionHeader";
import MobileStickyBar from "~/components/pieces/MobileStickyBar";
import TableOfContents from "~/components/pieces/TableOfContents";
import { pluralizePieceName } from "~/lib/seo-utils";
import { fetchGammePageData } from "~/services/api/gamme-api.service";
import {
  type GammePageDataV1,
  GAMME_PAGE_CONTRACT_VERSION,
} from "~/types/gamme-page-contract.types";
import { parseGammePageData } from "~/utils/gamme-page-contract.utils";
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
// R1 ROUTER: ConseilsSection (R3/conseils) et InformationsSection supprimes — hors-role

// R1 ROUTER: sections hors-role supprimees (SymptomsSection=R5, AntiMistakesSection=R3, PurchaseNarrativeSection=R3)
// Voir brief: .claude/skills/seo-content-architect/references/r1-router-role.md

// 🎯 Grille de décision (B4 R2D2 — use-cases + decision tree)
const DecisionGridSection = lazy(() =>
  import("../components/pieces/DecisionGridSection").then((m) => ({
    default: m.DecisionGridSection,
  })),
);

// 🎯 Encart anti-doute / réassurance conversion
const UXMessageBox = lazy(() =>
  import("../components/seo/UXMessageBox").then((m) => ({
    default: m.UXMessageBox,
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
    throw new Response(null, { status: 410 });
  }

  const gammeId = match[1];

  try {
    // 🚀 Configuration API depuis variables d'environnement
    // 🚀 Récupération des données avec fallback automatique RPC V2 → Classic
    // ⚠️ Timeout réduit de 180s à 30s pour compatibilité Googlebot (~30s patience)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    // 🚀 Fetch en parallèle : cookie + données gamme + switches SEO + substitution (LCP optimization)
    const API_URL = getInternalApiUrl("");
    const currentUrl = new URL(request.url);
    const pathname = currentUrl.pathname;

    const [selectedVehicle, apiData, switchesResponse, substitutionResponse] =
      await Promise.all([
        // 🚗 Récupérer véhicule depuis cookie (parallélisé)
        getVehicleFromCookie(request.headers.get("Cookie")),
        fetchGammePageData(gammeId, { signal: controller.signal }),
        fetch(`${API_URL}/api/blog/seo-switches/${gammeId}`, {
          signal: controller.signal,
        })
          .then((res) => (res.ok ? res.json() : { data: [] }))
          .catch(() => ({ data: [] })),
        // 🔄 Substitution API pour données enrichies (412/410 handling)
        fetch(
          `${API_URL}/api/substitution/check?url=${encodeURIComponent(pathname)}`,
          {
            signal: controller.signal,
          },
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      ]).finally(() => clearTimeout(timeoutId));

    logger.log(
      "🚗 Véhicule depuis cookie:",
      selectedVehicle
        ? `${selectedVehicle.marque_name} ${selectedVehicle.modele_name}`
        : "Aucun véhicule sélectionné",
    );

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
          s.sis_alias?.startsWith("noun_") || !s.sis_alias?.startsWith("verb_"),
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

    // Breadcrumbs (sans vehicule sur page gamme seule — evite hydration mismatch)
    const breadcrumbItems = buildBreadcrumbWithVehicle(
      [
        { label: "Accueil", href: "/" },
        { label: content?.pg_name || "Piece", current: true },
      ],
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
        headers: { "X-Robots-Tag": "noindex, follow" },
      });
    }
    if (substitutionResponse?.httpStatus === 410) {
      throw new Response("Gone", {
        status: 410,
        headers: { "X-Robots-Tag": "noindex, follow" },
      });
    }

    // Validation Zod avec degradation gracieuse
    const { data: pageData, degraded } = parseGammePageData({
      _v: GAMME_PAGE_CONTRACT_VERSION,
      pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
        clusterId: "gamme",
        canonicalEntity: slug,
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
      conseils: apiData.conseils,
      informations: apiData.informations,
      seoSwitches,
      guide: apiData.guideAchat
        ? {
            ...apiData.guideAchat,
            date: (apiData.guideAchat as { updated?: string }).updated ?? "",
          }
        : undefined,
      selectedVehicle,
      purchaseGuideData: apiData.purchaseGuideData,
      gammeBuyingGuide: apiData.gammeBuyingGuide,
      substitution: substitutionResponse,
    });

    if (degraded.length > 0) {
      logger.warn(`[pieces/$slug] Sections degradees: ${degraded.join(", ")}`);
    }

    return json(pageData, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
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
    ];
  }

  // Construire l'URL canonique
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;

  // ✅ Utiliser les données SEO du backend (priorité absolue)
  // Les titres/descriptions viennent de __seo_gamme_car via l'API RPC
  const title = data.meta?.title || data.content?.pg_name || "Pièces Auto";
  const description =
    data.meta?.description ||
    `${data.content?.pg_name || "Pièces"} pour votre véhicule. Trouvez la référence compatible parmi nos équipementiers de confiance. Livraison rapide.`;
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
              .slice(0, 30)
              .map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: `${data.content?.pg_name} ${item.marque_name} ${item.modele_name} ${item.type_name}`,
                url: item.link
                  ? `https://www.automecanik.com${item.link}`
                  : canonicalUrl,
              })),
          },
          // 3️⃣ HowTo - Etapes de selection (si howToChoose present)
          ...(data.purchaseGuideData?.howToChoose
            ? [
                {
                  "@type": "HowTo",
                  name: `Comment bien choisir vos ${data.content.pg_name.toLowerCase()}`,
                  step: data.purchaseGuideData.howToChoose
                    .split(/\d+\)\s*/)
                    .filter((s: string) => s.trim().length > 0)
                    .map((s: string, i: number) => ({
                      "@type": "HowToStep",
                      position: i + 1,
                      text: s.trim().replace(/\.$/, ""),
                    })),
                },
              ]
            : []),
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

  // Twitter Cards
  result.push({ name: "twitter:card", content: "summary_large_image" });
  result.push({ name: "twitter:title", content: title });
  result.push({ name: "twitter:description", content: description });

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
  loaderHeaders: _loaderHeaders,
}: {
  loaderHeaders: Headers;
}) {
  return {
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
  };
}

export default function PiecesDetailPage() {
  const data = useLoaderData<typeof loader>() as GammePageDataV1;
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

          {/* Titre H1 dynamique optimisé SEO - utilise h1Override si disponible */}
          <div className="text-center mb-6 md:mb-8 animate-in fade-in duration-700 delay-100">
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-white via-white to-white/90 bg-clip-text text-transparent drop-shadow-2xl">
                {(() => {
                  // Priorité: h1Override > h1 existant > fallback
                  const rawH1 =
                    data.purchaseGuideData?.h1Override ||
                    data.content?.h1 ||
                    `${data.content?.pg_name || "Pièces auto"} : trouvez la référence compatible`;
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
                      ? `Trouvez vos ${pluralName} compatibles avec votre véhicule`
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
              <Truck className="w-4 h-4 text-blue-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">
                Livraison 24-48h
              </span>
            </div>
            <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 backdrop-blur-lg rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
              <Shield className="w-4 h-4 text-purple-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
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

      {/* 🎓 Conseils & Diagnostic — dark glassmorphism (aligne homepage) */}
      <section
        className="relative py-12 md:py-16 lg:py-20 overflow-hidden bg-gradient-to-br from-[#0d1b3e] via-[#0f2347] to-[#162d5a]"
        aria-labelledby="conseils-diagnostic-title"
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:4rem_4rem]"
          aria-hidden="true"
        />
        {/* Orange glow top-right */}
        <div
          className="absolute -top-20 -right-20 w-80 h-80 bg-primary-500/[0.08] rounded-full blur-3xl"
          aria-hidden="true"
        />
        {/* Blue glow bottom-left */}
        <div
          className="absolute -bottom-20 -left-20 w-60 h-60 bg-secondary-200/10 rounded-full blur-3xl"
          aria-hidden="true"
        />

        <div className="relative container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="text-center mb-8 md:mb-12">
            <h2
              id="conseils-diagnostic-title"
              className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3"
            >
              Conseils & <span className="text-primary-400">Diagnostic</span>
            </h2>
            <div className="h-1 w-16 bg-gradient-to-r from-primary-400 to-primary-500 mx-auto rounded mb-4" />
            <p className="text-sm md:text-base text-white/70 max-w-xl mx-auto">
              L&apos;expertise automobile au service de votre véhicule
            </p>
          </div>

          {/* FEATURE CARD: Diagnostic auto */}
          <Link
            to="/diagnostic-auto"
            className="group relative block mb-5 md:mb-6 rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 hover:-translate-y-1"
            aria-label="Lancer un diagnostic auto"
          >
            <div className="absolute inset-0 bg-white/[0.07] backdrop-blur-sm" />
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-400 via-primary-500 to-primary-600" />
            <div className="absolute inset-0 bg-primary-500/0 group-hover:bg-primary-500/5 transition-colors duration-300" />

            <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 group-hover:scale-105 transition-all duration-300">
                  <Activity className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl md:text-2xl font-bold text-white">
                    Diagnostic auto
                  </h3>
                  <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                    Gratuit
                  </span>
                </div>
                <p className="text-sm md:text-base text-white/70 leading-relaxed mb-3 md:mb-0">
                  Identifiez votre panne : vibrations, bruits, voyants moteur
                  &mdash; causes et solutions par nos experts.
                </p>
                <div className="flex flex-wrap gap-2 md:mt-3">
                  {[
                    "Vibrations",
                    "Bruits moteur",
                    "Voyants",
                    data.famille?.mf_name || "Freinage",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 bg-white/[0.06] rounded-lg text-xs text-white/60 border border-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center gap-2 text-primary-400 font-semibold text-sm md:text-base">
                <span className="md:hidden">Diagnostiquer</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </div>
          </Link>

          {/* SECONDARY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {/* Guides d'achat */}
            <Link
              to="/blog-pieces-auto/guide-achat"
              className="group relative flex items-center gap-4 p-4 md:p-5 rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm hover:bg-white/[0.09] hover:border-white/20 transition-all duration-300"
              aria-label="Lire les guides d'achat"
            >
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors duration-300">
                <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-semibold text-white mb-0.5">
                  Guides d&apos;achat
                </h3>
                <p className="text-xs text-white/50 line-clamp-1">
                  {data.famille?.mf_name || "Distribution"}, filtration,
                  embrayage&hellip;
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </Link>

            {/* Référence technique */}
            <Link
              to={`/reference-auto/${data.content?.pg_alias || ""}`}
              className="group relative flex items-center gap-4 p-4 md:p-5 rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm hover:bg-white/[0.09] hover:border-white/20 transition-all duration-300"
              aria-label="Consulter le glossaire technique"
            >
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors duration-300">
                <Wrench className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-semibold text-white mb-0.5">
                  Référence technique
                </h3>
                <p className="text-xs text-white/50 line-clamp-1">
                  Glossaire, définitions, specs OE
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </Link>

            {/* Conseils entretien */}
            <Link
              to={`/blog-pieces-auto/conseils/${data.content?.pg_alias || ""}`}
              className="group relative flex items-center gap-4 p-4 md:p-5 rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm hover:bg-white/[0.09] hover:border-white/20 transition-all duration-300"
              aria-label="Lire les conseils d'entretien"
            >
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors duration-300">
                <Shield className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base font-semibold text-white mb-0.5">
                  Conseils entretien
                </h3>
                <p className="text-xs text-white/50 line-clamp-1">
                  Calendrier, astuces mécanicien, pièces à surveiller
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </Link>
          </div>
        </div>
      </section>

      {/* 📖 Bandeau guides contextuel — aide rapide + maillage interne R1→R3 */}
      <PageSection maxWidth="5xl" className="py-3 sm:py-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm">
          <span className="font-medium text-gray-700">Besoin d'aide ?</span>
          <Link
            to="/blog-pieces-auto/guide-achat/selecteur-vehicule"
            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Comment utiliser le sélecteur
          </Link>
          {data.content?.pg_alias && (
            <Link
              to={`/blog-pieces-auto/conseils/${data.content.pg_alias}`}
              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline"
            >
              <Wrench className="h-3.5 w-3.5" />
              Guide : comment changer un{" "}
              {data.content?.pg_name?.toLowerCase() || "pièce"}
            </Link>
          )}
        </div>
      </PageSection>

      {/* ⚡ Mini-guide rapide (3 cartes) — Position 2 : orientation immédiate */}
      {data.purchaseGuideData && (
        <PageSection>
          <Reveal>
            <Suspense
              fallback={
                <div className="h-48 bg-gray-50 animate-pulse rounded-lg" />
              }
            >
              <QuickGuideSection
                guide={data.purchaseGuideData}
                gammeName={data.content?.pg_name}
              />
            </Suspense>
          </Reveal>
        </PageSection>
      )}

      {/* 🎯 Profils d'usage (R1: orientation par cas d'utilisation, sans diagnostic) */}
      {data.gammeBuyingGuide?.useCases &&
        data.gammeBuyingGuide.useCases.length > 0 && (
          <PageSection bg="slate">
            <Reveal>
              <Suspense
                fallback={
                  <div className="h-48 bg-gray-50 animate-pulse rounded-lg" />
                }
              >
                <DecisionGridSection
                  useCases={data.gammeBuyingGuide.useCases}
                  decisionTree={[]}
                  gammeName={data.content?.pg_name}
                />
              </Suspense>
            </Reveal>
          </PageSection>
        )}

      {/* R1 ROUTER: SymptomsSection (R5) et AntiMistakesSection (R3) supprimés — hors-rôle */}

      {/* 🚗 Motorisations compatibles — Position 3 : raccourcis clic direct */}
      <PageSection bg="slate" id="compatibilities">
        <Reveal>
          <Suspense
            fallback={
              <div className="h-96 bg-gray-50 animate-pulse rounded-lg" />
            }
          >
            <MotorisationsSection
              motorisations={data.motorisations}
              familleColor={familleColor}
              familleName={data.content?.pg_name || "pièces"}
              totalCount={data.performance?.motorisations_count}
            />
          </Suspense>
        </Reveal>
      </PageSection>

      {/* 📑 Sommaire ancré — Position 4 : navigation vers le contenu SEO */}
      <div className="container mx-auto px-4 max-w-7xl py-4">
        <TableOfContents
          gammeName={data.content?.pg_name}
          hasMotorizations={!!data.motorisations?.items?.length}
          hasSymptoms={false}
          hasGuide={false}
          hasDecisionGrid={!!data.gammeBuyingGuide?.useCases?.length}
          hasPurchaseGuide={!!data.purchaseGuideData}
          hasAntiMistakes={false}
          hasInformations={false}
          hasConseils={false}
          hasEquipementiers={!!data.equipementiers?.items?.length}
          hasFaq={
            !!(data.purchaseGuideData?.faq?.length || R1_SELECTOR_FAQ.length)
          }
          hasCatalogue={!!data.catalogueMameFamille?.items?.length}
        />
      </div>

      {/* 🚗 Badge véhicule actif (si présent) */}
      {data.selectedVehicle && (
        <PageSection className="py-4 sm:py-4">
          <VehicleFilterBadge
            vehicle={data.selectedVehicle}
            showDetails={true}
          />
        </PageSection>
      )}

      {/* Contenu principal de la gamme */}
      <PageSection>
        <Reveal>
          <section className="bg-white rounded-xl shadow-lg overflow-hidden">
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
        </Reveal>
      </PageSection>

      {/* R1 ROUTER: PurchaseNarrativeSection (R3/guide-achat) et InformationsSection supprimés — hors-rôle */}

      {/* 🔧 Équipementiers — DarkSection navy (ConseilsSection R3/conseils supprimé — hors-rôle R1) */}
      <DarkSection>
        <div className="space-y-12">
          <div id="brands">
            <SectionHeader
              title="Marques équipementières de confiance"
              sub="Fabricants OE et qualité premium"
              dark
            />
            <Reveal delay={100}>
              <Suspense
                fallback={
                  <div className="h-48 bg-white/5 animate-pulse rounded-lg" />
                }
              >
                <EquipementiersSection
                  equipementiers={data.equipementiers}
                  isDarkMode
                />
              </Suspense>
            </Reveal>
          </div>
        </div>
      </DarkSection>

      {/* 📦 Catalogue Même Famille */}
      <PageSection id="family">
        <Reveal>
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
        </Reveal>
      </PageSection>

      {/* 📖 FAQ R1 — questions universelles sur le sélecteur véhicule */}
      <PageSection bg="slate" id="faq">
        <Reveal>
          <Suspense
            fallback={
              <div className="h-48 bg-slate-100 animate-pulse rounded-lg" />
            }
          >
            <FAQSection
              faq={
                data.purchaseGuideData?.faq?.length
                  ? data.purchaseGuideData.faq
                  : R1_SELECTOR_FAQ
              }
              gammeName={data.content?.pg_name || "cette pièce"}
            />
          </Suspense>
        </Reveal>
      </PageSection>

      {/* Bouton Scroll To Top */}
      <ScrollToTop />

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
