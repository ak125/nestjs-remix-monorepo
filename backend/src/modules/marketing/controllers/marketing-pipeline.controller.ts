import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import {
  DomainValidationException,
  OperationFailedException,
} from '@common/exceptions';
import {
  parsePipelineInput,
  pipelineCopySchema,
  pipelinePlanSchema,
  pipelineWeekSchema,
} from '../dto/marketing-pipeline.dto';
import { MarketingHubDataService } from '../services/marketing-hub-data.service';
import { WeeklyPlanGeneratorService } from '../services/weekly-plan-generator.service';
import { MultiChannelCopywriterService } from '../services/multi-channel-copywriter.service';
import { BrandComplianceGateService } from '../services/brand-compliance-gate.service';
import type {
  PriorityGamme,
  DaySlot,
  PostStatus,
} from '../interfaces/marketing-hub.interfaces';

@Controller('api/admin/marketing/pipeline')
@UseGuards(IsAdminGuard)
export class MarketingPipelineController {
  constructor(
    private readonly hubData: MarketingHubDataService,
    private readonly planGenerator: WeeklyPlanGeneratorService,
    private readonly copywriter: MultiChannelCopywriterService,
    private readonly gateService: BrandComplianceGateService,
  ) {}

  /**
   * POST /api/admin/marketing/pipeline/plan
   * Generate a weekly plan. Resolves gamme aliases to real pg_ids.
   */
  @Post('plan')
  async generatePlan(@Body() input: unknown) {
    const body = parsePipelineInput(pipelinePlanSchema, input);

    let priorityGammes: PriorityGamme[] | undefined;

    if (body.gamme_aliases && body.gamme_aliases.length > 0) {
      priorityGammes = await this.resolveGammeAliases(body.gamme_aliases);
    }

    const plan = await this.planGenerator.generatePlan({
      week_iso: body.week_iso,
      priority_gammes: priorityGammes,
    });

    if (!plan) {
      return { error: 'Failed to generate plan' };
    }

    return {
      success: true,
      data: {
        week_iso: plan.week_iso,
        status: plan.status,
        slots: (plan.plan_json as DaySlot[]).length,
        priority_gammes: plan.priority_gammes,
        plan_json: plan.plan_json,
      },
    };
  }

  /**
   * GET /api/admin/marketing/pipeline/plan/:week
   * View an existing plan.
   */
  @Get('plan/:week')
  async getPlan(@Param('week') week: string) {
    parsePipelineInput(pipelineWeekSchema, { week_iso: week });
    const plan = await this.hubData.getWeeklyPlan(week);
    if (!plan) {
      return { error: `No plan found for ${week}` };
    }
    return { success: true, data: plan };
  }

  /**
   * POST /api/admin/marketing/pipeline/generate
   * Generate copy for all slots in a weekly plan.
   */
  @Post('generate')
  async generateCopy(@Body() input: unknown) {
    const body = parsePipelineInput(pipelineCopySchema, input);

    // A simulation must not load a shared plan or touch the provider/cache.
    if (body.dry_run === true) {
      return {
        success: true,
        data: await this.copywriter.generateBatch([], body.week_iso, true),
      };
    }

    const plan = await this.hubData.getWeeklyPlan(body.week_iso);
    if (!plan) {
      return {
        error: `No plan found for ${body.week_iso}. Generate a plan first.`,
      };
    }

    const slots = plan.plan_json as DaySlot[];
    const result = await this.copywriter.generateBatch(
      slots,
      body.week_iso,
      body.dry_run ?? false,
    );

    // Update plan status
    if (!body.dry_run && result.generated > 0) {
      const saved = await this.hubData.upsertWeeklyPlan({
        week_iso: body.week_iso,
        status: 'in_progress',
        posts_generated: result.generated,
      });
      if (!saved) {
        throw new OperationFailedException({
          message: 'Generated posts exist but plan progress was not persisted',
        });
      }
    }

    return {
      success: result.generated > 0 && result.errors === 0,
      data: result,
    };
  }

  /**
   * POST /api/admin/marketing/pipeline/gate-all
   * Run brand + compliance gates on all generated posts.
   */
  @Post('gate-all')
  async gateAll(@Body() input: unknown) {
    const body = parsePipelineInput(pipelineWeekSchema, input);

    const posts = await this.hubData.getPostsByWeek(
      body.week_iso,
      'generated' as PostStatus,
    );

    if (posts.length === 0) {
      return {
        error: `No generated posts found for ${body.week_iso}. Generate copy first.`,
      };
    }

    let passed = 0;
    let warned = 0;
    let failed = 0;
    const details: Array<{
      post_id: number;
      slot_label: string;
      brand: string;
      compliance: string;
      blocking_issues: string[];
    }> = [];

    for (const post of posts) {
      const summary = await this.gateService.evaluateAndPersist(post);

      const entry = {
        post_id: post.id,
        slot_label: post.slot_label,
        brand: summary.brand.level,
        compliance: summary.compliance.level,
        blocking_issues: summary.blocking_issues,
      };
      details.push(entry);

      if (
        summary.brand.level === 'FAIL' ||
        summary.compliance.level === 'FAIL'
      ) {
        failed++;
      } else if (
        summary.brand.level === 'WARN' ||
        summary.compliance.level === 'WARN'
      ) {
        warned++;
      } else {
        passed++;
      }
    }

    return {
      success: true,
      data: { passed, warned, failed, total: posts.length, details },
    };
  }

  /**
   * GET /api/admin/marketing/pipeline/status/:week
   * Pipeline status aggregation.
   */
  @Get('status/:week')
  async getStatus(@Param('week') week: string) {
    parsePipelineInput(pipelineWeekSchema, { week_iso: week });
    const plan = await this.hubData.getWeeklyPlan(week);
    const allPosts = await this.hubData.getPostsByWeek(week);

    const statusCounts: Record<string, number> = {};
    for (const post of allPosts) {
      statusCounts[post.status] = (statusCounts[post.status] || 0) + 1;
    }

    return {
      success: true,
      data: {
        plan_exists: !!plan,
        plan_status: plan?.status ?? null,
        plan_slots: plan ? (plan.plan_json as DaySlot[]).length : 0,
        posts: {
          total: allPosts.length,
          draft: statusCounts['draft'] || 0,
          generated: statusCounts['generated'] || 0,
          gate_passed: statusCounts['gate_passed'] || 0,
          gate_failed: statusCounts['gate_failed'] || 0,
          approved: statusCounts['approved'] || 0,
          published: statusCounts['published'] || 0,
        },
      },
    };
  }

  /**
   * Resolve gamme aliases to real PriorityGamme objects.
   */
  private async resolveGammeAliases(
    aliases: string[],
  ): Promise<PriorityGamme[]> {
    const results: PriorityGamme[] = [];

    for (const alias of aliases) {
      const gamme = await this.hubData.resolveGammeAlias(alias);
      if (!gamme) {
        throw new DomainValidationException({
          message: `Unknown gamme alias: ${alias}`,
          field: 'gamme_aliases',
        });
      }
      results.push(gamme);
    }

    return results;
  }
}
