import { Module } from '@nestjs/common';
import { PaymentsLegacyController } from './payments-legacy.controller';
import { PaymentService } from './services/payments-legacy.service';
import { PaymentAuditService } from './services/payment-audit-simple.service';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PaymentsLegacyController],
  providers: [PaymentService, PaymentAuditService],
  exports: [PaymentService, PaymentAuditService],
})
export class PaymentsModule {}
