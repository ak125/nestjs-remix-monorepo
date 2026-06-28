// 🎯 R8 Vehicle — S_HERO
// H1 unique (image-matrix-v1 §7, gradient-only)

import { buildR8H1Emitted } from "@repo/seo-types";

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
        // H1 R8 = builder partagé @repo/seo-types (PR-D2). Le frontend REND le
        // builder ; le fingerprint anti-duplicate hashe la même fonction →
        // divergence impossible. Byte-identique au template inline précédent
        // (parité prouvée, golden #1178 + r8-hero-h1-parity.test.tsx).
        title={buildR8H1Emitted({
          marqueName: vehicle.marque_name,
          modeleName: vehicle.modele_name,
          typeName: vehicle.type_name,
          typePowerPs: vehicle.type_power_ps,
          typeYearFrom: vehicle.type_year_from,
          typeYearTo: vehicle.type_year_to,
        })}
        subtitle={`${vehicle.type_fuel} · ${vehicle.type_body} · ${vehicle.type_year_from}–${vehicle.type_year_to || "Auj."}`}
        slogan={resolveSlogan("selection")}
      />
    </div>
  );
}
