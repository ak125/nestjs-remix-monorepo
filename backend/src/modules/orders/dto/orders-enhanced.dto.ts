import { z } from 'zod';

// Schema Zod pour assigner un fournisseur à une ligne de commande
export const AssignSupplierSchema = z.object({
  supplierId: z.number().min(1, 'ID fournisseur requis'),
  supplierOrderRef: z.string().optional(),
});

// Schema Zod pour créer un ticket de remboursement
export const CreateRefundTicketSchema = z.object({
  refundAmount: z
    .number()
    .min(0, 'Le montant de remboursement doit être positif'),
  reason: z.string().min(1, 'La raison est requise'),
});

// Schema Zod pour appliquer un ticket à une commande
export const ApplyTicketSchema = z.object({
  ticketReference: z.string().min(1, 'Référence ticket requise'),
  amountToUse: z.number().min(0).optional(),
});

// Types TypeScript pour l'utilisation
export type AssignSupplierDto = z.infer<typeof AssignSupplierSchema>;
export type CreateRefundTicketDto = z.infer<typeof CreateRefundTicketSchema>;
export type ApplyTicketDto = z.infer<typeof ApplyTicketSchema>;

// Fonctions de validation
export const validateAssignSupplier = (data: unknown): AssignSupplierDto => {
  return AssignSupplierSchema.parse(data);
};

export const validateCreateRefundTicket = (
  data: unknown,
): CreateRefundTicketDto => {
  return CreateRefundTicketSchema.parse(data);
};

export const validateApplyTicket = (data: unknown): ApplyTicketDto => {
  return ApplyTicketSchema.parse(data);
};
