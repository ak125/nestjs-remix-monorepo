/**
 * Mandat BT — relevé à blanc à la demande de la lecture des mails Paybox.
 *
 * POST /api/admin/paybox-mail/dry-run (admin, `canMarkPaid`, mêmes gardes que
 * la saisie d'encaissement BM). Lit et rapproche, n'écrit rien, n'envoie rien.
 * Rend des références de commande, des montants et des id de message Gmail :
 * aucune donnée client. Mode `off` ou jeton absent : rien n'est lu.
 */
import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { RequirePermission } from '@auth/decorators/require-permission.decorator';
import { PayboxMailImportService } from '../paybox-mail/paybox-mail-import.service';

@Controller('api/admin/paybox-mail')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
export class PayboxMailAdminController {
  constructor(private readonly importService: PayboxMailImportService) {}

  @Post('dry-run')
  @HttpCode(200)
  @RequirePermission('canMarkPaid')
  dryRun() {
    return this.importService.runDryRun();
  }
}
