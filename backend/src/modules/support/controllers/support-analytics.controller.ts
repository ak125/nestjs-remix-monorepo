import { Controller, Get, Query, Logger } from '@nestjs/common';
import { SupportAnalyticsService } from '../services/support-analytics.service';

@Controller('api/support/analytics')
export class SupportAnalyticsController {
  private readonly logger = new Logger(SupportAnalyticsController.name);

  constructor(private supportAnalyticsService: SupportAnalyticsService) {}

  @Get()
  async getAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;

    return this.supportAnalyticsService.getAnalytics(period);
  }

  @Get('agents')
  async getAgentPerformance(@Query('agentId') agentId?: string) {
    return this.supportAnalyticsService.getAgentPerformance(agentId);
  }

  @Get('report')
  async generateReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required for reports');
    }

    const period = {
      start: new Date(startDate),
      end: new Date(endDate),
    };

    return this.supportAnalyticsService.generateReport(period);
  }

  @Get('kpis')
  async getKPIs() {
    return this.supportAnalyticsService.getKPIs();
  }

  @Get('workload')
  async getWorkloadDistribution() {
    return this.supportAnalyticsService.getWorkloadDistribution();
  }

  @Get('satisfaction-trend')
  async getSatisfactionTrend(@Query('days') days?: string) {
    const daysNumber = days ? parseInt(days) : 30;
    return this.supportAnalyticsService.getSatisfactionTrend(daysNumber);
  }
}
