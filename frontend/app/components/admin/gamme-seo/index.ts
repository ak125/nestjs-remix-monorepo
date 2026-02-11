/**
 * Barrel export for Admin Gamme SEO components
 */

// Types
export type {
  VLevelItem,
  FreshnessStatus,
  LoaderFreshness,
  VehicleEntry,
  GammeDetail,
  GammeStats,
  PurchaseGuideData,
  SeoFormState,
  EnergyFilter,
} from "./types";

// Utils
export {
  getFreshnessStatus,
  filterByEnergy,
  exportVehiclesToCSV,
  exportVLevelToCSV,
  filterAndSortVehicles,
  getFuelBadgeClass,
  getCharCountClass,
  getCharCountStatus,
  getProgressColor,
  checkV2Violations,
  getDefaultGuideForm,
} from "./utils";

// Components
export { VLevelCard } from "./VLevelCard";
export { SeoTabContent } from "./SeoTabContent";
export { VLevelTab } from "./VLevelTab";
export { VehiclesTab } from "./VehiclesTab";
