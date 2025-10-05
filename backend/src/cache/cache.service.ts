import { Injectable, Optional, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getAppConfig } from '../config/app.config';

@Injectable()
export class CacheService implements OnModuleInit {
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
    return new Promise((resolve) => {
      if (this.redisReady) {
        console.log('✅ Redis déjà prêt');
        resolve();
        return;
      }

      if (!this.redisClient) {
        console.error('❌ RedisClient non initialisé');
        resolve();
        return;
      }

      this.redisClient.once('ready', () => {
        this.redisReady = true;
        console.log('✅ Redis prêt et disponible');
        resolve();
      });

      // Timeout 5s
      setTimeout(() => {
        console.warn('⚠️ Redis non prêt après 5s, continue quand même');
        this.redisReady = true; // Force ready pour ne pas bloquer
        resolve();
      }, 5000);
    });
  }

  private async initializeRedis() {
    try {
      // Context7 : Resilient configuration loading
      const appConfig = getAppConfig();
      let redisUrl: string;

      if (this.configService) {
        console.log('🔧 CacheService: Utilisation ConfigService');
        redisUrl =
          this.configService.get<string>('REDIS_URL') ||
          `redis://${appConfig.redis.host}:${appConfig.redis.port}`;
      } else {
        console.log(
          '🔧 CacheService: Utilisation AppConfig (fallback Context7)',
        );
        redisUrl =
          appConfig.redis.url ||
          `redis://${appConfig.redis.host}:${appConfig.redis.port}`;
      }

      console.log('🔧 Initialisation Redis avec URL:', redisUrl);

      this.redisClient = new Redis(redisUrl);

      this.redisClient.on('error', (err: any) => {
        console.error('Redis Client Error:', err);
      });

      this.redisClient.on('connect', () => {
        console.log('✅ Cache Redis connecté');
      });

      this.redisClient.on('ready', () => {
        this.redisReady = true;
        console.log('✅ Cache Redis prêt');
      });
    } catch (error) {
      console.error('❌ Erreur de connexion Redis Cache:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.redisClient || !this.redisReady) {
        console.warn(`⚠️ Redis non prêt pour GET ${key}`);
        return null;
      }

      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`❌ Cache GET ${key} error:`, error);
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
        console.error(`❌ Redis non prêt pour SET ${key}`);
        return;
      }

      const result = await this.redisClient.setex(key, ttl, JSON.stringify(value));
      console.log(`✅ Redis SET ${key} = ${result} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`❌ Cache SET ${key} error:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!this.redisClient) return;

      await this.redisClient.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.redisClient) return false;

      return (await this.redisClient.exists(key)) === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
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
}
