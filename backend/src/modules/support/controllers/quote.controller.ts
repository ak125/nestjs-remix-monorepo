import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QuoteService, QuoteRequest, Quote } from '../services/quote.service';

@Controller('api/support/quotes')
export class QuoteController {
  private readonly logger = new Logger(QuoteController.name);

  constructor(private quoteService: QuoteService) {}

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  async submitQuoteRequest(
    @Body()
    requestData: Omit<
      QuoteRequest,
      'id' | 'status' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<QuoteRequest> {
    this.logger.log('Submitting quote request');
    return this.quoteService.submitQuoteRequest(requestData);
  }

  @Get('requests')
  async getAllQuoteRequests(
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('priority') priority?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<QuoteRequest[]> {
    const filters = {
      status,
      assignedTo,
      priority,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return this.quoteService.getAllQuoteRequests(filters);
  }

  @Get('requests/:requestId')
  async getQuoteRequest(
    @Param('requestId') requestId: string,
  ): Promise<QuoteRequest> {
    const request = await this.quoteService.getQuoteRequest(requestId);
    if (!request) {
      throw new Error(`Quote request ${requestId} not found`);
    }
    return request;
  }

  @Put('requests/:requestId/status')
  async updateQuoteRequestStatus(
    @Param('requestId') requestId: string,
    @Body() body: { status: string; staffId?: string },
  ): Promise<QuoteRequest> {
    return this.quoteService.updateQuoteRequestStatus(
      requestId,
      body.status as any,
      body.staffId,
    );
  }

  @Put('requests/:requestId/assign')
  async assignQuoteRequest(
    @Param('requestId') requestId: string,
    @Body() body: { staffId: string },
  ): Promise<QuoteRequest> {
    return this.quoteService.assignQuoteRequest(requestId, body.staffId);
  }

  @Post('requests/:requestId/quotes')
  @HttpCode(HttpStatus.CREATED)
  async createQuote(
    @Param('requestId') requestId: string,
    @Body()
    quoteData: Omit<Quote, 'id' | 'quoteRequestId' | 'createdAt' | 'status'>,
  ): Promise<Quote> {
    return this.quoteService.createQuote(requestId, quoteData);
  }

  @Get('quotes/:quoteId')
  async getQuote(@Param('quoteId') quoteId: string): Promise<Quote> {
    const quote = await this.quoteService.getQuote(quoteId);
    if (!quote) {
      throw new Error(`Quote ${quoteId} not found`);
    }
    return quote;
  }

  @Put('quotes/:quoteId/send')
  async sendQuote(@Param('quoteId') quoteId: string): Promise<Quote> {
    return this.quoteService.sendQuote(quoteId);
  }

  @Put('quotes/:quoteId/accept')
  async acceptQuote(@Param('quoteId') quoteId: string): Promise<Quote> {
    return this.quoteService.acceptQuote(quoteId);
  }

  @Put('quotes/:quoteId/reject')
  async rejectQuote(
    @Param('quoteId') quoteId: string,
    @Body() body: { reason?: string },
  ): Promise<Quote> {
    return this.quoteService.rejectQuote(quoteId, body.reason);
  }

  @Get('stats')
  async getQuoteStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;

    return this.quoteService.getQuoteStats(period);
  }
}
