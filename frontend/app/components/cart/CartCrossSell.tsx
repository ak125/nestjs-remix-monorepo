import { Link } from "@remix-run/react";
import { ChevronRight, Package } from "lucide-react";
import { normalizeTypeAlias } from "~/utils/url-builder.utils";
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

  const safeTypeAlias = vehicle
    ? normalizeTypeAlias(vehicle.type_alias, vehicle.type_name)
    : null;

  function gammeUrl(gamme: CrossSellGamme) {
    if (vehicle && safeTypeAlias) {
      return `/pieces/${gamme.pg_alias}-${gamme.pg_id}/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${safeTypeAlias}-${vehicle.type_id}.html`;
    }
    return `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`;
  }

  return (
    <section className="mt-8">
      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          {vehicleLabel
            ? `Produits compl\u00e9mentaires pour votre ${vehicleLabel}`
            : "Compl\u00e9tez votre entretien"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          S{"\u00e9"}lectionn{"\u00e9"}es pour compl{"\u00e9"}ter votre
          entretien
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {gammes.map((gamme) => (
          <article
            key={gamme.pg_id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-36 items-center justify-center rounded-xl bg-slate-50 p-4">
              {gamme.pg_img ? (
                <img
                  src={gamme.pg_img}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <Package className="h-12 w-12 text-slate-300" />
              )}
            </div>

            <div className="mt-4">
              <h3 className="line-clamp-2 text-base font-bold tracking-tight text-slate-900">
                {gamme.pg_name}
              </h3>
              {vehicle && (
                <p className="mt-2 text-sm text-slate-500">
                  Pour votre v{"\u00e9"}hicule
                </p>
              )}
            </div>

            <div className="mt-4">
              <Link
                to={gammeUrl(gamme)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Voir le produit
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
