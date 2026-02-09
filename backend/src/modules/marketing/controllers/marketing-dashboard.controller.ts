import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { MarketingDashboardService } from '../services/marketing-dashboard.service';

@Controller('api/admin/marketing/dashboard')
@UseGuards(IsAdminGuard)
export class MarketingDashboardController {
  constructor(private readonly dashboardService: MarketingDashboardService) {}

  @Get()
  async getDashboard() {
    const data = await this.dashboardService.getDashboard();
    return { success: true, data };
  }

  @Get('timeline')
  async getTimeline(@Query('days') days?: string) {
    const data = await this.dashboardService.getKpiTimeline(
      parseInt(days || '90'),
    );
    return { success: true, data };
  }

  @Post('snapshot')
  async saveSnapshot(@Body() body: any) {
    const data = await this.dashboardService.saveSnapshot(body);
    return { success: true, data };
  }
}
