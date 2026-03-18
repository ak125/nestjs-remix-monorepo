/**
 * WriteGuardLockService — P1.5 Write Ownership & Collision Guard
 *
 * Distributed Redis lock per (pgId, resourceGroup).
 * - Acquisition: deterministic order, all-or-nothing (rollback on partial failure)
 * - Release: Lua atomic script (safe release only if token matches)
 * - TTL: 30s (lock is acquired LATE, just before write — not at job start)
 * - Fallback: observe mode → in-memory Set; enforce mode → fail-safe held
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type {
  ResourceGroup,
  WriteLockHandle,
} from './execution-registry.types';
import type { RoleId } from './role-ids';

const DEFAULT_TTL_MS = 30_000;

/** Lua script: atomic release only if token matches */
const RELEASE_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

@Injectable()
export class WriteGuardLockService {
  private readonly logger = new Logger(WriteGuardLockService.name);
  private redis: import('ioredis').default | null = null;

  /** In-memory fallback (observe mode only, single-instance) */
  private readonly inMemoryLocks = new Set<string>();

  constructor(private readonly config: ConfigService) {
    this.initRedis();
  }

  private initRedis(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis');
      const host = this.config.get<string>('REDIS_HOST') || 'localhost';
      const port = this.config.get<number>('REDIS_PORT') || 6379;
      this.redis = new Redis({
        host,
        port,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      this.redis.connect().catch((err: Error) => {
        this.logger.warn(
          `WriteGuardLock: Redis connection failed, will use fallback: ${err.message}`,
        );
        this.redis = null;
      });
    } catch {
      this.logger.warn(
        'WriteGuardLock: ioredis not available, using in-memory fallback',
      );
      this.redis = null;
    }
  }

  /**
   * Acquire locks for all resource groups (deterministic order, all-or-nothing).
   * Returns null if any lock cannot be acquired.
   */
  async acquireAll(
    pgId: number,
    groups: ResourceGroup[],
    roleId: RoleId,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<WriteLockHandle[] | null> {
    if (groups.length === 0) return [];

    // Sort alphabetically for deterministic order (avoids deadlocks)
    const sorted = [...groups].sort();
    const token = randomUUID();
    const acquired: WriteLockHandle[] = [];

    for (const group of sorted) {
      const key = `wg:lock:${pgId}:${group}`;
      const value = `${token}:${roleId}`;
      const ok = await this.tryAcquire(key, value, ttlMs);

      if (ok) {
        acquired.push({ key, token: value, resourceGroup: group });
      } else {
        // Rollback all previously acquired locks
        this.logger.warn(
          `WriteGuardLock: failed to acquire lock ${key}, rolling back ${acquired.length} locks`,
        );
        await this.releaseAll(acquired);
        return null;
      }
    }

    return acquired;
  }

  /** Release all lock handles */
  async releaseAll(handles: WriteLockHandle[]): Promise<void> {
    for (const handle of handles) {
      await this.tryRelease(handle.key, handle.token);
    }
  }

  /** Check if a resource group is currently locked for a pgId */
  async isLocked(pgId: number, group: ResourceGroup): Promise<boolean> {
    const key = `wg:lock:${pgId}:${group}`;
    if (this.redis) {
      try {
        const val = await this.redis.get(key);
        return val !== null;
      } catch {
        return this.inMemoryLocks.has(key);
      }
    }
    return this.inMemoryLocks.has(key);
  }

  /** Returns true if Redis is available */
  get redisAvailable(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
  }

  // ── Private helpers ──

  private async tryAcquire(
    key: string,
    value: string,
    ttlMs: number,
  ): Promise<boolean> {
    if (this.redis) {
      try {
        const result = await this.redis.set(key, value, 'PX', ttlMs, 'NX');
        return result === 'OK';
      } catch (err) {
        this.logger.warn(
          `WriteGuardLock: Redis SET NX failed for ${key}: ${(err as Error).message}`,
        );
        // Fallback to in-memory only in observe mode (caller checks)
        return this.tryAcquireInMemory(key);
      }
    }
    return this.tryAcquireInMemory(key);
  }

  private tryAcquireInMemory(key: string): boolean {
    if (this.inMemoryLocks.has(key)) return false;
    this.inMemoryLocks.add(key);
    // Auto-expire after 30s to prevent leaks
    setTimeout(() => this.inMemoryLocks.delete(key), DEFAULT_TTL_MS);
    return true;
  }

  private async tryRelease(key: string, value: string): Promise<void> {
    this.inMemoryLocks.delete(key);
    if (this.redis) {
      try {
        await this.redis.eval(RELEASE_LUA, 1, key, value);
      } catch (err) {
        this.logger.warn(
          `WriteGuardLock: Redis release failed for ${key}: ${(err as Error).message}`,
        );
      }
    }
  }
}
