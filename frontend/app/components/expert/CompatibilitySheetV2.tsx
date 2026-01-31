/**
 * CompatibilitySheet V2 Component
 * @description Vehicle compatibility sheet with Trust & Authority design
 * @version 2.0.0
 * @pack Pack Confiance V2 - Trust-First + Compatibility Verification
 *
 * Design System: ui-ux-pro-max + frontend-design
 * Style: Trust & Authority
 * Effects: Verified animation, smooth reveals, certificate styling
 * Typography: Lexend (heading) + Source Sans 3 (body) + JetBrains Mono (codes)
 *
 * Anti-patterns avoided:
 * - No generic green checkmarks
 * - No purple/pink gradients
 * - No cookie-cutter patterns
 */

import {
  X,
  AlertTriangle,
  Car,
  Hash,
  Calendar,
  Fuel,
  Copy,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { forwardRef, useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

// ============================================================================
// Design System Tokens
// ============================================================================

const _COLORS = {
  trust: {
    primary: "#0F766E",
    secondary: "#14B8A6",
    light: "#F0FDFA",
    border: "#99F6E4",
    text: "#134E4A",
  },
  cta: {
    DEFAULT: "#0369A1",
    hover: "#075985",
    light: "#E0F2FE",
  },
  verified: {
    DEFAULT: "#059669",
    light: "#ECFDF5",
    border: "#A7F3D0",
    text: "#065F46",
  },
  error: {
    DEFAULT: "#DC2626",
    light: "#FEF2F2",
    border: "#FECACA",
    text: "#991B1B",
  },
  neutral: {
    bg: "#F8FAFC",
    border: "#E2E8F0",
    text: "#475569",
    muted: "#94A3B8",
  },
} as const;

// ============================================================================
// Types
// ============================================================================

export interface VehicleInfoV2 {
  brand?: string;
  model?: string;
  generation?: string;
  yearFrom?: number;
  yearTo?: number;
  engineType?: string;
  engineCode?: string;
  fuelType?: "diesel" | "essence" | "hybride" | "electrique" | "gpl";
  powerHp?: number;
  cnit?: string;
  typeMine?: string;
}

export interface CompatibilitySheetV2Props {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isCompatible?: boolean | null;
  currentVehicle?: VehicleInfoV2;
  compatibleVehicles?: VehicleInfoV2[];
  oemReferences?: string[];
  productName?: string;
  trigger?: React.ReactNode;
  onConfirmCompatibility?: (vehicle: VehicleInfoV2) => void;
  onChangeVehicle?: () => void;
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

function CopyableCodeV2({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-2.5 group">
      <span className="text-sm text-slate-500">{label}</span>
      <button
        onClick={handleCopy}
        className={cn(
          "flex items-center gap-2",
          "px-2.5 py-2 rounded-md", // py-2 for 44px touch target (WCAG)
          "min-h-[44px]", // Guarantee WCAG touch target
          "bg-slate-50 hover:bg-slate-100",
          "border border-slate-200 hover:border-slate-300",
          "transition-all duration-200",
          "cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-[#0369A1] focus:ring-offset-2",
          copied && "bg-[#ECFDF5] border-[#A7F3D0]",
        )}
      >
        <code
          className={cn(
            "text-sm break-all", // break-all for long codes on mobile
            copied ? "text-[#065F46]" : "text-slate-700",
          )}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {value}
        </code>
        {copied ? (
          <CheckCircle2 className="h-4 w-4 text-[#059669] animate-[verified-reveal_300ms_ease-out]" />
        ) : (
          <Copy className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
        )}
      </button>
    </div>
  );
}

function VehicleCardV2({
  vehicle,
  isCurrent = false,
  onSelect,
  index = 0,
}: {
  vehicle: VehicleInfoV2;
  isCurrent?: boolean;
  onSelect?: () => void;
  index?: number;
}) {
  const fuelLabels: Record<string, string> = {
    diesel: "Diesel",
    essence: "Essence",
    hybride: "Hybride",
    electrique: "Électrique",
    gpl: "GPL",
  };

  const yearRange =
    vehicle.yearFrom && vehicle.yearTo
      ? `${vehicle.yearFrom} - ${vehicle.yearTo}`
      : vehicle.yearFrom
        ? `Depuis ${vehicle.yearFrom}`
        : "";

  return (
    <div
      className={cn(
        "p-4 rounded-xl border-2",
        "transition-all duration-300",
        "animate-[stat-reveal_300ms_ease-out_forwards]",
        isCurrent
          ? "border-[#0F766E] bg-[#F0FDFA] shadow-md"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm",
        onSelect && "cursor-pointer hover:-translate-y-0.5",
      )}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex items-center justify-center",
              "w-10 h-10 rounded-lg",
              isCurrent ? "bg-[#0F766E]/10" : "bg-slate-100",
            )}
          >
            <Car
              className={cn(
                "h-5 w-5",
                isCurrent ? "text-[#0F766E]" : "text-slate-500",
              )}
            />
          </div>
          <div>
            <h4
              className="font-bold text-slate-900"
              style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
            >
              {vehicle.brand} {vehicle.model}
            </h4>
            {vehicle.generation && (
              <span className="text-sm text-slate-500">
                {vehicle.generation}
              </span>
            )}
          </div>
        </div>

        {isCurrent && (
          <div
            className={cn(
              "flex items-center gap-1.5",
              "px-2.5 py-1 rounded-full",
              "bg-[#0F766E] text-white",
              "text-xs font-semibold",
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Votre véhicule</span>
          </div>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {yearRange && (
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>{yearRange}</span>
          </div>
        )}
        {vehicle.fuelType && (
          <div className="flex items-center gap-2 text-slate-600">
            <Fuel className="h-4 w-4 text-slate-400" />
            <span>{fuelLabels[vehicle.fuelType] || vehicle.fuelType}</span>
          </div>
        )}
        {vehicle.powerHp && (
          <div className="flex items-center gap-2 text-slate-600">
            <Sparkles className="h-4 w-4 text-slate-400" />
            <span>{vehicle.powerHp} ch</span>
          </div>
        )}
        {vehicle.engineCode && (
          <div className="flex items-center gap-2 text-slate-600">
            <Hash className="h-4 w-4 text-slate-400" />
            <code
              className="text-sm text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {vehicle.engineCode}
            </code>
          </div>
        )}
      </div>

      {/* Technical codes */}
      {(vehicle.cnit || vehicle.typeMine) && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
          {vehicle.cnit && (
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-slate-400 flex-shrink-0">CNIT</span>
              <code
                className="text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded break-all text-right"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {vehicle.cnit}
              </code>
            </div>
          )}
          {vehicle.typeMine && (
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-slate-400 flex-shrink-0">Type Mine</span>
              <code
                className="text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded break-all text-right"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {vehicle.typeMine}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompatibilityStatusV2({
  isCompatible,
}: {
  isCompatible: boolean | null | undefined;
}) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isCompatible === true) {
      const timer = setTimeout(() => setShowAnimation(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isCompatible]);

  if (isCompatible === null || isCompatible === undefined) {
    return (
      <div
        className={cn(
          "flex items-center gap-4",
          "p-4 rounded-xl",
          "bg-slate-50 border-2 border-dashed border-slate-200",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center",
            "w-12 h-12 rounded-full",
            "bg-slate-200",
          )}
        >
          <AlertTriangle className="h-6 w-6 text-slate-500" />
        </div>
        <div>
          <h4
            className="font-bold text-slate-800"
            style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
          >
            Compatibilité à vérifier
          </h4>
          <p className="text-sm text-slate-500">
            Sélectionnez votre véhicule pour vérifier
          </p>
        </div>
      </div>
    );
  }

  if (isCompatible === false) {
    return (
      <div
        className={cn(
          "flex items-center gap-4",
          "p-4 rounded-xl",
          "bg-[#FEF2F2] border-2 border-[#FECACA]",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center",
            "w-12 h-12 rounded-full",
            "bg-[#FEE2E2]",
          )}
        >
          <X className="h-6 w-6 text-[#DC2626]" />
        </div>
        <div>
          <h4
            className="font-bold text-[#991B1B]"
            style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
          >
            Non compatible
          </h4>
          <p className="text-sm text-[#B91C1C]">
            Cette pièce n&apos;est pas compatible avec votre véhicule
          </p>
        </div>
      </div>
    );
  }

  // Compatible - with celebration effect
  return (
    <div
      className={cn(
        "relative flex items-center gap-4",
        "p-4 rounded-xl",
        "bg-gradient-to-r from-[#ECFDF5] to-[#D1FAE5]",
        "border-2 border-[#A7F3D0]",
        "overflow-hidden",
      )}
    >
      {/* Animated background shimmer */}
      <div
        className={cn(
          "absolute inset-0 -translate-x-full transition-transform duration-1000",
          showAnimation && "translate-x-full",
        )}
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
        }}
      />

      <div
        className={cn(
          "relative flex items-center justify-center",
          "w-12 h-12 rounded-full",
          "bg-[#059669]",
          "transition-all duration-500",
          showAnimation ? "scale-100" : "scale-0",
        )}
      >
        <ShieldCheck className="h-6 w-6 text-white" />
      </div>
      <div className="relative">
        <h4
          className="font-bold text-[#065F46]"
          style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
        >
          Compatible ✓
        </h4>
        <p className="text-sm text-[#047857]">
          Cette pièce est compatible avec votre véhicule
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const CompatibilitySheetV2 = forwardRef<
  HTMLDivElement,
  CompatibilitySheetV2Props
>(
  (
    {
      open,
      onOpenChange,
      isCompatible,
      currentVehicle,
      compatibleVehicles = [],
      oemReferences = [],
      productName,
      trigger,
      onConfirmCompatibility,
      onChangeVehicle,
      className,
    },
    ref,
  ) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}

        <SheetContent
          ref={ref}
          side="bottom"
          className={cn(
            "max-h-[90vh]",
            "rounded-t-2xl",
            "px-5 py-6 sm:px-6",
            "pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
            className,
          )}
        >
          {/* Header with gradient border */}
          <SheetHeader className="text-left mb-6 relative">
            <div
              className="absolute -top-6 left-0 right-0 h-1 rounded-full"
              style={{
                background: "linear-gradient(90deg, #0F766E, #14B8A6, #0369A1)",
              }}
            />
            <SheetTitle
              className="text-xl"
              style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
            >
              Compatibilité véhicule
            </SheetTitle>
            {productName && (
              <SheetDescription className="text-slate-500">
                Vérifiez pour{" "}
                <span className="font-medium text-slate-700">
                  {productName}
                </span>
              </SheetDescription>
            )}
          </SheetHeader>

          {/* Compatibility status banner */}
          <CompatibilityStatusV2 isCompatible={isCompatible} />

          {/* Current vehicle section */}
          {currentVehicle && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3
                  className="font-bold text-slate-800"
                  style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
                >
                  Votre véhicule
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onChangeVehicle}
                  className="text-[#0369A1] hover:text-[#075985] hover:bg-[#E0F2FE] cursor-pointer"
                >
                  Modifier
                </Button>
              </div>
              <VehicleCardV2 vehicle={currentVehicle} isCurrent />
            </div>
          )}

          {/* OEM References */}
          {oemReferences.length > 0 && (
            <div className="mt-6">
              <h3
                className="font-bold text-slate-800 mb-3"
                style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
              >
                Références OEM
              </h3>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                {oemReferences.map((ref, index) => (
                  <CopyableCodeV2
                    key={index}
                    label={`Référence ${index + 1}`}
                    value={ref}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Ces références permettent de vérifier la compatibilité exacte
              </p>
            </div>
          )}

          {/* Technical codes */}
          {currentVehicle &&
            (currentVehicle.cnit || currentVehicle.typeMine) && (
              <div className="mt-6">
                <h3
                  className="font-bold text-slate-800 mb-3"
                  style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
                >
                  Codes techniques
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  {currentVehicle.cnit && (
                    <CopyableCodeV2
                      label="Code CNIT"
                      value={currentVehicle.cnit}
                    />
                  )}
                  {currentVehicle.typeMine && (
                    <CopyableCodeV2
                      label="Type Mine"
                      value={currentVehicle.typeMine}
                    />
                  )}
                </div>
              </div>
            )}

          {/* Compatible vehicles (expandable) */}
          {compatibleVehicles.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setExpanded(!expanded)}
                className={cn(
                  "flex items-center justify-between w-full",
                  "py-2 px-0",
                  "cursor-pointer",
                  "focus:outline-none",
                )}
              >
                <h3
                  className="font-bold text-slate-800"
                  style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
                >
                  Véhicules compatibles
                </h3>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-semibold",
                      "bg-[#0F766E]/10 text-[#0F766E]",
                    )}
                  >
                    {compatibleVehicles.length}
                  </span>
                  {expanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </button>

              {expanded && (
                <div className="mt-3 space-y-2 max-h-[calc(100vh-400px)] sm:max-h-64 overflow-y-auto pr-2">
                  {compatibleVehicles.slice(0, 10).map((vehicle, index) => (
                    <VehicleCardV2
                      key={index}
                      vehicle={vehicle}
                      index={index}
                      onSelect={
                        onConfirmCompatibility
                          ? () => onConfirmCompatibility(vehicle)
                          : undefined
                      }
                    />
                  ))}
                  {compatibleVehicles.length > 10 && (
                    <p className="text-sm text-slate-400 text-center py-2">
                      Et {compatibleVehicles.length - 10} autres véhicules...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <Separator className="my-6" />

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {!currentVehicle && (
              <Button
                onClick={onChangeVehicle}
                className={cn(
                  "w-full h-12",
                  "bg-[#0369A1] hover:bg-[#075985]",
                  "text-white font-semibold",
                  "shadow-md hover:shadow-lg",
                  "transition-all duration-200",
                  "cursor-pointer",
                )}
                style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
              >
                <Car className="h-5 w-5 mr-2" />
                Sélectionner mon véhicule
              </Button>
            )}

            {currentVehicle && isCompatible && onConfirmCompatibility && (
              <Button
                onClick={() => onConfirmCompatibility(currentVehicle)}
                className={cn(
                  "w-full h-12",
                  "bg-[#059669] hover:bg-[#047857]",
                  "text-white font-semibold",
                  "shadow-md hover:shadow-lg",
                  "transition-all duration-200",
                  "cursor-pointer",
                )}
                style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
              >
                <ShieldCheck className="h-5 w-5 mr-2" />
                Confirmer la compatibilité
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              className="w-full cursor-pointer"
            >
              Fermer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  },
);

CompatibilitySheetV2.displayName = "CompatibilitySheetV2";

export { CompatibilitySheetV2 };
