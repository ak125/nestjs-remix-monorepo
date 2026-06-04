import {
  Controller,
  Get,
  NotFoundException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
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
 *
 * Exposure gated by COMMAND_CENTER_MODE (full/light/disabled; prod-safe default
 * = disabled in PROD). `disabled` → 404 (reduces surface, does not reveal data);
 * `light` → top-line health only (the reader strips internal detail).
 */
@Controller('api/admin/command-center')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class CommandCenterController {
  constructor(private readonly reader: CommandCenterReaderService) {}

  @Get()
  async getSummary(): Promise<CommandCenterResponse> {
    if (this.reader.getMode() === 'disabled') {
      throw new NotFoundException(
        'Command Center is disabled in this environment',
      );
    }
    return this.reader.getCommandCenter();
  }
}
