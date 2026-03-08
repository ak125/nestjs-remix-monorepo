/**
 * RiskSafetyEngine
 *
 * Evalue la gravite des hypotheses et court-circuite si critique.
 * Produit les risk_flags et determine si un avertissement securite
 * doit etre affiche AVANT les causes.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { DiagSafetyRule } from '../diagnostic-engine.data-service';
import type { ScoredHypothesis } from './hypothesis-scoring.engine';

export interface RiskAssessment {
  risk_level: 'critical' | 'high' | 'moderate' | 'low';
  risk_flags: string[];
  safety_alert?: string;
  requires_immediate_action: boolean;
  blocks_catalog: boolean;
  active_rules: DiagSafetyRule[];
}

@Injectable()
export class RiskSafetyEngine {
  private readonly logger = new Logger(RiskSafetyEngine.name);

  assess(
    hypotheses: ScoredHypothesis[],
    safetyRules: DiagSafetyRule[],
    symptomSlugs: string[],
  ): RiskAssessment {
    const riskFlags: string[] = [];
    const activeRules: DiagSafetyRule[] = [];

    // ── Match safety rules against current context ──────
    for (const rule of safetyRules) {
      const isRelevant = this.isRuleRelevant(rule, hypotheses, symptomSlugs);
      if (isRelevant) {
        riskFlags.push(rule.risk_flag);
        activeRules.push(rule);
      }
    }

    // ── Determine overall risk level ────────────────────
    const hasCriticalRule = activeRules.some(
      (r) => r.urgency === 'haute' && r.blocks_catalog,
    );
    const hasHighUrgencyHypothesis = hypotheses.some(
      (h) => h.urgency === 'haute' && h.total_score >= 40,
    );
    const hasBlockingRule = activeRules.some((r) => r.blocks_catalog);

    let riskLevel: 'critical' | 'high' | 'moderate' | 'low';
    if (hasCriticalRule && hasHighUrgencyHypothesis) {
      riskLevel = 'critical';
    } else if (hasCriticalRule || hasHighUrgencyHypothesis) {
      riskLevel = 'high';
    } else if (activeRules.length > 0) {
      riskLevel = 'moderate';
    } else {
      riskLevel = 'low';
    }

    // ── Safety alert (court-circuit) ────────────────────
    let safetyAlert: string | undefined;
    if (riskLevel === 'critical') {
      safetyAlert = this.buildSafetyAlert(activeRules, hypotheses);
    }

    return {
      risk_level: riskLevel,
      risk_flags: riskFlags,
      safety_alert: safetyAlert,
      requires_immediate_action: riskLevel === 'critical',
      blocks_catalog: hasBlockingRule,
      active_rules: activeRules,
    };
  }

  /**
   * Check if a safety rule is relevant given current hypotheses and symptoms
   */
  private isRuleRelevant(
    rule: DiagSafetyRule,
    hypotheses: ScoredHypothesis[],
    symptomSlugs: string[],
  ): boolean {
    // All freinage safety rules are relevant if we're diagnosing braking
    // For more specific matching, check rule_slug patterns
    const ruleSlug = rule.rule_slug;

    // Metal-on-metal: relevant if brake_pads_worn is top hypothesis
    if (ruleSlug === 'brake_metal_on_metal') {
      return hypotheses.some(
        (h) => h.hypothesis_id === 'brake_pads_worn' && h.total_score >= 30,
      );
    }

    // Disc damage risk: relevant if pads are worn
    if (ruleSlug === 'brake_disc_damage_risk') {
      return hypotheses.some(
        (h) => h.hypothesis_id === 'brake_pads_worn' && h.total_score >= 30,
      );
    }

    // Long trip warning: relevant for any brake symptom
    if (ruleSlug === 'brake_long_trip_warning') {
      return symptomSlugs.length > 0;
    }

    // Fluid critical: relevant if fluid is a hypothesis
    if (ruleSlug === 'brake_fluid_critical') {
      return hypotheses.some(
        (h) => h.hypothesis_id === 'brake_fluid_low' && h.total_score >= 20,
      );
    }

    // Default: relevant if urgency matches
    return rule.urgency === 'haute';
  }

  /**
   * Build a safety alert message for critical situations
   */
  private buildSafetyAlert(
    rules: DiagSafetyRule[],
    hypotheses: ScoredHypothesis[],
  ): string {
    const topHypothesis = hypotheses[0];
    const criticalRules = rules.filter(
      (r) => r.urgency === 'haute' && r.blocks_catalog,
    );

    if (criticalRules.length === 0) return '';

    const ruleDescriptions = criticalRules
      .map((r) => r.condition_description)
      .join(' | ');

    return (
      `⚠️ ALERTE SÉCURITÉ — ${ruleDescriptions}. ` +
      `Hypothèse principale : ${topHypothesis?.label || 'indéterminée'}. ` +
      `Contrôle professionnel recommandé avant utilisation du véhicule.`
    );
  }
}
