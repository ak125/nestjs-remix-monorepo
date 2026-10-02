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

interface SafetyRuleTrigger {
  causes?: string[];
  symptoms?: string[];
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
   * What makes each safety rule relevant: a linked cause among the
   * hypotheses, or a reported symptom. Each trigger restates the rule's own
   * condition_description — the alert shows that text as the current
   * situation, so a rule must only fire when the analysis supports it.
   *
   * Relevance is structural on purpose: the hypothesis score blends
   * heuristic layers (mileage, age, usage), and a safety warning must never
   * be withheld because a car looks young or lightly used.
   */
  private static readonly RULE_TRIGGERS: Record<string, SafetyRuleTrigger> = {
    // Freinage
    brake_metal_on_metal: { causes: ['brake_pads_worn'] },
    brake_disc_damage_risk: { causes: ['brake_pads_worn'] },
    brake_fluid_critical: { causes: ['brake_fluid_low'] },
    // Distribution
    timing_belt_snap_risk: {
      causes: ['courroie_distribution_usee', 'galet_tendeur_defaillant'],
    },
    // Échappement
    exhaust_fumes_cabin_risk: {
      causes: ['silencieux_perce', 'joint_collecteur_hs'],
    },
    // Injection
    fuel_leak_fire_risk: {
      causes: ['injecteur_encrasse', 'pompe_injection_hs'],
    },
    // Direction
    steering_loss_risk: {
      causes: [
        'cremaillere_usee',
        'pompe_direction_hs',
        'rotule_direction_usee',
      ],
    },
    // Suspension
    suspension_stability_risk: {
      causes: ['amortisseur_use', 'rotule_suspension_hs'],
    },
    spring_break_risk: { causes: ['ressort_casse'] },
    // Filtration
    oil_pressure_critical: { causes: ['filtre_huile_colmate'] },
    // Démarrage
    battery_sudden_failure: { causes: ['battery_dead'] },
    alternator_battery_drain: { causes: ['alternator_failing'] },
    // Smoke or a burning smell at the starter is not a reportable
    // symptom: the rule cannot be supported by an analysis.
    starter_smoke_warning: {},
    // Refroidissement
    overheat_engine_stop: { symptoms: ['temp_warning_light'] },
    coolant_leak_no_drive: { symptoms: ['coolant_leak_visible'] },
    temp_instability_warning: { symptoms: ['temp_gauge_unstable'] },
    // Embrayage
    clutch_slip_hill_risk: { symptoms: ['patinage_embrayage'] },
    // Transmission
    cardan_snap_risk: { causes: ['soufflet_cardan_dechire', 'cardan_use'] },
    // Éclairage
    no_headlight_night_risk: { causes: ['feu_avant_defaillant'] },
  };

  /**
   * Check if a safety rule is relevant given current hypotheses and symptoms.
   * A rule without a declared trigger is logged and applies to every analysis
   * of its system (haute/critique, moyenne); basse rules never raise a flag.
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

    const trigger = RiskSafetyEngine.RULE_TRIGGERS[ruleSlug];
    if (trigger) {
      return (
        hypotheses.some((h) => trigger.causes?.includes(h.hypothesis_id)) ||
        symptomSlugs.some((s) => trigger.symptoms?.includes(s))
      );
    }

    if (rule.urgency === 'basse') {
      return false;
    }
    this.logger.warn(`Safety rule without a declared trigger: ${ruleSlug}`);

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
