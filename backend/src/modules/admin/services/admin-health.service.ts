import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';
import { AdminJobHealthService } from './admin-job-health.service';
import type { JobHealthRow } from './admin-job-health.service';

type ComponentStatus = 'healthy' | 'degraded' | 'down';

interface DatabaseHealth {
  status: ComponentStatus;
  responseMs: number;
  lastCheck: string;
}

interface RedisHealth {
  status: ComponentStatus;
  pingMs: number | null;
  lastCheck: string;
}

interface BullmqQueueHealth {
  status: ComponentStatus;
  lastSuccess: string | null;
  lastFailure: string | null;
  consecutiveFailures: number;
  totalCompleted: number;
  totalFailed: number;
  avgDurationMs: number | null;
}

interface MemoryHealth {
  status: ComponentStatus;
  usedMb: number;
  totalMb: number;
  percentage: number;
}

export interface HealthOverview {
  overall: ComponentStatus;
  components: {
    database: DatabaseHealth;
    redis: RedisHealth;
    bullmq: Record<string, BullmqQueueHealth>;
    memory: MemoryHealth;
  };
  uptime: number;
  timestamp: string;
}

@Injectable()
export class AdminHealthService {
  private readonly logger = new Logger(AdminHealthService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly jobHealthService: AdminJobHealthService,
  ) {}

  async getOverview(): Promise<HealthOverview> {
    const [dbHealth, redisHealth, jobRows, memHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.jobHealthService.getAll(),
      this.checkMemory(),
    ]);

    const bullmq = this.buildBullmqHealth(jobRows);

    const overall = this.computeOverall(
      dbHealth,
      redisHealth,
      bullmq,
      memHealth,
    );

    return {
      overall,
      components: {
        database: dbHealth,
        redis: redisHealth,
        bullmq,
        memory: memHealth,
      },
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<DatabaseHealth> {
    const start = Date.now();
    try {
      // Simple connectivity check using CacheService's Supabase (we reuse the same pattern)
      // We'll use a lightweight fetch to the Supabase health endpoint
      const { createClient } = await import('@supabase/supabase-js');
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        return {
          status: 'down',
          responseMs: Date.now() - start,
          lastCheck: new Date().toISOString(),
        };
      }
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client
        .from('xtr_customer')
        .select('cst_id')
        .limit(1);

      return {
        status: error ? 'down' : 'healthy',
        responseMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'down',
        responseMs: Date.now() - start,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private async checkRedis(): Promise<RedisHealth> {
    try {
      const health = await this.cacheService.getRedisHealth();
      return {
        status: health.status === 'healthy' ? 'healthy' : 'down',
        pingMs: health.pingMs,
        lastCheck: health.lastCheck,
      };
    } catch {
      return {
        status: 'down',
        pingMs: null,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  private buildBullmqHealth(
    rows: JobHealthRow[],
  ): Record<string, BullmqQueueHealth> {
    const result: Record<string, BullmqQueueHealth> = {};
    for (const row of rows) {
      let status: ComponentStatus = 'healthy';
      if (row.consecutive_failures >= 3) {
        status = 'degraded';
      }
      if (row.consecutive_failures >= 10) {
        status = 'down';
      }

      result[row.queue_name] = {
        status,
        lastSuccess: row.last_success_at,
        lastFailure: row.last_failure_at,
        consecutiveFailures: row.consecutive_failures,
        totalCompleted: row.total_completed,
        totalFailed: row.total_failed,
        avgDurationMs: row.avg_duration_ms,
      };
    }
    return result;
  }

  private checkMemory(): MemoryHealth {
    const mem = process.memoryUsage();
    const usedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const totalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const percentage = Math.round((usedMb / totalMb) * 1000) / 10;

    let status: ComponentStatus = 'healthy';
    if (percentage > 90) {
      status = 'down';
    } else if (percentage > 80) {
      status = 'degraded';
    }

    return { status, usedMb, totalMb, percentage };
  }

  private computeOverall(
    db: DatabaseHealth,
    redis: RedisHealth,
    bullmq: Record<string, BullmqQueueHealth>,
    memory: MemoryHealth,
  ): ComponentStatus {
    // down if database or redis is down
    if (db.status === 'down' || redis.status === 'down') {
      return 'down';
    }

    // degraded if any component is degraded
    if (db.status === 'degraded' || redis.status === 'degraded') {
      return 'degraded';
    }
    if (memory.status === 'degraded' || memory.status === 'down') {
      return 'degraded';
    }

    const queueStatuses = Object.values(bullmq);
    if (queueStatuses.some((q) => q.status === 'down')) {
      return 'degraded';
    }
    if (queueStatuses.some((q) => q.status === 'degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }
}
