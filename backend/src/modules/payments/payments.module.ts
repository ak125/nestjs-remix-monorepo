import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';

// Configuration
import paymentConfig from '../../config/payment.config';

// Controllers
import { PaymentsController } from './controllers/payments.controller';
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
 * VERSION : 1.0.0 (Refactoring 2025-10-05)
 * CONTRÔLEURS : 3 → 1 (-66%)
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
    PaymentsController, // ✅ Contrôleur unifié activé
    SystemPayRedirectController, // ✅ Redirection SystemPay
    PayboxRedirectController, // ✅ Redirection Paybox (PRODUCTION)
    PayboxCallbackController, // ✅ Callback IPN Paybox
    PayboxTestController, // ✅ Page de test Paybox (PHP → TS)
    PayboxMonitoringController, // ✅ Monitoring admin Paybox
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
