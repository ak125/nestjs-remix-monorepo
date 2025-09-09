import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.redis.on('connect', () => {
      this.logger.log('✅ Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error('❌ Redis connection error:', error);
    });
  }

  /**
   * 🔄 Cache intelligent avec TTL automatique
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.logger.debug(`🎯 Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
      this.logger.debug(`❌ Cache MISS: ${key}`);
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * 💾 Set avec TTL intelligent selon le type de données
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      // TTL intelligent selon le préfixe
      const smartTTL = ttl || this.getSmartTTL(key);

      await this.redis.setex(key, smartTTL, JSON.stringify(value));
      this.logger.debug(`💾 Cache SET: ${key} (TTL: ${smartTTL}s)`);
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * 🧹 Delete cache entry
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug(`🗑️ Cache DELETE: ${key}`);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * 🔄 Clear cache by pattern
   */
  async clearByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(
          `🧹 Cleared ${keys.length} cache entries matching: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(`Cache clear error for pattern ${pattern}:`, error);
    }
  }

  /**
   * 🎯 TTL intelligent selon le type de données
   */
  private getSmartTTL(key: string): number {
    const ttlMap: Record<string, number> = {
      'dashboard:stats': 300, // 5 min - Stats dashboard
      'stock:available': 60, // 1 min - Stock disponible
      'suppliers:list': 1800, // 30 min - Liste fournisseurs
      'seo:stats': 3600, // 1h - Stats SEO
      'orders:recent': 180, // 3 min - Commandes récentes
      'users:count': 600, // 10 min - Compteur utilisateurs
      'manufacturers:list': 3600, // 1h - Constructeurs
      'blog:articles': 1800, // 30 min - Articles blog
    };

    // Trouver le TTL correspondant au préfixe
    for (const [prefix, ttl] of Object.entries(ttlMap)) {
      if (key.startsWith(prefix)) {
        return ttl;
      }
    }

    // TTL par défaut
    return 300; // 5 minutes
  }

  /**
   * 📊 Cache statistics
   */
  async getStats(): Promise<{
    memory: string;
    keyCount: number;
    hitRate: string;
  }> {
    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();

      return {
        memory: this.extractMemoryUsed(info),
        keyCount,
        hitRate: 'N/A', // Redis doesn't track hit rate by default
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return { memory: '0B', keyCount: 0, hitRate: 'Error' };
    }
  }

  private extractMemoryUsed(info: string): string {
    const match = info.match(/used_memory_human:(.+)/);
    return match ? match[1].trim() : '0B';
  }

  /**
   * 🔄 Cache-aside pattern helper
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    this.logger.debug(`🔄 Fetching fresh data for: ${key}`);
    const fresh = await fetcher();

    // Cache the result
    await this.set(key, fresh, ttl);

    return fresh;
  }
}
