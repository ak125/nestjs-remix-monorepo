/**
 * 👥 MODULE STAFF - Gestion du Personnel Administratif
 *
 * Module aligné sur l'architecture modulaire du projet :
 * - Structure cohérente avec admin, users, cart, orders
 * - Controllers spécialisés pour les APIs REST
 * - Services métier réutilisables
 * - Intégration DatabaseModule + CacheModule
 * - Exports sélectifs pour réutilisation inter-modules
 *
 * Fonctionnalités :
 * ✅ CRUD Staff (create, read, update, delete)
 * ✅ Gestion des rôles et permissions
 * ✅ Authentification et autorisation staff
 * ✅ API REST sécurisée pour admin
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';

/**
 * StaffModule - Module de gestion du personnel
 * ✅ Utilise DatabaseModule pour StaffDataService
 * ✅ Suit l'architecture modulaire recommandée
 */
@Module({
  imports: [DatabaseModule, CacheModule],
  providers: [StaffService],
  controllers: [StaffController],
  exports: [StaffService],
})
export class StaffModule {}
