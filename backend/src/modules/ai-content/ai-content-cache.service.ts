import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class AiContentCacheService {
  private readonly logger = new Logger(AiContentCacheService.name);
  private redisClient: Redis | null = null;
  private readonly PREFIX = 'ai-content:';

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private initializeRedis() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');

      if (!redisUrl) {
        this.logger.warn('REDIS_URL not configured. Cache will be disabled.');
        return;
      }

      this.redisClient = new Redis(redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Redis cache connected successfully');
      });

      this.redisClient.on('error', (error) => {
        this.logger.error(`Redis cache error: ${error.message}`);
      });
    } catch (error) {
      this.logger.error(`Failed to initialize Redis: ${error.message}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redisClient) return null;

    try {
      const data = await this.redisClient.get(this.PREFIX + key);

      if (!data) return null;

      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    if (!this.redisClient) return;

    try {
      await this.redisClient.setex(
        this.PREFIX + key,
        ttlSeconds,
        JSON.stringify(value),
      );
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}: ${error.message}`);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.redisClient) return;

    try {
      await this.redisClient.del(this.PREFIX + key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}: ${error.message}`);
    }
  }

  async clear(pattern: string = '*'): Promise<number> {
    if (!this.redisClient) return 0;

    try {
      const keys = await this.redisClient.keys(this.PREFIX + pattern);

      if (keys.length === 0) return 0;

      await this.redisClient.del(...keys);
      this.logger.log(
        `Cleared ${keys.length} cache entries matching ${pattern}`,
      );

      return keys.length;
    } catch (error) {
      this.logger.error(`Cache clear error: ${error.message}`);
      return 0;
    }
  }

  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate?: number;
  }> {
    if (!this.redisClient) {
      return { totalKeys: 0, memoryUsage: '0B' };
    }

    try {
      const keys = await this.redisClient.keys(this.PREFIX + '*');
      const info = await this.redisClient.info('memory');

      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      return {
        totalKeys: keys.length,
        memoryUsage,
      };
    } catch (error) {
      this.logger.error(`Error getting cache stats: ${error.message}`);
      return { totalKeys: 0, memoryUsage: '0B' };
    }
  }

  isAvailable(): boolean {
    return this.redisClient !== null && this.redisClient.status === 'ready';
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.logger.log('Redis cache disconnected');
    }
  }
}
