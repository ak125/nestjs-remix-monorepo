/**
 * DiagnosticResults — Container for 8 V1 result blocks
 *
 * Renders EvidencePack from API into visual blocks.
 * Order: Safety → Summary → Hypotheses → RAG Facts → Maintenance → Catalog → Missing → Disclaimer
 */
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { type WizardState, type WizardAction } from "../types";
import { ResultCatalog } from "./ResultCatalog";
import { ResultDisclaimer } from "./ResultDisclaimer";
import { ResultHypotheses } from "./ResultHypotheses";
import { ResultMaintenance } from "./ResultMaintenance";
import { ResultMissing } from "./ResultMissing";
import { ResultRagFacts } from "./ResultRagFacts";
import { ResultSafety } from "./ResultSafety";
import { ResultSummary } from "./ResultSummary";

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
      {/* Block 1: Safety alert (only if risk_flags present) */}
      {ep.risk_flags.length > 0 && (
        <ResultSafety
          riskLevel={ep.risk_level}
          riskFlags={ep.risk_flags}
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

      {/* Block 3: Hypotheses */}
      {ep.candidate_hypotheses.length > 0 && (
        <ResultHypotheses hypotheses={ep.candidate_hypotheses} />
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

      {/* Block 8: Disclaimer */}
      <ResultDisclaimer claims={ep.allowed_claims} />
    </div>
  );
}
