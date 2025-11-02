
/**
 * Types pour les paiements côté frontend
 */

export interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  logo: string;
  enabled: boolean;
  isDefault?: boolean;
}

export interface Payment {
  id: string;
  orderId: string;
  userId: string;
  customerName?: string;
  customerEmail?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string;
  transactionId?: string;
  gatewayTransactionId?: string;
  gatewayData?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  processedAt?: string;
  failureReason?: string;
  refundAmount?: number;
  refundedAt?: string;
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export interface PaymentStats {
  totalRevenue: number;
  totalTransactions: number;
  successRate: number;
  averageAmount: number;
  monthlyGrowth: number;
  statusDistribution: {
    completed: number;
    pending: number;
    failed: number;
    cancelled: number;
    refunded: number;
  };
  methodDistribution: {
    cyberplus: number;
    paypal: number;
    bank_transfer: number;
  };
  recentPayments: Payment[];
}

export interface PaymentFilter {
  search?: string;
  status?: PaymentStatus;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  orderId?: string;
}

export interface PaymentFormData {
  orderId: string;
  paymentMethod: string;
  acceptTerms: boolean;
}

export interface CyberplusFormData {
  html: string;
  url: string;
  parameters: Record<string, string>;
}

export interface PaymentCallback {
  transactionId: string;
  paymentReference: string;
  status: string;
  amount?: number;
  currency?: string;
  responseCode?: string;
  authorizationCode?: string;
  bankReference?: string;
  cardNumber?: string;
  cardType?: string;
  gatewayData?: Record<string, any>;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: number;
  items: OrderItem[];
  subtotalHT: number;
  tva: number;
  shippingFee: number;
  totalTTC: number;
  currency: string;
  // ✅ Phase 7: Montant des consignes
  consigneTotal?: number;
  // ✅ Informations client
  customerName?: string;
  customerEmail?: string;
  shippingAddress?: {
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
}

export interface OrderItem {
  id: string;
  name: string;
  image: string;
  quantity: number;
  price: number;
  total: number;
}
