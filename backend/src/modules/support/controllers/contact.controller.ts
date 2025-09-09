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

  @Get('tickets')
  async getAllTickets(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('priority') priority?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    
    const filters = {
      status,
      category,
      assignedTo,
      priority,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const tickets = await this.contactService.getAllTickets(filters);
    
    // Pagination simple
    const total = tickets.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedTickets = tickets.slice(startIndex, endIndex);

    return {
      tickets: paginatedTickets,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  @Get('stats')
  async getStats() {
    return this.contactService.getStats();
  }

  @Get('ticket/:ticketId')
  async getTicket(@Param('ticketId') ticketId: string): Promise<ContactTicket> {
    return this.contactService.getTicket(ticketId);
  }

  @Get('search')
  async searchTickets(
    @Query('keyword') keyword?: string,
    @Query('customer_id') customerId?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);
    
    // Pour l'instant, retournons juste la liste filtrée par les critères basiques
    const filters = {
      priority,
      category,
      startDate: dateFrom ? new Date(dateFrom) : undefined,
      endDate: dateTo ? new Date(dateTo) : undefined,
    };

    let tickets = await this.contactService.getAllTickets(filters);
    
    // Filtrage simple par mot-clé
    if (keyword) {
      tickets = tickets.filter(ticket => 
        ticket.msg_subject.toLowerCase().includes(keyword.toLowerCase()) ||
        ticket.msg_content.toLowerCase().includes(keyword.toLowerCase())
      );
    }
    
    // Filtrage par customer_id
    if (customerId) {
      tickets = tickets.filter(ticket => ticket.msg_cst_id === customerId);
    }
    
    // Pagination
    const total = tickets.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedTickets = tickets.slice(startIndex, endIndex);

    return {
      tickets: paginatedTickets,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  @Put('ticket/:ticketId/status')
  async updateTicketStatus(
    @Param('ticketId') ticketId: string,
    @Body() body: { status: string },
  ): Promise<ContactTicket> {
    return this.contactService.updateTicketStatus(
      ticketId,
      body.status as any,
    );
  }
}
