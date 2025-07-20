import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseRestService, Order, PaymentCallback } from '../../../database/supabase-rest.service';
import { CreateLegacyPaymentDto, InitiateLegacyPaymentDto, LegacyPaymentResponseDto } from '../dto/payment-request.dto';
import { PaymentCallbackDto } from '../dto/payment-callback.dto';
import { PaymentAuditService } from './payment-audit.service';
import { ValidationUtils } from '../utils/validation.utils';
import { CreateLegacyPaymentSchema, InitiateLegacyPaymentSchema } from '../dto/payment-request.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly supabaseService: SupabaseRestService,
    private readonly auditService: PaymentAuditService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Créer un nouveau paiement avec les vraies tables legacy (___xtr_order)
   */
  async createPayment(createPaymentDto: CreateLegacyPaymentDto): Promise<Order> {
    try {
      // Validation avec Zod
      const validatedDto = ValidationUtils.validate(CreateLegacyPaymentSchema, createPaymentDto);
      
      // Générer un ord_id unique (format: timestamp + random)
      const ordId = ValidationUtils.generateOrderId();
      
      // Préparer les données pour ___xtr_order
      const orderData: Partial<Order> = {
        ord_id: ordId, // IMPORTANT: Générer l'ID manuellement
        ord_cst_id: validatedDto.ord_cst_id,
        ord_total_ttc: validatedDto.ord_total_ttc,
        ord_amount_ttc: validatedDto.ord_total_ttc,
        ord_is_pay: '0', // 0 = PENDING, 1 = PAID
        ord_date: new Date().toISOString(),
        ord_info: JSON.stringify({
          payment_gateway: validatedDto.payment_gateway || 'CYBERPLUS',
          return_url: validatedDto.return_url,
          cancel_url: validatedDto.cancel_url,
          callback_url: validatedDto.callback_url,
          payment_metadata: validatedDto.payment_metadata || {},
          currency: validatedDto.ord_currency || 'EUR',
          transaction_id: ValidationUtils.generateTransactionId()
        })
      };

      const payment = await this.supabaseService.createLegacyPayment(orderData);
      
      if (!payment) {
        throw new BadRequestException('Impossible de créer le paiement dans ___xtr_order');
      }

      // Log de création dans ic_postback - Utilisation directe de string
      await this.auditService.logPaymentAction(
        payment.ord_id,
        'PAYMENT_CREATED' as any, // Cast pour contourner l'enum
        validatedDto,
      );

      this.logger.log(`Paiement créé avec succès: ${payment.ord_id}`);
      return payment;
    } catch (error) {
      this.logger.error('Erreur lors de la création du paiement:', error);
      throw new BadRequestException('Erreur lors de la création du paiement');
    }
  }

  /**
   * Initier un paiement
   */
  async initiatePayment(orderId: string, initiatePaymentDto: InitiateLegacyPaymentDto): Promise<LegacyPaymentResponseDto> {
    try {
      // Validation avec Zod
      const validatedDto = ValidationUtils.validate(InitiateLegacyPaymentSchema, initiatePaymentDto);

      // Récupérer la commande existante
      const order = await this.supabaseService.getLegacyPaymentById(orderId);
      if (!order) {
        throw new NotFoundException(`Commande non trouvée: ${orderId}`);
      }

      // Mettre à jour les informations de paiement dans ord_info - PARSING SÉCURISÉ
      let orderInfo: any = {};
      try {
        orderInfo = order.ord_info ? JSON.parse(order.ord_info) : {};
      } catch (error) {
        this.logger.warn(`Impossible de parser ord_info pour order ${orderId}, utilisation d'un objet vide`, error);
        orderInfo = {};
      }
      const updatedInfo = {
        ...orderInfo,
        payment_gateway: validatedDto.payment_gateway || 'CYBERPLUS',
        return_url: validatedDto.return_url,
        cancel_url: validatedDto.cancel_url,
        callback_url: validatedDto.callback_url,
        payment_metadata: validatedDto.payment_metadata || {},
        initiated_at: new Date().toISOString()
      };

      // Mettre à jour la commande
      const updatedOrder = await this.supabaseService.updateLegacyPaymentStatus(orderId, 'PENDING');
      
      // Log d'initiation
      await this.auditService.logPaymentAction(
        orderId,
        'PAYMENT_INITIATED' as any, // Cast pour contourner l'enum
        validatedDto,
      );

      const response = LegacyPaymentResponseDto.fromSupabaseOrder(updatedOrder || order);
      this.logger.log(`Paiement initié: ${orderId}`);
      return response;
    } catch (error) {
      this.logger.error('Erreur lors de l\'initiation du paiement:', error);
      throw new BadRequestException('Erreur lors de l\'initiation du paiement');
    }
  }

  /**
   * Traiter un callback de paiement
   */
  async handlePaymentCallback(gateway: string, callbackData: PaymentCallbackDto): Promise<void> {
    try {
      // Créer l'entrée de callback dans ic_postback
      const callback: Partial<PaymentCallback> = {
        gateway: gateway.toUpperCase(),
        data: callbackData,
        status: 'RECEIVED',
        reference: callbackData.transactionId, // Utiliser transactionId au lieu de reference
        amount: callbackData.amount,
        currency: callbackData.currency || 'EUR',
        action_type: 'PAYMENT_CALLBACK',
        verified: false
      };

      await this.supabaseService.createPaymentCallback(callback);

      // Si le callback indique un paiement réussi, mettre à jour la commande
      if (callbackData.status === 'SUCCESS' || callbackData.status === 'PAID') {
        if (callbackData.orderId) {
          await this.supabaseService.updateLegacyPaymentStatus(callbackData.orderId, 'PAID');
        }
      }

      this.logger.log(`Callback traité pour ${gateway}: ${callbackData.transactionId}`);
    } catch (error) {
      this.logger.error('Erreur lors du traitement du callback:', error);
      throw new BadRequestException('Erreur lors du traitement du callback');
    }
  }

  /**
   * Récupérer le statut d'un paiement
   */
  async getPaymentStatus(orderId: string): Promise<LegacyPaymentResponseDto | null> {
    const order = await this.supabaseService.getLegacyPaymentById(orderId);
    return order ? LegacyPaymentResponseDto.fromSupabaseOrder(order) : null;
  }

  /**
   * Récupérer un paiement par ID de transaction
   */
  async getPaymentByTransactionId(transactionId: string): Promise<Order | null> {
    return this.supabaseService.getLegacyPaymentByTransactionId(transactionId);
  }

  /**
   * Obtenir les statistiques des paiements
   */
  async getPaymentStats(): Promise<any> {
    try {
      // Statistiques basées sur ___xtr_order
      const totalOrders = await this.supabaseService.getOrders();
      const paidOrders = totalOrders.filter((order: any) => order.ord_is_pay === '1');
      const pendingOrders = totalOrders.filter((order: any) => order.ord_is_pay === '0');

      const totalAmount = paidOrders.reduce((sum: number, order: any) => {
        return sum + parseFloat(order.ord_total_ttc || '0');
      }, 0);

      return {
        total_orders: totalOrders.length,
        paid_orders: paidOrders.length,
        pending_orders: pendingOrders.length,
        total_amount: totalAmount,
        currency: 'EUR'
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des statistiques:', error);
      throw new BadRequestException('Erreur lors de la récupération des statistiques');
    }
  }

  /**
   * Récupérer l'historique des callbacks pour une commande
   */
  async getPaymentCallbacks(orderId: string): Promise<PaymentCallback[]> {
    return this.supabaseService.getPaymentCallbacks(orderId);
  }
}
