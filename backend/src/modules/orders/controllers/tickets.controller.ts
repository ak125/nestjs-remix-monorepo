import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { TicketsAdvancedService } from '../services/tickets-advanced.service';

@Controller('api/tickets')
export class TicketsController {
  private readonly logger = new Logger(TicketsController.name);

  constructor(private readonly ticketsService: TicketsAdvancedService) {}

  /**
   * Test du service tickets
   */
  @Get('test')
  async testTicketsService() {
    try {
      return {
        success: true,
        message: 'Service tickets avancés opérationnel',
        features: [
          'Tickets de préparation',
          'Avoirs/crédits avec expiration',
          'Validation de tickets',
          'Utilisation de tickets',
          'Types de tickets automatiques',
        ],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur test service tickets:', error);
      return {
        success: false,
        error: 'Erreur lors du test du service tickets',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Créer un ticket de préparation
   */
  @Post('preparation/:orderLineId')
  async createPreparationTicket(@Param('orderLineId') orderLineId: string) {
    try {
      const ticket =
        await this.ticketsService.createPreparationTicket(orderLineId);
      return {
        success: true,
        data: ticket,
        message: 'Ticket de préparation créé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur création ticket préparation pour ligne ${orderLineId}:`,
        error,
      );
      return {
        success: false,
        error:
          error instanceof BadRequestException
            ? error.message
            : 'Erreur lors de la création du ticket',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Créer un avoir/crédit
   */
  @Post('credit')
  async createCreditNote(
    @Body()
    body: {
      orderLineId: string;
      amount: number;
      reason: string;
    },
  ) {
    try {
      const { orderLineId, amount, reason } = body;

      if (!orderLineId || !amount || !reason) {
        throw new BadRequestException(
          'orderLineId, amount et reason sont requis',
        );
      }

      const creditNote = await this.ticketsService.createCreditNote(
        orderLineId,
        amount,
        reason,
      );

      return {
        success: true,
        data: creditNote,
        message: 'Avoir créé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur création avoir:', error);
      return {
        success: false,
        error:
          error instanceof BadRequestException
            ? error.message
            : "Erreur lors de la création de l'avoir",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Valider un ticket
   */
  @Get('validate/:ticketReference')
  async validateTicket(@Param('ticketReference') ticketReference: string) {
    try {
      const validation =
        await this.ticketsService.validateTicketByReference(ticketReference);
      return {
        success: true,
        data: validation,
        message: 'Ticket validé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Erreur validation ticket ${ticketReference}:`, error);
      return {
        success: false,
        error:
          error instanceof BadRequestException
            ? error.message
            : 'Erreur lors de la validation du ticket',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Utiliser un ticket
   */
  @Post('use')
  async useTicket(
    @Body()
    body: {
      ticketReference: string;
      amountToUse: number;
    },
  ) {
    try {
      const { ticketReference, amountToUse } = body;

      if (!ticketReference || !amountToUse) {
        throw new BadRequestException(
          'ticketReference et amountToUse sont requis',
        );
      }

      const usage = await this.ticketsService.useTicket(
        ticketReference,
        amountToUse,
      );

      return {
        success: true,
        data: usage,
        message: 'Ticket utilisé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur utilisation ticket:', error);
      return {
        success: false,
        error:
          error instanceof BadRequestException
            ? error.message
            : "Erreur lors de l'utilisation du ticket",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Lister les tickets d'une commande
   */
  @Get('order/:orderId')
  async getOrderTickets(@Param('orderId') orderId: string) {
    try {
      const tickets =
        await this.ticketsService.getOrderAdvancedTickets(orderId);
      return {
        success: true,
        data: {
          tickets,
          count: tickets.length,
        },
        message: 'Tickets récupérés avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Erreur récupération tickets commande ${orderId}:`,
        error,
      );
      return {
        success: false,
        error:
          error instanceof BadRequestException
            ? error.message
            : 'Erreur lors de la récupération des tickets',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
