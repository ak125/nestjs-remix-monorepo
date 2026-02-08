/**
 * 🧹 PROCESSOR CACHE CLEANUP
 * Nettoyage automatique des caches Redis
 */

import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

interface CacheJobData {
  pattern?: string;
  maxAge?: number; // en secondes
}

@Processor('cache')
export class CacheProcessor {
  private readonly logger = new Logger(CacheProcessor.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Nettoyer les clés expirées
   */
  @Process('cleanup-expired')
  async handleCleanupExpired(job: Job<CacheJobData>) {
    this.logger.log(`🧹 Starting cache cleanup (Job #${job.id})`);

    try {
      const { pattern = '*', maxAge = 86400 } = job.data;

      // Scanner les clés Redis
      let cursor = '0';
      let deletedCount = 0;

      do {
        const [newCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );

        cursor = newCursor;

        for (const key of keys) {
          // Vérifier TTL
          const ttl = await this.redis.ttl(key);

          // Supprimer si pas de TTL ou expiré
          if (ttl === -1 || ttl > maxAge) {
            await this.redis.del(key);
            deletedCount++;
          }
        }
      } while (cursor !== '0');

      this.logger.log(
        `✅ Cache cleanup complete: ${deletedCount} keys deleted`,
      );

      return {
        success: true,
        deletedCount,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Cache cleanup failed: ${message}`);
      throw error;
    }
  }

  /**
   * Warm-up cache (préchauffer)
   */
  @Process('warmup')
  async handleWarmup(job: Job<any>) {
    this.logger.log(`🔥 Starting cache warmup (Job #${job.id})`);

    try {
      // TODO: Implémenter logique de warm-up
      // Exemple: préchauffer pages populaires, sitemaps, etc.

      this.logger.log(`✅ Cache warmup complete`);

      return {
        success: true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Cache warmup failed: ${message}`);
      throw error;
    }
  }
}
