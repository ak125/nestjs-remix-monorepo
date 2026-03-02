/**
 * Contrat de donnees pour la route /pieces/:slug (page R1 gamme)
 *
 * Version : GammePageData.v1
 * Role SEO : R1_ROUTER (selection de pieces par famille)
 *
 * Tiers :
 *  - Tier 1 (requis)  : meta, content, breadcrumbs — page ne rend pas sans
 *  - Tier 2 (optionnel): motorisations, catalogue, equipementiers, etc.
 *  - Tier 3 (enrichissement): purchaseGuide, buyingGuide, substitution
 */

import { z } from "zod";
import { type PageRoleMeta } from "~/utils/page-role.types";

// ============================================================
// Version
// ============================================================

export const GAMME_PAGE_CONTRACT_VERSION = "GammePageData.v1" as const;

// ============================================================
// Tier 1 : Requis
// ============================================================

export interface GammePageMeta {
  title: string;
  description: string;
  keywords: string;
  robots: string;
  canonical: string;
  relfollow?: number;
}

export interface GammePageContent {
  h1: string;
  content: string;
  pg_name: string;
  pg_alias: string;
  pg_pic: string;
  pg_wall: string;
}

export interface GammePageBreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

// ============================================================
// Tier 2 : Structurel optionnel
// ============================================================

export interface GammePageFamille {
  mf_id: number;
  mf_name: string;
  mf_pic: string;
}

export interface GammePagePerformance {
  total_time_ms: number;
  parallel_time_ms?: number;
  rpc_time_ms?: number;
  motorisations_count: number;
  catalogue_famille_count?: number;
  equipementiers_count?: number;
  conseils_count?: number;
  informations_count?: number;
  guide_available?: number;
}

export interface GammePageMotorisationItem {
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
}

export interface GammePageCatalogueItem {
  name: string;
  link: string;
  image: string;
  description: string;
  meta_description: string;
  sort?: number;
}

export interface GammePageEquipementierItem {
  pm_id: number;
  pm_name: string;
  pm_logo: string;
  title: string;
  image: string;
  description: string;
}

export interface GammePageConseilItem {
  id: number;
  title: string;
  content: string;
}

export interface GammePageSeoSwitch {
  id: string;
  content: string;
}

export interface GammePageGuide {
  id: number;
  title: string;
  alias: string;
  preview: string;
  wall?: string;
  date: string;
  image: string;
  link?: string;
  h2_content?: string;
}

// ============================================================
// Tier 3 : Enrichissement
// ============================================================

export interface GammePagePurchaseGuideData {
  id: number;
  pgId: string;
  intro: { title: string; role: string; syncParts: string[] };
  risk: {
    title: string;
    explanation: string;
    consequences: string[];
    costRange: string;
    conclusion: string;
  };
  timing: { title: string; years: string; km: string; note: string };
  arguments: Array<{ title: string; content: string; icon: string }>;
  h1Override?: string | null;
  howToChoose?: string | null;
  symptoms?: string[] | null;
  antiMistakes?: string[] | null;
  faq?: Array<{ question: string; answer: string }> | null;
  // R1 pipeline fields
  heroSubtitle?: string | null;
  selectorMicrocopy?: string[] | null;
  microSeoBlock?: string | null;
  compatibilitiesIntro?: string | null;
  equipementiersLine?: string | null;
  familyCrossSellIntro?: string | null;
  interestNuggets?:
    | Record<string, unknown>
    | Array<Record<string, unknown>>
    | null;
  safeTableRows?: Array<{ element: string; howToCheck: string }> | null;
  visualPlan?: {
    heroPrimaryCta?: { label: string; action?: string };
    crossSellRules?: { maxItems: number; sameFamilyOnly?: boolean };
    compatibilitiesLabelRule?: string;
  } | null;
  contentContract?: {
    totalWordsTarget?: [number, number];
    microSeoWordsTarget?: [number, number];
    faqAnswerWordsTarget?: [number, number];
    maxGammeMentions?: number;
    maxCompatibleMentions?: number;
  } | null;
  hardRules?: {
    banHowtoMarkers?: string[];
    banAbsoluteClaims?: string[];
    banPricePush?: string[];
  } | null;
}

export interface GammePageBuyingGuide {
  compatibilityRules?: string[];
  selectionCriteria?: Array<{
    key: string;
    label: string;
    guidance: string;
    priority: "required" | "recommended";
  }>;
  trustArguments?: Array<{ title: string; content: string; icon?: string }>;
  pairing?: {
    required?: string[];
    recommended?: string[];
    checks?: string[];
  };
  antiMistakes?: string[];
  risk?: { costRange?: string };
  faq?: Array<{ question: string; answer: string }>;
  useCases?: Array<{
    id: string;
    label: string;
    recommendation: string;
  }>;
  decisionTree?: Array<{
    id: string;
    question: string;
    options: Array<{
      label: string;
      outcome: string;
      note?: string;
    }>;
  }>;
}

export interface GammePageSubstitution {
  httpStatus: number;
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
}

// ============================================================
// Contrat complet
// ============================================================

export interface GammePageDataV1 {
  /** Version du contrat */
  _v: typeof GAMME_PAGE_CONTRACT_VERSION;

  /** Role SEO de la page (R1-R6) */
  pageRole: PageRoleMeta;

  // --- Tier 1 : Requis ---
  status: number;
  meta: GammePageMeta;
  content: GammePageContent;
  breadcrumbs: { items: GammePageBreadcrumbItem[] };

  // --- Tier 2 : Structurel optionnel ---
  famille?: GammePageFamille;
  performance?: GammePagePerformance;
  motorisations?: {
    title: string;
    items: GammePageMotorisationItem[];
  };
  catalogueMameFamille?: {
    title: string;
    items: GammePageCatalogueItem[];
  };
  equipementiers?: {
    title: string;
    items: GammePageEquipementierItem[];
  };
  conseils?: {
    title: string;
    content: string;
    items: GammePageConseilItem[];
  };
  informations?: {
    title: string;
    content: string;
    items: string[];
  };
  seoSwitches?: {
    verbs: GammePageSeoSwitch[];
    nouns: GammePageSeoSwitch[];
    verbCount: number;
    nounCount: number;
  };
  guide?: GammePageGuide;

  // --- Tier 3 : Enrichissement ---
  purchaseGuideData?: GammePagePurchaseGuideData | null;
  gammeBuyingGuide?: GammePageBuyingGuide | null;
  substitution?: GammePageSubstitution | null;

  // --- Tier 3 : Référence technique R4 ---
  reference?: {
    slug: string;
    title: string;
    definition: string;
    roleMecanique: string | null;
    canonicalUrl: string | null;
  } | null;

  // --- Tier 3 : Codes CNIT / Type Mine ---
  technicalCodes?: {
    items: Array<{
      vehicleLabel: string;
      typeId: number;
      mines: string[];
      cnits: string[];
    }>;
    totalMines: number;
    totalCnits: number;
  } | null;
}

// ============================================================
// Schemas Zod (validation runtime)
// ============================================================

// --- Tier 1 ---

export const GammePageMetaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  keywords: z.string(),
  robots: z.string(),
  canonical: z.string().min(1),
  relfollow: z.coerce.number().optional(),
});

export const GammePageContentSchema = z.object({
  h1: z.string().min(1),
  content: z.string(),
  pg_name: z.string().min(1),
  pg_alias: z.string().min(1),
  pg_pic: z.string(),
  pg_wall: z.string(),
});

export const GammePageBreadcrumbItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().optional(),
  current: z.boolean().optional(),
});

export const BreadcrumbsSchema = z.object({
  items: z.array(GammePageBreadcrumbItemSchema).min(1),
});

// --- Tier 2 ---

export const FamilleSchema = z
  .object({
    mf_id: z.coerce.number(),
    mf_name: z.string(),
    mf_pic: z.string(),
  })
  .optional();

export const PerformanceSchema = z
  .object({
    total_time_ms: z.coerce.number(),
    parallel_time_ms: z.coerce.number().optional(),
    rpc_time_ms: z.coerce.number().optional(),
    motorisations_count: z.coerce.number(),
    catalogue_famille_count: z.coerce.number().optional(),
    equipementiers_count: z.coerce.number().optional(),
    conseils_count: z.coerce.number().optional(),
    informations_count: z.coerce.number().optional(),
    guide_available: z.coerce.number().optional(),
  })
  .optional();

export const MotorisationsSchema = z
  .object({
    title: z.string(),
    items: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        image: z.string(),
        link: z.string(),
        marque_name: z.string(),
        modele_name: z.string(),
        type_name: z.string(),
        puissance: z.string(),
        periode: z.string(),
        advice: z.string(),
      }),
    ),
  })
  .optional();

export const CatalogueMameFamilleSchema = z
  .object({
    title: z.string(),
    items: z.array(
      z.object({
        name: z.string(),
        link: z.string(),
        image: z.string(),
        description: z.string(),
        meta_description: z.string(),
        sort: z.coerce.number().optional(),
      }),
    ),
  })
  .optional();

export const EquipementiersSchema = z
  .object({
    title: z.string(),
    items: z.array(
      z.object({
        pm_id: z.coerce.number(),
        pm_name: z.string(),
        pm_logo: z.string(),
        title: z.string(),
        image: z.string(),
        description: z.string(),
      }),
    ),
  })
  .optional();

export const ConseilsSchema = z
  .object({
    title: z.string(),
    content: z.string(),
    items: z.array(
      z.object({
        id: z.coerce.number(),
        title: z.string(),
        content: z.string(),
      }),
    ),
  })
  .optional();

export const InformationsSchema = z
  .object({
    title: z.string(),
    content: z.string(),
    items: z.array(z.string()),
  })
  .optional();

export const SeoSwitchesSchema = z
  .object({
    verbs: z.array(z.object({ id: z.string(), content: z.string() })),
    nouns: z.array(z.object({ id: z.string(), content: z.string() })),
    verbCount: z.coerce.number(),
    nounCount: z.coerce.number(),
  })
  .optional();

export const GuideSchema = z
  .object({
    id: z.coerce.number(),
    title: z.string(),
    alias: z.string(),
    preview: z.string(),
    wall: z.string().optional(),
    date: z.string(),
    image: z.string(),
    link: z.string().optional(),
    h2_content: z.string().optional(),
  })
  .optional();

// --- Tier 3 ---

const FaqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export const PurchaseGuideDataSchema = z
  .object({
    id: z.coerce.number(),
    pgId: z.string(),
    intro: z.object({
      title: z.string(),
      role: z.string(),
      syncParts: z.array(z.string()),
    }),
    risk: z.object({
      title: z.string(),
      explanation: z.string(),
      consequences: z.array(z.string()),
      costRange: z.string(),
      conclusion: z.string(),
    }),
    timing: z.object({
      title: z.string(),
      years: z.string(),
      km: z.string(),
      note: z.string(),
    }),
    arguments: z.array(
      z.object({ title: z.string(), content: z.string(), icon: z.string() }),
    ),
    h1Override: z.string().nullable().optional(),
    howToChoose: z.string().nullable().optional(),
    symptoms: z.array(z.string()).nullable().optional(),
    antiMistakes: z.array(z.string()).nullable().optional(),
    faq: z.array(FaqItemSchema).nullable().optional(),
    // R1 pipeline fields
    heroSubtitle: z.string().nullable().optional(),
    selectorMicrocopy: z.array(z.string()).nullable().optional(),
    microSeoBlock: z.string().nullable().optional(),
    compatibilitiesIntro: z.string().nullable().optional(),
    equipementiersLine: z.string().nullable().optional(),
    familyCrossSellIntro: z.string().nullable().optional(),
    interestNuggets: z
      .union([z.record(z.unknown()), z.array(z.record(z.unknown()))])
      .nullable()
      .optional(),
    safeTableRows: z
      .array(z.object({ element: z.string(), howToCheck: z.string() }))
      .nullable()
      .optional(),
    visualPlan: z
      .object({
        heroPrimaryCta: z
          .object({ label: z.string(), action: z.string().optional() })
          .optional(),
        crossSellRules: z
          .object({
            maxItems: z.number(),
            sameFamilyOnly: z.boolean().optional(),
          })
          .optional(),
        compatibilitiesLabelRule: z.string().optional(),
      })
      .nullable()
      .optional(),
    contentContract: z
      .object({
        totalWordsTarget: z.tuple([z.number(), z.number()]).optional(),
        microSeoWordsTarget: z.tuple([z.number(), z.number()]).optional(),
        faqAnswerWordsTarget: z.tuple([z.number(), z.number()]).optional(),
        maxGammeMentions: z.number().optional(),
        maxCompatibleMentions: z.number().optional(),
      })
      .nullable()
      .optional(),
    hardRules: z
      .object({
        banHowtoMarkers: z.array(z.string()).optional(),
        banAbsoluteClaims: z.array(z.string()).optional(),
        banPricePush: z.array(z.string()).optional(),
      })
      .nullable()
      .optional(),
  })
  .nullable()
  .optional();

export const GammeBuyingGuideSchema = z
  .object({
    compatibilityRules: z.array(z.string()).optional(),
    selectionCriteria: z
      .array(
        z.object({
          key: z.string(),
          label: z.string(),
          guidance: z.string(),
          priority: z.enum(["required", "recommended"]),
        }),
      )
      .optional(),
    trustArguments: z
      .array(
        z.object({
          title: z.string(),
          content: z.string(),
          icon: z.string().optional(),
        }),
      )
      .optional(),
    pairing: z
      .object({
        required: z.array(z.string()).optional(),
        recommended: z.array(z.string()).optional(),
        checks: z.array(z.string()).optional(),
      })
      .optional(),
    antiMistakes: z.array(z.string()).optional(),
    risk: z.object({ costRange: z.string().optional() }).optional(),
    faq: z.array(FaqItemSchema).optional(),
    useCases: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          recommendation: z.string(),
        }),
      )
      .optional(),
    decisionTree: z
      .array(
        z.object({
          id: z.string(),
          question: z.string(),
          options: z.array(
            z.object({
              label: z.string(),
              outcome: z.string(),
              note: z.string().optional(),
            }),
          ),
        }),
      )
      .optional(),
  })
  .nullable()
  .optional();

export const SubstitutionSchema = z
  .object({
    httpStatus: z.coerce.number(),
    lock: z
      .object({
        type: z.enum(["vehicle", "technology", "ambiguity", "precision"]),
        missing: z.string(),
        known: z.object({
          gamme: z
            .object({
              id: z.coerce.number(),
              name: z.string(),
              alias: z.string(),
            })
            .optional(),
          marque: z
            .object({ id: z.coerce.number(), name: z.string() })
            .optional(),
          modele: z
            .object({ id: z.coerce.number(), name: z.string() })
            .optional(),
        }),
        options: z.array(
          z.object({
            id: z.coerce.number(),
            label: z.string(),
            url: z.string(),
            description: z.string().optional(),
          }),
        ),
      })
      .optional(),
    substitute: z
      .object({
        piece_id: z.coerce.number(),
        name: z.string(),
        price: z.coerce.number(),
        priceFormatted: z.string().optional(),
        image: z.string().optional(),
        brand: z.string().optional(),
        ref: z.string().optional(),
        url: z.string(),
      })
      .optional(),
    relatedParts: z
      .array(
        z.object({
          pg_id: z.coerce.number(),
          pg_name: z.string(),
          pg_alias: z.string(),
          pg_pic: z.string().optional(),
          url: z.string(),
        }),
      )
      .optional(),
  })
  .nullable()
  .optional();

// --- Reference R4 (Tier 3) ---

export const ReferenceSchema = z
  .object({
    slug: z.string(),
    title: z.string(),
    definition: z.string(),
    roleMecanique: z.string().nullable(),
    canonicalUrl: z.string().nullable(),
  })
  .nullable()
  .optional();

// --- Map section name → schema (pour validation par section) ---

export const TIER2_SCHEMAS = {
  famille: FamilleSchema,
  performance: PerformanceSchema,
  motorisations: MotorisationsSchema,
  catalogueMameFamille: CatalogueMameFamilleSchema,
  equipementiers: EquipementiersSchema,
  conseils: ConseilsSchema,
  informations: InformationsSchema,
  seoSwitches: SeoSwitchesSchema,
  guide: GuideSchema,
} as const;

export const TIER3_SCHEMAS = {
  purchaseGuideData: PurchaseGuideDataSchema,
  gammeBuyingGuide: GammeBuyingGuideSchema,
  substitution: SubstitutionSchema,
  reference: ReferenceSchema,
} as const;
