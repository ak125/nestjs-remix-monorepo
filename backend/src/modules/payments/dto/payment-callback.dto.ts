import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ================================================================
// SCHÉMAS ZOD POUR LES CALLBACKS
// ================================================================

// Schéma pour les callbacks de paiement
export const PaymentCallbackSchema = z.object({
  transactionId: z.string().min(1, 'ID de transaction requis'),
  orderId: z.string().optional(),
  merchantId: z.string().optional(),
  status: z.string().min(1, 'Statut requis'),
  responseCode: z.string().optional(),
  authorizationCode: z.string().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  bankReference: z.string().optional(),
  cardNumber: z.string().optional(),
  cardType: z.string().optional(),
  signature: z.string().optional(),
  timestamp: z.string().optional(),

  // Données additionnelles
  message: z.string().optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Schéma pour le résultat de validation du callback
export const CallbackValidationResultSchema = z.object({
  isValid: z.boolean(),
  paymentId: z.string().optional(),
  errorMessage: z.string().optional(),
  validationDetails: z.record(z.string(), z.any()).optional(),
});

// ================================================================
// CLASSES DTO
// ================================================================

export class PaymentCallbackDto {
  @ApiProperty({ description: 'ID de transaction unique' })
  transactionId!: string;

  @ApiPropertyOptional({ description: 'ID de la commande' })
  orderId?: string;

  @ApiPropertyOptional({ description: 'ID du marchand' })
  merchantId?: string;

  @ApiProperty({ description: 'Statut du paiement' })
  status!: string;

  @ApiPropertyOptional({ description: 'Code de réponse de la gateway' })
  responseCode?: string;

  @ApiPropertyOptional({ description: "Code d'autorisation bancaire" })
  authorizationCode?: string;

  @ApiPropertyOptional({ description: 'Montant du paiement' })
  amount?: number;

  @ApiPropertyOptional({ description: 'Devise' })
  currency?: string;

  @ApiPropertyOptional({ description: 'Référence bancaire' })
  bankReference?: string;

  @ApiPropertyOptional({ description: 'Numéro de carte masqué' })
  cardNumber?: string;

  @ApiPropertyOptional({ description: 'Type de carte' })
  cardType?: string;

  @ApiPropertyOptional({ description: 'Signature de sécurité' })
  signature?: string;

  @ApiPropertyOptional({ description: 'Timestamp du callback' })
  timestamp?: string;

  @ApiPropertyOptional({ description: 'Message de la gateway' })
  message?: string;

  @ApiPropertyOptional({ description: "Message d'erreur" })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Métadonnées additionnelles' })
  metadata?: Record<string, any>;
}

export class CallbackValidationResult {
  @ApiProperty({ description: 'Le callback est-il valide ?' })
  isValid!: boolean;

  @ApiPropertyOptional({ description: 'ID du paiement associé' })
  paymentId?: string;

  @ApiPropertyOptional({ description: "Message d'erreur si invalide" })
  errorMessage?: string;

  @ApiPropertyOptional({ description: 'Détails de validation' })
  validationDetails?: Record<string, any>;
}

// ================================================================
// TYPES TYPESCRIPT INFÉRÉS
// ================================================================

export type PaymentCallbackType = z.infer<typeof PaymentCallbackSchema>;
export type CallbackValidationResultType = z.infer<
  typeof CallbackValidationResultSchema
>;
