import {
  Controller,
  Get,
  HttpStatus,
  Query,
  Res,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { CyberplusService } from '../services/cyberplus.service';

@Controller('api/systempay')
export class SystemPayRedirectController {
  private readonly logger = new Logger(SystemPayRedirectController.name);

  constructor(
    private readonly cyberplusService: CyberplusService,
    private readonly configService: ConfigService,
  ) {}

  @Get('redirect')
  async redirect(
    @Query('orderId') orderId: string,
    @Query('amount') amount: string,
    @Query('email') email: string,
    @Res() res: Response,
  ) {
    this.logger.log(`🔵 SystemPay redirect request for order: ${orderId}`);

    if (!orderId || !amount || !email) {
      return res.status(HttpStatus.BAD_REQUEST).send('Missing parameters');
    }

    const amountNum = parseFloat(amount);
    const baseUrl =
      this.configService.get<string>('BASE_URL') || 'http://localhost:3000';

    // Générer le formulaire SystemPay
    const redirectData = this.cyberplusService.generatePaymentForm({
      amount: amountNum,
      currency: 'EUR',
      orderId,
      customerEmail: email,
      returnUrl: `${baseUrl}/checkout-payment-return`,
      cancelUrl: `${baseUrl}/checkout-payment`,
      notifyUrl: `${baseUrl}/api/payments/callback/cyberplus`,
      description: `Commande ${orderId}`,
    });

    this.logger.log(`✅ Serving SystemPay HTML for order: ${orderId}`);

    // Retourner le HTML directement
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(redirectData.html);
  }
}
