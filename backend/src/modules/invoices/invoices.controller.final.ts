/**
 * 🧾 INVOICES CONTROLLER - Production
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';

@Controller('api/invoices')
export class InvoicesController {
  private readonly logger = new Logger(InvoicesController.name);

  constructor(private readonly invoicesService: InvoicesService) {}

  /**
   * GET /api/invoices
   */
  @Get()
  async getAllInvoices(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    this.logger.log(`GET /api/invoices - page:${page}, limit:${limit}`);
    return this.invoicesService.getAllInvoices(page, limit);
  }

  /**
   * GET /api/invoices/stats
   */
  @Get('stats')
  async getInvoiceStats() {
    this.logger.log('GET /api/invoices/stats');
    return this.invoicesService.getInvoiceStats();
  }

  /**
   * GET /api/invoices/:id
   */
  @Get(':id')
  async getInvoiceById(@Param('id') id: string) {
    this.logger.log(`GET /api/invoices/${id}`);
    return this.invoicesService.getInvoiceById(id);
  }

  /**
   * GET /api/invoices/cache/clear
   */
  @Get('cache/clear')
  async clearCache() {
    this.logger.log('GET /api/invoices/cache/clear');
    return this.invoicesService.clearCache();
  }
}
