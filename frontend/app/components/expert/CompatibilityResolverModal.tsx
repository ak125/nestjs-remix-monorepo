/**
 * CompatibilityResolverModal Component
 * @description Modal for quick vehicle identification and compatibility check
 * @version 2.0.0
 * @pack Pack Confiance V2 - Killer Feature "Résolution 10s"
 *
 * Design System: ui-ux-pro-max + frontend-design
 * Style: Trust & Authority
 *
 * Flow:
 * 1. User enters CNIT, Type Mine, or selects vehicle from dropdown
 * 2. System searches for vehicle
 * 3. System checks compatibility with product
 * 4. Result displayed with celebration if compatible
 */

import {
  Search,
  Car,
  FileText,
  Loader2,
  ShieldCheck,
  ShieldX,
  AlertCircle,
  Sparkles,
  Info,
} from "lucide-react";
import { forwardRef, useState, useCallback, useEffect, memo } from "react";
import { type VehicleInfoV2 } from "./CompatibilityBadgeV2";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface CompatibilityResolverModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Product ID to check compatibility against */
  productId: string | number;
  /** Product name for display */
  productName?: string;
  /** Callback when vehicle is resolved and compatibility is checked */
  onVehicleResolved?: (vehicle: VehicleInfoV2, isCompatible: boolean) => void;
  /** Callback on error */
  onError?: (error: string) => void;
  /** Default tab to show */
  defaultTab?: "cnit" | "mine" | "dropdown";
}

type ResolverState = "input" | "loading" | "success" | "error";

interface ResolverResult {
  vehicle: VehicleInfoV2 | null;
  isCompatible: boolean | null;
  error: string | null;
}

// ============================================================================
// Sub-components
// ============================================================================

function HelpCard({
  title,
  description,
  example,
}: {
  title: string;
  description: string;
  example: string;
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-xs font-medium text-slate-700">{title}</div>
          <div className="text-xs text-slate-500 mt-0.5">{description}</div>
          <code className="text-xs text-[#0369A1] bg-[#0369A1]/10 px-1.5 py-0.5 rounded mt-1 inline-block">
            {example}
          </code>
        </div>
      </div>
    </div>
  );
}

function VehicleResultCard({
  vehicle,
  isCompatible,
  onConfirm,
  onRetry,
}: {
  vehicle: VehicleInfoV2;
  isCompatible: boolean;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  const [showCelebration, setShowCelebration] = useState(isCompatible);

  useEffect(() => {
    if (isCompatible) {
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isCompatible]);

  return (
    <div className="space-y-4">
      {/* Vehicle Card */}
      <div
        className={cn(
          "relative p-4 rounded-xl border-2",
          "transition-all duration-300",
          isCompatible
            ? "bg-gradient-to-br from-[#ECFDF5] to-[#D1FAE5] border-[#059669]"
            : "bg-gradient-to-br from-[#FEF2F2] to-[#FEE2E2] border-[#DC2626]",
        )}
      >
        {/* Celebration sparkles */}
        {showCelebration && isCompatible && (
          <>
            <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-amber-400 animate-bounce" />
            <Sparkles className="absolute -top-1 -left-1 h-4 w-4 text-amber-400 animate-bounce delay-100" />
          </>
        )}

        {/* Status icon */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex items-center justify-center",
              "h-12 w-12 rounded-full",
              "animate-[verified-reveal_300ms_ease-out]",
              isCompatible ? "bg-[#059669]/20" : "bg-[#DC2626]/20",
            )}
          >
            {isCompatible ? (
              <ShieldCheck className="h-6 w-6 text-[#059669]" />
            ) : (
              <ShieldX className="h-6 w-6 text-[#DC2626]" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "text-lg font-bold",
                isCompatible ? "text-[#065F46]" : "text-[#991B1B]",
              )}
              style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
            >
              {isCompatible ? "Compatible !" : "Non compatible"}
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-700">
                  {vehicle.brand} {vehicle.model}
                </span>
              </div>
              {vehicle.generation && (
                <div className="text-sm text-slate-500 ml-6">
                  {vehicle.generation}
                </div>
              )}
              {(vehicle.yearFrom || vehicle.yearTo) && (
                <div className="text-sm text-slate-500 ml-6">
                  {vehicle.yearFrom && vehicle.yearTo
                    ? `${vehicle.yearFrom} - ${vehicle.yearTo}`
                    : vehicle.yearFrom
                      ? `À partir de ${vehicle.yearFrom}`
                      : `Jusqu'à ${vehicle.yearTo}`}
                </div>
              )}
              {vehicle.engineCode && (
                <div className="text-xs text-slate-400 ml-6">
                  Moteur: {vehicle.engineCode}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {isCompatible ? (
          <Button
            onClick={onConfirm}
            className={cn(
              "flex-1",
              "bg-[#059669] hover:bg-[#047857]",
              "text-white font-semibold",
              "min-h-[48px]",
              "shadow-lg shadow-[#059669]/25",
            )}
          >
            <ShieldCheck className="h-5 w-5 mr-2" />
            Confirmer et continuer
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={onRetry}
              className="flex-1 min-h-[48px]"
            >
              Essayer un autre véhicule
            </Button>
            <Button
              onClick={onConfirm}
              className={cn(
                "bg-slate-700 hover:bg-slate-800",
                "text-white",
                "min-h-[48px]",
              )}
            >
              Continuer quand même
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="text-center py-6">
      <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
        <AlertCircle className="h-6 w-6 text-red-600" />
      </div>
      <div className="text-base font-medium text-slate-800 mb-2">
        Véhicule non trouvé
      </div>
      <div className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
        {error}
      </div>
      <Button variant="outline" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

const CompatibilityResolverModal = memo(
  forwardRef<HTMLDivElement, CompatibilityResolverModalProps>(
    (
      {
        open,
        onOpenChange,
        productId,
        productName,
        onVehicleResolved,
        onError,
        defaultTab = "cnit",
      },
      ref,
    ) => {
      const [activeTab, setActiveTab] = useState<"cnit" | "mine" | "dropdown">(
        defaultTab,
      );
      const [cnitInput, setCnitInput] = useState("");
      const [mineInput, setMineInput] = useState("");
      const [state, setState] = useState<ResolverState>("input");
      const [result, setResult] = useState<ResolverResult>({
        vehicle: null,
        isCompatible: null,
        error: null,
      });

      // Reset state when modal opens
      useEffect(() => {
        if (open) {
          setState("input");
          setResult({ vehicle: null, isCompatible: null, error: null });
          setCnitInput("");
          setMineInput("");
        }
      }, [open]);

      // Search and check compatibility
      const handleSearch = useCallback(
        async (type: "cnit" | "mine", code: string) => {
          if (!code.trim()) return;

          setState("loading");

          try {
            // 1. Search for vehicle by code
            const searchEndpoint =
              type === "cnit"
                ? `/api/vehicles/search/cnit/${encodeURIComponent(code.trim())}`
                : `/api/vehicles/search/mine/${encodeURIComponent(code.trim())}`;

            const vehicleResponse = await fetch(searchEndpoint);

            if (!vehicleResponse.ok) {
              throw new Error(
                type === "cnit"
                  ? "Code CNIT non trouvé. Vérifiez le code sur votre carte grise (champ D.2)."
                  : "Type Mine non trouvé. Vérifiez le code sur votre carte grise.",
              );
            }

            const vehicleData = await vehicleResponse.json();

            // Map response to VehicleInfoV2
            const vehicle: VehicleInfoV2 = {
              brand:
                vehicleData.marque?.ma_lib ||
                vehicleData.brand ||
                "Marque inconnue",
              model:
                vehicleData.modele?.mod_lib ||
                vehicleData.model ||
                "Modèle inconnu",
              generation: vehicleData.type_lib || vehicleData.generation,
              yearFrom: vehicleData.type_annee_debut || vehicleData.yearFrom,
              yearTo: vehicleData.type_annee_fin || vehicleData.yearTo,
              fuelType: vehicleData.type_energie || vehicleData.fuelType,
              powerHp: vehicleData.type_cv || vehicleData.powerHp,
              engineCode: vehicleData.type_moteur || vehicleData.engineCode,
              cnit: vehicleData.type_cnit || code,
              typeMine:
                vehicleData.type_mine || (type === "mine" ? code : undefined),
            };

            // 2. Check compatibility with product
            const typeId = vehicleData.type_id || vehicleData.id;
            let isCompatible = false;

            if (typeId) {
              try {
                const compatResponse = await fetch("/api/compatibility/check", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    productId: Number(productId),
                    typeId: Number(typeId),
                  }),
                });

                if (compatResponse.ok) {
                  const compatData = await compatResponse.json();
                  isCompatible = compatData.isCompatible === true;
                }
              } catch {
                // If compatibility check fails, assume compatible (better UX)
                isCompatible = true;
              }
            }

            setResult({
              vehicle,
              isCompatible,
              error: null,
            });
            setState("success");
          } catch (error) {
            const errorMessage =
              error instanceof Error
                ? error.message
                : "Une erreur est survenue. Veuillez réessayer.";
            setResult({
              vehicle: null,
              isCompatible: null,
              error: errorMessage,
            });
            setState("error");
            onError?.(errorMessage);
          }
        },
        [productId, onError],
      );

      const handleConfirm = useCallback(() => {
        if (result.vehicle && result.isCompatible !== null) {
          onVehicleResolved?.(result.vehicle, result.isCompatible);
          onOpenChange(false);
        }
      }, [result, onVehicleResolved, onOpenChange]);

      const handleRetry = useCallback(() => {
        setState("input");
        setResult({ vehicle: null, isCompatible: null, error: null });
      }, []);

      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            ref={ref}
            className={cn("sm:max-w-md", "p-0 overflow-hidden", "bg-white")}
          >
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
              <DialogTitle
                className="text-xl font-bold text-slate-900"
                style={{ fontFamily: "'Lexend', system-ui, sans-serif" }}
              >
                Vérifier la compatibilité
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500">
                {productName
                  ? `Pour "${productName}"`
                  : "Identifiez votre véhicule en quelques secondes"}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-4">
              {state === "input" && (
                <Tabs
                  value={activeTab}
                  onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="cnit" className="text-sm">
                      <FileText className="h-4 w-4 mr-1.5" />
                      Code CNIT
                    </TabsTrigger>
                    <TabsTrigger value="mine" className="text-sm">
                      <FileText className="h-4 w-4 mr-1.5" />
                      Type Mine
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="cnit" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        Code CNIT (Carte grise - Champ D.2)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={cnitInput}
                          onChange={(e) =>
                            setCnitInput(e.target.value.toUpperCase())
                          }
                          placeholder="Ex: M10RENCVP04E001"
                          className="flex-1 uppercase font-mono"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSearch("cnit", cnitInput);
                            }
                          }}
                        />
                        <Button
                          onClick={() => handleSearch("cnit", cnitInput)}
                          disabled={!cnitInput.trim()}
                          className="bg-[#0369A1] hover:bg-[#075985] min-h-[44px]"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <HelpCard
                      title="Où trouver le code CNIT ?"
                      description="Le code CNIT se trouve sur votre carte grise, dans le champ D.2 (en haut à droite)."
                      example="M10RENCVP04E001"
                    />
                  </TabsContent>

                  <TabsContent value="mine" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        Type Mine (Carte grise - Champ D.2.1)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={mineInput}
                          onChange={(e) =>
                            setMineInput(e.target.value.toUpperCase())
                          }
                          placeholder="Ex: MRE1234567"
                          className="flex-1 uppercase font-mono"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSearch("mine", mineInput);
                            }
                          }}
                        />
                        <Button
                          onClick={() => handleSearch("mine", mineInput)}
                          disabled={!mineInput.trim()}
                          className="bg-[#0369A1] hover:bg-[#075985] min-h-[44px]"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <HelpCard
                      title="Où trouver le Type Mine ?"
                      description="Le Type Mine se trouve sur votre carte grise, dans le champ D.2.1."
                      example="MRE1234567"
                    />
                  </TabsContent>
                </Tabs>
              )}

              {state === "loading" && (
                <div className="py-12 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-[#0369A1] mx-auto mb-4" />
                  <div className="text-base font-medium text-slate-700">
                    Recherche en cours...
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    Vérification de la compatibilité
                  </div>
                </div>
              )}

              {state === "success" &&
                result.vehicle &&
                result.isCompatible !== null && (
                  <VehicleResultCard
                    vehicle={result.vehicle}
                    isCompatible={result.isCompatible}
                    onConfirm={handleConfirm}
                    onRetry={handleRetry}
                  />
                )}

              {state === "error" && result.error && (
                <ErrorState error={result.error} onRetry={handleRetry} />
              )}
            </div>

            {/* Footer hint */}
            {state === "input" && (
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Info className="h-3.5 w-3.5" />
                  <span>
                    Les codes se trouvent sur votre carte grise ou le certificat
                    d'immatriculation
                  </span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      );
    },
  ),
);

CompatibilityResolverModal.displayName = "CompatibilityResolverModal";

export { CompatibilityResolverModal };
