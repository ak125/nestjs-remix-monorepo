/**
 * R1 ROUTER — Fonctions pures pour construire les données de la page gamme.
 * Extraits de pieces.$slug.tsx pour testabilité et lisibilité.
 */
import { type GammePagePurchaseGuideData } from "~/types/gamme-page-contract.types";
import { dedupeStrings } from "~/utils/dedupe-strings";
import { validateFaqItems } from "~/utils/faq-validator";
import { mergeR1Faq } from "~/utils/r1-faq-merge";
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
  h2Overrides?: Record<string, string> | null;
  heroSubtitle?: string | null;
  compatErrors?: string[] | null;
  faq?: Array<{ question: string; answer: string }> | null;
  microSeoBlock?: string | null;
  compatibilitiesIntro?: string | null;
  equipementiersLine?: string | null;
  familyCrossSellIntro?: string | null;
  safeTableRows?: Array<{ element: string; howToCheck: string }> | null;
  selectorMicrocopy?: string[] | null;
}

/** Picks only R1-safe fields, renames antiMistakes → compatErrors. */
export function sanitizePurchaseGuideForR1(
  raw?: GammePagePurchaseGuideData | null,
): R1PurchaseGuideData | undefined {
  if (!raw) return undefined;
  return {
    arguments: raw.arguments,
    h1Override: raw.h1Override,
    h2Overrides: raw.h2Overrides ?? null,
    heroSubtitle: raw.heroSubtitle,
    compatErrors: raw.antiMistakes,
    faq: raw.faq,
    microSeoBlock: raw.microSeoBlock,
    compatibilitiesIntro: raw.compatibilitiesIntro,
    equipementiersLine: raw.equipementiersLine,
    familyCrossSellIntro: raw.familyCrossSellIntro,
    safeTableRows: raw.safeTableRows,
    selectorMicrocopy: raw.selectorMicrocopy ?? null,
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
  /** Autoritative count from backend RPC (cgc_level_3) */
  motorisationsCount?: number;
}) {
  const { motorItems, equipNames, allYears, motorisationsCount } = params;

  // A) motorisationsCount : vrai chiffre du backend, sinon items.length
  const count = motorisationsCount ?? motorItems.length;

  // B) modelsCount : couples uniques (marque_name, modele_name)
  const modelsCount = new Set(
    motorItems.map((m) => `${m.marque_name}|${m.modele_name}`),
  ).size;

  // C) periodeRange : garde-fous (au moins 2 années, pas de span suspect)
  const minYear = allYears.length ? Math.min(...allYears) : 0;
  const maxYear = allYears.length ? Math.max(...allYears) : 0;
  const yearSpan = maxYear - minYear;
  const periodeRange =
    allYears.length >= 2 && !(yearSpan > 40 && count < 50)
      ? `${minYear} – ${maxYear}`
      : "";

  return {
    topMarques: dedupeStrings(
      motorItems.map((m) => m.marque_name).filter(Boolean),
    ).slice(0, 3),
    topEquipementiers: dedupeStrings(equipNames).slice(0, 4),
    motorisationsCount: count,
    modelsCount,
    periodeRange,
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

  const faqItems = mergeR1Faq(faq, fallbackFaq).filter(
    (f) => f.question?.trim() && f.answer?.trim(),
  );
  const cappedFaq = validateFaqItems(faqItems);

  return {
    "@context": "https://schema.org",
    "@graph": [
      // 1️⃣ CollectionPage
      {
        "@type": "CollectionPage",
        "@id": canonicalUrl,
        name: pgName,
        url: canonicalUrl,
        ...((motorisationsSchema?.length || 0) > 0 && {
          mainEntity: { "@id": `${canonicalUrl}#list` },
        }),
        about: {
          "@type": "Thing",
          name: pgName,
          identifier: `gamme-${gammeId}`,
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
              name: pgName || "Pièce auto",
              item: canonicalUrl,
            },
          ],
        },
      },
      // 2️⃣ ItemList — seulement si des items valides existent (évite Rich Results FAIL)
      ...((motorisationsSchema?.length ?? 0) > 0 &&
      motorisationsSchema![0]?.marque_name
        ? [
            {
              "@type": "ItemList",
              "@id": `${canonicalUrl}#list`,
              name: `${pgName || "Pièce auto"} - Véhicules compatibles`,
              numberOfItems: motorisationsSchema!.length,
              itemListElement: motorisationsSchema!.map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: `${pgName || "Pièce"} ${item.marque_name || ""} ${item.modele_name || ""} ${item.type_name || ""}`.trim(),
                url: item.link
                  ? buildCanonicalUrl({
                      baseUrl: item.link,
                      includeHost: true,
                    })
                  : canonicalUrl,
              })),
            },
          ]
        : []),
      // 3️⃣ FAQPage
      ...(cappedFaq.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: cappedFaq
                .filter((item) => item.question?.trim() && item.answer?.trim())
                .map((item) => ({
                  "@type": "Question",
                  name: item.question.trim(),
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: item.answer.trim(),
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
        ? `${motorisationsCount} motorisations compatibles`
        : undefined,
  };
}
