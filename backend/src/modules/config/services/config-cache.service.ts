import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class ConfigCacheService {
  private readonly logger = new Logger(ConfigCacheService.name);
  private readonly prefix = 'config:';
  private readonly defaultTTL = 3600; // 1 heure

  constructor(private readonly cacheService: CacheService) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = `${this.prefix}${key}`;
      const cached = await this.cacheService.get(cacheKey);
      return cached as T;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération du cache pour ${key}`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const cacheKey = `${this.prefix}${key}`;
      await this.cacheService.set(cacheKey, value, ttl || this.defaultTTL);
    } catch (error) {
      this.logger.error(`Erreur lors de la mise en cache pour ${key}`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const cacheKey = `${this.prefix}${key}`;
      await this.cacheService.del(cacheKey);
    } catch (error) {
      this.logger.error(`Erreur lors de la suppression du cache pour ${key}`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      // Implementation simplifiée - dans un vrai projet, 
      // il faudrait implémenter une méthode de nettoyage par pattern
      this.logger.log('Cache des configurations vidé (implémentation simplifiée)');
    } catch (error) {
      this.logger.error('Erreur lors du vidage du cache', error);
    }
  }

  /**
   * Invalider le cache avec pattern (implémentation future)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // TODO: Implémenter quand le CacheService supportera les patterns
      this.logger.debug(`Pattern d'invalidation: ${pattern} (non implémenté)`);
    } catch (error) {
      this.logger.error('Erreur lors de l\'invalidation par pattern', error);
    }
  }
}
