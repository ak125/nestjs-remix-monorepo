import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseException, ErrorCodes } from '@common/exceptions';
import { getEffectiveSupabaseKey } from '@common/utils';

export interface CrawlBudgetExperiment {
  id: string;
  name: string;
  description?: string;
  action: 'exclude' | 'include' | 'reduce';
  target_families: string[];
  reduction_percent?: number;
  duration_days: number;
  status: 'draft' | 'running' | 'paused' | 'completed';
  baseline?: any;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CrawlBudgetMetric {
  id: string;
  experiment_id: string;
  date: string;
  total_crawled_urls: number;
  crawl_requests_count: number;
  avg_crawl_rate: number;
  indexed_urls: number;
  indexation_rate: number;
  organic_sessions?: number;
  organic_conversions?: number;
  family_metrics?: any;
  created_at: string;
}

/**
 * 🗄️ Service Supabase pour le Crawl Budget A/B Testing
 */
@Injectable()
export class CrawlBudgetSupabaseService {
  private readonly logger = new Logger(CrawlBudgetSupabaseService.name);
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const supabaseKey = getEffectiveSupabaseKey();

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        '⚠️ SUPABASE_URL or Supabase key not set — CrawlBudgetSupabaseService disabled',
      );
    }

    this.supabase = createClient(supabaseUrl || '', supabaseKey);
  }

  /**
   * 🆕 Créer une expérience
   */
  async createExperiment(
    data: Omit<
      CrawlBudgetExperiment,
      'id' | 'created_at' | 'updated_at' | 'status'
    >,
  ): Promise<CrawlBudgetExperiment> {
    const { data: experiment, error } = await this.supabase
      .from('crawl_budget_experiments')
      .insert({
        name: data.name,
        description: data.description,
        action: data.action,
        target_families: data.target_families,
        reduction_percent: data.reduction_percent,
        duration_days: data.duration_days,
        baseline: data.baseline,
      })
      .select()
      .single();

    if (error) {
      this.logger.error('❌ Failed to create experiment:', error);
      throw new DatabaseException({
        code: ErrorCodes.SEO.AUDIT_FAILED,
        message: `Failed to create experiment: ${error.message}`,
        details: error.message,
        cause: error as unknown as Error,
      });
    }

    this.logger.log(`✅ Experiment created: ${experiment.id}`);
    return experiment;
  }

  /**
   * 📋 Liste des expériences
   */
  async listExperiments(filters?: {
    status?: string;
    limit?: number;
  }): Promise<CrawlBudgetExperiment[]> {
    let query = this.supabase
      .from('crawl_budget_experiments')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error('❌ Failed to list experiments:', error);
      throw new DatabaseException({
        code: ErrorCodes.SEO.AUDIT_FAILED,
        message: `Failed to list experiments: ${error.message}`,
        details: error.message,
        cause: error as unknown as Error,
      });
    }

    return data || [];
  }

  /**
   * 🔍 Récupérer une expérience
   */
  async getExperiment(id: string): Promise<CrawlBudgetExperiment | null> {
    const { data, error } = await this.supabase
      .from('crawl_budget_experiments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      this.logger.error(`❌ Failed to get experiment ${id}:`, error);
      return null;
    }

    return data;
  }

  /**
   * 🔄 Mettre à jour le statut
   */
  async updateStatus(
    id: string,
    status: 'draft' | 'running' | 'paused' | 'completed',
  ): Promise<CrawlBudgetExperiment> {
    const updates: any = { status };

    if (status === 'running') {
      updates.started_at = new Date().toISOString();
    }

    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('crawl_budget_experiments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new DatabaseException({
        code: ErrorCodes.DATABASE.OPERATION_FAILED,
        message: `Failed to update status: ${error.message}`,
        details: error.message,
        cause: error as unknown as Error,
      });
    }

    return data;
  }

  /**
   * 📊 Ajouter une métrique quotidienne
   */
  async addMetric(
    metric: Omit<CrawlBudgetMetric, 'id' | 'created_at'>,
  ): Promise<CrawlBudgetMetric> {
    const { data, error } = await this.supabase
      .from('crawl_budget_metrics')
      .insert(metric)
      .select()
      .single();

    if (error) {
      this.logger.error('❌ Failed to add metric:', error);
      throw new DatabaseException({
        code: ErrorCodes.SEO.AUDIT_FAILED,
        message: `Failed to add metric: ${error.message}`,
        details: error.message,
        cause: error as unknown as Error,
      });
    }

    return data;
  }

  /**
   * 📈 Récupérer les métriques d'une expérience
   */
  async getMetrics(
    experimentId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<CrawlBudgetMetric[]> {
    let query = this.supabase
      .from('crawl_budget_metrics')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('date', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseException({
        code: ErrorCodes.SEO.AUDIT_FAILED,
        message: `Failed to get metrics: ${error.message}`,
        details: error.message,
        cause: error as unknown as Error,
      });
    }

    return data || [];
  }

  /**
   * 🗑️ Supprimer une expérience
   */
  async deleteExperiment(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('crawl_budget_experiments')
      .delete()
      .eq('id', id);

    if (error) {
      throw new DatabaseException({
        code: ErrorCodes.DATABASE.OPERATION_FAILED,
        message: `Failed to delete experiment: ${error.message}`,
        details: error.message,
        cause: error as unknown as Error,
      });
    }

    this.logger.log(`🗑️ Experiment ${id} deleted`);
  }

  /**
   * 📊 Statistiques globales
   */
  async getStats(): Promise<{
    total: number;
    running: number;
    completed: number;
    draft: number;
  }> {
    const { data, error } = await this.supabase
      .from('crawl_budget_experiments')
      .select('status');

    if (error) {
      throw new DatabaseException({
        code: ErrorCodes.SEO.AUDIT_FAILED,
        message: `Failed to get stats: ${error.message}`,
        details: error.message,
        cause: error as unknown as Error,
      });
    }

    const stats = {
      total: data?.length || 0,
      running: data?.filter((e) => e.status === 'running').length || 0,
      completed: data?.filter((e) => e.status === 'completed').length || 0,
      draft: data?.filter((e) => e.status === 'draft').length || 0,
    };

    return stats;
  }
}
