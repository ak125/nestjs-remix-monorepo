/**
 * 🔧 Service API pour la gestion de la configuration système
 * Compatible avec l'écosystème admin existant
 */

import { ApiError } from "../common/errors";
import { logger } from "~/utils/logger";

export interface ConfigCategory {
  key: string;
  label: string;
  icon: string;
  description?: string;
}

export interface ConfigItem {
  key: string;
  value: any;
  category: string;
  type: "string" | "number" | "boolean" | "json" | "array";
  description?: string;
  isSensitive?: boolean;
  requiresRestart?: boolean;
  isRequired?: boolean;
  defaultValue?: any;
  validationRules?: Record<string, any>;
  lastUpdated?: string;
  updatedBy?: string;
}

export interface ConfigBackup {
  id: string;
  name: string;
  timestamp: string;
  size: number;
  configs: ConfigItem[];
}

export interface ConfigStats {
  totalConfigs: number;
  configsByCategory: Record<string, number>;
  lastBackup?: string;
  lastUpdate?: string;
  sensitiveConfigsCount: number;
  requiredConfigsCount: number;
}

class ConfigApiService {
  private readonly baseUrl = "/admin/configuration";

  /**
   * Récupère toutes les configurations
   */
  async getAllConfigs(): Promise<ConfigItem[]> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new ApiError(
          `Erreur lors de la récupération des configurations: ${response.status}`,
          response.status,
        );
      }

      const data = await response.json();
      return data.configs || data;
    } catch (error) {
      logger.error("❌ Erreur getAllConfigs:", error);
      throw error;
    }
  }

  /**
   * Récupère les configurations par catégorie
   */
  async getConfigsByCategory(category: string): Promise<ConfigItem[]> {
    try {
      const configs = await this.getAllConfigs();
      return configs.filter((config) => config.category === category);
    } catch (error) {
      logger.error("❌ Erreur getConfigsByCategory:", error);
      throw error;
    }
  }

  /**
   * Récupère une configuration spécifique
   */
  async getConfig(key: string): Promise<ConfigItem | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${key}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new ApiError(
          `Erreur lors de la récupération de la configuration: ${response.status}`,
          response.status,
        );
      }

      const data = await response.json();
      return data.config || data;
    } catch (error) {
      logger.error("❌ Erreur getConfig:", error);
      throw error;
    }
  }

  /**
   * Met à jour une configuration
   */
  async updateConfig(key: string, value: any): Promise<ConfigItem> {
    try {
      const response = await fetch(`${this.baseUrl}/${key}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        throw new ApiError(
          `Erreur lors de la mise à jour de la configuration: ${response.status}`,
          response.status,
        );
      }

      const data = await response.json();
      return data.config || data;
    } catch (error) {
      logger.error("❌ Erreur updateConfig:", error);
      throw error;
    }
  }

  /**
   * Crée une sauvegarde des configurations
   */
  async createBackup(name?: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/backup`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name || `Backup ${new Date().toLocaleString()}`,
        }),
      });

      if (!response.ok) {
        throw new ApiError(
          `Erreur lors de la création de la sauvegarde: ${response.status}`,
          response.status,
        );
      }

      const data = await response.json();
      return data.backupId || data.id;
    } catch (error) {
      logger.error("❌ Erreur createBackup:", error);
      throw error;
    }
  }

  /**
   * Restaure une sauvegarde
   */
  async restoreBackup(backupId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/restore/${backupId}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new ApiError(
          `Erreur lors de la restauration: ${response.status}`,
          response.status,
        );
      }
    } catch (error) {
      logger.error("❌ Erreur restoreBackup:", error);
      throw error;
    }
  }

  /**
   * Récupère les statistiques de configuration
   */
  async getStats(): Promise<ConfigStats> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new ApiError(
          `Erreur lors de la récupération des statistiques: ${response.status}`,
          response.status,
        );
      }

      const data = await response.json();
      return data.stats || data;
    } catch (error) {
      logger.error("❌ Erreur getStats:", error);
      throw error;
    }
  }

  /**
   * Valide une valeur de configuration
   */
  async validateConfig(
    key: string,
    value: any,
  ): Promise<{ isValid: boolean; errors?: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/validate`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, value }),
      });

      if (!response.ok) {
        throw new ApiError(
          `Erreur lors de la validation: ${response.status}`,
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      logger.error("❌ Erreur validateConfig:", error);
      throw error;
    }
  }

  /**
   * Recharge les configurations depuis la base de données
   */
  async reloadConfigs(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/reload`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new ApiError(
          `Erreur lors du rechargement: ${response.status}`,
          response.status,
        );
      }
    } catch (error) {
      logger.error("❌ Erreur reloadConfigs:", error);
      throw error;
    }
  }
}

export const configApi = new ConfigApiService();
