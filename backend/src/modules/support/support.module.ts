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
import { AISupportController } from './controllers/ai-support.controller';

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
import { AISentimentService, AICategorizationService } from './services/ai-analysis.service';
import { AISmartResponseService, AIPredictiveService } from './services/ai-smart-response.service';

// External Modules
import { DatabaseModule } from '../../database/database.module';
import { NotificationsModule } from '../../notifications/notifications.module';

/**
 * SupportModule - Module de support client complet avec Intelligence Artificielle
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
 * 🤖 Intelligence Artificielle:
 *   - Analyse de sentiment automatique
 *   - Catégorisation intelligente des tickets
 *   - Réponses suggérées par IA
 *   - Prédiction d'escalation
 *   - Optimisation de workflow
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
    AISupportController, // 🤖 Contrôleur IA
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

    // Services Intelligence Artificielle 🤖
    AISentimentService,
    AICategorizationService,
    AISmartResponseService,
    AIPredictiveService,
  ],
  exports: [
    ContactService,
    NotificationService,
    SupportAnalyticsService,
    SupportConfigService,
    // Export des services IA
    AISentimentService,
    AICategorizationService,
    AISmartResponseService,
    AIPredictiveService,
  ],
})
export class SupportModule {}
