import { Injectable, Optional, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { once } from 'events';
import { getAppConfig } from '../config/app.config';

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private redisClient: Redis | null = null;
  private redisReady = false;
  private readonly defaultTTL = 3600; // 1 heure

  constructor(@Optional() private configService?: ConfigService) {
    // L'initialisation se fera dans onModuleInit
  }

  async onModuleInit() {
    await this.initializeRedis();
    await this.waitForRedis();
  }

  private async waitForRedis(): Promise<void> {
    if (this.redisReady) {
      this.logger.log('Redis déjà prêt');
      return;
    }

    if (!this.redisClient) {
      this.logger.error('RedisClient non initialisé');
      return;
    }

    // Vérifier si Redis est déjà connecté
    if (
      this.redisClient.status === 'ready' ||
      this.redisClient.status === 'connect'
    ) {
      this.redisReady = true;
      this.logger.log(
        `Redis déjà connecté (status: ${this.redisClient.status})`,
      );
      return;
    }

    // 🚀 LCP OPTIMIZATION: Timeout réduit à 2s pour éviter blocage
    try {
      await once(this.redisClient, 'ready', {
        signal: AbortSignal.timeout(2000),
      });
      this.redisReady = true;
      this.logger.log('Redis prêt et disponible');
    } catch {
      this.logger.warn('Redis not ready after 2s, continuing anyway');
      this.redisReady = true;
    }
  }

  private async initializeRedis() {
    try {
      // Context7 : Resilient configuration loading
      const appConfig = getAppConfig();
      let redisUrl: string;

      if (this.configService) {
        this.logger.log('Utilisation ConfigService');
        redisUrl =
          this.configService.get<string>('REDIS_URL') ||
          `redis://${appConfig.redis.host}:${appConfig.redis.port}`;
      } else {
        this.logger.log('Utilisation AppConfig (fallback Context7)');
        redisUrl =
          appConfig.redis.url ||
          `redis://${appConfig.redis.host}:${appConfig.redis.port}`;
      }

      this.logger.log(`Initialisation Redis avec URL: ${redisUrl}`);

      this.redisClient = new Redis(redisUrl);

      this.redisClient.on('error', (err: any) => {
        this.logger.error(`Redis Client Error: ${err}`);
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Cache Redis connecté');
      });

      this.redisClient.on('ready', () => {
        this.redisReady = true;
        this.logger.log('Cache Redis prêt (via event ready)');
      });

      // Vérifier la connexion après un court délai
      setTimeout(() => {
        if (
          this.redisClient &&
          (this.redisClient.status === 'ready' ||
            this.redisClient.status === 'connect')
        ) {
          this.redisReady = true;
          this.logger.log('Cache Redis connecté (status check)');
        }
      }, 100);
    } catch (error) {
      this.logger.error(`Erreur de connexion Redis Cache: ${error}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.redisClient || !this.redisReady) {
        this.logger.warn(`Redis not ready for GET ${key}`);
        return null;
      }

      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Cache GET ${key} error: ${error}`);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttl: number = this.defaultTTL,
  ): Promise<void> {
    try {
      if (!this.redisClient || !this.redisReady) {
        this.logger.error(`Redis non prêt pour SET ${key}`);
        return;
      }

      const result = await this.redisClient.setex(
        key,
        ttl,
        JSON.stringify(value),
      );
      this.logger.log(`Redis SET ${key} = ${result} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`Cache SET ${key} error: ${error}`);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.redisClient) return;

      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Cache delete error: ${error}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.redisClient) return false;

      return (await this.redisClient.exists(key)) === 1;
    } catch (error) {
      this.logger.error(`Cache exists error: ${error}`);
      return false;
    }
  }

  async setResetToken(
    token: string,
    email: string,
    ttl: number = 3600,
  ): Promise<void> {
    const tokenKey = `reset_token:${token}`;
    const tokenData = {
      email,
      expires: new Date(Date.now() + ttl * 1000).toISOString(),
      used: false,
    };

    await this.set(tokenKey, tokenData, ttl);
  }

  async getResetToken(
    token: string,
  ): Promise<{ email: string; expires: string; used: boolean } | null> {
    const tokenKey = `reset_token:${token}`;
    return await this.get(tokenKey);
  }

  async markTokenAsUsed(token: string): Promise<void> {
    const tokenKey = `reset_token:${token}`;
    const tokenData = await this.get<{
      email: string;
      expires: string;
      used: boolean;
    }>(tokenKey);

    if (tokenData) {
      tokenData.used = true;
      await this.set(tokenKey, tokenData, 3600); // Garder 1h pour éviter la réutilisation
    }
  }

  async cacheUser(
    userId: string,
    user: any,
    ttl: number = 1800,
  ): Promise<void> {
    const userKey = `user:${userId}`;
    await this.set(userKey, user, ttl);
  }

  async getCachedUser(userId: string): Promise<any | null> {
    const userKey = `user:${userId}`;
    return await this.get(userKey);
  }

  async invalidateUser(userId: string): Promise<void> {
    const userKey = `user:${userId}`;
    await this.del(userKey);
  }

  async incrementLoginAttempts(email: string): Promise<number> {
    const key = `login_attempts:${email}`;
    const current = (await this.get<number>(key)) || 0;
    const newCount = current + 1;
    await this.set(key, newCount, 900); // 15 minutes
    return newCount;
  }

  async getLoginAttempts(email: string): Promise<number> {
    const key = `login_attempts:${email}`;
    return (await this.get<number>(key)) || 0;
  }

  async clearLoginAttempts(email: string): Promise<void> {
    const key = `login_attempts:${email}`;
    await this.del(key);
  }

  /**
   * 🧹 Clear cache by pattern (for sitemap invalidation)
   */
  async clearByPattern(pattern: string): Promise<number> {
    try {
      if (!this.redisClient || !this.redisReady) {
        this.logger.warn(`Redis not ready for clearByPattern ${pattern}`);
        return 0;
      }

      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        this.logger.log(
          `Cleared ${keys.length} cache entries matching: ${pattern}`,
        );
      }
      return keys.length;
    } catch (error) {
      this.logger.error(`Cache clearByPattern ${pattern} error: ${error}`);
      return 0;
    }
  }
}
