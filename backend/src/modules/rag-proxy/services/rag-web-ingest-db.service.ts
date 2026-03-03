import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type { WebJob } from './rag-redis-job.service';

export interface RagWebIngestJobRow {
  job_id: string;
  url: string;
  truth_level: string;
  status: string;
  return_code: number | null;
  error_message: string | null;
  log_lines: string[] | null;
  gammes_detected: string[] | null;
  started_at: string;
  finished_at: string | null;
}

@Injectable()
export class RagWebIngestDbService extends SupabaseBaseService {
  protected override readonly logger = new Logger(RagWebIngestDbService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /** Upsert a web ingest job record (fire-and-forget safe). */
  async upsertJob(job: WebJob, gammesDetected?: string[]): Promise<void> {
    const errorMessage = this.extractErrorMessage(job.logLines);
    const { error } = await this.supabase.from('__rag_web_ingest_jobs').upsert(
      {
        job_id: job.jobId,
        url: job.url,
        truth_level: job.truthLevel,
        status: job.status,
        return_code: job.returnCode,
        error_message: errorMessage,
        log_lines: job.logLines,
        gammes_detected: gammesDetected ?? null,
        started_at: new Date(job.startedAt * 1000).toISOString(),
        finished_at: job.finishedAt
          ? new Date(job.finishedAt * 1000).toISOString()
          : null,
      },
      { onConflict: 'job_id' },
    );

    if (error) {
      this.logger.warn(
        `DB upsert failed for job ${job.jobId}: ${error.message}`,
      );
    }
  }

  /** List recent jobs (compact, no log_lines) for the admin table. */
  async listJobs(limit = 50): Promise<RagWebIngestJobRow[]> {
    const { data, error } = await this.supabase
      .from('__rag_web_ingest_jobs')
      .select(
        'job_id, url, truth_level, status, return_code, error_message, gammes_detected, started_at, finished_at',
      )
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.warn(`DB list failed: ${error.message}`);
      return [];
    }
    return (data as RagWebIngestJobRow[]) || [];
  }

  /** Get a single job including full log_lines (for detail page). */
  async getJob(jobId: string): Promise<RagWebIngestJobRow | null> {
    const { data, error } = await this.supabase
      .from('__rag_web_ingest_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (error) return null;
    return data as RagWebIngestJobRow;
  }

  private extractErrorMessage(logLines: string[]): string | null {
    // Find the most informative error line
    const errorLine = logLines.find(
      (l) =>
        l.startsWith('Error:') ||
        l.includes('exit code') ||
        l.includes('[stderr]') ||
        l.startsWith('Step '),
    );
    if (errorLine) return errorLine.slice(0, 500);

    // Fallback: last non-empty line for failed jobs
    for (let i = logLines.length - 1; i >= 0; i--) {
      if (logLines[i].trim()) return logLines[i].slice(0, 500);
    }
    return null;
  }
}
