export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank_transfer',
  CYBERPLUS = 'cyberplus',
  PAYBOX = 'paybox',
}

export interface Payment {
  id: string;
  paymentReference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  providerTransactionId?: string;
  providerReference?: string;
  description?: string;
  metadata?: Record<string, any>;
  failureReason?: string;
  processedAt?: Date;
  refundedAmount: number;
  userId: string;
  orderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  paymentId: string;
  type: 'payment' | 'refund' | 'chargeback';
  amount: number;
  status: string;
  providerTransactionId?: string;
  providerResponse?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentPostback {
  id: string;
  paymentId: string;
  providerName: string;
  rawData: Record<string, any>;
  signature?: string;
  verified: boolean;
  processedAt?: Date;
  createdAt: Date;
}

export class PaymentHelper {
  static isCompleted(payment: Payment): boolean {
    return payment.status === PaymentStatus.COMPLETED;
  }

  static isFailed(payment: Payment): boolean {
    return payment.status === PaymentStatus.FAILED;
  }

  static canBeRefunded(payment: Payment): boolean {
    return (
      payment.status === PaymentStatus.COMPLETED &&
      payment.refundedAmount < payment.amount
    );
  }

  static getRemainingRefundableAmount(payment: Payment): number {
    return payment.amount - payment.refundedAmount;
  }

  static generatePaymentReference(prefix = 'PAY'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }
}
