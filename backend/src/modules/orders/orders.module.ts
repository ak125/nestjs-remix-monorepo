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
import { OrdersController } from './orders.controller';
import { OrdersApiController } from './orders-api.controller';
import { OrdersService } from './orders.service';
import { OrdersCompleteService } from './orders-complete.service';
import { SupabaseRestService } from '../../database/supabase-rest.service';

@Module({
  imports: [],
  controllers: [OrdersController, OrdersApiController],
  providers: [OrdersService, OrdersCompleteService, SupabaseRestService],
  exports: [OrdersService, OrdersCompleteService]
})
export class OrdersModule {}
