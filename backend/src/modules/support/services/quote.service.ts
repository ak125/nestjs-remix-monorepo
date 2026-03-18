import { Injectable, Logger } from '@nestjs/common';
import {
  DomainNotFoundException,
  BusinessRuleException,
  DomainValidationException,
  ErrorCodes,
} from '../../../common/exceptions';
import { NotificationService } from './notification.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  getErrorMessage,
  getErrorStack,
} from '../../../common/utils/error.utils';

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
export class QuoteService extends SupabaseBaseService {
  protected readonly logger = new Logger(QuoteService.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  // ---------------------------------------------------------------------------
  // Row ↔ Domain mappers
  // ---------------------------------------------------------------------------

  private rowToQuoteRequest(row: any): QuoteRequest {
    return {
      id: row.qr_id,
      customerName: row.qr_customer_name,
      customerEmail: row.qr_customer_email,
      customerPhone: row.qr_customer_phone ?? undefined,
      companyName: row.qr_company_name ?? undefined,
      projectDescription: row.qr_project_description,
      requiredProducts: row.qr_required_products ?? [],
      estimatedBudget: row.qr_estimated_budget ?? undefined,
      preferredDeliveryDate: row.qr_preferred_delivery_date
        ? new Date(row.qr_preferred_delivery_date)
        : undefined,
      status: row.qr_status,
      priority: row.qr_priority,
      attachments: row.qr_attachments ?? undefined,
      notes: row.qr_notes ?? undefined,
      assignedTo: row.qr_assigned_to ?? undefined,
      createdAt: new Date(row.qr_created_at),
      updatedAt: new Date(row.qr_updated_at),
      quote: row.qr_quote_id ? undefined : undefined, // populated separately when needed
    };
  }

  private rowToQuote(row: any): Quote {
    return {
      id: row.qt_id,
      quoteRequestId: row.qt_quote_request_id,
      quotedItems: row.qt_quoted_items ?? [],
      subtotal: parseFloat(row.qt_subtotal),
      taxes: parseFloat(row.qt_taxes),
      shipping: parseFloat(row.qt_shipping),
      discount:
        row.qt_discount != null ? parseFloat(row.qt_discount) : undefined,
      total: parseFloat(row.qt_total),
      validUntil: new Date(row.qt_valid_until),
      terms: row.qt_terms,
      createdBy: row.qt_created_by,
      createdAt: new Date(row.qt_created_at),
      status: row.qt_status,
    };
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  async submitQuoteRequest(
    requestData: Omit<
      QuoteRequest,
      'id' | 'status' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<QuoteRequest> {
    try {
      this.validateQuoteRequest(requestData);

      const id = this.generateQuoteRequestId();
      const now = new Date().toISOString();

      const { data, error } = await this.supabase
        .from('__quote_requests')
        .insert({
          qr_id: id,
          qr_customer_name: requestData.customerName,
          qr_customer_email: requestData.customerEmail,
          qr_customer_phone: requestData.customerPhone ?? null,
          qr_company_name: requestData.companyName ?? null,
          qr_project_description: requestData.projectDescription,
          qr_required_products: requestData.requiredProducts,
          qr_estimated_budget: requestData.estimatedBudget ?? null,
          qr_preferred_delivery_date: requestData.preferredDeliveryDate
            ? requestData.preferredDeliveryDate.toISOString()
            : null,
          qr_status: 'pending',
          qr_priority: requestData.priority,
          qr_attachments: requestData.attachments ?? null,
          qr_notes: requestData.notes ?? null,
          qr_assigned_to: requestData.assignedTo ?? null,
          qr_quote_id: null,
          qr_created_at: now,
          qr_updated_at: now,
        })
        .select()
        .single();

      if (error) {
        throw new Error(
          `Supabase insert __quote_requests failed: ${error.message}`,
        );
      }

      const quoteRequest = this.rowToQuoteRequest(data);

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
    const { data, error } = await this.supabase
      .from('__quote_requests')
      .select()
      .eq('qr_id', requestId)
      .single();

    if (error || !data) return null;

    const request = this.rowToQuoteRequest(data);

    // Attach linked quote if exists
    if (data.qr_quote_id) {
      const quote = await this.getQuote(data.qr_quote_id);
      if (quote) request.quote = quote;
    }

    return request;
  }

  async getAllQuoteRequests(filters?: {
    status?: string;
    assignedTo?: string;
    priority?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<QuoteRequest[]> {
    let query = this.supabase
      .from('__quote_requests')
      .select()
      .order('qr_created_at', { ascending: false });

    if (filters) {
      if (filters.status) {
        query = query.eq('qr_status', filters.status);
      }
      if (filters.assignedTo) {
        query = query.eq('qr_assigned_to', filters.assignedTo);
      }
      if (filters.priority) {
        query = query.eq('qr_priority', filters.priority);
      }
      if (filters.startDate) {
        query = query.gte('qr_created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('qr_created_at', filters.endDate.toISOString());
      }
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to fetch quote requests: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => this.rowToQuoteRequest(row));
  }

  async updateQuoteRequestStatus(
    requestId: string,
    status: QuoteRequest['status'],
    staffId?: string,
  ): Promise<QuoteRequest> {
    // Fetch existing to verify it exists
    const { data: existing, error: fetchError } = await this.supabase
      .from('__quote_requests')
      .select()
      .eq('qr_id', requestId)
      .single();

    if (fetchError || !existing) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote request ${requestId} not found`,
      });
    }

    const updates: Record<string, any> = {
      qr_status: status,
      qr_updated_at: new Date().toISOString(),
    };

    if (staffId && !existing.qr_assigned_to) {
      updates.qr_assigned_to = staffId;
    }

    const { data, error } = await this.supabase
      .from('__quote_requests')
      .update(updates)
      .eq('qr_id', requestId)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Supabase update __quote_requests failed: ${error.message}`,
      );
    }

    this.logger.log(`Quote request ${requestId} status updated to ${status}`);
    return this.rowToQuoteRequest(data);
  }

  async assignQuoteRequest(
    requestId: string,
    staffId: string,
  ): Promise<QuoteRequest> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('__quote_requests')
      .select()
      .eq('qr_id', requestId)
      .single();

    if (fetchError || !existing) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote request ${requestId} not found`,
      });
    }

    const updates: Record<string, any> = {
      qr_assigned_to: staffId,
      qr_updated_at: new Date().toISOString(),
    };

    if (existing.qr_status === 'pending') {
      updates.qr_status = 'in_review';
    }

    const { data, error } = await this.supabase
      .from('__quote_requests')
      .update(updates)
      .eq('qr_id', requestId)
      .select()
      .single();

    if (error) {
      throw new Error(
        `Supabase update __quote_requests failed: ${error.message}`,
      );
    }

    this.logger.log(`Quote request ${requestId} assigned to ${staffId}`);
    return this.rowToQuoteRequest(data);
  }

  async createQuote(
    requestId: string,
    quoteData: Omit<Quote, 'id' | 'quoteRequestId' | 'createdAt' | 'status'>,
  ): Promise<Quote> {
    // Verify request exists
    const { data: existing, error: fetchError } = await this.supabase
      .from('__quote_requests')
      .select()
      .eq('qr_id', requestId)
      .single();

    if (fetchError || !existing) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote request ${requestId} not found`,
      });
    }

    this.validateQuote(quoteData);

    const quoteId = this.generateQuoteId();
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('__quotes')
      .insert({
        qt_id: quoteId,
        qt_quote_request_id: requestId,
        qt_quoted_items: quoteData.quotedItems,
        qt_subtotal: quoteData.subtotal,
        qt_taxes: quoteData.taxes,
        qt_shipping: quoteData.shipping,
        qt_discount: quoteData.discount ?? null,
        qt_total: quoteData.total,
        qt_valid_until: quoteData.validUntil.toISOString(),
        qt_terms: quoteData.terms,
        qt_created_by: quoteData.createdBy,
        qt_status: 'draft',
        qt_created_at: now,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase insert __quotes failed: ${error.message}`);
    }

    // Update request: link quote, set status to 'quoted'
    await this.supabase
      .from('__quote_requests')
      .update({
        qr_quote_id: quoteId,
        qr_status: 'quoted',
        qr_updated_at: new Date().toISOString(),
      })
      .eq('qr_id', requestId);

    const quote = this.rowToQuote(data);
    this.logger.log(`Quote created: ${quote.id} for request ${requestId}`);
    return quote;
  }

  async getQuote(quoteId: string): Promise<Quote | null> {
    const { data, error } = await this.supabase
      .from('__quotes')
      .select()
      .eq('qt_id', quoteId)
      .single();

    if (error || !data) return null;
    return this.rowToQuote(data);
  }

  async sendQuote(quoteId: string): Promise<Quote> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('__quotes')
      .select()
      .eq('qt_id', quoteId)
      .single();

    if (fetchError || !existing) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote ${quoteId} not found`,
      });
    }

    const { data, error } = await this.supabase
      .from('__quotes')
      .update({ qt_status: 'sent' })
      .eq('qt_id', quoteId)
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase update __quotes failed: ${error.message}`);
    }

    this.logger.log(`Quote ${quoteId} sent to customer`);
    return this.rowToQuote(data);
  }

  async acceptQuote(quoteId: string): Promise<Quote> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('__quotes')
      .select()
      .eq('qt_id', quoteId)
      .single();

    if (fetchError || !existing) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote ${quoteId} not found`,
      });
    }

    const quote = this.rowToQuote(existing);

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

    const { data, error } = await this.supabase
      .from('__quotes')
      .update({ qt_status: 'accepted' })
      .eq('qt_id', quoteId)
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase update __quotes failed: ${error.message}`);
    }

    // Update related request
    await this.supabase
      .from('__quote_requests')
      .update({
        qr_status: 'accepted',
        qr_updated_at: new Date().toISOString(),
      })
      .eq('qr_id', quote.quoteRequestId);

    this.logger.log(`Quote ${quoteId} accepted by customer`);
    return this.rowToQuote(data);
  }

  async rejectQuote(quoteId: string, reason?: string): Promise<Quote> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('__quotes')
      .select()
      .eq('qt_id', quoteId)
      .single();

    if (fetchError || !existing) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.QUOTE_NOT_FOUND,
        message: `Quote ${quoteId} not found`,
      });
    }

    const { data, error } = await this.supabase
      .from('__quotes')
      .update({ qt_status: 'rejected' })
      .eq('qt_id', quoteId)
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase update __quotes failed: ${error.message}`);
    }

    // Update related request
    const requestUpdates: Record<string, any> = {
      qr_status: 'rejected',
      qr_updated_at: new Date().toISOString(),
    };

    if (reason) {
      const currentNotes = existing.qt_quote_request_id
        ? (
            await this.supabase
              .from('__quote_requests')
              .select('qr_notes')
              .eq('qr_id', existing.qt_quote_request_id)
              .single()
          ).data?.qr_notes || ''
        : '';
      requestUpdates.qr_notes = `${currentNotes}\nReject reason: ${reason}`;
    }

    await this.supabase
      .from('__quote_requests')
      .update(requestUpdates)
      .eq('qr_id', existing.qt_quote_request_id);

    this.logger.log(
      `Quote ${quoteId} rejected by customer${reason ? `: ${reason}` : ''}`,
    );
    return this.rowToQuote(data);
  }

  async getQuoteStats(period?: { start: Date; end: Date }) {
    let requestQuery = this.supabase
      .from('__quote_requests')
      .select('qr_status, qr_created_at');
    let quoteQuery = this.supabase
      .from('__quotes')
      .select('qt_status, qt_total, qt_created_at');

    if (period) {
      const startIso = period.start.toISOString();
      const endIso = period.end.toISOString();
      requestQuery = requestQuery
        .gte('qr_created_at', startIso)
        .lte('qr_created_at', endIso);
      quoteQuery = quoteQuery
        .gte('qt_created_at', startIso)
        .lte('qt_created_at', endIso);
    }

    const [requestsResult, quotesResult] = await Promise.all([
      requestQuery,
      quoteQuery,
    ]);

    const requests = requestsResult.data ?? [];
    const quotes = quotesResult.data ?? [];

    const totalRequests = requests.length;
    const totalQuotes = quotes.length;
    const acceptedQuotes = quotes.filter(
      (q) => q.qt_status === 'accepted',
    ).length;
    const rejectedQuotes = quotes.filter(
      (q) => q.qt_status === 'rejected',
    ).length;
    const pendingRequests = requests.filter(
      (r) => r.qr_status === 'pending',
    ).length;

    const conversionRate =
      totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0;

    const totalQuoteValue = quotes
      .filter((q) => q.qt_status === 'accepted')
      .reduce((sum, q) => sum + parseFloat(q.qt_total), 0);

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

  // ---------------------------------------------------------------------------
  // Validation (unchanged)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Helpers (unchanged)
  // ---------------------------------------------------------------------------

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
