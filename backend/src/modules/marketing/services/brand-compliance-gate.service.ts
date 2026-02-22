import { Injectable, Logger } from '@nestjs/common';
import { MarketingHubDataService } from './marketing-hub-data.service';
import type {
  SocialPost,
  SocialChannel,
  GateSummary,
  BrandGateResult,
  ComplianceGateResult,
  GateViolation,
  ComplianceCheck,
  GateLevel,
  BrandRule,
} from '../interfaces/marketing-hub.interfaces';

/**
 * Brand & Compliance Gate Service.
 * Pattern: PASS / WARN / FAIL (mirror of BriefGatesService for SEO).
 *
 * Gate A (Brand Voice): language, tone, emojis, competitors, claims, brand mention
 * Gate B (Compliance): UTM, CTA, hashtags, caption length, dimensions, price/delivery sources
 *
 * WARN = approuvable, FAIL = bloquant
 */
@Injectable()
export class BrandComplianceGateService {
  private readonly logger = new Logger(BrandComplianceGateService.name);

  constructor(private readonly hubData: MarketingHubDataService) {}

  /**
   * Run full gate evaluation on a social post.
   */
  async evaluate(post: SocialPost): Promise<GateSummary> {
    const rules = await this.hubData.getActiveBrandRules(post.primary_channel);

    const brand = this.runBrandGate(post, rules);
    const compliance = this.runComplianceGate(post, rules);

    const blockingIssues = [
      ...brand.violations
        .filter((v) => v.severity === 'block')
        .map((v) => v.message),
      ...compliance.checks
        .filter((c) => c.level === 'FAIL')
        .map((c) => c.details),
    ];

    const summary: GateSummary = {
      brand,
      compliance,
      can_approve: blockingIssues.length === 0,
      blocking_issues: blockingIssues,
    };

    return summary;
  }

  /**
   * Evaluate and persist gate results.
   */
  async evaluateAndPersist(post: SocialPost): Promise<GateSummary> {
    const summary = await this.evaluate(post);

    // Calculate quality score (0-100)
    const brandScore =
      summary.brand.level === 'PASS'
        ? 100
        : summary.brand.level === 'WARN'
          ? 70
          : 0;
    const complianceScore =
      summary.compliance.level === 'PASS'
        ? 100
        : summary.compliance.level === 'WARN'
          ? 70
          : 0;
    const qualityScore = (brandScore + complianceScore) / 2;

    await this.hubData.updatePostGates(post.id, summary, qualityScore);

    this.logger.log(
      `Post ${post.id}: brand=${summary.brand.level} compliance=${summary.compliance.level} score=${qualityScore} approve=${summary.can_approve}`,
    );

    return summary;
  }

  // ── Brand Gate ──

  private runBrandGate(post: SocialPost, rules: BrandRule[]): BrandGateResult {
    const violations: GateViolation[] = [];
    const warnings: GateViolation[] = [];
    const fixSuggestions: string[] = [];

    const channels = post.channels as Record<
      string,
      Record<string, string | string[] | boolean | undefined>
    >;
    const channelData = channels?.[post.primary_channel];
    const caption = String(channelData?.caption || '');

    // 1. Language check
    this.checkLanguage(caption, rules, violations, warnings, fixSuggestions);

    // 2. Emoji count
    this.checkEmojis(caption, rules, warnings, fixSuggestions);

    // 3. Competitor mentions
    this.checkCompetitors(caption, rules, violations);

    // 4. Forbidden superlatives
    this.checkForbiddenWords(caption, rules, violations, warnings);

    // 5. Brand mention
    this.checkBrandMention(caption, rules, warnings, fixSuggestions);

    const level: GateLevel = violations.some((v) => v.severity === 'block')
      ? 'FAIL'
      : warnings.length > 0
        ? 'WARN'
        : 'PASS';

    return { level, violations, warnings, fix_suggestions: fixSuggestions };
  }

  // ── Compliance Gate ──

  private runComplianceGate(
    post: SocialPost,
    rules: BrandRule[],
  ): ComplianceGateResult {
    const checks: ComplianceCheck[] = [];
    const channels = post.channels as Record<
      string,
      Record<string, string | string[] | boolean | undefined>
    >;
    const channelData = channels?.[post.primary_channel];
    const caption = String(channelData?.caption || '');
    const hashtags = (channelData?.hashtags || []) as string[];

    // 1. UTM present
    checks.push(this.checkUTM(post));

    // 2. CTA present
    checks.push(this.checkCTA(caption));

    // 3. Hashtag count
    checks.push(this.checkHashtags(post.primary_channel, hashtags, rules));

    // 4. Caption length
    checks.push(
      this.checkCaptionLength(
        post.primary_channel,
        caption,
        channelData,
        rules,
      ),
    );

    const level: GateLevel = checks.some((c) => c.level === 'FAIL')
      ? 'FAIL'
      : checks.some((c) => c.level === 'WARN')
        ? 'WARN'
        : 'PASS';

    return { level, checks };
  }

  // ── Individual checks ──

  private checkLanguage(
    caption: string,
    rules: BrandRule[],
    violations: GateViolation[],
    warnings: GateViolation[],
    fixes: string[],
  ) {
    const langRule = rules.find((r) => r.rule_key === 'language');
    if (!langRule) return;

    const patterns =
      (langRule.rule_value as { forbidden_patterns?: string[] })
        .forbidden_patterns || [];
    for (const pattern of patterns) {
      if (caption.toLowerCase().includes(pattern.toLowerCase())) {
        const v: GateViolation = {
          rule_key: 'language',
          rule_type: 'tone',
          severity: langRule.severity,
          message: `Anglicisme detecte : "${pattern}"`,
          snippet: pattern,
          fix_suggestion: `Remplacer "${pattern}" par un equivalent francais`,
        };
        if (langRule.severity === 'block') violations.push(v);
        else warnings.push(v);
        fixes.push(v.fix_suggestion!);
      }
    }
  }

  private checkEmojis(
    caption: string,
    rules: BrandRule[],
    warnings: GateViolation[],
    fixes: string[],
  ) {
    const emojiRule = rules.find((r) => r.rule_key === 'emoji_count');
    if (!emojiRule) return;

    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const emojiCount = (caption.match(emojiRegex) || []).length;
    const { min, max } = emojiRule.rule_value as { min: number; max: number };

    if (emojiCount > max || emojiCount < min) {
      const v: GateViolation = {
        rule_key: 'emoji_count',
        rule_type: 'tone',
        severity: emojiCount > max + 2 || emojiCount === 0 ? 'block' : 'warn',
        message: `Emojis: ${emojiCount} (attendu ${min}-${max})`,
        fix_suggestion: `Ajuster a ${min}-${max} emojis en debut de ligne`,
      };
      warnings.push(v);
      fixes.push(v.fix_suggestion!);
    }
  }

  private checkCompetitors(
    caption: string,
    rules: BrandRule[],
    violations: GateViolation[],
  ) {
    const compRule = rules.find((r) => r.rule_key === 'competitors');
    if (!compRule) return;

    const words = (compRule.rule_value as { words?: string[] }).words || [];
    for (const word of words) {
      if (caption.toLowerCase().includes(word.toLowerCase())) {
        violations.push({
          rule_key: 'competitors',
          rule_type: 'forbidden_word',
          severity: 'block',
          message: `Mention concurrent detectee : "${word}"`,
          snippet: word,
          fix_suggestion: `Supprimer toute reference a "${word}"`,
        });
      }
    }
  }

  private checkForbiddenWords(
    caption: string,
    rules: BrandRule[],
    violations: GateViolation[],
    warnings: GateViolation[],
  ) {
    const forbiddenRules = rules.filter(
      (r) => r.rule_type === 'forbidden_word' && r.rule_key !== 'competitors',
    );
    for (const rule of forbiddenRules) {
      const words = (rule.rule_value as { words?: string[] }).words || [];
      for (const word of words) {
        if (caption.toLowerCase().includes(word.toLowerCase())) {
          const v: GateViolation = {
            rule_key: rule.rule_key,
            rule_type: 'forbidden_word',
            severity: rule.severity,
            message: `Mot interdit : "${word}"`,
            snippet: word,
            fix_suggestion: `Supprimer ou reformuler "${word}"`,
          };
          if (rule.severity === 'block') violations.push(v);
          else warnings.push(v);
        }
      }
    }
  }

  private checkBrandMention(
    caption: string,
    rules: BrandRule[],
    warnings: GateViolation[],
    fixes: string[],
  ) {
    const brandRule = rules.find((r) => r.rule_key === 'brand_mention');
    if (!brandRule) return;

    const patterns =
      (brandRule.rule_value as { patterns?: string[] }).patterns || [];
    const found = patterns.some((p: string) =>
      caption.toLowerCase().includes(p.toLowerCase()),
    );

    if (!found) {
      const v: GateViolation = {
        rule_key: 'brand_mention',
        rule_type: 'required_element',
        severity: 'warn',
        message: 'Aucune mention de la marque Automecanik',
        fix_suggestion:
          'Ajouter "Automecanik" ou "automecanik.com" dans le texte',
      };
      warnings.push(v);
      fixes.push(v.fix_suggestion!);
    }
  }

  private checkUTM(post: SocialPost): ComplianceCheck {
    const hasUTM = post.utm_campaign && post.utm_source && post.utm_medium;
    return {
      check: 'UTM parameters',
      level: hasUTM ? 'PASS' : 'FAIL',
      details: hasUTM
        ? `UTM OK: ${post.utm_campaign}`
        : 'Lien sans parametres UTM',
    };
  }

  private checkCTA(caption: string): ComplianceCheck {
    const ctaPatterns = [
      'lien en bio',
      'sauvegarde',
      'partage',
      'commentaire',
      'commandez',
      'automecanik.com',
      'lien en description',
      'retrouvez-nous',
      'en savoir plus',
    ];
    const found = ctaPatterns.some((p) => caption.toLowerCase().includes(p));
    return {
      check: 'CTA present',
      level: found ? 'PASS' : 'WARN',
      details: found ? 'CTA detecte' : 'Aucun CTA detecte dans la caption',
    };
  }

  private checkHashtags(
    channel: SocialChannel,
    hashtags: string[],
    rules: BrandRule[],
  ): ComplianceCheck {
    const hashRule = rules.find(
      (r) =>
        r.rule_key === 'hashtags' &&
        (r.channel === channel || r.channel === null),
    );
    if (!hashRule) {
      return { check: 'Hashtags', level: 'PASS', details: 'No hashtag rule' };
    }

    const { min, max } = hashRule.rule_value as { min: number; max: number };
    const count = hashtags.length;

    if (count < min || count > max) {
      return {
        check: 'Hashtags',
        level: count === 0 ? 'FAIL' : 'WARN',
        details: `${count} hashtags (attendu ${min}-${max} pour ${channel})`,
      };
    }
    return {
      check: 'Hashtags',
      level: 'PASS',
      details: `${count} hashtags OK (${min}-${max})`,
    };
  }

  private checkCaptionLength(
    channel: SocialChannel,
    caption: string,
    channelData: Record<string, string | string[] | boolean | undefined>,
    rules: BrandRule[],
  ): ComplianceCheck {
    const lengthRule = rules.find((r) => r.rule_key === 'max_caption_length');
    if (!lengthRule) {
      return {
        check: 'Caption length',
        level: 'PASS',
        details: 'No length rule',
      };
    }

    const limits = lengthRule.rule_value as Record<string, number>;
    let maxLen: number;
    let text: string;

    if (channel === 'youtube') {
      maxLen = limits.youtube_title || 100;
      text = String(channelData?.title || '');
    } else {
      maxLen = limits[channel] || 2200;
      text = caption;
    }

    if (text.length > maxLen) {
      return {
        check: 'Caption length',
        level: 'FAIL',
        details: `${text.length} caracteres (max ${maxLen} pour ${channel})`,
      };
    }
    return {
      check: 'Caption length',
      level: 'PASS',
      details: `${text.length}/${maxLen} caracteres`,
    };
  }
}
