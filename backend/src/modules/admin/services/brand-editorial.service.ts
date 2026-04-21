import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
import { PageRoleValidatorService } from '../../seo/validation/page-role-validator.service';
import { PageRole } from '../../seo/types/page-role.types';

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

  constructor(
    configService: ConfigService,
    private readonly roleValidator: PageRoleValidatorService,
  ) {
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

  /**
   * Extrait tous les champs texte du payload éditorial en un seul flux
   * destiné au scan surface-purity. On concatène FAQ Q/A, symptôme/cause/fix,
   * et note maintenance — c'est là que les admins collent parfois des URLs.
   */
  private flattenEditorialText(payload: BrandEditorialPayload): string {
    const parts: string[] = [];
    for (const entry of payload.faq ?? []) {
      parts.push(entry.q, entry.a);
    }
    for (const issue of payload.common_issues ?? []) {
      parts.push(issue.symptom);
      if (issue.cause) parts.push(issue.cause);
      if (issue.fix_hint) parts.push(issue.fix_hint);
    }
    for (const tip of payload.maintenance_tips ?? []) {
      parts.push(tip.part);
      if (tip.note) parts.push(tip.note);
    }
    return parts.join('\n');
  }

  async upsert(
    marqueId: number,
    payload: BrandEditorialPayload,
  ): Promise<BrandEditorialRow> {
    const validated = BrandEditorialPayloadSchema.parse(payload);

    // Gate surface purity : refuser toute URL cross-surface (R8 principalement)
    // collée par un admin dans FAQ / common_issues / maintenance_tips.
    const flatText = this.flattenEditorialText(validated);
    const purityViolations = this.roleValidator.validateSurfacePurity(
      flatText,
      PageRole.R7_BRAND,
    );
    if (purityViolations.length > 0) {
      this.logger.warn(
        `upsert(${marqueId}) blocked by surface-purity gate: ${purityViolations.length} violation(s)`,
      );
      throw new BadRequestException({
        message: 'Editorial content violates surface purity',
        violations: purityViolations.map((v) => ({
          message: v.message,
          details: v.details,
        })),
      });
    }

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
