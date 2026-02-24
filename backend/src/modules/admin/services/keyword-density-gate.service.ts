import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

// ── Service ──

@Injectable()
export class KeywordDensityGateService {
  private readonly logger = new Logger(KeywordDensityGateService.name);

  /** Minimum keyword density (%) — below = WARN */
  private readonly DENSITY_LOW = 0.5;
  /** Maximum keyword density (%) — above = WARN */
  private readonly DENSITY_HIGH = 2.5;
  /** Sliding window size (words) for stem-aware matching */
  private readonly WINDOW_SIZE = 10;
  /** Minimum token match ratio (tokens found / total keyword tokens) */
  private readonly MIN_TOKEN_RATIO = 0.66;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Expose current density rules/thresholds for API and reporting.
   */
  static getRulesMetadata() {
    return {
      density_rules_version: '1.0',
      density_target_min: 0.5,
      density_target_max: 2.5,
      window_size: 10,
      min_token_ratio: 0.66,
    };
  }

  /**
   * Check keyword density of the primary keyword in enriched content.
   *
   * Algorithm:
   * 1. Extract primary keyword from brief
   * 2. Strip HTML from content → plain text
   * 3. Tokenize keyword into significant tokens
   * 4. Sliding window (10 words) over text: count windows where >= 2/3 tokens match
   * 5. Density = matches / total_words * 100
   * 6. Verdict: <0.5% → WARN (low), 0.5-2.5% → PASS, >2.5% → WARN (stuffing)
   *    If keyword absent entirely → FAIL (in strict mode) or WARN (observe-only)
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
        warnThresholdLow: this.DENSITY_LOW,
        warnThresholdHigh: this.DENSITY_HIGH,
      };
    }

    const plainText = normalizeAccents(stripHtml(content).toLowerCase());
    const words = plainText.split(/\s+/).filter((w) => w.length > 0);
    const totalWords = words.length;

    if (totalWords === 0) {
      return {
        gate: 'keyword_density',
        verdict: 'FAIL',
        reason_code: 'EMPTY_CONTENT',
        details: ['Empty content — cannot measure density'],
        measured: 0,
        warnThresholdLow: this.DENSITY_LOW,
        warnThresholdHigh: this.DENSITY_HIGH,
      };
    }

    // Tokenize the keyword (skip very short tokens like "de", "a")
    const keywordTokens = normalizeAccents(keyword.toLowerCase())
      .split(/\s+/)
      .filter((t) => t.length > 2);

    if (keywordTokens.length === 0) {
      return {
        gate: 'keyword_density',
        verdict: 'PASS',
        reason_code: 'NO_KEYWORD',
        details: ['Keyword tokens all too short after filtering — skipping'],
        measured: 0,
        warnThresholdLow: this.DENSITY_LOW,
        warnThresholdHigh: this.DENSITY_HIGH,
      };
    }

    const requiredMatches = Math.ceil(
      keywordTokens.length * this.MIN_TOKEN_RATIO,
    );

    // Sliding window: count windows where enough keyword tokens are present
    let matchCount = 0;
    for (let i = 0; i <= totalWords - this.WINDOW_SIZE; i++) {
      const window = words.slice(i, i + this.WINDOW_SIZE);
      const windowSet = new Set(window);
      let tokenHits = 0;
      for (const token of keywordTokens) {
        if (windowSet.has(token)) tokenHits++;
      }
      if (tokenHits >= requiredMatches) {
        matchCount++;
      }
    }

    const density = (matchCount / totalWords) * 100;
    const details: string[] = [];
    let verdict: KeywordDensityResult['verdict'] = 'PASS';
    let reason_code: DensityReasonCode = 'KEYWORD_DENSITY_OK';

    if (matchCount === 0) {
      verdict = 'FAIL';
      reason_code = 'KEYWORD_ABSENT';
      details.push(
        `Keyword "${keyword}" absent du contenu (0 fenetres sur ${totalWords} mots). ` +
          `Tokens cherches: [${keywordTokens.join(', ')}]`,
      );
    } else if (density < this.DENSITY_LOW) {
      verdict = 'WARN';
      reason_code = 'KEYWORD_DENSITY_LOW';
      details.push(
        `Densite faible: ${density.toFixed(2)}% < ${this.DENSITY_LOW}% ` +
          `(${matchCount} fenetres / ${totalWords} mots)`,
      );
    } else if (density > this.DENSITY_HIGH) {
      verdict = 'WARN';
      reason_code = 'KEYWORD_DENSITY_HIGH';
      details.push(
        `Keyword stuffing: ${density.toFixed(2)}% > ${this.DENSITY_HIGH}% ` +
          `(${matchCount} fenetres / ${totalWords} mots)`,
      );
    } else {
      details.push(
        `Densite OK: ${density.toFixed(2)}% ` +
          `(${matchCount} fenetres / ${totalWords} mots, cible ${this.DENSITY_LOW}-${this.DENSITY_HIGH}%)`,
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
      warnThresholdLow: this.DENSITY_LOW,
      warnThresholdHigh: this.DENSITY_HIGH,
    };
  }

  /**
   * Whether Gate F is enabled (feature flag).
   */
  isEnabled(): boolean {
    return this.configService.get('KEYWORD_DENSITY_GATE_ENABLED') === 'true';
  }
}
