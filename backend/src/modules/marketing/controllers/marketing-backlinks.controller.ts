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
import { MarketingBacklinksService } from '../services/marketing-backlinks.service';

@Controller('api/admin/marketing/backlinks')
@UseGuards(IsAdminGuard)
export class MarketingBacklinksController {
  constructor(private readonly backlinksService: MarketingBacklinksService) {}

  @Get()
  async getBacklinks(
    @Query('status') status?: string,
    @Query('min_da') min_da?: string,
    @Query('domain') domain?: string,
    @Query('source_category') source_category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.backlinksService.getBacklinks({
      status,
      min_da: min_da ? parseInt(min_da) : undefined,
      domain,
      source_category,
      page: parseInt(page || '1'),
      limit: parseInt(limit || '20'),
    });
    return { success: true, ...data };
  }

  @Get('stats')
  async getStats() {
    const data = await this.backlinksService.getStats();
    return { success: true, data };
  }

  @Post()
  async create(@Body() body: any) {
    const data = await this.backlinksService.create(body);
    return { success: true, data };
  }

  @Post('import')
  async bulkImport(@Body() body: any[]) {
    const count = await this.backlinksService.bulkImport(body);
    return { success: true, imported: count };
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const data = await this.backlinksService.update(id, body);
    return { success: true, data };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const success = await this.backlinksService.delete(id);
    return { success };
  }
}
