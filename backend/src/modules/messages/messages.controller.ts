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
  HttpException,
  HttpStatus,
  UsePipes,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { 
  CreateMessageDto, 
  MessageFiltersDto, 
  MarkAsReadDto,
  validateCreateMessage,
  validateMessageFilters,
  validateMarkAsRead
} from './dto';

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
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    console.log(`📧 API Messages: GET /api/messages`);

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      const filters = {
        page: pageNum,
        limit: limitNum,
        staffId,
        customerId,
        search,
        status: status as 'open' | 'closed' | 'all' || 'all',
      };

      const result = await this.messagesService.getMessages(filters);

      console.log(`✅ API Messages: ${result.total} messages trouvés`);
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
      console.error(`❌ API Messages Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors de la récupération des messages',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer un message spécifique
   * GET /api/messages/:id
   */
  @Get(':id')
  async getMessageById(@Param('id') messageId: string) {
    console.log(`📧 API Messages: GET /api/messages/${messageId}`);

    try {
      const message = await this.messagesService.getMessageById(messageId);

      console.log(`✅ API Messages: Message ${messageId} trouvé`);
      return {
        success: true,
        data: message,
      };
    } catch (error: any) {
      console.error(`❌ API Messages Error: ${error.message || error}`);
      
      if (error.status === 404) {
        throw new HttpException(
          'Message non trouvé',
          HttpStatus.NOT_FOUND,
        );
      }
      
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
      subject: string;
      content: string;
      priority?: 'low' | 'normal' | 'high';
    }
  ) {
    console.log(`📧 API Messages: POST /api/messages`);

    try {
      const newMessage = await this.messagesService.createMessage(messageData);

      console.log(`✅ API Messages: Nouveau message créé ${newMessage.id}`);
      return {
        success: true,
        data: newMessage,
        message: 'Message créé avec succès',
      };
    } catch (error: any) {
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
  async closeMessage(@Param('id') messageId: string) {
    console.log(`📧 API Messages: PUT /api/messages/${messageId}/close`);

    try {
      const message = await this.messagesService.closeMessage(messageId);

      console.log(`✅ API Messages: Message ${messageId} fermé`);
      return {
        success: true,
        data: message,
        message: 'Message fermé avec succès',
      };
    } catch (error: any) {
      console.error(`❌ API Messages Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors de la fermeture du message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
    console.log(`📧 API Messages: PUT /api/messages/${messageId}/read`);

    try {
      const readerId = body?.readerId || 'unknown';
      const message = await this.messagesService.markAsRead(messageId, readerId);

      console.log(`✅ API Messages: Message ${messageId} marqué comme lu par ${readerId}`);
      return {
        success: true,
        data: message,
        message: 'Message marqué comme lu',
      };
    } catch (error: any) {
      console.error(`❌ API Messages Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors du marquage du message',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les statistiques des messages
   * GET /api/messages/stats?customer=123
   */
  @Get('stats')
  async getMessageStats(@Query('customer') customerId?: string) {
    console.log(`📧 API Messages: GET /api/messages/stats`);

    try {
      const stats = await this.messagesService.getStatistics(customerId);

      console.log(`✅ API Messages: Statistiques calculées`);
      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      console.error(`❌ API Messages Stats Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors du calcul des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les statistiques globales des messages (admin)
   * GET /api/messages/stats/overview
   */
  @Get('stats/overview')
  async getMessageStatsOverview() {
    console.log(`📧 API Messages: GET /api/messages/stats/overview`);

    try {
      const stats = await this.messagesService.getStatistics();

      console.log(`✅ API Messages: Statistiques calculées`);
      return {
        success: true,
        data: stats,
      };
    } catch (error: any) {
      console.error(`❌ API Messages Stats Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors du calcul des statistiques',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer la liste des clients
   * GET /api/messages/customers
   */
  @Get('customers')
  async getCustomers(@Query('limit') limit?: string) {
    console.log(`📧 API Messages: GET /api/messages/customers`);

    try {
      const limitNum = parseInt(limit || '100', 10);
      const customers = await this.messagesService.getCustomers(limitNum);

      console.log(`✅ API Messages: ${customers.length} clients trouvés`);
      return {
        success: true,
        data: customers,
      };
    } catch (error: any) {
      console.error(`❌ API Messages Error: ${error.message || error}`);
      throw new HttpException(
        'Erreur serveur lors de la récupération des clients',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
