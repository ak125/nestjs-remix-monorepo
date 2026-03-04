/**
 * R1SectionPack — typed contract with centralized merge decisions.
 *
 * Each section resolves to exactly ONE source:
 * - "prompt"  : pipeline P3 content (sgpg_* non-empty, is_draft=false)
 * - "api"     : computed from API data (proofData, motorisations)
 * - "fallback": template or family-aware default
 *
 * No mixing pipeline + fallback for the same field.
 */
import { type R1PurchaseGuideData } from "~/utils/r1-builders";
import {
  inferFamilyKey,
  getDefaultCompatErrors,
  getDefaultSafeTableRows,
} from "~/utils/r1-family-defaults";
import { type FaqItem, resolveR1Faq } from "~/utils/r1-faq-merge";
import { type R1Proofs } from "~/utils/r1-reusable-content";

import { type R1Source } from "~/utils/r1-source-tracker";

// ─── Types ──────────────────────────────────────────────────────────

export interface R1SectionData<T> {
  data: T;
  source: R1Source;
}

interface SafeRow {
  element: string;
  howToCheck: string;
}

export interface R1SectionPack {
  version: 2;
  gammeId: number;
  generatedAt: string;
  sections: {
    hero: R1SectionData<{
      h1Override: string | null;
      heroSubtitle: string | null;
    }>;
    kpiCoverage: R1SectionData<R1Proofs | null>;
    buyArgs: R1SectionData<{
      microSeoBlock: string | null;
      arguments: Array<{
        title?: string;
        content?: string;
        icon?: string;
      }> | null;
    }>;
    faq: R1SectionData<FaqItem[]>;
    safeTable: R1SectionData<SafeRow[]>;
    compatErrors: R1SectionData<string[]>;
    motorisations: R1SectionData<{
      compatibilitiesIntro: string | null;
    }>;
    equipementiers: R1SectionData<{
      equipementiersLine: string | null;
    }>;
    catalogue: R1SectionData<{
      familyCrossSellIntro: string | null;
    }>;
    selectorMicrocopy: R1SectionData<string[] | null>;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function hasText(v?: string | null): boolean {
  return !!(v && v.trim().length > 0);
}

function hasArr(v?: unknown[] | null): boolean {
  return !!(v && v.length > 0);
}

// ─── Builder ────────────────────────────────────────────────────────

export function buildR1SectionPack(opts: {
  purchaseGuideData: R1PurchaseGuideData | undefined;
  proofData: R1Proofs | null;
  gammeName: string;
  familleName: string;
  gammeId: number;
  selectorFaq: FaqItem[];
}): R1SectionPack {
  const {
    purchaseGuideData: pgd,
    proofData,
    gammeName,
    familleName,
    gammeId,
    selectorFaq,
  } = opts;

  const familyKey = inferFamilyKey(gammeName, familleName);

  // ── Hero ──
  const heroHasPipeline =
    hasText(pgd?.h1Override) || hasText(pgd?.heroSubtitle);
  const hero: R1SectionPack["sections"]["hero"] = {
    data: {
      h1Override: pgd?.h1Override ?? null,
      heroSubtitle: pgd?.heroSubtitle ?? null,
    },
    source: heroHasPipeline ? "prompt" : "fallback",
  };

  // ── KPI Coverage ──
  const kpiCoverage: R1SectionPack["sections"]["kpiCoverage"] = {
    data: proofData,
    source: "api",
  };

  // ── Buy Args (microSeoBlock + arguments) ──
  const buyArgsHasPipeline = hasText(pgd?.microSeoBlock);
  const buyArgs: R1SectionPack["sections"]["buyArgs"] = {
    data: {
      microSeoBlock: buyArgsHasPipeline ? pgd!.microSeoBlock! : null,
      arguments: hasArr(pgd?.arguments) ? pgd!.arguments! : null,
    },
    source: buyArgsHasPipeline ? "prompt" : "fallback",
  };

  // ── FAQ (exclusive mode: pipeline ≥3 → pipeline only, else fallback) ──
  const faqResult = resolveR1Faq(pgd?.faq, selectorFaq);
  const faq: R1SectionPack["sections"]["faq"] = {
    data: faqResult.items,
    source: faqResult.source,
  };

  // ── Safe Table ──
  const safeTableHasPipeline = hasArr(pgd?.safeTableRows);
  const safeTable: R1SectionPack["sections"]["safeTable"] = safeTableHasPipeline
    ? { data: pgd!.safeTableRows!, source: "prompt" }
    : { data: getDefaultSafeTableRows(familyKey), source: "fallback" };

  // ── Compat Errors ──
  const compatErrorsHasPipeline = hasArr(pgd?.compatErrors);
  const compatErrors: R1SectionPack["sections"]["compatErrors"] =
    compatErrorsHasPipeline
      ? { data: pgd!.compatErrors!, source: "prompt" }
      : {
          data: getDefaultCompatErrors(gammeName, familyKey),
          source: "fallback",
        };

  // ── Motorisations intro ──
  const motorisations: R1SectionPack["sections"]["motorisations"] = {
    data: {
      compatibilitiesIntro: hasText(pgd?.compatibilitiesIntro)
        ? pgd!.compatibilitiesIntro!
        : null,
    },
    source: hasText(pgd?.compatibilitiesIntro) ? "prompt" : "fallback",
  };

  // ── Equipementiers intro ──
  const equipementiers: R1SectionPack["sections"]["equipementiers"] = {
    data: {
      equipementiersLine: hasText(pgd?.equipementiersLine)
        ? pgd!.equipementiersLine!
        : null,
    },
    source: hasText(pgd?.equipementiersLine) ? "prompt" : "fallback",
  };

  // ── Catalogue intro ──
  const catalogue: R1SectionPack["sections"]["catalogue"] = {
    data: {
      familyCrossSellIntro: hasText(pgd?.familyCrossSellIntro)
        ? pgd!.familyCrossSellIntro!
        : null,
    },
    source: hasText(pgd?.familyCrossSellIntro) ? "prompt" : "fallback",
  };

  // ── Selector Microcopy ──
  const selectorMicrocopy: R1SectionPack["sections"]["selectorMicrocopy"] = {
    data: hasArr(pgd?.selectorMicrocopy) ? pgd!.selectorMicrocopy! : null,
    source: hasArr(pgd?.selectorMicrocopy) ? "prompt" : "fallback",
  };

  return {
    version: 2,
    gammeId,
    generatedAt: new Date().toISOString(),
    sections: {
      hero,
      kpiCoverage,
      buyArgs,
      faq,
      safeTable,
      compatErrors,
      motorisations,
      equipementiers,
      catalogue,
      selectorMicrocopy,
    },
  };
}
