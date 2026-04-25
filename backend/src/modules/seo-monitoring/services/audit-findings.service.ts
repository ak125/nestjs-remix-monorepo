/**
 * Audit Findings Service
 *
 * Wrapper d'écriture/lecture sur la table unifiée `__seo_audit_findings`.
 * Utilisé par les auditors (canonical, schema, image, meta-ab, internal-link).
 *
 * Pattern identique à SeoMonitoringRunsService pour `__seo_event_log`.
 *
 * Refs:
 * - 20260426_seo_audit_findings.sql (migration)
 * - packages/seo-types/src/onpage.ts (Zod discriminated union)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

export type AuditType =
  | 'schema_violation'
  | 'image_seo'
  | 'canonical_conflict'
  | 'meta_experiment'
  | 'internal_link_suggestion';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AuditFindingInput {
  audit_type: AuditType;
  entity_url: string;
  severity: Severity;
  payload: Record<string, unknown>;
}

export interface AuditFindingRow extends AuditFindingInput {
  id: string;
  detected_at: string;
  resolved_at: string | null;
  fixed_at: string | null;
}

@Injectable()
export class AuditFindingsService {
  private readonly logger = new Logger(AuditFindingsService.name);
  private readonly supabase: SupabaseClient;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('SUPABASE_URL');
    const key = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      throw new Error('AuditFindingsService: Supabase env missing');
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /**
   * Insert N findings en batch. Pas d'upsert : chaque détection crée un
   * nouveau row avec UUID id. Le caller est responsable de marquer les
   * anciens findings comme `resolved_at` quand ils ne sont plus détectés.
   */
  async insertBatch(findings: AuditFindingInput[]): Promise<number> {
    if (findings.length === 0) return 0;

    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < findings.length; i += batchSize) {
      const batch = findings.slice(i, i + batchSize);
      const { error } = await this.supabase
        .from('__seo_audit_findings')
        .insert(batch);

      if (error) {
        this.logger.error(
          `__seo_audit_findings insert failed: ${error.message}`,
        );
        throw new Error(`audit_findings insert: ${error.message}`);
      }
      inserted += batch.length;
    }

    return inserted;
  }

  /**
   * Marque comme résolus tous les findings d'un type sur une URL qui
   * n'apparaissent pas dans le dernier scan. Utilisé par les auditors
   * pour fermer les findings obsolètes (ex: schema_violation corrigée).
   *
   * @param auditType type à filtrer
   * @param entityUrl URL ciblée
   * @param keepIds IDs à NE PAS résoudre (les findings encore actifs)
   */
  async resolveStaleFindings(
    auditType: AuditType,
    entityUrl: string,
    keepIds: string[],
  ): Promise<number> {
    const query = this.supabase
      .from('__seo_audit_findings')
      .update({ resolved_at: new Date().toISOString() })
      .eq('audit_type', auditType)
      .eq('entity_url', entityUrl)
      .is('resolved_at', null);

    const { error, count } =
      keepIds.length > 0
        ? await query.not('id', 'in', `(${keepIds.join(',')})`)
        : await query;

    if (error) {
      this.logger.error(`resolveStaleFindings failed: ${error.message}`);
      return 0;
    }
    return count ?? 0;
  }

  /**
   * Liste les findings open d'un type (pour dashboard / endpoint API).
   */
  async listOpen(
    auditType: AuditType,
    limit = 100,
  ): Promise<AuditFindingRow[]> {
    const { data, error } = await this.supabase
      .from('__seo_audit_findings')
      .select(
        'id, audit_type, entity_url, severity, payload, detected_at, resolved_at, fixed_at',
      )
      .eq('audit_type', auditType)
      .is('resolved_at', null)
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(`listOpen(${auditType}) failed: ${error.message}`);
      return [];
    }
    return (data ?? []) as AuditFindingRow[];
  }

  /**
   * Aggrégat par severity sur tous les findings open d'un type.
   * Utilisé par le dashboard KPI cards.
   */
  async countOpenBySeverity(
    auditType: AuditType,
  ): Promise<Record<Severity, number>> {
    const { data, error } = await this.supabase
      .from('__seo_audit_findings')
      .select('severity')
      .eq('audit_type', auditType)
      .is('resolved_at', null);

    const init: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    if (error || !data) return init;

    return data.reduce((acc, r) => {
      const sev = (r.severity as Severity) ?? 'info';
      acc[sev] = (acc[sev] ?? 0) + 1;
      return acc;
    }, init);
  }
}
