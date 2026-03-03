/**
 * TechnicalReference - Clarté technique sans jargon
 *
 * Principes UX:
 * - Police mono pour références OEM = clarté technique
 * - Copyable = facilite recherche externe
 * - Tooltips = explications contextuelles
 * - Highlighting = lisibilité accrue
 * - Pas de jargon inutile = accessibilité
 *
 * @example
 * ```tsx
 * <OEMReference value="04E115561H" manufacturer="VAG" />
 * <TechnicalSpec label="Viscosité" value="5W-30" explanation="..." />
 * <CompatibilityCode code="API SN/CF" copyable />
 * ```
 */

import { useState, type ReactNode } from "react";
import { logger } from "~/utils/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface OEMReferenceProps {
  /** Référence OEM */
  value: string;

  /** Constructeur (VAG, PSA, Renault...) */
  manufacturer?: string;

  /** Label personnalisé */
  label?: string;

  /** Copyable au clic */
  copyable?: boolean;

  /** Afficher tooltip avec explication */
  showTooltip?: boolean;

  /** Taille */
  size?: "small" | "medium" | "large";

  /** Highlighted (fond coloré) */
  highlighted?: boolean;
}

export interface TechnicalSpecProps {
  /** Label (éviter jargon) */
  label: string;

  /** Valeur technique */
  value: string | number;

  /** Explication en langage clair (tooltip) */
  explanation?: string;

  /** Unité */
  unit?: string;

  /** Icône */
  icon?: ReactNode;

  /** Importance (affecte le style) */
  importance?: "critical" | "important" | "normal";
}

export interface CompatibilityCodeProps {
  /** Code de compatibilité (ex: API SN, ACEA C3) */
  code: string;

  /** Type de norme */
  type?: "API" | "ACEA" | "SAE" | "ISO" | "DIN" | "custom";

  /** Description vulgarisée */
  description?: string;

  /** Copyable */
  copyable?: boolean;
}

export interface TechnicalTooltipProps {
  /** Contenu du tooltip */
  content: ReactNode;

  /** Position */
  position?: "top" | "bottom" | "left" | "right";

  /** Enfant (trigger) */
  children: ReactNode;
}

// ============================================================================
// RÉFÉRENCE OEM (POLICE MONO)
// ============================================================================

export function OEMReference({
  value,
  manufacturer,
  label = "Réf. OEM",
  copyable = true,
  showTooltip = true,
  size = "medium",
  highlighted = true,
}: OEMReferenceProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyable) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Copy failed:", err);
    }
  };

  const sizeClasses =
    size === "large"
      ? "text-lg px-4 py-2"
      : size === "small"
        ? "text-xs px-2 py-1"
        : "text-sm px-3 py-1.5";

  const baseClasses = `
    inline-flex items-center gap-2 rounded-md font-mono font-semibold
    transition-all duration-200
    ${highlighted ? "bg-neutral-50 border border-gray-200" : "bg-transparent"}
    ${copyable ? "cursor-pointer hover:bg-gray-200 hover:border-gray-300 active:bg-gray-300" : ""}
    ${sizeClasses}
  `
    .trim()
    .replace(/\s+/g, " ");

  const tooltipContent = (
    <div className="text-xs font-sans">
      {manufacturer && (
        <p className="font-semibold mb-1">Constructeur: {manufacturer}</p>
      )}
      <p>Référence d'origine constructeur (OEM)</p>
      {copyable && <p className="text-gray-400 mt-1">Cliquez pour copier</p>}
    </div>
  );

  const content = (
    <div className={baseClasses} onClick={handleCopy}>
      <span className="text-gray-500 font-sans text-xs uppercase tracking-wide">
        {label}
      </span>
      <span className="text-secondary-500 font-mono font-bold tracking-wider">
        {value}
      </span>

      {copyable && (
        <span className="text-gray-400 hover:text-gray-500 transition-colors">
          {copied ? "✓" : "📋"}
        </span>
      )}

      {copied && (
        <span className="text-xs font-sans text-semantic-success font-semibold">
          Copié!
        </span>
      )}
    </div>
  );

  return showTooltip ? (
    <TechnicalTooltip content={tooltipContent}>{content}</TechnicalTooltip>
  ) : (
    content
  );
}

// ============================================================================
// SPÉCIFICATION TECHNIQUE (CLARTÉ)
// ============================================================================

export function TechnicalSpec({
  label,
  value,
  explanation,
  unit,
  icon,
  importance = "normal",
}: TechnicalSpecProps) {
  const importanceColors = {
    critical: "border-l-4 border-red-700 bg-red-100",
    important: "border-l-4 border-amber-500 bg-orange-50",
    normal: "border-l-2 border-gray-200 bg-neutral-50",
  };

  const content = (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-lg ${importanceColors[importance]}`}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="text-xl flex-shrink-0">{icon}</div>}

        <div>
          <p className="text-sm font-sans font-medium text-gray-500">{label}</p>
        </div>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="text-lg font-mono font-bold text-secondary-500">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-sans text-gray-400">{unit}</span>
        )}
      </div>
    </div>
  );

  return explanation ? (
    <TechnicalTooltip content={explanation} position="right">
      {content}
    </TechnicalTooltip>
  ) : (
    content
  );
}

// ============================================================================
// CODE DE COMPATIBILITÉ (NORMES)
// ============================================================================

const COMPATIBILITY_TYPE_CONFIG = {
  API: {
    icon: "🔧",
    fullName: "American Petroleum Institute",
    color: "bg-secondary-500",
  },
  ACEA: {
    icon: "🇪🇺",
    fullName: "Association des Constructeurs Européens d'Automobiles",
    color: "bg-blue-800",
  },
  SAE: {
    icon: "⚙️",
    fullName: "Society of Automotive Engineers",
    color: "bg-blue-700",
  },
  ISO: {
    icon: "🌐",
    fullName: "International Organization for Standardization",
    color: "bg-teal-600",
  },
  DIN: {
    icon: "🇩🇪",
    fullName: "Deutsches Institut für Normung",
    color: "bg-gray-700",
  },
  custom: {
    icon: "📌",
    fullName: "Norme spécifique",
    color: "bg-gray-500",
  },
} as const;

export function CompatibilityCode({
  code,
  type = "custom",
  description,
  copyable = true,
}: CompatibilityCodeProps) {
  const [copied, setCopied] = useState(false);
  const config = COMPATIBILITY_TYPE_CONFIG[type];

  const handleCopy = async () => {
    if (!copyable) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error("Copy failed:", err);
    }
  };

  const tooltipContent = (
    <div className="max-w-xs text-xs font-sans">
      <p className="font-semibold mb-1">{config.fullName}</p>
      {description && <p className="text-gray-300">{description}</p>}
    </div>
  );

  return (
    <TechnicalTooltip content={tooltipContent}>
      <div
        className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-full
          ${config.color} text-white font-sans text-sm font-semibold
          ${copyable ? "cursor-pointer hover:opacity-90 active:opacity-80" : ""}
          transition-opacity duration-200
        `}
        onClick={handleCopy}
      >
        <span>{config.icon}</span>
        <span className="font-mono tracking-wide">{code}</span>
        {copyable && !copied && <span className="text-xs opacity-75">📋</span>}
        {copied && <span className="text-xs">✓</span>}
      </div>
    </TechnicalTooltip>
  );
}

// ============================================================================
// TOOLTIP TECHNIQUE (EXPLICATIONS)
// ============================================================================

export function TechnicalTooltip({
  content,
  position = "top",
  children,
}: TechnicalTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-gray-800 border-x-transparent border-b-transparent",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-b-gray-800 border-x-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-gray-800 border-y-transparent border-r-transparent",
    right:
      "right-full top-1/2 -translate-y-1/2 border-r-gray-800 border-y-transparent border-l-transparent",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      {isVisible && (
        <div
          className={`
            absolute z-50 px-3 py-2 bg-gray-800 text-white rounded-lg shadow-xl
            ${positionClasses[position]}
            animate-fade-in pointer-events-none
          `}
          style={{ minWidth: "150px", maxWidth: "300px" }}
        >
          {content}

          {/* Arrow */}
          <div
            className={`
              absolute w-0 h-0
              border-4
              ${arrowClasses[position]}
            `}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// GROUPE DE RÉFÉRENCES (LAYOUT)
// ============================================================================

interface TechnicalReferenceGroupProps {
  children: ReactNode;
  title?: string;
  layout?: "stack" | "grid" | "inline";
  spacing?: "compact" | "comfortable";
}

export function TechnicalReferenceGroup({
  children,
  title,
  layout = "stack",
  spacing = "comfortable",
}: TechnicalReferenceGroupProps) {
  const gapClasses = spacing === "compact" ? "gap-2" : "gap-4";

  const layoutClasses =
    layout === "grid"
      ? `grid grid-cols-1 md:grid-cols-2 ${gapClasses}`
      : layout === "inline"
        ? `flex flex-wrap items-center ${gapClasses}`
        : `flex flex-col ${gapClasses}`;

  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-sm font-sans font-semibold text-gray-500 uppercase tracking-wide">
          {title}
        </h3>
      )}
      <div className={layoutClasses}>{children}</div>
    </div>
  );
}

// ============================================================================
// RÉFÉRENCE MULTI-CONSTRUCTEURS
// ============================================================================

interface MultiOEMReferenceProps {
  references: Array<{
    manufacturer: string;
    value: string;
  }>;
  title?: string;
  copyable?: boolean;
}

export function MultiOEMReference({
  references,
  title = "Références équivalentes",
  copyable = true,
}: MultiOEMReferenceProps) {
  return (
    <div className="p-4 bg-neutral-50 rounded-lg border border-gray-200">
      <p className="text-sm font-sans font-semibold text-gray-500 mb-3">
        {title}
      </p>

      <div className="flex flex-col gap-2">
        {references.map((ref, index) => (
          <OEMReference
            key={index}
            value={ref.value}
            manufacturer={ref.manufacturer}
            label={ref.manufacturer}
            copyable={copyable}
            showTooltip={false}
            highlighted={false}
            size="small"
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// VULGARISATION TECHNIQUE
// ============================================================================

interface SimplifiedExplanationProps {
  /** Terme technique */
  technicalTerm: string;

  /** Explication simple */
  simpleExplanation: string;

  /** Exemple concret (optionnel) */
  example?: string;

  /** Icône */
  icon?: ReactNode;
}

export function SimplifiedExplanation({
  technicalTerm,
  simpleExplanation,
  example,
  icon = "💡",
}: SimplifiedExplanationProps) {
  return (
    <div className="flex gap-3 p-4 bg-blue-50 border-l-4 border-secondary-500 rounded-lg">
      <div className="flex-shrink-0 text-2xl">{icon}</div>

      <div className="flex-1">
        <p className="text-sm font-sans font-semibold text-secondary-500 mb-1">
          {technicalTerm}
        </p>
        <p className="text-sm font-sans text-gray-500">{simpleExplanation}</p>
        {example && (
          <p className="text-xs font-sans text-gray-400 mt-2 italic">
            Exemple: {example}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CSS ANIMATIONS
// ============================================================================

export const technicalReferenceStyles = `
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
`;
