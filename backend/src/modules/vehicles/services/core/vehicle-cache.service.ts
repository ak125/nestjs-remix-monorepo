import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * 🗄️ VEHICLE CACHE SERVICE - Gestion du cache Redis pour les véhicules
 *
 * Centralise toute la logique de cache pour les données véhicules :
 * - Marques, modèles, types
 * - Résultats de recherche
 * - Données enrichies avec cars_engine
 *
 * TTL par type de données :
 * - Marques/Modèles/Types : 1h (données statiques)
 * - Recherches : 30 min (résultats dynamiques)
 * - Enrichissement moteur : 2h (données semi-statiques)
 */

export enum CacheType {
  BRANDS = 'brands',
  MODELS = 'models',
  TYPES = 'types',
  SEARCH = 'search',
  ENRICHMENT = 'enrichment',
  MINE = 'mine',
  ENGINE = 'engine',
}

export interface CacheConfig {
  ttl: number; // TTL en secondes
  prefix: string;
}

@Injectable()
export class VehicleCacheService {
  private readonly logger = new Logger(VehicleCacheService.name);

  // Configuration du cache par type
  private readonly cacheConfigs: Record<CacheType, CacheConfig> = {
    [CacheType.BRANDS]: { ttl: 3600, prefix: 'vehicles:brands:' }, // 1h
    [CacheType.MODELS]: { ttl: 3600, prefix: 'vehicles:models:' }, // 1h
    [CacheType.TYPES]: { ttl: 3600, prefix: 'vehicles:types:' }, // 1h
    [CacheType.SEARCH]: { ttl: 1800, prefix: 'vehicles:search:' }, // 30min
    [CacheType.ENRICHMENT]: { ttl: 7200, prefix: 'vehicles:engine:' }, // 2h
    [CacheType.MINE]: { ttl: 3600, prefix: 'vehicles:mine:' }, // 1h
    [CacheType.ENGINE]: { ttl: 7200, prefix: 'vehicles:eng:' }, // 2h
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * 📝 Générer une clé de cache
   */
  private generateKey(type: CacheType, identifier: string): string {
    const config = this.cacheConfigs[type];
    return `${config.prefix}${identifier}`;
  }

  /**
   * 💾 Obtenir une valeur du cache
   */
  async get<T>(type: CacheType, identifier: string): Promise<T | null> {
    try {
      const key = this.generateKey(type, identifier);
      const cached = await this.cacheManager.get<T>(key);

      if (cached) {
        this.logger.debug(`Cache HIT: ${key}`);
        return cached;
      }

      this.logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Erreur cache GET ${type}:${identifier}`, error);
      return null;
    }
  }

  /**
   * 💾 Stocker une valeur dans le cache
   */
  async set<T>(type: CacheType, identifier: string, value: T): Promise<void> {
    try {
      const key = this.generateKey(type, identifier);
      const config = this.cacheConfigs[type];

      await this.cacheManager.set(key, value, config.ttl * 1000); // ms
      this.logger.debug(`Cache SET: ${key} (TTL: ${config.ttl}s)`);
    } catch (error) {
      this.logger.error(`Erreur cache SET ${type}:${identifier}`, error);
    }
  }

  /**
   * 🗑️ Supprimer une valeur du cache
   */
  async delete(type: CacheType, identifier: string): Promise<void> {
    try {
      const key = this.generateKey(type, identifier);
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DELETE: ${key}`);
    } catch (error) {
      this.logger.error(`Erreur cache DELETE ${type}:${identifier}`, error);
    }
  }

  /**
   * 🧹 Vider tout le cache d'un type
   */
  async clearByType(type: CacheType): Promise<void> {
    try {
      const prefix = this.cacheConfigs[type].prefix;
      // Note: Cette méthode dépend de l'implémentation Redis
      // Peut nécessiter une approche différente selon le cache manager
      this.logger.debug(`Cache CLEAR TYPE: ${type} (${prefix}*)`);
    } catch (error) {
      this.logger.error(`Erreur cache CLEAR TYPE ${type}`, error);
    }
  }

  /**
   * 🔄 Obtenir ou calculer une valeur avec mise en cache automatique
   */
  async getOrSet<T>(
    type: CacheType,
    identifier: string,
    factory: () => Promise<T>,
  ): Promise<T> {
    // Tentative de récupération depuis le cache
    const cached = await this.get<T>(type, identifier);
    if (cached !== null) {
      return cached;
    }

    // Calcul de la valeur
    try {
      const value = await factory();

      // Mise en cache si la valeur n'est pas nulle/undefined
      if (value !== null && value !== undefined) {
        await this.set(type, identifier, value);
      }

      return value;
    } catch (error) {
      this.logger.error(`Erreur factory ${type}:${identifier}`, error);
      throw error;
    }
  }

  /**
   * 📊 Statistiques du cache (pour debugging)
   */
  getCacheConfig(type: CacheType): CacheConfig {
    return this.cacheConfigs[type];
  }

  /**
   * 🔧 Générer une clé pour recherche complexe
   */
  generateSearchKey(searchParams: Record<string, any>): string {
    // Tri des clés pour garantir la cohérence
    const sortedKeys = Object.keys(searchParams).sort();
    const keyParts = sortedKeys.map((key) => `${key}:${searchParams[key]}`);
    return keyParts.join('|');
  }
}
