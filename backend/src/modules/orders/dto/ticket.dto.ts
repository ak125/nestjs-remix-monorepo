import { z } from 'zod';

// Énumération des types de tickets
export const TicketTypeEnum = z.enum([
  'VOUCHER',
  'GIFT_CARD', 
  'CREDIT_NOTE',
  'LOYALTY_POINTS',
  'REFUND',
]);

export type TicketType = z.infer<typeof TicketTypeEnum>;

// Schema Zod pour créer un ticket équivalent
export const CreateTicketEquivalentSchema = z.object({
  orderLineId: z.string().min(1, 'ID ligne de commande requis'),
  orderId: z.string().min(1, 'ID commande requis'),
  equivalentId: z.string().min(1, 'ID équivalent requis'),
  amountTtc: z.number().min(0, 'Le montant doit être positif'),
});

// Schema Zod pour créer un ticket complet
export const CreateTicketSchema = z.object({
  orderLineId: z.number().min(1, 'ID ligne de commande requis'),
  ticketType: TicketTypeEnum,
  ticketReference: z.string().min(1, 'Référence ticket requise'),
  ticketValue: z.number().min(0, 'La valeur doit être positive'),
  expiryDate: z.date().optional(),
  notes: z.string().optional(),
});

// Schema Zod pour utiliser un ticket
export const UseTicketSchema = z.object({
  ticketReference: z.string().min(1, 'Référence ticket requise'),
  amountToUse: z.number().min(0, 'Le montant à utiliser doit être positif'),
});

// Schema Zod pour appliquer un ticket à une commande
export const ApplyTicketToOrderSchema = z.object({
  ticketReference: z.string().min(1, 'Référence ticket requise'),
  amountToUse: z.number().min(0).optional(),
});

// Schema Zod pour créer un ticket de remboursement
export const CreateRefundTicketSchema = z.object({
  refundAmount: z.number().min(0, 'Le montant de remboursement doit être positif'),
  reason: z.string().min(1, 'La raison est requise'),
});

// Schema Zod pour mettre à jour un ticket
export const UpdateTicketSchema = z.object({
  amountTtc: z.number().min(0).optional(),
  notes: z.string().optional(),
  isUsed: z.boolean().optional(),
});

// Types TypeScript pour l'utilisation
export type CreateTicketEquivalentDto = z.infer<typeof CreateTicketEquivalentSchema>;
export type CreateTicketDto = z.infer<typeof CreateTicketSchema>;
export type UseTicketDto = z.infer<typeof UseTicketSchema>;
export type ApplyTicketToOrderDto = z.infer<typeof ApplyTicketToOrderSchema>;
export type CreateRefundTicketDto = z.infer<typeof CreateRefundTicketSchema>;
export type UpdateTicketDto = z.infer<typeof UpdateTicketSchema>;

// Fonctions de validation
export const validateCreateTicketEquivalent = (
  data: unknown,
): CreateTicketEquivalentDto => {
  return CreateTicketEquivalentSchema.parse(data);
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

export const validateCreateRefundTicket = (
  data: unknown,
): CreateRefundTicketDto => {
  return CreateRefundTicketSchema.parse(data);
};

export const validateUpdateTicket = (data: unknown): UpdateTicketDto => {
  return UpdateTicketSchema.parse(data);
};
