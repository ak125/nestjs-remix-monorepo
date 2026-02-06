import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';

// Configuration
import paymentConfig from '../../config/payment.config';

// Controllers (split from payments.controller.ts — order matters for route resolution)
import { PaymentAdminController } from './controllers/payment-admin.controller';
import { PaymentMethodsController } from './controllers/payment-methods.controller';
import { PaymentCallbackController as PaymentCallbackCtrl } from './controllers/payment-callback.controller';
import { PaymentCoreController } from './controllers/payment-core.controller';
import { SystemPayRedirectController } from './controllers/systempay-redirect.controller';
import { PayboxRedirectController } from './controllers/paybox-redirect.controller';
import { PayboxCallbackController } from './controllers/paybox-callback.controller';
import { PayboxTestController } from './controllers/paybox-test.controller';
import { PayboxMonitoringController } from './controllers/paybox-monitoring.controller';

// Services
import { PaymentService } from './services/payment.service';
import { CyberplusService } from './services/cyberplus.service';
import { PayboxService } from './services/paybox.service';
import { PaymentValidationService } from './services/payment-validation.service';
import { PayboxCallbackGateService } from './services/paybox-callback-gate.service';
import { PaymentDataService } from './repositories/payment-data.service';
import { EmailService } from '../../services/email.service';

/**
 * 💳 MODULE PAYMENTS CONSOLIDÉ
 * ═══════════════════════════════════════════════════════════════
 *
 * Gestion complète des paiements :
 * - Création et suivi des paiements
 * - Intégration Cyberplus/BNP Paribas
 * - Callbacks bancaires sécurisés
 * - Remboursements (total/partiel)
 * - Logs audit complets
 *
 * INTÉGRATIONS :
 * - Orders module (commandes)
 * - Users module (clients)
 * - Admin module (gestion)
 *
 * VERSION : 2.0.0 (Split 2026-02-07)
 * CONTRÔLEURS : 1 → 4 (admin, methods, callback, core) + 5 existants
 *
 * CONFIGURATION :
 * - Variables d'environnement via ConfigModule
 * - Configuration type-safe avec validation
 */
@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forFeature(paymentConfig), // ✅ Configuration dédiée aux paiements
  ],
  controllers: [
    // Ordre critique : routes statiques AVANT wildcard /:id
    PaymentAdminController, // GET /stats, /stats/global (statique)
    PaymentMethodsController, // GET /methods/available (statique)
    PaymentCallbackCtrl, // POST /callback/* (statique)
    PaymentCoreController, // GET /:id (wildcard EN DERNIER)
    SystemPayRedirectController,
    PayboxRedirectController,
    PayboxCallbackController,
    PayboxTestController,
    PayboxMonitoringController,
  ],
  providers: [
    // Services
    PaymentService,
    CyberplusService,
    PayboxService,
    PaymentValidationService,
    PayboxCallbackGateService, // SAFE CHANGE: Callback Gate (shadow/strict)

    // Data Services
    PaymentDataService,

    // Email
    EmailService,
  ],
  exports: [PaymentService, CyberplusService, PaymentDataService],
})
export class PaymentsModule {}
