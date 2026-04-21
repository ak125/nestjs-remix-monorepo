import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  BrandFaqEntrySchema,
  BrandIssueSchema,
  BrandMaintenanceTipSchema,
  type BrandFaqEntry,
  type BrandIssue,
  type BrandMaintenanceTip,
} from '../../../config/brand-rag-frontmatter.schema';

/**
 * Service for CRUD on __seo_brand_editorial.
 * Validates payloads against Zod sub-schemas (shared with brand RAG contract).
 * Used by admin UI (AdminR7BrandController) and by build-brand-rag.py (read-only).
 */

export const BrandEditorialPayloadSchema = z.object({
  faq: z.array(BrandFaqEntrySchema).max(15).optional(),
  common_issues: z.array(BrandIssueSchema).max(20).optional(),
  maintenance_tips: z.array(BrandMaintenanceTipSchema).max(20).optional(),
  curated_by: z.string().min(1).max(120).optional(),
});

export type BrandEditorialPayload = z.infer<typeof BrandEditorialPayloadSchema>;

export interface BrandEditorialRow {
  marque_id: number;
  faq: BrandFaqEntry[];
  common_issues: BrandIssue[];
  maintenance_tips: BrandMaintenanceTip[];
  curated_by: string | null;
  updated_at: string;
  created_at: string;
}

@Injectable()
export class BrandEditorialService extends SupabaseBaseService {
  protected override readonly logger = new Logger(BrandEditorialService.name);
  private readonly TABLE = '__seo_brand_editorial';

  constructor(configService: ConfigService) {
    super(configService);
  }

  async findOne(marqueId: number): Promise<BrandEditorialRow | null> {
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select('*')
      .eq('marque_id', marqueId)
      .maybeSingle();
    if (error) {
      this.logger.error(`findOne(${marqueId}) failed: ${error.message}`);
      throw error;
    }
    return (data as BrandEditorialRow | null) ?? null;
  }

  async upsert(
    marqueId: number,
    payload: BrandEditorialPayload,
  ): Promise<BrandEditorialRow> {
    const validated = BrandEditorialPayloadSchema.parse(payload);
    const row = {
      marque_id: marqueId,
      ...(validated.faq !== undefined && { faq: validated.faq }),
      ...(validated.common_issues !== undefined && {
        common_issues: validated.common_issues,
      }),
      ...(validated.maintenance_tips !== undefined && {
        maintenance_tips: validated.maintenance_tips,
      }),
      ...(validated.curated_by && { curated_by: validated.curated_by }),
    };
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .upsert(row, { onConflict: 'marque_id' })
      .select()
      .single();
    if (error) {
      this.logger.error(`upsert(${marqueId}) failed: ${error.message}`);
      throw error;
    }
    return data as BrandEditorialRow;
  }
}
