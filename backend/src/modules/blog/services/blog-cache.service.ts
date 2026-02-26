import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * Service de cache stratégique pour le contenu blog
 * Utilise une stratégie de cache à 3 niveaux basée sur la popularité
 */
@Injectable()
export class BlogCacheService {
  private readonly logger = new Logger(BlogCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /**
   * Détermine la stratégie de cache basée sur le nombre de vues
   */
  private getCacheStrategy(viewsCount: number = 0) {
    if (viewsCount > 1000) {
      return { ttl: 300, prefix: 'blog:hot:' }; // 5 min pour articles très populaires
    } else if (viewsCount > 100) {
      return { ttl: 1800, prefix: 'blog:warm:' }; // 30 min pour articles moyens
    } else {
      return { ttl: 7200, prefix: 'blog:cold:' }; // 2h pour articles peu consultés
    }
  }

  /**
   * Récupère une valeur du cache avec stratégie adaptée
   */
  async get<T>(key: string, viewsCount?: number): Promise<T | undefined> {
    const strategy = this.getCacheStrategy(viewsCount);
    const cacheKey = `${strategy.prefix}${key}`;

    try {
      const cached = await this.cacheManager.get<T>(cacheKey);
      if (cached) {
        this.logger.debug(`🎯 Cache hit: ${cacheKey}`);
      }
      return cached;
    } catch (error) {
      this.logger.warn(`⚠️ Cache get error: ${(error as Error).message}`);
      return undefined;
    }
  }

  /**
   * Stocke une valeur dans le cache avec TTL adapté
   */
  async set<T>(key: string, value: T, viewsCount?: number): Promise<void> {
    const strategy = this.getCacheStrategy(viewsCount);
    const cacheKey = `${strategy.prefix}${key}`;

    try {
      await this.cacheManager.set(cacheKey, value, strategy.ttl * 1000); // ms
      this.logger.debug(`💾 Cache set: ${cacheKey} (TTL: ${strategy.ttl}s)`);
    } catch (error) {
      this.logger.warn(`⚠️ Cache set error: ${(error as Error).message}`);
    }
  }

  /**
   * Supprime une clé du cache dans toutes les stratégies
   */
  async del(key: string): Promise<void> {
    const strategies = ['blog:hot:', 'blog:warm:', 'blog:cold:'];

    for (const prefix of strategies) {
      try {
        await this.cacheManager.del(`${prefix}${key}`);
      } catch (error) {
        this.logger.warn(`⚠️ Cache del error: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Efface tout le cache blog
   */
  async reset(): Promise<void> {
    try {
      // Note: Cette méthode dépend de l'implémentation du cache manager
      // Pour Redis, on pourrait utiliser un pattern comme 'blog:*'
      await this.cacheManager.reset();
      this.logger.log('🧹 Cache blog réinitialisé');
    } catch (error) {
      this.logger.warn(`⚠️ Cache reset error: ${(error as Error).message}`);
    }
  }
}
