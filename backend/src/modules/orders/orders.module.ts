/**
 * Module Orders - Gestion complète des commandes
 *
 * Généré automatiquement depuis l'analyse de 50 fichiers PHP
 * Entités analysées: 16 entités, 18 opérations métier
 *
 * Fonctionnalités principales:
 * - Gestion complète du cycle de vie des commandes
 * - Calcul automatique des frais de livraison
 * - Gestion des statuts et transitions
 * - Audit trail complet
 * - Intégration avec système de facturation
 * - Gestion du panier
 * - Notifications email
 * - Cache pour les performances
 *
 * Architecture basée sur l'analyse PHP:
 * - shopping_cart.class.php → CartService
 * - class_order.php → OrdersService
 * - class_order_line.php → OrderLine management
 * - class_delivery_agent.php → ShippingService
 * - class_invoice.php → InvoiceService
 */

import { Module } from '@nestjs/common';
import { OrdersApiController } from './orders-api.controller';
import { OrdersService } from './orders.service';
import { OrdersCompleteService } from './orders-complete.service';
import { DatabaseModule } from '../../database/database.module';
import { PerformanceOptimizationService } from '../../common/services/performance-optimization.service';

@Module({
  imports: [DatabaseModule], // Import du nouveau module optimisé
  controllers: [OrdersApiController],
  providers: [
    OrdersService,
    OrdersCompleteService,
    PerformanceOptimizationService,
  ],
  exports: [
    OrdersService,
    OrdersCompleteService,
    PerformanceOptimizationService,
  ],
})
export class OrdersModule {}
