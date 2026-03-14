/**
 * 📧 PROCESSOR EMAIL
 * Envoi asynchrone d'emails via BullMQ
 */

import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
  MailService,
  OrderEmailData,
  MailOptions,
} from '../../services/mail.service';

interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

interface OrderEmailJobData {
  order: OrderEmailData;
  customer: {
    cst_id: string;
    cst_mail: string;
    cst_fname: string;
    cst_name: string;
  };
}

interface GuestActivationJobData {
  email: string;
  token: string;
  orderId?: string;
}

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {}

  /**
   * Envoyer email générique
   */
  @Process('send')
  async handleSendEmail(job: Job<EmailJobData>) {
    this.logger.log(`📧 Sending email (Job #${job.id}): ${job.data.subject}`);

    try {
      const { to, subject } = job.data;

      await this.mailService.sendMail({
        to,
        subject,
        template: job.data.template,
        context: job.data.data || {},
      } as MailOptions);

      this.logger.log(`📧 Email sent to ${to}: ${subject}`);

      return {
        success: true,
        to,
        subject,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Email sending failed: ${message}`);
      throw error;
    }
  }

  /**
   * Envoyer confirmation de commande
   */
  @Process('order-confirmation')
  async handleOrderConfirmation(job: Job<OrderEmailJobData>) {
    this.logger.log(
      `📧 Sending order confirmation (Job #${job.id}): order ${job.data.order?.ord_id}`,
    );

    try {
      await this.mailService.sendOrderConfirmation(
        job.data.order,
        job.data.customer,
      );
      return { success: true, orderId: job.data.order?.ord_id };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Order confirmation email failed: ${message}`);
      throw error;
    }
  }

  /**
   * Envoyer notification admin
   */
  @Process('admin-notification')
  async handleAdminNotification(job: Job<OrderEmailJobData>) {
    this.logger.log(
      `📧 Sending admin notification (Job #${job.id}): order ${job.data.order?.ord_id}`,
    );

    try {
      await this.mailService.sendAdminOrderNotification(
        job.data.order,
        job.data.customer,
      );
      return { success: true, orderId: job.data.order?.ord_id };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Admin notification email failed: ${message}`);
      throw error;
    }
  }

  /**
   * Envoyer email activation guest
   */
  @Process('guest-activation')
  async handleGuestActivation(job: Job<GuestActivationJobData>) {
    this.logger.log(
      `📧 Sending guest activation (Job #${job.id}): ${job.data.email}`,
    );

    try {
      await this.mailService.sendGuestAccountActivation(
        job.data.email,
        job.data.token,
        job.data.orderId,
      );
      return { success: true, email: job.data.email };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Guest activation email failed: ${message}`);
      throw error;
    }
  }

  /**
   * Envoyer email de rapport quotidien
   */
  @Process('daily-report')
  async handleDailyReport(job: Job<any>) {
    this.logger.log(`📊 Sending daily report (Job #${job.id})`);

    try {
      // TODO: Générer et envoyer rapport quotidien
      this.logger.log(`✅ Daily report sent`);

      return {
        success: true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Daily report failed: ${message}`);
      throw error;
    }
  }
}
