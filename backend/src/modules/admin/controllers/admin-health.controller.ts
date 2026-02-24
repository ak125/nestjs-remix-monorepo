import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { AdminHealthService } from '../services/admin-health.service';

@Controller('api/admin/health')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class AdminHealthController {
  constructor(private readonly healthService: AdminHealthService) {}

  /**
   * GET /api/admin/health/overview
   * Aggregated health check: DB + Redis + BullMQ + Memory
   */
  @Get('overview')
  async getOverview() {
    return this.healthService.getOverview();
  }
}
