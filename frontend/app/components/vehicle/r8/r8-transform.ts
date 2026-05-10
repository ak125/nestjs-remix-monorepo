// 🚗 R8 Vehicle Page — RPC → LoaderData transformer (pure)
// Extracted from routes/constructeurs.$brand.$model.$type.tsx (Phase 1 refactor)
// Rôle SEO : R8 - VEHICLE
//
// Transforms the normalized RPC payload (page-data-rpc) into LoaderData consumed by the route.
// Zero I/O — safe to unit test.

import { stripHtmlForMeta } from "../../../utils/seo-clean.utils";
import { normalizeTypeAlias } from "../../../utils/url-builder.utils";
import { type ModelContentV1Data } from "../../model";
import {
  type CatalogFamily,
  type LoaderData,
  type PopularPart,
  type VehicleData,
} from "./r8.types";

/**
 * Transforme la réponse RPC en LoaderData
 * Compatible avec la structure existante de la page
 */
export function transformRpcToLoaderData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpcData: any,
  params: { brand: string; model: string; type: string },
): LoaderData {
  const v = rpcData.vehicle;
  const seoCustom = rpcData.seo_custom;

  // Parsing des paramètres URL (pour fallback)
  const brandParts = params.brand.split("-");
  const marque_id = parseInt(brandParts[brandParts.length - 1]) || 0;
  const marque_alias = brandParts.slice(0, -1).join("-");

  const modelParts = params.model.split("-");
  const modele_id = parseInt(modelParts[modelParts.length - 1]) || 0;
  const modele_alias = modelParts.slice(0, -1).join("-");

  const typeWithoutHtml = params.type.replace(".html", "");
  const typeParts = typeWithoutHtml.split("-");
  const type_id = parseInt(typeParts[typeParts.length - 1]) || 0;

  // Formatage de la date (logique PHP)
  let type_date = "";
  if (!v.type_year_to) {
    type_date = `du ${v.type_month_from}/${v.type_year_from}`;
  } else {
    type_date = `de ${v.type_year_from} à ${v.type_year_to}`;
  }

  // Données véhicule
  const vehicleData: VehicleData = {
    marque_id: v.marque_id || marque_id,
    marque_alias: v.marque_alias || marque_alias,
    marque_name: v.marque_name,
    marque_name_meta: v.marque_name_meta || v.marque_name,
    marque_name_meta_title: v.marque_name_meta_title || v.marque_name,
    marque_logo: v.marque_logo || `${v.marque_alias}.webp`,
    marque_relfollow: v.marque_relfollow || 1,
    modele_id: v.modele_id || modele_id,
    modele_alias: v.modele_alias || modele_alias,
    modele_name: v.modele_name,
    modele_name_meta: v.modele_name_meta || v.modele_name,
    modele_relfollow: v.modele_relfollow || 1,
    modele_pic: v.modele_pic,
    type_id: v.type_id || type_id,
    type_alias: normalizeTypeAlias(v.type_alias, v.type_name),
    type_name: v.type_name,
    type_name_meta: v.type_name_meta || v.type_name,
    type_power_ps: v.type_power_ps,
    type_body: v.type_body,
    type_fuel: v.type_fuel,
    type_month_from: v.type_month_from,
    type_year_from: v.type_year_from,
    type_month_to: v.type_month_to,
    type_year_to: v.type_year_to,
    type_relfollow: v.type_relfollow || 1,
    power: v.type_power_ps,
    date: type_date,
    motor_codes: rpcData.motor_codes || [],
    motor_codes_formatted: (rpcData.motor_codes || []).join(", "),
    mine_codes: rpcData.mine_codes || [],
    mine_codes_formatted: (rpcData.mine_codes || []).join(", "),
    cnit_codes: rpcData.cnit_codes || [],
    cnit_codes_formatted: (rpcData.cnit_codes || []).join(", "),
    power_formatted: v.type_power_ps ? `${v.type_power_ps} ch` : "",
    cylinder_cm3: v.type_liter
      ? Math.round(parseFloat(v.type_liter) * 1000)
      : undefined,
    production_date_formatted: type_date,
  };

  // Système SEO avec switch dynamique
  const getSeoSwitch = (alias: number, typeId: number): string => {
    const switches: Record<number, string[]> = {
      1: ["à prix discount", "pas cher", "à mini prix", "en promotion"],
      2: ["et équipements", "et accessoires", "neuves", "d'origine"],
      10: [
        "Toutes les pièces auto",
        "Trouvez toutes les pièces",
        "Catalogue complet",
        "Pièces détachées",
      ],
      11: [
        "Toutes les références",
        "L'ensemble des pièces",
        "Toutes les gammes",
        "Tous les produits",
      ],
      12: [
        "nos fournisseurs certifiés",
        "nos partenaires agréés",
        "nos distributeurs",
        "nos fournisseurs",
      ],
    };
    const options = switches[alias] || [""];
    return options[typeId % options.length];
  };

  // SEO (priorité aux données personnalisées)
  let seoTitle: string;
  let seoDescription: string;
  let seoKeywords: string;
  let h1: string;
  let content: string;
  let content2: string;

  if (seoCustom) {
    seoTitle =
      seoCustom.mta_title ||
      `Pièces ${vehicleData.marque_name_meta_title} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta}`;
    seoDescription = seoCustom.mta_descrip || "";
    seoKeywords =
      seoCustom.mta_keywords ||
      `${vehicleData.marque_name_meta}, ${vehicleData.modele_name_meta}, ${vehicleData.type_name_meta}`;
    h1 =
      seoCustom.mta_h1 ||
      `${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name} ${vehicleData.type_power_ps} ch ${type_date}`;
    content = seoCustom.mta_content || "";
    content2 = "";
  } else {
    const comp_switch_title = getSeoSwitch(1, type_id);
    const comp_switch_desc = getSeoSwitch(2, type_id);
    seoTitle = `Pièces ${vehicleData.marque_name_meta_title} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta} ${comp_switch_title}`;
    seoDescription = `Catalogue pièces détachées pour ${vehicleData.marque_name_meta} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta} ${vehicleData.type_power_ps} ch ${type_date} neuves ${comp_switch_desc}`;
    seoKeywords = `${vehicleData.marque_name_meta}, ${vehicleData.modele_name_meta}, ${vehicleData.type_name_meta}, ${vehicleData.type_power_ps} ch, ${type_date}`;
    h1 = `${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name} ${vehicleData.type_power_ps} ch ${type_date}`;
    content = `Accédez au catalogue de pièces compatibles avec votre <b>${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name}</b> ${vehicleData.type_power_ps} ch (${vehicleData.type_year_from}–${vehicleData.type_year_to || "aujourd'hui"}). Les gammes ci-dessous sont filtrées selon la motorisation, la période de production et la carrosserie. Pour confirmer la compatibilité, utilisez votre VIN / CNIT (carte grise) : cela évite les erreurs entre versions proches.`;
    content2 = `En cas de doute, notre équipe valide la référence avant expédition.${vehicleData.motor_codes_formatted ? ` Code moteur connu : <strong>${vehicleData.motor_codes_formatted}</strong>.` : ""}`;
  }

  // Canonical URL (uses normalizeTypeAlias to handle null, empty, or "null" string values)
  const canonicalLink = `https://www.automecanik.com/constructeurs/${vehicleData.marque_alias}-${vehicleData.marque_id}/${vehicleData.modele_alias}-${vehicleData.modele_id}/${vehicleData.type_alias}-${vehicleData.type_id}.html`;

  // Catalogue (depuis RPC)
  const catalogFamilies: CatalogFamily[] = (
    rpcData.catalog?.families || []
  ).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) => ({
      mf_id: parseInt(f.mf_id),
      mf_name: f.mf_name,
      mf_description: f.mf_description || `Système ${f.mf_name.toLowerCase()}`,
      mf_pic: f.mf_pic || `${f.mf_name.toLowerCase()}.webp`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gammes: (f.gammes || []).map((g: any) => ({
        pg_id: g.pg_id,
        pg_alias: g.pg_alias,
        pg_name: g.pg_name,
      })),
    }),
  );

  // Pièces populaires (depuis RPC)
  const generateSeoContent = (
    pgName: string,
    vd: VehicleData,
    tid: number,
  ): string => {
    const switches = ["Achetez", "Trouvez", "Commandez", "Choisissez"];
    const qualities = ["d'origine", "de qualité", "certifiées", "garanties"];
    return `${switches[tid % switches.length]} ${pgName} ${vd.marque_name_meta} ${vd.modele_name_meta} ${vd.type_name_meta}, ${qualities[(tid + 1) % qualities.length]} à prix bas.`;
  };

  const popularParts: PopularPart[] = (rpcData.popular_parts || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any, idx: number) => ({
      cgc_pg_id: p.pg_id,
      pg_alias: p.pg_alias,
      pg_name: p.pg_name,
      pg_name_meta: p.pg_name_meta || p.pg_name.toLowerCase(),
      pg_img: p.pg_img || null,
      addon_content: generateSeoContent(p.pg_name, vehicleData, type_id + idx),
    }),
  );

  // Validation SEO pour robots
  const seoValidation = rpcData.seo_validation || {};
  let pageRobots = "index, follow";
  if (!seoValidation.is_indexable) {
    pageRobots = "noindex, nofollow";
  }

  // Nouveaux véhicules TecDoc (60000-83456) : noindex jusqu'à validation SEO
  if (type_id >= 60000 && type_id <= 83456) {
    pageRobots = "noindex, nofollow";
  }

  // Blog content - RPC returns simple bsm_* fields, but ModelContentV1Data expects full structure
  // For now, set to null. To get full model content, a separate API call would be needed.
  const modelContentV1: ModelContentV1Data | null = null;

  return {
    vehicle: vehicleData,
    catalogFamilies,
    popularParts,
    seo: {
      title: seoTitle,
      description: stripHtmlForMeta(seoDescription),
      keywords: seoKeywords,
      h1,
      content,
      content2,
      robots: pageRobots,
      canonical: canonicalLink,
    },
    breadcrumb: {
      items: [
        { name: "Accueil", url: "/" },
        { name: "Constructeurs", url: "/constructeurs" },
        {
          name: vehicleData.marque_name,
          url: `/constructeurs/${vehicleData.marque_alias}-${vehicleData.marque_id}.html`,
        },
        {
          name: vehicleData.modele_name,
          url: "",
        },
        {
          name: `${vehicleData.type_name} ${vehicleData.type_power_ps} ch`,
          url: "",
        },
      ],
      brand: vehicleData.marque_name,
      model: vehicleData.modele_name,
      type: vehicleData.type_name,
    },
    modelContentV1,
    r8Content: rpcData.r8_content || null,
  };
}
