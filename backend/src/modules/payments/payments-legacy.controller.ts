import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
  NotFoundException,
  BadRequestException,
  // HttpStatus - temporairement non utilisé
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  // ApiQuery - temporairement non utilisé
} from '@nestjs/swagger';
import {
  CreateLegacyPaymentDto,
  InitiateLegacyPaymentDto,
  LegacyPaymentResponseDto,
} from './dto/payment-request.dto';
import { PaymentCallbackDto } from './dto/payment-callback.dto';
import { PaymentService } from './services/payments-legacy.service';
import { UseGuards } from '@nestjs/common';
import { LocalAuthGuard } from '../../auth/local-auth.guard';
import { IsAdminGuard } from '../../auth/is-admin.guard';

@ApiTags('Paiements Legacy')
@Controller('api/payments')
export class PaymentsLegacyController {
  private readonly logger = new Logger(PaymentsLegacyController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @ApiOperation({ summary: 'Obtenir la liste des paiements avec pagination' })
  @ApiResponse({
    status: 200,
    description: 'Liste des paiements avec données client enrichies',
  })
  async getPayments(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<any> {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    return this.paymentService.getPaymentsWithCustomers({
      page: pageNum,
      limit: limitNum,
      status,
      from,
      to,
    });
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Obtenir les statistiques de paiement basées sur ___xtr_order',
  })
  @ApiResponse({ status: 200, description: 'Statistiques de paiement' })
  async getPaymentStats(): Promise<any> {
    return this.paymentService.getPaymentStats();
  }

  @Get('test-real-table')
  @ApiOperation({
    summary: "TEST: Vérifier l'accès à la vraie table de paiements ic_postback",
  })
  @ApiResponse({ status: 200, description: "Résultat du test d'accès" })
  async testRealPaymentsTable(): Promise<any> {
    return this.paymentService.testRealPaymentsTable();
  }

  @Post('admin/cache/invalidate')
  @ApiOperation({
    summary:
      "Admin: invalider le cache mémoire et Redis (paiements/commandes) d'un coup",
  })
  @ApiResponse({ status: 200, description: 'Caches invalidés' })
  @UseGuards(LocalAuthGuard, IsAdminGuard)
  async invalidateCaches(): Promise<any> {
    return this.paymentService.invalidateCaches();
  }

  // TODO: Réimplémenter les autres méthodes avec le nouveau service facade
  /*
  @Post()
  async createPayment(@Body() createPaymentDto: CreateLegacyPaymentDto) {
    throw new BadRequestException('Méthode temporairement désactivée');
  }

  @Post(':orderId/initiate')
  async initiatePayment(@Param('orderId') orderId: string, @Body() initiatePaymentDto: InitiateLegacyPaymentDto) {
    throw new BadRequestException('Méthode temporairement désactivée');
  }

  @Get(':orderId/status')
  async getPaymentStatus(@Param('orderId') orderId: string) {
    throw new BadRequestException('Méthode temporairement désactivée');
  }

  @Post('callback/:gateway')
  async handlePaymentCallback(@Param('gateway') gateway: string, @Body() callbackData: PaymentCallbackDto) {
    throw new BadRequestException('Méthode temporairement désactivée');
  }

  @Get(':orderId/callbacks')
  async getPaymentCallbacks(@Param('orderId') orderId: string) {
    throw new BadRequestException('Méthode temporairement désactivée');
  }

  @Get('transaction/:transactionId')
  async getPaymentByTransactionId(@Param('transactionId') transactionId: string) {
    throw new BadRequestException('Méthode temporairement désactivée');
  }
  */
}
