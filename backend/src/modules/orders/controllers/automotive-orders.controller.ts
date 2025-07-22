/**
 * CONTRÔLEUR AUTOMOTIVE DÉSACTIVÉ
 *
 * Ce contrôleur était basé sur les services Prisma et a été désactivé.
 * Utiliser OrdersController et OrdersCompleteService à la place.
 */

import { Controller, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@Controller('orders/automotive')
@ApiTags('automotive-orders')
export class AutomotiveOrdersController {
  private readonly logger = new Logger(AutomotiveOrdersController.name);

  constructor() {
    this.logger.warn(
      'Contrôleur automotive désactivé - utiliser OrdersController',
    );
  }

  // Toutes les routes sont désactivées
  // Utiliser OrdersController à la place
}
