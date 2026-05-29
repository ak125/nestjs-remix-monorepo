/**
 * Jest mock for @repo/database-types
 *
 * The real package emits ESM (export *) which Jest can't parse.
 * This mock provides the TABLES constant used by PaymentDataService
 * and other services so that module resolution succeeds.
 */
export const TABLES = {
  xtr_order: 'xtr_order',
  xtr_customer: 'xtr_customer',
  xtr_product: 'xtr_product',
  ic_postback: 'ic_postback',
} as Record<string, string>;

// Re-export empty placeholders for other named exports
export const COLUMNS = {} as Record<string, Record<string, string>>;

// FAMILY_REGISTRY mock — minimal shape matching the real registry
// Used by buying-guide-quality.constants.ts, seo-v4.types.ts, etc.
export const FAMILY_REGISTRY: Record<
  number,
  {
    baseColor: string;
    gradient: string;
    icon: string;
    emoji: string;
    pic: string;
    domain: string;
    keywords: string[];
    seoTerms: string[];
    seoSwitch: string;
  }
> = {
  1: {
    baseColor: 'blue',
    gradient: 'from-blue-500 to-blue-700',
    icon: 'Filter',
    emoji: '🛢️',
    pic: 'Filtres.webp',
    domain: 'moteur',
    keywords: ['filtre'],
    seoTerms: ['filtre'],
    seoSwitch: 'nos pièces de qualité',
  },
  2: {
    baseColor: 'red',
    gradient: 'from-red-600 to-rose-700',
    icon: 'Disc',
    emoji: '🛞',
    pic: 'Freinage.webp',
    domain: 'chassis',
    keywords: ['frein', 'freinage'],
    seoTerms: ['frein', 'freinage'],
    seoSwitch: 'nos pièces de qualité',
  },
};

// Utility functions from the real package
export function findFamilyIdByKeyword(_keyword: string): number | null {
  return null;
}

export const FAMILY_DOMAIN_GROUPS: Record<string, number[]> = {
  moteur: [1],
  chassis: [2],
};

// Mini-CRM V0 — leads (cf. packages/database-types/src/leads.ts).
// Mirror exact des constantes du package pour que LeadsService et ses tests
// partagent la même invariant de transitions.
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'quoted',
  'won',
  'lost',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_TRANSITIONS: Readonly<
  Record<LeadStatus, readonly LeadStatus[]>
> = {
  new: ['contacted', 'lost'],
  contacted: ['quoted', 'won', 'lost'],
  quoted: ['won', 'lost', 'contacted'],
  won: [],
  lost: ['new'],
} as const;

export function isValidLeadTransition(
  from: LeadStatus,
  to: LeadStatus,
): boolean {
  if (from === to) return true;
  return LEAD_TRANSITIONS[from].includes(to);
}
