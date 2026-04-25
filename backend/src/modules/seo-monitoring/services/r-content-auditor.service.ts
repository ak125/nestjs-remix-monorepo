/**
 * R-Content Auditor Service
 *
 * Audite les **vraies tables R-content** qui contiennent du contenu
 * persisté (vs Phase 2b qui auditera le contenu généré runtime via fetch
 * HTTP des 321k pages product).
 *
 * 4 sources auditées :
 *  - __seo_gamme_conseil       (R3, 2790 sections S1-S8)
 *  - __seo_gamme_purchase_guide (R6, 241 guides d'achat)
 *  - __seo_reference           (R4, 239 fiches référence)
 *  - __seo_brand_editorial     (R7, 36 contenus marques)
 *
 * Détections par sous-type (payload.gap_type) :
 *  - thin_section / empty_section   → __seo_gamme_conseil sections
 *  - empty_intro / missing_gatekeeper → __seo_gamme_purchase_guide
 *  - missing_schema / missing_faq / unpublished_eligible → __seo_reference
 *
 * Toutes les findings vont dans __seo_audit_findings avec audit_type =
 * 'r_content_gap'. Severity calibré selon impact :
 *  - critical : empty (contenu totalement absent)
 *  - high     : thin <100 chars
 *  - medium   : thin <300 chars OR missing_schema_json (impact rich results)
 *  - low      : missing_faq, missing_gatekeeper
 *
 * Refs:
 * - ADR-025-seo-department-architecture
 * - 20260426_seo_audit_findings.sql (table cible, PR #174)
 * - 20260426_seo_audit_type_extend_r_content.sql (ENUM extension)
 * - packages/seo-types/src/onpage.ts (Zod, à étendre Phase 2 V2)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import {
  AuditFindingInput,
  AuditFindingsService,
  Severity,
} from './audit-findings.service';

export interface RContentAuditOptions {
  /** Sources à auditer (par défaut : toutes). */
  sources?: Array<
    'conseil' | 'purchase_guide' | 'reference' | 'brand_editorial'
  >;
  /** Seuil de mots pour thin content (défaut 300). */
  thinContentThreshold?: number;
  /** Dry run : ne pas écrire dans audit_findings. */
  dryRun?: boolean;
}

export interface RContentAuditResult {
  durationSeconds: number;
  findingsDetected: number;
  findingsInserted: number;
  bySource: {
    conseil: number;
    purchase_guide: number;
    reference: number;
    brand_editorial: number;
  };
  byGapType: Record<string, number>;
}

const SITE_ORIGIN = 'https://www.automecanik.com';

@Injectable()
export class RContentAuditorService {
  private readonly logger = new Logger(RContentAuditorService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    configService: ConfigService,
    private readonly findings: AuditFindingsService,
  ) {
    const url = configService.get<string>('SUPABASE_URL');
    const key = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      throw new Error('RContentAuditorService: Supabase env missing');
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async audit(
    options: RContentAuditOptions = {},
  ): Promise<RContentAuditResult> {
    const startedAt = Date.now();
    const sources = options.sources ?? [
      'conseil',
      'purchase_guide',
      'reference',
      'brand_editorial',
    ];
    const threshold = options.thinContentThreshold ?? 300;

    const result: RContentAuditResult = {
      durationSeconds: 0,
      findingsDetected: 0,
      findingsInserted: 0,
      bySource: {
        conseil: 0,
        purchase_guide: 0,
        reference: 0,
        brand_editorial: 0,
      },
      byGapType: {},
    };

    const allFindings: AuditFindingInput[] = [];

    if (sources.includes('conseil')) {
      const f = await this.auditConseilSections(threshold);
      allFindings.push(...f);
      result.bySource.conseil = f.length;
    }

    if (sources.includes('purchase_guide')) {
      const f = await this.auditPurchaseGuides();
      allFindings.push(...f);
      result.bySource.purchase_guide = f.length;
    }

    if (sources.includes('reference')) {
      const f = await this.auditReferences();
      allFindings.push(...f);
      result.bySource.reference = f.length;
    }

    if (sources.includes('brand_editorial')) {
      const f = await this.auditBrandEditorial();
      allFindings.push(...f);
      result.bySource.brand_editorial = f.length;
    }

    result.findingsDetected = allFindings.length;

    // Aggregate by gap_type for telemetry
    for (const f of allFindings) {
      const gt = (f.payload as { gap_type?: string }).gap_type ?? 'unknown';
      result.byGapType[gt] = (result.byGapType[gt] ?? 0) + 1;
    }

    if (!options.dryRun && allFindings.length > 0) {
      result.findingsInserted = await this.findings.insertBatch(allFindings);
    }

    result.durationSeconds = (Date.now() - startedAt) / 1000;
    this.logger.log(
      `🔍 R-content audit : ${result.findingsDetected} findings (conseil=${result.bySource.conseil}, R6=${result.bySource.purchase_guide}, R4=${result.bySource.reference}, R7=${result.bySource.brand_editorial}) in ${result.durationSeconds}s`,
    );

    return result;
  }

  // ─── 1. Conseil sections (R3) ──────────────────────────────────────────

  private async auditConseilSections(
    threshold: number,
  ): Promise<AuditFindingInput[]> {
    const { data, error } = await this.supabase
      .from('__seo_gamme_conseil')
      .select('sgc_id, sgc_pg_id, sgc_section_type, sgc_content')
      .limit(10000);

    if (error) {
      this.logger.error(`__seo_gamme_conseil query: ${error.message}`);
      return [];
    }

    const findings: AuditFindingInput[] = [];
    for (const row of data ?? []) {
      const len = (row.sgc_content as string | null)?.length ?? 0;
      if (len === 0) {
        findings.push({
          audit_type: 'r_content_gap',
          entity_url: this.conseilUrl(row.sgc_pg_id, row.sgc_section_type),
          severity: 'critical',
          payload: {
            source_table: '__seo_gamme_conseil',
            row_id: row.sgc_id,
            pg_id: row.sgc_pg_id,
            section_type: row.sgc_section_type,
            gap_type: 'empty_section',
            content_length: 0,
          },
        });
      } else if (len < 100) {
        findings.push({
          audit_type: 'r_content_gap',
          entity_url: this.conseilUrl(row.sgc_pg_id, row.sgc_section_type),
          severity: 'high',
          payload: {
            source_table: '__seo_gamme_conseil',
            row_id: row.sgc_id,
            pg_id: row.sgc_pg_id,
            section_type: row.sgc_section_type,
            gap_type: 'thin_section',
            content_length: len,
            threshold: 100,
          },
        });
      } else if (len < threshold) {
        findings.push({
          audit_type: 'r_content_gap',
          entity_url: this.conseilUrl(row.sgc_pg_id, row.sgc_section_type),
          severity: 'medium',
          payload: {
            source_table: '__seo_gamme_conseil',
            row_id: row.sgc_id,
            pg_id: row.sgc_pg_id,
            section_type: row.sgc_section_type,
            gap_type: 'thin_section',
            content_length: len,
            threshold,
          },
        });
      }
    }
    return findings;
  }

  // ─── 2. Purchase guides (R6) ───────────────────────────────────────────

  private async auditPurchaseGuides(): Promise<AuditFindingInput[]> {
    const { data, error } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_pg_id, sgpg_intro_role, sgpg_gatekeeper_score');

    if (error) {
      this.logger.error(`__seo_gamme_purchase_guide query: ${error.message}`);
      return [];
    }

    const findings: AuditFindingInput[] = [];
    for (const row of data ?? []) {
      const intro = (row.sgpg_intro_role as string | null) ?? '';
      if (intro.trim() === '') {
        findings.push({
          audit_type: 'r_content_gap',
          entity_url: this.guideUrl(row.sgpg_pg_id),
          severity: 'high',
          payload: {
            source_table: '__seo_gamme_purchase_guide',
            pg_id: row.sgpg_pg_id,
            gap_type: 'empty_intro',
            field: 'sgpg_intro_role',
          },
        });
      }
      if (row.sgpg_gatekeeper_score === null) {
        findings.push({
          audit_type: 'r_content_gap',
          entity_url: this.guideUrl(row.sgpg_pg_id),
          severity: 'low',
          payload: {
            source_table: '__seo_gamme_purchase_guide',
            pg_id: row.sgpg_pg_id,
            gap_type: 'missing_gatekeeper',
            field: 'sgpg_gatekeeper_score',
          },
        });
      }
    }
    return findings;
  }

  // ─── 3. References (R4) ────────────────────────────────────────────────

  private async auditReferences(): Promise<AuditFindingInput[]> {
    const { data, error } = await this.supabase
      .from('__seo_reference')
      .select('id, slug, schema_json, common_questions, is_published');

    if (error) {
      this.logger.error(`__seo_reference query: ${error.message}`);
      return [];
    }

    const findings: AuditFindingInput[] = [];
    for (const row of data ?? []) {
      const url = `${SITE_ORIGIN}/reference/${row.slug}`;

      if (row.schema_json === null) {
        findings.push({
          audit_type: 'r_content_gap',
          entity_url: url,
          severity: 'medium',
          payload: {
            source_table: '__seo_reference',
            row_id: row.id,
            slug: row.slug,
            gap_type: 'missing_schema',
            field: 'schema_json',
            impact: 'rich_results_not_eligible',
          },
        });
      }

      if (row.common_questions === null) {
        findings.push({
          audit_type: 'r_content_gap',
          entity_url: url,
          severity: 'low',
          payload: {
            source_table: '__seo_reference',
            row_id: row.id,
            slug: row.slug,
            gap_type: 'missing_faq',
            field: 'common_questions',
          },
        });
      }

      if (row.is_published !== true) {
        findings.push({
          audit_type: 'r_content_gap',
          entity_url: url,
          severity: 'low',
          payload: {
            source_table: '__seo_reference',
            row_id: row.id,
            slug: row.slug,
            gap_type: 'unpublished_eligible',
            field: 'is_published',
          },
        });
      }
    }
    return findings;
  }

  // ─── 4. Brand editorial (R7) ───────────────────────────────────────────

  private async auditBrandEditorial(): Promise<AuditFindingInput[]> {
    // Probing : on essaie le select. Si la table a une colonne brand_id +
    // editorial_content (cf. ADR-025 mention), on l'audit. Sinon skip propre.
    const { data, error } = await this.supabase
      .from('__seo_brand_editorial')
      .select('*')
      .limit(50);

    if (error) {
      this.logger.warn(
        `__seo_brand_editorial probe failed (skip): ${error.message}`,
      );
      return [];
    }

    if (!data || data.length === 0) return [];

    const findings: AuditFindingInput[] = [];
    // Détection générique : tout champ texte vide est un gap
    for (const row of data) {
      const brandId = (row as Record<string, unknown>).brand_id ?? 'unknown';
      const url = `${SITE_ORIGIN}/marques/${brandId}`;

      for (const [key, val] of Object.entries(row as Record<string, unknown>)) {
        if (typeof val === 'string' && val.trim() === '') {
          findings.push({
            audit_type: 'r_content_gap',
            entity_url: url,
            severity: 'low' as Severity,
            payload: {
              source_table: '__seo_brand_editorial',
              brand_id: brandId,
              gap_type: 'empty_field',
              field: key,
            },
          });
        }
      }
    }
    return findings;
  }

  // ─── URL builders ──────────────────────────────────────────────────────

  private conseilUrl(pgId: number | string, sectionType: string): string {
    return `${SITE_ORIGIN}/blog-pieces-auto/conseils/${pgId}#${sectionType}`;
  }

  private guideUrl(pgId: number | string): string {
    return `${SITE_ORIGIN}/blog-pieces-auto/guide/${pgId}`;
  }
}
