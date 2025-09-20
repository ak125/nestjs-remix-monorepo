import { Injectable, Logger } from '@nestjs/common';

export interface EmailData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  context?: any;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  /**
   * Envoie un email
   */
  async sendEmail(emailData: EmailData): Promise<void> {
    try {
      // TODO: Implémenter l'envoi d'email
      // Utiliser un service comme SendGrid, Mailgun, ou SMTP
      this.logger.log(`Sending email to ${emailData.to}: ${emailData.subject}`);

      // Simulation pour le moment
      console.log('Email data:', emailData);
    } catch (error) {
      this.logger.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Envoie un email de confirmation de commande
   */
  async sendOrderConfirmation(
    customerEmail: string,
    orderData: any,
  ): Promise<void> {
    try {
      await this.sendEmail({
        to: customerEmail,
        subject: `Confirmation de commande #${orderData.orderNumber}`,
        template: 'order-confirmation',
        context: {
          order: orderData,
        },
      });
    } catch (error) {
      this.logger.error('Error sending order confirmation:', error);
      throw new Error('Failed to send order confirmation');
    }
  }

  /**
   * Envoie un email de mise à jour de statut
   */
  async sendOrderStatusUpdate(
    customerEmail: string,
    orderData: any,
    newStatus: string,
  ): Promise<void> {
    try {
      await this.sendEmail({
        to: customerEmail,
        subject: `Mise à jour de votre commande #${orderData.orderNumber}`,
        template: 'order-status-update',
        context: {
          order: orderData,
          status: newStatus,
        },
      });
    } catch (error) {
      this.logger.error('Error sending order status update:', error);
      throw new Error('Failed to send order status update');
    }
  }

  /**
   * Envoie un email de facture
   */
  async sendInvoice(customerEmail: string, invoiceData: any): Promise<void> {
    try {
      await this.sendEmail({
        to: customerEmail,
        subject: `Facture #${invoiceData.invoiceNumber}`,
        template: 'invoice',
        context: {
          invoice: invoiceData,
        },
      });
    } catch (error) {
      this.logger.error('Error sending invoice:', error);
      throw new Error('Failed to send invoice');
    }
  }
}
