/**
 * DiagnosticEngine Orchestrator — Slice 2 + Slice 8
 *
 * Delegue a 6 engines :
 *   1. SignalInterpretation    → resout les signaux
 *   2. HypothesisScoring       → scoring multi-couches (6 axes)
 *   3. RiskSafety              → court-circuit securite
 *   4. CatalogOrientation      → CatalogGuard
 *   5. MaintenanceIntelligence → entretien lie
 *   6. RagEnrichment           → faits documentes (degradation gracieuse)
 *
 * Pipeline :
 *   Input → Validation → Signal → Scoring → Risk → Catalog → Maintenance → RAG → EvidencePack
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyzeDiagnosticInputSchema,
  type AnalyzeDiagnosticInput,
} from './types/diagnostic-input.schema';
import type { EvidencePack, RagFact } from './types/evidence-pack.schema';
import { DiagnosticEngineDataService } from './diagnostic-engine.data-service';
import { SignalInterpretationEngine } from './engines/signal-interpretation.engine';
import { HypothesisScoringEngine } from './engines/hypothesis-scoring.engine';
import { RiskSafetyEngine } from './engines/risk-safety.engine';
import { CatalogOrientationEngine } from './engines/catalog-orientation.engine';
import { MaintenanceIntelligenceEngine } from './engines/maintenance-intelligence.engine';
import { RagEnrichmentEngine } from './engines/rag-enrichment.engine';

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
    private readonly ragEngine: RagEnrichmentEngine,
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
    const parseResult = AnalyzeDiagnosticInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Validation error: ${parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      };
    }
    const input = parseResult.data;

    // ── 2. Signal Interpretation Engine ─────────────────
    const signal = await this.signalEngine.interpret(input);
    if (!signal.system_confirmed) {
      return {
        success: false,
        error: `Système inconnu: ${input.system_scope}. Systèmes disponibles: freinage`,
      };
    }

    // ── 3. Fetch raw data from DB ──────────────────────
    const scoredLinks = await this.dataService.getScoredCausesForSymptoms(
      signal.resolved_symptom_slugs,
    );
    const safetyRules = await this.dataService.getSafetyRules(
      input.system_scope,
    );

    // ── 4. Hypothesis Scoring Engine (multi-couches) ───
    const hypotheses = this.scoringEngine.score(
      scoredLinks,
      input.vehicle_context,
      input.usage_context,
    );

    // ── 5. Risk Safety Engine ──────────────────────────
    const risk = this.riskEngine.assess(
      hypotheses,
      safetyRules,
      signal.resolved_symptom_slugs,
    );

    // ── 6. Catalog Orientation Engine ──────────────────
    const catalog = this.catalogEngine.evaluate(
      hypotheses,
      risk,
      input.vehicle_context,
    );

    // ── 7. Maintenance Intelligence Engine ─────────────
    const maintenance = await this.maintenanceEngine.assess(
      signal.resolved_symptom_slugs,
      input.vehicle_context,
      input.usage_context,
    );

    // ── 8. RAG Enrichment Engine (graceful degradation) ─
    const ragFacts = await this.ragEngine.enrich(
      input.system_scope,
      signal.resolved_symptom_slugs,
      hypotheses,
    );

    // ── 9. Assemble EvidencePack ───────────────────────
    const evidencePack = this.assembleEvidencePack(
      input,
      signal,
      hypotheses,
      risk,
      catalog,
      maintenance,
      ragFacts,
    );

    const elapsed = Date.now() - startTime;
    this.logger.log(
      `Diagnostic completed in ${elapsed}ms — ${hypotheses.length} hypotheses, ` +
        `risk=${risk.risk_level}, catalog=${catalog.ready_for_catalog}, ` +
        `rag_facts=${ragFacts.length}`,
    );

    // ── 10. Save session ───────────────────────────────
    const sessionId = await this.dataService.saveSession({
      intent_type: input.intent_type,
      system_scope: input.system_scope,
      vehicle_context: input.vehicle_context || {},
      signal_input: input.signal_input as Record<string, unknown>,
      answers: input.answers || {},
      result: evidencePack as unknown as Record<string, unknown>,
    });

    return {
      success: true,
      data: { evidence: evidencePack, session_id: sessionId },
    };
  }

  /**
   * Assemble final EvidencePack from all engine outputs
   */
  private assembleEvidencePack(
    input: AnalyzeDiagnosticInput,
    signal: Awaited<ReturnType<SignalInterpretationEngine['interpret']>>,
    hypotheses: ReturnType<HypothesisScoringEngine['score']>,
    risk: ReturnType<RiskSafetyEngine['assess']>,
    catalog: ReturnType<CatalogOrientationEngine['evaluate']>,
    maintenance: Awaited<ReturnType<MaintenanceIntelligenceEngine['assess']>>,
    ragFacts: RagFact[],
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

    if (vc.mileage_km) {
      confirmed.push(
        `Kilométrage: ${vc.mileage_km.toLocaleString('fr-FR')} km`,
      );
    } else {
      missing.push('Kilométrage non renseigné');
    }

    if (input.usage_context?.usage_profile) {
      confirmed.push(`Profil d'usage: ${input.usage_context.usage_profile}`);
    } else {
      missing.push("Profil d'usage non renseigné");
    }

    if (input.usage_context?.last_service_km) {
      confirmed.push(
        `Dernier entretien: ${input.usage_context.last_service_km.toLocaleString('fr-FR')} km`,
      );
    } else {
      missing.push('Historique entretien non renseigné');
    }

    confirmed.push(`Système: ${signal.system_label}`);
    confirmed.push(`Symptôme principal: ${input.signal_input.primary_signal}`);
    if (input.signal_input.secondary_signals?.length) {
      confirmed.push(
        `Symptômes secondaires: ${input.signal_input.secondary_signals.join(', ')}`,
      );
    }
    if (signal.unresolved_signals.length > 0) {
      missing.push(
        `Signaux non reconnus: ${signal.unresolved_signals.join(', ')}`,
      );
    }

    // ── System suspects ────────────────────────────────
    const systemSuspects = [
      ...new Set(
        hypotheses
          .filter((h) => h.total_score >= 15)
          .flatMap((h) => h.related_gamme_slugs || [h.label]),
      ),
    ];

    // ── Map hypotheses to contract format ──────────────
    const contractHypotheses = hypotheses.map((h) => ({
      hypothesis_id: h.hypothesis_id,
      label: h.label,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cause_type: h.cause_type as any,
      relative_score: h.total_score,
      urgency: h.urgency,
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
    const forbiddenClaims = [
      'Vos plaquettes sont usées.',
      'Il faut changer les disques.',
      'Le problème vient certainement de X.',
      'Achetez des plaquettes maintenant.',
    ];

    return {
      evidence_pack: {
        factual_inputs_confirmed: confirmed,
        factual_inputs_missing: missing,
        system_suspects: systemSuspects,
        candidate_hypotheses: contractHypotheses,
        maintenance_links: maintenance.maintenance_links,
        risk_flags: risk.risk_flags,
        safety_alert: risk.safety_alert,
        risk_level: risk.risk_level,
        signal_quality: signal.signal_quality,
        catalog_guard: {
          ready_for_catalog: catalog.ready_for_catalog,
          confidence_before_purchase: (catalog.confidence_before_purchase ===
          'insufficient'
            ? 'low'
            : catalog.confidence_before_purchase) as 'low' | 'medium' | 'high',
          allowed_output_mode: (catalog.allowed_output_mode ===
          'catalog_reference_with_caution'
            ? 'catalog_family_with_caution'
            : catalog.allowed_output_mode) as
            | 'none'
            | 'catalog_family_only'
            | 'catalog_family_with_caution',
          reason: catalog.reason,
          suggested_gammes: catalog.suggested_gammes,
        },
        maintenance_recommendations: maintenance.recommendations,
        rag_facts: ragFacts.length > 0 ? ragFacts : undefined,
        allowed_claims: allowedClaims,
        forbidden_claims_runtime: forbiddenClaims,
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
            ready_for_catalog: catalog.ready_for_catalog,
            confidence_before_purchase: catalog.confidence_before_purchase,
            allowed_output_mode: catalog.allowed_output_mode,
            suggested_gammes: catalog.suggested_gammes,
          },
        },
      },
    };
  }
}
