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
import { CacheModule } from '../../cache/cache.module';
import { MailService } from '../../services/mail.service';
import { AuthModule } from '../../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';

// Controllers disponibles
import { UsersController } from './users.controller';
import { PasswordController } from './controllers/password.controller';
import { AddressesController } from './controllers/addresses.controller';
import { UserShipmentController } from './controllers/user-shipment.controller';
// import { AddressesSimpleController } from './controllers/addresses-simple.controller';
// import { UserAddressController } from './controllers/user-address.controller';

// Services métier spécialisés
import { UsersService } from './users.service';
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
    DatabaseModule, // ✅ UserDataService et autres services de données
    CacheModule, // ✅ Redis cache pour sessions et performances
    forwardRef(() => AuthModule), // ✅ AuthModule avec forwardRef (évite circular dependency)
    MessagesModule, // ✅ MessagesModule pour délégation messaging
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [
    // Controllers principaux
    UsersController,
    PasswordController, // ✅ API REST pour gestion des mots de passe
    AddressesController, // ✅ Service d'adresses réactivé
    UserShipmentController, // ✅ API pour les expéditions utilisateur
    // AddressesTestController, // ✅ Test contrôleur adresses - validation architecture (temporairement désactivé)
    // UserAddressController temporairement désactivé - incompatibilité des méthodes
  ],
  providers: [
    // Services existants modernisés
    UsersService,
    ProfileService, // ✅ Service moderne de gestion des profils (Phase 2.3)
    UsersAdminService, // ✅ Service opérations admin (Phase 3.1 - simplifié)
    PasswordService, // ✅ Service moderne de gestion des mots de passe
    AddressesService, // ✅ Service moderne de gestion des adresses
    UserShipmentService, // ✅ Service de suivi des expéditions utilisateur

    // Services modernes spécialisés (temporairement désactivés - migration this.db vers this.client)
    // TODO: Migrer AddressModernService, MessageModernService
    // AddressModernService,
    // MessageModernService,

    // Service mail avec token d'injection
    {
      provide: 'MailService',
      useClass: MailService,
    },
  ],
  exports: [
    // Services pour autres modules
    UsersService,
    ProfileService, // ✅ Service de profils exporté (Phase 2.3)
    UsersAdminService, // ✅ Service admin exporté (Phase 3.1 - simplifié)
    PasswordService, // ✅ Service de mots de passe exporté
    AddressesService, // ✅ Service d'adresses exporté
    UserShipmentService, // ✅ Service de suivi des expéditions exporté
    // Services modernes temporairement désactivés
    // AddressModernService,
    // MessageModernService,
  ],
})
export class UsersModule {}
