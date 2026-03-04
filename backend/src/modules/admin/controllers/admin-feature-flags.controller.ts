import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { FeatureFlagsService } from '../../../config/feature-flags.service';

@Controller('api/admin/feature-flags')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class AdminFeatureFlagsController {
  private readonly logger = new Logger(AdminFeatureFlagsController.name);

  constructor(private readonly featureFlags: FeatureFlagsService) {}

  @Get()
  listFlags() {
    return this.featureFlags.listFlags();
  }

  @Get('canary-gammes')
  getCanaryGammes() {
    return this.featureFlags.canaryGammes;
  }

  @Patch(':key')
  setOverride(
    @Param('key') key: string,
    @Body() body: { value: string },
    @Req() req: any,
  ) {
    if (!body?.value && body?.value !== '') {
      throw new BadRequestException('body.value is required');
    }
    const flags = this.featureFlags.listFlags();
    const oldValue = flags[key]?.effective ?? '';
    try {
      this.featureFlags.setOverride(key, body.value);
    } catch {
      throw new BadRequestException(`Unknown flag key: ${key}`);
    }
    const adminUser = req.user?.email?.trim() || 'admin';
    this.logger.log(
      `[FLAG_OVERRIDE] ${adminUser} set ${key}=${body.value} (was: ${oldValue})`,
    );
    return { key, value: body.value, volatile: true };
  }

  @Delete(':key')
  clearOverride(@Param('key') key: string, @Req() req: any) {
    try {
      this.featureFlags.setOverride(key, ''); // validates key exists
      this.featureFlags.clearOverride(key);
    } catch {
      throw new BadRequestException(`Unknown flag key: ${key}`);
    }
    const adminUser = req.user?.email?.trim() || 'admin';
    this.logger.log(`[FLAG_OVERRIDE] ${adminUser} cleared override for ${key}`);
    return { key, cleared: true };
  }
}
