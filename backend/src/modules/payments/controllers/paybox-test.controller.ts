import { Controller, Get, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Page de test Paybox convertie depuis l'exemple PHP.
 * Route: GET /api/paybox/test
 *
 * Elle génère un formulaire HTML (pré-production par défaut si PAYBOX_MODE=TEST)
 * et calcule PBX_HMAC en HMAC-SHA512 avec conversion hex->binary.
 */
@Controller('api/paybox')
export class PayboxTestController {
  private readonly logger = new Logger(PayboxTestController.name);

  constructor(private readonly config: ConfigService) {}

  @Get('test')
  async test(@Res() res: Response) {
    // Charger configuration (fallbacks = identifiants de test officiels Paybox)
    const mode = this.config.get<string>('PAYBOX_MODE', 'TEST');
    const site = this.config.get<string>('PAYBOX_SITE', '1999888');
    const rang = this.config.get<string>('PAYBOX_RANG', '32');
    const ident = this.config.get<string>('PAYBOX_IDENTIFIANT', '107904482'); // ✅ Identifiant de test officiel
    const hmacKey = this.config.get<string>('PAYBOX_HMAC_KEY', '');
    const baseUrl = this.config.get<string>(
      'BASE_URL',
      'http://localhost:5173',
    );

    // Server selection according to mode
    const action =
      mode === 'PRODUCTION'
        ? this.config.get<string>('PAYBOX_PAYMENT_URL') ||
          'https://tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi'
        : this.config.get<string>('PAYBOX_PAYMENT_URL') ||
          'https://preprod-tpeweb.paybox.com/cgi/MYchoix_pagepaiement.cgi';

    // Example data (like the PHP example)
    const amount = 999; // centimes (9.99 EUR)
    const currency = 978; // EUR
    const orderRef = 'TEST Paybox';
    const email = 'test@paybox.com';
    const retour = 'Mt:M;Ref:R;Auto:A;Erreur:E';
    const hashAlgo = 'SHA512';
    const time = new Date().toISOString();

    // Build params in the exact order required for signature
    const params: Record<string, string> = {
      PBX_SITE: site,
      PBX_RANG: rang,
      PBX_IDENTIFIANT: ident,
      PBX_TOTAL: String(amount),
      PBX_DEVISE: String(currency),
      PBX_CMD: orderRef,
      PBX_PORTEUR: email,
      PBX_RETOUR: retour,
      PBX_HASH: hashAlgo,
      PBX_TIME: time,
    };

    // Construct the string to sign: join with '&' in this order
    const signString = Object.keys(params)
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    // Convert HMAC key from hex to binary (pack("H*", $key) in PHP)
    let hmac = '';
    try {
      if (!hmacKey) throw new Error('PAYBOX_HMAC_KEY not configured');
      const binaryKey = Buffer.from(hmacKey, 'hex');
      hmac = crypto
        .createHmac('sha512', binaryKey)
        .update(signString, 'utf8')
        .digest('hex')
        .toUpperCase();
    } catch (e) {
      this.logger.error('Erreur génération HMAC:', e?.message || e);
      return res
        .status(500)
        .send(`Erreur serveur génération HMAC: ${e?.message || e}`);
    }

    // Build HTML form
    const inputs = Object.entries(params)
      .map(
        ([k, v]) =>
          `    <input type="hidden" name="${k}" value="${this.escape(v)}">`,
      )
      .join('\n');

    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Test Paybox - Exemple converti PHP→TS</title>
  <style>body{font-family:Inter,system-ui,Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f7fafc} .card{background:#fff;padding:24px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.08);max-width:720px;width:100%}</style>
</head>
<body>
  <div class="card">
    <h2>Paybox Test (mode: ${this.escape(mode)})</h2>
    <p>Montant (centimes): <strong>${this.escape(String(amount))}</strong> - Commande: <strong>${this.escape(orderRef)}</strong></p>
    <form id="paybox-form" method="POST" action="${this.escape(action)}">
${inputs}
    <input type="hidden" name="PBX_HMAC" value="${hmac}">
    <noscript>
      <button type="submit">Payer</button>
    </noscript>
    </form>
    <p style="margin-top:12px;color:#666;font-size:13px">Le formulaire sera soumis automatiquement vers <code>${this.escape(action)}</code></p>
    <script>setTimeout(()=>document.getElementById('paybox-form').submit(),700);</script>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  private escape(s: string) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
