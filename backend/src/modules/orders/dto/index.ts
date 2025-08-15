import { z } from 'zod';

// Schema Zod pour créer un fournisseur
export const CreateSupplierSchema = z.object({
  code: z.string().min(1, 'Le code est requis'),
  name: z.string().min(1, 'Le nom est requis'),
  companyName: z.string().optional(),
  siret: z.string().optional(),
  vatNumber: z.string().optional(),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  email: z.string().email('Email invalide').optional(),
  phone: z.string().optional(),
  website: z.string().url('URL invalide').optional(),
  contactName: z.string().optional(),
  deliveryDelay: z
    .number()
    .min(0, 'Le délai de livraison doit être positif')
    .optional(),
  minimumOrder: z
    .number()
    .min(0, 'La commande minimum doit être positive')
    .optional(),
  discountRate: z
    .number()
    .min(0)
    .max(100, 'Le taux de remise doit être entre 0 et 100')
    .optional(),
  isActive: z.boolean().optional().default(true),
});

// Schema Zod pour lier un fournisseur à une marque
export const LinkSupplierBrandSchema = z.object({
  supplierId: z.number().min(1, 'ID fournisseur requis'),
  brandId: z.number().min(1, 'ID marque requis'),
  isPreferred: z.boolean().optional().default(false),
  discountRate: z.number().min(0).max(100).optional(),
  deliveryDelay: z.number().min(0).optional(),
});

// Schema Zod pour créer un ticket
export const CreateTicketSchema = z.object({
  orderLineId: z.number().min(1, 'ID ligne de commande requis'),
  ticketType: z.enum(['VOUCHER', 'GIFT_CARD', 'CREDIT_NOTE', 'LOYALTY_POINTS', 'REFUND']),
  ticketReference: z.string().min(1, 'Référence ticket requise'),
  ticketValue: z.number().min(0, 'La valeur doit être positive'),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// Schema Zod pour utiliser un ticket
export const UseTicketSchema = z.object({
  amountToUse: z.number().min(0, 'Le montant à utiliser doit être positif'),
});

// Schema Zod pour appliquer un ticket à une commande
export const ApplyTicketToOrderSchema = z.object({
  ticketReference: z.string().min(1, 'Référence ticket requise'),
  amountToUse: z.number().min(0).optional(),
});

// Types TypeScript pour l'utilisation
export type CreateSupplierDto = z.infer<typeof CreateSupplierSchema>;
export type LinkSupplierBrandDto = z.infer<typeof LinkSupplierBrandSchema>;
export type CreateTicketDto = z.infer<typeof CreateTicketSchema>;
export type UseTicketDto = z.infer<typeof UseTicketSchema>;
export type ApplyTicketToOrderDto = z.infer<typeof ApplyTicketToOrderSchema>;

// Fonctions de validation
export const validateCreateSupplier = (data: unknown): CreateSupplierDto => {
  return CreateSupplierSchema.parse(data);
};

export const validateLinkSupplierBrand = (
  data: unknown,
): LinkSupplierBrandDto => {
  return LinkSupplierBrandSchema.parse(data);
};

export const validateCreateTicket = (data: unknown): CreateTicketDto => {
  return CreateTicketSchema.parse(data);
};

export const validateUseTicket = (data: unknown): UseTicketDto => {
  return UseTicketSchema.parse(data);
};

export const validateApplyTicketToOrder = (
  data: unknown,
): ApplyTicketToOrderDto => {
  return ApplyTicketToOrderSchema.parse(data);
};
