/**
 * Contrôleur API Messages - Table ___xtr_msg
 * Gestion des communications client/staff
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MessagesService, MessageWithDetails } from './messages.service';

@Controller('api/messages')
export class MessagesController {
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
    @Query('order') orderId?: string,
    @Query('status') status?: string,
  ) {
    console.log(`📧 API Messages: GET /api/messages`);

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);
      
      const filters: any = {};
      if (staffId) filters.staffId = staffId;
      if (customerId) filters.customerId = customerId;
      if (orderId) filters.orderId = orderId;
      if (status && ['open', 'closed', 'all'].includes(status)) {
        filters.status = status;
      }

      const result = await this.messagesService.getAllMessages(
        pageNum,
        limitNum,
        filters,
      );

      console.log(`✅ API Messages - ${result.messages.length}/${result.total} messages retournés`);
      return result;
    } catch (error: any) {
      console.error(`❌ API Messages Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors de la récupération des messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer un message par ID
   * GET /api/messages/:id
   */
  @Get(':id')
  async getMessageById(@Param('id') id: string) {
    console.log(`📧 API Messages: GET /api/messages/${id}`);

    try {
      const message = await this.messagesService.getMessageById(id);
      
      if (!message) {
        console.log(`❌ API Messages: Message ${id} non trouvé`);
        throw new HttpException('Message non trouvé', HttpStatus.NOT_FOUND);
      }

      console.log(`✅ API Messages: Message ${id} trouvé`);
      return message;
    } catch (error: any) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      console.error(`❌ API Messages Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors de la récupération du message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Créer un nouveau message
   * POST /api/messages
   */
  @Post()
  async createMessage(
    @Body() messageData: {
      customerId: string;
      staffId: string;
      orderId?: string;
      orderLineId?: string;
      subject: string;
      content: string;
      parentId?: string;
    },
  ) {
    console.log(`📧 API Messages: POST /api/messages`);

    try {
      // Validation des données
      if (!messageData.customerId || !messageData.staffId) {
        throw new HttpException(
          'customerId et staffId sont obligatoires',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!messageData.subject || !messageData.content) {
        throw new HttpException(
          'subject et content sont obligatoires',
          HttpStatus.BAD_REQUEST,
        );
      }

      const newMessage = await this.messagesService.createMessage(messageData);

      console.log(`✅ API Messages: Message ${newMessage.msg_id} créé`);
      return newMessage;
    } catch (error: any) {
      if (error.status === HttpStatus.BAD_REQUEST) {
        throw error;
      }
      console.error(`❌ API Messages Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors de la création du message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Fermer un message
   * PUT /api/messages/:id/close
   */
  @Put(':id/close')
  async closeMessage(@Param('id') id: string) {
    console.log(`📧 API Messages: PUT /api/messages/${id}/close`);

    try {
      const success = await this.messagesService.closeMessage(id);
      
      if (!success) {
        throw new HttpException(
          'Impossible de fermer le message',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      console.log(`✅ API Messages: Message ${id} fermé`);
      return { success: true, message: 'Message fermé avec succès' };
    } catch (error: any) {
      console.error(`❌ API Messages Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors de la fermeture du message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les statistiques des messages
   * GET /api/messages/stats
   */
  @Get('stats/overview')
  async getMessageStats() {
    console.log(`📧 API Messages: GET /api/messages/stats/overview`);

    try {
      const stats = await this.messagesService.getMessageStats();

      console.log(`✅ API Messages: Statistiques calculées`);
      return stats;
    } catch (error: any) {
      console.error(`❌ API Messages Stats Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors du calcul des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
