/**
 * 🛡️ FrictionReducer - Réducteurs de friction pour rassurer
 * 
 * Assurances:
 * - Retour 30 jours
 * - Paiement sécurisé
 * - Satisfaction garantie
 * - Support 7j/7
 */

import { RotateCcw, Lock, Shield, Headphones } from "lucide-react";
import { cn } from "~/lib/utils";

export type AssuranceType = "return" | "secure-payment" | "satisfaction" | "support";

interface FrictionReducerProps {
  type: AssuranceType;
  variant?: "default" | "compact";
  className?: string;
}

const ASSURANCE_CONFIG = {
  return: {
    icon: RotateCcw,
    title: "Retour 30 jours",
    description: "Remboursement intégral sans question",
    color: "text-blue-600",
  },
  "secure-payment": {
    icon: Lock,
    title: "Paiement sécurisé",
    description: "SSL + 3D Secure, vos données protégées",
    color: "text-green-600",
  },
  satisfaction: {
    icon: Shield,
    title: "Satisfait ou remboursé",
    description: "Garantie qualité 100%",
    color: "text-purple-600",
  },
  support: {
    icon: Headphones,
    title: "Support 7j/7",
    description: "Réponse en moins de 2h",
    color: "text-orange-600",
  },
} as const;

export function FrictionReducer({ type, variant = "default", className }: FrictionReducerProps) {
  const config = ASSURANCE_CONFIG[type];
  const Icon = config.icon;

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <Icon className={cn("w-4 h-4 flex-shrink-0", config.color)} />
        <span className="font-medium text-gray-700">{config.title}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className={cn("p-2 bg-gray-50 rounded-lg", config.color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-gray-900">{config.title}</div>
        <div className="text-sm text-gray-600 mt-0.5">{config.description}</div>
      </div>
    </div>
  );
}

/**
 * FrictionReducerGroup - Groupe d'assurances
 */
interface FrictionReducerGroupProps {
  assurances: AssuranceType[];
  variant?: "default" | "compact";
  layout?: "grid" | "list";
  className?: string;
}

export function FrictionReducerGroup({
  assurances,
  variant = "default",
  layout = "grid",
  className,
}: FrictionReducerGroupProps) {
  const isCompact = variant === "compact";
  
  return (
    <div
      className={cn(
        layout === "grid"
          ? `grid gap-${isCompact ? "3" : "4"} ${assurances.length === 2 ? "grid-cols-2" : assurances.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1"}`
          : "flex flex-col gap-3",
        className
      )}
    >
      {assurances.map((type) => (
        <FrictionReducer key={type} type={type} variant={variant} />
      ))}
    </div>
  );
}
