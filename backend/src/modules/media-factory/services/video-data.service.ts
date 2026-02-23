import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type {
  VideoProduction,
  VideoTemplate,
  VideoAsset,
  VideoGateResult,
} from '../types/video.types';
import type {
  VideoType,
  VideoStatus,
} from '../../../config/video-quality.constants';

// ─────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────

export interface CreateProductionDto {
  briefId: string;
  videoType: VideoType;
  vertical: string;
  gammeAlias?: string;
  pgId?: number;
  templateId?: string;
  createdBy: string;
}

export interface UpdateProductionDto {
  status?: VideoStatus;
  knowledgeContract?: Record<string, unknown>;
  claimTable?: unknown[];
  evidencePack?: unknown[];
  disclaimerPlan?: { disclaimers: unknown[] };
  approvalRecord?: { briefId: string; stages: unknown[] };
  qualityScore?: number;
  qualityFlags?: string[];
  gateResults?: VideoGateResult[];
}

export interface ProductionFilters {
  status?: VideoStatus;
  vertical?: string;
  videoType?: VideoType;
  search?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AssetFilters {
  visualType?: string;
  validated?: boolean;
}

export interface DashboardStats {
  total: number;
  byStatus: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

@Injectable()
export class VideoDataService extends SupabaseBaseService {
  protected override readonly logger = new Logger(VideoDataService.name);

  constructor(configService: ConfigService) {
    super(configService);
  }

  // ── Productions ──

  async listProductions(
    filters: ProductionFilters,
    pagination: PaginationParams,
  ): Promise<{ data: VideoProduction[]; total: number }> {
    const {
      page,
      limit,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = pagination;
    const offset = (page - 1) * limit;

    let query = this.client
      .from('__video_productions')
      .select('*', { count: 'exact' });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.vertical) query = query.eq('vertical', filters.vertical);
    if (filters.videoType) query = query.eq('video_type', filters.videoType);
    if (filters.search) query = query.ilike('brief_id', `%${filters.search}%`);

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      this.logger.error(`listProductions error: ${error.message}`);
      throw error;
    }

    return {
      data: (data ?? []).map(this.mapProduction),
      total: count ?? 0,
    };
  }

  async getProduction(briefId: string): Promise<VideoProduction> {
    const { data, error } = await this.client
      .from('__video_productions')
      .select('*')
      .eq('brief_id', briefId)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Production not found: ${briefId}`);
    }

    return this.mapProduction(data);
  }

  async createProduction(dto: CreateProductionDto): Promise<VideoProduction> {
    const { data, error } = await this.client
      .from('__video_productions')
      .insert({
        brief_id: dto.briefId,
        video_type: dto.videoType,
        vertical: dto.vertical,
        gamme_alias: dto.gammeAlias ?? null,
        pg_id: dto.pgId ?? null,
        template_id: dto.templateId ?? null,
        created_by: dto.createdBy,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`createProduction error: ${error.message}`);
      throw error;
    }

    return this.mapProduction(data);
  }

  async updateProduction(
    briefId: string,
    updates: UpdateProductionDto,
  ): Promise<VideoProduction> {
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.knowledgeContract !== undefined)
      dbUpdates.knowledge_contract = updates.knowledgeContract;
    if (updates.claimTable !== undefined)
      dbUpdates.claim_table = updates.claimTable;
    if (updates.evidencePack !== undefined)
      dbUpdates.evidence_pack = updates.evidencePack;
    if (updates.disclaimerPlan !== undefined)
      dbUpdates.disclaimer_plan = updates.disclaimerPlan;
    if (updates.approvalRecord !== undefined)
      dbUpdates.approval_record = updates.approvalRecord;
    if (updates.qualityScore !== undefined)
      dbUpdates.quality_score = updates.qualityScore;
    if (updates.qualityFlags !== undefined)
      dbUpdates.quality_flags = updates.qualityFlags;
    if (updates.gateResults !== undefined)
      dbUpdates.gate_results = updates.gateResults;

    const { data, error } = await this.client
      .from('__video_productions')
      .update(dbUpdates)
      .eq('brief_id', briefId)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException(`Production not found: ${briefId}`);
    }

    return this.mapProduction(data);
  }

  // ── Templates ──

  async listTemplates(): Promise<VideoTemplate[]> {
    const { data, error } = await this.client
      .from('__video_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`listTemplates error: ${error.message}`);
      return [];
    }

    return (data ?? []).map(this.mapTemplate);
  }

  // ── Assets ──

  async listAssets(filters: AssetFilters): Promise<VideoAsset[]> {
    let query = this.client.from('__video_assets').select('*');

    if (filters.visualType) query = query.eq('visual_type', filters.visualType);
    if (filters.validated !== undefined)
      query = query.eq('validated', filters.validated);

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      this.logger.error(`listAssets error: ${error.message}`);
      return [];
    }

    return (data ?? []).map(this.mapAsset);
  }

  async createAsset(dto: {
    assetKey: string;
    visualType: string;
    truthDependency?: string;
    tags?: string[];
    filePath?: string;
  }): Promise<VideoAsset> {
    const { data, error } = await this.client
      .from('__video_assets')
      .insert({
        asset_key: dto.assetKey,
        visual_type: dto.visualType,
        truth_dependency: dto.truthDependency ?? 'illustration',
        tags: dto.tags ?? [],
        file_path: dto.filePath ?? null,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`createAsset error: ${error.message}`);
      throw error;
    }

    return this.mapAsset(data);
  }

  async validateAsset(
    assetKey: string,
    validatedBy: string,
  ): Promise<VideoAsset> {
    const { data, error } = await this.client
      .from('__video_assets')
      .update({ validated: true, validated_by: validatedBy })
      .eq('asset_key', assetKey)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException(`Asset not found: ${assetKey}`);
    }

    return this.mapAsset(data);
  }

  // ── Dashboard ──

  async getDashboardStats(): Promise<DashboardStats> {
    const { data, error } = await this.client
      .from('__video_productions')
      .select('status');

    if (error) {
      this.logger.error(`getDashboardStats error: ${error.message}`);
      return { total: 0, byStatus: {} };
    }

    const rows = data ?? [];
    const byStatus: Record<string, number> = {};
    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    }

    return { total: rows.length, byStatus };
  }

  // ── Mappers (snake_case → camelCase) ──

  private mapProduction = (row: Record<string, unknown>): VideoProduction => ({
    id: row.id as number,
    briefId: row.brief_id as string,
    videoType: row.video_type as VideoType,
    vertical: row.vertical as string,
    gammeAlias: row.gamme_alias as string | undefined,
    pgId: row.pg_id as number | undefined,
    status: row.status as VideoStatus,
    templateId: row.template_id as string | undefined,
    knowledgeContract: row.knowledge_contract as Record<string, unknown> | null,
    claimTable: row.claim_table as VideoProduction['claimTable'],
    evidencePack: row.evidence_pack as VideoProduction['evidencePack'],
    disclaimerPlan: row.disclaimer_plan as VideoProduction['disclaimerPlan'],
    approvalRecord: row.approval_record as VideoProduction['approvalRecord'],
    qualityScore: row.quality_score as number | null,
    qualityFlags: (row.quality_flags as string[]) ?? [],
    gateResults: row.gate_results as VideoGateResult[] | null,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  });

  private mapTemplate = (row: Record<string, unknown>): VideoTemplate => ({
    id: row.id as number,
    templateId: row.template_id as string,
    version: row.version as number,
    videoType: row.video_type as VideoType,
    platform: row.platform as VideoTemplate['platform'],
    allowedUseCases: (row.allowed_use_cases as string[]) ?? [],
    forbiddenUseCases: (row.forbidden_use_cases as string[]) ?? [],
    durationRange: row.duration_range as { min: number; max: number },
    structure: row.structure as Record<string, unknown>,
    createdAt: row.created_at as string,
  });

  private mapAsset = (row: Record<string, unknown>): VideoAsset => ({
    id: row.id as number,
    assetKey: row.asset_key as string,
    visualType: row.visual_type as VideoAsset['visualType'],
    truthDependency: row.truth_dependency as VideoAsset['truthDependency'],
    tags: (row.tags as string[]) ?? [],
    filePath: row.file_path as string | undefined,
    validated: row.validated as boolean,
    validatedBy: row.validated_by as string | undefined,
    createdAt: row.created_at as string,
  });
}
