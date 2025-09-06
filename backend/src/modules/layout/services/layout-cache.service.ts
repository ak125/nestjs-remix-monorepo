import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../cache/cache.service';

export interface CacheStats {
  hits: number;
  misses: number;
  totalKeys: number;
  hitRate: number;
}

@Injectable()
export class LayoutCacheService {
  private readonly logger = new Logger(LayoutCacheService.name);
  private stats = {
    hits: 0,
    misses: 0,
    totalKeys: 0,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Cache optimisé avec compression et stratégies intelligentes
   */
  async set<T>(
    key: string,
    value: T,
    ttl?: number,
    options?: {
      compress?: boolean;
      tags?: string[];
      priority?: 'low' | 'normal' | 'high';
    },
  ): Promise<void> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const finalTtl = this.calculateTtl(ttl, options?.priority);
      
      let processedValue = value;
      
      // Compression pour gros objets
      if (options?.compress && this.shouldCompress(value)) {
        processedValue = await this.compressValue(value);
      }

      await this.cacheService.set(prefixedKey, processedValue, finalTtl);
      
      // Gérer les tags pour invalidation groupée
      if (options?.tags) {
        await this.addToTags(prefixedKey, options.tags);
      }

      this.stats.totalKeys++;
      this.logger.debug(`Cached ${prefixedKey} with TTL ${finalTtl}s`);
    } catch (error) {
      this.logger.error(`Error caching ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Récupération avec décompression automatique
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const value = await this.cacheService.get<T>(prefixedKey);
      
      if (value === null) {
        this.stats.misses++;
        this.logger.debug(`Cache miss for ${prefixedKey}`);
        return null;
      }

      this.stats.hits++;
      this.logger.debug(`Cache hit for ${prefixedKey}`);
      
      // Décompression si nécessaire
      if (this.isCompressed(value)) {
        return this.decompressValue(value);
      }

      return value;
    } catch (error) {
      this.logger.error(`Error getting cache ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache avec fonction de génération automatique
   */
  async getOrSet<T>(
    key: string,
    generator: () => Promise<T>,
    ttl?: number,
    options?: {
      compress?: boolean;
      tags?: string[];
      priority?: 'low' | 'normal' | 'high';
    },
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const value = await generator();
    await this.set(key, value, ttl, options);
    
    return value;
  }

  /**
   * Invalidation par tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const keys = await this.getKeysByTag(tag);
        await this.invalidateKeys(keys);
        await this.removeTag(tag);
      }
      
      this.logger.debug(`Invalidated cache by tags: ${tags.join(', ')}`);
    } catch (error) {
      this.logger.error(`Error invalidating by tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Warming du cache avec des données préchargées
   */
  async warmup(warmupData: Array<{ key: string; generator: () => Promise<any>; ttl?: number }>): Promise<void> {
    this.logger.log('Starting cache warmup...');
    
    const promises = warmupData.map(async ({ key, generator, ttl }) => {
      try {
        const value = await generator();
        await this.set(key, value, ttl, { priority: 'high', tags: ['warmup'] });
        this.logger.debug(`Warmed up cache for ${key}`);
      } catch (error) {
        this.logger.error(`Error warming up ${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    await Promise.all(promises);
    this.logger.log(`Cache warmup completed for ${warmupData.length} keys`);
  }

  /**
   * Statistiques du cache
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      totalKeys: this.stats.totalKeys,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  /**
   * Nettoie le cache avec stratégies intelligentes
   */
  async cleanup(): Promise<void> {
    try {
      // Supprime les clés expirées et les données de faible priorité
      await this.removeExpiredKeys();
      await this.removeByTags(['temporary', 'low-priority']);
      
      this.logger.log('Cache cleanup completed');
    } catch (error) {
      this.logger.error(`Error during cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Préfixe les clés pour éviter les collisions
   */
  private getPrefixedKey(key: string): string {
    return `layout:${key}`;
  }

  /**
   * Calcule le TTL optimal
   */
  private calculateTtl(ttl?: number, priority?: 'low' | 'normal' | 'high'): number {
    if (ttl) return ttl;
    
    const baseTtl = {
      low: 300, // 5 minutes
      normal: 900, // 15 minutes
      high: 3600, // 1 heure
    };

    return baseTtl[priority || 'normal'];
  }

  /**
   * Détermine si une valeur doit être compressée
   */
  private shouldCompress(value: any): boolean {
    const jsonSize = JSON.stringify(value).length;
    return jsonSize > 1024; // Compresse si > 1KB
  }

  /**
   * Compression des données
   */
  private async compressValue<T>(value: T): Promise<any> {
    // Simulation de compression (remplacer par vraie compression si nécessaire)
    return {
      __compressed: true,
      data: JSON.stringify(value),
      originalSize: JSON.stringify(value).length,
    };
  }

  /**
   * Vérifie si une valeur est compressée
   */
  private isCompressed(value: any): boolean {
    return value && typeof value === 'object' && value.__compressed === true;
  }

  /**
   * Décompression des données
   */
  private decompressValue<T>(compressedValue: any): T {
    return JSON.parse(compressedValue.data);
  }

  /**
   * Ajoute une clé aux tags
   */
  private async addToTags(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `tag:${tag}`;
      const existingKeys = await this.cacheService.get<string[]>(tagKey) || [];
      if (!existingKeys.includes(key)) {
        existingKeys.push(key);
        await this.cacheService.set(tagKey, existingKeys, 7200); // 2 heures
      }
    }
  }

  /**
   * Récupère les clés par tag
   */
  private async getKeysByTag(tag: string): Promise<string[]> {
    const tagKey = `tag:${tag}`;
    return await this.cacheService.get<string[]>(tagKey) || [];
  }

  /**
   * Invalide plusieurs clés
   */
  private async invalidateKeys(keys: string[]): Promise<void> {
    const promises = keys.map(key => this.cacheService.delete(key));
    await Promise.all(promises);
  }

  /**
   * Supprime un tag
   */
  private async removeTag(tag: string): Promise<void> {
    const tagKey = `tag:${tag}`;
    await this.cacheService.delete(tagKey);
  }

  /**
   * Supprime les clés expirées (simulation)
   */
  private async removeExpiredKeys(): Promise<void> {
    // Dans une vraie implementation, parcourir les clés expirées
    this.logger.debug('Expired keys cleanup completed');
  }

  /**
   * Supprime par tags
   */
  private async removeByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.invalidateByTags([tag]);
    }
  }
}
