/**
 * Utility functions for Admin Gamme SEO Detail page
 * Extracted from admin.gammes-seo_.$pgId.tsx to reduce file size
 */

import {
  type FreshnessStatus,
  type VLevelItem,
  type VehicleEntry,
} from "./types";

/**
 * Freshness status helper - accepts optional 'now' timestamp for SSR consistency
 */
export const getFreshnessStatus = (
  lastUpdated: string | null,
  now?: number,
): FreshnessStatus => {
  if (!lastUpdated)
    return {
      status: "unknown",
      color: "gray",
      text: "Inconnu",
      icon: "?",
      days: -1,
    };
  const currentTime = now ?? Date.now();
  const days = Math.floor(
    (currentTime - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 7)
    return { status: "fresh", color: "green", text: "Frais", icon: "", days };
  if (days <= 30)
    return {
      status: "stale",
      color: "yellow",
      text: "Perime",
      icon: "",
      days,
    };
  return { status: "old", color: "red", text: "Ancien", icon: "", days };
};

/**
 * Filter V-Level items by energy type
 * Handles undefined/null input safely
 */
export const filterByEnergy = (
  items: VLevelItem[] | undefined | null,
  energyFilter: "all" | "diesel" | "essence",
): VLevelItem[] => {
  if (!items || !Array.isArray(items)) return [];
  if (energyFilter === "all") return items;
  return items.filter((item) => item.energy?.toLowerCase() === energyFilter);
};

/**
 * Export vehicles to CSV file
 */
export const exportVehiclesToCSV = (
  vehicles: VehicleEntry[],
  filename: string,
): void => {
  const headers = [
    "Marque",
    "Modele",
    "Moteur",
    "Puissance",
    "Carburant",
    "Annees",
  ];
  const rows = vehicles.map((v) => [
    v.marque_name,
    v.modele_name,
    v.type_name,
    v.power_ps ? `${v.power_ps}ch` : "",
    v.fuel || "",
    v.year_from && v.year_to ? `${v.year_from}-${v.year_to}` : "",
  ]);

  const csv = [headers, ...rows].map((row) => row.join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Export V-Level data to CSV file
 * Handles undefined/null arrays safely
 */
export const exportVLevelToCSV = (
  vLevel:
    | {
        v1?: VLevelItem[] | null;
        v2?: VLevelItem[] | null;
        v3?: VLevelItem[] | null;
        v4?: VLevelItem[] | null;
        v5?: VLevelItem[] | null;
      }
    | null
    | undefined,
  pgAlias: string,
): void => {
  if (!vLevel) return;

  const safeArray = (arr: VLevelItem[] | null | undefined): VLevelItem[] =>
    Array.isArray(arr) ? arr : [];

  const allItems = [
    ...safeArray(vLevel.v1).map((v) => ({ ...v, level: "V1" })),
    ...safeArray(vLevel.v2).map((v) => ({ ...v, level: "V2" })),
    ...safeArray(vLevel.v3).map((v) => ({ ...v, level: "V3" })),
    ...safeArray(vLevel.v4).map((v) => ({ ...v, level: "V4" })),
    ...safeArray(vLevel.v5).map((v) => ({ ...v, level: "V5" })),
  ];

  const headers = [
    "V-Level",
    "Marque",
    "Modele",
    "Variante",
    "Energie",
    "Rang",
    "Volume",
    "V2 Repetitions",
  ];
  const rows = allItems.map((v) => [
    v.level,
    v.brand,
    v.model_name,
    v.variant_name,
    v.energy,
    v.rank,
    v.search_volume || "",
    v.v2_repetitions || "",
  ]);

  const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `v-level-${pgAlias}-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Filter and sort vehicles by search query
 */
export const filterAndSortVehicles = (
  vehicles: VehicleEntry[],
  search: string,
): VehicleEntry[] => {
  return vehicles
    .filter((v) =>
      `${v.marque_name} ${v.modele_name} ${v.type_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) => parseInt(b.year_from || "0") - parseInt(a.year_from || "0"),
    );
};

/**
 * Get badge color class based on fuel type
 */
export const getFuelBadgeClass = (fuel: string): string => {
  const fuelLower = fuel?.toLowerCase() || "";
  if (fuelLower.includes("diesel"))
    return "bg-blue-100 text-blue-800 border-blue-200";
  if (fuelLower.includes("essence"))
    return "bg-green-100 text-green-800 border-green-200";
  if (fuelLower.includes("hybrid") || fuelLower.includes("electrique"))
    return "bg-purple-100 text-purple-800 border-purple-200";
  return "";
};

/**
 * Get character count color class for SEO fields
 */
export const getCharCountClass = (
  current: number,
  optimal: number,
  max: number,
): string => {
  if (current === 0) return "text-gray-400";
  if (current <= optimal) return "text-green-600";
  if (current <= max) return "text-yellow-600";
  return "text-red-600";
};

/**
 * Get character count status text for SEO fields
 */
export const getCharCountStatus = (
  current: number,
  optimal: number,
  max: number,
): string => {
  if (current === 0) return "Vide";
  if (current <= optimal) return "Optimal";
  if (current <= max) return "Acceptable";
  return "Trop long";
};

/**
 * Get progress bar color based on ratio to target
 */
export const getProgressColor = (value: number, target: number): string => {
  const ratio = value / target;
  if (ratio >= 0.8) return "bg-green-500";
  if (ratio >= 0.5) return "bg-yellow-500";
  return "bg-red-500";
};

/**
 * Check for V2 duplicate violations by energy type
 * Handles undefined/null input safely
 */
export const checkV2Violations = (
  v2Items: VLevelItem[] | undefined | null,
): { diesel: string[]; essence: string[] } => {
  if (!v2Items || !Array.isArray(v2Items)) {
    return { diesel: [], essence: [] };
  }
  const check = (items: VLevelItem[], energy: string) => {
    const models = items
      .filter((v) => v.energy?.toLowerCase() === energy)
      .map((v) => v.model_name);
    const duplicates = models.filter((m, i) => models.indexOf(m) !== i);
    return [...new Set(duplicates)];
  };
  return {
    diesel: check(v2Items, "diesel"),
    essence: check(v2Items, "essence"),
  };
};

/**
 * Get default purchase guide form state
 */
export const getDefaultGuideForm = (
  pgName: string,
): {
  step1: {
    title: string;
    content: string;
    highlight: string;
    bullets: string[];
  };
  step2: {
    economique: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
    };
    qualitePlus: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
      badge: string;
    };
    premium: {
      subtitle: string;
      description: string;
      specs: string[];
      priceRange: string;
    };
  };
  step3: {
    title: string;
    content: string;
    alerts: Array<{ type: "danger" | "warning" | "info"; text: string }>;
    relatedGammes: Array<{ pgId: number; pgName: string; pgAlias: string }>;
  };
} => ({
  step1: {
    title: `Identifiez votre ${pgName.toLowerCase()}`,
    content: "",
    highlight: "",
    bullets: [],
  },
  step2: {
    economique: {
      subtitle: "Usage standard",
      description: "",
      specs: [],
      priceRange: "",
    },
    qualitePlus: {
      subtitle: "Equipement d'origine",
      description: "",
      specs: [],
      priceRange: "",
      badge: "Le plus choisi",
    },
    premium: {
      subtitle: "Haute performance",
      description: "",
      specs: [],
      priceRange: "",
    },
  },
  step3: {
    title: "Securite et conseils",
    content: "",
    alerts: [],
    relatedGammes: [],
  },
});
