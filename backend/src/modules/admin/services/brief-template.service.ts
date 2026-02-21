import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

// ── Types ──

export interface BriefTemplate {
  id: number;
  family_id: number;
  family_label: string | null;
  page_role: string;
  template_json: Record<string, unknown>;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BriefOverrides {
  angles_obligatoires?: string[];
  faq_paa?: string[];
  forbidden_overlap?: string[];
  keywords_primary?: string;
  keywords_secondary?: string[];
  [key: string]: unknown;
}

export interface CloneDetectionResult {
  familyId: number;
  familyLabel: string;
  totalBriefs: number;
  uniqueHashes: number;
  cloneRatio: number;
  isClone: boolean;
}

// ── Service ──

@Injectable()
export class BriefTemplateService extends SupabaseBaseService {
  protected override readonly logger = new Logger(BriefTemplateService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  // ── Template CRUD ──

  async createTemplate(
    familyId: number,
    pageRole: string,
    templateJson: Record<string, unknown>,
    familyLabel?: string,
  ): Promise<BriefTemplate> {
    // Get next version
    const { data: existing } = await this.client
      .from('__seo_brief_template')
      .select('version')
      .eq('family_id', familyId)
      .eq('page_role', pageRole)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existing?.length ? existing[0].version + 1 : 1;

    const { data, error } = await this.client
      .from('__seo_brief_template')
      .insert({
        family_id: familyId,
        family_label: familyLabel ?? null,
        page_role: pageRole,
        template_json: templateJson,
        version: nextVersion,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create template: ${error.message}`);
    return data as BriefTemplate;
  }

  async getActiveTemplate(
    familyId: number,
    pageRole: string,
  ): Promise<BriefTemplate | null> {
    const { data } = await this.client
      .from('__seo_brief_template')
      .select('*')
      .eq('family_id', familyId)
      .eq('page_role', pageRole)
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    return (data as BriefTemplate) ?? null;
  }

  async listTemplates(familyId?: number): Promise<BriefTemplate[]> {
    let q = this.client
      .from('__seo_brief_template')
      .select('*')
      .eq('status', 'active')
      .order('family_id', { ascending: true })
      .order('page_role', { ascending: true });

    if (familyId) q = q.eq('family_id', familyId);

    const { data } = await q;
    return (data as BriefTemplate[]) ?? [];
  }

  // ── Template + Overrides Merge ──

  /**
   * Merge template_json with overrides_json (overrides win, deep merge).
   * Used by PageBriefService.getActiveBrief() to resolve the final brief.
   */
  mergeTemplateWithOverrides(
    template: Record<string, unknown>,
    overrides: BriefOverrides,
  ): Record<string, unknown> {
    const merged = { ...template };

    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined || value === null) continue;

      // Array fields: override replaces entirely (not concat)
      if (Array.isArray(value)) {
        merged[key] = value;
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Deep merge for nested objects
        merged[key] = {
          ...(typeof merged[key] === 'object' ? merged[key] : {}),
          ...value,
        };
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }

  // ── Coverage & Confidence Scoring ──

  /**
   * coverage_score = % of non-empty fields (0.0 → 1.0)
   */
  computeCoverageScore(briefFields: Record<string, unknown>): number {
    const scoredFields = [
      'primary_intent',
      'secondary_intents',
      'angles_obligatoires',
      'forbidden_overlap',
      'faq_paa',
      'termes_techniques',
      'preuves',
      'keywords_primary',
      'keywords_secondary',
      'writing_constraints',
    ];

    let nonEmpty = 0;
    for (const field of scoredFields) {
      const value = briefFields[field];
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && value.trim() === '') continue;
      if (Array.isArray(value) && value.length === 0) continue;
      nonEmpty++;
    }

    return nonEmpty / scoredFields.length;
  }

  /**
   * confidence_score = cross-source stability (keywords DB ∩ RAG headings ∩ family)
   * Simplified MVP: based on coverage + keyword presence
   */
  computeConfidenceScore(
    briefFields: Record<string, unknown>,
    hasRagCorpus: boolean,
    keywordCount: number,
  ): number {
    let score = 0;

    // Base from coverage
    const coverage = this.computeCoverageScore(briefFields);
    score += coverage * 0.4;

    // RAG corpus available
    if (hasRagCorpus) score += 0.3;

    // Keywords from DB
    if (keywordCount >= 5) score += 0.3;
    else if (keywordCount >= 1) score += 0.15;

    return Math.min(score, 1.0);
  }

  // ── Anti-Clone Detection ──

  /**
   * Compute SHA-256 of normalized overrides_json for clone detection.
   */
  computeOverridesHash(overrides: BriefOverrides): string {
    // Normalize: sort keys, stringify arrays sorted
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(overrides).sort()) {
      if (Array.isArray(value)) {
        normalized[key] = [...value].sort();
      } else {
        normalized[key] = value;
      }
    }
    return createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  /**
   * Detect clone briefs within a family.
   * Clone = >80% of gammes in a family have the same overrides_hash.
   */
  async detectClones(familyId: number): Promise<CloneDetectionResult> {
    const { data: briefs } = await this.client
      .from('__seo_page_brief')
      .select('id, overrides_json, template_id')
      .not('template_id', 'is', null);

    if (!briefs?.length) {
      return {
        familyId,
        familyLabel: '',
        totalBriefs: 0,
        uniqueHashes: 0,
        cloneRatio: 0,
        isClone: false,
      };
    }

    // Get template family_id mapping
    const { data: templates } = await this.client
      .from('__seo_brief_template')
      .select('id, family_id, family_label')
      .eq('family_id', familyId);

    if (!templates?.length) {
      return {
        familyId,
        familyLabel: '',
        totalBriefs: 0,
        uniqueHashes: 0,
        cloneRatio: 0,
        isClone: false,
      };
    }

    const templateIds = new Set(templates.map((t) => t.id));
    const familyLabel = templates[0].family_label || '';

    const familyBriefs = briefs.filter((b) => templateIds.has(b.template_id));

    if (familyBriefs.length === 0) {
      return {
        familyId,
        familyLabel,
        totalBriefs: 0,
        uniqueHashes: 0,
        cloneRatio: 0,
        isClone: false,
      };
    }

    // Count unique override hashes
    const hashes = new Set<string>();
    for (const b of familyBriefs) {
      const overrides = (b.overrides_json as BriefOverrides) || {};
      hashes.add(this.computeOverridesHash(overrides));
    }

    const cloneRatio = 1 - hashes.size / familyBriefs.length;

    return {
      familyId,
      familyLabel,
      totalBriefs: familyBriefs.length,
      uniqueHashes: hashes.size,
      cloneRatio,
      isClone: cloneRatio > 0.8,
    };
  }

  // ── Bulk Brief Generation ──

  /**
   * Generate briefs for all gammes in a family from the template.
   * Pass 1 (DB-only): Template + keywords from __seo_keywords + forbidden_overlap.
   */
  async bulkGenerateFromTemplate(
    familyId: number,
    pageRole: string,
    dryRun = false,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    const template = await this.getActiveTemplate(familyId, pageRole);
    if (!template) {
      throw new NotFoundException(
        `No active template for family ${familyId} / ${pageRole}`,
      );
    }

    // Get all gammes in this family
    const { data: gammes } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_family_id', familyId)
      .eq('pg_display', '1');

    if (!gammes?.length) {
      return { created: 0, skipped: 0, errors: ['No active gammes in family'] };
    }

    // Get existing briefs to avoid duplicates
    const { data: existingBriefs } = await this.client
      .from('__seo_page_brief')
      .select('pg_id, page_role')
      .in(
        'pg_id',
        gammes.map((g) => g.pg_id),
      )
      .eq('page_role', pageRole)
      .in('status', ['draft', 'validated', 'active']);

    const existingSet = new Set(
      (existingBriefs ?? []).map((b) => `${b.pg_id}_${b.page_role}`),
    );

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const gamme of gammes) {
      const key = `${gamme.pg_id}_${pageRole}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      try {
        // Build overrides from gamme-specific data
        const overrides = await this.buildGammeOverrides(
          gamme.pg_id,
          gamme.pg_alias,
          gamme.pg_name,
        );

        const overridesHash = this.computeOverridesHash(overrides);

        if (!dryRun) {
          // Merge template + overrides
          const merged = this.mergeTemplateWithOverrides(
            template.template_json,
            overrides,
          );

          const hasRag = await this.checkRagCorpusExists(gamme.pg_alias);
          const keywordCount = await this.getKeywordCount(gamme.pg_id);

          await this.client.from('__seo_page_brief').insert({
            pg_id: gamme.pg_id,
            pg_alias: gamme.pg_alias,
            page_role: pageRole,
            primary_intent: merged.primary_intent || '',
            secondary_intents: merged.secondary_intents || [],
            angles_obligatoires: merged.angles_obligatoires || [],
            forbidden_overlap: merged.forbidden_overlap || [],
            faq_paa: merged.faq_paa || [],
            termes_techniques: merged.termes_techniques || [],
            preuves: merged.preuves || [],
            keywords_primary: merged.keywords_primary || null,
            keywords_secondary: merged.keywords_secondary || [],
            writing_constraints: merged.writing_constraints || [],
            template_id: template.id,
            overrides_json: overrides,
            overrides_hash: overridesHash,
            confidence_score: this.computeConfidenceScore(
              merged,
              hasRag,
              keywordCount,
            ),
            coverage_score: this.computeCoverageScore(merged),
            version: 1,
            status: 'draft',
          });
        }

        created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${gamme.pg_alias}: ${msg}`);
      }
    }

    this.logger.log(
      `Bulk brief generation for family ${familyId}/${pageRole}: ` +
        `created=${created}, skipped=${skipped}, errors=${errors.length}` +
        (dryRun ? ' (DRY RUN)' : ''),
    );

    return { created, skipped, errors };
  }

  // ── Private Helpers ──

  /**
   * Build gamme-specific overrides from DB data.
   * Uses top keywords as differentiator to avoid clone briefs.
   */
  private async buildGammeOverrides(
    pgId: number,
    pgAlias: string,
    _pgName: string,
  ): Promise<BriefOverrides> {
    const overrides: BriefOverrides = {};

    // Get top keywords for this gamme (unique differentiator)
    const { data: keywords } = await this.client
      .from('__seo_keywords')
      .select('keyword, volume')
      .eq('pg_id', pgId)
      .order('volume', { ascending: false })
      .limit(10);

    if (keywords?.length) {
      overrides.keywords_primary = keywords[0].keyword;
      overrides.keywords_secondary = keywords.slice(1).map((k) => k.keyword);

      // Use top 3 keyword patterns as angles (basic differentiation)
      overrides.angles_obligatoires = keywords
        .slice(0, 3)
        .map((k) => String(k.keyword));
    }

    // Get existing forbidden_overlap from other roles
    const { data: otherBriefs } = await this.client
      .from('__seo_page_brief')
      .select('angles_obligatoires')
      .eq('pg_alias', pgAlias)
      .eq('status', 'active');

    if (otherBriefs?.length) {
      const otherAngles = otherBriefs.flatMap(
        (b) => (b.angles_obligatoires as string[]) || [],
      );
      if (otherAngles.length > 0) {
        overrides.forbidden_overlap = otherAngles;
      }
    }

    return overrides;
  }

  private async checkRagCorpusExists(pgAlias: string): Promise<boolean> {
    // Check if a RAG file exists for this gamme
    const { data } = await this.client
      .from('__rag_content_refresh_log')
      .select('id')
      .eq('pg_alias', pgAlias)
      .not('evidence_pack', 'is', null)
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  private async getKeywordCount(pgId: number): Promise<number> {
    const { count } = await this.client
      .from('__seo_keywords')
      .select('id', { count: 'exact', head: true })
      .eq('pg_id', pgId);
    return count ?? 0;
  }
}
