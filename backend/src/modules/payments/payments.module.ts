import { Module } from '@nestjs/common';
import { PaymentsController } from './payments-legacy.controller';
import { PaymentService } from './services/payments-legacy.service';
import { PaymentAuditService } from './services/payment-audit.service';
import { SupabaseRestService } from '../../database/supabase-rest.service';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentService,
    PaymentAuditService,
    SupabaseRestService,
  ],
  exports: [
    PaymentService,
    PaymentAuditService,
  ],
})
export class PaymentsModule {}
