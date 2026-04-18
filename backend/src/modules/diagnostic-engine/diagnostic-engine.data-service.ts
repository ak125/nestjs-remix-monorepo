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
  icon_slug: string | null;
  color_token: string | null;
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
  synonyms: string[];
  dtc_codes: string[];
}

export interface DiagMaintenanceOperation {
  id: number;
  slug: string;
  system_id: number;
  label: string;
  description: string | null;
  interval_km_min: number | null;
  interval_km_max: number | null;
  interval_months_min: number | null;
  interval_months_max: number | null;
  severity_if_overdue: string | null;
  normal_wear_km_min: number | null;
  normal_wear_km_max: number | null;
  related_gamme_slug: string | null;
  related_pg_id: number | null;
  active: boolean;
}

export interface PopularSymptom {
  slug: string;
  label: string;
  system_slug: string;
  system_label: string;
  urgency: string;
  session_count: number;
}

export interface PopularMaintenance {
  slug: string;
  label: string;
  system_slug: string;
  severity_if_overdue: string | null;
  related_pg_id: number | null;
  popularity_score: number;
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
   * Get system by numeric ID
   */
  async getSystemById(id: number): Promise<DiagSystem | null> {
    const { data, error } = await this.supabase
      .from('__diag_system')
      .select('*')
      .eq('id', id)
      .eq('active', true)
      .single();

    if (error) return null;
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
    maintenance_ops_count: number;
    symptoms_with_synonyms: number;
    symptoms_with_dtc: number;
    maintenance_with_synonyms: number;
  }> {
    // Run counts in parallel
    const [
      sessionsRes,
      systemsRes,
      symptomsRes,
      causesRes,
      rulesRes,
      maintRes,
      symptomsSynRes,
      symptomsDtcRes,
      maintSynRes,
    ] = await Promise.all([
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
      this.supabase
        .from('__diag_maintenance_operation')
        .select('id', { count: 'exact', head: true })
        .eq('active', true),
      this.supabase
        .from('__diag_symptom')
        .select('id', { count: 'exact', head: true })
        .not('synonyms', 'eq', '{}'),
      this.supabase
        .from('__diag_symptom')
        .select('id', { count: 'exact', head: true })
        .not('dtc_codes', 'eq', '{}'),
      this.supabase
        .from('__diag_maintenance_operation')
        .select('id', { count: 'exact', head: true })
        .not('synonyms', 'eq', '{}'),
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
      maintenance_ops_count: maintRes.count || 0,
      symptoms_with_synonyms: symptomsSynRes.count || 0,
      symptoms_with_dtc: symptomsDtcRes.count || 0,
      maintenance_with_synonyms: maintSynRes.count || 0,
    };
  }

  // ==========================================================================
  // Public surface methods (breezy-eagle plan Phase A2)
  // Lecture des __diag_* pour /search, /dtc, /maintenance, /popular, /systems/:slug
  // ==========================================================================

  /**
   * Retourne tous les symptomes actifs (utilise par le SearchService RAG
   * pour resoudre chunk_title -> slug via match exact).
   */
  async getAllActiveSymptoms(): Promise<DiagSymptom[]> {
    const { data, error } = await this.supabase
      .from('__diag_symptom')
      .select('*')
      .eq('active', true);

    if (error) {
      this.logger.warn('getAllActiveSymptoms failed', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Fallback ILIKE simple sur __diag_symptom.label (sans synonymes, sans RPC).
   * Utilise uniquement quand le RAG est indisponible.
   */
  async searchSymptomsByLabelOnly(
    q: string,
    limit = 10,
  ): Promise<DiagSymptom[]> {
    const query = q.trim();
    if (query.length < 2) return [];
    const { data, error } = await this.supabase
      .from('__diag_symptom')
      .select('*')
      .eq('active', true)
      .ilike('label', `%${query}%`)
      .limit(limit);
    if (error) {
      this.logger.warn(`searchSymptomsByLabelOnly failed`, error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Fallback ILIKE simple sur __diag_maintenance_operation.label.
   */
  async searchMaintenanceByLabelOnly(
    q: string,
    limit = 10,
  ): Promise<DiagMaintenanceOperation[]> {
    const query = q.trim();
    if (query.length < 2) return [];
    const { data, error } = await this.supabase
      .from('__diag_maintenance_operation')
      .select('*')
      .eq('active', true)
      .ilike('label', `%${query}%`)
      .limit(limit);
    if (error) {
      this.logger.warn(`searchMaintenanceByLabelOnly failed`, error.message);
      return [];
    }
    return data || [];
  }

  /**
   * DTC code lookup: returns symptoms that reference the code + their
   * top scored causes. Normalizes code to uppercase.
   */
  async lookupDtc(code: string): Promise<{
    code: string;
    symptoms: DiagSymptom[];
    likely_causes: DiagSymptomCauseLink[];
  }> {
    const normalized = code.trim().toUpperCase();

    const { data: symptoms, error } = await this.supabase
      .from('__diag_symptom')
      .select('*')
      .eq('active', true)
      .contains('dtc_codes', [normalized])
      .limit(20);

    if (error) {
      this.logger.warn(`lookupDtc failed for ${normalized}`, error.message);
      return { code: normalized, symptoms: [], likely_causes: [] };
    }

    const foundSymptoms: DiagSymptom[] = symptoms || [];
    if (!foundSymptoms.length) {
      return { code: normalized, symptoms: [], likely_causes: [] };
    }

    // Fetch top causes for each symptom, merged
    const allLinks = await this.getScoredCausesForSymptoms(
      foundSymptoms.map((s) => s.slug),
    );

    return {
      code: normalized,
      symptoms: foundSymptoms,
      likely_causes: allLinks.slice(0, 8),
    };
  }

  /**
   * List maintenance operations with optional filters.
   */
  async listMaintenanceOps(opts: {
    system?: string;
    limit?: number;
  }): Promise<DiagMaintenanceOperation[]> {
    const limit = Math.min(Math.max(opts.limit || 30, 1), 100);

    let systemId: number | null = null;
    if (opts.system) {
      const sys = await this.getSystemBySlug(opts.system);
      if (!sys) return [];
      systemId = sys.id;
    }

    let query = this.supabase
      .from('__diag_maintenance_operation')
      .select('*')
      .eq('active', true)
      .order('slug')
      .limit(limit);

    if (systemId !== null) query = query.eq('system_id', systemId);

    const { data, error } = await query;
    if (error) {
      this.logger.warn('listMaintenanceOps failed', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * Get maintenance operation by slug with linked symptoms.
   */
  async getMaintenanceBySlug(slug: string): Promise<{
    operation: DiagMaintenanceOperation;
    linked_symptoms: DiagSymptom[];
  } | null> {
    const { data: op, error } = await this.supabase
      .from('__diag_maintenance_operation')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .single();

    if (error || !op) {
      this.logger.warn(`getMaintenanceBySlug not found: ${slug}`);
      return null;
    }

    const { data: links } = await this.supabase
      .from('__diag_maintenance_symptom_link')
      .select('symptom_id')
      .eq('operation_id', op.id)
      .eq('active', true);

    const symptomIds = (links || []).map((l) => l.symptom_id);
    let linkedSymptoms: DiagSymptom[] = [];
    if (symptomIds.length) {
      const { data: symptoms } = await this.supabase
        .from('__diag_symptom')
        .select('*')
        .in('id', symptomIds)
        .eq('active', true);
      linkedSymptoms = symptoms || [];
    }

    return { operation: op, linked_symptoms: linkedSymptoms };
  }

  /**
   * Popular symptoms aggregated from last 500 sessions.
   * Reads __diag_session.signal_input->symptom_slugs.
   */
  async popularSymptoms(limit = 6): Promise<PopularSymptom[]> {
    const { data: sessions, error } = await this.supabase
      .from('__diag_session')
      .select('signal_input')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !sessions?.length) {
      this.logger.warn('popularSymptoms: no sessions', error?.message);
      return [];
    }

    // __diag_session.signal_input layout observed in prod:
    //   { signal_mode, primary_signal, secondary_signals: [] }
    // Some legacy rows may use symptom_slugs: [] — we handle both.
    const counts = new Map<string, number>();
    for (const row of sessions) {
      const input = row.signal_input as Record<string, unknown>;
      if (!input) continue;
      if (typeof input.primary_signal === 'string') {
        counts.set(
          input.primary_signal,
          (counts.get(input.primary_signal) || 0) + 2, // weighted
        );
      }
      const secondary = input.secondary_signals;
      if (Array.isArray(secondary)) {
        for (const s of secondary) {
          if (typeof s === 'string') counts.set(s, (counts.get(s) || 0) + 1);
        }
      }
      // Legacy fallback
      const legacy = input.symptom_slugs;
      if (Array.isArray(legacy)) {
        for (const s of legacy) {
          if (typeof s === 'string') counts.set(s, (counts.get(s) || 0) + 1);
        }
      }
    }

    const topSlugs = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit * 2) // oversample, some may be inactive
      .map(([slug]) => slug);

    if (!topSlugs.length) return [];

    const { data: symptoms } = await this.supabase
      .from('__diag_symptom')
      .select(
        'slug, label, urgency, system_id, active, __diag_system!inner(slug, label)',
      )
      .in('slug', topSlugs)
      .eq('active', true);

    const items: PopularSymptom[] = [];
    for (const sym of symptoms || []) {
      const sysJoin = (sym as Record<string, unknown>).__diag_system as
        | { slug: string; label: string }
        | undefined;
      const systemSlug = sysJoin?.slug || '';
      const systemLabel = sysJoin?.label || '';
      items.push({
        slug: sym.slug,
        label: sym.label,
        system_slug: systemSlug,
        system_label: systemLabel,
        urgency: sym.urgency,
        session_count: counts.get(sym.slug) || 0,
      });
    }

    return items
      .sort((a, b) => b.session_count - a.session_count)
      .slice(0, limit);
  }

  /**
   * Popular maintenance operations — heuristic:
   * low interval_km_min first (frequent maintenance), then severity.
   * (We don't yet have a "session recorded maintenance" metric.)
   */
  async popularMaintenance(limit = 6): Promise<PopularMaintenance[]> {
    // DB uses EN values: critical / high / moderate / low
    const severityRank: Record<string, number> = {
      critical: 4,
      high: 3,
      moderate: 2,
      low: 1,
    };

    const { data, error } = await this.supabase
      .from('__diag_maintenance_operation')
      .select(
        'slug, label, severity_if_overdue, related_pg_id, interval_km_min, __diag_system!inner(slug)',
      )
      .eq('active', true)
      .order('interval_km_min', { ascending: true, nullsFirst: false })
      .limit(limit * 3);

    if (error || !data?.length) {
      this.logger.warn('popularMaintenance failed', error?.message);
      return [];
    }

    const items = data.map((m) => {
      const sysJoin = (m as Record<string, unknown>).__diag_system as
        | { slug: string }
        | undefined;
      const severity = m.severity_if_overdue || 'low';
      const score =
        (severityRank[severity] || 1) * 10 +
        (m.interval_km_min ? Math.max(0, 40000 - m.interval_km_min) / 1000 : 0);
      return {
        slug: m.slug,
        label: m.label,
        system_slug: sysJoin?.slug || '',
        severity_if_overdue: m.severity_if_overdue,
        related_pg_id: m.related_pg_id,
        popularity_score: Math.round(score),
      };
    });

    return items
      .sort((a, b) => b.popularity_score - a.popularity_score)
      .slice(0, limit);
  }

  /**
   * Get maintenance operations linked to a symptom slug (reverse of maintenance.linked_symptoms).
   * Lit __diag_maintenance_symptom_link puis join vers __diag_maintenance_operation.
   */
  async getMaintenanceForSymptom(
    symptomSlug: string,
  ): Promise<DiagMaintenanceOperation[]> {
    const symptom = await this.getSymptomBySlug(symptomSlug);
    if (!symptom) return [];

    const { data: links } = await this.supabase
      .from('__diag_maintenance_symptom_link')
      .select('operation_id')
      .eq('symptom_id', symptom.id)
      .eq('active', true);

    const operationIds = (links || []).map((l) => l.operation_id);
    if (!operationIds.length) return [];

    const { data: ops, error } = await this.supabase
      .from('__diag_maintenance_operation')
      .select('*')
      .in('id', operationIds)
      .eq('active', true)
      .order('slug');

    if (error) {
      this.logger.warn(
        `getMaintenanceForSymptom failed for ${symptomSlug}`,
        error.message,
      );
      return [];
    }
    return ops || [];
  }

  /**
   * System detail with all its symptoms, safety rules and maintenance operations.
   */
  async getSystemBySlugWithSymptoms(slug: string): Promise<{
    system: DiagSystem;
    symptoms: DiagSymptom[];
    safety_rules: DiagSafetyRule[];
    maintenance_ops: DiagMaintenanceOperation[];
  } | null> {
    const system = await this.getSystemBySlug(slug);
    if (!system) return null;

    const [symptoms, safety_rules, maintenance_ops] = await Promise.all([
      this.getSymptomsBySystem(slug),
      this.getSafetyRules(slug),
      this.listMaintenanceOps({ system: slug, limit: 50 }),
    ]);

    return { system, symptoms, safety_rules, maintenance_ops };
  }
}
