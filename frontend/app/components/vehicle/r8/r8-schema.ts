// 🚗 R8 Vehicle Page — JSON-LD Schema Generator
// Extracted from routes/constructeurs.$brand.$model.$type.tsx (Phase 1 refactor)
// Rôle SEO : R8 - Car + BreadcrumbList for Google rich snippets

import { type LoaderData, type VehicleData } from "./r8.types";

// 🌐 SoT des URLs canoniques R8.
// Note: les niveaux `constructeurs` (index → 404) et `model` (2-seg → 410, ADR-084)
// ont été retirés — le fil d'ariane R8 est désormais Accueil → Marque → Véhicule.
export function buildR8CanonicalUrls(vehicle: VehicleData) {
  const baseUrl = "https://www.automecanik.com";
  return {
    home: `${baseUrl}/`,
    brand: `${baseUrl}/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}.html`,
    type: `${baseUrl}/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`,
  };
}

// 🚗 Génère le schema @graph complet: Car + BreadcrumbList
export function generateVehicleSchema(
  vehicle: VehicleData,
  breadcrumb: LoaderData["breadcrumb"],
) {
  const urls = buildR8CanonicalUrls(vehicle);
  const canonicalUrl = urls.type;

  return {
    "@context": "https://schema.org",
    "@graph": [
      // 1️⃣ Car - Véhicule complet avec toutes les specs
      {
        "@type": "Car",
        "@id": `${canonicalUrl}#vehicle`,
        name: `${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`,
        brand: { "@type": "Brand", name: vehicle.marque_name },
        manufacturer: { "@type": "Organization", name: vehicle.marque_name },
        model: vehicle.modele_name,
        vehicleConfiguration: vehicle.type_name,
        // 📅 Année modèle
        ...(vehicle.type_year_from && {
          vehicleModelDate: vehicle.type_year_from,
        }),
        // 🔧 Moteur
        vehicleEngine: {
          "@type": "EngineSpecification",
          name: vehicle.type_name,
          ...(vehicle.type_power_ps && {
            enginePower: {
              "@type": "QuantitativeValue",
              value: parseInt(vehicle.type_power_ps),
              unitCode: "HP",
            },
          }),
        },
        // ⛽ Carburant
        ...(vehicle.type_fuel && { fuelType: vehicle.type_fuel }),
        // 🚗 Carrosserie
        ...(vehicle.type_body && { bodyType: vehicle.type_body }),
        // 📅 Période de production
        ...(vehicle.type_year_from && {
          additionalProperty: [
            {
              "@type": "PropertyValue",
              name: "Période de production",
              value: vehicle.type_year_to
                ? `${vehicle.type_year_from}-${vehicle.type_year_to}`
                : `depuis ${vehicle.type_year_from}`,
            },
          ],
        }),
        url: canonicalUrl,
      },
      // 2️⃣ BreadcrumbList - Fil d'ariane
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: urls.home,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: breadcrumb.brand,
            item: urls.brand,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${breadcrumb.type} ${vehicle.type_power_ps} ch`,
            item: urls.type,
          },
        ],
      },
    ],
  };
}
