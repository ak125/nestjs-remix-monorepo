/**
 * IntentResolutionBlock — V1A.0 container
 *
 * Renderer pur du payload V1A.0 (`intent` + `recommended_actions` + `human_escalation`).
 * Aucune logique métier : layout HumanEscalation (primary boost) → Actions → HumanEscalation (secondary fallback).
 *
 * Composé par DiagnosticResults.tsx quand le payload backend contient les champs V1A.0.
 */
import { HumanEscalationCard } from "./HumanEscalationCard";
import { RecommendedActionList } from "./RecommendedActionList";
import  {
  type RecommendedAction,
  type HumanEscalation,
} from "./v1a-intent-types";

interface Props {
  sessionId: string | null;
  recommendedActions: RecommendedAction[];
  humanEscalation: HumanEscalation;
}

export function IntentResolutionBlock({
  sessionId,
  recommendedActions,
  humanEscalation,
}: Props) {
  return (
    <section
      aria-label="Résolution d'intention"
      className="flex flex-col gap-4 rounded-lg border bg-card p-6"
    >
      {humanEscalation.priority_boost && (
        <HumanEscalationCard
          escalation={humanEscalation}
          sessionId={sessionId}
        />
      )}

      <RecommendedActionList
        actions={recommendedActions}
        sessionId={sessionId}
      />

      {!humanEscalation.priority_boost && (
        <HumanEscalationCard
          escalation={humanEscalation}
          sessionId={sessionId}
        />
      )}
    </section>
  );
}
