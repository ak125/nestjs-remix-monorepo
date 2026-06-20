/**
 * HumanEscalationCard — V1A.0 first-class citizen
 *
 * Doctrine : human_escalation toujours présent dans payload V1A.0.
 * `priority_boost` détermine la position visuelle :
 *   - true  : rendue en PRIMAIRE (au-dessus de RecommendedActionList)
 *   - false : rendue en SECONDAIRE (au-dessous, anti-cannibalisation)
 */
import { UserRound, AlertCircle } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { emitHandoff } from "./v1a-handoff-client";
import {
  type HumanEscalation,
  type DiagnosticIntent,
} from "./v1a-intent-types";

interface Props {
  escalation: HumanEscalation;
  sessionId: string | null;
  intent: DiagnosticIntent;
  confidence: number;
}

export function HumanEscalationCard({
  escalation,
  sessionId,
  intent,
  confidence,
}: Props) {
  if (!escalation.available) return null;

  const handleClick = () => {
    if (sessionId) {
      void emitHandoff({
        session_id: sessionId,
        action_type: "human_resolution",
        target_role: "human",
        intent,
        confidence,
      });
    }
  };

  const isExternal =
    escalation.target.startsWith("tel:") ||
    escalation.target.startsWith("mailto:");

  return (
    <Card
      className={`flex items-center gap-3 p-4 ${
        escalation.priority_boost
          ? "border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20"
          : "border"
      }`}
      role="region"
      aria-label="Escalade humaine"
    >
      {escalation.priority_boost ? (
        <AlertCircle
          className="h-6 w-6 flex-shrink-0 text-amber-600"
          aria-hidden
        />
      ) : (
        <UserRound
          className="h-6 w-6 flex-shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}
      <div className="flex-1">
        <p className="font-medium">
          {escalation.priority_boost
            ? "Besoin d'aide immédiate ?"
            : "Préfère parler à un humain ?"}
        </p>
        <p className="text-xs text-muted-foreground">
          Un conseiller peut vous aider.
        </p>
      </div>
      <Button
        asChild
        size="sm"
        variant={escalation.priority_boost ? "default" : "outline"}
        onClick={handleClick}
      >
        {isExternal ? (
          <a href={escalation.target}>Contacter</a>
        ) : (
          <Link to={escalation.target}>Contacter</Link>
        )}
      </Button>
    </Card>
  );
}
