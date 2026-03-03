/**
 * R1 KPI Coverage — section data-driven séparée du TrustStrip.
 * Affiche uniquement les KPIs viables (garde-fous stricts).
 * Retourne null si aucun KPI ne passe les seuils.
 */
import { Car, Calendar, Factory, Tag } from "lucide-react";
import { memo } from "react";

interface R1KpiCoverageProps {
  proofData?: {
    motorisationsCount: number;
    modelsCount: number;
    topMarques: string[];
    periodeRange: string;
    topEquipementiers: string[];
  };
}

interface KpiItem {
  icon: React.ReactNode;
  value: string;
  label: string;
}

export const R1KpiCoverage = memo(function R1KpiCoverage({
  proofData,
}: R1KpiCoverageProps) {
  if (!proofData) return null;

  const items: KpiItem[] = [];

  // Motorisations : toujours affiché si > 5
  if (proofData.motorisationsCount > 5) {
    items.push({
      icon: <Car className="w-5 h-5 text-blue-600" />,
      value: `${proofData.motorisationsCount}+`,
      label: "motorisations compatibles",
    });
  }

  // Modèles : seulement si > 3
  if (proofData.modelsCount > 3) {
    items.push({
      icon: <Tag className="w-5 h-5 text-indigo-600" />,
      value: `${proofData.modelsCount}`,
      label: "modèles couverts",
    });
  }

  // Période : seulement si non-vide et parsable
  if (proofData.periodeRange && proofData.periodeRange.trim().length > 3) {
    items.push({
      icon: <Calendar className="w-5 h-5 text-emerald-600" />,
      value: proofData.periodeRange,
      label: "années couvertes",
    });
  }

  // Équipementiers : seulement si non-vide
  if (proofData.topEquipementiers && proofData.topEquipementiers.length > 0) {
    items.push({
      icon: <Factory className="w-5 h-5 text-amber-600" />,
      value: `${proofData.topEquipementiers.length}+`,
      label: "équipementiers référencés",
    });
  }

  // Aucun KPI viable → pas de section vide
  if (items.length === 0) return null;

  // Max 4 items
  const display = items.slice(0, 4);

  return (
    <div
      className={`grid grid-cols-2 ${display.length > 2 ? "sm:grid-cols-4" : "sm:grid-cols-2"} gap-3`}
    >
      {display.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 sm:p-4"
        >
          <div className="flex-shrink-0">{item.icon}</div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {item.value}
            </p>
            <p className="text-xs text-gray-500 leading-tight mt-0.5">
              {item.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
});
