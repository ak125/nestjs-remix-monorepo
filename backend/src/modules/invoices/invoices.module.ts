/**
 * 🧾 INVOICES MODULE
 *
 * Module de gestion des factures avec architecture optimale :
 * - Cache intelligent pour les performances
 * - Service basé sur SupabaseBaseService
 * - API REST complète pour CRUD
 * - Statistiques et reporting
 */

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [
    // Cache pour optimiser les requêtes fréquentes
    CacheModule.register({
      ttl: 300, // 5 minutes pour les listes
      max: 1000, // 1000 entrées max
    }),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
