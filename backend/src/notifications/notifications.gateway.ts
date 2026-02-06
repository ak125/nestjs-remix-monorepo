import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  persistent?: boolean;
  data?: Record<string, unknown>;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NotificationsGateway');
  private connectedClients = new Map<string, Socket>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // Send welcome notification
    const welcomeNotification: NotificationData = {
      id: `welcome-${Date.now()}`,
      type: 'info',
      title: '🚀 Connexion établie',
      message: 'Notifications temps réel activées avec succès',
      timestamp: new Date().toISOString(),
      priority: 'normal',
      data: {
        connectionId: client.id,
        features: ['real-time', 'offline-queue', 'sound', 'vibration'],
      },
    };

    client.emit('notification', welcomeNotification);

    // Send system status
    setTimeout(() => {
      const statusNotification: NotificationData = {
        id: `status-${Date.now()}`,
        type: 'success',
        title: '✅ Système opérationnel',
        message: 'Tous les services fonctionnent correctement',
        timestamp: new Date().toISOString(),
        priority: 'low',
      };
      client.emit('notification', statusNotification);
    }, 2000);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string; interests?: string[] },
  ) {
    this.logger.log(`Client ${client.id} subscribed with data:`, data);

    // Join specific rooms based on user preferences
    if (data.userId) {
      client.join(`user-${data.userId}`);
    }

    if (data.interests) {
      data.interests.forEach((interest: string) => {
        client.join(`interest-${interest}`);
      });
    }

    client.emit('subscribed', {
      success: true,
      message: 'Successfully subscribed to notifications',
      rooms: Array.from(client.rooms),
    });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room: string },
  ) {
    if (data.room) {
      client.leave(data.room);
      client.emit('unsubscribed', { room: data.room });
    }
  }

  // Broadcast notification to all clients
  broadcastNotification(notification: NotificationData) {
    this.logger.log('Broadcasting notification:', notification.title);
    this.server.emit('notification', notification);
  }

  // Send notification to specific user
  sendToUser(userId: string, notification: NotificationData) {
    this.logger.log(
      `Sending notification to user ${userId}:`,
      notification.title,
    );
    this.server.to(`user-${userId}`).emit('notification', notification);
  }

  // Send notification to specific client
  sendToClient(clientId: string, notification: NotificationData) {
    const client = this.connectedClients.get(clientId);
    if (client) {
      client.emit('notification', notification);
    }
  }

  // Send notification to room (interest group)
  sendToRoom(room: string, notification: NotificationData) {
    this.server.to(room).emit('notification', notification);
  }

  // Get connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // Get client information
  getClientInfo(clientId: string) {
    const client = this.connectedClients.get(clientId);
    if (client) {
      return {
        id: client.id,
        rooms: Array.from(client.rooms),
        connected: client.connected,
      };
    }
    return null;
  }

  // Demo notifications for testing
  @SubscribeMessage('test-notification')
  handleTestNotification(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { type?: NotificationData['type'] },
  ) {
    const testNotifications: NotificationData[] = [
      {
        id: `test-info-${Date.now()}`,
        type: 'info',
        title: '📋 Information de test',
        message:
          "Ceci est une notification d'information pour tester le système",
        timestamp: new Date().toISOString(),
        priority: 'normal',
      },
      {
        id: `test-success-${Date.now() + 1}`,
        type: 'success',
        title: '✅ Succès de test',
        message: 'Opération de test terminée avec succès',
        timestamp: new Date().toISOString(),
        priority: 'normal',
      },
      {
        id: `test-warning-${Date.now() + 2}`,
        type: 'warning',
        title: '⚠️ Avertissement de test',
        message: 'Ceci est un avertissement de test - veuillez vérifier',
        timestamp: new Date().toISOString(),
        priority: 'high',
      },
      {
        id: `test-error-${Date.now() + 3}`,
        type: 'error',
        title: '❌ Erreur de test',
        message: "Simulation d'erreur pour tester la gestion des erreurs",
        timestamp: new Date().toISOString(),
        priority: 'urgent',
      },
    ];

    const selectedType = data.type || 'info';
    const notification =
      testNotifications.find((n) => n.type === selectedType) ||
      testNotifications[0];

    client.emit('notification', notification);
  }

  // Periodic demo notifications
  startDemoMode() {
    const demoMessages = [
      {
        type: 'info',
        title: '📦 Nouvelle commande',
        message: 'Commande #12345 reçue et en cours de traitement',
      },
      {
        type: 'success',
        title: '🚚 Expédition',
        message: 'Votre commande #12344 a été expédiée',
      },
      {
        type: 'warning',
        title: '⚠️ Stock faible',
        message: "Le produit XYZ n'a plus que 2 unités en stock",
      },
      {
        type: 'info',
        title: '👤 Nouveau client',
        message: "Un nouveau client s'est inscrit sur la plateforme",
      },
    ];

    setInterval(() => {
      const randomMessage =
        demoMessages[Math.floor(Math.random() * demoMessages.length)];
      const notification: NotificationData = {
        id: `demo-${Date.now()}`,
        type: randomMessage.type as NotificationData['type'],
        title: randomMessage.title,
        message: randomMessage.message,
        timestamp: new Date().toISOString(),
        priority: 'normal',
      };

      this.broadcastNotification(notification);
    }, 30000); // Every 30 seconds
  }
}
