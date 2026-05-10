import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { AdminHealthService } from '../services/admin-health.service';
import { MailService } from '../../../services/mail.service';

@Controller('api/admin/health')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(AdminResponseInterceptor)
export class AdminHealthController {
  constructor(
    private readonly healthService: AdminHealthService,
    private readonly mailService: MailService,
  ) {}

  /**
   * GET /api/admin/health/overview
   * Aggregated health check: DB + Redis + BullMQ + Memory
   */
  @Get('overview')
  async getOverview() {
    return this.healthService.getOverview();
  }

  /**
   * GET /api/admin/health/email
   * Test Gmail SMTP connection (does NOT send an email)
   */
  @Get('email')
  async testEmail() {
    const connected = await this.mailService.testConnection();
    return {
      service: 'email',
      status: connected ? 'ok' : 'error',
      provider: 'gmail',
      message: connected
        ? 'Connexion Gmail SMTP OK'
        : 'Connexion Gmail echouee — verifier GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN',
    };
  }
}
