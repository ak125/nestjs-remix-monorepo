/**
 * RecommendedActionList — V1A.0 renderer pur
 *
 * Lit `recommended_actions` ordonnées par backend (priority ascending strict).
 * Render `.map()` — JAMAIS de tri, filtre, ou modification d'ordre côté frontend.
 *
 * Backend = single source of truth.
 */
import { ActionCard } from "./ActionCard";
import { type RecommendedAction } from "./v1a-intent-types";

interface Props {
  actions: RecommendedAction[];
  sessionId: string | null;
}

export function RecommendedActionList({ actions, sessionId }: Props) {
  if (actions.length === 0) return null;
  return (
    <section
      aria-label="Actions recommandées"
      className="flex flex-col gap-3"
    >
      <h3 className="text-lg font-semibold">Que faire maintenant ?</h3>
      {actions.map((action) => (
        <ActionCard
          key={`${action.type}-${action.priority}`}
          action={action}
          sessionId={sessionId}
          variant={action.priority === 1 ? "primary" : "secondary"}
        />
      ))}
    </section>
  );
}
