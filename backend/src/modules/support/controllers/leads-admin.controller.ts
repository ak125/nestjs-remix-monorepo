import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { LeadsService } from '../services/leads.service';
import {
  updateLeadFieldsSchema,
  updateLeadStatusSchema,
  listLeadsQuerySchema,
  type UpdateLeadFieldsDto,
  type UpdateLeadStatusDto,
  type ListLeadsQueryDto,
} from '../dto/lead.schemas';

interface RequestWithUser {
  user?: {
    id?: string | number;
    cnfa_id?: string;
    email?: string;
  };
}

@Controller('admin/leads')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class LeadsAdminController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(listLeadsQuerySchema))
    query: ListLeadsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.leadsService.listLeads(query);
    res.setHeader('X-Total-Count', String(result.total));
    return result;
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.leadsService.getLead(id);
  }

  @Patch(':id')
  async updateFields(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLeadFieldsSchema))
    body: UpdateLeadFieldsDto,
  ) {
    return this.leadsService.updateLeadFields(id, body);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLeadStatusSchema))
    body: UpdateLeadStatusDto,
    @Req() req: RequestWithUser,
  ) {
    const actorId = req.user?.cnfa_id ?? String(req.user?.id ?? '') ?? null;
    return this.leadsService.updateLeadStatus(id, body.status, actorId || null);
  }

  @Delete(':id/follow-up')
  @HttpCode(HttpStatus.OK)
  async clearFollowUp(@Param('id') id: string) {
    return this.leadsService.clearFollowUp(id);
  }
}
