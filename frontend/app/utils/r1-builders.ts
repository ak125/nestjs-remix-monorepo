/**
 * R1 ROUTER — Fonctions pures pour construire les données de la page gamme.
 * Extraits de pieces.$slug.tsx pour testabilité et lisibilité.
 */
import { type GammePagePurchaseGuideData } from "~/types/gamme-page-contract.types";
import { buildCanonicalUrl } from "~/utils/seo/canonical";

// ─── Types ───────────────────────────────────────────────────────────

interface MotorItem {
  marque_name: string;
  modele_name: string;
  type_name: string;
  link: string;
  engine_code?: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface MotorSchemaItem {
  marque_name: string;
  modele_name: string;
  type_name: string;
  link: string;
}

// ─── R1 Purchase Guide: strict subset ────────────────────────────────

/** Only the purchase guide fields allowed on R1 (gamme router page).
 *  Any field NOT listed here is R3/R5 territory. */
export interface R1PurchaseGuideData {
  arguments?: Array<{ title?: string; content?: string; icon?: string }>;
  h1Override?: string | null;
  heroSubtitle?: string | null;
  compatErrors?: string[] | null;
  faq?: Array<{ question: string; answer: string }> | null;
  microSeoBlock?: string | null;
  compatibilitiesIntro?: string | null;
  equipementiersLine?: string | null;
  familyCrossSellIntro?: string | null;
  safeTableRows?: Array<{ element: string; howToCheck: string }> | null;
}

/** Picks only R1-safe fields, renames antiMistakes → compatErrors. */
export function sanitizePurchaseGuideForR1(
  raw?: GammePagePurchaseGuideData | null,
): R1PurchaseGuideData | undefined {
  if (!raw) return undefined;
  return {
    arguments: raw.arguments,
    h1Override: raw.h1Override,
    heroSubtitle: raw.heroSubtitle,
    compatErrors: raw.antiMistakes,
    faq: raw.faq,
    microSeoBlock: raw.microSeoBlock,
    compatibilitiesIntro: raw.compatibilitiesIntro,
    equipementiersLine: raw.equipementiersLine,
    familyCrossSellIntro: raw.familyCrossSellIntro,
    safeTableRows: raw.safeTableRows,
  };
}

// ─── 1. Breadcrumbs ──────────────────────────────────────────────────

export function buildR1Breadcrumbs(pgName: string) {
  return [
    { label: "Accueil", href: "/" },
    { label: "Pièces Auto", href: "/pieces" },
    { label: pgName || "Piece", current: true as const },
  ];
}

// ─── 2. Proof Data ───────────────────────────────────────────────────

export function buildProofData(params: {
  motorItems: MotorItem[];
  equipNames: string[];
  allYears: number[];
}) {
  const { motorItems, equipNames, allYears } = params;
  return {
    topMarques: [
      ...new Set(motorItems.map((m) => m.marque_name).filter(Boolean)),
    ].slice(0, 3),
    topEquipementiers: equipNames.slice(0, 4),
    vehicleCount: motorItems.length,
    periodeRange: allYears.length
      ? `${Math.min(...allYears)} – ${Math.max(...allYears)}`
      : "",
    topMotorCodes: [
      ...new Set(motorItems.map((m) => m.engine_code).filter(Boolean)),
    ].slice(0, 3) as string[],
  };
}

// ─── 3. JSON-LD @graph ───────────────────────────────────────────────

export function buildGammeJsonLd(params: {
  pgName: string;
  pgPic?: string | null;
  canonicalUrl: string;
  gammeId: number;
  motorisationsSchema?: MotorSchemaItem[];
  faq?: FaqItem[] | null;
  fallbackFaq: FaqItem[];
}) {
  const {
    pgName,
    pgPic,
    canonicalUrl,
    gammeId,
    motorisationsSchema,
    faq,
    fallbackFaq,
  } = params;

  const faqItems = faq?.length ? faq : fallbackFaq;
  const cappedFaq = faqItems.slice(0, 6);

  return {
    "@context": "https://schema.org",
    "@graph": [
      // 1️⃣ CollectionPage
      {
        "@type": "CollectionPage",
        "@id": canonicalUrl,
        name: pgName,
        url: canonicalUrl,
        mainEntity: { "@id": `${canonicalUrl}#list` },
        about: {
          "@type": "ProductGroup",
          name: pgName,
          productGroupID: `gamme-${gammeId}`,
        },
        ...(pgPic && { image: pgPic }),
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
              name: pgName,
              item: canonicalUrl,
            },
          ],
        },
      },
      // 2️⃣ ItemList
      {
        "@type": "ItemList",
        "@id": `${canonicalUrl}#list`,
        name: `${pgName} - Véhicules compatibles`,
        numberOfItems: motorisationsSchema?.length || 0,
        itemListElement: (motorisationsSchema || []).map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `${pgName} ${item.marque_name} ${item.modele_name} ${item.type_name}`,
          url: item.link
            ? buildCanonicalUrl({ baseUrl: item.link, includeHost: true })
            : canonicalUrl,
        })),
      },
      // 3️⃣ FAQPage
      ...(cappedFaq.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: cappedFaq.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer,
                },
              })),
            },
          ]
        : []),
      // 4️⃣ Organization
      {
        "@type": "Organization",
        "@id": "https://www.automecanik.com/#organization",
        name: "Automecanik",
        url: "https://www.automecanik.com",
        logo: "https://www.automecanik.com/logo.png",
        contactPoint: {
          "@type": "ContactPoint",
          telephone: "+33-1-48-47-96-27",
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
  };
}

// ─── 4. Hero Props ───────────────────────────────────────────────────

export function buildHeroProps(params: {
  purchaseGuideArgs?: Array<{ title?: string }>;
  motorisationsCount?: number;
}) {
  const { purchaseGuideArgs, motorisationsCount } = params;
  const defaultBadges = [
    "400 000+ pièces",
    "Livraison 24-48h",
    "Paiement sécurisé",
    "Experts gratuits",
  ];
  return {
    badges:
      purchaseGuideArgs?.length === 4
        ? purchaseGuideArgs.map((a) => a.title || "")
        : defaultBadges,
    subtitle:
      motorisationsCount && motorisationsCount > 0
        ? `${motorisationsCount} véhicules compatibles`
        : undefined,
  };
}
