/**
 * DiagnosticEngine Orchestrator — Slice 2 + Slice 8
 *
 * Delegue a 5 engines :
 *   1. SignalInterpretation    → resout les signaux
 *   2. HypothesisScoring       → scoring multi-couches (6 axes)
 *   3. RiskSafety              → court-circuit securite
 *   4. CatalogOrientation      → CatalogGuard
 *   5. MaintenanceIntelligence → entretien lie
 *
 * Pipeline :
 *   Input → Validation → Signal → Scoring → Risk → Catalog → Maintenance → EvidencePack
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyzeInputSchema,
  type AnalyzeMaintenanceInput,
  type AnalyzeDiagnosticInput,
  type UsageContextInput,
} from './types/diagnostic-input.schema';
import type { CatalogGuard, EvidencePack } from './types/evidence-pack.schema';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';
import { SignalInterpretationEngine } from './engines/signal-interpretation.engine';
import { HypothesisScoringEngine } from './engines/hypothesis-scoring.engine';
import { RiskSafetyEngine } from './engines/risk-safety.engine';
import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';
import { MaintenanceIntelligenceEngine } from './engines/maintenance-intelligence.engine';
import { KgShadowService } from './services/kg-shadow.service';
import { CAUSE_GAMME_MAP } from './constants/gamme-map.constants';

// Wording shown to the user; same labels as the wizard's usage step
// (frontend StepVehicle USAGE_PROFILES).
const USAGE_PROFILE_LABEL: Record<
  NonNullable<UsageContextInput['usage_profile']>,
  string
> = {
  urban_short_trips: 'Urbain / courts trajets',
  mixed: 'Mixte quotidien',
  highway: 'Autoroute fréquent',
  professional: 'Usage professionnel',
  occasional: 'Usage occasionnel',
};

@Injectable()
export class DiagnosticEngineOrchestrator {
  private readonly logger = new Logger(DiagnosticEngineOrchestrator.name);

  constructor(
    private readonly dataService: DiagnosticEngineDataService,
    private readonly signalEngine: SignalInterpretationEngine,
    private readonly scoringEngine: HypothesisScoringEngine,
    private readonly riskEngine: RiskSafetyEngine,
    private readonly catalogEngine: CatalogOrientationEngine,
    private readonly maintenanceEngine: MaintenanceIntelligenceEngine,
    private readonly kgShadow: KgShadowService, // PR-E — fire-and-forget shadow
  ) {}

  /**
   * Main entry point — produces a valid EvidencePack via 5 engines
   */
  async analyze(rawInput: unknown): Promise<{
    success: boolean;
    data?: { evidence: EvidencePack; session_id: string | null };
    error?: string;
  }> {
    const startTime = Date.now();

    // ── 1. Validate input ──────────────────────────────
    const parseResult = AnalyzeInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Validation error: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      };
    }
    const input = parseResult.data;
    const inputLimitations: string[] = [];
    if (input.usage_context?.immobilized_days !== undefined)
      inputLimitations.push(
        'Durée d’immobilisation non prise en compte dans cette analyse.',
      );
    if (input.usage_context?.last_service_date !== undefined)
      inputLimitations.push(
        'Date du dernier entretien non prise en compte : seules les dates renseignées par opération sont utilisées.',
      );
    if (input.usage_context?.recent_repairs?.length)
      inputLimitations.push(
        'Réparations récentes non prises en compte : elles ne prouvent ni la résolution du symptôme ni l’entretien des opérations concernées.',
      );
    if ('signal_input' in input) {
      if (
        Object.values(input.signal_input.context ?? {}).some((value) =>
          Array.isArray(value) ? value.length > 0 : value !== undefined,
        )
      )
        inputLimitations.push(
          'Contexte du symptôme non interprété : il ne modifie ni les hypothèses ni le niveau de risque.',
        );
      if (input.session_id)
        inputLimitations.push(
          'Cette analyse ne reprend ni ne met à jour la session fournie.',
        );
    } else if (input.usage_context.last_service_km !== undefined)
      inputLimitations.push(
        'Kilométrage du dernier entretien non pris en compte : seuls les kilométrages renseignés par opération sont utilisés.',
      );
    if (inputLimitations.length)
      this.logger.warn(
        `Diagnostic input limitations: ${inputLimitations.length} supplied fields are not interpreted`,
      );
    if (!('signal_input' in input))
      return this.analyzeMaintenance(input, inputLimitations);
    if (input.signal_input.signal_mode !== 'symptom_slugs') {
      return {
        success: false,
        error:
          'Ce mode de signal n’est pas encore pris en charge par cette analyse. Sélectionnez un symptôme reconnu.',
      };
    }
    // ── 2. Signal Interpretation Engine ─────────────────
    let signal: Awaited<ReturnType<SignalInterpretationEngine['interpret']>>;
    try {
      signal = await this.signalEngine.interpret(input);
    } catch (error) {
      this.logger.error('Diagnostic signal data unavailable', error);
      return {
        success: false,
        error:
          'Analyse indisponible : les signaux ne peuvent pas être vérifiés. Aucun niveau de risque ne peut être établi.',
      };
    }
    if (!signal.system_confirmed) {
      try {
        const systems = await this.dataService.getActiveSystems();
        const available = systems.map((s) => s.slug).join(', ');
        return {
          success: false,
          error: `Système inconnu: ${input.system_scope}. Systèmes disponibles: ${available}`,
        };
      } catch (error) {
        this.logger.error('Diagnostic system catalog unavailable', error);
        return {
          success: false,
          error:
            'Analyse indisponible : les systèmes ne peuvent pas être vérifiés.',
        };
      }
    }

    if (
      !signal.resolved_symptom_slugs.length ||
      signal.unresolved_signals.length
    ) {
      return {
        success: false,
        error:
          'Diagnostic insuffisant : un ou plusieurs signaux ne sont pas reconnus. Le niveau de risque ne peut pas être établi ; un contrôle professionnel est nécessaire.',
      };
    }

    // ── 3. Fetch raw data from DB ──────────────────────
    let scoredLinks: Awaited<
      ReturnType<DiagnosticEngineDataService['getScoredCausesForSymptoms']>
    >;
    let safetyRules: Awaited<
      ReturnType<DiagnosticEngineDataService['getSafetyRules']>
    >;
    try {
      scoredLinks = await this.dataService.getScoredCausesForSymptoms(
        signal.resolved_symptom_slugs,
      );
      safetyRules = await this.dataService.getSafetyRules(input.system_scope);
    } catch (error) {
      this.logger.error('Diagnostic safety data unavailable', error);
      return {
        success: false,
        error:
          'Analyse indisponible : les données de sécurité ne sont pas accessibles. Aucun niveau de risque ne peut être établi.',
      };
    }
    if (!safetyRules.length) {
      return {
        success: false,
        error:
          'Diagnostic insuffisant : la couverture des règles de sécurité est absente. Aucun niveau de risque ne peut être établi.',
      };
    }

    // ── 4. Hypothesis Scoring Engine (multi-couches) ───
    const hypotheses = this.scoringEngine.score(
      scoredLinks,
      input.vehicle_context,
    );

    if (!hypotheses.length) {
      return {
        success: false,
        error:
          'Diagnostic insuffisant : aucune hypothèse couverte pour ces signaux. Le niveau de risque ne peut pas être établi.',
      };
    }

    // ── 5. Risk Safety Engine ──────────────────────────
    const risk = this.riskEngine.assess(
      hypotheses,
      safetyRules,
      signal.resolved_symptom_slugs,
      signal.critical_symptom_labels,
    );

    // ── 6. Catalog Orientation Engine ──────────────────
    const catalog = this.catalogEngine.evaluate(
      hypotheses,
      risk,
      input.vehicle_context,
    );

    // Optional enrichment must not suppress an already determined safety
    // alert. Degradation is logged and included in the returned missing facts.
    const degraded: string[] = [...inputLimitations];
    if (Object.keys(input.answers ?? {}).length > 0) {
      this.logger.warn('Diagnostic questionnaire answers not interpreted');
      degraded.push(
        'Réponses complémentaires non interprétées : elles ne modifient ni les hypothèses ni le niveau de risque de cette analyse.',
      );
    }
    let maintenance: Awaited<
      ReturnType<MaintenanceIntelligenceEngine['assess']>
    > = {
      recommendations: [],
      maintenance_links: [],
      overdue_count: 0,
    };
    try {
      maintenance = await this.maintenanceEngine.assess(
        signal.resolved_symptom_slugs,
        input.vehicle_context,
        input.usage_context,
      );
    } catch (error) {
      this.logger.warn('Diagnostic maintenance enrichment unavailable', error);
      degraded.push(
        'Informations d’entretien indisponibles — aucune conclusion sur les échéances.',
      );
    }

    // ADR-031: RAG is a chatbot consumer, never a diagnostic content authority.
    // ── 9. Assemble EvidencePack ───────────────────────
    const evidencePack = this.assembleEvidencePack(
      input,
      signal,
      hypotheses,
      risk,
      catalog,
      maintenance,
    );

    evidencePack.evidence_pack.factual_inputs_missing.push(...degraded);
    const elapsed = Date.now() - startTime;
    this.logger.log(
      `Diagnostic completed in ${elapsed}ms — ${hypotheses.length} hypotheses, ` +
        `risk=${risk.risk_level}, catalog=${catalog.ready_for_catalog}`,
    );

    // ── 9b. KG shadow comparison (PR-E, fire-and-forget) ────
    // Calls `kg_diagnose_vehicle_aware` in parallel with the canonical
    // engines, compares top-N fault_ids, emits `diagnostic_kg_shadow_diverged`
    // event. NEVER blocks the response ; failures are swallowed.
    // Identifier-mapping note : signal.resolved_symptom_slugs are slugs,
    // the RPC expects observable UUIDs. When the data layer can resolve
    // slugs→UUIDs the shadow can compare. Until then, the service rejects
    // invalid identities before any RPC and emits an observable kg_error.
    this.kgShadow.shadowCompare({
      observable_ids: signal.resolved_symptom_slugs,
      vehicle_id:
        typeof (input.vehicle_context as { type_id?: number } | undefined)
          ?.type_id === 'number'
          ? String((input.vehicle_context as { type_id: number }).type_id)
          : undefined,
      canonical_hypotheses: hypotheses.map((h) => ({
        cause_id: h.hypothesis_id,
        confidence: h.total_score / 100,
      })),
    });

    // ── 10. Save session ───────────────────────────────
    let sessionId: string | null = null;
    try {
      sessionId = await this.dataService.saveSession({
        intent_type: input.intent_type,
        system_scope: input.system_scope,
        vehicle_context: input.vehicle_context || {},
        signal_input: input.signal_input as Record<string, unknown>,
        answers: input.answers || {},
        result: evidencePack as unknown as Record<string, unknown>,
      });
    } catch (error) {
      this.logger.warn('Diagnostic session persistence unavailable', error);
    }
    if (!sessionId)
      evidencePack.evidence_pack.factual_inputs_missing.push(
        'Sauvegarde non confirmée — le lien de reprise est indisponible.',
      );

    return {
      success: true,
      data: { evidence: evidencePack, session_id: sessionId },
    };
  }

  /**
   * Assess selected maintenance operations without invoking the symptom pipeline.
   */
  private async analyzeMaintenance(
    input: AnalyzeMaintenanceInput,
    inputLimitations: string[],
  ): Promise<{
    success: boolean;
    data?: { evidence: EvidencePack; session_id: string | null };
    error?: string;
  }> {
    try {
      const maintenance = await this.maintenanceEngine.assessSelected(
        input.vehicle_context,
        input.usage_context,
      );
      const missing = [
        ...inputLimitations,
        'Applicabilité au véhicule et préconisations constructeur non vérifiées : intervalles génériques.',
        'Le profil d’usage ne modifie pas ces intervalles.',
        'Ce bilan ne détermine ni l’usure réelle ni la sécurité du véhicule.',
        'Bilan non enregistré sur le serveur : vous pouvez l’imprimer.',
      ];
      if (input.vehicle_context.mileage_km === undefined)
        missing.push('Kilométrage actuel non renseigné.');
      for (const rec of maintenance.recommendations) {
        if (rec.interval_km && rec.last_service_km === undefined)
          missing.push(
            `${rec.operation_label} : kilométrage d’intervention inconnu.`,
          );
        if (rec.interval_months && !rec.last_service_date)
          missing.push(
            `${rec.operation_label} : date d’intervention inconnue.`,
          );
      }
      return {
        success: true,
        data: {
          session_id: null,
          evidence: {
            evidence_pack: {
              analysis_kind: 'maintenance',
              factual_inputs_confirmed: [
                'Opérations sélectionnées par l’utilisateur ; historique déclaré.',
                ...(input.vehicle_context.mileage_km !== undefined
                  ? [
                      `Compteur actuel : ${input.vehicle_context.mileage_km.toLocaleString('fr-FR')} km`,
                    ]
                  : []),
              ],
              factual_inputs_missing: missing,
              system_suspects: [],
              candidate_hypotheses: [],
              risk_flags: [],
              maintenance_links: maintenance.maintenance_links,
              maintenance_recommendations: maintenance.recommendations,
              preventive_schedule: maintenance.preventive_schedule,
              catalog_guard: {
                ready_for_catalog: false,
                confidence_before_purchase: 'low',
                allowed_output_mode: 'none',
                suggested_gammes: [],
                reason:
                  'Une estimation d’échéance ne justifie pas un achat ; applicabilité et état réel à vérifier.',
              },
              allowed_claims: [
                'Comparez ces estimations au carnet constructeur et aux justificatifs d’entretien.',
              ],
              ui_block_inputs: {},
            },
          },
        },
      };
    } catch (error) {
      this.logger.warn('Maintenance assessment unavailable', error);
      return {
        success: false,
        error:
          'Bilan entretien indisponible : une opération ou ses intervalles ne peuvent pas être vérifiés. Aucune conclusion sur les échéances.',
      };
    }
  }

  private assembleEvidencePack(
    input: AnalyzeDiagnosticInput,
    signal: Awaited<ReturnType<SignalInterpretationEngine['interpret']>>,
    hypotheses: ReturnType<HypothesisScoringEngine['score']>,
    risk: ReturnType<RiskSafetyEngine['assess']>,
    catalog: ReturnType<CatalogOrientationEngine['evaluate']>,
    maintenance: Awaited<ReturnType<MaintenanceIntelligenceEngine['assess']>>,
  ): EvidencePack {
    // ── Factual inputs ─────────────────────────────────
    const confirmed: string[] = [];
    const missing: string[] = [];

    const vc = input.vehicle_context;
    if (vc.brand && vc.model) {
      confirmed.push(
        `Véhicule: ${vc.brand} ${vc.model}` +
          `${vc.engine ? ' ' + vc.engine : ''}` +
          `${vc.year ? ' (' + vc.year + ')' : ''}`,
      );
    } else {
      missing.push('Véhicule non identifié — diagnostic générique');
    }

    if (vc.mileage_km !== undefined) {
      confirmed.push(
        `Kilométrage: ${vc.mileage_km.toLocaleString('fr-FR')} km`,
      );
    } else {
      missing.push('Kilométrage non renseigné');
    }

    if (input.usage_context?.usage_profile) {
      confirmed.push(
        `Profil d'usage: ${USAGE_PROFILE_LABEL[input.usage_context.usage_profile]}`,
      );
    } else {
      missing.push("Profil d'usage non renseigné");
    }

    const usage = input.usage_context;
    if (usage?.last_service_km !== undefined) {
      confirmed.push(
        `Dernier entretien: ${usage.last_service_km.toLocaleString('fr-FR')} km`,
      );
    }
    if (usage?.maintenance_records?.length) {
      confirmed.push(
        `Historique d'entretien déclaré pour ${usage.maintenance_records.length} opération(s)`,
      );
    }
    // A supplied global date is disclosed as not taken into account instead.
    if (
      usage?.last_service_km === undefined &&
      !usage?.maintenance_records?.length &&
      usage?.last_service_date === undefined
    ) {
      missing.push('Historique entretien non renseigné');
    }

    // Every signal is resolved at this point: analysis stops otherwise.
    const symptomLabel = (slug: string) => signal.symptom_labels[slug];
    confirmed.push(`Système: ${signal.system_label}`);
    confirmed.push(
      `Symptôme principal: ${symptomLabel(input.signal_input.primary_signal)}`,
    );
    if (input.signal_input.secondary_signals?.length) {
      confirmed.push(
        `Symptômes secondaires: ${input.signal_input.secondary_signals.map(symptomLabel).join(', ')}`,
      );
    }

    // ── System suspects ────────────────────────────────
    const systemSuspects = [
      ...new Set(
        hypotheses
          .filter((h) => h.total_score >= 15)
          .flatMap(
            (h) =>
              CAUSE_GAMME_MAP[h.hypothesis_id]?.map((g) => g.label) ?? [
                h.label,
              ],
          ),
      ),
    ];

    // ── Urgency timeline mapping ───────────────────────
    const urgencyTimeline: Record<
      ReturnType<HypothesisScoringEngine['score']>[number]['urgency'],
      string
    > = {
      critique: 'Immédiat — ne pas rouler',
      haute: 'Sous 48h — contrôle professionnel urgent',
      moyenne: 'Sous 2 semaines — planifier un contrôle',
      basse: 'Prochaine révision — à surveiller',
    };

    // ── Map hypotheses to contract format ──────────────
    const contractHypotheses = hypotheses.map((h) => ({
      hypothesis_id: h.hypothesis_id,
      label: h.label,
      cause_type: h.cause_type,
      relative_score: h.total_score,
      urgency: h.urgency,
      urgency_timeline: urgencyTimeline[h.urgency],
      evidence_for: h.evidence_for,
      evidence_against: h.evidence_against,
      verification_method: h.verification_method,
      requires_verification: h.requires_verification,
      related_gamme_slugs: h.related_gamme_slugs,
      // Slice 2 bonus: multi-layer scoring breakdown
      scoring_breakdown: {
        signal_match: h.signal_match_score,
        vehicle_fit: h.vehicle_fit_score,
        lifecycle_fit: h.lifecycle_fit_score,
        maintenance_history: h.maintenance_history_score,
        plausibility: h.plausibility_score,
        context: h.context_score,
      },
    }));

    // ── Claims ─────────────────────────────────────────
    const allowedClaims = [
      'Un contrôle visuel est recommandé pour confirmer le diagnostic.',
      'Plusieurs causes sont possibles — seul un contrôle permet de conclure.',
    ];

    // ── Diagnostic confidence score ─────────────────────
    const signalQualityMultiplier =
      signal.signal_quality === 'high'
        ? 1.0
        : signal.signal_quality === 'medium'
          ? 0.75
          : 0.5;
    const topScore = hypotheses[0]?.total_score || 0;
    const evidenceCount = confirmed.length;
    const diagnosticConfidence = Math.min(
      100,
      Math.round(
        topScore *
          signalQualityMultiplier *
          (0.7 + 0.3 * Math.min(evidenceCount / 5, 1)),
      ),
    );

    // One catalogue verdict, within the contract, for every field that shows it.
    const catalogGuard: CatalogGuard = {
      ready_for_catalog: catalog.ready_for_catalog,
      confidence_before_purchase:
        catalog.confidence_before_purchase === 'insufficient'
          ? 'low'
          : catalog.confidence_before_purchase,
      allowed_output_mode:
        catalog.allowed_output_mode === 'catalog_reference_with_caution'
          ? 'catalog_family_with_caution'
          : catalog.allowed_output_mode,
      reason: catalog.reason,
      suggested_gammes: catalog.suggested_gammes,
    };

    return {
      evidence_pack: {
        diagnostic_confidence: diagnosticConfidence,
        factual_inputs_confirmed: confirmed,
        factual_inputs_missing: missing,
        system_suspects: systemSuspects,
        candidate_hypotheses: contractHypotheses,
        maintenance_links: maintenance.maintenance_links,
        risk_flags: risk.risk_flags,
        safety_alert: risk.safety_alert,
        risk_level: risk.risk_level,
        signal_quality: signal.signal_quality,
        catalog_guard: catalogGuard,
        maintenance_recommendations: maintenance.recommendations,
        preventive_schedule: maintenance.preventive_schedule,
        allowed_claims: allowedClaims,
        ui_block_inputs: {
          VehicleContextCard: input.vehicle_context,
          SignalSummary: {
            signal: input.signal_input.primary_signal,
            signal_mode: input.signal_input.signal_mode,
            secondary_signals: input.signal_input.secondary_signals,
            signal_quality: signal.signal_quality,
          },
          HypothesisCards: contractHypotheses,
          RiskPanel: {
            risk_level: risk.risk_level,
            risk_flags: risk.risk_flags,
            safety_alert: risk.safety_alert,
            requires_immediate_action: risk.requires_immediate_action,
          },
          MaintenancePanel: {
            recommendations: maintenance.recommendations,
            overdue_count: maintenance.overdue_count,
          },
          CatalogOrientationBox: {
            ready_for_catalog: catalogGuard.ready_for_catalog,
            confidence_before_purchase: catalogGuard.confidence_before_purchase,
            allowed_output_mode: catalogGuard.allowed_output_mode,
            suggested_gammes: catalogGuard.suggested_gammes,
          },
        },
      },
    };
  }
}
