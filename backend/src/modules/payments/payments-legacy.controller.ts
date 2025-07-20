import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpStatus,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateLegacyPaymentDto, InitiateLegacyPaymentDto, LegacyPaymentResponseDto } from './dto/payment-request.dto';
import { PaymentCallbackDto } from './dto/payment-callback.dto';
import { PaymentService } from './services/payments-legacy.service';

@ApiTags('Paiements Legacy')
@Controller('api/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouveau paiement dans ___xtr_order' })
  @ApiBody({ type: CreateLegacyPaymentDto })
  @ApiResponse({ status: 201, description: 'Paiement créé avec succès', type: LegacyPaymentResponseDto })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async createPayment(@Body() createPaymentDto: CreateLegacyPaymentDto): Promise<LegacyPaymentResponseDto> {
    const payment = await this.paymentService.createPayment(createPaymentDto);
    return LegacyPaymentResponseDto.fromSupabaseOrder(payment);
  }

  @Post(':orderId/initiate')
  @ApiOperation({ summary: 'Initier un paiement pour une commande existante' })
  @ApiParam({ name: 'orderId', description: 'ID de la commande (___xtr_order.ord_id)' })
  @ApiBody({ type: InitiateLegacyPaymentDto })
  @ApiResponse({ status: 201, description: 'Paiement initié avec succès', type: LegacyPaymentResponseDto })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async initiatePayment(
    @Param('orderId') orderId: string,
    @Body() initiatePaymentDto: InitiateLegacyPaymentDto
  ): Promise<LegacyPaymentResponseDto> {
    return this.paymentService.initiatePayment(orderId, initiatePaymentDto);
  }

  @Get(':orderId/status')
  @ApiOperation({ summary: 'Obtenir le statut d\'un paiement/commande' })
  @ApiParam({ name: 'orderId', description: 'ID de la commande (___xtr_order.ord_id)' })
  @ApiResponse({ status: 200, description: 'Statut du paiement', type: LegacyPaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Commande non trouvée' })
  async getPaymentStatus(@Param('orderId') orderId: string): Promise<LegacyPaymentResponseDto> {
    const payment = await this.paymentService.getPaymentStatus(orderId);
    if (!payment) {
      throw new NotFoundException(`Commande non trouvée: ${orderId}`);
    }
    return payment;
  }

  @Post('callback/:gateway')
  @ApiOperation({ summary: 'Recevoir un callback de paiement depuis une gateway' })
  @ApiParam({ name: 'gateway', description: 'Nom de la gateway (stripe, paypal, cyberplus)' })
  @ApiBody({ type: PaymentCallbackDto })
  @ApiResponse({ status: 200, description: 'Callback traité avec succès' })
  @ApiResponse({ status: 400, description: 'Callback invalide' })
  async handlePaymentCallback(
    @Param('gateway') gateway: string,
    @Body() callbackData: PaymentCallbackDto
  ): Promise<{ status: string; message: string }> {
    try {
      await this.paymentService.handlePaymentCallback(gateway, callbackData);
      return {
        status: 'success',
        message: `Callback ${gateway} traité avec succès`
      };
    } catch (error) {
      this.logger.error(`Erreur callback ${gateway}:`, error);
      throw new BadRequestException('Erreur lors du traitement du callback');
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtenir les statistiques de paiement basées sur ___xtr_order' })
  @ApiResponse({ status: 200, description: 'Statistiques de paiement' })
  async getPaymentStats(): Promise<any> {
    return this.paymentService.getPaymentStats();
  }

  @Get(':orderId/callbacks')
  @ApiOperation({ summary: 'Obtenir l\'historique des callbacks pour une commande' })
  @ApiParam({ name: 'orderId', description: 'ID de la commande (___xtr_order.ord_id)' })
  @ApiResponse({ status: 200, description: 'Liste des callbacks depuis ic_postback' })
  async getPaymentCallbacks(@Param('orderId') orderId: string): Promise<any[]> {
    return this.paymentService.getPaymentCallbacks(orderId);
  }

  @Get('transaction/:transactionId')
  @ApiOperation({ summary: 'Rechercher un paiement par ID de transaction' })
  @ApiParam({ name: 'transactionId', description: 'ID de transaction stocké dans ord_info' })
  @ApiResponse({ status: 200, description: 'Paiement trouvé', type: LegacyPaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction non trouvée' })
  async getPaymentByTransactionId(@Param('transactionId') transactionId: string): Promise<LegacyPaymentResponseDto> {
    const order = await this.paymentService.getPaymentByTransactionId(transactionId);
    if (!order) {
      throw new NotFoundException(`Transaction non trouvée: ${transactionId}`);
    }
    return LegacyPaymentResponseDto.fromSupabaseOrder(order);
  }
}
