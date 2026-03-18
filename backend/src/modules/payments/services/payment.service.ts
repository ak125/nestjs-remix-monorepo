import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentDataService } from '../repositories/payment-data.service';
import { CyberplusService } from './cyberplus.service';
import { PaymentValidationService } from './payment-validation.service';
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
  PaymentHelper,
} from '../entities/payment.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import {
  ORDER_EVENTS,
  type OrderRefundedEvent,
} from '../../orders/events/order.events';

// Interfaces temporaires pour la migration
export interface PaymentStatusDto {
  transactionId: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  amount: number;
  orderId: string;
}

export interface PaymentCallbackDto {
  paymentReference: string;
  status: string;
  transactionId: string;
  amount: number;
  signature?: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentDataService: PaymentDataService,
    private readonly cyberplusService: CyberplusService,
    private readonly validationService: PaymentValidationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Créer un nouveau paiement
   * 🔐 SECURITY: Vérifie que le montant correspond à la commande stockée
   */
  async createPayment(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    try {
      this.logger.log(`Creating payment for order ${createPaymentDto.orderId}`);

      // Validation des données
      this.validationService.validateAmountLimits(createPaymentDto.amount);

      // 🔐 SECURITY: Vérification du montant contre la commande stockée
      if (createPaymentDto.orderId) {
        const order = await this.paymentDataService.getOrderForPayment(
          createPaymentDto.orderId,
        );

        if (!order) {
          this.logger.error(
            `⚠️ Payment attempt for non-existent order: ${createPaymentDto.orderId}`,
          );
          throw new BadRequestException('Commande introuvable');
        }

        // Vérifier que la commande n'est pas déjà payée
        if (order.ord_is_pay === '1') {
          this.logger.warn(
            `⚠️ Payment attempt for already paid order: ${order.ord_id}`,
          );
          throw new BadRequestException('Commande déjà payée');
        }

        // Vérifier que le montant correspond au snapshot stocké (en centimes pour éviter erreurs d'arrondi)
        const storedAmountCents = Math.round(
          parseFloat(order.ord_total_ttc || '0') * 100,
        );
        const requestedAmountCents = Math.round(createPaymentDto.amount * 100);

        if (storedAmountCents !== requestedAmountCents) {
          this.logger.error(
            `⚠️ Amount mismatch! Order ${order.ord_id}: stored=${storedAmountCents}c, requested=${requestedAmountCents}c`,
          );
          throw new BadRequestException(
            'Le montant ne correspond pas à la commande',
          );
        }

        this.logger.log(
          `✅ Order ${order.ord_id} verified: amount=${storedAmountCents}c, not paid yet`,
        );
      }

      // Génération de la référence de paiement
      const paymentReference = PaymentHelper.generatePaymentReference();

      // Création du paiement en base
      const paymentData: Partial<Payment> = {
        paymentReference,
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency || 'EUR',
        status: PaymentStatus.PENDING,
        method: createPaymentDto.method,
        description: createPaymentDto.description,
        userId: createPaymentDto.userId,
        orderId: createPaymentDto.orderId,
        createdAt: new Date(),
        updatedAt: new Date(),
        refundedAmount: 0,
        // ✅ Phase 6: Stocker info consignes dans metadata (optionnel, pour référence)
        metadata: {
          ...createPaymentDto.metadata,
          consigne_total: createPaymentDto.consigne_total || 0,
          note: 'Consignes stockées dans ___xtr_order.ord_deposit_ttc',
        },
      };

      const payment = await this.paymentDataService.createPayment(paymentData);

      // Si c'est un paiement Cyberplus, initier le processus
      if (createPaymentDto.method === PaymentMethod.CYBERPLUS) {
        // Note: initiatePayment method needs to be implemented in CyberplusService
        // await this.cyberplusService.initiatePayment(payment, email);
      }

      this.logger.log(`Payment created successfully: ${payment.id}`);
      return payment;
    } catch (error) {
      this.logger.error(
        `Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Initialiser un paiement avancé (TODO: Implémenter les méthodes manquantes)
   */
  async initializePayment(): Promise<{
    transactionId: string;
    formData: Record<string, string>;
    gatewayUrl: string;
  }> {
    // TODO: Implémenter les méthodes manquantes dans PaymentDataService et CyberplusService
    throw new BadRequestException('Method not yet implemented');

    /* 
    try {
      this.logger.log(`Initializing payment for order ${paymentData.orderId}`);

      // TODO: Implémenter getOrderForPayment dans PaymentDataService
      const order = await this.paymentDataService.getOrderForPayment(
        paymentData.orderId,
        paymentData.userId,
      );

      if (!order) {
        throw new BadRequestException('Commande introuvable');
      }

      // Valider le montant
      if (Math.abs(order.total_ttc - paymentData.amount) > 0.01) {
        throw new BadRequestException('Montant incorrect');
      }

      // Générer un ID de transaction unique
      const transactionId = this.generateTransactionId();

      // TODO: Implémenter createPaymentTransaction dans PaymentDataService
      const _payment = await this.paymentDataService.createPaymentTransaction({
        transactionId,
        orderId: paymentData.orderId,
        customerId: paymentData.userId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'EUR',
        status: 'PENDING',
        paymentMethod: 'CARD',
        gateway: 'CYBERPLUS',
        ipAddress: paymentData.ipAddress,
      });

      // Préparer les données Cyberplus
      const cyberplusData = {
        transactionId,
        amount: Math.round(paymentData.amount * 100), // Montant en centimes
        currency: this.getCurrencyCode(paymentData.currency),
        orderNumber: order.order_number,
        email: order.email,
        firstName: order.firstname,
        lastName: order.lastname,
        address: order.address1,
        postalCode: order.postal_code,
        city: order.city,
        country: order.country || 'FR',
        returnUrl: paymentData.returnUrl,
        ipnUrl: `${process.env.BASE_URL}/api/payment/webhook/cyberplus`,
      };

      // TODO: Implémenter generatePaymentForm dans CyberplusService
      const formData = await this.cyberplusService.generatePaymentForm(
        cyberplusData,
      );

      // TODO: Implémenter logPaymentAttempt dans PaymentDataService
      await this.paymentDataService.logPaymentAttempt({
        transactionId,
        orderId: paymentData.orderId,
        userId: paymentData.userId,
        amount: paymentData.amount,
        status: 'INITIATED',
        gateway: 'CYBERPLUS',
        ipAddress: paymentData.ipAddress,
      });

      return {
        transactionId,
        formData,
        gatewayUrl: this.cyberplusService.getGatewayUrl(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to initialize payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
    */
  }

  /**
   * Traiter un callback de paiement
   */
  async handlePaymentCallback(
    callbackData: PaymentCallbackDto,
  ): Promise<Payment> {
    try {
      this.logger.log(
        `Processing payment callback for ${callbackData.paymentReference}`,
      );

      // Trouver le paiement
      const payment = await this.paymentDataService.findPaymentByReference(
        callbackData.paymentReference,
      );

      if (!payment) {
        throw new NotFoundException(
          `Payment not found: ${callbackData.paymentReference}`,
        );
      }

      // Valider la signature si fournie
      if (callbackData.signature) {
        const isValid = this.validationService.validateCyberplusSignature(
          callbackData,
          callbackData.signature,
        );
        if (!isValid) {
          throw new BadRequestException('Invalid signature');
        }
      }

      // Mapper le statut
      const status = this.mapCallbackStatus(callbackData.status);

      // Mettre à jour le paiement
      const updatedPayment = await this.paymentDataService.updatePaymentStatus(
        payment.id,
        status,
      );

      // Créer une transaction de log
      await this.paymentDataService.createTransaction({
        paymentId: payment.id,
        type: 'payment',
        amount: callbackData.amount,
        status: callbackData.status,
        providerTransactionId: callbackData.transactionId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.logger.log(`Payment callback processed: ${payment.id} -> ${status}`);
      return updatedPayment;
    } catch (error) {
      this.logger.error(
        `Failed to handle callback: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Obtenir le statut d'un paiement
   */
  async getPaymentStatus(paymentId: string): Promise<Payment> {
    try {
      const payment = await this.paymentDataService.findPaymentById(paymentId);

      if (!payment) {
        throw new NotFoundException(`Payment not found: ${paymentId}`);
      }

      return payment;
    } catch (error) {
      this.logger.error(
        `Failed to get payment status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Obtenir un paiement par sa référence
   */
  async getPaymentByReference(reference: string): Promise<Payment> {
    try {
      const payment =
        await this.paymentDataService.findPaymentByReference(reference);

      if (!payment) {
        throw new NotFoundException(`Payment not found: ${reference}`);
      }

      return payment;
    } catch (error) {
      this.logger.error(
        `Failed to get payment by reference: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Obtenir les paiements d'un utilisateur
   */
  async getUserPayments(userId: string, limit = 20): Promise<Payment[]> {
    try {
      return await this.paymentDataService.findPaymentsByUserId(userId, limit);
    } catch (error) {
      this.logger.error(
        `Failed to get user payments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Annuler un paiement
   */
  async cancelPayment(paymentId: string): Promise<Payment> {
    try {
      const payment = await this.paymentDataService.findPaymentById(paymentId);

      if (!payment) {
        throw new NotFoundException(`Payment not found: ${paymentId}`);
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException(
          `Cannot cancel payment with status: ${payment.status}`,
        );
      }

      const updatedPayment = await this.paymentDataService.updatePaymentStatus(
        paymentId,
        PaymentStatus.CANCELLED,
      );

      this.logger.log(`Payment cancelled: ${paymentId}`);
      return updatedPayment;
    } catch (error) {
      this.logger.error(
        `Failed to cancel payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Mapper le statut du callback vers notre enum
   */
  private mapCallbackStatus(providerStatus: string): PaymentStatus {
    switch (providerStatus.toLowerCase()) {
      case 'success':
      case 'completed':
      case 'paid':
        return PaymentStatus.COMPLETED;
      case 'failed':
      case 'error':
      case 'declined':
        return PaymentStatus.FAILED;
      case 'cancelled':
      case 'canceled':
        return PaymentStatus.CANCELLED;
      case 'processing':
        return PaymentStatus.PROCESSING;
      default:
        return PaymentStatus.PENDING;
    }
  }

  /**
   * Générer un ID de transaction unique
   */
  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `TXN_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Obtenir le code devise ISO
   */
  private getCurrencyCode(currency: string): string {
    const currencyMap: Record<string, string> = {
      EUR: '978',
      USD: '840',
      GBP: '826',
    };
    return currencyMap[currency] || '978';
  }

  /**
   * Traiter un remboursement complet:
   * 1. Valider montant  2. Persister __refunds  3. Update ic_postback  4. Transaction  5. Event
   */
  async processRefund(
    paymentId: string,
    amount?: number,
    reason?: string,
    initiatedBy?: string,
  ): Promise<{ refundId: string; amount: number; status: string }> {
    try {
      this.logger.log(`Processing refund for payment ${paymentId}`);

      const payment = await this.paymentDataService.findPaymentById(paymentId);
      if (!payment)
        throw new NotFoundException(`Payment not found: ${paymentId}`);
      if (payment.status !== PaymentStatus.COMPLETED)
        throw new BadRequestException('Payment not eligible for refund');

      const refundAmount = amount || payment.amount;
      const availableAmount = payment.amount - (payment.refundedAmount || 0);
      if (refundAmount > availableAmount)
        throw new BadRequestException(
          `Refund amount ${refundAmount} exceeds available ${availableAmount}`,
        );

      const isFullRefund = refundAmount >= payment.amount;
      const refundReason = reason || 'Remboursement manuel';
      const adminId = initiatedBy || 'system';

      // Persister dans __refunds
      const { data: refund, error: refundError } =
        await this.paymentDataService.client
          .from('__refunds')
          .insert({
            ref_order_id: payment.orderId || '',
            ref_payment_ref: payment.paymentReference,
            ref_amount: refundAmount,
            ref_reason: refundReason,
            ref_type: isFullRefund ? 'full' : 'partial',
            ref_status: 'processed',
            ref_psp_gateway: payment.method || 'manual',
            ref_initiated_by: adminId,
            ref_processed_at: new Date().toISOString(),
          })
          .select('ref_id')
          .single();

      if (refundError)
        throw new BadRequestException(
          `Refund insert failed: ${refundError.message}`,
        );

      // Update payment status
      const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';
      await this.paymentDataService.updatePaymentStatus(
        paymentId,
        newPaymentStatus,
      );

      // Transaction
      await this.paymentDataService.createTransaction({
        paymentId,
        type: 'refund',
        amount: refundAmount,
        status: 'success',
      });

      // Event
      if (payment.orderId) {
        this.eventEmitter.emit(ORDER_EVENTS.REFUNDED, {
          orderId: payment.orderId,
          refundId: refund.ref_id,
          amount: refundAmount,
          reason: refundReason,
          initiatedBy: adminId,
          timestamp: new Date().toISOString(),
        } satisfies OrderRefundedEvent);
      }

      this.logger.log(
        `Refund processed: ${refund.ref_id} — ${refundAmount}€ for payment ${paymentId}`,
      );
      return {
        refundId: refund.ref_id,
        amount: refundAmount,
        status: 'processed',
      };
    } catch (error) {
      this.logger.error(
        `Failed to process refund: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Récupère un paiement par son orderId
   */
  async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
    try {
      this.logger.log(`Getting payment by order ID: ${orderId}`);
      const payments =
        await this.paymentDataService.findPaymentsByOrderId(orderId);
      return payments.length > 0 ? payments[0] : null;
    } catch (error) {
      this.logger.error(
        `Failed to get payment by order ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Met à jour le statut d'un paiement
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
  ): Promise<Payment> {
    try {
      this.logger.log(`Updating payment ${paymentId} status to ${status}`);

      const payment = await this.paymentDataService.findPaymentById(paymentId);
      if (!payment) {
        throw new NotFoundException(`Payment with ID ${paymentId} not found`);
      }

      const updatedPayment = await this.paymentDataService.updatePaymentStatus(
        paymentId,
        status,
      );

      this.logger.log(`Payment ${paymentId} status updated to ${status}`);
      return updatedPayment;
    } catch (error) {
      this.logger.error(
        `Failed to update payment status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
