/**
 * R4LintGatesService — Centralized content lint gates LG1-LG8 for R4 Reference pages.
 *
 * Same pattern as KeywordPlanGatesService (shared GateResult interface).
 * Validates generated content BEFORE write to __seo_reference.
 *
 * Imports forbidden terms and thresholds from r4-keyword-plan.constants.ts (single source of truth).
 */
import { Injectable } from '@nestjs/common';
import type { GateResult } from '../../../config/keyword-plan.constants';
import {
  R4_FORBIDDEN_FROM_R1,
  R4_FORBIDDEN_FROM_R3,
  R4_FORBIDDEN_FROM_R5,
  R4_FORBIDDEN_FROM_R6,
  R4_CONTENT_THRESHOLDS,
} from '../../../config/r4-keyword-plan.constants';

// ── Types ──

export interface R4LintInput {
  definition?: string;
  takeaways?: string[];
  role_mecanique?: string;
  composition?: string[];
  variants?: unknown;
  key_specs?: unknown;
  confusions_courantes?: string[];
  common_questions?: unknown[];
  role_negatif?: string;
  regles_metier?: string[];
  scope_limites?: string;
  /** Target keywords from KP (empty array if skip-kp mode) */
  targetKeywords: string[];
}

export interface R4LintResult {
  score: number;
  pass: boolean;
  gates: Record<string, { pass: boolean; penalty: number; details?: string }>;
  violations: string[];
}

// ── Filler phrases to detect (LG5) ──

const FILLER_PHRASES = [
  'joue un rôle essentiel',
  'joue un role essentiel',
  'il est important de',
  'il convient de',
  'en effet',
  'par conséquent',
  'de ce fait',
  'il est à noter que',
  'il est a noter que',
  'force est de constater',
  'dans le cadre de',
  'au niveau de',
  'en ce qui concerne',
  'il va sans dire',
] as const;

// ── Procedure headings to detect (LG2) ──

const PROCEDURE_PATTERNS = [
  /étape\s+\d/i,
  /etape\s+\d/i,
  /pas[\s-]à[\s-]pas/i,
  /pas[\s-]a[\s-]pas/i,
  /démontage/i,
  /demontage/i,
  /remontage/i,
  /montage\s/i,
  /installation\s/i,
  /procédure/i,
  /procedure/i,
  /comment\s+(changer|remplacer|installer|démonter|demonter)/i,
];

@Injectable()
export class R4LintGatesService {
  /**
   * Run all 8 lint gates on R4 content. Returns score 0-100 and pass/fail.
   */
  validate(input: R4LintInput): R4LintResult {
    const gates: R4LintResult['gates'] = {};
    const violations: string[] = [];

    // Assemble all text content for scanning
    const allText = this.assembleText(input);

    // LG1: Forbidden terms from R1/R3/R5/R6 — penalty 30
    const lg1 = this.checkForbiddenTerms(allText);
    gates['LG1_FORBIDDEN_TERMS'] = lg1;
    if (!lg1.pass && lg1.details) violations.push(lg1.details);

    // LG2: Procedure headings — penalty 20
    const lg2 = this.checkProcedureHeadings(allText);
    gates['LG2_PROCEDURE_HEADINGS'] = lg2;
    if (!lg2.pass && lg2.details) violations.push(lg2.details);

    // LG3: Target keywords present — penalty 10
    const lg3 = this.checkTargetKeywords(allText, input.targetKeywords);
    gates['LG3_TARGET_KEYWORDS'] = lg3;
    if (!lg3.pass && lg3.details) violations.push(lg3.details);

    // LG4: regles_metier format "Toujours/Ne jamais/Doit" — penalty 10
    const lg4 = this.checkRulesFormat(input.regles_metier);
    gates['LG4_RULES_FORMAT'] = lg4;
    if (!lg4.pass && lg4.details) violations.push(lg4.details);

    // LG5: Filler/generic phrases — penalty 10
    const lg5 = this.checkFillerPhrases(allText);
    gates['LG5_FILLER_PHRASES'] = lg5;
    if (!lg5.pass && lg5.details) violations.push(lg5.details);

    // LG6: FAQ answer length 25-60 words — penalty 5
    const lg6 = this.checkFaqLength(input.common_questions);
    gates['LG6_FAQ_LENGTH'] = lg6;
    if (!lg6.pass && lg6.details) violations.push(lg6.details);

    // LG7: key_specs disclaimer "selon véhicule" — penalty 5
    const lg7 = this.checkSpecsDisclaimer(input.key_specs);
    gates['LG7_SPECS_DISCLAIMER'] = lg7;
    if (!lg7.pass && lg7.details) violations.push(lg7.details);

    // LG8: Duplicate content across sections — penalty 10
    const lg8 = this.checkDuplicates(input);
    gates['LG8_DUPLICATES'] = lg8;
    if (!lg8.pass && lg8.details) violations.push(lg8.details);

    // Compute score: 100 - sum of penalties for failed gates
    const totalPenalty = Object.values(gates)
      .filter((g) => !g.pass)
      .reduce((sum, g) => sum + g.penalty, 0);

    const score = Math.max(0, 100 - totalPenalty);
    const pass = score >= R4_CONTENT_THRESHOLDS.minLintScore;

    return { score, pass, gates, violations };
  }

  /**
   * Convert a GateResult[] for compatibility with existing report format.
   */
  toGateResults(lintResult: R4LintResult): GateResult[] {
    return Object.entries(lintResult.gates).map(([gate, result]) => ({
      gate,
      status: result.pass ? ('pass' as const) : ('fail' as const),
      message: result.details ?? (result.pass ? 'OK' : 'Failed'),
    }));
  }

  // ── Private gate implementations ──

  private checkForbiddenTerms(text: string): {
    pass: boolean;
    penalty: number;
    details?: string;
  } {
    const textLower = text.toLowerCase();
    const allForbidden = [
      ...R4_FORBIDDEN_FROM_R1,
      ...R4_FORBIDDEN_FROM_R3,
      ...R4_FORBIDDEN_FROM_R5,
      ...R4_FORBIDDEN_FROM_R6,
    ];

    const found = allForbidden.filter((term) => textLower.includes(term));
    if (found.length === 0) {
      return { pass: true, penalty: 0 };
    }
    return {
      pass: false,
      penalty: 30,
      details: `LG1: ${found.length} forbidden terms found: ${found.slice(0, 5).join(', ')}`,
    };
  }

  private checkProcedureHeadings(text: string): {
    pass: boolean;
    penalty: number;
    details?: string;
  } {
    const matches = PROCEDURE_PATTERNS.filter((p) => p.test(text));
    if (matches.length === 0) {
      return { pass: true, penalty: 0 };
    }
    return {
      pass: false,
      penalty: 20,
      details: `LG2: ${matches.length} procedure pattern(s) detected`,
    };
  }

  private checkTargetKeywords(
    text: string,
    targetKeywords: string[],
  ): { pass: boolean; penalty: number; details?: string } {
    // Skip-KP mode: no keywords to check → auto-pass
    if (!targetKeywords || targetKeywords.length === 0) {
      return {
        pass: true,
        penalty: 0,
        details: 'LG3: skip-kp mode, gate disabled',
      };
    }

    const textLower = text.toLowerCase();
    const found = targetKeywords.filter((kw) =>
      textLower.includes(kw.toLowerCase()),
    );
    const ratio = found.length / targetKeywords.length;

    if (ratio >= 0.5) {
      return { pass: true, penalty: 0 };
    }
    return {
      pass: false,
      penalty: 10,
      details: `LG3: only ${found.length}/${targetKeywords.length} target keywords present (${Math.round(ratio * 100)}%, min 50%)`,
    };
  }

  private checkRulesFormat(reglesMetier?: string[]): {
    pass: boolean;
    penalty: number;
    details?: string;
  } {
    if (!reglesMetier || reglesMetier.length === 0) {
      return { pass: true, penalty: 0 }; // Section not present = skip
    }

    const validPrefixes = [
      'toujours',
      'ne jamais',
      'doit',
      'ne pas',
      'vérifier',
      'verifier',
      'respecter',
      'contrôler',
      'controler',
    ];

    const nonConforming = reglesMetier.filter((rule) => {
      const lower = rule.toLowerCase().trim();
      return !validPrefixes.some((prefix) => lower.startsWith(prefix));
    });

    if (nonConforming.length === 0) {
      return { pass: true, penalty: 0 };
    }
    return {
      pass: false,
      penalty: 10,
      details: `LG4: ${nonConforming.length}/${reglesMetier.length} rules missing imperative prefix (Toujours/Ne jamais/Doit)`,
    };
  }

  private checkFillerPhrases(text: string): {
    pass: boolean;
    penalty: number;
    details?: string;
  } {
    const textLower = text.toLowerCase();
    const found = FILLER_PHRASES.filter((phrase) => textLower.includes(phrase));
    if (found.length === 0) {
      return { pass: true, penalty: 0 };
    }
    return {
      pass: false,
      penalty: 10,
      details: `LG5: ${found.length} filler phrase(s): ${found.slice(0, 3).join(', ')}`,
    };
  }

  private checkFaqLength(commonQuestions?: unknown[]): {
    pass: boolean;
    penalty: number;
    details?: string;
  } {
    if (!commonQuestions || commonQuestions.length === 0) {
      return { pass: true, penalty: 0 }; // No FAQ to validate
    }

    let overLength = 0;
    for (const item of commonQuestions) {
      const answer =
        typeof item === 'object' && item !== null
          ? ((item as Record<string, unknown>).answer ??
            (item as Record<string, unknown>).reponse ??
            '')
          : '';
      const words = String(answer).split(/\s+/).filter(Boolean).length;
      if (words > 60) overLength++;
    }

    if (overLength === 0) {
      return { pass: true, penalty: 0 };
    }
    return {
      pass: false,
      penalty: 5,
      details: `LG6: ${overLength}/${commonQuestions.length} FAQ answers exceed 60 words`,
    };
  }

  private checkSpecsDisclaimer(keySpecs?: unknown): {
    pass: boolean;
    penalty: number;
    details?: string;
  } {
    if (!keySpecs) {
      return { pass: true, penalty: 0 }; // No specs to validate
    }

    const specsText = JSON.stringify(keySpecs).toLowerCase();
    const hasDisclaimer =
      specsText.includes('selon v') ||
      specsText.includes('vérifier constructeur') ||
      specsText.includes('verifier constructeur') ||
      specsText.includes('selon motorisation') ||
      specsText.includes('selon modèle') ||
      specsText.includes('selon modele');

    if (hasDisclaimer) {
      return { pass: true, penalty: 0 };
    }
    return {
      pass: false,
      penalty: 5,
      details:
        'LG7: key_specs missing "selon véhicule" or equivalent disclaimer',
    };
  }

  private checkDuplicates(input: R4LintInput): {
    pass: boolean;
    penalty: number;
    details?: string;
  } {
    // Extract meaningful text blocks for comparison
    const blocks: string[] = [];
    if (input.definition) blocks.push(input.definition);
    if (input.role_mecanique) blocks.push(input.role_mecanique);
    if (input.role_negatif) blocks.push(input.role_negatif);
    if (input.scope_limites) blocks.push(input.scope_limites);

    // Check for significant overlap (> 30 chars shared substring)
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        if (this.hasSignificantOverlap(blocks[i], blocks[j])) {
          return {
            pass: false,
            penalty: 10,
            details: `LG8: significant content duplication detected between sections`,
          };
        }
      }
    }

    return { pass: true, penalty: 0 };
  }

  // ── Helpers ──

  private assembleText(input: R4LintInput): string {
    const parts: string[] = [];
    if (input.definition) parts.push(input.definition);
    if (input.takeaways) parts.push(input.takeaways.join(' '));
    if (input.role_mecanique) parts.push(input.role_mecanique);
    if (input.composition) parts.push(input.composition.join(' '));
    if (input.confusions_courantes) {
      parts.push(
        Array.isArray(input.confusions_courantes)
          ? input.confusions_courantes.join(' ')
          : JSON.stringify(input.confusions_courantes),
      );
    }
    if (input.common_questions)
      parts.push(JSON.stringify(input.common_questions));
    if (input.role_negatif) parts.push(input.role_negatif);
    if (input.regles_metier) parts.push(input.regles_metier.join(' '));
    if (input.scope_limites) parts.push(input.scope_limites);
    if (input.key_specs) parts.push(JSON.stringify(input.key_specs));
    if (input.variants) parts.push(JSON.stringify(input.variants));
    return parts.join('\n');
  }

  private hasSignificantOverlap(a: string, b: string): boolean {
    // Use sliding window to find shared substrings > 40 chars
    const minLen = 40;
    const shorter = a.length < b.length ? a : b;
    const longer = a.length < b.length ? b : a;

    if (shorter.length < minLen) return false;

    for (let i = 0; i <= shorter.length - minLen; i += 10) {
      const chunk = shorter.slice(i, i + minLen);
      if (longer.includes(chunk)) return true;
    }
    return false;
  }
}
