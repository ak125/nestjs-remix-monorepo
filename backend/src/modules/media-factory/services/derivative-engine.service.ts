/**
 * DerivativeEngineService — Extract derivative productions from a master.
 *
 * Given a master production with a claim_table, generates N derivative
 * production records (1 claim = 1 short derivative).
 *
 * Called from: POST /api/admin/video/productions/:briefId/derive
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { VideoDataService } from './video-data.service';
import type { VideoClaimEntry } from '../types/video.types';

export interface DerivativePolicy {
  maxDerivatives: number;
  claimKinds?: string[]; // filter by claim kind (e.g. ['stat', 'comparison'])
  templateId?: string; // override template for derivatives
  videoType?: string; // default: 'short'
}

export interface DeriveResult {
  masterBriefId: string;
  derivativesCreated: number;
  derivatives: Array<{
    briefId: string;
    derivativeIndex: number;
    claimId: string;
    claimText: string;
  }>;
  skipped: number;
  policy: DerivativePolicy;
}

const DEFAULT_POLICY: DerivativePolicy = {
  maxDerivatives: 10,
  videoType: 'short',
};

@Injectable()
export class DerivativeEngineService extends SupabaseBaseService {
  protected override readonly logger = new Logger(DerivativeEngineService.name);

  constructor(
    configService: ConfigService,
    private readonly dataService: VideoDataService,
  ) {
    super(configService);
  }

  /**
   * Generate derivative productions from a master's claim table.
   * Each verified claim becomes one short derivative.
   */
  async deriveFromMaster(
    masterBriefId: string,
    policyOverride?: Partial<DerivativePolicy>,
  ): Promise<DeriveResult> {
    const master = await this.dataService.getProduction(masterBriefId);

    if (master.contentRole !== 'master_truth') {
      throw new BadRequestException(
        `Production ${masterBriefId} is not a master (content_role=${master.contentRole})`,
      );
    }

    if (!master.claimTable || master.claimTable.length === 0) {
      throw new BadRequestException(
        `Production ${masterBriefId} has no claims — generate a script first`,
      );
    }

    // Merge policy: stored derivative_policy + override + defaults
    const storedPolicy = (master.derivativePolicy ??
      {}) as Partial<DerivativePolicy>;
    const policy: DerivativePolicy = {
      ...DEFAULT_POLICY,
      ...storedPolicy,
      ...policyOverride,
    };

    // Filter eligible claims
    let eligibleClaims = master.claimTable.filter(
      (c: VideoClaimEntry) => c.status === 'verified',
    );

    if (policy.claimKinds && policy.claimKinds.length > 0) {
      eligibleClaims = eligibleClaims.filter((c: VideoClaimEntry) =>
        policy.claimKinds!.includes(c.kind),
      );
    }

    // Check existing derivatives to avoid duplicates
    const { data: existing } = await this.client
      .from('__video_productions')
      .select('derivative_index')
      .eq('parent_brief_id', masterBriefId);

    const existingIndices = new Set(
      (existing ?? []).map(
        (r: Record<string, unknown>) => r.derivative_index as number,
      ),
    );

    // Build derivatives
    const derivatives: DeriveResult['derivatives'] = [];
    let skipped = 0;
    let derivativeIndex = 0;

    for (const claim of eligibleClaims) {
      if (derivatives.length >= policy.maxDerivatives) break;

      derivativeIndex++;

      // Skip if already derived
      if (existingIndices.has(derivativeIndex)) {
        skipped++;
        continue;
      }

      const claimId = claim.id as string;
      const claimText = claim.rawText as string;
      const briefId = `${masterBriefId}-d${String(derivativeIndex).padStart(2, '0')}`;

      // Create derivative production record
      const { error } = await this.client
        .from('__video_productions')
        .insert({
          brief_id: briefId,
          video_type: policy.videoType ?? 'short',
          vertical: master.vertical,
          gamme_alias: master.gammeAlias ?? null,
          pg_id: master.pgId ?? null,
          template_id: policy.templateId ?? master.templateId ?? null,
          created_by: 'derivative-engine',
          status: 'draft',
          content_role: 'derivative',
          parent_brief_id: masterBriefId,
          derivative_index: derivativeIndex,
          // Pre-populate script from single claim
          script_text: claimText,
          claim_table: [claim],
          evidence_pack: master.evidencePack ?? [],
          disclaimer_plan: master.disclaimerPlan ?? { disclaimers: [] },
          knowledge_contract: master.knowledgeContract ?? {},
        })
        .select()
        .single();

      if (error) {
        this.logger.error(
          `Failed to create derivative ${briefId}: ${error.message}`,
        );
        skipped++;
        continue;
      }

      derivatives.push({ briefId, derivativeIndex, claimId, claimText });
    }

    // Update master's derivative_policy with the resolved policy
    await this.client
      .from('__video_productions')
      .update({
        derivative_policy: policy as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq('brief_id', masterBriefId);

    this.logger.log(
      `[DERIVE] ${masterBriefId}: created ${derivatives.length} derivatives, skipped ${skipped}`,
    );

    return {
      masterBriefId,
      derivativesCreated: derivatives.length,
      derivatives,
      skipped,
      policy,
    };
  }

  /**
   * List derivatives for a master production.
   */
  async listDerivatives(masterBriefId: string) {
    const { data, error } = await this.client
      .from('__video_productions')
      .select('*')
      .eq('parent_brief_id', masterBriefId)
      .order('derivative_index', { ascending: true });

    if (error) {
      this.logger.error(`listDerivatives error: ${error.message}`);
      return [];
    }

    return data ?? [];
  }
}
