/**
 * Mandat BM — routes de facturation à l'expédition.
 *
 * Admin : `api/admin/orders/:orderId/billing/*` (mêmes gardes que les actions
 * back-office). Client : `api/orders/:orderId/invoice.pdf`, propriétaire seul.
 * Tout passe par `OrderBillingService`, inerte tant que
 * `ORDER_BILLING_ENABLED` n'est pas « true » (403 admin, 404 client).
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { RequirePermission } from '@auth/decorators/require-permission.decorator';
import { OrderBillingService } from '../services/order-billing.service';
import { identifiant, valider } from './order-actions.controller';

/** Montant en euros saisi par l'admin (« 12,50 » ou 12.5) → centimes > 0. */
const MontantEuros = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim().replace(',', '.'))
  .pipe(z.string().regex(/^\d{1,6}(?:\.\d{1,2})?$/, 'Montant invalide'))
  .transform((v) => Math.round(Number(v) * 100))
  .pipe(z.number().int().positive('Montant nul'));

const AdjustmentSchema = z
  .object({
    amountTtc: MontantEuros,
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

const CaptureStateSchema = z
  .object({
    state: z.enum(['authorized', 'captured', 'cancelled', 'refunded']),
    capturedAmountTtc: MontantEuros.optional(),
  })
  .strict()
  .refine((v) => v.state !== 'captured' || v.capturedAmountTtc !== undefined, {
    message: 'Montant encaissé requis pour « captured »',
  });

type SessionRequest = Request & {
  user?: { id?: string | number };
  session?: { passport?: { user?: { id?: string } } };
};

function userIdOf(req: SessionRequest): string | undefined {
  const id = req.user?.id ?? req.session?.passport?.user?.id;
  return id === undefined || id === null ? undefined : String(id);
}

function sendPdf(res: Response, file: { filename: string; content: Buffer }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${file.filename.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
  );
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.content);
}

@Controller('api/admin/orders')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
export class OrderBillingAdminController {
  constructor(private readonly billing: OrderBillingService) {}

  /**
   * Complément BM n° 2 : commandes d'une page dont le paiement est annulé ou
   * remboursé. `?ids=a,b,c` (100 au plus). Drapeau absent : `enabled: false`.
   */
  @Get('billing/payment-voids')
  @RequirePermission('canValidate')
  listPaymentVoids(@Query('ids') ids?: string) {
    const list = (ids ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 100)
      throw new BadRequestException('100 commandes au plus');
    return this.billing.listPaymentVoids(
      list.map((id) => identifiant(id, 'ids')),
    );
  }

  /** Même marque pour la fiche commande. Drapeau absent : `enabled: false`. */
  @Get(':orderId/billing/payment-void')
  @RequirePermission('canValidate')
  getPaymentVoid(@Param('orderId') orderId: string) {
    return this.billing.paymentVoid(identifiant(orderId, 'orderId'));
  }

  @Get(':orderId/billing')
  @RequirePermission('canMarkPaid')
  getBilling(@Param('orderId') orderId: string) {
    return this.billing.getBilling(identifiant(orderId, 'orderId'));
  }

  /** Commande moins chère : réduction motivée, montant à encaisser rendu. */
  @Post(':orderId/billing/reduction')
  @RequirePermission('canMarkPaid')
  recordReduction(
    @Param('orderId') orderId: string,
    @Body() body: unknown,
    @Req() req: SessionRequest,
  ) {
    const input = valider(AdjustmentSchema, body);
    return this.billing.recordReduction(
      identifiant(orderId, 'orderId'),
      { amountTtcCents: input.amountTtc, reason: input.reason },
      userIdOf(req),
    );
  }

  /** Commande plus chère : supplément motivé, lien de paiement envoyé. */
  @Post(':orderId/billing/supplement')
  @RequirePermission('canCreateOrders')
  requestSupplement(
    @Param('orderId') orderId: string,
    @Body() body: unknown,
    @Req() req: SessionRequest,
  ) {
    const input = valider(AdjustmentSchema, body);
    return this.billing.requestSupplement(
      identifiant(orderId, 'orderId'),
      { amountTtcCents: input.amountTtc, reason: input.reason },
      userIdOf(req),
    );
  }

  /** État relevé dans le back-office Verifone (saisie manuelle). */
  @Post(':orderId/billing/capture-state')
  @RequirePermission('canMarkPaid')
  recordCaptureState(
    @Param('orderId') orderId: string,
    @Body() body: unknown,
    @Req() req: SessionRequest,
  ) {
    const input = valider(CaptureStateSchema, body);
    return this.billing.recordCaptureState(
      identifiant(orderId, 'orderId'),
      { state: input.state, capturedAmountCents: input.capturedAmountTtc },
      userIdOf(req),
    );
  }

  /** Nouvelle tentative d'émission (après correction d'une condition). */
  @Post(':orderId/billing/issue-invoice')
  @RequirePermission('canShip')
  issueInvoice(@Param('orderId') orderId: string) {
    return this.billing.tryIssueInvoice(identifiant(orderId, 'orderId'));
  }

  @Get(':orderId/billing/invoice.pdf')
  @RequirePermission('canMarkPaid')
  async invoicePdf(@Param('orderId') orderId: string, @Res() res: Response) {
    sendPdf(res, await this.billing.renderPdf(identifiant(orderId, 'orderId')));
  }
}

@Controller('api/orders')
@UseGuards(AuthenticatedGuard)
export class OrderInvoiceCustomerController {
  constructor(private readonly billing: OrderBillingService) {}

  /** Numéro de la facture du client connecté, ou `invoice: null`. */
  @Get(':orderId/invoice')
  async invoice(@Param('orderId') orderId: string, @Req() req: SessionRequest) {
    const userId = userIdOf(req);
    if (!userId) throw new UnauthorizedException();
    return {
      invoice: await this.billing.findCustomerInvoice(
        identifiant(orderId, 'orderId'),
        userId,
      ),
    };
  }

  /** Facture PDF du client connecté ; 404 si elle n'est pas la sienne. */
  @Get(':orderId/invoice.pdf')
  async invoicePdf(
    @Param('orderId') orderId: string,
    @Req() req: SessionRequest,
    @Res() res: Response,
  ) {
    const userId = userIdOf(req);
    if (!userId) throw new UnauthorizedException();
    if (!this.billing.isEnabled()) {
      throw new NotFoundException('Facture non trouvée');
    }
    sendPdf(
      res,
      await this.billing.renderPdf(identifiant(orderId, 'orderId'), userId),
    );
  }
}
