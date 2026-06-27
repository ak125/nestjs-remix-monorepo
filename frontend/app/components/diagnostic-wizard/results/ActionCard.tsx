/**
 * ActionCard — V1A.0 atomic renderer
 *
 * Renderer pur d'une `RecommendedAction`. Aucune logique métier ;
 * lit `type`/`label_key`/`target`/`target_role`, render, log click via handoff API.
 */
import {
  PhoneCall,
  Wrench,
  ShoppingCart,
  FileText,
  BookOpen,
  Package,
  HelpCircle,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { emitHandoff } from "./v1a-handoff-client";
import {
  type ActionType,
  type RecommendedAction,
  type DiagnosticIntent,
} from "./v1a-intent-types";

const ICONS: Record<ActionType, React.ComponentType<{ className?: string }>> = {
  piece: ShoppingCart,
  devis: FileText,
  appel: PhoneCall,
  garage: Wrench,
  guide: BookOpen,
  entretien_pack: Package,
  faq: HelpCircle,
  assistant_diagnostic: Stethoscope,
  human_resolution: UserRound,
};

/** Labels FR par défaut (i18n hook : remplacer par lookup label_key) */
const DEFAULT_LABELS: Record<ActionType, string> = {
  piece: "Voir la pièce",
  devis: "Demander un devis",
  appel: "Appeler un conseiller",
  garage: "Trouver un garage",
  guide: "Consulter le guide",
  entretien_pack: "Pack entretien",
  faq: "FAQ associée",
  assistant_diagnostic: "Affiner le diagnostic",
  human_resolution: "Parler à un humain",
};

interface Props {
  action: RecommendedAction;
  sessionId: string | null;
  intent: DiagnosticIntent;
  variant?: "primary" | "secondary";
}

export function ActionCard({
  action,
  sessionId,
  intent,
  variant = "secondary",
}: Props) {
  const Icon = ICONS[action.type];
  const label = DEFAULT_LABELS[action.type];

  const handleClick = () => {
    if (sessionId) {
      void emitHandoff({
        session_id: sessionId,
        action_type: action.type,
        target_role: action.target_role,
        intent,
        confidence: action.confidence,
      });
    }
  };

  const isExternal =
    action.target.startsWith("tel:") || action.target.startsWith("mailto:");

  return (
    <Card
      className={`flex items-center gap-3 p-4 ${
        variant === "primary"
          ? "border-2 border-primary bg-primary/5"
          : "border"
      }`}
    >
      <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden />
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          Priorité {action.priority}
        </p>
      </div>
      <Button
        asChild
        size="sm"
        variant={variant === "primary" ? "default" : "outline"}
        onClick={handleClick}
      >
        {isExternal ? (
          <a href={action.target}>Aller</a>
        ) : (
          <Link to={action.target}>Aller</Link>
        )}
      </Button>
    </Card>
  );
}
