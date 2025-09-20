import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { CyberplusService } from '../services/cyberplus.service';
import { PaymentStatus } from '../entities/payment.entity';

@ApiTags('payment-callbacks')
@Controller('payments/callback')
export class PaymentCallbackController {
  private readonly logger = new Logger(PaymentCallbackController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly cyberplusService: CyberplusService,
  ) {}

  @Post('cyberplus')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Callback Cyberplus pour les notifications de paiement',
  })
  @ApiResponse({ status: 200, description: 'Callback traité avec succès' })
  @ApiResponse({ status: 400, description: 'Callback invalide' })
  async handleCyberplusCallback(
    @Body() body: any,
    @Headers('x-signature') _signature?: string,
  ) {
    try {
      this.logger.log('Received Cyberplus callback', body);

      // Validation de la signature
      const isValid = this.cyberplusService.validateCallback(body);
      if (!isValid) {
        this.logger.warn('Invalid callback signature');
        return {
          success: false,
          message: 'Invalid signature',
          paymentId: body.order_id || '',
        };
      }

      // Traitement du callback
      const payment = await this.paymentService.handlePaymentCallback({
        transactionId: body.transaction_id,
        paymentReference: body.order_id || body.transaction_id,
        status: body.status,
        amount: parseFloat(body.amount) || 0,
      });

      this.logger.log(`Payment callback processed: ${payment.id}`);

      return {
        success: true,
        message: 'Callback processed successfully',
        paymentId: payment.id,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process callback: ${errorMessage}`);
      return {
        success: false,
        message: 'Internal error',
        paymentId: body.order_id || '',
      };
    }
  }

  @Post('success')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Page de retour pour paiement réussi' })
  @ApiResponse({ status: 200, description: 'Page de succès affichée' })
  async handleSuccessReturn(@Body() body: any) {
    try {
      this.logger.log('Payment success return', body);

      const payment = await this.paymentService.getPaymentByOrderId(
        body.order_id,
      );
      if (!payment) {
        return {
          success: false,
          data: null,
          message: 'Payment not found',
        };
      }

      return {
        success: true,
        data: {
          paymentId: payment.id,
          status: payment.status,
          amount: payment.amount,
          orderId: payment.orderId,
        },
        message: 'Payment completed successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to handle success return: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Mappe les statuts Cyberplus vers nos statuts internes
   */
  private mapCyberplusStatus(cyberplusStatus: string): PaymentStatus {
    switch (cyberplusStatus?.toLowerCase()) {
      case 'success':
      case 'completed':
      case 'authorized':
        return PaymentStatus.COMPLETED;
      case 'pending':
      case 'processing':
        return PaymentStatus.PENDING;
      case 'cancelled':
      case 'canceled':
        return PaymentStatus.CANCELLED;
      case 'failed':
      case 'error':
      case 'declined':
        return PaymentStatus.FAILED;
      case 'refunded':
        return PaymentStatus.REFUNDED;
      default:
        this.logger.warn(`Unknown Cyberplus status: ${cyberplusStatus}`);
        return PaymentStatus.PENDING;
    }
  }
}
