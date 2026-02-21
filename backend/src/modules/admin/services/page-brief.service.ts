import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type {
  CreatePageBriefInput,
  UpdatePageBriefInput,
  ListPageBriefsQuery,
} from '../dto/page-brief.dto';

export interface PageBrief {
  id: number;
  pg_id: number;
  pg_alias: string;
  page_role: string;
  primary_intent: string;
  secondary_intents: string[];
  angles_obligatoires: string[];
  forbidden_overlap: string[];
  faq_paa: string[];
  termes_techniques: string[];
  preuves: string[];
  keywords_primary: string | null;
  keywords_secondary: string[];
  writing_constraints: string[];
  status: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  validated_at: string | null;
  /** Brief Factory 2.0: link to family template */
  template_id: number | null;
  /** Brief Factory 2.0: gamme-specific overrides (override template_json) */
  overrides_json: Record<string, unknown>;
  /** Confidence score (0.0 → 1.0): cross-source stability */
  confidence_score: number | null;
  /** Coverage score (0.0 → 1.0): % non-empty fields */
  coverage_score: number | null;
}

export interface OverlapDetail {
  field: string;
  roleA: string;
  roleB: string;
  overlapping: string[];
}

export interface OverlapReport {
  pgAlias: string;
  hasOverlap: boolean;
  details: OverlapDetail[];
}

@Injectable()
export class PageBriefService extends SupabaseBaseService {
  protected override readonly logger = new Logger(PageBriefService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  /** Resolve pg_alias → pg_id from pieces_gamme */
  private async resolvePgId(pgAlias: string): Promise<number | null> {
    const { data } = await this.client
      .from('pieces_gamme')
      .select('pg_id')
      .eq('pg_alias', pgAlias)
      .limit(1)
      .single();
    return data?.pg_id ?? null;
  }

  /** Create a new page brief */
  async create(dto: CreatePageBriefInput): Promise<PageBrief> {
    const pgId = await this.resolvePgId(dto.pgAlias);
    if (!pgId) {
      throw new NotFoundException(`Gamme not found: ${dto.pgAlias}`);
    }

    // Determine next version for this pg_id + page_role
    const { data: existing } = await this.client
      .from('__seo_page_brief')
      .select('version')
      .eq('pg_id', pgId)
      .eq('page_role', dto.pageRole)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = existing?.length ? existing[0].version + 1 : 1;

    const { data, error } = await this.client
      .from('__seo_page_brief')
      .insert({
        pg_id: pgId,
        pg_alias: dto.pgAlias,
        page_role: dto.pageRole,
        primary_intent: dto.primaryIntent,
        secondary_intents: dto.secondaryIntents,
        angles_obligatoires: dto.anglesObligatoires,
        forbidden_overlap: dto.forbiddenOverlap,
        faq_paa: dto.faqPaa,
        termes_techniques: dto.termesTechniques,
        preuves: dto.preuves,
        keywords_primary: dto.keywordsPrimary ?? null,
        keywords_secondary: dto.keywordsSecondary,
        writing_constraints: dto.writingConstraints,
        version: nextVersion,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create brief: ${error.message}`);
      throw new BadRequestException(`Failed to create brief: ${error.message}`);
    }

    return data as PageBrief;
  }

  /** Update an existing brief (only draft/validated status) */
  async update(id: number, dto: UpdatePageBriefInput): Promise<PageBrief> {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.primaryIntent !== undefined)
      payload.primary_intent = dto.primaryIntent;
    if (dto.secondaryIntents !== undefined)
      payload.secondary_intents = dto.secondaryIntents;
    if (dto.anglesObligatoires !== undefined)
      payload.angles_obligatoires = dto.anglesObligatoires;
    if (dto.forbiddenOverlap !== undefined)
      payload.forbidden_overlap = dto.forbiddenOverlap;
    if (dto.faqPaa !== undefined) payload.faq_paa = dto.faqPaa;
    if (dto.termesTechniques !== undefined)
      payload.termes_techniques = dto.termesTechniques;
    if (dto.preuves !== undefined) payload.preuves = dto.preuves;
    if (dto.keywordsPrimary !== undefined)
      payload.keywords_primary = dto.keywordsPrimary;
    if (dto.keywordsSecondary !== undefined)
      payload.keywords_secondary = dto.keywordsSecondary;
    if (dto.writingConstraints !== undefined)
      payload.writing_constraints = dto.writingConstraints;

    const { data, error } = await this.client
      .from('__seo_page_brief')
      .update(payload)
      .eq('id', id)
      .in('status', ['draft', 'validated'])
      .select()
      .single();

    if (error) {
      throw new BadRequestException(
        `Failed to update brief #${id}: ${error.message}`,
      );
    }

    return data as PageBrief;
  }

  /** Get brief by ID */
  async getById(id: number): Promise<PageBrief | null> {
    const { data } = await this.client
      .from('__seo_page_brief')
      .select('*')
      .eq('id', id)
      .single();
    return (data as PageBrief) ?? null;
  }

  /** List briefs for a gamme */
  async listByGamme(pgAlias: string): Promise<PageBrief[]> {
    const { data } = await this.client
      .from('__seo_page_brief')
      .select('*')
      .eq('pg_alias', pgAlias)
      .order('page_role', { ascending: true })
      .order('version', { ascending: false });
    return (data as PageBrief[]) ?? [];
  }

  /** List all briefs with filters */
  async listAll(
    query: ListPageBriefsQuery,
  ): Promise<{ data: PageBrief[]; total: number }> {
    let q = this.client
      .from('__seo_page_brief')
      .select('*', { count: 'exact' });

    if (query.pgAlias) q = q.eq('pg_alias', query.pgAlias);
    if (query.pageRole) q = q.eq('page_role', query.pageRole);
    if (query.status) q = q.eq('status', query.status);

    q = q
      .order('pg_alias', { ascending: true })
      .order('page_role', { ascending: true })
      .order('version', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    const { data, count } = await q;
    return { data: (data as PageBrief[]) ?? [], total: count ?? 0 };
  }

  /**
   * Validate briefs: run anti-duplicate gate on all briefs for the same gamme.
   * Sets status to 'validated' if no overlap detected.
   */
  async validate(
    briefIds: number[],
  ): Promise<{ validated: boolean; overlap: OverlapReport | null }> {
    // Load the briefs
    const { data: briefs } = await this.client
      .from('__seo_page_brief')
      .select('*')
      .in('id', briefIds);

    if (!briefs?.length) {
      throw new NotFoundException('No briefs found for given IDs');
    }

    // All briefs must belong to the same gamme
    const pgIds = [...new Set(briefs.map((b: PageBrief) => b.pg_id))];
    if (pgIds.length > 1) {
      throw new BadRequestException('All briefs must belong to the same gamme');
    }

    const pgAlias = briefs[0].pg_alias;

    // Run overlap check
    const overlapReport = this.computeOverlap(pgAlias, briefs as PageBrief[]);

    if (overlapReport.hasOverlap) {
      return { validated: false, overlap: overlapReport };
    }

    // Mark as validated
    const now = new Date().toISOString();
    const { error } = await this.client
      .from('__seo_page_brief')
      .update({ status: 'validated', validated_at: now, updated_at: now })
      .in('id', briefIds);

    if (error) {
      throw new BadRequestException(
        `Failed to validate briefs: ${error.message}`,
      );
    }

    return { validated: true, overlap: null };
  }

  /**
   * Activate a brief: sets status to 'active', archives the previous active brief
   * for the same pg_id + page_role.
   */
  async activate(id: number): Promise<PageBrief> {
    const brief = await this.getById(id);
    if (!brief) throw new NotFoundException(`Brief #${id} not found`);
    if (brief.status !== 'validated') {
      throw new BadRequestException(
        `Brief #${id} must be validated before activation (current: ${brief.status})`,
      );
    }

    // Archive the current active brief for this pg_id + page_role
    await this.client
      .from('__seo_page_brief')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('pg_id', brief.pg_id)
      .eq('page_role', brief.page_role)
      .eq('status', 'active');

    // Activate the new one
    const { data, error } = await this.client
      .from('__seo_page_brief')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error)
      throw new BadRequestException(
        `Failed to activate brief #${id}: ${error.message}`,
      );
    return data as PageBrief;
  }

  /**
   * Get the active brief for a gamme + role.
   * Used by enrichers during content generation.
   */
  async getActiveBrief(
    pgId: number,
    pageRole: string,
  ): Promise<PageBrief | null> {
    const { data } = await this.client
      .from('__seo_page_brief')
      .select('*')
      .eq('pg_id', pgId)
      .eq('page_role', pageRole)
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as PageBrief) ?? null;
  }

  /**
   * Check keyword/intent overlap between all active briefs for a gamme.
   */
  async checkOverlap(pgAlias: string): Promise<OverlapReport> {
    const { data: briefs } = await this.client
      .from('__seo_page_brief')
      .select('*')
      .eq('pg_alias', pgAlias)
      .in('status', ['draft', 'validated', 'active']);

    if (!briefs?.length) {
      return { pgAlias, hasOverlap: false, details: [] };
    }

    return this.computeOverlap(pgAlias, briefs as PageBrief[]);
  }

  /** Compute overlap between briefs of the same gamme */
  private computeOverlap(pgAlias: string, briefs: PageBrief[]): OverlapReport {
    const details: OverlapDetail[] = [];

    for (let i = 0; i < briefs.length; i++) {
      for (let j = i + 1; j < briefs.length; j++) {
        const a = briefs[i];
        const b = briefs[j];

        // Check keywords overlap
        const keywordsA = this.extractAllKeywords(a);
        const keywordsB = this.extractAllKeywords(b);
        const keywordOverlap = keywordsA.filter((k) =>
          keywordsB.some((kb) => kb.toLowerCase() === k.toLowerCase()),
        );
        if (keywordOverlap.length > 0) {
          details.push({
            field: 'keywords',
            roleA: a.page_role,
            roleB: b.page_role,
            overlapping: keywordOverlap,
          });
        }

        // Check angles vs forbidden_overlap
        const anglesInForbidden = a.angles_obligatoires.filter((angle) =>
          b.forbidden_overlap.some(
            (f) =>
              angle.toLowerCase().includes(f.toLowerCase()) ||
              f.toLowerCase().includes(angle.toLowerCase()),
          ),
        );
        if (anglesInForbidden.length > 0) {
          details.push({
            field: 'angles_vs_forbidden',
            roleA: a.page_role,
            roleB: b.page_role,
            overlapping: anglesInForbidden,
          });
        }

        // Check reverse
        const reverseAngles = b.angles_obligatoires.filter((angle) =>
          a.forbidden_overlap.some(
            (f) =>
              angle.toLowerCase().includes(f.toLowerCase()) ||
              f.toLowerCase().includes(angle.toLowerCase()),
          ),
        );
        if (reverseAngles.length > 0) {
          details.push({
            field: 'angles_vs_forbidden',
            roleA: b.page_role,
            roleB: a.page_role,
            overlapping: reverseAngles,
          });
        }
      }
    }

    return {
      pgAlias,
      hasOverlap: details.length > 0,
      details,
    };
  }

  /** Extract all keywords from a brief (primary + secondary) */
  private extractAllKeywords(brief: PageBrief): string[] {
    const keywords: string[] = [];
    if (brief.keywords_primary) keywords.push(brief.keywords_primary);
    if (Array.isArray(brief.keywords_secondary)) {
      keywords.push(...brief.keywords_secondary);
    }
    return keywords;
  }
}
