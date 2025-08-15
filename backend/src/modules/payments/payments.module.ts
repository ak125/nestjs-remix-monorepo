import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';

// Services
import { PaymentService } from './services/payment.service';
import { CyberplusService } from './services/cyberplus.service';
import { PaymentValidationService } from './services/payment-validation.service';
import { PaymentDataService } from './repositories/payment-data.service';

@Module({
  imports: [DatabaseModule],
  controllers: [], // Contrôleurs temporairement désactivés à cause d'erreurs de décorateurs
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
