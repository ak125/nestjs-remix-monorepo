import { Car, ChevronRight } from "lucide-react";

export function MV5Plaque({
  vehicle,
  onClick,
}: {
  vehicle: string | null;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="mv5-plaque"
      onClick={onClick}
      aria-label={
        vehicle
          ? `Mon véhicule sélectionné : ${vehicle}. Modifier le véhicule.`
          : "Sélectionner mon véhicule"
      }
    >
      <Car size={28} strokeWidth={2} aria-hidden="true" />
      <span className="mv5-plaque-body">
        <span className="mv5-plaque-label">Mon véhicule</span>
        <span className="mv5-plaque-value">{vehicle ?? "Sélectionner"}</span>
      </span>
      <ChevronRight size={20} aria-hidden="true" />
    </button>
  );
}
