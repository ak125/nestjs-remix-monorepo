import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ContactService,
  ContactFormData,
  ContactTicket,
} from '../services/contact.service';

@Controller('api/support/contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);

  constructor(private contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitContactForm(
    @Body() contactData: ContactFormData,
  ): Promise<ContactTicket> {
    this.logger.log('Submitting contact form');
    return this.contactService.submitContactForm(contactData);
  }

  @Get()
  async getAllTickets(
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('priority') priority?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ContactTicket[]> {
    const filters = {
      status,
      category,
      assignedTo,
      priority,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return this.contactService.getAllTickets(filters);
  }

  @Get('stats')
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;

    return this.contactService.getStats(period);
  }

  @Get(':ticketId')
  async getTicket(@Param('ticketId') ticketId: string): Promise<ContactTicket> {
    const ticket = await this.contactService.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    return ticket;
  }

  @Put(':ticketId/status')
  async updateTicketStatus(
    @Param('ticketId') ticketId: string,
    @Body() body: { status: string; staffId?: string },
  ): Promise<ContactTicket> {
    return this.contactService.updateTicketStatus(
      ticketId,
      body.status as any,
      body.staffId,
    );
  }

  @Put(':ticketId/assign')
  async assignTicket(
    @Param('ticketId') ticketId: string,
    @Body() body: { staffId: string },
  ): Promise<ContactTicket> {
    return this.contactService.assignTicket(ticketId, body.staffId);
  }

  @Post(':ticketId/responses')
  async addResponse(
    @Param('ticketId') ticketId: string,
    @Body()
    responseData: {
      message: string;
      author: string;
      authorType: 'customer' | 'staff';
      attachments?: string[];
    },
  ): Promise<ContactTicket> {
    return this.contactService.addResponse(ticketId, responseData);
  }

  @Post(':ticketId/satisfaction')
  async addSatisfactionRating(
    @Param('ticketId') ticketId: string,
    @Body() ratingData: { rating: number; feedback?: string },
  ): Promise<ContactTicket> {
    return this.contactService.addSatisfactionRating(
      ticketId,
      ratingData.rating,
      ratingData.feedback,
    );
  }
}
