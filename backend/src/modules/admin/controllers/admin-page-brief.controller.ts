import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { PageBriefService } from '../services/page-brief.service';
import {
  CreatePageBriefDto,
  UpdatePageBriefDto,
  ValidatePageBriefsDto,
  ListPageBriefsQueryDto,
} from '../dto/page-brief.dto';

@Controller('api/admin/page-briefs')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class AdminPageBriefController {
  constructor(private readonly pageBriefService: PageBriefService) {}

  /**
   * GET /api/admin/page-briefs
   * List all briefs with optional filters.
   */
  @Get()
  async listAll(@Query() rawQuery: Record<string, string>) {
    const parsed = ListPageBriefsQueryDto.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.pageBriefService.listAll(parsed.data);
  }

  /**
   * GET /api/admin/page-briefs/gamme/:pgAlias
   * List all briefs for a gamme.
   */
  @Get('gamme/:pgAlias')
  async listByGamme(@Param('pgAlias') pgAlias: string) {
    return this.pageBriefService.listByGamme(pgAlias);
  }

  /**
   * GET /api/admin/page-briefs/overlap/:pgAlias
   * Check keyword/intent overlap for a gamme.
   */
  @Get('overlap/:pgAlias')
  async checkOverlap(@Param('pgAlias') pgAlias: string) {
    return this.pageBriefService.checkOverlap(pgAlias);
  }

  /**
   * GET /api/admin/page-briefs/:id
   * Get a brief by ID.
   */
  @Get(':id')
  async getById(@Param('id') id: string) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException('Invalid ID');
    }
    const brief = await this.pageBriefService.getById(numId);
    if (!brief) {
      throw new NotFoundException(`Brief #${id} not found`);
    }
    return brief;
  }

  /**
   * POST /api/admin/page-briefs
   * Create a new page brief.
   */
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const parsed = CreatePageBriefDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.pageBriefService.create(parsed.data);
  }

  /**
   * POST /api/admin/page-briefs/validate
   * Validate briefs (anti-duplicate gate).
   */
  @Post('validate')
  async validate(@Body() body: Record<string, unknown>) {
    const parsed = ValidatePageBriefsDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.pageBriefService.validate(parsed.data.briefIds);
  }

  /**
   * PATCH /api/admin/page-briefs/:id
   * Update a brief (draft or validated only).
   */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException('Invalid ID');
    }
    const parsed = UpdatePageBriefDto.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.pageBriefService.update(numId, parsed.data);
  }

  /**
   * PATCH /api/admin/page-briefs/:id/activate
   * Activate a validated brief (archives previous active).
   */
  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException('Invalid ID');
    }
    return this.pageBriefService.activate(numId);
  }
}
