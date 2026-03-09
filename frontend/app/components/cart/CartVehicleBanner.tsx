import { Link } from "@remix-run/react";
import { Car, CheckCircle, ArrowRight } from "lucide-react";
import { type VehicleCookie } from "~/utils/vehicle-cookie";

export function CartVehicleBanner({
  vehicle,
}: {
  vehicle: VehicleCookie | null;
}) {
  if (!vehicle) return null;

  const vehicleLabel = [
    vehicle.marque_name,
    vehicle.modele_name,
    vehicle.type_name,
  ]
    .filter(Boolean)
    .join(" ");

  const vehicleUrl = `/constructeurs/${vehicle.marque_alias}/${vehicle.modele_alias}/${vehicle.type_alias}`;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
        <Car className="h-4 w-4 text-emerald-600" />
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-slate-800">
          {vehicleLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
          <CheckCircle className="h-3 w-3" />
          Compatibilité vérifiée
        </span>
      </div>
      <Link
        to={vehicleUrl}
        className="hidden items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900 sm:inline-flex"
      >
        Changer
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
