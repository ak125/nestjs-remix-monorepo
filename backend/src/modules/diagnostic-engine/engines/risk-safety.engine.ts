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
    criticalSymptomLabels: string[] = [],
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

    // Explicit critical urgency already means immediate action in the
    // EvidencePack timeline. A relative plausibility score must not downgrade it.
    const criticalLabels = [
      ...new Set([
        ...criticalSymptomLabels,
        ...hypotheses
          .filter((h) => h.urgency === 'critique')
          .map((h) => h.label),
      ]),
    ];
    for (const label of criticalLabels)
      riskFlags.push(`Urgence critique : ${label}`);
    const hasExplicitCritical =
      criticalLabels.length > 0 ||
      activeRules.some((rule) => rule.urgency === 'critique');

    // ── Determine overall risk level ────────────────────
    const hasCriticalRule = activeRules.some(
      (r) => r.urgency === 'haute' && r.blocks_catalog,
    );
    const hasHighUrgencyHypothesis = hypotheses.some(
      (h) => h.urgency === 'haute',
    );
    const hasBlockingRule = activeRules.some((r) => r.blocks_catalog);

    let riskLevel: 'critical' | 'high' | 'moderate' | 'low';
    if (hasExplicitCritical || (hasCriticalRule && hasHighUrgencyHypothesis)) {
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
      safetyAlert = this.buildSafetyAlert(
        activeRules,
        hypotheses,
        criticalLabels,
      );
    }

    return {
      risk_level: riskLevel,
      risk_flags: riskFlags,
      safety_alert: safetyAlert,
      requires_immediate_action: riskLevel === 'critical',
      blocks_catalog: hasBlockingRule || hasExplicitCritical,
      active_rules: activeRules,
    };
  }

  /**
   * Cause slugs associated with specific safety rules. A mapped rule is
   * relevant when one of its causes is linked to the reported symptoms.
   *
   * Relevance is structural on purpose: the hypothesis score blends
   * heuristic layers (mileage, age, usage), and a safety warning must never
   * be withheld because a car looks young or lightly used.
   */
  private static readonly RULE_CAUSE_MAP: Record<string, string[]> = {
    // Freinage
    brake_metal_on_metal: ['brake_pads_worn'],
    brake_disc_damage_risk: ['brake_pads_worn'],
    brake_fluid_critical: ['brake_fluid_low'],
    // Distribution
    timing_belt_snap_risk: [
      'courroie_distribution_usee',
      'galet_tendeur_defaillant',
    ],
    // Échappement
    exhaust_fumes_cabin_risk: ['silencieux_perce', 'joint_collecteur_hs'],
    // Injection
    fuel_leak_fire_risk: ['injecteur_encrasse', 'pompe_injection_hs'],
    // Direction
    steering_loss_risk: [
      'cremaillere_usee',
      'pompe_direction_hs',
      'rotule_direction_usee',
    ],
    // Suspension
    suspension_stability_risk: ['amortisseur_use', 'rotule_suspension_hs'],
    // Filtration
    oil_pressure_critical: ['filtre_huile_colmate'],
  };

  /**
   * Check if a safety rule is relevant given current hypotheses and symptoms.
   * Rules without a cause mapping apply to every analysis of their system
   * (haute/critique, moyenne); basse rules never raise a flag.
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

    const causes = RiskSafetyEngine.RULE_CAUSE_MAP[ruleSlug];
    if (causes) {
      return hypotheses.some((h) => causes.includes(h.hypothesis_id));
    }

    if (rule.urgency === 'haute' || rule.urgency === 'critique') {
      return hypotheses.length > 0;
    }

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
    criticalLabels: string[],
  ): string {
    const topHypothesis = hypotheses[0];
    const criticalRules = rules.filter(
      (r) =>
        r.urgency === 'critique' || (r.urgency === 'haute' && r.blocks_catalog),
    );

    if (
      criticalLabels.length ||
      criticalRules.some((rule) => rule.urgency === 'critique')
    ) {
      const details = [
        ...criticalLabels,
        ...criticalRules.map((rule) => rule.condition_description),
      ].join(' | ');
      return `⚠️ ALERTE SÉCURITÉ — Immédiat — ne pas rouler. ${details}. Contrôle professionnel nécessaire.`;
    }
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
