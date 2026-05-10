// 🎯 R8 Vehicle — S_HERO
// H1 unique (image-matrix-v1 §7, gradient-only)

import { resolveSlogan } from "~/config/visual-intent";
import { HeroSelection } from "../../../heroes";
import { type LoaderData } from "../r8.types";

interface Props {
  vehicle: LoaderData["vehicle"];
}

export function HeroSection({ vehicle }: Props) {
  return (
    <div data-section="S_HERO">
      <HeroSelection
        title={`${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name} ${vehicle.type_power_ps} ch de ${vehicle.type_year_from} à ${vehicle.type_year_to || "aujourd'hui"}`}
        subtitle={`${vehicle.type_fuel} · ${vehicle.type_body} · ${vehicle.type_year_from}–${vehicle.type_year_to || "Auj."}`}
        slogan={resolveSlogan("selection")}
      />
    </div>
  );
}
