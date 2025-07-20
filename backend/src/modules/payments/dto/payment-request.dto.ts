import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ================================================================
// SCHÉMAS ZOD - VALIDATION STRICTE (TABLES LEGACY)
// ================================================================

// Enum pour les méthodes de paiement (tables legacy)
export const PaymentGatewaySchema = z.enum(['CYBERPLUS', 'STRIPE', 'PAYPAL', 'BANK_TRANSFER']);

// Enum pour les statuts de paiement (tables legacy)
export const PaymentStatusSchema = z.enum(['EN_ATTENTE', 'PAYE', 'ECHEC', 'REMBOURSE', 'ANNULE']);

// Schéma pour créer un paiement - VRAIES TABLES LEGACY ___xtr_order
export const CreateLegacyPaymentSchema = z.object({
  ord_cst_id: z.string().min(1, 'L\'ID client (___XTR_CUSTOMER) est requis'),    // Clé étrangère vers ___xtr_customer
  ord_total_ttc: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Format de montant invalide'), // Montant TTC
  ord_currency: z.string().length(3, 'La devise doit faire 3 caractères').optional().default('EUR'),
  payment_gateway: PaymentGatewaySchema.optional().default('CYBERPLUS'),        // Stocké dans ord_info (JSON)
  return_url: z.string().url('URL de retour invalide').optional(),             // Stocké dans ord_info (JSON)  
  cancel_url: z.string().url('URL d\'annulation invalide').optional(),         // Stocké dans ord_info (JSON)
  callback_url: z.string().url('URL de callback invalide').optional(),         // Stocké dans ord_info (JSON)
  payment_metadata: z.record(z.string(), z.any()).optional(),                  // Stocké dans ord_info (JSON)
});

// Schéma pour initier un paiement legacy - PLUS FLEXIBLE
export const InitiateLegacyPaymentSchema = z.object({
  payment_gateway: PaymentGatewaySchema.optional().default('CYBERPLUS'),
  return_url: z.string().url('URL de retour invalide').optional(),
  cancel_url: z.string().url('URL d\'annulation invalide').optional(), 
  callback_url: z.string().url('URL de callback invalide').optional(),
  customerInfo: z.object({
    email: z.string().email('Email invalide').optional(),
    firstName: z.string().min(1, 'Prénom requis').optional(),
    lastName: z.string().min(1, 'Nom requis').optional(),
    phone: z.string().optional(),
  }).optional(),
  billingAddress: z.object({
    street: z.string().min(1, 'Rue requise').optional(),
    city: z.string().min(1, 'Ville requise').optional(),
    postalCode: z.string().min(1, 'Code postal requis').optional(),
    country: z.string().optional().default('France'),
  }).optional(),
  payment_metadata: z.record(z.string(), z.any()).optional(),
});

// Schéma pour la réponse de paiement legacy
export const LegacyPaymentResponseSchema = z.object({
  pay_id: z.string(),
  pay_ord_id: z.string(),
  pay_cst_id: z.string(),
  pay_amount: z.string(),
  pay_currency: z.string(),
  pay_status: PaymentStatusSchema,
  pay_gateway: PaymentGatewaySchema,
  pay_transaction_id: z.string().nullable(),
  pay_bank_reference: z.string().nullable(),
  pay_return_url: z.string().url().optional(),
  pay_cancel_url: z.string().url().optional(),
  pay_callback_url: z.string().url().optional(),
  pay_metadata: z.record(z.string(), z.any()).optional(),
  pay_created_at: z.string(),
  pay_updated_at: z.string(),
  pay_paid_at: z.string().nullable(),
});

// Schéma pour créer un callback legacy (ic_postback)
export const CreateLegacyCallbackSchema = z.object({
  commandeId: z.number(),
  typeAction: z.string(),
  gatewaySource: z.string(),
  transactionExterneId: z.string().optional(),
  donneesCallback: z.record(z.string(), z.any()).optional(),
  adresseIp: z.string().optional(),
  userAgent: z.string().optional(),
  statutRetour: z.string(),
  montantConfirme: z.string().optional(),
  deviseConfirmee: z.string().optional(),
  signatureVerifiee: z.boolean().optional(),
  erreurMessage: z.string().optional(),
});

// ================================================================
// CLASSES DTO - POUR NESTJS ET SWAGGER (TABLES LEGACY)
// ================================================================

export class CreateLegacyPaymentDto {
  @ApiProperty({ description: 'ID du client (___XTR_CUSTOMER)', example: '456' })
  ord_cst_id!: string;

  @ApiProperty({ description: 'Montant TTC du paiement', example: '99.99' })
  ord_total_ttc!: string;

  @ApiPropertyOptional({ description: 'Devise', example: 'EUR', default: 'EUR' })
  ord_currency?: string;

  @ApiPropertyOptional({ 
    description: 'Gateway de paiement (stocké dans ord_info)', 
    enum: ['CYBERPLUS', 'STRIPE', 'PAYPAL', 'BANK_TRANSFER'],
    default: 'CYBERPLUS'
  })
  payment_gateway?: string;

  @ApiPropertyOptional({ description: 'URL de retour après paiement réussi (stockée dans ord_info)' })
  return_url?: string;

  @ApiPropertyOptional({ description: 'URL de retour après annulation (stockée dans ord_info)' })
  cancel_url?: string;

  @ApiPropertyOptional({ description: 'URL de callback pour notifications (stockée dans ord_info)' })
  callback_url?: string;

  @ApiPropertyOptional({ description: 'Métadonnées additionnelles (stockées dans ord_info)' })
  payment_metadata?: Record<string, any>;
}

export class InitiateLegacyPaymentDto {
  @ApiPropertyOptional({ 
    description: 'Gateway de paiement', 
    enum: ['CYBERPLUS', 'STRIPE', 'PAYPAL', 'BANK_TRANSFER'],
    default: 'CYBERPLUS'
  })
  payment_gateway?: string;

  @ApiPropertyOptional({ description: 'URL de retour après paiement réussi' })
  return_url?: string;

  @ApiPropertyOptional({ description: 'URL de retour après annulation' })
  cancel_url?: string;

  @ApiPropertyOptional({ description: 'URL de callback pour notifications' })
  callback_url?: string;

  @ApiPropertyOptional({ description: 'Informations client' })
  customerInfo?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };

  @ApiPropertyOptional({ description: 'Adresse de facturation' })
  billingAddress?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };

  @ApiPropertyOptional({ description: 'Métadonnées additionnelles' })
  payment_metadata?: Record<string, any>;
}

export class LegacyPaymentResponseDto {
  @ApiProperty({ description: 'ID unique du paiement (backofficeplateform_commande.id)' })
  id!: number;

  @ApiProperty({ description: 'ID de la commande ___XTR_ORDER' })
  orderId!: number;

  @ApiProperty({ description: 'ID du client ___XTR_CUSTOMER' })
  customerId!: number;

  @ApiProperty({ description: 'Montant total du paiement' })
  montantTotal!: number;

  @ApiProperty({ description: 'Devise' })
  devise!: string;

  @ApiProperty({ 
    description: 'Statut du paiement',
    enum: ['EN_ATTENTE', 'PAYE', 'ECHEC', 'REMBOURSE', 'ANNULE']
  })
  statutPaiement!: string;

  @ApiProperty({ 
    description: 'Méthode de paiement',
    enum: ['CYBERPLUS', 'STRIPE', 'PAYPAL', 'VIREMENT']
  })
  methodePaiement!: string;

  @ApiPropertyOptional({ description: 'ID de transaction de la gateway' })
  referenceTransaction?: string | null;

  @ApiPropertyOptional({ description: 'Référence bancaire' })
  referenceBancaire?: string | null;

  @ApiPropertyOptional({ description: 'URL de retour succès' })
  urlRetourOk?: string;

  @ApiPropertyOptional({ description: 'URL de retour échec' })
  urlRetourNok?: string;

  @ApiPropertyOptional({ description: 'URL de callback' })
  urlCallback?: string;

  @ApiPropertyOptional({ description: 'Métadonnées' })
  donneesMeta?: Record<string, any>;

  @ApiProperty({ description: 'Date de création' })
  dateCreation!: string;

  @ApiProperty({ description: 'Date de dernière modification' })
  dateModification!: string;

  @ApiPropertyOptional({ description: 'Date de paiement effectif' })
  datePaiement?: string | null;

  /**
   * Créer un LegacyPaymentResponseDto à partir d'une entité backofficeplateform_commande
   */
  static fromLegacyPaymentOrder(payment: any): LegacyPaymentResponseDto {
    const response = new LegacyPaymentResponseDto();
    response.id = payment.id;
    response.orderId = payment.ord_id;
    response.customerId = payment.cst_id;
    response.montantTotal = parseFloat(payment.montant_total);
    response.devise = payment.devise;
    response.statutPaiement = payment.statut_paiement;
    response.methodePaiement = payment.methode_paiement;
    response.referenceTransaction = payment.reference_transaction;
    response.referenceBancaire = payment.reference_bancaire;
    response.urlRetourOk = payment.url_retour_ok;
    response.urlRetourNok = payment.url_retour_nok;
    response.urlCallback = payment.url_callback;
    response.donneesMeta = payment.donnees_meta;
    response.dateCreation = payment.date_creation;
    response.dateModification = payment.date_modification;
    response.datePaiement = payment.date_paiement;
    return response;
  }

  /**
   * Créer un LegacyPaymentResponseDto à partir d'une entité Order (___xtr_order)
   */
  static fromSupabaseOrder(order: any): LegacyPaymentResponseDto {
    const response = new LegacyPaymentResponseDto();
    
    // Mapper les champs de ___xtr_order vers notre DTO
    response.id = parseInt(order.ord_id);
    response.orderId = parseInt(order.ord_id);
    response.customerId = parseInt(order.ord_cst_id);
    response.montantTotal = parseFloat(order.ord_total_ttc || '0');
    response.devise = 'EUR'; // Par défaut
    
    // Mapper le statut ord_is_pay -> statut lisible
    response.statutPaiement = order.ord_is_pay === '1' ? 'PAYE' : 'EN_ATTENTE';
    
    // Extraire les infos du JSON ord_info
    let orderInfo: any = {};
    try {
      orderInfo = order.ord_info ? JSON.parse(order.ord_info) : {};
    } catch (e) {
      orderInfo = {};
    }
    
    response.methodePaiement = orderInfo.payment_gateway || 'CYBERPLUS';
    response.urlRetourOk = orderInfo.return_url;
    response.urlRetourNok = orderInfo.cancel_url;
    response.urlCallback = orderInfo.callback_url;
    response.referenceTransaction = orderInfo.transaction_id;
    response.donneesMeta = orderInfo.payment_metadata || {};
    
    response.dateCreation = order.ord_date || new Date().toISOString();
    response.dateModification = order.ord_date || new Date().toISOString();
    response.datePaiement = order.ord_date_pay;
    
    return response;
  }
}

export class LegacyCallbackDto {
  @ApiProperty({ description: 'ID de la commande de paiement' })
  commandeId!: number;

  @ApiProperty({ description: 'Type d action', example: 'CALLBACK_RECEIVED' })
  typeAction!: string;

  @ApiProperty({ description: 'Gateway source', example: 'CYBERPLUS' })
  gatewaySource!: string;

  @ApiPropertyOptional({ description: 'ID de transaction externe' })
  transactionExterneId?: string;

  @ApiPropertyOptional({ description: 'Données brutes du callback' })
  donneesCallback?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Adresse IP du callback' })
  adresseIp?: string;

  @ApiPropertyOptional({ description: 'User Agent' })
  userAgent?: string;

  @ApiProperty({ description: 'Statut retourné par la gateway' })
  statutRetour!: string;

  @ApiPropertyOptional({ description: 'Montant confirmé par la gateway' })
  montantConfirme?: string;

  @ApiPropertyOptional({ description: 'Devise confirmée' })
  deviseConfirmee?: string;

  @ApiPropertyOptional({ description: 'Signature vérifiée' })
  signatureVerifiee?: boolean;

  @ApiPropertyOptional({ description: 'Message d erreur éventuel' })
  erreurMessage?: string;
}

// ================================================================
// TYPES TYPESCRIPT INFÉRÉS (TABLES LEGACY)
// ================================================================

export type CreateLegacyPaymentType = z.infer<typeof CreateLegacyPaymentSchema>;
export type InitiateLegacyPaymentType = z.infer<typeof InitiateLegacyPaymentSchema>;
export type LegacyPaymentResponseType = z.infer<typeof LegacyPaymentResponseSchema>;
export type CreateLegacyCallbackType = z.infer<typeof CreateLegacyCallbackSchema>;
export type PaymentGatewayType = z.infer<typeof PaymentGatewaySchema>;
export type PaymentStatusType = z.infer<typeof PaymentStatusSchema>;
