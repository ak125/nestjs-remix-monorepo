import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { PaymentValidationService } from '../services/payment-validation.service';
import { PaymentDataService } from '../repositories/payment-data.service';
import { logPaymentError } from './payment-controller.utils';

/**
 * Routes admin : stats, liste, mise a jour statut, remboursements
 */
@ApiTags('payments')
@Controller('api/payments')
export class PaymentAdminController {
  private readonly logger = new Logger(PaymentAdminController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly validationService: PaymentValidationService,
    private readonly paymentDataService: PaymentDataService,
  ) {}

  /**
   * GET /api/payments/stats
   * Statistiques des paiements
   */
  @Get('stats')
  // @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Statistiques des paiements (admin)' })
  @ApiResponse({ status: 200, description: 'Statistiques' })
  async getPaymentStats(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      this.logger.log('Admin: Getting payment statistics');

      const filters: any = {};
      if (status) filters.status = status;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const stats = await this.paymentDataService.getPaymentStats(filters);

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      logPaymentError(this.logger, 'get stats', error);
      throw error;
    }
  }

  /**
   * GET /api/payments/stats/global
   */
  @Get('stats/global')
  async getGlobalStats(
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.getPaymentStats(status, startDate, endDate);
  }

  /**
   * GET /api/payments
   * Liste tous les paiements (admin)
   */
  @Get()
  // @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Liste tous les paiements (admin)' })
  @ApiResponse({ status: 200, description: 'Liste des paiements' })
  @ApiResponse({ status: 403, description: 'Acces refuse' })
  async listAllPayments() {
    try {
      this.logger.log('Admin: Listing all payments');

      // TODO: Implementer findAllPayments dans PaymentDataService
      return {
        success: true,
        data: [],
        message: 'Method to be implemented: findAllPayments',
      };
    } catch (error) {
      logPaymentError(this.logger, 'list payments', error);
      throw error;
    }
  }

  /**
   * PATCH /api/payments/:id/status
   * Mettre a jour le statut d'un paiement
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthenticatedGuard, AdminGuard)
  @ApiOperation({ summary: 'Mettre a jour le statut du paiement' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Statut mis a jour' })
  @ApiResponse({ status: 404, description: 'Paiement introuvable' })
  async updatePaymentStatus(
    @Param('id') id: string,
    @Body() updateDto: { status: string; providerTransactionId?: string },
  ) {
    try {
      this.logger.log(`Updating payment status: ${id} -> ${updateDto.status}`);

      const payment = await this.paymentService.updatePaymentStatus(
        id,
        updateDto.status as any,
      );

      this.logger.log(`Payment status updated: ${id}`);

      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      logPaymentError(this.logger, 'update payment status', error);
      throw error;
    }
  }

  /**
   * POST /api/payments/:id/refund
   * Rembourser un paiement (total ou partiel)
   */
  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  // @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @ApiOperation({ summary: 'Rembourser un paiement (admin)' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Remboursement effectue' })
  @ApiResponse({ status: 400, description: 'Remboursement impossible' })
  async refundPayment(
    @Param('id') id: string,
    @Body() body: { amount?: number; reason?: string },
  ) {
    try {
      this.logger.log(`Admin: Processing refund for payment ${id}`);

      if (body.amount) {
        await this.validationService.validateRefund(id, body.amount);
      }

      const refundedPayment = await this.paymentService.processRefund(
        id,
        body.amount,
      );

      this.logger.log(`Refund processed for payment: ${id}`);

      return {
        success: true,
        data: refundedPayment,
        message: 'Remboursement effectue avec succes',
      };
    } catch (error) {
      logPaymentError(this.logger, 'refund payment', error);
      throw error;
    }
  }
}
