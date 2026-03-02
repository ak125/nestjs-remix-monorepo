/**
 * R1 "Preuves en chiffres" — Stats visuelles compactes.
 * Expose proofData (déjà dans le loader) en 2-3 lignes.
 */
import { Car, Calendar, Wrench } from "lucide-react";

export function R1ProofStats({
  vehicleCount,
  topMarques,
  periodeRange,
  topEquipementiers,
}: {
  vehicleCount: number;
  topMarques: string[];
  periodeRange: string;
  topEquipementiers: string[];
}) {
  if (vehicleCount <= 0) return null;

  const stats = [
    {
      icon: Car,
      value: `${vehicleCount}+`,
      label: "véhicules couverts",
    },
    ...(topMarques.length > 0
      ? [
          {
            icon: Wrench,
            value: topMarques.join(", "),
            label:
              topEquipementiers.length > 0
                ? `+ ${topEquipementiers.slice(0, 2).join(", ")}`
                : "marques principales",
          },
        ]
      : []),
    ...(periodeRange
      ? [
          {
            icon: Calendar,
            value: periodeRange,
            label: "années couvertes",
          },
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
      {stats.map((stat, i) => (
        <div
          key={i}
          className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 p-4"
        >
          <stat.icon className="w-5 h-5 text-primary-600 shrink-0" />
          <div className="min-w-0">
            <div className="text-lg font-bold text-gray-900 truncate">
              {stat.value}
            </div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
