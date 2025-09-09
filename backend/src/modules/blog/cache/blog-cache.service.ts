/**
 * Service de Cache Avancé pour le Blog
 * Extension du cache original avec fonctionnalités Redis
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface CacheConfig {
  ttl: number; // Time to live en secondes
  tags: string[]; // Tags pour l'invalidation
  priority: 'high' | 'medium' | 'low';
}

export interface BlogCacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  cacheSize: number;
  lastInvalidation: Date;
}

@Injectable()
export class BlogAdvancedCacheService {
  private readonly logger = new Logger(BlogAdvancedCacheService.name);
  private stats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    lastInvalidation: new Date(),
  };

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    this.logger.log('Blog Advanced Cache Service initialized');
  }

  /**
   * Configuration des caches par type de contenu
   */
  private getCacheConfig(type: string): CacheConfig {
    const configs = {
      'blog:dashboard': {
        ttl: 300, // 5 minutes
        tags: ['dashboard', 'stats'],
        priority: 'high',
      },
      'blog:article': {
        ttl: 3600, // 1 heure
        tags: ['article'],
        priority: 'medium',
      },
      'blog:list': {
        ttl: 1800, // 30 minutes
        tags: ['list', 'pagination'],
        priority: 'medium',
      },
      'blog:popular': {
        ttl: 1800, // 30 minutes
        tags: ['popular', 'stats'],
        priority: 'high',
      },
      'blog:seo': {
        ttl: 7200, // 2 heures
        tags: ['seo', 'meta'],
        priority: 'low',
      },
    };

    return (
      configs[type] || {
        ttl: 600,
        tags: ['default'],
        priority: 'medium',
      }
    );
  }

  /**
   * Récupérer une valeur du cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      this.stats.totalRequests++;

      const cached = await this.redis.get(key);

      if (cached) {
        this.stats.hits++;
        this.logger.debug(`Cache HIT pour: ${key}`);
        return JSON.parse(cached);
      }

      this.stats.misses++;
      this.logger.debug(`Cache MISS pour: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Erreur cache GET ${key}:`, error);
      return null;
    }
  }

  /**
   * Stocker une valeur dans le cache
   */
  async set<T>(key: string, value: T, type?: string): Promise<boolean> {
    try {
      const config = this.getCacheConfig(type || 'default');

      // Stocker la valeur avec TTL
      await this.redis.setex(key, config.ttl, JSON.stringify(value));

      // Ajouter les tags pour l'invalidation
      for (const tag of config.tags) {
        await this.redis.sadd(`tag:${tag}`, key);
        await this.redis.expire(`tag:${tag}`, config.ttl + 60);
      }

      this.logger.debug(`Cache SET pour: ${key} (TTL: ${config.ttl}s)`);
      return true;
    } catch (error) {
      this.logger.error(`Erreur cache SET ${key}:`, error);
      return false;
    }
  }

  /**
   * Invalidation par tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      const keys = await this.redis.smembers(`tag:${tag}`);

      if (keys.length === 0) {
        return 0;
      }

      // Supprimer toutes les clés associées au tag
      const pipeline = this.redis.pipeline();
      keys.forEach((key) => pipeline.del(key));
      await pipeline.exec();

      // Nettoyer le tag
      await this.redis.del(`tag:${tag}`);

      this.stats.lastInvalidation = new Date();
      this.logger.log(`Cache invalidé pour tag "${tag}": ${keys.length} clés`);

      return keys.length;
    } catch (error) {
      this.logger.error(`Erreur invalidation tag ${tag}:`, error);
      return 0;
    }
  }

  /**
   * Invalidation multiple
   */
  async invalidateMultiple(keys: string[]): Promise<number> {
    try {
      if (keys.length === 0) return 0;

      const result = await this.redis.del(...keys);
      this.stats.lastInvalidation = new Date();

      this.logger.log(`Cache invalidé: ${result} clés supprimées`);
      return result;
    } catch (error) {
      this.logger.error(`Erreur invalidation multiple:`, error);
      return 0;
    }
  }

  /**
   * Méthode d'aide pour le cache avec callback
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    type?: string,
  ): Promise<T> {
    // Essayer de récupérer depuis le cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Générer la valeur
    const value = await factory();

    // Stocker dans le cache
    await this.set(key, value, type);

    return value;
  }

  /**
   * Statistiques du cache
   */
  async getStats(): Promise<BlogCacheStats> {
    const cacheSize = await this.getCacheSize();
    const hitRate =
      this.stats.totalRequests > 0
        ? (this.stats.hits / this.stats.totalRequests) * 100
        : 0;

    return {
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round((100 - hitRate) * 100) / 100,
      totalRequests: this.stats.totalRequests,
      cacheSize,
      lastInvalidation: this.stats.lastInvalidation,
    };
  }

  /**
   * Taille du cache
   */
  private async getCacheSize(): Promise<number> {
    try {
      const info = await this.redis.info('memory');
      const match = info.match(/used_memory:(\d+)/);
      return match ? parseInt(match[1]) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Vider tout le cache
   */
  async flush(): Promise<boolean> {
    try {
      await this.redis.flushall();
      this.stats = {
        hits: 0,
        misses: 0,
        totalRequests: 0,
        lastInvalidation: new Date(),
      };

      this.logger.log('Cache vidé complètement');
      return true;
    } catch (error) {
      this.logger.error('Erreur lors du vidage du cache:', error);
      return false;
    }
  }

  /**
   * Nettoyage automatique des caches expirés
   */
  async cleanup(): Promise<void> {
    try {
      // Nettoyer les tags expirés
      const tagKeys = await this.redis.keys('tag:*');

      for (const tagKey of tagKeys) {
        const members = await this.redis.smembers(tagKey);
        const validMembers = [];

        for (const member of members) {
          const exists = await this.redis.exists(member);
          if (exists) {
            validMembers.push(member);
          }
        }

        if (validMembers.length === 0) {
          await this.redis.del(tagKey);
        } else if (validMembers.length !== members.length) {
          await this.redis.del(tagKey);
          if (validMembers.length > 0) {
            await this.redis.sadd(tagKey, ...validMembers);
          }
        }
      }

      this.logger.debug('Nettoyage du cache terminé');
    } catch (error) {
      this.logger.error('Erreur lors du nettoyage:', error);
    }
  }
}
