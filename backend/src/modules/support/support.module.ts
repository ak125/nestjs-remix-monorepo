import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { ReviewController } from './controllers/review.controller';
import { ContactController } from './controllers/contact.controller';
import { QuoteController } from './controllers/quote.controller';
import { FaqController } from './controllers/faq.controller';
import { LegalController } from './controllers/legal.controller';
import { ClaimController } from './controllers/claim.controller';
import { SupportAnalyticsController } from './controllers/support-analytics.controller';

// Services
import { ReviewService } from './services/review.service';
import { ContactService } from './services/contact.service';
import { QuoteService } from './services/quote.service';
import { FaqService } from './services/faq.service';
import { LegalService } from './services/legal.service';
import { ClaimService } from './services/claim.service';
import { NotificationService } from './services/notification.service';
import { SupportAnalyticsService } from './services/support-analytics.service';
import { SupportConfigService } from './services/support-config.service';

// External Modules
import { DatabaseModule } from '../../database/database.module';
import { NotificationsModule } from '../../notifications/notifications.module';

/**
 * SupportModule - Module de support client complet
 *
 * Fonctionnalités:
 * ✅ Gestion des avis clients (reviews)
 * ✅ Système de contact et tickets
 * ✅ Demandes de devis
 * ✅ FAQ dynamique
 * ✅ Documents légaux
 * ✅ Gestion des réclamations
 * ✅ Notifications temps réel
 * ✅ Analytics et rapports
 * ✅ Configuration centralisée
 */
@Module({
  imports: [ConfigModule, DatabaseModule, NotificationsModule],
  controllers: [
    ReviewController,
    ContactController,
    QuoteController,
    FaqController,
    LegalController,
    ClaimController,
    SupportAnalyticsController,
  ],
  providers: [
    // Services principaux
    ReviewService,
    ContactService,
    QuoteService,
    FaqService,
    LegalService,
    ClaimService,
    NotificationService,

    // Services avancés
    SupportAnalyticsService,
    SupportConfigService,
  ],
  exports: [
    ContactService,
    NotificationService,
    SupportAnalyticsService,
    SupportConfigService,
  ],
})
export class SupportModule {}
