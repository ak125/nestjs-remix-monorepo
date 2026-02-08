/**
 * 📧 PROCESSOR EMAIL
 * Envoi asynchrone d'emails
 */

import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  /**
   * Envoyer email
   */
  @Process('send')
  async handleSendEmail(job: Job<EmailJobData>) {
    this.logger.log(`📧 Sending email (Job #${job.id}): ${job.data.subject}`);

    try {
      const { to, subject } = job.data;

      // TODO: Implémenter envoi email (Resend, SendGrid, etc.)
      // const { template, data } = job.data; // Pour utilisation future
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
