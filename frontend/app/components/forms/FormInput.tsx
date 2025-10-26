/**
 * 🎨 FormInput - Input avec états normalisés (loading, error, success, disabled)
 * 
 * États visuels:
 * - default: Neutre
 * - loading/validating: Spinner + opacity
 * - error: Bordure rouge + icône
 * - success: Bordure verte + check
 * - disabled: Grisé + cursor-not-allowed
 * 
 * Auto-format:
 * - Immatriculation FR: AA-123-BB
 * - VIN: 17 caractères uppercase
 * - Téléphone FR: 06 12 34 56 78
 */

import * as React from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

type FormInputState = "default" | "loading" | "validating" | "error" | "success" | "disabled";

type AutoFormatType = "immatriculation" | "vin" | "type-mine" | "phone-fr" | "none";

export interface FormInputProps extends React.ComponentProps<"input"> {
  label?: string;
  error?: string;
  helperText?: string;
  state?: FormInputState;
  autoFormat?: AutoFormatType;
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      state = "default",
      autoFormat = "none",
      id: providedId,
      onChange,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    // Auto-détection de l'état
    const computedState = React.useMemo((): FormInputState => {
      if (props.disabled) return "disabled";
      if (error) return "error";
      return state;
    }, [state, error, props.disabled]);

    // Auto-format handlers
    const handleAutoFormat = (value: string): string => {
      switch (autoFormat) {
        case "immatriculation":
          return formatImmatriculation(value);
        case "vin":
          return formatVIN(value);
        case "type-mine":
          return formatTypeMine(value);
        case "phone-fr":
          return formatPhoneFR(value);
        default:
          return value;
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (autoFormat !== "none") {
        const formatted = handleAutoFormat(e.target.value);
        e.target.value = formatted;
      }
      onChange?.(e);
    };

    // Styles selon l'état
    const stateStyles = {
      default: "border-input focus-visible:ring-ring",
      loading: "border-input opacity-70 cursor-wait",
      validating: "border-blue-300 focus-visible:ring-blue-500",
      error: "border-red-500 focus-visible:ring-red-500",
      success: "border-green-500 focus-visible:ring-green-500",
      disabled: "opacity-50 cursor-not-allowed bg-gray-50",
    };

    // Icône de fin selon l'état
    const EndIcon = () => {
      switch (computedState) {
        case "loading":
        case "validating":
          return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
        case "error":
          return <AlertCircle className="w-4 h-4 text-red-500" />;
        case "success":
          return <Check className="w-4 h-4 text-green-500" />;
        default:
          return null;
      }
    };

    const showIcon = ["loading", "validating", "error", "success"].includes(computedState);

    return (
      <div className="space-y-1.5">
        {/* Label */}
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "text-sm font-medium leading-none",
              computedState === "disabled" ? "text-gray-400" : "text-foreground"
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Input avec icône */}
        <div className="relative">
          <input
            type={type}
            id={id}
            ref={ref}
            aria-invalid={computedState === "error"}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            disabled={computedState === "disabled"}
            onChange={handleChange}
            className={cn(
              "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background",
              "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              "transition-colors duration-200",
              stateStyles[computedState],
              showIcon && "pr-10", // Espace pour l'icône
              className
            )}
            {...props}
          />

          {/* Icône de fin */}
          {showIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <EndIcon />
            </div>
          )}
        </div>

        {/* Messages d'erreur */}
        {error && (
          <p id={errorId} className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {/* Helper text */}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

FormInput.displayName = "FormInput";

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 AUTO-FORMAT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format immatriculation française: AA-123-BB
 * Exemple: AB123CD → AB-123-CD
 */
function formatImmatriculation(value: string): string {
  // Supprimer tout sauf lettres et chiffres
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Format: AA-123-BB (nouveau format depuis 2009)
  if (cleaned.length <= 2) {
    return cleaned;
  } else if (cleaned.length <= 5) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  } else if (cleaned.length <= 7) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
  }

  // Limiter à 7 caractères
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5, 7)}`;
}

/**
 * Format VIN (Vehicle Identification Number)
 * - 17 caractères uppercase
 * - Pas de I, O, Q (confusion avec 1, 0)
 */
function formatVIN(value: string): string {
  // Supprimer tout sauf alphanumériques, exclure I, O, Q
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-HJ-NPR-Z0-9]/g, "")
    .slice(0, 17);

  return cleaned;
}

/**
 * Format Type Mine (Code national d'identification du type)
 * Exemples: M10RENAULT, ABC1234, K9KF7
 * - Lettres uppercase suivies de chiffres/lettres
 * - Généralement 7-10 caractères
 */
function formatTypeMine(value: string): string {
  // Supprimer tout sauf alphanumériques, uppercase
  const cleaned = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12); // Max 12 caractères

  return cleaned;
}

/**
 * Format téléphone français: 06 12 34 56 78
 */
function formatPhoneFR(value: string): string {
  // Supprimer tout sauf chiffres
  const cleaned = value.replace(/\D/g, "");

  // Format par paires
  if (cleaned.length <= 2) {
    return cleaned;
  } else if (cleaned.length <= 4) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
  } else if (cleaned.length <= 6) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4)}`;
  } else if (cleaned.length <= 8) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6)}`;
  } else if (cleaned.length <= 10) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }

  // Limiter à 10 chiffres
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`;
}

export { FormInput };
