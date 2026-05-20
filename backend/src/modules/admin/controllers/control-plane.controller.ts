import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import {
  RegistryReaderService,
  ControlPlaneSummary,
} from '../services/registry-reader.service';

/**
 * Read-only admin endpoint backing the `/admin/control-plane` dashboard
 * (Repository Control Plane Operational, PR-CP-3). Surfaces the canonical
 * registry (ADR-058) + the planning PR-projection (ADR-053).
 */
@Controller('api/admin/control-plane')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class ControlPlaneController {
  constructor(private readonly registryReader: RegistryReaderService) {}

  @Get()
  async getSummary(): Promise<ControlPlaneSummary> {
    return this.registryReader.getControlPlaneSummary();
  }
}
