import { PaymentStatus, PaymentMethod } from '../entities/payment.entity';

export class PaymentResponseDto {
  id!: string;
  paymentReference!: string;
  amount!: number;
  currency!: string;
  status!: PaymentStatus;
  method!: PaymentMethod;
  description?: string;
  userId!: string;
  orderId?: string;
  createdAt!: Date;
  updatedAt!: Date;
  processedAt?: Date;
  refundedAmount?: number;
  metadata?: Record<string, any>;
}

export class PaymentUrlResponseDto {
  paymentUrl!: string;
  paymentId!: string;
  expiresAt?: Date;
}

export class RefundPaymentDto {
  amount?: number; // Si non spécifié, remboursement total
  reason?: string;
}
