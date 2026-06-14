/**
 * DiagnosticResults — Container for 8 V1 result blocks
 *
 * Renders EvidencePack from API into visual blocks.
 * Order: Safety → Summary → Hypotheses → RAG Facts → Maintenance → Catalog → Missing → Disclaimer
 */
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { type WizardState, type WizardAction } from "../types";
import { AudienceToggle, type Audience } from "./AudienceToggle";
import { IntentResolutionBlock } from "./IntentResolutionBlock";
import { ResultCatalog } from "./ResultCatalog";
import { ResultDisclaimer } from "./ResultDisclaimer";
import { ResultDrivability } from "./ResultDrivability";
import { ResultGarageReport } from "./ResultGarageReport";
import { ResultHypotheses } from "./ResultHypotheses";
import { ResultMaintenance } from "./ResultMaintenance";
import { ResultMissing } from "./ResultMissing";
import { ResultRagFacts } from "./ResultRagFacts";
import { ResultSafety } from "./ResultSafety";
import { ResultSummary } from "./ResultSummary";
// V1A.0 — Intent Resolution renderer (additif, conditionné par présence des champs)

/**
 * Kill-switch PR-1a (DIAGNOSTIC_RESULT_UX_V2_ENABLED, exposé via window.ENV dans root.tsx).
 * OFF (défaut) → rendu inchangé. Lecture sûre (cast local, cf. entry.client.tsx).
 * Les résultats sont rendus côté client (step 3 après fetch) → pas de mismatch SSR.
 */
function isResultUxV2Enabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window as unknown as { ENV?: { DIAGNOSTIC_RESULT_UX_V2_ENABLED?: boolean } })
      .ENV?.DIAGNOSTIC_RESULT_UX_V2_ENABLED === true
  );
}

interface Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  loadingStepLabel?: string;
  onRetry?: () => void;
}

export function DiagnosticResults({
  state,
  dispatch: _dispatch,
  loadingStepLabel,
  onRetry,
}: Props) {
  // PR-1a — hooks/flags AVANT tout early-return (règle des hooks React)
  const uxV2 = isResultUxV2Enabled();
  const [audience, setAudience] = useState<Audience>("particulier");

  if (state.loading) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 space-y-5"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-blue-100" />
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin absolute inset-0" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-medium text-gray-700 transition-opacity duration-300">
            {loadingStepLabel || "Analyse en cours..."}
          </p>
          <p className="text-xs text-gray-400">Cela prend quelques secondes</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-6 text-center space-y-3"
        role="alert"
      >
        <p className="text-red-700 font-medium">Erreur de diagnostic</p>
        <p className="text-sm text-red-600">{state.error}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-1.5 mt-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Réessayer l&apos;analyse
          </Button>
        )}
      </div>
    );
  }

  const ep = state.result?.evidence_pack;
  if (!ep) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-gray-500">Aucun résultat disponible.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      {/* PR-1a — bascule particulier / mécano (kill-switch DIAGNOSTIC_RESULT_UX_V2_ENABLED) */}
      {uxV2 && (
        <div className="flex justify-end">
          <AudienceToggle value={audience} onChange={setAudience} />
        </div>
      )}

      {/* Block 1: Safety alert (only if risk_flags present) */}
      {ep.risk_flags.length > 0 && (
        <ResultSafety
          riskLevel={ep.risk_level}
          riskFlags={ep.risk_flags}
          safetyAlert={ep.safety_alert}
        />
      )}

      {/* PR-1a — Puis-je rouler ? (verdict toujours affiché ; "à confirmer" si risk_level absent) */}
      {uxV2 && (
        <ResultDrivability
          riskLevel={ep.risk_level}
          safetyAlert={ep.safety_alert}
        />
      )}

      {/* Block 2: Summary */}
      <ResultSummary
        confirmed={ep.factual_inputs_confirmed}
        systemSuspects={ep.system_suspects}
        signalQuality={ep.signal_quality}
        hypothesesCount={ep.candidate_hypotheses.length}
      />

      {/* V1A.0 — Intent Resolution Block (additif, présent si backend feature flag ON) */}
      {state.result?.intent &&
        state.result?.recommended_actions &&
        state.result?.human_escalation && (
          <IntentResolutionBlock
            sessionId={state.result.session_id ?? null}
            intent={state.result.intent}
            recommendedActions={state.result.recommended_actions}
            humanEscalation={state.result.human_escalation}
          />
        )}

      {/* Block 3: Hypotheses (audience par défaut "mecano" si flag OFF → rendu inchangé) */}
      {ep.candidate_hypotheses.length > 0 && (
        <ResultHypotheses
          hypotheses={ep.candidate_hypotheses}
          audience={uxV2 ? audience : "mecano"}
        />
      )}

      {/* Block 4: RAG documentation facts */}
      {ep.rag_facts && ep.rag_facts.length > 0 && (
        <ResultRagFacts facts={ep.rag_facts} />
      )}

      {/* Block 5: Maintenance */}
      {ep.maintenance_recommendations &&
        ep.maintenance_recommendations.length > 0 && (
          <ResultMaintenance
            recommendations={ep.maintenance_recommendations}
            maintenanceLinks={ep.maintenance_links}
          />
        )}

      {/* Block 6: Catalog orientation */}
      <ResultCatalog catalogGuard={ep.catalog_guard} />

      {/* Block 7: Missing data */}
      {ep.factual_inputs_missing.length > 0 && (
        <ResultMissing missing={ep.factual_inputs_missing} />
      )}

      {/* PR-1a — Rapport garage (composition éphémère client-side, 0 persistance) */}
      {uxV2 && (
        <ResultGarageReport
          vehicle={state.vehicle}
          symptomSlugs={state.symptomSlugs}
          hypotheses={ep.candidate_hypotheses}
          suggestedGammes={ep.catalog_guard.suggested_gammes}
          missing={ep.factual_inputs_missing}
        />
      )}

      {/* Block 8: Disclaimer */}
      <ResultDisclaimer claims={ep.allowed_claims} />
    </div>
  );
}
