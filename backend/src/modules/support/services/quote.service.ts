import { Injectable, Logger } from '@nestjs/common';
import {
  DomainNotFoundException,
  BusinessRuleException,
  DomainValidationException,
  ErrorCodes,
} from '../../../common/exceptions';
import { NotificationService } from './notification.service';
import { getErrorMessage, getErrorStack } from '../../../common/utils/error.utils';

export interface QuoteRequest {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;
  projectDescription: string;
  requiredProducts: QuoteProduct[];
  estimatedBudget?: string;
  preferredDeliveryDate?: Date;
  status:
    | 'pending'
    | 'in_review'
    | 'quoted'
    | 'accepted'
    | 'rejected'
    | 'expired';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  attachments?: string[];
  notes?: string;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  quote?: Quote;
}

export interface QuoteProduct {
  name: string;
  description?: string;
  quantity: number;
  specifications?: Record<string, any>;
  category?: string;
}

export interface Quote {
  id: string;
  quoteRequestId: string;
  quotedItems: QuotedItem[];
  subtotal: number;
  taxes: number;
  shipping: number;
  discount?: number;
  total: number;
  validUntil: Date;
  terms: string;
  createdBy: string;
  createdAt: Date;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
}

export interface QuotedItem {
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specifications?: Record<string, any>;
}

@Injectable()
export class QuoteService {
  private readonly logger = new Logger(QuoteService.name);

  /**
   * TODO ARCHITECTURE: Ces Maps sont purement in-memory sans persistance Supabase.
   * RISQUES:
   * - Perte de données au redémarrage serveur
   * - Croissance mémoire non bornée (pas de TTL/cleanup)
   * - Pas de partage entre instances (scaling horizontal)
   *
   * ACTION REQUISE: Migrer vers Supabase avec cache L1 avant mise en prod.
   * Tables à créer: __quote_requests, __quotes
   */
  private quoteRequests: Map<string, QuoteRequest> = new Map();
  private quotes: Map<string, Quote> = new Map();

  constructor(private notificationService: NotificationService) {}

  async submitQuoteRequest(
    requestData: Omit<
      QuoteRequest,
      'id' | 'status' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<QuoteRequest> {
    try {
      this.validateQuoteRequest(requestData);

      const quoteRequest: QuoteRequest = {
        ...requestData,
        id: this.generateQuoteRequestId(),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.quoteRequests.set(quoteRequest.id, quoteRequest);

      // Notify staff about new quote request
      await this.notificationService.notifyQuoteRequest({
        customerName: quoteRequest.customerName,
        products: quoteRequest.requiredProducts
          .map((p) => `${p.name} (${p.quantity})`)
          .join(', '),
        estimatedBudget: quoteRequest.estimatedBudget || 'Non spécifié',
      });

      this.logger.log(`Quote request submitted: ${quoteRequest.id}`);
      return quoteRequest;
    } catch (error) {
      this.logger.error(
        `Failed to submit quote request: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  async getQuoteRequest(requestId: string): Promise<QuoteRequest | null> {
    return this.quoteRequests.get(requestId) || null;
  }

  async getAllQuoteRequests(filters?: {
    status?: string;
    assignedTo?: string;
    priority?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<QuoteRequest[]> {
    let requests = Array.from(this.quoteRequests.values());

    if (filters) {
      if (filters.status) {
        requests = requests.filter((r) => r.status === filters.status);
      }
      if (filters.assignedTo) {
        requests = requests.filter((r) => r.assignedTo === filters.assignedTo);
      }
      if (filters.priority) {
        requests = requests.filter((r) => r.priority === filters.priority);
      }
      if (filters.startDate) {
        requests = requests.filter((r) => r.createdAt >= filters.startDate!);
      }
      if (filters.endDate) {
        requests = requests.filter((r) => r.createdAt <= filters.endDate!);
      }
    }

    return requests.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async updateQuoteRequestStatus(
    requestId: string,
    status: QuoteRequest['status'],
    staffId?: string,
  ): Promise<QuoteRequest> {
    const request = this.quoteRequests.get(requestId);
    if (!request) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote request ${requestId} not found`,
      });
    }

    request.status = status;
    request.updatedAt = new Date();

    if (staffId && !request.assignedTo) {
      request.assignedTo = staffId;
    }

    this.quoteRequests.set(requestId, request);
    this.logger.log(`Quote request ${requestId} status updated to ${status}`);

    return request;
  }

  async assignQuoteRequest(
    requestId: string,
    staffId: string,
  ): Promise<QuoteRequest> {
    const request = this.quoteRequests.get(requestId);
    if (!request) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote request ${requestId} not found`,
      });
    }

    request.assignedTo = staffId;
    request.updatedAt = new Date();

    if (request.status === 'pending') {
      request.status = 'in_review';
    }

    this.quoteRequests.set(requestId, request);
    this.logger.log(`Quote request ${requestId} assigned to ${staffId}`);

    return request;
  }

  async createQuote(
    requestId: string,
    quoteData: Omit<Quote, 'id' | 'quoteRequestId' | 'createdAt' | 'status'>,
  ): Promise<Quote> {
    const request = this.quoteRequests.get(requestId);
    if (!request) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote request ${requestId} not found`,
      });
    }

    this.validateQuote(quoteData);

    const quote: Quote = {
      ...quoteData,
      id: this.generateQuoteId(),
      quoteRequestId: requestId,
      status: 'draft',
      createdAt: new Date(),
    };

    this.quotes.set(quote.id, quote);

    // Update request status and link quote
    request.quote = quote;
    request.status = 'quoted';
    request.updatedAt = new Date();
    this.quoteRequests.set(requestId, request);

    this.logger.log(`Quote created: ${quote.id} for request ${requestId}`);
    return quote;
  }

  async getQuote(quoteId: string): Promise<Quote | null> {
    return this.quotes.get(quoteId) || null;
  }

  async sendQuote(quoteId: string): Promise<Quote> {
    const quote = this.quotes.get(quoteId);
    if (!quote) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote ${quoteId} not found`,
      });
    }

    quote.status = 'sent';
    this.quotes.set(quoteId, quote);

    this.logger.log(`Quote ${quoteId} sent to customer`);
    return quote;
  }

  async acceptQuote(quoteId: string): Promise<Quote> {
    const quote = this.quotes.get(quoteId);
    if (!quote) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote ${quoteId} not found`,
      });
    }

    if (quote.status !== 'sent') {
      throw new BusinessRuleException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_SENT,
        message: 'Quote must be sent before it can be accepted',
      });
    }

    if (new Date() > quote.validUntil) {
      throw new BusinessRuleException({
        code: ErrorCodes.SUPPORT.QUOTE_EXPIRED,
        message: 'Quote has expired',
      });
    }

    quote.status = 'accepted';
    this.quotes.set(quoteId, quote);

    // Update related request
    const request = this.quoteRequests.get(quote.quoteRequestId);
    if (request) {
      request.status = 'accepted';
      request.updatedAt = new Date();
      this.quoteRequests.set(quote.quoteRequestId, request);
    }

    this.logger.log(`Quote ${quoteId} accepted by customer`);
    return quote;
  }

  async rejectQuote(quoteId: string, reason?: string): Promise<Quote> {
    const quote = this.quotes.get(quoteId);
    if (!quote) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote ${quoteId} not found`,
      });
    }

    quote.status = 'rejected';
    this.quotes.set(quoteId, quote);

    // Update related request
    const request = this.quoteRequests.get(quote.quoteRequestId);
    if (request) {
      request.status = 'rejected';
      request.notes = reason
        ? `${request.notes || ''}\nReject reason: ${reason}`
        : request.notes;
      request.updatedAt = new Date();
      this.quoteRequests.set(quote.quoteRequestId, request);
    }

    this.logger.log(
      `Quote ${quoteId} rejected by customer${reason ? `: ${reason}` : ''}`,
    );
    return quote;
  }

  async getQuoteStats(period?: { start: Date; end: Date }) {
    let requests = Array.from(this.quoteRequests.values());
    let quotes = Array.from(this.quotes.values());

    if (period) {
      requests = requests.filter(
        (r) => r.createdAt >= period.start && r.createdAt <= period.end,
      );
      quotes = quotes.filter(
        (q) => q.createdAt >= period.start && q.createdAt <= period.end,
      );
    }

    const totalRequests = requests.length;
    const totalQuotes = quotes.length;
    const acceptedQuotes = quotes.filter((q) => q.status === 'accepted').length;
    const rejectedQuotes = quotes.filter((q) => q.status === 'rejected').length;
    const pendingRequests = requests.filter(
      (r) => r.status === 'pending',
    ).length;

    const conversionRate =
      totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0;

    const totalQuoteValue = quotes
      .filter((q) => q.status === 'accepted')
      .reduce((sum, q) => sum + q.total, 0);

    const averageQuoteValue =
      acceptedQuotes > 0 ? totalQuoteValue / acceptedQuotes : 0;

    return {
      totalRequests,
      totalQuotes,
      acceptedQuotes,
      rejectedQuotes,
      pendingRequests,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalQuoteValue,
      averageQuoteValue: Math.round(averageQuoteValue * 100) / 100,
    };
  }

  private validateQuoteRequest(
    data: Omit<QuoteRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
  ): void {
    if (!data.customerName || !data.customerEmail || !data.projectDescription) {
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.REQUIRED_FIELD,
        message: 'Missing required fields',
      });
    }

    if (!data.requiredProducts || data.requiredProducts.length === 0) {
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.FAILED,
        message: 'At least one product must be specified',
      });
    }

    if (!this.isValidEmail(data.customerEmail)) {
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.INVALID_EMAIL,
        message: 'Invalid email format',
      });
    }

    data.requiredProducts.forEach((product, index) => {
      if (!product.name || product.quantity <= 0) {
        throw new DomainValidationException({
          code: ErrorCodes.VALIDATION.FAILED,
          message: `Invalid product at index ${index}`,
        });
      }
    });
  }

  private validateQuote(
    data: Omit<Quote, 'id' | 'quoteRequestId' | 'createdAt' | 'status'>,
  ): void {
    if (!data.quotedItems || data.quotedItems.length === 0) {
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.FAILED,
        message: 'Quote must contain at least one item',
      });
    }

    if (data.subtotal < 0 || data.total < 0) {
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.INVALID_RANGE,
        message: 'Quote amounts cannot be negative',
      });
    }

    if (data.validUntil <= new Date()) {
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.INVALID_RANGE,
        message: 'Quote expiration date must be in the future',
      });
    }

    data.quotedItems.forEach((item, index) => {
      if (!item.productName || item.quantity <= 0 || item.unitPrice < 0) {
        throw new DomainValidationException({
          code: ErrorCodes.VALIDATION.FAILED,
          message: `Invalid quoted item at index ${index}`,
        });
      }
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private generateQuoteRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `QR-${timestamp}-${random}`.toUpperCase();
  }

  private generateQuoteId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `QT-${timestamp}-${random}`.toUpperCase();
  }
}
