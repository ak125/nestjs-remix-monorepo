/**
 * Service de messagerie moderne suivant l'architecture des autres modules
 * Utilise MessageDataService pour l'accès aux données
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MessageDataService,
  ModernMessage,
  MessageFilters,
} from './repositories/message-data.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly messageDataService: MessageDataService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log(
      'MessagesService initialized - Modern architecture with legacy table support',
    );
  }

  /**
   * Obtenir les messages avec filtres
   */
  async getMessages(filters: MessageFilters = {}): Promise<{
    messages: ModernMessage[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.logger.log(
      `Fetching messages with filters: ${JSON.stringify(filters)}`,
    );
    return this.messageDataService.getMessages(filters);
  }

  /**
   * Obtenir un message par ID
   */
  async getMessageById(messageId: string): Promise<ModernMessage> {
    this.logger.log(`Fetching message by ID: ${messageId}`);

    const message = await this.messageDataService.findMessageById(messageId);

    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    return message;
  }

  /**
   * Créer un nouveau message
   */
  async createMessage(messageData: {
    customerId: string;
    staffId: string;
    orderId?: string;
    subject: string;
    content: string;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<ModernMessage> {
    this.logger.log(`Creating message for customer: ${messageData.customerId}`);

    const message = await this.messageDataService.createMessage(messageData);

    // Émettre un événement pour WebSocket
    this.eventEmitter.emit('message.created', {
      message,
      recipientId: messageData.customerId,
      senderId: messageData.staffId,
    });

    return message;
  }

  /**
   * Fermer un message
   */
  async closeMessage(messageId: string): Promise<ModernMessage> {
    this.logger.log(`Closing message: ${messageId}`);

    const message = await this.messageDataService.updateMessageStatus(
      messageId,
      {
        closed: true,
      },
    );

    this.eventEmitter.emit('message.closed', { messageId, message });

    return message;
  }

  /**
   * Marquer un message comme lu
   */
  async markAsRead(
    messageId: string,
    readerId: string,
  ): Promise<ModernMessage> {
    this.logger.log(`Marking message as read: ${messageId} by ${readerId}`);

    const message = await this.messageDataService.updateMessageStatus(
      messageId,
      {
        read: true,
      },
    );

    this.eventEmitter.emit('message.read', {
      messageId,
      message,
      readerId,
      senderId: message.customerId.toString(), // ou staffId selon le contexte
    });

    return message;
  }

  /**
   * Obtenir les statistiques
   */
  async getStatistics(customerId?: string): Promise<{
    total: number;
    open: number;
    closed: number;
    unread: number;
  }> {
    this.logger.log('Fetching message statistics');
    return this.messageDataService.getStatistics(customerId);
  }

  /**
   * Obtenir les clients récents
   */
  async getCustomers(limit: number = 100): Promise<
    Array<{
      cst_id: string;
      cst_fname: string;
      cst_mail: string;
    }>
  > {
    this.logger.log(`Fetching customers with limit: ${limit}`);
    return this.messageDataService.getCustomers(limit);
  }

  /**
   * Archiver un message
   */
  async archiveMessage(
    messageId: string,
    userId: string,
  ): Promise<ModernMessage> {
    this.logger.log(`Archiving message: ${messageId} by user ${userId}`);

    // Vérifier que le message appartient à l'utilisateur
    const message = await this.getMessageById(messageId);
    if (message.customerId !== userId) {
      throw new NotFoundException('Message non trouvé ou accès refusé');
    }

    const archivedMessage = await this.messageDataService.updateMessageStatus(
      messageId,
      { closed: true },
    );

    this.eventEmitter.emit('message.archived', { messageId, userId });

    return archivedMessage;
  }

  /**
   * Supprimer un message (soft delete en le fermant)
   */
  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    this.logger.log(`Deleting message: ${messageId} by user ${userId}`);

    // Vérifier que le message appartient à l'utilisateur
    const message = await this.getMessageById(messageId);
    if (message.customerId !== userId) {
      throw new NotFoundException('Message non trouvé ou accès refusé');
    }

    await this.messageDataService.updateMessageStatus(messageId, {
      closed: true,
    });

    this.eventEmitter.emit('message.deleted', { messageId, userId });

    return true;
  }

  /**
   * Répondre à un message
   */
  async replyToMessage(
    messageId: string,
    userId: string,
    replyContent: string,
  ): Promise<ModernMessage> {
    this.logger.log(`Replying to message: ${messageId} by user ${userId}`);

    // Récupérer le message original
    const originalMessage = await this.getMessageById(messageId);
    if (originalMessage.customerId !== userId) {
      throw new NotFoundException('Message non trouvé ou accès refusé');
    }

    // Créer la réponse
    const replyMessage = await this.createMessage({
      customerId: userId,
      staffId: originalMessage.staffId,
      orderId: originalMessage.orderId,
      subject: `Re: ${originalMessage.subject}`,
      content: replyContent,
      priority: originalMessage.priority,
    });

    this.eventEmitter.emit('message.reply', {
      originalMessageId: messageId,
      replyMessageId: replyMessage.id,
      userId,
    });

    return replyMessage;
  }
}
