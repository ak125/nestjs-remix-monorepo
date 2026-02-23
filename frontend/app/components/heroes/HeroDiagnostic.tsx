/**
 * HeroDiagnostic — Intent classes: DIAGNOSTIC, PANNE_SYMPTOME
 * hero_policy: illustration (fond sombre, icone, accent par severity)
 *
 * PANNE_SYMPTOME est un alias de HeroDiagnostic avec severity="warning".
 *
 * @see frontend/app/components/heroes/_hero.contract.md
 * @see .spec/00-canon/image-matrix-v1.md §2, §7
 */

import { type LucideIcon, Wrench } from "lucide-react";

interface HeroDiagnosticProps {
  /** Titre H1 principal */
  title: string;
  /** Description courte */
  description?: string;
  /** Icone lucide-react (defaut: Wrench) */
  icon?: LucideIcon;
  /** Severity: modifie l'accent couleur */
  severity?: "info" | "warning" | "danger";
  /** Classes CSS additionnelles */
  className?: string;
}

const SEVERITY_STYLES = {
  info: {
    accent: "text-blue-400",
    accentBg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  warning: {
    accent: "text-amber-400",
    accentBg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  danger: {
    accent: "text-red-400",
    accentBg: "bg-red-500/10",
    border: "border-red-500/20",
  },
} as const;

export function HeroDiagnostic({
  title,
  description,
  icon: Icon = Wrench,
  severity = "info",
  className = "",
}: HeroDiagnosticProps) {
  const styles = SEVERITY_STYLES[severity];

  return (
    <section
      className={`bg-gradient-to-br from-slate-900 to-gray-800 text-white py-8 md:py-12 ${className}`}
    >
      <div className="container mx-auto px-4">
        <div className="max-w-4xl flex items-start gap-4">
          <div
            className={`flex-shrink-0 p-3 rounded-xl ${styles.accentBg} border ${styles.border}`}
          >
            <Icon className={`w-6 h-6 md:w-7 md:h-7 ${styles.accent}`} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-sm md:text-base text-gray-300 max-w-2xl">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
