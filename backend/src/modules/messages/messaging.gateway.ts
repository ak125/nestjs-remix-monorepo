import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:5173'], // Frontend URLs
    credentials: true,
  },
  namespace: '/messaging',
})
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  private userSockets = new Map<string, string[]>();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extraire le token JWT depuis les query params ou headers
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      // Vérifier le token JWT
      const payload = this.jwtService.verify(token);
      client.userId = payload.sub || payload.id;
      client.userEmail = payload.email;

      if (!client.userId) {
        this.logger.warn(`Connection rejected: Invalid token`);
        client.disconnect();
        return;
      }

      // Ajouter le socket à la map des utilisateurs connectés
      const sockets = this.userSockets.get(client.userId) || [];
      sockets.push(client.id);
      this.userSockets.set(client.userId, sockets);
      
      // Joindre la room de l'utilisateur
      await client.join(`user-${client.userId}`);
      
      this.logger.log(`User ${client.userId} (${client.userEmail}) connected with socket ${client.id}`);
      
      // Notifier le client de la connexion réussie
      client.emit('connected', { 
        userId: client.userId, 
        socketId: client.id 
      });

    } catch (error: any) {
      this.logger.error(`Connection failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId) || [];
      const filtered = sockets.filter((id) => id !== client.id);
      
      if (filtered.length > 0) {
        this.userSockets.set(client.userId, filtered);
      } else {
        this.userSockets.delete(client.userId);
      }
      
      this.logger.log(`User ${client.userId} disconnected socket ${client.id}`);
    }
  }

  // Événements émis par le service de messages
  @OnEvent('message.created')
  handleMessageCreated(payload: {
    message: any;
    recipientId: string;
    senderId: string;
  }) {
    // Notifier le destinataire du nouveau message
    this.server.to(`user-${payload.recipientId}`).emit('newMessage', {
      message: payload.message,
      type: 'new_message'
    });

    // Notifier l'expéditeur que le message a été envoyé
    this.server.to(`user-${payload.senderId}`).emit('messageSent', {
      message: payload.message,
      type: 'message_sent'
    });

    this.logger.log(`Message sent from ${payload.senderId} to ${payload.recipientId}`);
  }

  @OnEvent('message.read')
  handleMessageRead(payload: {
    messageId: string;
    readerId: string;
    senderId: string;
  }) {
    // Notifier l'expéditeur que le message a été lu
    this.server.to(`user-${payload.senderId}`).emit('messageRead', {
      messageId: payload.messageId,
      readerId: payload.readerId,
      type: 'message_read'
    });

    this.logger.log(`Message ${payload.messageId} read by ${payload.readerId}`);
  }

  @OnEvent('message.closed')
  handleMessageClosed(payload: {
    messageId: string;
    closerId: string;
    senderId: string;
  }) {
    // Notifier l'expéditeur que le message a été fermé
    this.server.to(`user-${payload.senderId}`).emit('messageClosed', {
      messageId: payload.messageId,
      closerId: payload.closerId,
      type: 'message_closed'
    });

    this.logger.log(`Message ${payload.messageId} closed by ${payload.closerId}`);
  }

  // Messages WebSocket entrants du client
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { recipientId: string; isTyping: boolean }
  ) {
    if (!client.userId) return;

    // Notifier le destinataire que quelqu'un tape
    this.server.to(`user-${payload.recipientId}`).emit('userTyping', {
      userId: client.userId,
      userEmail: client.userEmail,
      isTyping: payload.isTyping,
      type: 'typing_indicator'
    });

    this.logger.debug(`User ${client.userId} typing to ${payload.recipientId}: ${payload.isTyping}`);
  }

  @SubscribeMessage('markAsRead')
  handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string }
  ) {
    if (!client.userId) return;

    // Émettre un événement pour que le service traite la lecture
    // Note: Ceci devrait déclencher une mise à jour en base de données via le service
    client.emit('readConfirmation', {
      messageId: payload.messageId,
      readAt: new Date().toISOString()
    });

    this.logger.debug(`Message ${payload.messageId} marked as read by ${client.userId}`);
  }

  @SubscribeMessage('joinConversation')
  handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string }
  ) {
    if (!client.userId) return;

    client.join(`conversation-${payload.conversationId}`);
    this.logger.debug(`User ${client.userId} joined conversation ${payload.conversationId}`);
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string }
  ) {
    if (!client.userId) return;

    client.leave(`conversation-${payload.conversationId}`);
    this.logger.debug(`User ${client.userId} left conversation ${payload.conversationId}`);
  }

  // Méthodes utilitaires
  getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.length || 0;
  }

  // Méthode pour envoyer un message à un utilisateur spécifique
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user-${userId}`).emit(event, data);
  }

  // Méthode pour broadcaster à tous les utilisateurs connectés
  broadcast(event: string, data: any) {
    this.server.emit(event, data);
  }
}
