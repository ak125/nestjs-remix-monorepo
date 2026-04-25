// ⚙️ R8 Vehicle — S_TECH_SPECS
// Table de specs techniques de la motorisation. Données 100% type_id-specific.
// Casse le duplicate cross-motorisations en exposant les vrais chiffres distincts.

import { Cog, Fuel, Gauge, Calendar, Hash, Car as CarIcon } from "lucide-react";
import { type LoaderData } from "../r8.types";

interface Props {
  vehicle: LoaderData["vehicle"];
}

interface SpecRow {
  label: string;
  value: string | null | undefined;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

function powerKwFromPs(ps: string): string | null {
  const n = parseInt(ps, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n / 1.35962).toString();
}

function formatPeriod(
  monthFrom: string | undefined,
  yearFrom: string | undefined,
  monthTo: string | null | undefined,
  yearTo: string | null | undefined,
): string | null {
  if (!yearFrom) return null;
  const start = monthFrom
    ? `${monthFrom.padStart(2, "0")}/${yearFrom}`
    : yearFrom;
  if (!yearTo) return `Depuis ${start}`;
  const end = monthTo ? `${monthTo.padStart(2, "0")}/${yearTo}` : yearTo;
  return `${start} – ${end}`;
}

function formatCylindree(
  cm3: number | undefined,
  fallback: string | undefined,
): string | null {
  if (cm3 && cm3 > 0) {
    const liters = (cm3 / 1000).toFixed(1).replace(/\.0$/, "");
    return `${liters} L (${cm3} cm³)`;
  }
  return fallback ?? null;
}

export function TechSpecsSection({ vehicle }: Props) {
  const kw = powerKwFromPs(vehicle.type_power_ps);
  const period = formatPeriod(
    vehicle.type_month_from,
    vehicle.type_year_from,
    vehicle.type_month_to,
    vehicle.type_year_to,
  );
  const cylindree = formatCylindree(
    vehicle.cylinder_cm3,
    vehicle.power_formatted,
  );

  const specs: SpecRow[] = [
    {
      label: "Cylindrée",
      value: cylindree,
      icon: Cog,
    },
    {
      label: "Puissance",
      value:
        vehicle.type_power_ps && kw
          ? `${vehicle.type_power_ps} ch (${kw} kW)`
          : vehicle.type_power_ps
            ? `${vehicle.type_power_ps} ch`
            : null,
      icon: Gauge,
    },
    {
      label: "Carburant",
      value: vehicle.type_fuel || null,
      icon: Fuel,
    },
    {
      label: "Carrosserie",
      value: vehicle.type_body || null,
      icon: CarIcon,
    },
    {
      label: "Période",
      value: period,
      icon: Calendar,
    },
    {
      label: "Code moteur",
      value: vehicle.motor_codes_formatted || null,
      icon: Hash,
    },
    {
      label: "CNIT",
      value: vehicle.cnit_codes_formatted || null,
      icon: Hash,
    },
  ].filter((s): s is SpecRow => Boolean(s.value));

  if (specs.length === 0) return null;

  return (
    <div className="mb-12" data-section="S_TECH_SPECS">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">
            Spécifications techniques —{" "}
            <span className="text-gray-700">
              {vehicle.marque_name} {vehicle.modele_name} {vehicle.type_name}
            </span>
          </h2>
        </div>
        <dl className="divide-y divide-gray-100">
          {specs.map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="inline-flex p-2 rounded-lg bg-blue-50 flex-shrink-0">
                <Icon size={18} className="text-blue-600" />
              </div>
              <dt className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">
                {label}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 break-words">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
