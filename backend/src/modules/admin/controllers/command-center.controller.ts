import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import {
  CommandCenterReaderService,
  CommandCenterResponse,
} from '../services/command-center-reader.service';

/**
 * Read-only admin endpoint backing the `/admin/command-center` cockpit.
 * Surfaces the deterministic AI Operating Map projection
 * (audit/registry/command-center-snapshot.json) + live envelope (stale/validation/
 * global_status/health_score_current). Read-only — no mutation, no DB write.
 */
@Controller('api/admin/command-center')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class CommandCenterController {
  constructor(private readonly reader: CommandCenterReaderService) {}

  @Get()
  async getSummary(): Promise<CommandCenterResponse> {
    return this.reader.getCommandCenter();
  }
}
