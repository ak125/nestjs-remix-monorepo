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
   * Cause slugs associated with specific safety rules.
   * When a rule_slug maps to cause slugs here, the rule is only relevant
   * if one of those causes appears in the hypotheses with score >= threshold.
   */
  private static readonly RULE_CAUSE_MAP: Record<
    string,
    { causes: string[]; threshold: number }
  > = {
    // Freinage
    brake_metal_on_metal: { causes: ['brake_pads_worn'], threshold: 30 },
    brake_disc_damage_risk: { causes: ['brake_pads_worn'], threshold: 30 },
    brake_fluid_critical: { causes: ['brake_fluid_low'], threshold: 20 },
    // Distribution
    timing_belt_snap_risk: {
      causes: ['courroie_distribution_usee', 'galet_tendeur_defaillant'],
      threshold: 25,
    },
    // Échappement
    exhaust_fumes_cabin_risk: {
      causes: ['silencieux_perce', 'joint_collecteur_hs'],
      threshold: 20,
    },
    // Injection
    fuel_leak_fire_risk: {
      causes: ['injecteur_encrasse', 'pompe_injection_hs'],
      threshold: 25,
    },
    // Direction
    steering_loss_risk: {
      causes: [
        'cremaillere_usee',
        'pompe_direction_hs',
        'rotule_direction_usee',
      ],
      threshold: 20,
    },
    // Suspension
    suspension_stability_risk: {
      causes: ['amortisseur_use', 'rotule_suspension_hs'],
      threshold: 25,
    },
    // Filtration
    oil_pressure_critical: {
      causes: ['filtre_huile_colmate'],
      threshold: 20,
    },
  };

  /**
   * Check if a safety rule is relevant given current hypotheses and symptoms.
   * Uses RULE_CAUSE_MAP for cause-specific matching, falls back to urgency-based.
   */
  private isRuleRelevant(
    rule: DiagSafetyRule,
    hypotheses: ScoredHypothesis[],
    symptomSlugs: string[],
  ): boolean {
    const ruleSlug = rule.rule_slug;

    // Symptom-only rules (e.g. "any symptom in this system triggers warning")
    if (ruleSlug === 'brake_long_trip_warning') {
      return symptomSlugs.length > 0;
    }

    // Cause-specific matching via RULE_CAUSE_MAP
    const mapping = RiskSafetyEngine.RULE_CAUSE_MAP[ruleSlug];
    if (mapping) {
      return hypotheses.some(
        (h) =>
          mapping.causes.includes(h.hypothesis_id) &&
          h.total_score >= mapping.threshold,
      );
    }

    // Default: haute urgency rules are relevant if any hypothesis scores >= 30
    if (rule.urgency === 'haute') {
      return hypotheses.some((h) => h.total_score >= 30);
    }

    // Moyenne urgency: relevant if symptoms present
    if (rule.urgency === 'moyenne') {
      return symptomSlugs.length > 0;
    }

    return false;
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
