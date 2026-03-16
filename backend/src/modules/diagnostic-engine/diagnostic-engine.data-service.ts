/**
 * DiagnosticEngine DataService — Couche donnees Supabase
 *
 * Lecture des tables __diag_* pour alimenter le moteur deterministe.
 * Pas de logique metier ici — juste des queries.
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

// ── DB Row types (aligned on migration schema) ──────────

export interface DiagSystem {
  id: number;
  slug: string;
  label: string;
  description: string | null;
  display_order: number;
  active: boolean;
}

export interface DiagSymptom {
  id: number;
  slug: string;
  system_id: number;
  label: string;
  description: string | null;
  signal_mode: string;
  urgency: string;
  active: boolean;
}

export interface DiagCause {
  id: number;
  slug: string;
  system_id: number;
  label: string;
  cause_type: string;
  description: string | null;
  verification_method: string | null;
  urgency: string;
  active: boolean;
}

export interface DiagSymptomCauseLink {
  id: number;
  symptom_id: number;
  cause_id: number;
  relative_score: number;
  evidence_for: string[];
  evidence_against: string[];
  requires_verification: boolean;
  active: boolean;
  // Joined fields
  cause?: DiagCause;
}

export interface DiagSafetyRule {
  id: number;
  system_id: number;
  rule_slug: string;
  condition_description: string;
  risk_flag: string;
  urgency: string;
  blocks_catalog: boolean;
  active: boolean;
}

@Injectable()
export class DiagnosticEngineDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(DiagnosticEngineDataService.name);

  /**
   * Get all active systems ordered by display_order
   */
  async getActiveSystems(): Promise<DiagSystem[]> {
    const { data, error } = await this.supabase
      .from('__diag_system')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error) {
      this.logger.warn('Failed to fetch systems', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Get system by slug
   */
  async getSystemBySlug(slug: string): Promise<DiagSystem | null> {
    const { data, error } = await this.supabase
      .from('__diag_system')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .single();

    if (error) {
      this.logger.warn(`System not found: ${slug}`, error.message);
      return null;
    }
    return data;
  }

  /**
   * Get symptom by slug
   */
  async getSymptomBySlug(slug: string): Promise<DiagSymptom | null> {
    const { data, error } = await this.supabase
      .from('__diag_symptom')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get symptoms for a system
   */
  async getSymptomsBySystem(systemSlug: string): Promise<DiagSymptom[]> {
    const system = await this.getSystemBySlug(systemSlug);
    if (!system) return [];

    const { data, error } = await this.supabase
      .from('__diag_symptom')
      .select('*')
      .eq('system_id', system.id)
      .eq('active', true)
      .order('slug');

    if (error) {
      this.logger.error(
        `Failed to fetch symptoms for ${systemSlug}`,
        error.message,
      );
      return [];
    }
    return data || [];
  }

  /**
   * Get scored causes for a symptom slug — returns links with joined cause data
   */
  async getScoredCausesForSymptom(
    symptomSlug: string,
  ): Promise<DiagSymptomCauseLink[]> {
    // Step 1: get symptom
    const symptom = await this.getSymptomBySlug(symptomSlug);
    if (!symptom) return [];

    // Step 2: get links with cause data
    const { data: links, error: linksError } = await this.supabase
      .from('__diag_symptom_cause_link')
      .select('*')
      .eq('symptom_id', symptom.id)
      .eq('active', true)
      .order('relative_score', { ascending: false });

    if (linksError || !links?.length) return [];

    // Step 3: fetch causes for these links, filtered to same system as symptom
    const causeIds = links.map((l) => l.cause_id);
    const { data: causes, error: causesError } = await this.supabase
      .from('__diag_cause')
      .select('*')
      .in('id', causeIds)
      .eq('system_id', symptom.system_id) // Guard: only same-system causes
      .eq('active', true);

    if (causesError || !causes) return links;

    // Join causes onto links (skip cross-system causes that were filtered out)
    const causeMap = new Map(causes.map((c) => [c.id, c]));
    return links
      .filter((link) => causeMap.has(link.cause_id))
      .map((link) => ({
        ...link,
        cause: causeMap.get(link.cause_id) || undefined,
      }));
  }

  /**
   * Get scored causes for multiple symptom slugs — merges and normalizes scores
   */
  async getScoredCausesForSymptoms(
    symptomSlugs: string[],
  ): Promise<DiagSymptomCauseLink[]> {
    if (!symptomSlugs.length) return [];

    // Fetch links for all symptoms
    const allLinks: DiagSymptomCauseLink[] = [];
    for (const slug of symptomSlugs) {
      const links = await this.getScoredCausesForSymptom(slug);
      allLinks.push(...links);
    }

    // Merge: if same cause appears for multiple symptoms, combine evidence and average score
    const mergedMap = new Map<number, DiagSymptomCauseLink>();
    for (const link of allLinks) {
      const existing = mergedMap.get(link.cause_id);
      if (existing) {
        // Average scores, merge evidence
        existing.relative_score = Math.round(
          (existing.relative_score + link.relative_score) / 2,
        );
        existing.evidence_for = [
          ...new Set([...existing.evidence_for, ...link.evidence_for]),
        ];
        existing.evidence_against = [
          ...new Set([...existing.evidence_against, ...link.evidence_against]),
        ];
      } else {
        mergedMap.set(link.cause_id, { ...link });
      }
    }

    // Sort by score descending
    return Array.from(mergedMap.values()).sort(
      (a, b) => b.relative_score - a.relative_score,
    );
  }

  /**
   * Get safety rules for a system
   */
  async getSafetyRules(systemSlug: string): Promise<DiagSafetyRule[]> {
    const system = await this.getSystemBySlug(systemSlug);
    if (!system) return [];

    const { data, error } = await this.supabase
      .from('__diag_safety_rule')
      .select('*')
      .eq('system_id', system.id)
      .eq('active', true)
      .order('urgency');

    if (error) {
      this.logger.error(
        `Failed to fetch safety rules for ${systemSlug}`,
        error.message,
      );
      return [];
    }
    return data || [];
  }

  /**
   * Get cost ranges for a list of pg_ids from __seo_gamme_purchase_guide
   */
  async getCostRanges(pgIds: number[]): Promise<Map<number, string>> {
    if (!pgIds.length) return new Map();
    const { data, error } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_pg_id, sgpg_risk_cost_range')
      .in('sgpg_pg_id', pgIds.map(String));

    if (error || !data) return new Map();
    const map = new Map<number, string>();
    for (const row of data) {
      if (row.sgpg_risk_cost_range) {
        map.set(Number(row.sgpg_pg_id), row.sgpg_risk_cost_range);
      }
    }
    return map;
  }

  /**
   * Save a diagnostic session
   */
  async saveSession(session: {
    intent_type: string;
    system_scope: string;
    vehicle_context: Record<string, unknown>;
    signal_input: Record<string, unknown>;
    answers: Record<string, string>;
    result: Record<string, unknown>;
  }): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('__diag_session')
      .insert(session)
      .select('id')
      .single();

    if (error) {
      this.logger.error('Failed to save session', error.message);
      return null;
    }
    return data?.id || null;
  }

  /**
   * Retrieve a single diagnostic session by UUID
   */
  async getSession(id: string): Promise<{
    id: string;
    intent_type: string;
    system_scope: string;
    vehicle_context: Record<string, unknown>;
    signal_input: Record<string, unknown>;
    result: Record<string, unknown>;
    created_at: string;
  } | null> {
    const { data, error } = await this.supabase
      .from('__diag_session')
      .select(
        'id, intent_type, system_scope, vehicle_context, signal_input, result, created_at',
      )
      .eq('id', id)
      .single();

    if (error) {
      this.logger.warn(`Session not found: ${id}`, error.message);
      return null;
    }
    return data;
  }

  /**
   * List recent diagnostic sessions (most recent first)
   */
  async listRecentSessions(limit = 20): Promise<
    Array<{
      id: string;
      system_scope: string;
      vehicle_context: Record<string, unknown>;
      created_at: string;
    }>
  > {
    const { data, error } = await this.supabase
      .from('__diag_session')
      .select('id, system_scope, vehicle_context, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.warn('Failed to list sessions', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Get diagnostic engine stats for admin dashboard
   */
  async getStats(): Promise<{
    total_sessions: number;
    sessions_by_system: Array<{ system_scope: string; count: number }>;
    systems_count: number;
    symptoms_count: number;
    causes_count: number;
    safety_rules_count: number;
  }> {
    // Run counts in parallel
    const [sessionsRes, systemsRes, symptomsRes, causesRes, rulesRes] =
      await Promise.all([
        this.supabase
          .from('__diag_session')
          .select('id', { count: 'exact', head: true }),
        this.supabase
          .from('__diag_system')
          .select('id', { count: 'exact', head: true })
          .eq('active', true),
        this.supabase
          .from('__diag_symptom')
          .select('id', { count: 'exact', head: true }),
        this.supabase
          .from('__diag_cause')
          .select('id', { count: 'exact', head: true }),
        this.supabase
          .from('__diag_safety_rule')
          .select('id', { count: 'exact', head: true }),
      ]);

    // Sessions by system (manual grouping from recent 500)
    const { data: recentSessions } = await this.supabase
      .from('__diag_session')
      .select('system_scope')
      .order('created_at', { ascending: false })
      .limit(500);

    const bySystem = new Map<string, number>();
    for (const s of recentSessions || []) {
      bySystem.set(s.system_scope, (bySystem.get(s.system_scope) || 0) + 1);
    }

    return {
      total_sessions: sessionsRes.count || 0,
      sessions_by_system: Array.from(bySystem.entries())
        .map(([system_scope, count]) => ({ system_scope, count }))
        .sort((a, b) => b.count - a.count),
      systems_count: systemsRes.count || 0,
      symptoms_count: symptomsRes.count || 0,
      causes_count: causesRes.count || 0,
      safety_rules_count: rulesRes.count || 0,
    };
  }
}
