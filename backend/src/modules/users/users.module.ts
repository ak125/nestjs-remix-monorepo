/**
 * 🎯 MODULE USERS COMPLET - Architecture finale consolidée
 *
 * Module users unifié intégrant toutes les fonctionnalités :
 * ✅ Gestion utilisateurs complète (CRUD, profils)
 * ✅ Adresses facturation/livraison (CRUD)
 * ✅ Gestion des mots de passe sécurisée
 * ✅ Messagerie interne avec threading
 * ✅ Intégration avec l'authentification JWT
 * ✅ RGPD/Suppression compte
 * ✅ Sessions JWT + Redis cache
 */

import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';

// ✅ CONTRÔLEUR FINAL CONSOLIDÉ
import { UsersFinalController } from './users-final.controller';

// Controllers spécialisés (à conserver)
import { PasswordController } from './controllers/password.controller';
import { AddressesController } from './controllers/addresses.controller';
import { UserShipmentController } from './controllers/user-shipment.controller';

// ✅ SERVICES FINAUX CONSOLIDÉS
import { UsersFinalService } from './users-final.service';
import { UserDataConsolidatedService } from './services/user-data-consolidated.service';

// Services spécialisés
import { ProfileService } from './services/profile.service';
import { UsersAdminService } from './services/admin.service';
import { PasswordService } from './services/password.service';
import { AddressesService } from './services/addresses.service';
import { UserShipmentService } from './services/user-shipment.service';
// Services modernes en cours de migration (this.db -> this.client)
// import { AddressModernService } from './services/address-modern.service';
// import { MessageModernService } from './services/message-modern.service';

@Module({
  imports: [
    // Modules externes - Configuration et infrastructure
    ConfigModule, // ✅ Configuration pour SupabaseBaseService
    DatabaseModule, // ✅ Services de données partagés (OrdersService, etc.)
    forwardRef(() => AuthModule), // ✅ AuthModule avec forwardRef (évite circular dependency)
    MessagesModule, // ✅ MessagesModule pour délégation messaging
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [
    // ✅ CONTRÔLEUR PRINCIPAL CONSOLIDÉ
    UsersFinalController, // Route unique: /api/users

    // Controllers spécialisés
    PasswordController, // ✅ API REST pour gestion des mots de passe
    AddressesController, // ✅ Service d'adresses réactivé
    UserShipmentController, // ✅ API pour les expéditions utilisateur
  ],
  providers: [
    // ✅ SERVICES PRINCIPAUX CONSOLIDÉS
    UsersFinalService, // Service métier avec cache Redis
    UserDataConsolidatedService, // Accès données Supabase

    // Services spécialisés
    ProfileService, // ✅ Service moderne de gestion des profils
    UsersAdminService, // ✅ Service opérations admin
    PasswordService, // ✅ Service moderne de gestion des mots de passe
    AddressesService, // ✅ Service moderne de gestion des adresses
    UserShipmentService, // ✅ Service de suivi des expéditions utilisateur
  ],
  exports: [
    // ✅ SERVICES PRINCIPAUX CONSOLIDÉS
    UsersFinalService, // Service métier principal
    UserDataConsolidatedService, // Accès données

    // Services spécialisés
    ProfileService, // ✅ Service de profils exporté
    UsersAdminService, // ✅ Service admin exporté
    PasswordService, // ✅ Service de mots de passe exporté
    AddressesService, // ✅ Service d'adresses exporté
    UserShipmentService, // ✅ Service de suivi des expéditions exporté
  ],
})
export class UsersModule {}
