import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersModernService } from './suppliers-modern.service';
import { SuppliersModernController } from './suppliers-modern.controller';

/**
 * SuppliersModule - Gestion des fournisseurs
 * ✅ Aligné sur l'architecture standard du projet
 * ✅ Utilise DatabaseModule pour SupabaseBaseService
 * ✅ Structure cohérente avec users, payments, orders, messages
 * ✅ Service moderne avec validation Zod disponible
 * ✅ Controllers moderne et legacy disponibles
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    SuppliersService,
    SuppliersModernService, // Service moderne avec validation Zod
  ],
  controllers: [
    SuppliersController, // Controller existant (legacy)
    SuppliersModernController, // Controller moderne avec validation Zod
  ],
  exports: [
    SuppliersService,
    SuppliersModernService, // Export pour utilisation dans d'autres modules
  ],
})
export class SuppliersModule {}
