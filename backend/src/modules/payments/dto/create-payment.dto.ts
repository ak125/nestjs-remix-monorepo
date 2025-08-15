import { PaymentMethod } from '../entities/payment.entity';

export class CreatePaymentDto {
  amount!: number;
  currency: string = 'EUR';
  method!: PaymentMethod;
  userId!: string;
  orderId?: string;
  description?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
  customerEmail?: string; // Requis pour certains providers
}
