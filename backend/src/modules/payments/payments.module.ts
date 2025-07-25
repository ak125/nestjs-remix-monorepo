import { Module } from '@nestjs/common';
import { PaymentsLegacyController } from './payments-legacy.controller';
import { PaymentService } from './services/payments-legacy.service';
import { PaymentAuditService } from './services/payment-audit.service';
import { SupabaseRestService } from '../../database/supabase-rest.service';

@Module({
  controllers: [PaymentsLegacyController],
  providers: [PaymentService, PaymentAuditService, SupabaseRestService],
  exports: [PaymentService, PaymentAuditService],
})
export class PaymentsModule {}
