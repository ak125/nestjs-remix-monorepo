/**
 * DTOs pour les commandes automobiles dans le monorepo NestJS Remix
 * Adapté pour les vraies tables: Order, OrderLine avec schéma Prisma
 * Compatible avec les tables legacy: ___xtr_order, ___xtr_order_line
 */

import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Types personnalisés pour remplacer Prisma
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CARTE_BANCAIRE = 'CARTE_BANCAIRE',
  PAYPAL = 'PAYPAL',
  VIREMENT = 'VIREMENT',
  CHEQUE = 'CHEQUE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

// Schémas de validation pour les données véhicule
const vehicleRegistrationSchema = z.object({
  registrationNumber: z.string().min(1, "Numéro d'immatriculation requis"),
  country: z.string().length(2).default('FR'),
  format: z.enum(['old', 'new', 'custom']).optional(),
});

const vehicleVINSchema = z.object({
  vinNumber: z
    .string()
    .length(17, 'Le VIN doit contenir exactement 17 caractères'),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().min(1900).max(2030).optional(),
});

const oemReferenceSchema = z.object({
  oemCode: z.string().min(1, 'Code OEM requis'),
  manufacturer: z.string().min(1, 'Constructeur requis'),
  partType: z.string().optional(),
  description: z.string().optional(),
});

const vehicleDataSchema = z.object({
  registration: vehicleRegistrationSchema.optional(),
  vin: vehicleVINSchema.optional(),
  oemReferences: z.array(oemReferenceSchema).default([]),
  additionalInfo: z
    .object({
      engineCode: z.string().optional(),
      transmissionType: z.enum(['manual', 'automatic', 'cvt']).optional(),
      fuelType: z.enum(['petrol', 'diesel', 'electric', 'hybrid']).optional(),
      engineSize: z.number().positive().optional(),
      horsePower: z.number().positive().optional(),
      year: z.number().int().min(1900).max(2030).optional(),
      bodyType: z.string().optional(),
      doors: z.number().int().min(2).max(5).optional(),
      color: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

// Extension de OrderLine pour inclure les données automobiles
const automotiveOrderLineSchema = z.object({
  // Données de base OrderLine (compatible Prisma)
  productId: z.string().min(1, 'ID produit requis'),
  productName: z.string().min(1, 'Nom du produit requis'),
  productReference: z.string().min(1, 'Référence produit requise'),
  quantity: z.number().int().min(1, 'Quantité doit être positive'),
  unitPrice: z.number().min(0, 'Prix unitaire doit être positif'),
  totalPrice: z.number().min(0, 'Prix total doit être positif'),

  // Extensions automobiles
  vehicleData: vehicleDataSchema.optional(),
  oemReferences: z.array(oemReferenceSchema).optional(),
  fitmentNotes: z.string().optional(),
  compatibilityWarnings: z.array(z.string()).optional(),

  // Métadonnées pour l'intégration avec tables legacy
  legacyFields: z
    .object({
      cartimmat: z.string().optional(), // Correspondance avec PHP legacy
      cartvin: z.string().optional(),
      oemcom: z.string().optional(),
      infossup: z.string().optional(),
      equiv: z.string().optional(),
    })
    .optional(),
});

// Extension d'Order pour inclure les spécificités automobiles
const automotiveOrderSchema = z.object({
  // Données de base Order (compatible Prisma)
  customerId: z.string().min(1, 'ID client requis'),
  paymentMethod: z.nativeEnum(PaymentMethod),

  // Adresses (format JSON Prisma)
  billingAddress: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    company: z.string().optional(),
    street: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().length(2).default('FR'),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }),

  deliveryAddress: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    company: z.string().optional(),
    street: z.string().min(1),
    city: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().length(2).default('FR'),
    phone: z.string().optional(),
    instructions: z.string().optional(),
  }),

  // Extensions automobiles
  orderLines: z
    .array(automotiveOrderLineSchema)
    .min(1, 'Au moins une ligne de commande requise'),

  // Calculs automatiques automobiles
  shippingCalculation: z.object({
    cartWeight: z.number().positive('Poids du panier requis'),
    zipCodeDeliveryIdentificator: z
      .string()
      .min(1, 'Code postal de livraison requis'),
    shippingMethodOverride: z.string().optional(),
    urgentDelivery: z.boolean().default(false),
    deliveryInstructions: z.string().optional(),
  }),

  // Informations client étendues
  customerData: z
    .object({
      isProClient: z.boolean().default(false),
      vatNumber: z.string().optional(),
      businessSector: z.string().optional(),
      discountLevel: z.number().min(0).max(100).default(0),
    })
    .optional(),

  // Métadonnées de commande
  orderInfo: z
    .object({
      source: z
        .enum(['website', 'phone', 'email', 'sales_rep'])
        .default('website'),
      urgencyLevel: z.enum(['normal', 'urgent', 'express']).default('normal'),
      notes: z.string().optional(),
      internalNotes: z.string().optional(),
      salesRepId: z.string().optional(),
    })
    .optional(),

  // Notes et instructions
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),

  // Correspondance avec tables legacy
  legacyMapping: z
    .object({
      originalOrderId: z.string().optional(), // ___xtr_order.ord_id
      customerLegacyId: z.string().optional(), // ___xtr_customer.cst_id
      statusLegacyId: z.string().optional(), // ___xtr_order_status.ords_id
    })
    .optional(),
});

// Types TypeScript inférés
export type VehicleRegistration = z.infer<typeof vehicleRegistrationSchema>;
export type VehicleVIN = z.infer<typeof vehicleVINSchema>;
export type OEMReference = z.infer<typeof oemReferenceSchema>;
export type VehicleData = z.infer<typeof vehicleDataSchema>;
export type AutomotiveOrderLine = z.infer<typeof automotiveOrderLineSchema>;
export type AutomotiveOrder = z.infer<typeof automotiveOrderSchema>;

// Fonctions de validation
export const validateVehicleData = (data: unknown): VehicleData => {
  return vehicleDataSchema.parse(data);
};

export const validateAutomotiveOrderLine = (
  data: unknown,
): AutomotiveOrderLine => {
  return automotiveOrderLineSchema.parse(data);
};

export const validateAutomotiveOrder = (data: unknown): AutomotiveOrder => {
  return automotiveOrderSchema.parse(data);
};

// DTOs pour Swagger/API
export class AutomotiveOrderDto {
  @ApiProperty({ example: 'cust_123456' })
  customerId!: string;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @ApiProperty()
  billingAddress!: any;

  @ApiProperty()
  deliveryAddress!: any;

  @ApiProperty({ type: [Object] })
  orderLines!: AutomotiveOrderLine[];

  @ApiProperty()
  shippingCalculation!: any;

  @ApiPropertyOptional()
  customerData?: any;

  @ApiPropertyOptional()
  orderInfo?: any;

  @ApiPropertyOptional()
  customerNotes?: string;

  @ApiPropertyOptional()
  internalNotes?: string;
}

export class AutomotiveOrderResponseDto {
  @ApiProperty({ example: 'ord_123456' })
  id!: string;

  @ApiProperty({ example: 'ORD-2024-001234' })
  orderNumber!: string;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty({ enum: PaymentStatus })
  paymentStatus!: PaymentStatus;

  @ApiProperty()
  standardOrder!: any;

  @ApiProperty()
  automotiveData!: {
    hasVehicleData: boolean;
    validatedVehicles: Array<{
      itemId: string;
      vehicleInfo: any;
      equivalents: any[];
    }>;
    shippingCalculation: {
      cost: number;
      method: string;
      details: any;
    };
    taxCalculation: {
      totalHT: number;
      totalTTC: number;
      breakdown: any;
    };
  };
}

// Schémas d'exportation
export {
  vehicleRegistrationSchema,
  vehicleVINSchema,
  oemReferenceSchema,
  vehicleDataSchema,
  automotiveOrderLineSchema,
  automotiveOrderSchema,
};
