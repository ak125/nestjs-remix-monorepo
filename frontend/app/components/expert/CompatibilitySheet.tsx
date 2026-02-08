/**
 * CompatibilitySheet Component
 * @description Sheet/drawer with detailed vehicle compatibility information
 * @version 1.0.0
 * @pack Pack Confiance - Trust-First + Compatibility
 *
 * Features:
 * - Mobile-first sheet design
 * - Vehicle details display
 * - OEM / CNIT / Type Mine codes
 * - Compatibility verification CTA
 * - Distinctive design (anti-AI-slop)
 */

import {
  Check,
  X,
  AlertTriangle,
  Car,
  Hash,
  Calendar,
  Fuel,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { forwardRef, useState, memo } from "react";
import { Badge } from "~/components/ui/badge";
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
// Types
// ============================================================================

export interface VehicleInfo {
  /** Brand name */
  brand?: string;
  /** Model name */
  model?: string;
  /** Generation/Type (e.g., "Phase 2") */
  generation?: string;
  /** Year range */
  yearFrom?: number;
  yearTo?: number;
  /** Engine type */
  engineType?: string;
  /** Engine code (e.g., "K9K") */
  engineCode?: string;
  /** Fuel type */
  fuelType?: "diesel" | "essence" | "hybride" | "electrique" | "gpl";
  /** Power in HP */
  powerHp?: number;
  /** CNIT code (French) */
  cnit?: string;
  /** Type Mine code (French) */
  typeMine?: string;
}

export interface CompatibilitySheetProps {
  /** Whether the sheet is open (controlled) */
  open?: boolean;
  /** Open state change handler */
  onOpenChange?: (open: boolean) => void;
  /** Compatibility status */
  isCompatible?: boolean | null;
  /** Current vehicle context */
  currentVehicle?: VehicleInfo;
  /** Compatible vehicles list */
  compatibleVehicles?: VehicleInfo[];
  /** OEM references */
  oemReferences?: string[];
  /** Product name */
  productName?: string;
  /** Trigger element (if not controlled) */
  trigger?: React.ReactNode;
  /** Confirm compatibility handler */
  onConfirmCompatibility?: (vehicle: VehicleInfo) => void;
  /** Change vehicle handler */
  onChangeVehicle?: () => void;
  /** Additional className */
  className?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

function CopyableCode({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <button
        onClick={handleCopy}
        className={cn(
          "flex items-center gap-2 px-2 py-1 rounded",
          "bg-gray-100 hover:bg-gray-200",
          "transition-colors duration-200",
          "group",
        )}
      >
        <code className="text-sm font-mono text-gray-800">{value}</code>
        {copied ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
        )}
      </button>
    </div>
  );
}

function VehicleCard({
  vehicle,
  isCurrent = false,
  onSelect,
}: {
  vehicle: VehicleInfo;
  isCurrent?: boolean;
  onSelect?: () => void;
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
        "p-4 rounded-lg border",
        "transition-all duration-200",
        isCurrent
          ? "border-green-300 bg-green-50"
          : "border-gray-200 bg-white hover:border-gray-300",
        onSelect && "cursor-pointer",
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Car className="h-5 w-5 text-gray-400" />
          <div>
            <h4 className="font-semibold text-gray-900">
              {vehicle.brand} {vehicle.model}
            </h4>
            {vehicle.generation && (
              <span className="text-sm text-gray-500">
                {vehicle.generation}
              </span>
            )}
          </div>
        </div>
        {isCurrent && (
          <Badge variant="success" size="sm">
            Votre véhicule
          </Badge>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {yearRange && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span>{yearRange}</span>
          </div>
        )}
        {vehicle.fuelType && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Fuel className="h-4 w-4 text-gray-400" />
            <span>{fuelLabels[vehicle.fuelType] || vehicle.fuelType}</span>
          </div>
        )}
        {vehicle.powerHp && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <span className="text-gray-400">⚡</span>
            <span>{vehicle.powerHp} ch</span>
          </div>
        )}
        {vehicle.engineCode && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Hash className="h-4 w-4 text-gray-400" />
            <span className="font-mono">{vehicle.engineCode}</span>
          </div>
        )}
      </div>

      {/* Technical codes */}
      {(vehicle.cnit || vehicle.typeMine) && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {vehicle.cnit && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">CNIT</span>
              <code className="font-mono text-gray-600">{vehicle.cnit}</code>
            </div>
          )}
          {vehicle.typeMine && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Type Mine</span>
              <code className="font-mono text-gray-600">
                {vehicle.typeMine}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CompatibilityStatus({
  isCompatible,
}: {
  isCompatible: boolean | null | undefined;
}) {
  if (isCompatible === null || isCompatible === undefined) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200">
          <AlertTriangle className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">
            Compatibilité à vérifier
          </h4>
          <p className="text-sm text-gray-500">
            Sélectionnez votre véhicule pour vérifier la compatibilité
          </p>
        </div>
      </div>
    );
  }

  if (isCompatible === false) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100">
          <X className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h4 className="font-semibold text-red-900">Non compatible</h4>
          <p className="text-sm text-red-600">
            Cette pièce n&apos;est pas compatible avec votre véhicule
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full bg-green-100",
          // Verified animation as per Pack Confiance
          "animate-scale-in",
        )}
      >
        <Check className="h-5 w-5 text-green-600" />
      </div>
      <div>
        <h4 className="font-semibold text-green-900">Compatible</h4>
        <p className="text-sm text-green-600">
          Cette pièce est compatible avec votre véhicule
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const CompatibilitySheet = memo(
  forwardRef<HTMLDivElement, CompatibilitySheetProps>(
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
      return (
        <Sheet open={open} onOpenChange={onOpenChange}>
          {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}

          <SheetContent
            ref={ref}
            side="bottom"
            className={cn(
              // Height - max 90vh on mobile
              "max-h-[90vh]",
              // Rounded top corners
              "rounded-t-2xl",
              // Padding
              "px-4 py-6 sm:px-6",
              // Safe area
              "pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
              className,
            )}
          >
            <SheetHeader className="text-left mb-6">
              <SheetTitle className="text-xl font-heading">
                Compatibilité véhicule
              </SheetTitle>
              {productName && (
                <SheetDescription className="text-gray-500">
                  Vérifiez la compatibilité pour {productName}
                </SheetDescription>
              )}
            </SheetHeader>

            {/* Compatibility status banner */}
            <CompatibilityStatus isCompatible={isCompatible} />

            {/* Current vehicle section */}
            {currentVehicle && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    Votre véhicule
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onChangeVehicle}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    Modifier
                  </Button>
                </div>
                <VehicleCard vehicle={currentVehicle} isCurrent />
              </div>
            )}

            {/* OEM References */}
            {oemReferences.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Références OEM
                </h3>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  {oemReferences.map((ref, index) => (
                    <CopyableCode
                      key={index}
                      label={`Réf. ${index + 1}`}
                      value={ref}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Ces références permettent de vérifier la compatibilité exacte
                </p>
              </div>
            )}

            {/* Technical codes (if current vehicle has them) */}
            {currentVehicle &&
              (currentVehicle.cnit || currentVehicle.typeMine) && (
                <div className="mt-6">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Codes techniques
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-3">
                    {currentVehicle.cnit && (
                      <CopyableCode
                        label="Code CNIT"
                        value={currentVehicle.cnit}
                      />
                    )}
                    {currentVehicle.typeMine && (
                      <CopyableCode
                        label="Type Mine"
                        value={currentVehicle.typeMine}
                      />
                    )}
                  </div>
                </div>
              )}

            {/* Compatible vehicles (collapsed, expandable) */}
            {compatibleVehicles.length > 0 && (
              <div className="mt-6">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer">
                    <h3 className="font-semibold text-gray-900">
                      Véhicules compatibles
                    </h3>
                    <Badge variant="outline" size="sm">
                      {compatibleVehicles.length} véhicules
                    </Badge>
                  </summary>
                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                    {compatibleVehicles.slice(0, 10).map((vehicle, index) => (
                      <VehicleCard
                        key={index}
                        vehicle={vehicle}
                        onSelect={
                          onConfirmCompatibility
                            ? () => onConfirmCompatibility(vehicle)
                            : undefined
                        }
                      />
                    ))}
                    {compatibleVehicles.length > 10 && (
                      <p className="text-sm text-gray-400 text-center py-2">
                        Et {compatibleVehicles.length - 10} autres véhicules...
                      </p>
                    )}
                  </div>
                </details>
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
                    // Pack Confiance CTA color
                    "bg-[#34C759] hover:bg-[#2DB84E]",
                    "text-white font-semibold font-heading",
                  )}
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
                    "bg-[#34C759] hover:bg-[#2DB84E]",
                    "text-white font-semibold font-heading",
                  )}
                >
                  <Check className="h-5 w-5 mr-2" />
                  Confirmer la compatibilité
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => onOpenChange?.(false)}
                className="w-full"
              >
                Fermer
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      );
    },
  ),
);

CompatibilitySheet.displayName = "CompatibilitySheet";

export { CompatibilitySheet };
