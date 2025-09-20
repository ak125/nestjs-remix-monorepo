import { z } from 'zod';

/**
 * DTOs pour la gestion des adresses séparées
 * Compatible avec les tables ___xtr_customer_billing_address et ___xtr_customer_delivery_address
 */

// =====================================
// SCHEMAS ADRESSES DE FACTURATION
// =====================================

/**
 * Schema pour créer une adresse de facturation
 */
export const CreateBillingAddressSchema = z
  .object({
    customerId: z.number().positive("L'ID client doit être un nombre positif"),
    firstname: z.string().min(1, 'Le prénom est obligatoire').max(100),
    lastname: z.string().min(1, 'Le nom est obligatoire').max(100),
    company: z.string().max(255).optional(),
    address1: z.string().min(1, "L'adresse est obligatoire").max(255),
    address2: z.string().max(255).optional(),
    postalCode: z
      .string()
      .regex(/^[0-9]{5}$/, 'Code postal français requis (5 chiffres)'),
    city: z.string().min(1, 'La ville est obligatoire').max(100),
    country: z.string().length(2, 'Code pays ISO 2 caractères').default('FR'),
    phone: z
      .string()
      .regex(/^[+]?[0-9\s\-().]{10,20}$/, 'Format de téléphone invalide')
      .optional(),
  })
  .strict();

/**
 * Schema pour mettre à jour une adresse de facturation
 */
export const UpdateBillingAddressSchema = CreateBillingAddressSchema.omit({
  customerId: true,
})
  .partial()
  .strict();

// =====================================
// SCHEMAS ADRESSES DE LIVRAISON
// =====================================

/**
 * Schema pour créer une adresse de livraison
 */
export const CreateDeliveryAddressSchema = z
  .object({
    customerId: z.number().positive("L'ID client doit être un nombre positif"),
    label: z
      .string()
      .min(1, 'Le libellé est obligatoire')
      .max(100)
      .default('Domicile'),
    firstname: z.string().min(1, 'Le prénom est obligatoire').max(100),
    lastname: z.string().min(1, 'Le nom est obligatoire').max(100),
    company: z.string().max(255).optional(),
    address1: z.string().min(1, "L'adresse est obligatoire").max(255),
    address2: z.string().max(255).optional(),
    postalCode: z
      .string()
      .regex(/^[0-9]{5}$/, 'Code postal français requis (5 chiffres)'),
    city: z.string().min(1, 'La ville est obligatoire').max(100),
    country: z.string().length(2, 'Code pays ISO 2 caractères').default('FR'),
    phone: z
      .string()
      .regex(/^[+]?[0-9\s\-().]{10,20}$/, 'Format de téléphone invalide')
      .optional(),
    isDefault: z.boolean().default(false),
  })
  .strict();

/**
 * Schema pour mettre à jour une adresse de livraison
 */
export const UpdateDeliveryAddressSchema = CreateDeliveryAddressSchema.omit({
  customerId: true,
})
  .partial()
  .strict();

/**
 * Schema pour définir une adresse de livraison par défaut
 */
export const SetDefaultDeliveryAddressSchema = z
  .object({
    customerId: z.number().positive("L'ID client doit être un nombre positif"),
    addressId: z
      .number()
      .positive("L'ID de l'adresse doit être un nombre positif"),
  })
  .strict();

// =====================================
// TYPES INFÉRÉS
// =====================================

export type CreateBillingAddressDto = z.infer<
  typeof CreateBillingAddressSchema
>;
export type UpdateBillingAddressDto = z.infer<
  typeof UpdateBillingAddressSchema
>;
export type CreateDeliveryAddressDto = z.infer<
  typeof CreateDeliveryAddressSchema
>;
export type UpdateDeliveryAddressDto = z.infer<
  typeof UpdateDeliveryAddressSchema
>;
export type SetDefaultDeliveryAddressDto = z.infer<
  typeof SetDefaultDeliveryAddressSchema
>;

// =====================================
// INTERFACES POUR LES RÉPONSES
// =====================================

export interface BillingAddress {
  id: number;
  customerId: number;
  firstname: string;
  lastname: string;
  company?: string;
  address1: string;
  address2?: string;
  postalCode: string;
  city: string;
  country: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryAddress {
  id: number;
  customerId: number;
  label: string;
  firstname: string;
  lastname: string;
  company?: string;
  address1: string;
  address2?: string;
  postalCode: string;
  city: string;
  country: string;
  phone?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddressResponse {
  success: boolean;
  message: string;
  address?: BillingAddress | DeliveryAddress;
}

export interface AddressListResponse {
  billingAddress?: BillingAddress;
  deliveryAddresses: DeliveryAddress[];
  defaultDeliveryAddress?: DeliveryAddress;
}
