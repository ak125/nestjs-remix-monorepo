// Types génériques pour le module Support
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimestampedEntity extends BaseEntity {
  createdBy?: string;
  updatedBy?: string;
}

export interface SupportEntity extends TimestampedEntity {
  status: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

// Types de configuration
export interface SupportModuleConfig {
  contact: {
    autoResponse: boolean;
    maxAttachments: number;
    allowedFileTypes: string[];
  };
  reviews: {
    moderationEnabled: boolean;
    autoPublish: boolean;
    maxImages: number;
  };
  quotes: {
    validityDays: number;
    autoReminders: boolean;
    maxProducts: number;
  };
  claims: {
    autoEscalationHours: number;
    maxTimelineEntries: number;
    requireResolution: boolean;
  };
  faq: {
    maxCategories: number;
    enableSearch: boolean;
    trackViews: boolean;
  };
  legal: {
    enableVersioning: boolean;
    maxVersions: number;
    requireAcceptance: boolean;
  };
}

// Types d'événements
export interface SupportEvent {
  type:
    | 'contact_created'
    | 'review_submitted'
    | 'quote_requested'
    | 'claim_opened'
    | 'faq_viewed'
    | 'document_updated';
  entityId: string;
  userId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Types de notification
export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  channels: ('email' | 'sms' | 'push' | 'webhook')[];
}

export interface NotificationContext {
  template: string;
  recipient: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    language?: string;
  };
  variables: Record<string, string>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
}

// Types d'analytics
export interface MetricPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface SupportMetrics {
  tickets: {
    total: number;
    open: number;
    resolved: number;
    averageResponseTime: number;
  };
  reviews: {
    total: number;
    averageRating: number;
    pending: number;
    published: number;
  };
  quotes: {
    requests: number;
    sent: number;
    accepted: number;
    conversionRate: number;
  };
  claims: {
    total: number;
    open: number;
    resolved: number;
    escalated: number;
  };
  satisfaction: {
    averageRating: number;
    responseRate: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export interface PerformanceMetrics {
  responseTime: {
    first: number;
    average: number;
    p95: number;
  };
  resolution: {
    rate: number;
    averageTime: number;
    slaCompliance: number;
  };
  escalation: {
    rate: number;
    averageTime: number;
    reasons: Record<string, number>;
  };
  satisfaction: {
    rating: number;
    feedback: {
      positive: number;
      negative: number;
      neutral: number;
    };
  };
}

// Types de filtres
export interface BaseFilters {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
}

export interface ContactFilters extends BaseFilters {
  category?: string;
  customerId?: string;
}

export interface ReviewFilters extends BaseFilters {
  rating?: number;
  verified?: boolean;
  published?: boolean;
  productId?: string;
  customerId?: string;
}

export interface QuoteFilters extends BaseFilters {
  type?: 'request' | 'quote';
  customerId?: string;
}

export interface ClaimFilters extends BaseFilters {
  type?: string;
  customerId?: string;
  resolved?: boolean;
}

export interface FaqFilters {
  category?: string;
  published?: boolean;
  tags?: string[];
  search?: string;
}

export interface LegalFilters {
  type?: string;
  published?: boolean;
  language?: string;
}

// Types de validation
export interface ValidationRule {
  field: string;
  type: 'required' | 'email' | 'phone' | 'url' | 'length' | 'pattern';
  value?: any;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

// Types de workflow
export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  action: string;
  conditions?: Record<string, any>;
  nextSteps: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  entityType: 'contact' | 'review' | 'quote' | 'claim';
  steps: WorkflowStep[];
  triggers: string[];
}

// Types d'intégration
export interface ExternalIntegration {
  id: string;
  name: string;
  type: 'webhook' | 'api' | 'email' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
  lastSync?: Date;
}

export interface WebhookPayload {
  event: string;
  entityType: string;
  entityId: string;
  data: Record<string, any>;
  timestamp: Date;
  signature: string;
}

// Types d'export
export interface ExportRequest {
  entityType: 'contacts' | 'reviews' | 'quotes' | 'claims' | 'faq' | 'legal';
  format: 'csv' | 'excel' | 'pdf' | 'json';
  filters?: BaseFilters;
  fields?: string[];
  includeMetadata?: boolean;
}

export interface ExportResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url?: string;
  error?: string;
  createdAt: Date;
  expiresAt: Date;
}

// Types d'audit
export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId: string;
  userIp: string;
  userAgent: string;
  timestamp: Date;
}

// Types de cache
export interface CacheOptions {
  key: string;
  ttl: number; // seconds
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  keys: string[];
}

// Types d'erreur
export interface SupportError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  stack?: string;
}

export interface ErrorResponse {
  error: SupportError;
  requestId: string;
  path: string;
  method: string;
}

// Types de pagination
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Types de recherche
export interface SearchOptions {
  query: string;
  entityTypes?: string[];
  filters?: Record<string, any>;
  fuzzy?: boolean;
  highlighting?: boolean;
}

export interface SearchResult<T = any> {
  entity: T;
  score: number;
  highlights?: Record<string, string[]>;
}

export interface SearchResponse<T = any> {
  results: SearchResult<T>[];
  total: number;
  took: number; // milliseconds
  facets?: Record<string, Record<string, number>>;
}

// Types de planification
export interface ScheduledTask {
  id: string;
  name: string;
  schedule: string; // cron expression
  action: string;
  params?: Record<string, any>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface TaskExecution {
  taskId: string;
  startedAt: Date;
  finishedAt?: Date;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

// Ré-export des types des services
// Note: Ces types sont désormais définis directement dans ce fichier
// pour éviter les dépendances circulaires

// export {
//   ContactFormData,
//   ContactTicket,
//   ContactStats,
// } from './services/contact.service';
// export {
//   ReviewData,
//   ReviewFilters as ReviewServiceFilters,
//   ReviewStats,
// } from './services/review.service';
// export {
//   QuoteRequest,
//   Quote,
//   QuotedItem,
//   QuoteProduct,
// } from './services/quote.service';
// export { FAQ, FAQCategory, FAQStats } from './services/faq.service';
// export { LegalDocument, LegalDocumentVersion } from './services/legal.service';
// export {
//   Claim,
//   ClaimResolution,
//   ClaimTimelineEntry,
//   ClaimStats,
// } from './services/claim.service';
// export {
//   NotificationPayload,
//   NotificationAction,
// } from './services/notification.service';
// export { SupportConfig } from './services/support-config.service';
// export {
//   SupportAnalytics,
//   AnalyticsPeriod,
//   SupportMetrics,
// } from './services/support-analytics.service';
