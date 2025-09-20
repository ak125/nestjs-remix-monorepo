/**
 * Schémas Zod pour le module Orders
 * Compatible avec le template ecommerce-api
 */

import { z } from 'zod';

// Enum pour les statuts
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum DeliveryMethod {
  STANDARD = 'standard',
  EXPRESS = 'express',
  PICKUP = 'pickup',
}

// Schémas Zod
export const DeliveryAddressSchema = z.object({
  street: z.string().min(1, 'La rue est requise'),
  city: z.string().min(1, 'La ville est requise'),
  postalCode: z.string().min(1, 'Le code postal est requis'),
  country: z.string().min(1, 'Le pays est requis'),
  additionalInfo: z.string().optional(),
});

export const OrderItemSchema = z.object({
  productId: z.string().uuid('ID produit invalide'),
  quantity: z.number().min(1, 'La quantité doit être supérieure à 0'),
  unitPrice: z.number().min(0, 'Le prix unitaire doit être positif'),
  totalPrice: z.number().min(0, 'Le prix total doit être positif'),
  productName: z.string().min(1, 'Le nom du produit est requis'),
  productSku: z.string().optional(),
  variantId: z.string().uuid().optional(),
  variantName: z.string().optional(),
});

export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema).min(1, 'Au moins un article est requis'),
  deliveryAddress: DeliveryAddressSchema,
  deliveryMethod: z.nativeEnum(DeliveryMethod),
  deliveryPrice: z.number().min(0, 'Le prix de livraison doit être positif'),
  notes: z.string().optional(),
  promocode: z.string().optional(),
  discountAmount: z.number().min(0, 'Le montant de remise doit être positif'),
});

export const UpdateOrderSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  trackingNumber: z.string().optional(),
  deliveryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  adminNotes: z.string().optional(),
});

export const SearchOrdersSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(10),
});

export const UserOrdersSchema = z.object({
  status: z.nativeEnum(OrderStatus).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(100).optional().default(10),
});

export const OrderCalculationItemSchema = z.object({
  productId: z.string().uuid('ID produit invalide'),
  quantity: z.number().min(1, 'La quantité doit être supérieure à 0'),
});

export const CalculateOrderSchema = z.object({
  items: z
    .array(OrderCalculationItemSchema)
    .min(1, 'Au moins un article est requis'),
  deliveryMethod: z.nativeEnum(DeliveryMethod),
  promocode: z.string().optional(),
  deliveryAddress: DeliveryAddressSchema.optional(),
});

// Types inférés automatiquement
export type DeliveryAddress = z.infer<typeof DeliveryAddressSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type CreateOrder = z.infer<typeof CreateOrderSchema>;
export type UpdateOrder = z.infer<typeof UpdateOrderSchema>;
export type SearchOrders = z.infer<typeof SearchOrdersSchema>;
export type UserOrders = z.infer<typeof UserOrdersSchema>;
export type OrderCalculationItem = z.infer<typeof OrderCalculationItemSchema>;
export type CalculateOrder = z.infer<typeof CalculateOrderSchema>;
