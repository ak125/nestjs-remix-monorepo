import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { DbGovernanceService } from '../../system/services/db-governance.service';
import { MetricId } from '../../system/types/db-governance.types';

const VALID_METRICS: MetricId[] = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];

@Controller('api/admin/db-governance')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class AdminDbGovernanceController {
  constructor(private readonly governanceService: DbGovernanceService) {}

  @Get('metrics')
  async getAllMetrics() {
    return this.governanceService.runAllMetrics();
  }

  @Get('metrics/:id')
  async getMetric(@Param('id') id: string) {
    const metricId = id.toUpperCase() as MetricId;
    if (!VALID_METRICS.includes(metricId)) {
      throw new BadRequestException(
        `Invalid metric ID: ${id}. Valid: ${VALID_METRICS.join(', ')}`,
      );
    }
    return this.governanceService.runMetric(metricId);
  }

  @Post('snapshot')
  async createSnapshot() {
    return this.governanceService.collectAndStore();
  }

  @Get('history')
  async getHistory(
    @Query('metric') metric?: string,
    @Query('limit') limit?: string,
  ) {
    const metricId = metric?.toUpperCase() as MetricId | undefined;
    if (metricId && !VALID_METRICS.includes(metricId)) {
      throw new BadRequestException(
        `Invalid metric ID: ${metric}. Valid: ${VALID_METRICS.join(', ')}`,
      );
    }
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.governanceService.getHistory(metricId, parsedLimit);
  }

  @Get('trend/:metricId')
  async getTrend(@Param('metricId') metricId: string) {
    const id = metricId.toUpperCase() as MetricId;
    if (!VALID_METRICS.includes(id)) {
      throw new BadRequestException(
        `Invalid metric ID: ${metricId}. Valid: ${VALID_METRICS.join(', ')}`,
      );
    }
    return this.governanceService.getTrend(id);
  }

  @Get('quarterly-review')
  async getQuarterlyReview() {
    return this.governanceService.getQuarterlyReview();
  }
}
