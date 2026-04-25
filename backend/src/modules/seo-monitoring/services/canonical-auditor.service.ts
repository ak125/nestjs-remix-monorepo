/**
 * Canonical Auditor Service
 *
 * Détecte les conflits de canonical sur les pages déclarées indexables
 * dans `__seo_page` (table existante créée par sitemap-v10).
 *
 * 4 types de conflict détectés (cf. seo-types/onpage.ts CanonicalConflictPayloadSchema) :
 *
 *   1. self_referencing_missing : page indexable sans canonical_url déclaré
 *   2. wrong_domain              : canonical_url ne pointe pas vers SITE_ORIGIN
 *   3. duplicate_cross_role      : 2+ pages distinctes ont le même canonical_url
 *   4. points_to_404 / redirect  : canonical_url renvoie 404/3xx (Phase 2b — fetch HTTP)
 *
 * Phase 2a couvre 1+2+3. Phase 2b ajoute fetch HTTP pour 4.
 *
 * Refs:
 * - ADR-025-seo-department-architecture
 * - 20260426_seo_audit_findings.sql (table cible)
 * - packages/seo-types/src/onpage.ts (CanonicalConflictPayloadSchema)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import {
  AuditFindingInput,
  AuditFindingsService,
} from './audit-findings.service';

export interface CanonicalAuditOptions {
  /** Préfixe URL à filtrer (ex: 'pieces/') ; si non fourni, audite tout. */
  urlPrefix?: string;
  /** Limite de pages à auditer par run. Défaut 5000. */
  limit?: number;
  /** Dry run : compte mais n'écrit pas dans audit_findings. */
  dryRun?: boolean;
}

export interface CanonicalAuditResult {
  pagesAudited: number;
  findingsDetected: number;
  findingsByType: {
    self_referencing_missing: number;
    wrong_domain: number;
    duplicate_cross_role: number;
  };
  findingsInserted: number;
  durationSeconds: number;
}

@Injectable()
export class CanonicalAuditorService {
  private readonly logger = new Logger(CanonicalAuditorService.name);
  private readonly supabase: SupabaseClient;
  private readonly siteOrigin: string;

  constructor(
    configService: ConfigService,
    private readonly findings: AuditFindingsService,
  ) {
    const url = configService.get<string>('SUPABASE_URL');
    const key = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      throw new Error('CanonicalAuditorService: Supabase env missing');
    }
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    // Réutilise convention existante (cf. AP-11 vault rule)
    this.siteOrigin =
      configService.get<string>('GSC_SITE_URL') ??
      'https://www.automecanik.com';
  }

  async audit(
    options: CanonicalAuditOptions = {},
  ): Promise<CanonicalAuditResult> {
    const startedAt = Date.now();
    const limit = options.limit ?? 5000;
    const result: CanonicalAuditResult = {
      pagesAudited: 0,
      findingsDetected: 0,
      findingsByType: {
        self_referencing_missing: 0,
        wrong_domain: 0,
        duplicate_cross_role: 0,
      },
      findingsInserted: 0,
      durationSeconds: 0,
    };

    // Step 1 : fetch pages indexables avec leur canonical
    let query = this.supabase
      .from('__seo_page')
      .select('url, canonical_url, page_type, meta_robots, is_indexable_hint')
      .eq('is_indexable_hint', true)
      .limit(limit);

    if (options.urlPrefix) {
      query = query.ilike('url', `${options.urlPrefix}%`);
    }

    const { data: pages, error } = await query;
    if (error) {
      throw new Error(`__seo_page query: ${error.message}`);
    }

    const pagesData = pages ?? [];
    result.pagesAudited = pagesData.length;

    if (pagesData.length === 0) {
      result.durationSeconds = (Date.now() - startedAt) / 1000;
      return result;
    }

    // Step 2 : détection
    const findingsToInsert: AuditFindingInput[] = [];

    // Build canonical → [urls] map pour duplicate detection
    const canonicalToUrls = new Map<string, string[]>();
    for (const p of pagesData) {
      if (p.canonical_url) {
        const existing = canonicalToUrls.get(p.canonical_url) ?? [];
        existing.push(p.url);
        canonicalToUrls.set(p.canonical_url, existing);
      }
    }

    for (const p of pagesData) {
      // Skip noindex pages (légitimes sans canonical)
      const robots = p.meta_robots ?? 'index,follow';
      if (robots.includes('noindex')) continue;

      // Detection 1 : self_referencing_missing
      if (!p.canonical_url || p.canonical_url.trim() === '') {
        findingsToInsert.push({
          audit_type: 'canonical_conflict',
          entity_url: p.url,
          severity: 'high',
          payload: {
            declared_canonical: null,
            computed_canonical: this.normalizeToAbsolute(p.url),
            conflict_type: 'self_referencing_missing',
          },
        });
        result.findingsByType.self_referencing_missing += 1;
        continue;
      }

      // Detection 2 : wrong_domain
      if (!p.canonical_url.startsWith(this.siteOrigin)) {
        findingsToInsert.push({
          audit_type: 'canonical_conflict',
          entity_url: p.url,
          severity: 'critical',
          payload: {
            declared_canonical: p.canonical_url,
            computed_canonical: this.normalizeToAbsolute(p.url),
            conflict_type: 'wrong_domain',
          },
        });
        result.findingsByType.wrong_domain += 1;
        continue;
      }

      // Detection 3 : duplicate_cross_role
      const sharedUrls = canonicalToUrls.get(p.canonical_url) ?? [];
      if (sharedUrls.length > 1 && p.url !== p.canonical_url) {
        findingsToInsert.push({
          audit_type: 'canonical_conflict',
          entity_url: p.url,
          severity: 'medium',
          payload: {
            declared_canonical: p.canonical_url,
            computed_canonical: this.normalizeToAbsolute(p.url),
            conflict_type: 'duplicate_cross_role',
            duplicate_pages: sharedUrls.filter((u) => u !== p.url),
          },
        });
        result.findingsByType.duplicate_cross_role += 1;
      }
    }

    result.findingsDetected = findingsToInsert.length;

    // Step 3 : persist (sauf dry-run)
    if (!options.dryRun && findingsToInsert.length > 0) {
      result.findingsInserted =
        await this.findings.insertBatch(findingsToInsert);
    }

    result.durationSeconds = (Date.now() - startedAt) / 1000;
    this.logger.log(
      `🔍 Canonical audit : ${result.pagesAudited} pages → ${result.findingsDetected} findings (${result.findingsByType.wrong_domain} critical wrong_domain, ${result.findingsByType.self_referencing_missing} high missing, ${result.findingsByType.duplicate_cross_role} medium duplicate) in ${result.durationSeconds}s`,
    );

    return result;
  }

  private normalizeToAbsolute(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `${this.siteOrigin}${url}`;
    }
    return `${this.siteOrigin}/${url}`;
  }
}
