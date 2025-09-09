import { Injectable, Logger } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  persistent?: boolean;
  data?: any;
}

@Injectable()
export class NotificationsService {
  private logger = new Logger('NotificationsService');

  constructor(private notificationsGateway: NotificationsGateway) {}

  // Send order status updates
  sendOrderUpdate(orderId: string, status: string, userId?: string) {
    const notification: NotificationData = {
      id: `order-${orderId}-${Date.now()}`,
      type: 'info',
      title: '📦 Mise à jour commande',
      message: `Commande #${orderId} : ${status}`,
      timestamp: new Date().toISOString(),
      priority: 'normal',
      data: { orderId, status, type: 'order-update' },
    };

    if (userId) {
      this.notificationsGateway.sendToUser(userId, notification);
    } else {
      this.notificationsGateway.broadcastNotification(notification);
    }

    this.logger.log(`Order update sent: ${orderId} - ${status}`);
  }

  // Send promotional notifications
  sendPromotion(promotion: {
    title: string;
    message: string;
    discount?: number;
    validUntil?: string;
  }) {
    const notification: NotificationData = {
      id: `promo-${Date.now()}`,
      type: 'success',
      title: `🎉 ${promotion.title}`,
      message: promotion.message,
      timestamp: new Date().toISOString(),
      priority: 'low',
      data: { ...promotion, type: 'promotion' },
    };

    this.notificationsGateway.broadcastNotification(notification);
    this.logger.log('Promotion notification sent:', promotion.title);
  }

  // Send system alerts
  sendSystemAlert(
    message: string,
    type: 'warning' | 'error' = 'warning',
    priority: NotificationData['priority'] = 'high',
  ) {
    const notification: NotificationData = {
      id: `system-${Date.now()}`,
      type,
      title: type === 'error' ? '🚨 Alerte système' : '⚠️ Maintenance',
      message,
      timestamp: new Date().toISOString(),
      priority,
      persistent: priority === 'urgent',
      data: { type: 'system-alert' },
    };

    this.notificationsGateway.broadcastNotification(notification);
    this.logger.warn(`System alert sent: ${message}`);
  }

  // Send inventory alerts
  sendInventoryAlert(productName: string, stock: number, threshold: number) {
    const notification: NotificationData = {
      id: `inventory-${Date.now()}`,
      type: stock === 0 ? 'error' : 'warning',
      title: stock === 0 ? '❌ Rupture de stock' : '⚠️ Stock faible',
      message:
        stock === 0
          ? `Le produit "${productName}" est en rupture de stock`
          : `Le produit "${productName}" n'a plus que ${stock} unités (seuil: ${threshold})`,
      timestamp: new Date().toISOString(),
      priority: stock === 0 ? 'urgent' : 'high',
      data: {
        productName,
        stock,
        threshold,
        type: 'inventory-alert',
      },
    };

    // Send to admin users and inventory managers
    this.notificationsGateway.sendToRoom('admin', notification);
    this.notificationsGateway.sendToRoom('inventory-manager', notification);

    this.logger.warn(`Inventory alert: ${productName} - Stock: ${stock}`);
  }

  // Send user welcome notification
  sendWelcomeNotification(userId: string, userName: string) {
    const notification: NotificationData = {
      id: `welcome-${userId}-${Date.now()}`,
      type: 'success',
      title: '🎉 Bienvenue !',
      message: `Bonjour ${userName}, votre compte a été créé avec succès`,
      timestamp: new Date().toISOString(),
      priority: 'normal',
      data: { userId, userName, type: 'welcome' },
    };

    this.notificationsGateway.sendToUser(userId, notification);
    this.logger.log(`Welcome notification sent to user: ${userId}`);
  }

  // Send payment confirmation
  sendPaymentConfirmation(
    userId: string,
    orderId: string,
    amount: number,
    currency: string = 'EUR',
  ) {
    const notification: NotificationData = {
      id: `payment-${orderId}-${Date.now()}`,
      type: 'success',
      title: '💳 Paiement confirmé',
      message: `Votre paiement de ${amount}${currency} pour la commande #${orderId} a été traité`,
      timestamp: new Date().toISOString(),
      priority: 'normal',
      data: { orderId, amount, currency, type: 'payment-confirmation' },
    };

    this.notificationsGateway.sendToUser(userId, notification);
    this.logger.log(
      `Payment confirmation sent: ${orderId} - ${amount}${currency}`,
    );
  }

  // Send shipping notification
  sendShippingNotification(
    userId: string,
    orderId: string,
    trackingNumber: string,
    carrier: string,
  ) {
    const notification: NotificationData = {
      id: `shipping-${orderId}-${Date.now()}`,
      type: 'info',
      title: '🚚 Commande expédiée',
      message: `Votre commande #${orderId} a été expédiée via ${carrier}. Numéro de suivi: ${trackingNumber}`,
      timestamp: new Date().toISOString(),
      priority: 'normal',
      data: {
        orderId,
        trackingNumber,
        carrier,
        type: 'shipping-notification',
      },
    };

    this.notificationsGateway.sendToUser(userId, notification);
    this.logger.log(
      `Shipping notification sent: ${orderId} - ${trackingNumber}`,
    );
  }

  // Get notification statistics
  getNotificationStats() {
    return {
      connectedClients: this.notificationsGateway.getConnectedClientsCount(),
      timestamp: new Date().toISOString(),
    };
  }

  // Start demo mode for testing
  startDemoMode() {
    this.logger.log('Starting demo mode...');

    // Send periodic demo notifications
    setInterval(() => {
      const demoNotifications = [
        {
          type: 'info' as const,
          title: '📦 Nouvelle commande reçue',
          message: `Commande #${Math.floor(Math.random() * 99999)} reçue et en cours de traitement`,
        },
        {
          type: 'success' as const,
          title: '✅ Commande livrée',
          message: `Commande #${Math.floor(Math.random() * 99999)} livrée avec succès`,
        },
        {
          type: 'warning' as const,
          title: '⚠️ Stock faible',
          message: `Le produit "${['Filtre à huile', 'Plaquettes de frein', 'Bougies'][Math.floor(Math.random() * 3)]}" a un stock faible`,
        },
        {
          type: 'info' as const,
          title: '👤 Nouveau client',
          message: "Un nouveau client vient de s'inscrire sur la plateforme",
        },
      ];

      const randomNotification =
        demoNotifications[Math.floor(Math.random() * demoNotifications.length)];

      const notification: NotificationData = {
        id: `demo-${Date.now()}`,
        type: randomNotification.type,
        title: randomNotification.title,
        message: randomNotification.message,
        timestamp: new Date().toISOString(),
        priority: 'normal',
        data: { type: 'demo' },
      };

      this.notificationsGateway.broadcastNotification(notification);
    }, 45000); // Every 45 seconds
  }
}
