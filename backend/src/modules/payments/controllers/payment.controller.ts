import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentValidationService } from '../services/payment-validation.service';
import { PaymentMethod } from '../entities/payment.entity';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly validationService: PaymentValidationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un nouveau paiement' })
  @ApiResponse({ status: 201, description: 'Paiement créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    try {
      this.logger.log(`Creating payment for order ${createPaymentDto.orderId}`);

      const payment = await this.paymentService.createPayment(createPaymentDto);

      return {
        success: true,
        data: payment,
        message: 'Paiement créé avec succès',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create payment: ${errorMessage}`);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: "Obtenir les détails d'un paiement" })
  @ApiResponse({ status: 200, description: 'Détails du paiement' })
  @ApiResponse({ status: 404, description: 'Paiement non trouvé' })
  async getPayment(@Param('id') id: string) {
    try {
      this.logger.log(`Getting payment details for ID: ${id}`);
      // Utiliser getPaymentStatus qui existe dans le service
      const payment = await this.paymentService.getPaymentStatus(id);

      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get payment: ${errorMessage}`);
      throw error;
    }
  }

  @Get('methods/available')
  @ApiOperation({ summary: 'Obtenir les méthodes de paiement disponibles' })
  @ApiResponse({
    status: 200,
    description: 'Liste des méthodes de paiement disponibles',
  })
  async getAvailablePaymentMethods() {
    try {
      this.logger.log('Getting available payment methods');

      const methods = [
        {
          id: PaymentMethod.CREDIT_CARD,
          name: 'Carte de crédit',
          enabled: true,
        },
        {
          id: PaymentMethod.DEBIT_CARD,
          name: 'Carte de débit',
          enabled: true,
        },
        {
          id: PaymentMethod.PAYPAL,
          name: 'PayPal',
          enabled: true,
        },
        {
          id: PaymentMethod.CYBERPLUS,
          name: 'Cyberplus',
          enabled: true,
        },
        {
          id: PaymentMethod.BANK_TRANSFER,
          name: 'Virement bancaire',
          enabled: false,
        },
      ];

      return {
        success: true,
        data: methods,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get payment methods: ${errorMessage}`);
      throw error;
    }
  }
}
