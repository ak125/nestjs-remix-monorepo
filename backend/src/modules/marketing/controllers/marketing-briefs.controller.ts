/**
 * MarketingBriefsController — admin UI endpoints (ADR-036 PR-1.4).
 *
 * Routes :
 *   GET    /api/admin/marketing/briefs         — liste paginée + filtres
 *   GET    /api/admin/marketing/briefs/stats   — compteur status × business_unit
 *   GET    /api/admin/marketing/briefs/:id     — détail brief
 *   PATCH  /api/admin/marketing/briefs/:id/status  — workflow validation
 *
 * Auth : IsAdminGuard (cohérent module marketing existant).
 *
 * Validation Zod via DTO de PR-1.3 (UpdateBriefStatusSchema). Phase 1 :
 * pas d'INSERT depuis l'admin UI (les briefs viennent des agents — Phase 1.5).
 * Donc pas de POST /briefs ici, juste lecture + update status.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { Request } from 'express';
import { MarketingBriefsService } from '../services/marketing-briefs.service';
import { UpdateBriefStatusSchema } from '../dto/marketing-brief.dto';

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
  async getById(@Param('id') id: string) {
    const data = await this.service.getBriefById(id);
    return { success: true, data };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    // Validation Zod (DTO PR-1.3)
    const parsed = UpdateBriefStatusSchema.parse(body);

    // Acteur = utilisateur authentifié (admin via IsAdminGuard).
    const user = (req as Request & { user?: { email?: string } }).user;
    const actor =
      parsed.reviewed_by ||
      parsed.approved_by ||
      user?.email ||
      'admin-unknown';

    if (
      parsed.status !== 'reviewed' &&
      parsed.status !== 'approved' &&
      parsed.status !== 'published' &&
      parsed.status !== 'archived'
    ) {
      // 'draft' n'est pas une transition admin (status initial agent).
      throw new Error(
        `Status transition '${parsed.status}' not allowed via admin UI`,
      );
    }

    const data = await this.service.updateBriefStatus(id, parsed.status, actor);
    return { success: true, data };
  }
}
