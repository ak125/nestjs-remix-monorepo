/**
 * 💬 MODULE MESSAGES - Gestion de la Messagerie
 *
 * Module aligné sur l'architecture modulaire du projet :
 * - Structure cohérente avec staff, users, orders, payments
 * - Controllers spécialisés pour les APIs REST
 * - Services métier réutilisables avec EventEmitter
 * - Gateway WebSocket pour temps réel
 * - Intégration DatabaseModule pour SupabaseBaseService
 * - Architecture moderne préservant la table legacy ___xtr_msg
 *
 * Fonctionnalités :
 * ✅ CRUD Messages (create, read, update, close)
 * ✅ Système de notifications temps réel (WebSocket)
 * ✅ Filtrage avancé et statistiques
 * ✅ API REST sécurisée pour admin et clients
 * ✅ Préservation table legacy ___xtr_msg
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../database/database.module';
import { CacheModule } from '../../cache/cache.module';

// Controllers
import { MessagesController } from './messages.controller';

// Services métier
import { MessagesService } from './messages.service';

// Data Services (Repository Pattern)
import { MessageDataService } from './repositories/message-data.service';

// WebSocket Gateway
import { MessagingGateway } from './messaging.gateway';

/**
 * MessagesModule - Module de gestion de la messagerie
 * ✅ Utilise DatabaseModule pour SupabaseBaseService
 * ✅ Intègre JwtModule pour authentification WebSocket
 * ✅ Suit l'architecture modulaire recommandée
 * ✅ Support WebSocket pour notifications temps réel
 */
@Module({
  imports: [
    DatabaseModule,
    CacheModule, // Pour mise en cache des statistiques si nécessaire
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback-secret',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [MessagesController],
  providers: [
    // Services métier
    MessagesService,

    // Data Services (Repository Pattern)
    MessageDataService,

    // WebSocket Gateway
    MessagingGateway,
  ],
  exports: [
    // Export services pour réutilisation inter-modules
    MessagesService,
    MessageDataService,
    MessagingGateway,
  ],
})
export class MessagesModule {}
