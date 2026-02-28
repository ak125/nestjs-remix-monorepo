/**
 * CompatibilityConfirmationBlock
 * Bloc de réassurance R1 : confirme la compatibilité véhicule avant catalogue.
 *
 * 3 états :
 * - Vert  : véhicule sélectionné ET trouvé dans les motorisations
 * - Ambre : véhicule sélectionné MAIS absent des motorisations
 * - Bleu  : aucun véhicule sélectionné (CTA sélection)
 */

import { Car, CheckCircle2, ShieldCheck, ShieldQuestion } from "lucide-react";
import { memo, useCallback, useMemo, useState, lazy, Suspense } from "react";
import { Button } from "~/components/ui/button";
import { type GammePageMotorisationItem } from "~/types/gamme-page-contract.types";
import { type VehicleCookie, formatVehicleName } from "~/utils/vehicle-cookie";

// Lazy import du modal — chargé uniquement au clic
const LazyResolverModal = lazy(() =>
  import("~/components/expert/CompatibilityResolverModal").then((m) => ({
    default: m.CompatibilityResolverModal,
  })),
);

// ── Matching logic ──

function checkVehicleMatch(
  vehicle: VehicleCookie,
  items: GammePageMotorisationItem[],
): { matched: boolean; item: GammePageMotorisationItem | null } {
  const norm = (s: string) => s.toLowerCase().trim();
  const vMarque = norm(vehicle.marque_name);
  const vType = norm(vehicle.type_name);

  const found = items.find((item) => {
    const iMarque = norm(item.marque_name);
    const iType = norm(item.type_name);
    return (
      iMarque === vMarque &&
      (iType === vType || iType.includes(vType) || vType.includes(iType))
    );
  });

  return { matched: !!found, item: found || null };
}

// ── Props ──

interface CompatibilityConfirmationBlockProps {
  selectedVehicle: VehicleCookie | null;
  motorisationItems: GammePageMotorisationItem[];
  gammeName: string;
  periodeRange?: string;
  gammeId?: number;
}

// ── Component ──

export const CompatibilityConfirmationBlock = memo(
  function CompatibilityConfirmationBlock({
    selectedVehicle,
    motorisationItems,
    gammeName,
    periodeRange,
    gammeId,
  }: CompatibilityConfirmationBlockProps) {
    const [resolverOpen, setResolverOpen] = useState(false);

    const result = useMemo(() => {
      if (!selectedVehicle) return null;
      return checkVehicleMatch(selectedVehicle, motorisationItems);
    }, [selectedVehicle, motorisationItems]);

    const handleScrollToSelector = useCallback(() => {
      document.getElementById("vehicle-selector")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, []);

    // ── État 3 : Aucun véhicule ──
    if (!selectedVehicle) {
      return (
        <div className="flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <Car className="mt-0.5 h-6 w-6 flex-shrink-0 text-blue-600" />
          <div className="flex-1">
            <p className="font-semibold text-blue-900">
              Sélectionnez votre véhicule pour vérifier la compatibilité
            </p>
            <p className="mt-1 text-sm text-blue-700">
              Notre sélecteur filtre par marque, modèle et motorisation pour ne
              vous montrer que les {gammeName} compatibles.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={handleScrollToSelector}
            >
              Sélectionner mon véhicule
            </Button>
          </div>
        </div>
      );
    }

    const vehicleName = formatVehicleName(selectedVehicle);

    // ── État 1 : Compatible (vert) ──
    if (result?.matched) {
      const proofs = [
        `Filtrage par motorisation : ${result.item?.type_name || selectedVehicle.type_name}${result.item?.puissance ? ` (${result.item.puissance})` : ""}`,
        periodeRange ? `Période couverte : ${periodeRange}` : null,
        "Vérification VIN / CNIT possible pour confirmation définitive",
      ].filter(Boolean) as string[];

      return (
        <div className="flex items-start gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <ShieldCheck className="mt-0.5 h-6 w-6 flex-shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-900">
              Compatibilité garantie pour votre {vehicleName}
            </p>
            <ul className="mt-2 space-y-1.5">
              {proofs.map((proof) => (
                <li
                  key={proof}
                  className="flex items-start gap-2 text-sm text-emerald-800"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                  <span>{proof}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
              onClick={() => setResolverOpen(true)}
            >
              Vérifier avec ma carte grise
            </Button>
            <Suspense fallback={null}>
              {resolverOpen && (
                <LazyResolverModal
                  open={resolverOpen}
                  onOpenChange={setResolverOpen}
                  productId={gammeId || 0}
                  productName={gammeName}
                />
              )}
            </Suspense>
          </div>
        </div>
      );
    }

    // ── État 2 : Non confirmé (ambre) ──
    return (
      <div className="flex items-start gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <ShieldQuestion className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="font-semibold text-amber-900">
            Votre {vehicleName} n&apos;apparaît pas dans les motorisations
            listées
          </p>
          <p className="mt-1 text-sm text-amber-700">
            Cela peut signifier que cette gamme n&apos;est pas compatible ou que
            d&apos;autres références existent. Vérifiez avec votre carte grise
            pour une réponse définitive.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => setResolverOpen(true)}
            >
              Vérifier avec ma carte grise
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-600 hover:bg-amber-100"
              onClick={handleScrollToSelector}
            >
              Changer de véhicule
            </Button>
          </div>
          <Suspense fallback={null}>
            {resolverOpen && (
              <LazyResolverModal
                open={resolverOpen}
                onOpenChange={setResolverOpen}
                productId={gammeId || 0}
                productName={gammeName}
              />
            )}
          </Suspense>
        </div>
      </div>
    );
  },
);
