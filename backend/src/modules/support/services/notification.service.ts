import { Injectable, Logger } from '@nestjs/common';
import { SupportConfigService } from './support-config.service';
import {
  getErrorMessage,
  getErrorStack,
} from '../../../common/utils/error.utils';

export interface NotificationPayload {
  type: 'contact' | 'review' | 'quote' | 'claim' | 'faq' | 'system';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  title: string;
  message: string;
  userId?: string;
  staffId?: string;
  metadata?: Record<string, any>;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  url: string;
  style: 'primary' | 'secondary' | 'danger';
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  private templates: Map<string, NotificationTemplate> = new Map();

  constructor(private supportConfig: SupportConfigService) {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    const templates: NotificationTemplate[] = [
      {
        id: 'contact_received',
        name: 'Contact Form Received',
        subject: 'Nouveau message de contact reçu',
        body: 'Un nouveau message de contact a été reçu de {{customerName}} ({{email}}).\n\nSujet: {{subject}}\nMessage: {{message}}',
        variables: ['customerName', 'email', 'subject', 'message'],
      },
      {
        id: 'quote_requested',
        name: 'Quote Requested',
        subject: 'Nouvelle demande de devis',
        body: 'Une nouvelle demande de devis a été soumise par {{customerName}}.\n\nProduits: {{products}}\nBudget estimé: {{estimatedBudget}}',
        variables: ['customerName', 'products', 'estimatedBudget'],
      },
      {
        id: 'review_submitted',
        name: 'Review Submitted',
        subject: 'Nouvel avis client',
        body: 'Un nouvel avis a été soumis par {{customerName}}.\n\nNote: {{rating}}/5\nCommentaire: {{comment}}',
        variables: ['customerName', 'rating', 'comment'],
      },
      {
        id: 'claim_opened',
        name: 'Claim Opened',
        subject: 'Nouvelle réclamation ouverte',
        body: 'Une nouvelle réclamation a été ouverte par {{customerName}}.\n\nCommande: {{orderId}}\nMotif: {{reason}}',
        variables: ['customerName', 'orderId', 'reason'],
      },
      {
        id: 'auto_response',
        name: 'Auto Response',
        subject: 'Confirmation de réception',
        body: "Bonjour {{customerName}},\n\nNous avons bien reçu votre message et nous vous répondrons dans un délai de {{responseTime}} heures.\n\nCordialement,\nL'équipe Automecanik",
        variables: ['customerName', 'responseTime'],
      },
    ];

    templates.forEach((template) => {
      this.templates.set(template.id, template);
    });

    this.logger.log(`Initialized ${templates.length} notification templates`);
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      const config = this.supportConfig.getNotificationSettings();

      this.logger.log(
        `Sending ${payload.type} notification with priority ${payload.priority}`,
      );

      // Send email notification
      if (config.emailEnabled) {
        await this.sendEmailNotification(payload);
      }

      // Send push notification
      if (config.pushEnabled) {
        await this.sendPushNotification(payload);
      }

      // Send webhook notification
      if (config.webhookUrl) {
        await this.sendWebhookNotification();
      }

      this.logger.log(`Notification sent successfully: ${payload.title}`);
    } catch (error) {
      this.logger.error(
        `Failed to send notification: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  private async sendEmailNotification(
    payload: NotificationPayload,
  ): Promise<void> {
    // Implementation would integrate with email service
    this.logger.debug(`Email notification would be sent: ${payload.title}`);
  }

  private async sendPushNotification(
    payload: NotificationPayload,
  ): Promise<void> {
    // Implementation would integrate with push notification service
    this.logger.debug(`Push notification: ${payload.title}`);
  }

  private async sendWebhookNotification(): Promise<void> {
    try {
      const config = this.supportConfig.getNotificationSettings();
      if (!config.webhookUrl) return;

      // Implementation would send HTTP request to webhook URL
      this.logger.debug(
        `Webhook notification would be sent to: ${config.webhookUrl}`,
      );
    } catch (error) {
      this.logger.error(
        `Webhook notification failed: ${getErrorMessage(error)}`,
      );
    }
  }

  async sendContactConfirmation(contactData: {
    customerName: string;
    email: string;
    subject: string;
    priority: 'urgent' | 'high' | 'normal' | 'low';
  }): Promise<void> {
    const responseTime =
      this.supportConfig.getResponseTime(contactData.priority) / 60; // Convert to hours

    const payload: NotificationPayload = {
      type: 'contact',
      priority: contactData.priority,
      title: 'Confirmation de réception',
      message: `Votre message concernant "${contactData.subject}" a été reçu`,
      metadata: {
        template: 'auto_response',
        variables: {
          customerName: contactData.customerName,
          responseTime: responseTime.toString(),
        },
      },
    };

    await this.sendNotification(payload);
  }

  async notifyStaffNewContact(contactData: {
    customerName: string;
    email: string;
    subject: string;
    message: string;
    priority: 'urgent' | 'high' | 'normal' | 'low';
  }): Promise<void> {
    const payload: NotificationPayload = {
      type: 'contact',
      priority: contactData.priority,
      title: 'Nouveau message de contact',
      message: `Message de ${contactData.customerName} - ${contactData.subject}`,
      metadata: {
        template: 'contact_received',
        variables: contactData,
      },
      actions: [
        {
          label: 'Répondre',
          url: `/admin/support/contacts`,
          style: 'primary',
        },
      ],
    };

    await this.sendNotification(payload);
  }

  async notifyQuoteRequest(quoteData: {
    customerName: string;
    products: string;
    estimatedBudget: string;
  }): Promise<void> {
    const payload: NotificationPayload = {
      type: 'quote',
      priority: 'normal',
      title: 'Nouvelle demande de devis',
      message: `Demande de devis de ${quoteData.customerName}`,
      metadata: {
        template: 'quote_requested',
        variables: quoteData,
      },
      actions: [
        {
          label: 'Traiter la demande',
          url: `/admin/support/quotes`,
          style: 'primary',
        },
      ],
    };

    await this.sendNotification(payload);
  }

  async notifyNewReview(reviewData: {
    customerName: string;
    rating: number;
    comment: string;
  }): Promise<void> {
    const priority = reviewData.rating <= 2 ? 'high' : 'normal';

    const payload: NotificationPayload = {
      type: 'review',
      priority,
      title: 'Nouvel avis client',
      message: `Avis ${reviewData.rating}/5 de ${reviewData.customerName}`,
      metadata: {
        template: 'review_submitted',
        variables: reviewData,
      },
      actions: [
        {
          label: "Modérer l'avis",
          url: `/admin/support/reviews`,
          style: 'primary',
        },
      ],
    };

    await this.sendNotification(payload);
  }

  async notifyClaimOpened(claimData: {
    customerName: string;
    orderId: string;
    reason: string;
  }): Promise<void> {
    const payload: NotificationPayload = {
      type: 'claim',
      priority: 'high',
      title: 'Nouvelle réclamation',
      message: `Réclamation pour commande ${claimData.orderId}`,
      metadata: {
        template: 'claim_opened',
        variables: claimData,
      },
      actions: [
        {
          label: 'Traiter la réclamation',
          url: `/admin/support/claims`,
          style: 'danger',
        },
      ],
    };

    await this.sendNotification(payload);
  }

  getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<NotificationTemplate>,
  ): Promise<void> {
    const template = this.templates.get(templateId);
    if (template) {
      this.templates.set(templateId, { ...template, ...updates });
      this.logger.log(`Template ${templateId} updated`);
    }
  }
}
