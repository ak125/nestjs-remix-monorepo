/**
 * IntentResolutionBlock — V1A.0 container
 *
 * Renderer pur du payload V1A.0 (`intent` + `recommended_actions` + `human_escalation`).
 * Aucune logique métier : layout HumanEscalation (primary boost) → Actions → HumanEscalation (secondary fallback).
 *
 * Composé par DiagnosticResults.tsx quand le payload backend contient les champs V1A.0.
 */
import type {
  IntentLayer,
  RecommendedAction,
  HumanEscalation,
} from "./v1a-intent-types";
import { RecommendedActionList } from "./RecommendedActionList";
import { HumanEscalationCard } from "./HumanEscalationCard";

interface Props {
  sessionId: string | null;
  intent: IntentLayer;
  recommendedActions: RecommendedAction[];
  humanEscalation: HumanEscalation;
}

export function IntentResolutionBlock({
  sessionId,
  intent,
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
          intent={intent.value}
          confidence={intent.confidence}
        />
      )}

      <RecommendedActionList
        actions={recommendedActions}
        sessionId={sessionId}
        intent={intent.value}
      />

      {!humanEscalation.priority_boost && (
        <HumanEscalationCard
          escalation={humanEscalation}
          sessionId={sessionId}
          intent={intent.value}
          confidence={intent.confidence}
        />
      )}
    </section>
  );
}
