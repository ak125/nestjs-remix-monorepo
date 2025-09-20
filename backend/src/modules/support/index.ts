// Module principal
export { SupportModule } from './support.module';

// Services
export { ContactService } from './services/contact.service';
export { ReviewService } from './services/review.service';
export { QuoteService } from './services/quote.service';
export { FaqService } from './services/faq.service';
export { LegalService } from './services/legal.service';
export { ClaimService } from './services/claim.service';
export { NotificationService } from './services/notification.service';
export { SupportConfigService } from './services/support-config.service';
export { SupportAnalyticsService } from './services/support-analytics.service';

// Contrôleurs
export { ContactController } from './controllers/contact.controller';
export { ReviewController } from './controllers/review.controller';
export { QuoteController } from './controllers/quote.controller';
export { FaqController } from './controllers/faq.controller';
export { LegalController } from './controllers/legal.controller';
export { ClaimController } from './controllers/claim.controller';
export { SupportAnalyticsController } from './controllers/support-analytics.controller';

// Types
export * from './types';

// Constants
export const SUPPORT_MODULE_VERSION = '1.0.0';
export const SUPPORT_API_PREFIX = 'api/support';

export const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const SUPPORT_STATUSES = {
  CONTACT: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
  REVIEW: ['pending', 'approved', 'rejected', 'published'],
  QUOTE: ['pending', 'in_review', 'quoted', 'accepted', 'rejected', 'expired'],
  CLAIM: [
    'open',
    'investigating',
    'pending_customer',
    'pending_supplier',
    'resolved',
    'closed',
    'rejected',
  ],
  FAQ: ['draft', 'published', 'archived'],
  LEGAL: ['draft', 'review', 'published', 'archived'],
} as const;

export const SUPPORT_CATEGORIES = {
  CONTACT: ['general', 'technical', 'billing', 'complaint', 'suggestion'],
  CLAIM: [
    'defective_product',
    'wrong_product',
    'missing_product',
    'delivery_issue',
    'billing_issue',
    'service_complaint',
    'other',
  ],
  LEGAL: [
    'terms',
    'privacy',
    'cookies',
    'gdpr',
    'returns',
    'shipping',
    'warranty',
    'custom',
  ],
} as const;

export const SUPPORT_EVENTS = {
  CONTACT_CREATED: 'support.contact.created',
  CONTACT_UPDATED: 'support.contact.updated',
  CONTACT_RESOLVED: 'support.contact.resolved',

  REVIEW_SUBMITTED: 'support.review.submitted',
  REVIEW_MODERATED: 'support.review.moderated',
  REVIEW_PUBLISHED: 'support.review.published',

  QUOTE_REQUESTED: 'support.quote.requested',
  QUOTE_CREATED: 'support.quote.created',
  QUOTE_ACCEPTED: 'support.quote.accepted',
  QUOTE_REJECTED: 'support.quote.rejected',

  CLAIM_OPENED: 'support.claim.opened',
  CLAIM_ESCALATED: 'support.claim.escalated',
  CLAIM_RESOLVED: 'support.claim.resolved',

  FAQ_VIEWED: 'support.faq.viewed',
  FAQ_VOTED: 'support.faq.voted',

  LEGAL_ACCEPTED: 'support.legal.accepted',
  LEGAL_UPDATED: 'support.legal.updated',
} as const;

export const SUPPORT_NOTIFICATIONS = {
  TEMPLATES: {
    CONTACT_CONFIRMATION: 'contact_confirmation',
    CONTACT_ASSIGNED: 'contact_assigned',
    CONTACT_RESOLVED: 'contact_resolved',

    REVIEW_SUBMITTED: 'review_submitted',
    REVIEW_APPROVED: 'review_approved',
    REVIEW_REJECTED: 'review_rejected',

    QUOTE_REQUESTED: 'quote_requested',
    QUOTE_READY: 'quote_ready',
    QUOTE_ACCEPTED: 'quote_accepted',

    CLAIM_OPENED: 'claim_opened',
    CLAIM_UPDATED: 'claim_updated',
    CLAIM_RESOLVED: 'claim_resolved',
  },
  CHANNELS: ['email', 'sms', 'push', 'webhook'],
} as const;

export const SUPPORT_DEFAULTS = {
  PAGINATION: {
    PAGE: 1,
    LIMIT: 20,
    MAX_LIMIT: 100,
  },
  CACHE: {
    TTL: 300, // 5 minutes
    FAQ_TTL: 3600, // 1 hour
    LEGAL_TTL: 86400, // 24 hours
  },
  FILES: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'],
    MAX_COUNT: 5,
  },
  RESPONSE_TIMES: {
    URGENT: 15, // minutes
    HIGH: 60,
    NORMAL: 240,
    LOW: 1440,
  },
} as const;
