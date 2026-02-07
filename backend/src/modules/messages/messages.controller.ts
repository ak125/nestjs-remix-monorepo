/**
 * Contrôleur API Messages - Table ___xtr_msg
 * Gestion des communications client/staff - Architecture moderne avec Zod
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  Logger,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import {
  OperationFailedException,
  DomainNotFoundException,
} from '../../common/exceptions';

@Controller('api/messages')
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Récupérer la liste des messages avec filtres
   * GET /api/messages?page=1&limit=20&staff=123&customer=456&status=open
   */
  @Get()
  async getMessages(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('staff') staffId?: string,
    @Query('customer') customerId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    this.logger.log('API Messages: GET /api/messages');

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      const filters = {
        page: pageNum,
        limit: limitNum,
        staffId,
        customerId,
        search,
        status: (status as 'open' | 'closed' | 'all') || 'all',
      };

      const result = await this.messagesService.getMessages(filters);

      this.logger.log(`API Messages: ${result.total} messages trouvés`);
      return {
        success: true,
        data: result.messages,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      };
    } catch (error: any) {
      this.logger.error(`API Messages Error: ${error.message || error}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors de la récupération des messages',
      });
    }
  }

  /**
   * Récupérer un message spécifique
   * GET /api/messages/:id
   */
  @Get(':id')
  async getMessageById(@Param('id') messageId: string) {
    this.logger.log(`API Messages: GET /api/messages/${messageId}`);

    try {
      const message = await this.messagesService.getMessageById(messageId);

      this.logger.log(`API Messages: Message ${messageId} trouvé`);
      return {
        success: true,
        data: message,
      };
    } catch (error: any) {
      this.logger.error(`API Messages Error: ${error.message || error}`);

      if (error.status === 404) {
        throw new DomainNotFoundException({
          message: 'Message non trouvé',
        });
      }

      throw new OperationFailedException({
        message: 'Erreur serveur lors de la récupération du message',
      });
    }
  }

  /**
   * Créer un nouveau message
   * POST /api/messages
   */
  @Post()
  async createMessage(
    @Body()
    messageData: {
      customerId: string;
      staffId: string;
      orderId?: string;
      subject: string;
      content: string;
      priority?: 'low' | 'normal' | 'high';
    },
  ) {
    this.logger.log('API Messages: POST /api/messages');

    try {
      const newMessage = await this.messagesService.createMessage(messageData);

      this.logger.log(`API Messages: Nouveau message créé ${newMessage.id}`);
      return {
        success: true,
        data: newMessage,
        message: 'Message créé avec succès',
      };
    } catch (error: any) {
      this.logger.error(`API Messages Error: ${error.message || error}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors de la création du message',
      });
    }
  }

  /**
   * Fermer un message
   * PUT /api/messages/:id/close
   */
  @Put(':id/close')
  async closeMessage(@Param('id') messageId: string) {
    this.logger.log(`API Messages: PUT /api/messages/${messageId}/close`);

    try {
      const message = await this.messagesService.closeMessage(messageId);

      this.logger.log(`API Messages: Message ${messageId} fermé`);
      return {
        success: true,
        data: message,
        message: 'Message fermé avec succès',
      };
    } catch (error: any) {
      this.logger.error(`API Messages Error: ${error.message || error}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors de la fermeture du message',
      });
    }
  }

  /**
   * Marquer un message comme lu
   * PUT /api/messages/:id/read
   */
  @Put(':id/read')
  async markAsRead(
    @Param('id') messageId: string,
    @Body() body?: { readerId?: string },
  ) {
    this.logger.log(`API Messages: PUT /api/messages/${messageId}/read`);

    try {
      const readerId = body?.readerId || 'unknown';
      const message = await this.messagesService.markAsRead(
        messageId,
        readerId,
      );

      this.logger.log(
        `API Messages: Message ${messageId} marqué comme lu par ${readerId}`,
      );
      return {
        success: true,
        data: message,
        message: 'Message marqué comme lu',
      };
    } catch (error: any) {
      this.logger.error(`API Messages Error: ${error.message || error}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors du marquage du message',
      });
    }
  }

  /**
   * Récupérer les statistiques des messages
   * GET /api/messages/stats?customer=123
   */
  @Get('stats')
  async getMessageStats(@Query('customer') customerId?: string) {
    this.logger.log('API Messages: GET /api/messages/stats');

    try {
      const stats = await this.messagesService.getStatistics(customerId);

      this.logger.log('API Messages: Statistiques calculées');
      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      this.logger.error(`API Messages Stats Error: ${error.message || error}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors du calcul des statistiques',
      });
    }
  }

  /**
   * Récupérer les statistiques globales des messages (admin)
   * GET /api/messages/stats/overview
   */
  @Get('stats/overview')
  async getMessageStatsOverview() {
    this.logger.log('API Messages: GET /api/messages/stats/overview');

    try {
      const stats = await this.messagesService.getStatistics();

      this.logger.log('API Messages: Statistiques calculées');
      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      this.logger.error(`API Messages Stats Error: ${error.message || error}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors du calcul des statistiques',
      });
    }
  }

  /**
   * Récupérer la liste des clients
   * GET /api/messages/customers
   */
  @Get('customers')
  async getCustomers(@Query('limit') limit?: string) {
    this.logger.log('API Messages: GET /api/messages/customers');

    try {
      const limitNum = parseInt(limit || '100', 10);
      const customers = await this.messagesService.getCustomers(limitNum);

      this.logger.log(`API Messages: ${customers.length} clients trouvés`);
      return {
        success: true,
        data: customers,
      };
    } catch (error: any) {
      this.logger.error(`API Messages Error: ${error.message || error}`);
      throw new OperationFailedException({
        message: 'Erreur serveur lors de la récupération des clients',
      });
    }
  }

  /**
   * Archiver un message
   * PUT /api/messages/:id/archive
   */
  @Put(':id/archive')
  async archiveMessage(
    @Param('id') messageId: string,
    @Body() body: { userId: string },
  ) {
    this.logger.log(`API Messages: PUT /api/messages/${messageId}/archive`);

    try {
      const message = await this.messagesService.archiveMessage(
        messageId,
        body.userId,
      );

      this.logger.log(`API Messages: Message ${messageId} archivé`);
      return {
        success: true,
        data: message,
        message: 'Message archivé avec succès',
      };
    } catch (error: any) {
      this.logger.error(`API Messages Error: ${error.message || error}`);

      if (error.status === 404) {
        throw new DomainNotFoundException({
          message: 'Message non trouvé ou accès refusé',
        });
      }

      throw new OperationFailedException({
        message: "Erreur serveur lors de l'archivage du message",
      });
    }
  }

  /**
   * Supprimer un message
   * PUT /api/messages/:id/delete
   */
  @Put(':id/delete')
  async deleteMessage(
    @Param('id') messageId: string,
    @Body() body: { userId: string },
  ) {
    this.logger.log(`API Messages: PUT /api/messages/${messageId}/delete`);

    try {
      await this.messagesService.deleteMessage(messageId, body.userId);

      this.logger.log(`API Messages: Message ${messageId} supprimé`);
      return {
        success: true,
        message: 'Message supprimé avec succès',
      };
    } catch (error: any) {
      this.logger.error(`API Messages Error: ${error.message || error}`);

      if (error.status === 404) {
        throw new DomainNotFoundException({
          message: 'Message non trouvé ou accès refusé',
        });
      }

      throw new OperationFailedException({
        message: 'Erreur serveur lors de la suppression du message',
      });
    }
  }

  /**
   * Répondre à un message
   * POST /api/messages/:id/reply
   */
  @Post(':id/reply')
  async replyToMessage(
    @Param('id') messageId: string,
    @Body() body: { userId: string; content: string },
  ) {
    this.logger.log(`API Messages: POST /api/messages/${messageId}/reply`);

    try {
      const replyMessage = await this.messagesService.replyToMessage(
        messageId,
        body.userId,
        body.content,
      );

      this.logger.log(
        `API Messages: Réponse créée ${replyMessage.id} pour message ${messageId}`,
      );
      return {
        success: true,
        data: replyMessage,
        message: 'Réponse envoyée avec succès',
      };
    } catch (error: any) {
      this.logger.error(`API Messages Error: ${error.message || error}`);

      if (error.status === 404) {
        throw new DomainNotFoundException({
          message: 'Message non trouvé ou accès refusé',
        });
      }

      throw new OperationFailedException({
        message: "Erreur serveur lors de l'envoi de la réponse",
      });
    }
  }
}
