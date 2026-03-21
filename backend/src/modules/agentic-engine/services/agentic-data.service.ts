/**
 * AgenticDataService — Supabase CRUD for __agentic_* tables
 *
 * Pattern: extends SupabaseBaseService (like DiagnosticEngineDataService)
 * No business logic — pure data access.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type {
  AgenticRun,
  CreateRunInput,
  AgenticBranch,
  AgenticStep,
  AgenticEvidence,
  AgenticCheckpoint,
  AgenticGateResult,
} from '../types/run-state.schema';
import type { RunPhase, BranchStatus } from '../constants/agentic.constants';

@Injectable()
export class AgenticDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(AgenticDataService.name);

  // ── Runs ──

  async createRun(input: CreateRunInput): Promise<AgenticRun | null> {
    const { data, error } = await this.supabase
      .from('__agentic_runs')
      .insert({
        goal: input.goal,
        goal_type: input.goal_type,
        triggered_by: input.triggered_by,
        correlation_id: input.correlation_id ?? null,
        feature_flags: input.feature_flags ?? {},
        phase: 'created',
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error('Failed to create run', error.message);
      return null;
    }
    return data;
  }

  async getRun(runId: string): Promise<AgenticRun | null> {
    const { data, error } = await this.supabase
      .from('__agentic_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error) return null;
    return data;
  }

  async updateRunPhase(
    runId: string,
    fromPhase: RunPhase,
    toPhase: RunPhase,
    extra?: Partial<AgenticRun>,
  ): Promise<boolean> {
    // Atomic transition: only update if current phase matches
    const updatePayload: Record<string, unknown> = {
      phase: toPhase,
      updated_at: new Date().toISOString(),
      ...extra,
    };

    if (toPhase === 'completed' || toPhase === 'failed') {
      updatePayload.completed_at = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('__agentic_runs')
      .update(updatePayload)
      .eq('id', runId)
      .eq('phase', fromPhase)
      .select('id')
      .single();

    if (error || !data) {
      this.logger.warn(
        `Phase transition failed: ${runId} ${fromPhase}→${toPhase}`,
        error?.message,
      );
      return false;
    }
    return true;
  }

  async incrementBranchesCompleted(
    runId: string,
  ): Promise<{ branches_completed: number; branches_total: number } | null> {
    // Atomic increment via RPC (SQL UPDATE ... RETURNING) — no race condition
    const { data, error } = await this.callRpc<
      { branches_completed: number; branches_total: number }[]
    >('agentic_increment_branches_completed', { p_run_id: runId });

    if (error || !data || data.length === 0) {
      this.logger.warn(
        `Failed to increment branches_completed for run ${runId}`,
        error?.message,
      );
      return null;
    }

    return data[0] as { branches_completed: number; branches_total: number };
  }

  async getDailyTokenUsage(goalType: string): Promise<number> {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data, error } = await this.supabase
      .from('__agentic_runs')
      .select('total_tokens_used')
      .eq('goal_type', goalType)
      .gte('created_at', since);

    if (error || !data) return 0;
    return data.reduce((sum, r) => sum + (r.total_tokens_used || 0), 0);
  }

  async getRecentRunPhases(limit: number): Promise<Array<{ phase: string }>> {
    const { data, error } = await this.supabase
      .from('__agentic_runs')
      .select('phase')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data;
  }

  async listRuns(limit = 20, goalType?: string): Promise<AgenticRun[]> {
    let query = this.supabase
      .from('__agentic_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (goalType) {
      query = query.eq('goal_type', goalType);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.warn('Failed to list runs', error.message);
      return [];
    }
    return data || [];
  }

  // ── Branches ──

  async createBranch(
    runId: string,
    strategyLabel: string,
  ): Promise<AgenticBranch | null> {
    const { data, error } = await this.supabase
      .from('__agentic_branches')
      .insert({
        run_id: runId,
        strategy_label: strategyLabel,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error('Failed to create branch', error.message);
      return null;
    }
    return data;
  }

  async updateBranchStatus(
    branchId: string,
    status: BranchStatus,
    extra?: Partial<AgenticBranch>,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('__agentic_branches')
      .update({ status, ...extra })
      .eq('id', branchId);

    if (error) {
      this.logger.warn(`Failed to update branch ${branchId}`, error.message);
      return false;
    }
    return true;
  }

  async getBranchesByRun(runId: string): Promise<AgenticBranch[]> {
    const { data, error } = await this.supabase
      .from('__agentic_branches')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return data || [];
  }

  // ── Steps ──

  async createStep(step: {
    branch_id: string;
    run_id: string;
    step_name: string;
    step_type: string;
    step_index: number;
  }): Promise<AgenticStep | null> {
    const { data, error } = await this.supabase
      .from('__agentic_steps')
      .insert({ ...step, status: 'pending' })
      .select('*')
      .single();

    if (error) {
      this.logger.error('Failed to create step', error.message);
      return null;
    }
    return data;
  }

  async updateStep(
    stepId: string,
    update: Partial<AgenticStep>,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('__agentic_steps')
      .update(update)
      .eq('id', stepId);

    if (error) {
      this.logger.warn(`Failed to update step ${stepId}`, error.message);
      return false;
    }
    return true;
  }

  async getStepsByBranch(branchId: string): Promise<AgenticStep[]> {
    const { data, error } = await this.supabase
      .from('__agentic_steps')
      .select('*')
      .eq('branch_id', branchId)
      .order('step_index', { ascending: true });

    if (error) return [];
    return data || [];
  }

  // ── Evidence ──

  async insertEvidence(evidence: {
    run_id: string;
    branch_id?: string;
    step_id?: string;
    evidence_type: string;
    content: Record<string, unknown>;
    provenance: { source: string; truth_level?: string; timestamp: string };
  }): Promise<AgenticEvidence | null> {
    const { data, error } = await this.supabase
      .from('__agentic_evidence')
      .insert(evidence)
      .select('*')
      .single();

    if (error) {
      this.logger.error('Failed to insert evidence', error.message);
      return null;
    }
    return data;
  }

  async getEvidenceByRun(runId: string): Promise<AgenticEvidence[]> {
    const { data, error } = await this.supabase
      .from('__agentic_evidence')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true });

    if (error) return [];
    return data || [];
  }

  // ── Checkpoints ──

  async saveCheckpoint(checkpoint: {
    run_id: string;
    phase: string;
    snapshot: Record<string, unknown>;
  }): Promise<AgenticCheckpoint | null> {
    const { data, error } = await this.supabase
      .from('__agentic_checkpoints')
      .insert(checkpoint)
      .select('*')
      .single();

    if (error) {
      this.logger.error('Failed to save checkpoint', error.message);
      return null;
    }
    return data;
  }

  async getLatestCheckpoint(runId: string): Promise<AgenticCheckpoint | null> {
    const { data, error } = await this.supabase
      .from('__agentic_checkpoints')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data;
  }

  // ── Gate Results ──

  async insertGateResult(gate: {
    run_id: string;
    gate_name: string;
    gate_type: string;
    verdict: string;
    reason: string;
    evidence_id?: string;
  }): Promise<AgenticGateResult | null> {
    const { data, error } = await this.supabase
      .from('__agentic_gate_results')
      .insert(gate)
      .select('*')
      .single();

    if (error) {
      this.logger.error('Failed to insert gate result', error.message);
      return null;
    }
    return data;
  }

  async getGateResultsByRun(runId: string): Promise<AgenticGateResult[]> {
    const { data, error } = await this.supabase
      .from('__agentic_gate_results')
      .select('*')
      .eq('run_id', runId)
      .order('checked_at', { ascending: true });

    if (error) return [];
    return data || [];
  }

  // ── Run Extra Updates ──

  async updateRunExtra(
    runId: string,
    extra: Partial<AgenticRun>,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('__agentic_runs')
      .update({ ...extra, updated_at: new Date().toISOString() })
      .eq('id', runId);

    if (error) {
      this.logger.warn(`Failed to update run extra ${runId}`, error.message);
      return false;
    }
    return true;
  }

  async updateGateVerdict(
    runId: string,
    gateName: string,
    verdict: string,
    reason: string,
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('__agentic_gate_results')
      .update({ verdict, reason })
      .eq('run_id', runId)
      .eq('gate_name', gateName);

    if (error) {
      this.logger.warn(`Failed to update gate ${gateName}`, error.message);
      return false;
    }
    return true;
  }

  // ── Stats (admin dashboard) ──

  // ── Chain Rules ──

  async getChainRules(fromGoalType: string): Promise<
    Array<{
      id: string;
      to_goal_type: string;
      condition: { min_score?: number };
      priority: number;
      description: string | null;
    }>
  > {
    const { data, error } = await this.supabase
      .from('__agentic_chain_rules')
      .select('id, to_goal_type, condition, priority, description')
      .eq('from_goal_type', fromGoalType)
      .eq('enabled', true)
      .order('priority', { ascending: true });

    if (error) {
      this.logger.error('Failed to get chain rules', error.message);
      return [];
    }
    return data || [];
  }

  async getStats(): Promise<{
    total_runs: number;
    runs_by_phase: Array<{ phase: string; count: number }>;
    runs_by_goal_type: Array<{ goal_type: string; count: number }>;
    total_evidence: number;
    total_gate_results: number;
  }> {
    const [runsRes, evidenceRes, gatesRes] = await Promise.all([
      this.supabase
        .from('__agentic_runs')
        .select('id', { count: 'exact', head: true }),
      this.supabase
        .from('__agentic_evidence')
        .select('id', { count: 'exact', head: true }),
      this.supabase
        .from('__agentic_gate_results')
        .select('id', { count: 'exact', head: true }),
    ]);

    // Group by phase and goal_type from recent runs
    const { data: recent } = await this.supabase
      .from('__agentic_runs')
      .select('phase, goal_type')
      .order('created_at', { ascending: false })
      .limit(500);

    const byPhase = new Map<string, number>();
    const byGoalType = new Map<string, number>();
    for (const r of recent || []) {
      byPhase.set(r.phase, (byPhase.get(r.phase) || 0) + 1);
      byGoalType.set(r.goal_type, (byGoalType.get(r.goal_type) || 0) + 1);
    }

    return {
      total_runs: runsRes.count || 0,
      runs_by_phase: Array.from(byPhase.entries())
        .map(([phase, count]) => ({ phase, count }))
        .sort((a, b) => b.count - a.count),
      runs_by_goal_type: Array.from(byGoalType.entries())
        .map(([goal_type, count]) => ({ goal_type, count }))
        .sort((a, b) => b.count - a.count),
      total_evidence: evidenceRes.count || 0,
      total_gate_results: gatesRes.count || 0,
    };
  }
}
