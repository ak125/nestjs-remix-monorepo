/**
 * MarketingBriefsController — admin UI endpoints (ADR-036 PR-1.4).
 *
 * Routes :
 *   GET    /api/admin/marketing/briefs         — liste paginée + filtres
 *   GET    /api/admin/marketing/briefs/stats   — compteur status × business_unit
 *   GET    /api/admin/marketing/briefs/:id     — détail brief
 *   PATCH  /api/admin/marketing/briefs/:id/status  — workflow validation
 *   POST   /api/admin/marketing/briefs/:id/social-content — approved source association
 *
 * Auth : IsAdminGuard (cohérent module marketing existant).
 *
 * Validation Zod via DTO de PR-1.3 (UpdateBriefStatusSchema). Phase 1 :
 * pas d'INSERT depuis l'admin UI (les briefs viennent des agents — Phase 1.5).
 * Aucun nouveau brief ici : lecture, revue et raccordement au contenu existant.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { Request } from 'express';
import { MarketingBriefsService } from '../services/marketing-briefs.service';
import {
  UpdateBriefStatusSchema,
  LinkBriefSocialSchema,
} from '../dto/marketing-brief.dto';

@Controller('api/admin/marketing/briefs')
@UseGuards(IsAdminGuard)
export class MarketingBriefsController {
  constructor(private readonly service: MarketingBriefsService) {}

  @Get()
  async list(
    @Query('business_unit') businessUnit?: 'ECOMMERCE' | 'LOCAL' | 'HYBRID',
    @Query('status') status?: string,
    @Query('agent_id') agentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.service.listBriefs({
      business_unit: businessUnit,
      status,
      agent_id: agentId,
      page: page ? Number.parseInt(page, 10) : 1,
      limit: limit ? Number.parseInt(limit, 10) : 20,
    });
    return { success: true, data };
  }

  @Get('stats')
  async stats() {
    const data = await this.service.getBriefStats();
    return { success: true, data };
  }

  @Get(':id')
  async getById(@Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.service.getBriefById(id);
    return { success: true, data, review: this.service.getReviewState(data) };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsed = UpdateBriefStatusSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Invalid brief decision');
    const actorId = req.user?.id;
    if (
      (typeof actorId !== 'string' && typeof actorId !== 'number') ||
      !String(actorId).trim() ||
      (typeof actorId === 'number' && !Number.isSafeInteger(actorId))
    ) {
      throw new UnauthorizedException('Authenticated reviewer required');
    }
    const data = await this.service.updateBriefStatus(
      id,
      parsed.data.status,
      String(actorId),
      parsed.data.expected_updated_at,
    );
    return { success: true, data };
  }

  @Post(':id/social-content')
  async linkSocialContent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsed = LinkBriefSocialSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException('Invalid brief association');
    const actor = req.user?.id;
    if (
      (typeof actor !== 'string' && typeof actor !== 'number') ||
      !String(actor).trim() ||
      (typeof actor === 'number' && !Number.isSafeInteger(actor))
    )
      throw new UnauthorizedException('Authenticated reviewer required');
    return {
      success: true,
      data: await this.service.linkSocialContent(
        id,
        parsed.data,
        String(actor),
      ),
    };
  }
}
