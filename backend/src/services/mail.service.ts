/**
 * Service Mail pour les emails transactionnels (password)
 * Utilise Gmail OAuth2 via Nodemailer (meme config que EmailService)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;
  private appUrl: string;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN');
    const userEmail =
      this.configService.get<string>('GMAIL_USER_EMAIL') ||
      'contact@automecanik.com';
    this.appUrl =
      this.configService.get<string>('APP_URL') || 'https://automecanik.com';
    this.fromEmail = `AutoMecanik <${userEmail}>`;

    if (clientId && clientSecret && refreshToken) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: userEmail,
          clientId,
          clientSecret,
          refreshToken,
        },
      } as nodemailer.TransportOptions);
      this.isConfigured = true;
      this.logger.log('Mail transport configured (Gmail OAuth2)');
    } else {
      this.logger.warn(
        'Gmail credentials missing — emails will be logged only',
      );
    }
  }

  async sendMail(options: MailOptions): Promise<void> {
    const html = this.renderTemplate(options.template, options.context);

    if (!this.isConfigured || !this.transporter) {
      this.logger.warn(`[DRY-RUN] Email to ${options.to}: ${options.subject}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html,
      });
      this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      throw error;
    }
  }

  private renderTemplate(
    template: string,
    context: Record<string, any>,
  ): string {
    const firstName = context.firstName || 'Client';

    switch (template) {
      case 'password-changed':
        return this.wrapLayout(
          'Mot de passe modifie',
          '#6366f1',
          `<p>Bonjour ${firstName},</p>
          <p>Votre mot de passe a ete modifie avec succes le <strong>${context.timestamp}</strong>.</p>
          <p>Si vous n'etes pas a l'origine de cette modification, contactez-nous immediatement.</p>`,
        );

      case 'password-reset':
        return this.wrapLayout(
          'Reinitialisation du mot de passe',
          '#f59e0b',
          `<p>Bonjour ${firstName},</p>
          <p>Vous avez demande la reinitialisation de votre mot de passe.</p>
          <p>Cliquez sur le bouton ci-dessous pour definir un nouveau mot de passe :</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${this.appUrl}/reset-password?token=${context.resetToken}"
               style="background:#f59e0b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Reinitialiser mon mot de passe
            </a>
          </p>
          <p style="color:#6b7280;font-size:14px;">Ce lien expire le ${context.expiresAt}.</p>
          <p style="color:#6b7280;font-size:14px;">Si vous n'avez pas fait cette demande, ignorez cet email.</p>`,
        );

      case 'password-reset-confirmation':
        return this.wrapLayout(
          'Mot de passe reinitialise',
          '#10b981',
          `<p>Bonjour ${firstName},</p>
          <p>Votre mot de passe a ete reinitialise avec succes le <strong>${context.timestamp}</strong>.</p>
          <p>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${this.appUrl}/connexion"
               style="background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Se connecter
            </a>
          </p>`,
        );

      default:
        this.logger.warn(`Unknown email template: ${template}`);
        return `<p>${JSON.stringify(context)}</p>`;
    }
  }

  private wrapLayout(title: string, color: string, body: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:${color};padding:24px;border-radius:8px 8px 0 0;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">${title}</h1>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;">
      ${body}
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">
      AutoMecanik - Pieces auto au meilleur prix
    </p>
  </div>
</body></html>`;
  }
}
