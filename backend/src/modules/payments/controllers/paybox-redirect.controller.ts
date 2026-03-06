import {
  Controller,
  Get,
  HttpStatus,
  Query,
  Res,
  Logger,
  Session,
} from '@nestjs/common';
import { Response } from 'express';
import { PayboxService } from '../services/paybox.service';
import { ConfigService } from '@nestjs/config';
import { PaymentDataService } from '../repositories/payment-data.service';
import { getErrorMessage } from '../../../common/utils/error.utils';

/**
 * Contrôleur pour la redirection vers la passerelle Paybox
 * Route: GET /api/paybox/redirect
 */
@Controller('api/paybox')
export class PayboxRedirectController {
  private readonly logger = new Logger(PayboxRedirectController.name);

  constructor(
    private readonly payboxService: PayboxService,
    private readonly configService: ConfigService,
    private readonly paymentDataService: PaymentDataService,
  ) {}

  @Get('redirect')
  async redirect(
    @Query('orderId') orderId: string,
    @Query('amount') amount: string,
    @Query('email') email: string,
    @Session() session: Record<string, any>,
    @Res() res: Response,
  ) {
    try {
      this.logger.log('🚀 Redirection vers Paybox...');
      this.logger.log(`📦 Commande: ${orderId}`);
      this.logger.log(`💰 Montant: ${amount} EUR`);
      this.logger.log(`📧 Email: ${email}`);

      // Validation des paramètres
      if (!orderId || !amount || !email) {
        this.logger.error('❌ Paramètres manquants');
        return res.status(HttpStatus.BAD_REQUEST).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Erreur</title>
            </head>
            <body>
              <h1>❌ Erreur</h1>
              <p>Paramètres manquants: orderId, amount, email sont requis.</p>
              <a href="/checkout-payment">← Retour au paiement</a>
            </body>
          </html>
        `);
      }

      // 🔐 SECURITY: Re-read amount from DB — never trust client-supplied amount
      const order = await this.paymentDataService.getOrderForPayment(orderId);
      if (!order) {
        this.logger.error(`❌ Order not found: ${orderId}`);
        return res.status(HttpStatus.BAD_REQUEST).send(`
          <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Erreur</title></head>
          <body><h1>Commande introuvable</h1><a href="/checkout-payment">Retour</a></body></html>
        `);
      }
      if (order.ord_is_pay === '1') {
        this.logger.warn(`⚠️ Order already paid: ${orderId}`);
        return res.status(HttpStatus.BAD_REQUEST).send(`
          <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Erreur</title></head>
          <body><h1>Commande deja payee</h1><a href="/account/orders">Mes commandes</a></body></html>
        `);
      }

      const dbAmount = parseFloat(order.ord_total_ttc || '0');
      if (dbAmount <= 0) {
        this.logger.error(
          `❌ Invalid order amount: ${dbAmount} for ${orderId}`,
        );
        return res.status(HttpStatus.BAD_REQUEST).send(`
          <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Erreur</title></head>
          <body><h1>Montant invalide</h1><a href="/checkout-payment">Retour</a></body></html>
        `);
      }

      this.logger.log(
        `✅ Order ${orderId} verified: DB amount=${dbAmount} EUR`,
      );

      const paymentParams = {
        amount: dbAmount, // Use DB amount, ignore client-supplied amount
        currency: 'EUR',
        orderId,
        customerEmail: email,
        returnUrl: '', // Non utilisé (comme l'ancien PHP)
        cancelUrl: '', // Non utilisé (comme l'ancien PHP)
        notifyUrl: '', // Non utilisé - gestion manuelle comme l'ancien PHP
        description: `Commande ${orderId}`,
      };

      // Générer le formulaire Paybox
      const formData = this.payboxService.generatePaymentForm(paymentParams);

      this.logger.log('✅ Formulaire Paybox généré');
      this.logger.log(`🔗 URL: ${formData.url}`);

      // Générer le HTML avec auto-submit (nonce CSP pour que le script inline soit autorisé)
      const nonce = (res as any).locals?.cspNonce || '';
      const html = this.buildHtmlForm(formData.url, formData.parameters, nonce);

      // Envoyer le HTML
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (error) {
      this.logger.error('❌ Erreur lors de la redirection Paybox:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Erreur</title>
          </head>
          <body>
            <h1>❌ Erreur serveur</h1>
            <p>Impossible de générer le formulaire de paiement.</p>
            <p>Erreur: ${getErrorMessage(error)}</p>
            <a href="/checkout-payment">← Retour au paiement</a>
          </body>
        </html>
      `);
    }
  }

  /**
   * Génère le HTML du formulaire avec auto-submit
   */
  private buildHtmlForm(
    url: string,
    parameters: Record<string, string>,
    nonce: string,
  ): string {
    const inputs = Object.entries(parameters)
      .map(
        ([name, value]) =>
          `<input type="hidden" name="${name}" value="${value}">`,
      )
      .join('\n        ');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirection vers Paybox</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            text-align: center;
            background: white;
            padding: 3rem;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 400px;
        }
        .spinner {
            width: 60px;
            height: 60px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1.5rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        h1 {
            color: #333;
            font-size: 1.5rem;
            margin: 0 0 1rem;
        }
        p {
            color: #666;
            font-size: 1rem;
            margin: 0;
        }
        .logo {
            font-size: 3rem;
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🔒</div>
        <h1>Redirection sécurisée</h1>
        <div class="spinner"></div>
        <p>Redirection vers la page de paiement Paybox...</p>
        <p style="margin-top: 1rem; font-size: 0.875rem; color: #999;">
            Si la redirection ne fonctionne pas, cliquez sur le bouton ci-dessous.
        </p>
    </div>

    <form id="payboxForm" method="POST" action="${url}">
        ${inputs}
        <button type="submit" id="fallbackBtn" style="display:none; margin-top: 2rem; padding: 1rem 2rem; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;">
            Continuer vers le paiement
        </button>
    </form>

    <script nonce="${nonce}">
        // Auto-submit après un court délai
        setTimeout(function() {
            document.getElementById('payboxForm').submit();
        }, 500);
        // Afficher le bouton fallback après 3s si l'auto-submit échoue
        setTimeout(function() {
            document.getElementById('fallbackBtn').style.display = 'block';
        }, 3000);
    </script>
</body>
</html>`;
  }
}
