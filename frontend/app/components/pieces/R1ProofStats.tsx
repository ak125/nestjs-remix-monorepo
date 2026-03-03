/**
 * R1 "Preuves en chiffres" — Stats visuelles compactes.
 * Expose proofData (déjà dans le loader) en 2-4 cartes.
 */
import { Calendar, Car, Users, Wrench } from "lucide-react";

interface R1ProofStatsProps {
  motorisationsCount: number;
  modelsCount: number;
  topMarques: string[];
  periodeRange: string;
  topEquipementiers: string[];
}

export function R1ProofStats({
  motorisationsCount,
  modelsCount,
  topMarques,
  periodeRange,
  topEquipementiers,
}: R1ProofStatsProps) {
  if (motorisationsCount < 5) return null;

  const stats: Array<{
    icon: typeof Car;
    value: string;
    label: string;
  }> = [
    {
      icon: Car,
      value: `${motorisationsCount}+`,
      label: "motorisations compatibles",
    },
  ];

  if (modelsCount > 3) {
    stats.push({
      icon: Users,
      value: `${modelsCount}+`,
      label: "modèles couverts",
    });
  }

  if (topMarques.length > 0) {
    stats.push({
      icon: Wrench,
      value: topMarques.join(", "),
      label:
        topEquipementiers.length > 0
          ? `+ ${topEquipementiers.slice(0, 2).join(", ")}`
          : "marques principales",
    });
  }

  if (periodeRange) {
    stats.push({
      icon: Calendar,
      value: periodeRange,
      label: "années couvertes",
    });
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-2">
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
