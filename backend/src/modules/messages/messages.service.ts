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
}
