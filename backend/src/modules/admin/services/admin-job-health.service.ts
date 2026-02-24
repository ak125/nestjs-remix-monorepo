import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface JobHealthRow {
  queue_name: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  total_completed: number;
  total_failed: number;
  avg_duration_ms: number | null;
  updated_at: string;
}

@Injectable()
export class AdminJobHealthService extends SupabaseBaseService {
  protected override readonly logger = new Logger(AdminJobHealthService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Record a successful job completion.
   * Updates lastSuccess, increments totalCompleted, resets consecutiveFailures,
   * and computes a running average duration.
   */
  async recordSuccess(queueName: string, durationMs: number): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('__admin_job_health_success', {
        p_queue: queueName,
        p_duration_ms: durationMs,
      });

      // Fallback to raw SQL if RPC doesn't exist yet
      if (error) {
        await this.recordSuccessFallback(queueName, durationMs);
      }
    } catch {
      await this.recordSuccessFallback(queueName, durationMs);
    }
  }

  private async recordSuccessFallback(
    queueName: string,
    durationMs: number,
  ): Promise<void> {
    try {
      // Read current row
      const { data: current } = await this.supabase
        .from('__admin_job_health')
        .select('total_completed, avg_duration_ms')
        .eq('queue_name', queueName)
        .single();

      const totalCompleted = (current?.total_completed ?? 0) + 1;
      const prevAvg = current?.avg_duration_ms ?? durationMs;
      // Exponential moving average (weight=0.2 for new value)
      const newAvg = Math.round(prevAvg * 0.8 + durationMs * 0.2);

      const { error } = await this.supabase
        .from('__admin_job_health')
        .update({
          last_success_at: new Date().toISOString(),
          consecutive_failures: 0,
          total_completed: totalCompleted,
          avg_duration_ms: newAvg,
          updated_at: new Date().toISOString(),
        })
        .eq('queue_name', queueName);

      if (error) {
        this.logger.error(
          `recordSuccess(${queueName}) error: ${error.message}`,
        );
      }
    } catch (err) {
      this.logger.error(`recordSuccess(${queueName}) fallback error: ${err}`);
    }
  }

  /**
   * Record a job failure.
   * Updates lastFailure, increments totalFailed + consecutiveFailures, stores error message.
   */
  async recordFailure(queueName: string, errorMessage: string): Promise<void> {
    try {
      // Read current row
      const { data: current } = await this.supabase
        .from('__admin_job_health')
        .select('consecutive_failures, total_failed')
        .eq('queue_name', queueName)
        .single();

      const consecutiveFailures = (current?.consecutive_failures ?? 0) + 1;
      const totalFailed = (current?.total_failed ?? 0) + 1;

      const { error } = await this.supabase
        .from('__admin_job_health')
        .update({
          last_failure_at: new Date().toISOString(),
          last_error: errorMessage.slice(0, 500),
          consecutive_failures: consecutiveFailures,
          total_failed: totalFailed,
          updated_at: new Date().toISOString(),
        })
        .eq('queue_name', queueName);

      if (error) {
        this.logger.error(
          `recordFailure(${queueName}) error: ${error.message}`,
        );
      }
    } catch (err) {
      this.logger.error(`recordFailure(${queueName}) error: ${err}`);
    }
  }

  /**
   * Get health status for all queues.
   */
  async getAll(): Promise<JobHealthRow[]> {
    const { data, error } = await this.supabase
      .from('__admin_job_health')
      .select('*')
      .order('queue_name');

    if (error) {
      this.logger.error(`getAll() error: ${error.message}`);
      return [];
    }

    return (data ?? []) as JobHealthRow[];
  }

  /**
   * Get health status for a specific queue.
   */
  async getByQueue(queueName: string): Promise<JobHealthRow | null> {
    const { data, error } = await this.supabase
      .from('__admin_job_health')
      .select('*')
      .eq('queue_name', queueName)
      .single();

    if (error) {
      this.logger.error(`getByQueue(${queueName}) error: ${error.message}`);
      return null;
    }

    return data as JobHealthRow;
  }
}
