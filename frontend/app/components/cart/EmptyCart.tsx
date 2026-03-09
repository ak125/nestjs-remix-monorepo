import { Link } from "@remix-run/react";
import {
  ArrowRight,
  Car,
  Clock,
  Cog,
  Disc3,
  Droplets,
  ShoppingBag,
  Stethoscope,
  Wind,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  type VehicleCookie,
  getVehicleBreadcrumbData,
} from "~/utils/vehicle-cookie";
import { CartHelpBlock } from "./CartHelpBlock";

const POPULAR_GAMMES = [
  {
    id: 402,
    name: "Plaquette de frein",
    alias: "plaquette-de-frein",
    Icon: Disc3,
  },
  { id: 82, name: "Disque de frein", alias: "disque-de-frein", Icon: Disc3 },
  {
    id: 7,
    name: "Filtre à huile",
    alias: "filtre-a-huile",
    Icon: Droplets,
  },
  { id: 8, name: "Filtre à air", alias: "filtre-a-air", Icon: Wind },
  {
    id: 479,
    name: "Kit d'embrayage",
    alias: "kit-d-embrayage",
    Icon: Cog,
  },
  {
    id: 307,
    name: "Kit de distribution",
    alias: "kit-de-distribution",
    Icon: Clock,
  },
];

interface EmptyCartProps {
  vehicle: VehicleCookie | null;
}

export function EmptyCart({ vehicle }: EmptyCartProps) {
  const vehicleLabel = vehicle
    ? [vehicle.marque_name, vehicle.modele_name].filter(Boolean).join(" ")
    : null;
  const vehicleUrl = vehicle ? getVehicleBreadcrumbData(vehicle).href : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* Section A — Banniere vehicule */}
      {vehicle && vehicleUrl && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2.5 rounded-lg">
                <Car className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-emerald-700">
                  Vous cherchez des pièces pour votre
                </p>
                <p className="font-bold text-emerald-900">{vehicleLabel} ?</p>
              </div>
            </div>
            <Button
              asChild
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Link to={vehicleUrl}>
                Voir les pièces compatibles
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Section B — Hero panier vide */}
      <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-xl border text-center">
        <div className="bg-slate-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-5">
          <ShoppingBag className="h-10 w-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-slate-800">
          Votre panier est vide
        </h2>
        <p className="text-slate-600 mb-6">
          {vehicleLabel
            ? `Trouvez les pièces compatibles pour votre ${vehicleLabel}.`
            : "Trouvez la bonne pièce en quelques clics."}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" variant="blue" className="w-full sm:w-auto">
            <Link to="/" className="inline-flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Trouver une pièce
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Link
              to="/diagnostic-auto"
              className="inline-flex items-center gap-2"
            >
              <Stethoscope className="h-5 w-5" />
              Lancer un diagnostic
            </Link>
          </Button>
        </div>
      </div>

      {/* Section C — Categories populaires */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Catégories populaires
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {POPULAR_GAMMES.map((gamme) => (
            <Link
              key={gamme.id}
              to={`/pieces/${gamme.alias}-${gamme.id}.html`}
              className="flex items-center gap-3 min-h-[44px] px-4 py-3 bg-white rounded-xl border border-slate-200 hover:border-cta hover:shadow-md transition-all group"
            >
              <gamme.Icon className="h-5 w-5 text-slate-400 group-hover:text-cta flex-shrink-0 transition-colors" />
              <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                {gamme.name}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Section D — Bloc aide */}
      <CartHelpBlock />
    </div>
  );
}
