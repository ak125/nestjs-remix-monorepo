// 🚗 R8 Vehicle Page — Types & Interfaces
// Extracted from routes/constructeurs.$brand.$model.$type.tsx (Phase 1 refactor)
// Rôle SEO : R8 - VEHICLE

import { type ModelContentV1Data } from "../../model";

// 📝 Types de données (structure PHP + API /full)
export interface VehicleData {
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;
  marque_logo: string;
  marque_relfollow: number;
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_name_meta: string;
  modele_relfollow: number;
  modele_pic?: string;
  type_id: number;
  type_alias: string;
  type_name: string;
  type_name_meta: string;
  type_power_ps: string;
  type_body: string;
  type_fuel: string;
  type_month_from: string;
  type_year_from: string;
  type_month_to: string | null;
  type_year_to: string | null;
  type_relfollow: number;
  power: string;
  date: string;
  // 🔧 Codes moteur (depuis API /full)
  motor_codes?: string[];
  motor_codes_formatted?: string;
  // 🔧 Types mines / CNIT (depuis API /full)
  mine_codes?: string[];
  mine_codes_formatted?: string;
  cnit_codes?: string[];
  cnit_codes_formatted?: string;
  // 📊 Données techniques formatées
  power_formatted?: string;
  cylinder_cm3?: number;
  production_date_formatted?: string;
}

export interface CatalogFamily {
  mf_id: number;
  mf_name: string;
  mf_description: string;
  mf_pic: string;
  gammes: CatalogGamme[];
}

export interface CatalogGamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
}

export interface PopularPart {
  cgc_pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_meta: string;
  pg_img: string;
  addon_content: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface _MetaTagsAriane {
  mta_id: number;
  mta_title: string;
  mta_descrip: string;
  mta_keywords: string;
  mta_ariane: string;
  mta_h1: string;
  mta_content: string;
  mta_alias: string;
  mta_relfollow: number;
}

export interface SEOData {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  content: string;
  content2: string;
  robots: string;
  canonical: string;
}

// R8 enriched content (from __seo_r8_pages, optional overlay)
export interface R8Block {
  id: string;
  type: string;
  title: string;
  renderedText: string;
  specificityWeight: number;
}

export interface R8Content {
  h1: string;
  metaTitle: string;
  metaDescription: string;
  blocks: R8Block[];
  seoDecision: string;
  diversityScore: number;
}

export interface LoaderData {
  vehicle: VehicleData;
  catalogFamilies: CatalogFamily[];
  popularParts: PopularPart[];
  seo: SEOData;
  breadcrumb: {
    items?: Array<{ name: string; url: string }>;
    // Legacy support
    brand: string;
    model: string;
    type: string;
  };
  // V1 Content - Encyclopedic content for model pages (optional)
  modelContentV1?: ModelContentV1Data | null;
  // R8 enriched content (from R8VehicleEnricherService, optional)
  r8Content?: R8Content | null;
}
