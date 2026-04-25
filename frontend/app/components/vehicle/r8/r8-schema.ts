// 🚗 R8 Vehicle Page — JSON-LD Schema Generator
// Extracted from routes/constructeurs.$brand.$model.$type.tsx (Phase 1 refactor)
// Rôle SEO : R8 - Car + BreadcrumbList for Google rich snippets

import { type LoaderData, type VehicleData } from "./r8.types";

// 🚗 Génère le schema @graph complet: Car + BreadcrumbList
export function generateVehicleSchema(
  vehicle: VehicleData,
  breadcrumb: LoaderData["breadcrumb"],
) {
  const baseUrl = "https://www.automecanik.com";
  const canonicalUrl = `${baseUrl}/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`;

  // Puissance dérivée kW (commonly used aux côtés HP)
  const powerPs = vehicle.type_power_ps
    ? parseInt(vehicle.type_power_ps)
    : null;
  const powerKw = powerPs && powerPs > 0 ? Math.round(powerPs / 1.35962) : null;

  // Période de production formatée
  const periodValue = vehicle.type_year_from
    ? vehicle.type_year_to
      ? `${vehicle.type_year_from}-${vehicle.type_year_to}`
      : `depuis ${vehicle.type_year_from}`
    : null;

  // additionalProperty : enrichi avec CNIT + code moteur si dispo
  const additionalProperty: Array<{
    "@type": "PropertyValue";
    name: string;
    value: string;
  }> = [];
  if (periodValue) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Période de production",
      value: periodValue,
    });
  }
  if (vehicle.cnit_codes_formatted) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "CNIT",
      value: vehicle.cnit_codes_formatted,
    });
  }
  if (vehicle.motor_codes_formatted) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "Code moteur",
      value: vehicle.motor_codes_formatted,
    });
  }

  // EngineSpecification enrichi : displacement (cm3), engineType (codes), enginePower (HP+kW)
  const enginePower: Array<{
    "@type": "QuantitativeValue";
    value: number;
    unitCode: string;
  }> = [];
  if (powerPs) {
    enginePower.push({
      "@type": "QuantitativeValue",
      value: powerPs,
      unitCode: "HP",
    });
  }
  if (powerKw) {
    enginePower.push({
      "@type": "QuantitativeValue",
      value: powerKw,
      unitCode: "KWT",
    });
  }

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
        // 📅 Année modèle (utilisé par Google + Bing)
        ...(vehicle.type_year_from && {
          vehicleModelDate: vehicle.type_year_from,
          modelDate: vehicle.type_year_from,
          dateVehicleFirstRegistered: vehicle.type_year_from,
        }),
        // 🔧 Moteur enrichi
        vehicleEngine: {
          "@type": "EngineSpecification",
          name: vehicle.type_name,
          ...(enginePower.length > 0 && { enginePower }),
          ...(vehicle.cylinder_cm3 &&
            vehicle.cylinder_cm3 > 0 && {
              engineDisplacement: {
                "@type": "QuantitativeValue",
                value: vehicle.cylinder_cm3,
                unitCode: "CMQ", // cm³
              },
            }),
          ...(vehicle.type_fuel && { fuelType: vehicle.type_fuel }),
          ...(vehicle.motor_codes_formatted && {
            engineType: vehicle.motor_codes_formatted,
          }),
        },
        // ⛽ Carburant (top-level pour rétro-compat Google)
        ...(vehicle.type_fuel && { fuelType: vehicle.type_fuel }),
        // 🚗 Carrosserie
        ...(vehicle.type_body && { bodyType: vehicle.type_body }),
        // 📅 + 🔢 PropertyValues : période, CNIT, code moteur
        ...(additionalProperty.length > 0 && { additionalProperty }),
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
            item: `${baseUrl}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Constructeurs",
            item: `${baseUrl}/constructeurs`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: breadcrumb.brand,
            item: `${baseUrl}/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}.html`,
          },
          {
            "@type": "ListItem",
            position: 4,
            name: breadcrumb.model,
            item: `${baseUrl}/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}.html`,
          },
          {
            "@type": "ListItem",
            position: 5,
            name: `${breadcrumb.type} ${vehicle.type_power_ps} ch`,
          },
        ],
      },
    ],
  };
}
