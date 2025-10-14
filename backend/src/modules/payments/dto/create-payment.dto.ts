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
  
  // ✅ Phase 6: Informations consignes
  consigne_total?: number; // Montant total des consignes inclus dans amount
  consigne_details?: Array<{
    productId: string;
    quantity: number;
    consigne_unit: number;
  }>;
}
