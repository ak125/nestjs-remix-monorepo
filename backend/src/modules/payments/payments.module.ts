import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';

// Configuration
import paymentConfig from '../../config/payment.config';

// Controllers
import { PaymentsController } from './controllers/payments.controller';

// Services
import { PaymentService } from './services/payment.service';
import { CyberplusService } from './services/cyberplus.service';
import { PaymentValidationService } from './services/payment-validation.service';
import { PaymentDataService } from './repositories/payment-data.service';

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
  ],
  providers: [
    // Services
    PaymentService,
    CyberplusService,
    PaymentValidationService,

    // Data Services
    PaymentDataService,
  ],
  exports: [PaymentService, CyberplusService, PaymentDataService],
})
export class PaymentsModule {}
