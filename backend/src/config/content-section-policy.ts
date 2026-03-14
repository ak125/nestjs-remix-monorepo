/**
 * Content Section Policy v1.0
 *
 * Defines ownership and constraints per section × role.
 * Used by SectionCompilerService to enforce anti-cannibalization.
 *
 * Git-versioned (not in DB) — changes require code review.
 */

export const POLICY_VERSION = '1.0';

// ── Types ──

export type SectionMode = 'full' | 'summary' | 'link_only' | 'forbidden';
export type ContentSource = 'db' | 'rag' | 'ai' | 'static';
export type FallbackStrategy = 'empty' | 'static_template' | 'rag_only';

/**
 * @internal Legacy type — use RoleId from role-ids.ts for new code.
 * 'R3_guide' here means "guide d'achat" (canonically R6_GUIDE_ACHAT),
 * NOT "R3 how-to/guide technique". See pageRoleToRoleId() bridge.
 */
export type PageRole = 'R1' | 'R3_guide' | 'R3_conseils' | 'R4' | 'R5';

export interface SectionPolicy {
  /** Which role owns this section (full authority) */
  owner: PageRole;
  /** Allowed content sources in priority order */
  allowedSources: ContentSource[];
  /** Is AI generation allowed for this section? */
  aiAllowed: boolean;
  /** If AI is allowed, does it require an active brief? */
  aiRequiresBrief: boolean;
  /** Must content be backed by evidence pack entries? */
  evidenceRequired: boolean;
  /** Max word count per role (0 = forbidden) */
  maxWords: Partial<Record<PageRole, number>>;
  /** Content mode per role */
  mode: Partial<Record<PageRole, SectionMode>>;
  /** What to do when owner has no content */
  fallbackStrategy: FallbackStrategy;
  /** FAQ: intent patterns per role (only for 'faq' section) */
  faqIntentPatterns?: Partial<Record<PageRole, RegExp[]>>;
}

// ── Section Policies ──

export const SECTION_POLICIES: Record<string, SectionPolicy> = {
  // ─── R3 guide-owned sections ───

  intro_role: {
    owner: 'R3_guide',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 40, R3_guide: 200, R3_conseils: 150, R4: 100, R5: 0 },
    mode: {
      R1: 'summary',
      R3_guide: 'full',
      R3_conseils: 'summary',
      R4: 'summary',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  risk: {
    owner: 'R3_guide',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 60, R3_guide: 300, R3_conseils: 0, R4: 80, R5: 0 },
    mode: {
      R1: 'summary',
      R3_guide: 'full',
      R3_conseils: 'forbidden',
      R4: 'summary',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  timing: {
    owner: 'R3_guide',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 60, R3_guide: 200, R3_conseils: 150, R4: 0, R5: 0 },
    mode: {
      R1: 'summary',
      R3_guide: 'full',
      R3_conseils: 'summary',
      R4: 'forbidden',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  how_to_choose: {
    owner: 'R3_guide',
    allowedSources: ['db', 'rag', 'ai'],
    aiAllowed: true,
    aiRequiresBrief: true,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 400, R3_conseils: 200, R4: 0, R5: 0 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'full',
      R3_conseils: 'summary',
      R4: 'forbidden',
      R5: 'forbidden',
    },
    fallbackStrategy: 'static_template',
  },

  selection_criteria: {
    owner: 'R3_guide',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 400, R3_conseils: 0, R4: 0, R5: 0 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'full',
      R3_conseils: 'forbidden',
      R4: 'forbidden',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  decision_tree: {
    owner: 'R3_guide',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 300, R3_conseils: 0, R4: 0, R5: 0 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'full',
      R3_conseils: 'forbidden',
      R4: 'forbidden',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  anti_mistakes: {
    owner: 'R3_guide',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 300, R3_conseils: 0, R4: 0, R5: 0 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'full',
      R3_conseils: 'forbidden',
      R4: 'forbidden',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  use_cases: {
    owner: 'R3_guide',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 300, R3_conseils: 0, R4: 0, R5: 0 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'full',
      R3_conseils: 'forbidden',
      R4: 'forbidden',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  faq: {
    owner: 'R3_guide',
    allowedSources: ['db', 'rag', 'ai'],
    aiAllowed: true,
    aiRequiresBrief: true,
    evidenceRequired: false,
    maxWords: { R1: 200, R3_guide: 600, R3_conseils: 400, R4: 0, R5: 200 },
    mode: {
      R1: 'summary',
      R3_guide: 'full',
      R3_conseils: 'full',
      R4: 'forbidden',
      R5: 'summary',
    },
    fallbackStrategy: 'static_template',
    faqIntentPatterns: {
      R1: [/achat|prix|livraison|compatibil|garantie/i],
      R3_guide: [/choisir|comparer|erreur|crit[eè]re|diff[eé]rence/i],
      R5: [/sympt[oô]me|test|risque|diagnostic|voyant/i],
    },
  },

  // ─── R5-owned sections ───

  symptoms: {
    owner: 'R5',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 60, R3_guide: 120, R3_conseils: 120, R4: 40, R5: 400 },
    mode: {
      R1: 'link_only',
      R3_guide: 'summary',
      R3_conseils: 'summary',
      R4: 'summary',
      R5: 'full',
    },
    fallbackStrategy: 'empty',
  },

  perception: {
    owner: 'R5',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 0, R3_conseils: 0, R4: 0, R5: 300 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'forbidden',
      R3_conseils: 'forbidden',
      R4: 'forbidden',
      R5: 'full',
    },
    fallbackStrategy: 'empty',
  },

  sign_test: {
    owner: 'R5',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 0, R3_conseils: 0, R4: 0, R5: 400 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'forbidden',
      R3_conseils: 'forbidden',
      R4: 'forbidden',
      R5: 'full',
    },
    fallbackStrategy: 'empty',
  },

  obd_codes: {
    owner: 'R5',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 0, R3_conseils: 0, R4: 0, R5: 300 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'forbidden',
      R3_conseils: 'forbidden',
      R4: 'forbidden',
      R5: 'full',
    },
    fallbackStrategy: 'empty',
  },

  costs: {
    owner: 'R5',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: true,
    maxWords: { R1: 0, R3_guide: 0, R3_conseils: 100, R4: 0, R5: 300 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'forbidden',
      R3_conseils: 'summary',
      R4: 'forbidden',
      R5: 'full',
    },
    fallbackStrategy: 'empty',
  },

  // ─── R4-owned sections ───

  composition: {
    owner: 'R4',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 0, R3_conseils: 0, R4: 400, R5: 0 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'forbidden',
      R3_conseils: 'forbidden',
      R4: 'full',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  confusions: {
    owner: 'R4',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 0, R3_conseils: 0, R4: 400, R5: 0 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'forbidden',
      R3_conseils: 'forbidden',
      R4: 'full',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  regles_metier: {
    owner: 'R4',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 0, R3_guide: 0, R3_conseils: 0, R4: 400, R5: 0 },
    mode: {
      R1: 'forbidden',
      R3_guide: 'forbidden',
      R3_conseils: 'forbidden',
      R4: 'full',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  // ─── R1-owned sections ───

  buy_args: {
    owner: 'R1',
    allowedSources: ['db'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 400, R3_guide: 0, R3_conseils: 0, R4: 0, R5: 0 },
    mode: {
      R1: 'full',
      R3_guide: 'forbidden',
      R3_conseils: 'forbidden',
      R4: 'forbidden',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  equipementiers: {
    owner: 'R1',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 300, R3_guide: 0, R3_conseils: 0, R4: 0, R5: 0 },
    mode: {
      R1: 'full',
      R3_guide: 'forbidden',
      R3_conseils: 'forbidden',
      R4: 'forbidden',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },

  motorisations: {
    owner: 'R1',
    allowedSources: ['db', 'rag'],
    aiAllowed: false,
    aiRequiresBrief: false,
    evidenceRequired: false,
    maxWords: { R1: 300, R3_guide: 0, R3_conseils: 0, R4: 0, R5: 0 },
    mode: {
      R1: 'full',
      R3_guide: 'forbidden',
      R3_conseils: 'forbidden',
      R4: 'forbidden',
      R5: 'forbidden',
    },
    fallbackStrategy: 'empty',
  },
};

// ── Helpers ──

/** Get the policy for a section, or null if unknown section */
export function getSectionPolicy(sectionKey: string): SectionPolicy | null {
  return SECTION_POLICIES[sectionKey] ?? null;
}

/** Get the mode for a section × role pair */
export function getSectionMode(
  sectionKey: string,
  role: PageRole,
): SectionMode {
  const policy = SECTION_POLICIES[sectionKey];
  if (!policy) return 'forbidden';
  return policy.mode[role] ?? 'forbidden';
}

/** Get max word count for a section × role pair */
export function getMaxWords(sectionKey: string, role: PageRole): number {
  const policy = SECTION_POLICIES[sectionKey];
  if (!policy) return 0;
  return policy.maxWords[role] ?? 0;
}

/** Check if AI generation is allowed for this section */
export function isAiAllowed(sectionKey: string, hasBrief: boolean): boolean {
  const policy = SECTION_POLICIES[sectionKey];
  if (!policy) return false;
  if (!policy.aiAllowed) return false;
  if (policy.aiRequiresBrief && !hasBrief) return false;
  return true;
}

/** Map page_type to PageRole */
export function pageTypeToRole(pageType: string): PageRole | null {
  const map: Record<string, PageRole> = {
    R1_pieces: 'R1',
    R3_guide_howto: 'R3_guide',
    R3_conseils: 'R3_conseils',
    R4_reference: 'R4',
    R5_diagnostic: 'R5',
  };
  return map[pageType] ?? null;
}

// ── Bridge: PageRole ↔ canonical RoleId ──

import { RoleId } from './role-ids';

const PAGE_ROLE_TO_ROLE_ID: Record<PageRole, RoleId> = {
  R1: RoleId.R1_ROUTER,
  R3_guide: RoleId.R6_GUIDE_ACHAT, // "guide d'achat" = R6, NOT R3
  R3_conseils: RoleId.R3_CONSEILS,
  R4: RoleId.R4_REFERENCE,
  R5: RoleId.R5_DIAGNOSTIC,
};

const ROLE_ID_TO_PAGE_ROLE: Partial<Record<RoleId, PageRole>> = {
  [RoleId.R1_ROUTER]: 'R1',
  [RoleId.R6_GUIDE_ACHAT]: 'R3_guide',
  [RoleId.R3_CONSEILS]: 'R3_conseils',
  [RoleId.R4_REFERENCE]: 'R4',
  [RoleId.R5_DIAGNOSTIC]: 'R5',
};

/** Convert a legacy PageRole to canonical RoleId. */
export function pageRoleToRoleId(role: PageRole): RoleId {
  return PAGE_ROLE_TO_ROLE_ID[role];
}

/** Convert a canonical RoleId to legacy PageRole. Returns null for roles without a PageRole equivalent. */
export function roleIdToPageRole(roleId: RoleId): PageRole | null {
  return ROLE_ID_TO_PAGE_ROLE[roleId] ?? null;
}

// ── Phase 2 Section Eligibility (P2.2) ──

import type {
  SectionEligibility,
  SectionEligibilityEntry,
} from '../workers/types/content-refresh.types';

/**
 * Per-section claim limits by role.
 * Max number of numeric/factual claims allowed in a section for a given role.
 * Sections not listed have no explicit limit.
 */
export const SECTION_CLAIM_LIMITS: Partial<
  Record<string, Partial<Record<PageRole, number>>>
> = {
  intro_role: { R3_guide: 3, R1: 1, R3_conseils: 2, R4: 1 },
  risk: { R3_guide: 5, R1: 2 },
  timing: { R3_guide: 3, R3_conseils: 2 },
  how_to_choose: { R3_guide: 4, R3_conseils: 2 },
  costs: { R5: 4, R3_conseils: 2 },
  faq: { R3_guide: 6, R3_conseils: 4, R1: 3, R5: 3 },
  symptoms: { R5: 5 },
  composition: { R4: 4 },
};

/**
 * Compute section eligibility for a given section × role × evidence context.
 *
 * @see .spec/00-canon/phase2-canon.md v1.1.0 — P2.2 Generation structuree
 */
export function computeSectionEligibility(
  sectionKey: string,
  role: PageRole,
  evidenceCount: number,
  hasActiveBrief: boolean,
): SectionEligibilityEntry {
  const policy = SECTION_POLICIES[sectionKey];

  // Unknown section
  if (!policy) {
    return {
      sectionKey,
      eligibility: 'BLOCKED' as SectionEligibility,
      reason: 'Unknown section key',
      claimLimit: 0,
      evidenceCount,
    };
  }

  const mode = policy.mode[role];
  const maxWords = policy.maxWords[role] ?? 0;
  const claimLimit = SECTION_CLAIM_LIMITS[sectionKey]?.[role] ?? 99;

  // Explicitly forbidden by mode
  if (mode === 'forbidden') {
    return {
      sectionKey,
      eligibility: 'BLOCKED' as SectionEligibility,
      reason: `Mode is forbidden for role ${role}`,
      claimLimit: 0,
      evidenceCount,
    };
  }

  // Zero max words = out of role
  if (maxWords === 0) {
    return {
      sectionKey,
      eligibility: 'OUT_OF_ROLE' as SectionEligibility,
      reason: `maxWords=0 for role ${role}`,
      claimLimit: 0,
      evidenceCount,
    };
  }

  // Evidence required but missing
  if (policy.evidenceRequired && evidenceCount === 0) {
    return {
      sectionKey,
      eligibility: 'MISSING_EVIDENCE' as SectionEligibility,
      reason: 'Evidence required but none available',
      claimLimit,
      evidenceCount,
    };
  }

  // AI requires brief but no brief available
  if (policy.aiAllowed && policy.aiRequiresBrief && !hasActiveBrief) {
    return {
      sectionKey,
      eligibility: 'ELIGIBLE_WITH_LIMITS' as SectionEligibility,
      reason: 'AI generation requires brief (missing)',
      claimLimit,
      evidenceCount,
    };
  }

  // Summary or link_only mode = limited
  if (mode === 'summary' || mode === 'link_only' || maxWords < 150) {
    return {
      sectionKey,
      eligibility: 'ELIGIBLE_WITH_LIMITS' as SectionEligibility,
      reason: `Mode=${mode ?? 'default'}, maxWords=${maxWords}`,
      claimLimit,
      evidenceCount,
    };
  }

  // Full eligibility
  return {
    sectionKey,
    eligibility: 'ELIGIBLE' as SectionEligibility,
    reason: 'Full eligibility',
    claimLimit,
    evidenceCount,
  };
}
