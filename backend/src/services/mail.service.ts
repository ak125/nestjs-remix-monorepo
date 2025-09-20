/**
 * 📧 Service Mail Minimal
 * ✅ Implémentation temporaire pour les besoins du PasswordModernService
 * TODO: Remplacer par un vrai service mail (Nodemailer, SendGrid, etc.)
 */

import { Injectable, Logger } from '@nestjs/common';

export interface MailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendMail(options: MailOptions): Promise<void> {
    try {
      this.logger.log(`📧 Email envoyé à ${options.to}`);
      this.logger.log(`   Sujet: ${options.subject}`);
      this.logger.log(`   Template: ${options.template}`);
      this.logger.log(
        `   Context: ${JSON.stringify(options.context, null, 2)}`,
      );

      // TODO: Implémenter un vrai service mail
      // Pour l'instant, on simule l'envoi
      console.log('🚀 EMAIL SIMULÉ:', {
        to: options.to,
        subject: options.subject,
        template: options.template,
        context: options.context,
      });
    } catch (error) {
      this.logger.error('❌ Erreur envoi email:', error);
      throw error;
    }
  }
}
