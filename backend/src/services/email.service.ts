import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/**
 * EMAIL SERVICE - Notifications via Gmail OAuth2 (Nodemailer)
 *
 * Transport : Nodemailer + Gmail OAuth2 (auto-refresh token)
 * From : contact@automecanik.com
 *
 * Configuration .env :
 * - GMAIL_CLIENT_ID (obligatoire)
 * - GMAIL_CLIENT_SECRET (obligatoire)
 * - GMAIL_REFRESH_TOKEN (obligatoire)
 * - GMAIL_USER_EMAIL (ex: contact@automecanik.com)
 * - APP_URL (pour liens dans emails)
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly appUrl: string;
  private readonly isConfigured: boolean;

  constructor() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    const userEmail = process.env.GMAIL_USER_EMAIL || 'contact@automecanik.com';

    this.isConfigured = !!(clientId && clientSecret && refreshToken);

    if (!this.isConfigured) {
      this.logger.warn(
        'GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN non configures - Les emails ne seront PAS envoyes.',
      );
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: userEmail,
        clientId: clientId || '',
        clientSecret: clientSecret || '',
        refreshToken: refreshToken || '',
      },
    } as nodemailer.TransportOptions);

    this.fromEmail = `AutoMecanik <${userEmail}>`;
    this.appUrl = process.env.APP_URL || 'http://localhost:5173';

    this.logger.log(
      this.isConfigured
        ? `Email service (Gmail OAuth2) initialized for ${userEmail}`
        : 'Email service initialized WITHOUT Gmail credentials (emails disabled)',
    );
  }

  /**
   * Vérifier si le service email est configuré
   * @private
   */
  private checkConfigured(methodName: string): boolean {
    if (!this.isConfigured) {
      this.logger.warn(
        `${methodName}: Email non envoye (credentials Gmail manquants)`,
      );
      return false;
    }
    return true;
  }

  /**
   * 📧 Email confirmation commande (après paiement validé)
   */
  async sendOrderConfirmation(order: any, customer: any): Promise<void> {
    if (!this.checkConfigured('sendOrderConfirmation')) return;

    try {
      const html = this.getOrderConfirmationTemplate(order, customer);

      await this.transporter.sendMail({
        from: this.fromEmail,
        to: customer.cst_mail,
        subject: `Commande ${order.ord_id} confirmee - AutoMecanik`,
        html,
      });

      this.logger.log(`✅ Email confirmation envoyé à ${customer.cst_mail}`);
    } catch (error: any) {
      this.logger.error(`❌ Erreur envoi email: ${error.message}`);
    }
  }

  /**
   * 📦 Email notification d'expédition
   */
  async sendShippingNotification(
    order: any,
    customer: any,
    trackingNumber: string,
  ): Promise<void> {
    if (!this.checkConfigured('sendShippingNotification')) return;

    try {
      const html = this.getShippingTemplate(order, customer, trackingNumber);

      await this.transporter.sendMail({
        from: this.fromEmail,
        to: customer.cst_mail,
        subject: `Commande ${order.ord_id} expediee - AutoMecanik`,
        html,
      });

      this.logger.log(`📦 Email expédition envoyé à ${customer.cst_mail}`);
    } catch (error: any) {
      this.logger.error(`❌ Erreur envoi email: ${error.message}`);
    }
  }

  /**
   * 💳 Email rappel de paiement
   */
  async sendPaymentReminder(order: any, customer: any): Promise<void> {
    if (!this.checkConfigured('sendPaymentReminder')) return;

    try {
      const html = this.getPaymentReminderTemplate(order, customer);

      await this.transporter.sendMail({
        from: this.fromEmail,
        to: customer.cst_mail,
        subject: `Rappel : Paiement en attente pour commande ${order.ord_id}`,
        html,
      });

      this.logger.log(`💳 Email rappel envoyé à ${customer.cst_mail}`);
    } catch (error: any) {
      this.logger.error(`❌ Erreur envoi email: ${error.message}`);
    }
  }

  /**
   * ❌ Email annulation commande
   */
  async sendCancellationEmail(
    order: any,
    customer: any,
    reason: string,
  ): Promise<void> {
    if (!this.checkConfigured('sendCancellationEmail')) return;

    try {
      const html = this.getCancellationTemplate(order, customer, reason);

      await this.transporter.sendMail({
        from: this.fromEmail,
        to: customer.cst_mail,
        subject: `Commande ${order.ord_id} annulee - AutoMecanik`,
        html,
      });

      this.logger.log(`❌ Email annulation envoyé à ${customer.cst_mail}`);
    } catch (error: any) {
      this.logger.error(`❌ Erreur envoi email: ${error.message}`);
    }
  }

  /**
   * 🔑 Email activation compte guest (après guest checkout)
   */
  async sendGuestAccountActivation(
    email: string,
    resetToken: string,
    orderId?: string,
  ): Promise<void> {
    if (!this.checkConfigured('sendGuestAccountActivation')) return;

    try {
      const html = this.getGuestActivationTemplate(email, resetToken, orderId);

      await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: `Activez votre compte AutoMecanik`,
        html,
      });

      this.logger.log(`🔑 Email activation envoyé à ${email}`);
    } catch (error: any) {
      this.logger.error(`❌ Erreur envoi email activation: ${error.message}`);
    }
  }

  /**
   * Test connexion Gmail OAuth2
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        this.logger.error('Credentials Gmail non configures');
        return false;
      }

      await this.transporter.verify();
      this.logger.log('Connexion Gmail OAuth2 OK');
      return true;
    } catch (error: any) {
      this.logger.error(`Test connexion echoue: ${error.message}`);
      return false;
    }
  }

  // ============================================================
  // TEMPLATES HTML
  // ============================================================

  private getOrderConfirmationTemplate(order: any, customer: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6; 
      color: #1f2937; 
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .container { 
      max-width: 600px; 
      margin: 40px auto; 
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: white; 
      padding: 32px 24px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content { 
      padding: 32px 24px; 
    }
    .order-box { 
      background: #f9fafb; 
      padding: 20px; 
      margin: 24px 0; 
      border-radius: 8px;
      border-left: 4px solid #6366f1;
    }
    .order-box h2 {
      margin: 0 0 16px 0;
      font-size: 18px;
      color: #4f46e5;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #6b7280;
    }
    .button { 
      display: inline-block;
      background: #4f46e5; 
      color: white !important; 
      padding: 14px 28px; 
      text-decoration: none; 
      border-radius: 8px;
      font-weight: 600;
      margin-top: 24px;
      transition: background 0.2s;
    }
    .button:hover {
      background: #4338ca;
    }
    .footer { 
      text-align: center; 
      padding: 24px; 
      background: #f9fafb;
      color: #6b7280; 
      font-size: 13px; 
    }
    .emoji {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">✅</div>
      <h1>Commande Confirmée</h1>
    </div>
    
    <div class="content">
      <p>Bonjour <strong>${customer.cst_fname} ${customer.cst_name}</strong>,</p>
      <p>Votre commande a été validée avec succès et est maintenant en cours de préparation. 🎉</p>
      
      <div class="order-box">
        <h2>📦 Détails de votre commande</h2>
        <div class="detail-row">
          <span class="detail-label">Numéro de commande</span>
          <strong>#${order.ord_id}</strong>
        </div>
        <div class="detail-row">
          <span class="detail-label">Montant total</span>
          <strong>${parseFloat(order.ord_total_ttc || 0).toFixed(2)} €</strong>
        </div>
        <div class="detail-row">
          <span class="detail-label">Date</span>
          <span>${new Date(order.ord_date).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Statut</span>
          <span style="color: #10b981; font-weight: 600;">✓ En préparation</span>
        </div>
      </div>

      <p>📧 Vous recevrez un email avec le numéro de suivi dès que votre colis sera expédié.</p>
      
      <div style="text-align: center;">
        <a href="${this.appUrl}/client/orders/${order.ord_id}" class="button">
          Voir ma commande
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
      <p style="margin-top: 8px;">© ${new Date().getFullYear()} AutoParts - Tous droits réservés</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private getShippingTemplate(
    order: any,
    customer: any,
    trackingNumber: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6; 
      color: #1f2937; 
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .container { 
      max-width: 600px; 
      margin: 40px auto; 
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white; 
      padding: 32px 24px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content { padding: 32px 24px; }
    .tracking-box { 
      background: #f0fdf4; 
      padding: 24px; 
      margin: 24px 0; 
      border-radius: 8px;
      border: 2px solid #10b981;
      text-align: center;
    }
    .tracking-number {
      font-size: 24px;
      font-weight: 700;
      color: #059669;
      letter-spacing: 2px;
      margin: 12px 0;
    }
    .button { 
      display: inline-block;
      background: #10b981; 
      color: white !important; 
      padding: 14px 28px; 
      text-decoration: none; 
      border-radius: 8px;
      font-weight: 600;
      margin-top: 16px;
    }
    .footer { 
      text-align: center; 
      padding: 24px; 
      background: #f9fafb;
      color: #6b7280; 
      font-size: 13px; 
    }
    .emoji {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">📦</div>
      <h1>Colis Expédié</h1>
    </div>
    
    <div class="content">
      <p>Bonjour <strong>${customer.cst_fname} ${customer.cst_name}</strong>,</p>
      <p>Bonne nouvelle ! Votre commande <strong>#${order.ord_id}</strong> a été expédiée. 🚚</p>
      
      <div class="tracking-box">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #059669;">Numéro de suivi</p>
        <div class="tracking-number">${trackingNumber}</div>
        <a href="https://www.laposte.fr/outils/suivre-vos-envois?code=${trackingNumber}" class="button">
          Suivre mon colis
        </a>
      </div>

      <p>💡 <strong>Délai de livraison estimé :</strong> 2 à 5 jours ouvrés</p>
      <p>📱 Vous pouvez suivre votre colis en temps réel avec le numéro ci-dessus.</p>
    </div>
    
    <div class="footer">
      <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
      <p style="margin-top: 8px;">© ${new Date().getFullYear()} AutoParts - Tous droits réservés</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private getPaymentReminderTemplate(order: any, customer: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6; 
      color: #1f2937; 
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .container { 
      max-width: 600px; 
      margin: 40px auto; 
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white; 
      padding: 32px 24px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content { padding: 32px 24px; }
    .warning-box { 
      background: #fffbeb; 
      padding: 20px; 
      margin: 24px 0; 
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
    }
    .button { 
      display: inline-block;
      background: #f59e0b; 
      color: white !important; 
      padding: 14px 28px; 
      text-decoration: none; 
      border-radius: 8px;
      font-weight: 600;
      margin-top: 16px;
    }
    .footer { 
      text-align: center; 
      padding: 24px; 
      background: #f9fafb;
      color: #6b7280; 
      font-size: 13px; 
    }
    .emoji {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">💳</div>
      <h1>Paiement en Attente</h1>
    </div>
    
    <div class="content">
      <p>Bonjour <strong>${customer.cst_fname} ${customer.cst_name}</strong>,</p>
      <p>Nous n'avons pas encore reçu le paiement pour votre commande <strong>#${order.ord_id}</strong>.</p>
      
      <div class="warning-box">
        <p style="margin: 0; font-weight: 600; color: #d97706;">⏰ Montant à régler</p>
        <p style="font-size: 32px; font-weight: 700; color: #d97706; margin: 12px 0;">
          ${parseFloat(order.ord_total_ttc || 0).toFixed(2)} €
        </p>
      </div>

      <p>Pour finaliser votre commande et lancer la préparation, veuillez procéder au paiement.</p>
      
      <div style="text-align: center;">
        <a href="${this.appUrl}/client/orders/${order.ord_id}/payment" class="button">
          Payer maintenant
        </a>
      </div>

      <p style="margin-top: 32px; color: #6b7280; font-size: 14px;">
        ℹ️ Si vous avez déjà effectué le paiement, veuillez ignorer cet email.
      </p>
    </div>
    
    <div class="footer">
      <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
      <p style="margin-top: 8px;">© ${new Date().getFullYear()} AutoParts - Tous droits réservés</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private getCancellationTemplate(
    order: any,
    customer: any,
    reason: string,
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6; 
      color: #1f2937; 
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .container { 
      max-width: 600px; 
      margin: 40px auto; 
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .header { 
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white; 
      padding: 32px 24px; 
      text-align: center; 
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content { padding: 32px 24px; }
    .info-box { 
      background: #fef2f2; 
      padding: 20px; 
      margin: 24px 0; 
      border-radius: 8px;
      border-left: 4px solid #ef4444;
    }
    .button { 
      display: inline-block;
      background: #6366f1; 
      color: white !important; 
      padding: 14px 28px; 
      text-decoration: none; 
      border-radius: 8px;
      font-weight: 600;
      margin-top: 16px;
    }
    .footer { 
      text-align: center; 
      padding: 24px; 
      background: #f9fafb;
      color: #6b7280; 
      font-size: 13px; 
    }
    .emoji {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">❌</div>
      <h1>Commande Annulée</h1>
    </div>
    
    <div class="content">
      <p>Bonjour <strong>${customer.cst_fname} ${customer.cst_name}</strong>,</p>
      <p>Nous vous informons que votre commande <strong>#${order.ord_id}</strong> a été annulée.</p>
      
      <div class="info-box">
        <p style="margin: 0 0 12px 0; font-weight: 600; color: #dc2626;">📋 Raison de l'annulation</p>
        <p style="margin: 0; color: #991b1b;">${reason}</p>
      </div>

      <p>💰 Si vous avez déjà effectué le paiement, vous serez remboursé sous 5 à 7 jours ouvrés.</p>
      <p>📧 Pour toute question, n'hésitez pas à nous contacter.</p>
      
      <div style="text-align: center;">
        <a href="${this.appUrl}/client/orders" class="button">
          Voir mes commandes
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
      <p style="margin-top: 8px;">© ${new Date().getFullYear()} AutoParts - Tous droits réservés</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  private getGuestActivationTemplate(
    email: string,
    resetToken: string,
    orderId?: string,
  ): string {
    const setPasswordUrl = `${this.appUrl}/client/set-password?token=${resetToken}`;
    const orderInfo = orderId
      ? `<p>Votre commande <strong>#${orderId}</strong> est en cours de traitement.</p>`
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .header {
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      color: white;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content { padding: 32px 24px; }
    .activation-box {
      background: #f5f3ff;
      padding: 24px;
      margin: 24px 0;
      border-radius: 8px;
      border: 2px solid #8b5cf6;
      text-align: center;
    }
    .button {
      display: inline-block;
      background: #7c3aed;
      color: white !important;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin-top: 16px;
    }
    .footer {
      text-align: center;
      padding: 24px;
      background: #f9fafb;
      color: #6b7280;
      font-size: 13px;
    }
    .emoji {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">🔑</div>
      <h1>Bienvenue !</h1>
    </div>

    <div class="content">
      <p>Bonjour,</p>
      <p>Un compte a été créé pour vous sur <strong>AutoMecanik</strong> avec l'adresse <strong>${email}</strong>.</p>
      ${orderInfo}

      <div class="activation-box">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #7c3aed;">Définissez votre mot de passe</p>
        <p style="margin: 0 0 16px 0; color: #6b7280;">Pour accéder à votre espace client et suivre vos commandes</p>
        <a href="${setPasswordUrl}" class="button">
          Créer mon mot de passe
        </a>
      </div>

      <p>Ce lien est valable <strong>7 jours</strong>.</p>
      <p>Si vous n'êtes pas à l'origine de cette action, vous pouvez ignorer cet email.</p>
    </div>

    <div class="footer">
      <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
      <p style="margin-top: 8px;">&copy; ${new Date().getFullYear()} AutoMecanik - Tous droits réservés</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}
