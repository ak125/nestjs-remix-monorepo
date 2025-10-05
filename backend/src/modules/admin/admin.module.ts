/**
 * AdminModule - Module d'administration
 *
 * Module aligné sur l'approche des modules orders, cart, user, payment :
 * - Structure modulaire claire avec séparation des responsabilités
 * - Controllers spécialisés par domaine fonctionnel
 * - Services métier spécialisés et réutilisables
 * - Imports cohérents (DatabaseModule, CacheModule)
 * - Exports sélectifs des services pour réutilisation
 *
 * Phase 1 : Configuration de base ✅
 * Phase 2 : Stock Management 🚧
 * Phase 3 : Orders Administration (AdminOrdersController retiré - intégré dans OrdersController)
 * Phase 4 : Reporting & Analytics
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';

// Controllers
import { ConfigurationController } from './controllers/configuration.controller';
import { StockController } from './controllers/stock.controller';
import { StockEnhancedController } from './controllers/stock-enhanced.controller';
import { StockTestController } from './controllers/stock-test.controller';
import { RealStockService } from './services/real-stock.service';
import { RealStockController } from './controllers/real-stock.controller';
import { SimpleStockController } from './controllers/simple-stock.controller';
import { WorkingStockService } from './services/working-stock.service';
import { WorkingStockController } from './controllers/working-stock.controller';
// AdminOrdersController retiré - Routes admin intégrées dans OrdersController (/api/orders/admin/*)
import { AdminController } from './controllers/admin.controller';
import { AdminRootController } from './controllers/admin-root.controller';
import { ReportingController } from './controllers/reporting.controller';
import { UserManagementController } from './controllers/user-management.controller';
import { AdminStaffController } from './controllers/admin-staff.controller';
import { AdminProductsController } from './controllers/admin-products.controller';

// Services
import { ConfigurationService } from './services/configuration.service';
import { StockManagementService } from './services/stock-management.service';
import { ReportingService } from './services/reporting.service';
import { UserManagementService } from './services/user-management.service';
// import { AdminProductsService } from './services/admin-products.service';
import { StaffService } from '../staff/staff.service';

// Import du module Orders pour les services
import { OrdersModule } from '../orders/orders.module';
import { StaffModule } from '../staff/staff.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    OrdersModule,
    StaffModule,
    ProductsModule,
  ],
  controllers: [
    ConfigurationController,
    StockController,
    StockEnhancedController,
    StockTestController,
    RealStockController,
    SimpleStockController,
    WorkingStockController,
    // AdminOrdersController retiré - Routes disponibles dans OrdersModule (/api/orders/admin/*)
    AdminController,
    AdminRootController,
    ReportingController,
    UserManagementController,
    AdminStaffController,
    AdminProductsController,
  ],
  providers: [
    ConfigurationService,
    StockManagementService,
    RealStockService,
    WorkingStockService,
    ReportingService,
    UserManagementService,
    // AdminProductsService,
    StaffService,
  ],
  exports: [
    ConfigurationService,
    StockManagementService,
    ReportingService,
    UserManagementService,
    // AdminProductsService,
  ],
})
export class AdminModule {}
