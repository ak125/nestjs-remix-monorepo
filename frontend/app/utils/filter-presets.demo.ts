/**
 * 💾 DEMO - Exemples de presets de filtres
 *
 * Ce fichier contient des exemples de presets prédéfinis
 * pour démontrer la fonctionnalité de sauvegarde.
 */

import { logger } from "~/utils/logger";

export interface FilterPreset {
  id: string;
  name: string;
  filters: Record<string, any>;
  createdAt: string;
}

/**
 * 🎯 Presets de démonstration
 */
export const DEMO_PRESETS: FilterPreset[] = [
  {
    id: "demo-1",
    name: "🔧 Filtres à huile BOSCH",
    filters: {
      marque: ["BOSCH"],
      category: ["Filtres"],
      priceMax: 50,
      inStock: "true",
    },
    createdAt: new Date("2025-10-25T10:00:00Z").toISOString(),
  },
  {
    id: "demo-2",
    name: "⚡ Bougies d'allumage économiques",
    filters: {
      category: ["Allumage"],
      priceMax: 30,
      inStock: "true",
      onSale: "true",
    },
    createdAt: new Date("2025-10-25T10:30:00Z").toISOString(),
  },
  {
    id: "demo-3",
    name: "🚗 Pièces OES haut de gamme",
    filters: {
      qualityLevel: "1", // OES
      priceMin: 100,
      inStock: "true",
    },
    createdAt: new Date("2025-10-25T11:00:00Z").toISOString(),
  },
  {
    id: "demo-4",
    name: "💰 Promotions du moment",
    filters: {
      onSale: "true",
      priceMax: 100,
      inStock: "true",
    },
    createdAt: new Date("2025-10-25T12:00:00Z").toISOString(),
  },
];

/**
 * 📥 Charger les presets depuis localStorage
 * Ajoute les presets de démo si localStorage vide
 */
export function loadPresetsWithDefaults(): FilterPreset[] {
  const STORAGE_KEY = "search_filters_presets";

  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const presets = JSON.parse(stored);
      logger.log(
        `📦 ${presets.length} preset(s) chargé(s) depuis localStorage`,
      );
      return presets;
    }

    // Aucun preset sauvegardé → charger les démos
    logger.log("📋 Aucun preset sauvegardé, chargement des démos...");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_PRESETS));
    return DEMO_PRESETS;
  } catch (error) {
    logger.error("❌ Erreur chargement presets:", error);
    return [];
  }
}

/**
 * 💾 Sauvegarder un preset
 */
export function savePreset(
  preset: Omit<FilterPreset, "id" | "createdAt">,
): FilterPreset {
  const STORAGE_KEY = "search_filters_presets";

  const newPreset: FilterPreset = {
    id: `preset-${Date.now()}`,
    name: preset.name,
    filters: preset.filters,
    createdAt: new Date().toISOString(),
  };

  try {
    const existing = loadPresetsWithDefaults();
    const updated = [...existing, newPreset];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    logger.log("✅ Preset sauvegardé:", newPreset.name);
    return newPreset;
  } catch (error) {
    logger.error("❌ Erreur sauvegarde preset:", error);
    throw error;
  }
}

/**
 * 🗑️ Supprimer un preset
 */
export function deletePreset(presetId: string): void {
  const STORAGE_KEY = "search_filters_presets";

  try {
    const existing = loadPresetsWithDefaults();
    const updated = existing.filter((p) => p.id !== presetId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    logger.log("🗑️ Preset supprimé:", presetId);
  } catch (error) {
    logger.error("❌ Erreur suppression preset:", error);
    throw error;
  }
}

/**
 * 🔄 Réinitialiser aux presets de démo
 */
export function resetToDemoPresets(): void {
  const STORAGE_KEY = "search_filters_presets";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_PRESETS));
  logger.log("🔄 Presets réinitialisés aux démos");
}

/**
 * 📊 Statistiques d'utilisation des presets
 */
export interface PresetStats {
  totalPresets: number;
  demoPresets: number;
  userPresets: number;
  mostUsed?: FilterPreset;
  recentlyUsed: FilterPreset[];
}

export function getPresetStats(): PresetStats {
  const presets = loadPresetsWithDefaults();
  const demoIds = DEMO_PRESETS.map((p) => p.id);

  return {
    totalPresets: presets.length,
    demoPresets: presets.filter((p) => demoIds.includes(p.id)).length,
    userPresets: presets.filter((p) => !demoIds.includes(p.id)).length,
    recentlyUsed: presets
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5),
  };
}

/**
 * 🔍 Rechercher un preset par nom
 */
export function findPresetByName(name: string): FilterPreset | undefined {
  const presets = loadPresetsWithDefaults();
  return presets.find((p) => p.name.toLowerCase().includes(name.toLowerCase()));
}

/**
 * 📋 Export presets en JSON
 */
export function exportPresetsAsJSON(): string {
  const presets = loadPresetsWithDefaults();
  return JSON.stringify(presets, null, 2);
}

/**
 * 📥 Import presets depuis JSON
 */
export function importPresetsFromJSON(json: string): void {
  const STORAGE_KEY = "search_filters_presets";

  try {
    const imported = JSON.parse(json) as FilterPreset[];

    // Validation basique
    if (!Array.isArray(imported)) {
      throw new Error("Format JSON invalide : attendu un array");
    }

    imported.forEach((preset, idx) => {
      if (!preset.id || !preset.name || !preset.filters) {
        throw new Error(`Preset ${idx} invalide : champs manquants`);
      }
    });

    localStorage.setItem(STORAGE_KEY, json);
    logger.log(`✅ ${imported.length} preset(s) importé(s)`);
  } catch (error) {
    logger.error("❌ Erreur import presets:", error);
    throw error;
  }
}
