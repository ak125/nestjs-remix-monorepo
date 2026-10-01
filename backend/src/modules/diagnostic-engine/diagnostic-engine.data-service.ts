/**
 * DiagnosticEngine DataService — Couche donnees Supabase
 *
 * Lecture des tables __diag_* pour alimenter le moteur deterministe.
 * Pas de logique metier ici — juste des queries.
 */
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { z } from 'zod';
import {
  DiagSystemsSchema,
  DiagSystemRowSchema,
  DiagSymptomRowSchema,
  DiagSymptomsSchema,
  DiagCauseLinksSchema,
  DiagCausesSchema,
  DiagSafetyRulesSchema,
  DiagSafetyRuleCoverageSchema,
} from './types/diagnostic-reference.schema';

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

export interface MaintenanceOperation {
  id: number;
  slug: string;
  label: string;
  description: string | null;
  interval_km_min: number | null;
  interval_km_max: number | null;
  interval_months_min: number | null;
  interval_months_max: number | null;
  severity_if_overdue: string;
  normal_wear_km_min: number | null;
  normal_wear_km_max: number | null;
  related_gamme_slug: string | null;
  related_pg_id: number | null;
}

@Injectable()
export class DiagnosticEngineDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(DiagnosticEngineDataService.name);

  /** Existing diagnostic maintenance reference; no vehicle applicability is implied. */
  async getMaintenanceOperations(): Promise<MaintenanceOperation[]> {
    const { data, error } = await this.supabase
      .from('__diag_maintenance_operation')
      .select(
        'id,slug,label,description,interval_km_min,interval_km_max,interval_months_min,interval_months_max,severity_if_overdue,normal_wear_km_min,normal_wear_km_max,related_gamme_slug,related_pg_id',
      )
      .eq('active', true)
      .order('label', { ascending: true });
    if (error || !Array.isArray(data))
      throw new Error('Maintenance operations unavailable');
    return data;
  }

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
      throw new Error('Diagnostic systems unavailable');
    }
    DiagSystemsSchema.parse(data);
    return data;
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
      if (error.code === 'PGRST116') return null;
      this.logger.error(`Failed to fetch system: ${slug}`, error.message);
      throw new Error('Diagnostic system unavailable');
    }
    DiagSystemRowSchema.parse(data);
    if (data.slug !== slug)
      throw new Error('Diagnostic system identity mismatch');
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

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error('Diagnostic symptom unavailable');
    }
    DiagSymptomRowSchema.parse(data);
    if (data.slug !== slug)
      throw new Error('Diagnostic symptom identity mismatch');
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
      throw new Error('Diagnostic symptoms unavailable');
    }
    DiagSymptomsSchema.parse(data);
    if (data.some((row) => row.system_id !== system.id))
      throw new Error('Diagnostic symptom system mismatch');
    return data;
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

    if (linksError) throw new Error('Diagnostic cause links unavailable');
    DiagCauseLinksSchema.parse(links);
    if (links.some((row) => row.symptom_id !== symptom.id))
      throw new Error('Diagnostic cause link symptom mismatch');
    if (!links.length) return [];

    // Step 3: fetch causes for these links, filtered to same system as symptom
    const causeIds = links.map((l) => l.cause_id);
    const { data: causes, error: causesError } = await this.supabase
      .from('__diag_cause')
      .select('*')
      .in('id', causeIds)
      .eq('system_id', symptom.system_id) // Guard: only same-system causes
      .eq('active', true);

    if (causesError) throw new Error('Diagnostic causes unavailable');
    DiagCausesSchema.parse(causes);
    if (
      causes.some(
        (row) =>
          row.system_id !== symptom.system_id || !causeIds.includes(row.id),
      )
    )
      throw new Error('Diagnostic cause identity mismatch');

    // Every active link must resolve. Silently dropping a missing, inactive or
    // cross-system cause could remove a critical hypothesis from the diagnosis.
    const causeMap = new Map(causes.map((c) => [c.id, c]));
    if (links.some((link) => !causeMap.has(link.cause_id)))
      throw new Error('Diagnostic cause coverage incomplete');
    return links.map((link) => ({
      ...link,
      cause: causeMap.get(link.cause_id)!,
    }));
  }

  /**
   * Get scored causes for multiple symptom slugs — merges and normalizes scores
   */
  async getScoredCausesForSymptoms(
    symptomSlugs: string[],
  ): Promise<DiagSymptomCauseLink[]> {
    if (!symptomSlugs.length) return [];

    // Equal-weight arithmetic mean over the unique selected symptoms. A symptom
    // not linked to a cause contributes 0: no evidence is imputed for it.
    // Sort input and evidence for deterministic results; round once after
    // aggregation.
    const slugs = [...new Set(symptomSlugs)].sort();
    const merged = new Map<
      number,
      { link: DiagSymptomCauseLink; sum: number }
    >();
    for (const slug of slugs) {
      const links = await this.getScoredCausesForSymptom(slug);
      if (!links.length)
        throw new Error('Diagnostic cause coverage incomplete');
      for (const link of links) {
        const existing = merged.get(link.cause_id);
        if (existing) {
          existing.sum += link.relative_score;
          existing.link.evidence_for = [
            ...new Set([...existing.link.evidence_for, ...link.evidence_for]),
          ].sort();
          existing.link.evidence_against = [
            ...new Set([
              ...existing.link.evidence_against,
              ...link.evidence_against,
            ]),
          ].sort();
          existing.link.requires_verification ||= link.requires_verification;
        } else {
          merged.set(link.cause_id, {
            link: {
              ...link,
              evidence_for: [...new Set(link.evidence_for)].sort(),
              evidence_against: [...new Set(link.evidence_against)].sort(),
            },
            sum: link.relative_score,
          });
        }
      }
    }
    return [...merged.values()]
      .map(({ link, sum }) => ({
        ...link,
        relative_score: Math.round(sum / slugs.length),
      }))
      .sort(
        (a, b) =>
          b.relative_score - a.relative_score || a.cause_id - b.cause_id,
      );
  }

  /**
   * Get safety rules for a system
   */
  async getSafetyRules(systemSlug: string): Promise<DiagSafetyRule[]> {
    const system = await this.getSystemBySlug(systemSlug);
    if (!system) throw new Error('Safety system unavailable');

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
      throw new Error('Safety rules unavailable');
    }
    DiagSafetyRulesSchema.parse(data);
    if (data.some((row) => row.system_id !== system.id))
      throw new Error('Diagnostic safety rule system mismatch');
    return data;
  }

  /**
   * Systems that have at least one active safety rule.
   */
  async getSystemIdsWithSafetyRules(): Promise<Set<number>> {
    const { data, error } = await this.supabase
      .from('__diag_safety_rule')
      .select('system_id, active')
      .eq('active', true);

    if (error) {
      this.logger.error('Failed to fetch safety rule coverage', error.message);
      throw new Error('Safety rules unavailable');
    }
    DiagSafetyRuleCoverageSchema.parse(data);
    return new Set(data.map((row) => row.system_id));
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
    const acknowledgement = z.string().uuid().safeParse(data?.id);
    if (!acknowledgement.success) {
      this.logger.warn('Diagnostic session write acknowledgement invalid');
      return null;
    }
    return acknowledgement.data;
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
      if (error.code === 'PGRST116') return null;
      this.logger.warn('Diagnostic session lookup unavailable');
      throw new ServiceUnavailableException(
        'Chargement de la session indisponible.',
      );
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
      this.logger.error('Failed to list sessions', error.message);
      throw new ServiceUnavailableException(
        'Historique des diagnostics indisponible.',
      );
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
    const recentRes = await this.supabase
      .from('__diag_session')
      .select('system_scope')
      .order('created_at', { ascending: false })
      .limit(500);

    const failed = [
      sessionsRes,
      systemsRes,
      symptomsRes,
      causesRes,
      rulesRes,
      recentRes,
    ].find((res) => res.error);
    if (failed?.error) {
      this.logger.error('Failed to compute stats', failed.error.message);
      throw new ServiceUnavailableException(
        'Statistiques du diagnostic indisponibles.',
      );
    }
    const recentSessions = recentRes.data;

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
