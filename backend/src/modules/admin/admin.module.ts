/**
 * 📋 MODULE ADMIN - NestJS-Remix Monorepo
 *
 * Module d'administration complet pour la gestion back-office
 * Basé sur la fiche technique: admin_FICHE_TECHNIQUE.md
 *
 * Migration des fonctionnalités PHP:
 * ✅ Gestion des stocks (core/_commercial/stock.*)
 * ✅ Administration des utilisateurs staff (core/_staff/*)
 * ✅ Configuration système (___CONFIG_ADMIN)
 * ✅ Outils de maintenance et monitoring
 *
 * Architecture: NestJS + Zod + Supabase
 * Phase de migration: Phase 2 - Criticité HAUTE
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrdersModule } from '../orders/orders.module';

// Controllers
import { AdminDashboardController } from './controllers/admin-dashboard.controller';
import { AdminSuppliersController } from './controllers/admin-suppliers.controller';
import { AdminStaffController } from './controllers/admin-staff.controller';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { AdminRootController } from './controllers/admin-root.controller';

// Services
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminSuppliersService } from './services/admin-suppliers.service';
import { AdminStaffService } from './services/admin-staff.service';

@Module({
  imports: [
    DatabaseModule, // Pour SupabaseRestService
    OrdersModule,   // Import du module Orders pour accéder à ses services
  ],
  controllers: [
    AdminRootController,
    AdminDashboardController,
    AdminSuppliersController,
    AdminStaffController,
    AdminOrdersController,
  ],
  providers: [
    AdminDashboardService, 
    AdminSuppliersService, 
    AdminStaffService,
  ],
  exports: [AdminDashboardService, AdminSuppliersService, AdminStaffService],
})
export class AdminModule {}
