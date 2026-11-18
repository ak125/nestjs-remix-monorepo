/**
 * Mandat CG — routes du bloc « Écrire au client » de la fiche commande.
 *
 * Mêmes gardes que les actions back-office (`AuthenticatedGuard`,
 * `PermissionsGuard`), droit `canSendEmails` (commercial et admin, comme
 * « Annuler »). Corps validés par zod ; toute la logique est dans
 * `OrderCustomerMailService`.
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { RequirePermission } from '@auth/decorators/require-permission.decorator';
import { OrderCustomerMailService } from '../services/order-customer-mail.service';
import { CUSTOMER_MAIL_TEMPLATES } from '../services/customer-mail-templates';
import { identifiant, valider } from './order-actions.controller';

const MailTextSchema = z
  .object({
    // Une seule ligne : pas de saut de ligne dans un en-tête de mail.
    subject: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .regex(/^[^\r\n]*$/, "L'objet tient sur une ligne"),
    body: z.string().trim().min(10).max(10000),
  })
  .strict();

const SendSchema = MailTextSchema.extend({
  requestId: z.string().uuid(),
  template: z.enum(CUSTOMER_MAIL_TEMPLATES),
}).strict();

type SessionRequest = Request & {
  user?: { id?: string | number };
  session?: { passport?: { user?: { id?: string } } };
};

function userIdOf(req: SessionRequest): string | undefined {
  const id = req.user?.id ?? req.session?.passport?.user?.id;
  return id === undefined || id === null ? undefined : String(id);
}

@Controller('api/admin/orders')
@UseGuards(AuthenticatedGuard, PermissionsGuard)
export class OrderCustomerMailController {
  constructor(private readonly customerMail: OrderCustomerMailService) {}

  /** Modèles préremplis avec la commande, destinataire et historique. */
  @Get(':orderId/customer-mail')
  @RequirePermission('canSendEmails')
  getComposer(@Param('orderId') orderId: string) {
    return this.customerMail.getComposer(identifiant(orderId, 'orderId'));
  }

  /** Aperçu du mail final ; rien n'est envoyé ni écrit. */
  @Post(':orderId/customer-mail/preview')
  @RequirePermission('canSendEmails')
  preview(@Param('orderId') orderId: string, @Body() body: unknown) {
    identifiant(orderId, 'orderId');
    return this.customerMail.preview(valider(MailTextSchema, body));
  }

  /** Envoi après l'aperçu ; `requestId` rend un double clic sans effet. */
  @Post(':orderId/customer-mail')
  @RequirePermission('canSendEmails')
  send(
    @Param('orderId') orderId: string,
    @Body() body: unknown,
    @Req() req: SessionRequest,
  ) {
    return this.customerMail.send(
      identifiant(orderId, 'orderId'),
      valider(SendSchema, body),
      userIdOf(req),
    );
  }
}
