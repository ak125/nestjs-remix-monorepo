import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IsAdminGuard } from '../../auth/is-admin.guard';
import { BotGuardService } from './bot-guard.service';

@Controller('admin/bot-guard')
@UseGuards(IsAdminGuard)
export class BotGuardController {
  constructor(private readonly botGuardService: BotGuardService) {}

  @Get('stats')
  async getStats() {
    return this.botGuardService.getStats();
  }

  @Get('config')
  async getConfig() {
    return this.botGuardService.getConfig();
  }

  @Put('config')
  async updateConfig(
    @Body()
    body: {
      enabled?: boolean;
      blockedCountries?: string[];
      suspicionThreshold?: number;
    },
  ) {
    await this.botGuardService.updateConfig(body);
    return { success: true, config: await this.botGuardService.getConfig() };
  }

  @Post('block-ip')
  async blockIp(@Body() body: { ip: string; reason: string }) {
    await this.botGuardService.blockIp(body.ip, body.reason);
    return { success: true, ip: body.ip };
  }

  @Delete('block-ip/:ip')
  async unblockIp(@Param('ip') ip: string) {
    await this.botGuardService.unblockIp(ip);
    return { success: true, ip };
  }

  @Post('toggle')
  async toggle(@Body() body: { enabled: boolean }) {
    await this.botGuardService.toggle(body.enabled);
    return { success: true, enabled: body.enabled };
  }

  @Get('recent-blocks')
  async getRecentBlocks() {
    return this.botGuardService.getRecentBlocks();
  }
}
