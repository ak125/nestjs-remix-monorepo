import { Injectable, Logger } from '@nestjs/common';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import type { PageBrief } from './page-brief.service';

// ── Types ──

export type DensityReasonCode =
  | 'KEYWORD_ABSENT'
  | 'KEYWORD_DENSITY_LOW'
  | 'KEYWORD_DENSITY_HIGH'
  | 'KEYWORD_DENSITY_OK'
  | 'NO_KEYWORD'
  | 'EMPTY_CONTENT';

export interface KeywordDensityResult {
  gate: 'keyword_density';
  verdict: 'PASS' | 'WARN' | 'FAIL';
  reason_code: DensityReasonCode;
  details: string[];
  measured: number;
  warnThresholdLow: number;
  warnThresholdHigh: number;
}

// ── Rules ──

/** Minimum keyword density (%) — below = WARN */
const DENSITY_LOW = 0.5;
/** Maximum keyword density (%) — above = WARN */
const DENSITY_HIGH = 2.5;
/** Span (words) within which the terms of a multi-term keyword must sit */
const WINDOW_SIZE = 10;
/** Minimum share of the keyword's terms that must be present (found / total) */
const MIN_TOKEN_RATIO = 0.66;

// ── Helpers ──

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Words of a text, lowercased and without accents. Splitting on anything that
 * is not a letter or a digit keeps punctuation from sticking to a word
 * ("frein." and "frein" are the same word).
 */
function tokenize(text: string): string[] {
  return normalizeAccents(text.toLowerCase())
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 0);
}

/**
 * Count the occurrences of a keyword in a text.
 *
 * An occurrence is `requiredMatches` distinct keyword terms found within
 * `WINDOW_SIZE` consecutive words. A word belongs to one occurrence at most:
 * once an occurrence is counted, the terms it used are forgotten, so the same
 * mention is never counted twice and back-to-back repetitions each count.
 */
function countOccurrences(
  words: string[],
  keywordTokens: string[],
  requiredMatches: number,
): number {
  const terms = new Set(keywordTokens);
  const lastSeenAt = new Map<string, number>();
  let occurrences = 0;

  for (let i = 0; i < words.length; i++) {
    if (!terms.has(words[i])) continue;
    lastSeenAt.set(words[i], i);

    let termsInSpan = 0;
    for (const position of lastSeenAt.values()) {
      if (i - position < WINDOW_SIZE) termsInSpan++;
    }
    if (termsInSpan >= requiredMatches) {
      occurrences++;
      lastSeenAt.clear();
    }
  }

  return occurrences;
}

// ── Service ──

@Injectable()
export class KeywordDensityGateService {
  private readonly logger = new Logger(KeywordDensityGateService.name);

  constructor(private readonly flags: FeatureFlagsService) {}

  /**
   * Expose current density rules/thresholds for API and reporting.
   */
  static getRulesMetadata() {
    return {
      density_rules_version: '1.1',
      density_target_min: DENSITY_LOW,
      density_target_max: DENSITY_HIGH,
      window_size: WINDOW_SIZE,
      min_token_ratio: MIN_TOKEN_RATIO,
    };
  }

  /**
   * Check keyword density of the primary keyword in enriched content.
   *
   * Algorithm:
   * 1. Extract primary keyword from brief
   * 2. Strip HTML from content, split it into words
   * 3. Split the keyword into significant terms (3 letters or more)
   * 4. Count occurrences: at least 2/3 of the terms within 10 consecutive
   *    words, each word counted in one occurrence at most
   * 5. Density = occurrences / total_words * 100
   * 6. Verdict: keyword absent → FAIL, <0.5% → WARN (low), 0.5-2.5% → PASS,
   *    >2.5% → WARN (stuffing)
   *
   * Terms are matched as written: no stemming, so a plural does not match
   * its singular.
   */
  check(content: string, brief: PageBrief): KeywordDensityResult {
    const keyword = brief.keywords_primary;

    if (!keyword || keyword.trim().length === 0) {
      return {
        gate: 'keyword_density',
        verdict: 'PASS',
        reason_code: 'NO_KEYWORD',
        details: ['No keywords_primary in brief — skipping density check'],
        measured: 0,
        warnThresholdLow: DENSITY_LOW,
        warnThresholdHigh: DENSITY_HIGH,
      };
    }

    const words = tokenize(stripHtml(content));
    const totalWords = words.length;

    if (totalWords === 0) {
      return {
        gate: 'keyword_density',
        verdict: 'FAIL',
        reason_code: 'EMPTY_CONTENT',
        details: ['Empty content — cannot measure density'],
        measured: 0,
        warnThresholdLow: DENSITY_LOW,
        warnThresholdHigh: DENSITY_HIGH,
      };
    }

    // Distinct keyword terms (skip very short ones like "de", "a")
    const keywordTokens = [
      ...new Set(tokenize(keyword).filter((t) => t.length > 2)),
    ];

    if (keywordTokens.length === 0) {
      return {
        gate: 'keyword_density',
        verdict: 'PASS',
        reason_code: 'NO_KEYWORD',
        details: ['Keyword tokens all too short after filtering — skipping'],
        measured: 0,
        warnThresholdLow: DENSITY_LOW,
        warnThresholdHigh: DENSITY_HIGH,
      };
    }

    const requiredMatches = Math.ceil(keywordTokens.length * MIN_TOKEN_RATIO);
    const matchCount = countOccurrences(words, keywordTokens, requiredMatches);
    const density = (matchCount * 100) / totalWords;
    const details: string[] = [];
    let verdict: KeywordDensityResult['verdict'] = 'PASS';
    let reason_code: DensityReasonCode = 'KEYWORD_DENSITY_OK';

    if (matchCount === 0) {
      verdict = 'FAIL';
      reason_code = 'KEYWORD_ABSENT';
      details.push(
        `Keyword "${keyword}" absent du contenu (0 occurrence sur ${totalWords} mots). ` +
          `Tokens cherches: [${keywordTokens.join(', ')}]`,
      );
    } else if (density < DENSITY_LOW) {
      verdict = 'WARN';
      reason_code = 'KEYWORD_DENSITY_LOW';
      details.push(
        `Densite faible: ${density.toFixed(2)}% < ${DENSITY_LOW}% ` +
          `(${matchCount} occurrences / ${totalWords} mots)`,
      );
    } else if (density > DENSITY_HIGH) {
      verdict = 'WARN';
      reason_code = 'KEYWORD_DENSITY_HIGH';
      details.push(
        `Keyword stuffing: ${density.toFixed(2)}% > ${DENSITY_HIGH}% ` +
          `(${matchCount} occurrences / ${totalWords} mots)`,
      );
    } else {
      details.push(
        `Densite OK: ${density.toFixed(2)}% ` +
          `(${matchCount} occurrences / ${totalWords} mots, cible ${DENSITY_LOW}-${DENSITY_HIGH}%)`,
      );
    }

    this.logger.debug(
      JSON.stringify({
        event: 'keyword_density_check',
        keyword,
        totalWords,
        matchCount,
        density: density.toFixed(2),
        verdict,
        reason_code,
      }),
    );

    return {
      gate: 'keyword_density',
      verdict,
      reason_code,
      details,
      measured: parseFloat(density.toFixed(2)),
      warnThresholdLow: DENSITY_LOW,
      warnThresholdHigh: DENSITY_HIGH,
    };
  }

  /**
   * Whether Gate F is enabled (feature flag).
   */
  isEnabled(): boolean {
    return this.flags.keywordDensityGateEnabled;
  }
}
