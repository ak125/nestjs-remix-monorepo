// 🚗 R8 Vehicle Page — Barrel
// Rôle SEO : R8 - VEHICLE (sélection pièces pour un véhicule spécifique)

export type {
  VehicleData,
  CatalogFamily,
  CatalogGamme,
  PopularPart,
  SEOData,
  R8Block,
  R8Content,
  LoaderData,
} from "./r8.types";
export { FAMILY_MICRO_DESCRIPTIONS } from "./r8-constants";
export { generateVehicleSchema } from "./r8-schema";
export { transformRpcToLoaderData } from "./r8-transform";

// Sections
export { AntiErrorsSection } from "./sections/AntiErrorsSection";
export { BreadcrumbSection } from "./sections/BreadcrumbSection";
export { HeroSection } from "./sections/HeroSection";
export { HowtoSection } from "./sections/HowtoSection";
export { R8EnrichedSection } from "./sections/R8EnrichedSection";
export { SeoIntroSection } from "./sections/SeoIntroSection";
export { TrustSection } from "./sections/TrustSection";
