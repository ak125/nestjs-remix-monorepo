// 🍞 R8 Vehicle — S_BREADCRUMB
// Rendu visuel du fil d'Ariane. Les données structurées BreadcrumbList
// sont émises EXCLUSIVEMENT via JSON-LD (generateVehicleSchema → meta
// script:ld+json côté route). Voir r8-schema.ts pour le SoT.
//
// Décision architecturale (2026-05-26) : single SoT JSON-LD après cycle
// d'incidents GSC dual-surface (#729 + alert suivante). Microdata supprimée.

import { type LoaderData } from "../r8.types";

interface Props {
  vehicle: LoaderData["vehicle"];
  breadcrumb: LoaderData["breadcrumb"];
}

export function BreadcrumbSection({ vehicle, breadcrumb }: Props) {
  // Niveaux "Constructeurs" (index → 404) et "Modèle" (2-seg → 410, ADR-084) retirés :
  // fil d'ariane R8 = Accueil → Marque → Véhicule.
  const brandHref = `/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}.html`;

  return (
    <nav
      className="bg-white border-b border-gray-200 py-3"
      aria-label="Fil d'Ariane"
      data-section="S_BREADCRUMB"
    >
      <div className="container mx-auto px-4">
        <ol className="flex items-center gap-2 text-sm">
          <li>
            <a href="/" className="hover:underline text-brand">
              Accueil
            </a>
          </li>
          <li>
            <span className="text-gray-400">→</span>
          </li>
          <li>
            <a href={brandHref} className="hover:underline text-brand">
              {breadcrumb.brand}
            </a>
          </li>
          <li>
            <span className="text-gray-400">→</span>
          </li>
          <li aria-current="page">
            <span className="font-semibold text-gray-900">
              {vehicle.type_name} {vehicle.type_power_ps} ch
            </span>
          </li>
        </ol>
      </div>
    </nav>
  );
}
