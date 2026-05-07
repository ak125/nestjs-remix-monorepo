import { Car, ChevronRight } from "lucide-react";

type PlaqueProps = {
  vehicle: string | null;
  onClick?: () => void;
};

export function V5Plaque({ vehicle, onClick }: PlaqueProps) {
  return (
    <button
      type="button"
      className="v5-plaque"
      onClick={onClick}
      aria-label={
        vehicle
          ? `Mon véhicule sélectionné : ${vehicle}. Modifier le véhicule.`
          : "Sélectionner mon véhicule"
      }
    >
      <Car size={28} strokeWidth={2} aria-hidden="true" />
      <span className="v5-plaque-body">
        <span className="v5-plaque-label">Mon véhicule</span>
        <span className="v5-plaque-value">{vehicle ?? "Sélectionner"}</span>
      </span>
      <ChevronRight size={20} aria-hidden="true" />
    </button>
  );
}
