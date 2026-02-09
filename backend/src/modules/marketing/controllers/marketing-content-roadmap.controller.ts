import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { MarketingContentRoadmapService } from '../services/marketing-content-roadmap.service';

@Controller('api/admin/marketing/content-roadmap')
@UseGuards(IsAdminGuard)
export class MarketingContentRoadmapController {
  constructor(
    private readonly roadmapService: MarketingContentRoadmapService,
  ) {}

  @Get()
  async getRoadmap(
    @Query('content_type') content_type?: string,
    @Query('priority') priority?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.roadmapService.getRoadmap({
      content_type,
      priority,
      status,
      page: parseInt(page || '1'),
      limit: parseInt(limit || '20'),
    });
    return { success: true, ...data };
  }

  @Get('coverage')
  async getCoverage() {
    const data = await this.roadmapService.getCoverage();
    return { success: true, data };
  }

  @Post()
  async create(@Body() body: any) {
    const data = await this.roadmapService.create(body);
    return { success: true, data };
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.roadmapService.update(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const success = await this.roadmapService.delete(id);
    return { success };
  }
}
