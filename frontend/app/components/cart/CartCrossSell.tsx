import { Link } from "@remix-run/react";
import { ArrowRight } from "lucide-react";
import { type VehicleCookie } from "~/utils/vehicle-cookie";

export interface CrossSellGamme {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_img?: string;
}

export function CartCrossSell({
  gammes,
  vehicle,
}: {
  gammes: CrossSellGamme[];
  vehicle?: VehicleCookie | null;
}) {
  if (!gammes || gammes.length === 0) return null;

  const vehicleLabel = vehicle
    ? [vehicle.marque_name, vehicle.modele_name].filter(Boolean).join(" ")
    : null;

  return (
    <div className="mt-6 rounded-xl border bg-slate-50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">
        {vehicleLabel
          ? `Produits compl\u00e9mentaires pour votre ${vehicleLabel}`
          : "Compl\u00e9tez votre entretien"}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {gammes.map((gamme) => (
          <Link
            key={gamme.pg_id}
            to={`/pieces/${gamme.pg_alias}`}
            className="flex min-w-[140px] flex-col items-center gap-2 rounded-lg border bg-white p-3 transition-shadow hover:shadow-md"
          >
            {gamme.pg_img ? (
              <img
                src={gamme.pg_img}
                alt=""
                className="h-12 w-12 rounded object-contain"
                loading="lazy"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                Auto
              </div>
            )}
            <span className="text-center text-xs font-medium leading-tight text-slate-700">
              {gamme.pg_name}
            </span>
            {vehicle && (
              <span className="text-center text-[10px] text-slate-400 leading-tight">
                Pour votre v{"\u00e9"}hicule
              </span>
            )}
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-teal-600">
              Voir le produit
              <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
