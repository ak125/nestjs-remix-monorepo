/**
 * 🎣 Hook personnalisé pour la gestion des configurations admin
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  configApi,
  type ConfigCategory,
  type ConfigItem,
  type ConfigStats,
} from "~/services/api/config.api";
import { logger } from "~/utils/logger";

export interface UseConfigResult {
  // État des données
  configs: ConfigItem[];
  stats: ConfigStats | null;
  categories: ConfigCategory[];

  // État de l'interface
  selectedCategory: string;
  editingKey: string | null;
  searchTerm: string;
  showSensitive: Record<string, boolean>;

  // États de chargement
  loading: boolean;
  saving: boolean;
  error: string | null;

  // Données filtrées
  filteredConfigs: ConfigItem[];
  selectedCategoryData: ConfigCategory | undefined;
  configsInCategory: number;

  // Actions
  setSelectedCategory: (category: string) => void;
  setEditingKey: (key: string | null) => void;
  setSearchTerm: (term: string) => void;
  toggleSensitiveVisibility: (key: string) => void;
  updateConfig: (key: string, value: string | number | boolean, type: string) => Promise<boolean>;
  createBackup: (name?: string) => Promise<string | null>;
  reloadConfigs: () => Promise<void>;
}

export function useConfig(categories: ConfigCategory[]): UseConfigResult {
  // États des données
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [stats, setStats] = useState<ConfigStats | null>(null);

  // États de l'interface
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>(
    {},
  );

  // États de chargement
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les données initiales
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [configsData, statsData] = await Promise.all([
        configApi.getAllConfigs(),
        configApi.getStats(),
      ]);

      setConfigs(configsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
      logger.error("❌ Erreur chargement configurations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger au montage
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-sélectionner la première catégorie avec des configurations
  useEffect(() => {
    if (configs.length > 0 && categories.length > 0) {
      const categoriesWithConfigs = categories.filter((cat) =>
        configs.some((config) => config.category === cat.key),
      );
      if (categoriesWithConfigs.length > 0 && selectedCategory === "general") {
        setSelectedCategory(categoriesWithConfigs[0].key);
      }
    }
  }, [configs, categories, selectedCategory]);

  // Configurations filtrées (mémoisées)
  const filteredConfigs = useMemo(() => {
    return configs.filter((config) => {
      const matchesCategory = config.category === selectedCategory;
      const matchesSearch =
        !searchTerm ||
        config.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [configs, selectedCategory, searchTerm]);

  // Données de la catégorie sélectionnée
  const selectedCategoryData = useMemo(() => {
    return categories.find((cat) => cat.key === selectedCategory);
  }, [categories, selectedCategory]);

  // Nombre de configurations dans la catégorie
  const configsInCategory = useMemo(() => {
    return stats?.configsByCategory?.[selectedCategory] || 0;
  }, [stats, selectedCategory]);

  // Toggle visibilité des valeurs sensibles
  const toggleSensitiveVisibility = useCallback((key: string) => {
    setShowSensitive((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // Mettre à jour une configuration
  const updateConfig = useCallback(
    async (key: string, value: string | number | boolean, type: string): Promise<boolean> => {
      try {
        setSaving(true);
        setError(null);

        // Conversion du type si nécessaire
        let processedValue: unknown = value;
        if (type === "boolean") {
          processedValue = value === "true" || value === true;
        } else if (type === "number") {
          processedValue = Number(value);
        } else if (type === "json") {
          try {
            processedValue = JSON.parse(value as string);
          } catch {
            throw new Error("Format JSON invalide");
          }
        }

        await configApi.updateConfig(key, processedValue);

        // Mettre à jour l'état local
        setConfigs((prev) =>
          prev.map((config) =>
            config.key === key
              ? {
                  ...config,
                  value: processedValue,
                  lastUpdated: new Date().toISOString(),
                }
              : config,
          ),
        );

        setEditingKey(null);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de sauvegarde");
        logger.error("❌ Erreur mise à jour configuration:", err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // Créer une sauvegarde
  const createBackup = useCallback(
    async (name?: string): Promise<string | null> => {
      try {
        setSaving(true);
        setError(null);

        const backupId = await configApi.createBackup(name);
        return backupId;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de sauvegarde");
        logger.error("❌ Erreur création sauvegarde:", err);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // Recharger les configurations
  const reloadConfigs = useCallback(async (): Promise<void> => {
    await loadData();
  }, [loadData]);

  return {
    // État des données
    configs,
    stats,
    categories,

    // État de l'interface
    selectedCategory,
    editingKey,
    searchTerm,
    showSensitive,

    // États de chargement
    loading,
    saving,
    error,

    // Données filtrées
    filteredConfigs,
    selectedCategoryData,
    configsInCategory,

    // Actions
    setSelectedCategory,
    setEditingKey,
    setSearchTerm,
    toggleSensitiveVisibility,
    updateConfig,
    createBackup,
    reloadConfigs,
  };
}
