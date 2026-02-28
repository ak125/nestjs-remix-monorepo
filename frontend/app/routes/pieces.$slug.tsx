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
  AlertTriangle,
  CheckCircle2,
  Shield,
  Truck,
  Users,
  XCircle,
} from "lucide-react";

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
import { R1ReusableContent } from "~/components/pieces/R1ReusableContent";
import TableOfContents from "~/components/pieces/TableOfContents";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import {
  getSectionImageConfig,
  resolveAltText,
  resolveSlogan,
} from "~/config/visual-intent";
import { pluralizePieceName } from "~/lib/seo-utils";
import { fetchGammePageData } from "~/services/api/gamme-api.service";
import {
  type GammePageDataV1,
  GAMME_PAGE_CONTRACT_VERSION,
} from "~/types/gamme-page-contract.types";
import { parseGammePageData } from "~/utils/gamme-page-contract.utils";
import { ImageOptimizer } from "~/utils/image-optimizer";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";
import { getOgImageUrl } from "~/utils/og-image.utils";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";
import { buildCanonicalUrl } from "~/utils/seo/canonical";
import { VehicleFilterBadge } from "../components/vehicle/VehicleFilterBadge";
import VehicleSelector from "../components/vehicle/VehicleSelector";
import { hierarchyApi } from "../services/api/hierarchy.api";
import { normalizeAlias } from "../utils/url-builder.utils";
import {
  getVehicleClient,
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

// Navigation rapide mobile — familles populaires (ancres vers catalogue homepage)
const QUICK_NAV_LINKS = [
  { label: "Freinage", href: "/#catalogue" },
  { label: "Filtration", href: "/#catalogue" },
  { label: "Distribution", href: "/#catalogue" },
  { label: "Amortisseurs", href: "/#catalogue" },
  { label: "Toutes les marques", href: "/#toutes-les-marques" },
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

  // 🛑 404 — gamme_id=0 n'existe pas en base (parseUrlParam fallback)
  if (gammeId === "0") {
    throw new Response(null, {
      status: 404,
      headers: { "X-Robots-Tag": "noindex, follow" },
    });
  }

  try {
    // 🚀 Configuration API depuis variables d'environnement
    // 🚀 Récupération des données avec fallback automatique RPC V2 → Classic
    // ⚠️ Timeout réduit de 180s à 30s pour compatibilité Googlebot (~30s patience)
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
      [
        { label: "Accueil", href: "/" },
        { label: "Pièces Auto", href: "/#catalogue" },
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

    return json(
      { ...pageData, canonicalPath },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      },
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
  const data = rawData as
    | (GammePageDataV1 & { canonicalPath?: string })
    | undefined;
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
            about: {
              "@type": "ProductGroup",
              name: data.content.pg_name,
              productGroupID: `gamme-${data.canonicalPath?.match(/-(\d+)\.html$/)?.[1] || ""}`,
            },
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
          // 4️⃣ Organization — site publisher
          {
            "@type": "Organization",
            "@id": "https://www.automecanik.com/#organization",
            name: "Automecanik",
            url: "https://www.automecanik.com",
            logo: "https://www.automecanik.com/logo.png",
            contactPoint: {
              "@type": "ContactPoint",
              telephone: "+33-1-XX-XX-XX-XX",
              email: "contact@automecanik.com",
              contactType: "Service Client",
              areaServed: "FR",
              availableLanguage: ["French"],
            },
            sameAs: [
              "https://www.facebook.com/Automecanik63",
              "https://www.instagram.com/automecanik.co",
              "https://www.youtube.com/@automecanik8508",
            ],
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

  // Twitter Cards
  result.push({ name: "twitter:card", content: "summary_large_image" });
  result.push({ name: "twitter:title", content: title });
  result.push({ name: "twitter:description", content: description });
  result.push({ name: "twitter:image", content: ogImage });

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
  const data = useLoaderData<typeof loader>() as unknown as GammePageDataV1;
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

  // 🚀 LCP: srcSet responsive pour wallpaper (fond décoratif opacity-25)
  // Réduit le payload mobile : 640px au lieu de 1920px sur petit écran
  const wallSrcSet = data?.content?.pg_wall
    ? ImageOptimizer.getResponsiveSrcSet(
        data.content.pg_wall.replace(/^\/img\//, ""),
        [640, 1024, 1920],
        75,
      )
    : undefined;

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

  // Variables partagées par S_BUY_ARGS et S_COMPAT (0 appel API supplémentaire)
  const motorItems = data.motorisations?.items || [];
  const allYears = motorItems
    .flatMap((m) => (m.periode || "").match(/\d{4}/g) || [])
    .map(Number)
    .filter((y) => y > 1990 && y < 2100);
  const periodeRange =
    allYears.length >= 2
      ? `${Math.min(...allYears)} – ${Math.max(...allYears)}`
      : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      {/* ⏳ Indicateur de chargement global */}
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-semantic-info animate-pulse">
          <div className="h-full bg-gradient-to-r from-semantic-info via-secondary-500 to-semantic-info bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]"></div>
        </div>
      )}

      {/* Breadcrumbs visuels */}
      <div className="container mx-auto px-4 pt-4">
        <PublicBreadcrumb items={breadcrumbs} />
      </div>

      {/* 🎯 HERO SECTION - Avec couleur de la famille */}
      <HeroTransaction
        data-section="S_HERO"
        data-page-role="R1"
        gradient={familleColor}
        slogan={resolveSlogan("transaction", data.content?.pg_name)}
        className="py-12 md:py-16 lg:py-20"
        backgroundSlot={
          <>
            {/* Image wallpaper en arrière-plan (si disponible) */}
            {data.content?.pg_wall && (
              <div className="absolute inset-0 z-0">
                <img
                  src={data.content.pg_wall}
                  srcSet={wallSrcSet}
                  sizes="100vw"
                  alt={data.content.pg_name || ""}
                  width={1920}
                  height={400}
                  className="w-full h-full object-cover opacity-25"
                  loading="lazy"
                  decoding="async"
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

            {/* Forme décorative retirée — LCP: blur-3xl force GPU compositing layer */}
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
          <div className="bg-gradient-to-br from-white/[0.18] to-white/[0.10] rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.4)] p-6 md:p-8 border border-white/30 hover:border-white/50 transition-all duration-500">
            {/* Sous-titre dynamique en haut du cadre */}
            <div className="text-center mb-6">
              <p className="text-white/95 text-base md:text-lg font-semibold">
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
                  {/* Cercle décoratif retiré — LCP: blur-3xl force GPU compositing layer */}

                  {/* Container image */}
                  <div className="relative bg-white/10 rounded-2xl p-6 border border-white/20 shadow-lg">
                    <div className="w-full aspect-square flex items-center justify-center">
                      <img
                        src={
                          data.content?.pg_pic ||
                          "/images/categories/default.svg"
                        }
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
                    </div>
                  </div>

                  {/* Particule décorative retirée — LCP: blur-xl force GPU layer */}
                </div>
              </div>

              {/* VehicleSelector à droite */}
              <div
                id="vehicle-selector"
                className="flex-1 w-full scroll-mt-20 animate-in fade-in slide-in-from-right duration-1000 delay-400"
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
          <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
            <CheckCircle2 className="w-4 h-4 text-green-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">
              400 000+ pièces
            </span>
          </div>
          <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
            <Truck className="w-4 h-4 text-blue-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">
              Livraison 24-48h
            </span>
          </div>
          <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
            <Shield className="w-4 h-4 text-purple-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">
              Paiement sécurisé
            </span>
          </div>
          <div className="group flex items-center gap-space-2 px-space-3 md:px-space-4 py-space-2.5 bg-gradient-to-br from-white/15 to-white/10 rounded-xl border border-white/30 hover:border-white/50 hover:from-white/20 hover:to-white/15 transition-all shadow-lg hover:shadow-xl hover:scale-105 cursor-default justify-center">
            <Users className="w-4 h-4 text-orange-300 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span className="text-white font-sans text-sm md:text-base font-semibold whitespace-nowrap">
              Experts gratuits
            </span>
          </div>
        </div>
      </HeroTransaction>

      {/* V2: Dark "Conseils & Diagnostic" section retirée — liens couverts par R1ReusableContent */}

      {/* R1 micro-bloc: 120-180 mots + 3 cartes navigation + image section (max 1) */}
      <PageSection
        data-section="S_BUY_ARGS"
        data-page-role="R1"
        maxWidth="5xl"
        className="py-6 sm:py-8"
      >
        {(() => {
          const imageConfig = data.content?.pg_pic
            ? getSectionImageConfig("transaction", "buyingGuide")
            : undefined;

          // Micro-preuves : réutilise motorItems/periodeRange/allYears extraits avant le return
          const toTitleCase = (s: string) =>
            s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
          const uniqueMarques = [
            ...new Set(motorItems.map((m) => m.marque_name).filter(Boolean)),
          ].map(toTitleCase);
          const uniqueCodes = [
            ...new Set(
              motorItems
                .map((m) => (m as { engine_code?: string }).engine_code)
                .filter(Boolean),
            ),
          ] as string[];
          const equipNames = (data.equipementiers?.items || [])
            .map((e) => (e as { pm_name?: string }).pm_name)
            .filter(Boolean) as string[];

          const proofs =
            motorItems.length > 0
              ? {
                  topMarques: uniqueMarques.slice(0, 3),
                  topEquipementiers: equipNames.slice(0, 4),
                  periodeRange,
                  vehicleCount: motorItems.length,
                  topMotorCodes: uniqueCodes.slice(0, 3),
                }
              : undefined;

          const r1Block = (
            <R1ReusableContent
              gammeName={data.content?.pg_name || "pièces auto"}
              familleName={data.famille?.mf_name || ""}
              alias={data.content?.pg_alias || ""}
              reference={data.reference}
              proofs={proofs}
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

      {/* ✅ Bloc compatibilité — réassurance avant catalogue */}
      <PageSection
        data-section="S_COMPAT"
        data-page-role="R1"
        className="py-4 sm:py-6"
        id="compatibility-check"
      >
        <Suspense fallback={null}>
          <CompatibilityConfirmationBlock
            selectedVehicle={selectedVehicle}
            motorisationItems={motorItems}
            gammeName={data.content?.pg_name?.toLowerCase() || "pièces auto"}
            periodeRange={periodeRange}
            gammeId={0}
          />
        </Suspense>
      </PageSection>

      {/* Accès rapide gammes populaires — mobile uniquement */}
      <div className="sm:hidden overflow-x-auto px-4 py-3">
        <div className="flex gap-2 min-w-max">
          {QUICK_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              prefetch="intent"
              className="px-3 py-2 rounded-full bg-white border border-gray-200 text-sm font-medium text-gray-700 whitespace-nowrap hover:bg-gray-50"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Motorisations compatibles — Position 3 : raccourcis clic direct */}
      <PageSection
        data-section="S_MOTORISATIONS"
        data-page-role="R1"
        bg="slate"
        id="compatibilities"
        className="scroll-mt-20"
      >
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
          hasDecisionGrid={false}
          hasPurchaseGuide={false}
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
      {selectedVehicle && (
        <PageSection className="py-4 sm:py-4">
          <VehicleFilterBadge
            vehicle={selectedVehicle}
            onClear={() => setSelectedVehicle(null)}
            showDetails={true}
          />
        </PageSection>
      )}

      {/* R1 ROUTER: PurchaseNarrativeSection (R3/guide-achat) et InformationsSection supprimés — hors-rôle */}

      {/* 🔧 Équipementiers — DarkSection navy (ConseilsSection R3/conseils supprimé — hors-rôle R1) */}
      <DarkSection data-section="S_EQUIPEMENTIERS" data-page-role="R1">
        <div className="space-y-12">
          <div id="brands" className="scroll-mt-20">
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
      <PageSection
        data-section="S_CATALOGUE"
        data-page-role="R1"
        id="family"
        className="scroll-mt-20"
      >
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

      {/* Mini-bloc erreurs fréquentes — conditionnel sur données dispo */}
      {data.purchaseGuideData?.antiMistakes &&
      data.purchaseGuideData.antiMistakes.length > 0 ? (
        <PageSection
          data-section="S_ERREURS"
          data-page-role="R1"
          className="py-4 sm:py-6"
        >
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              Erreurs fréquentes à éviter
            </h3>
            <ul className="space-y-2">
              {data.purchaseGuideData.antiMistakes.slice(0, 3).map((err, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-amber-800"
                >
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                  <span>{err}</span>
                </li>
              ))}
            </ul>
          </div>
        </PageSection>
      ) : null}

      {/* FAQ R1 — questions universelles sur le sélecteur véhicule */}
      <PageSection
        data-section="S_FAQ"
        data-page-role="R1"
        bg="slate"
        id="faq"
        className="scroll-mt-20"
      >
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
