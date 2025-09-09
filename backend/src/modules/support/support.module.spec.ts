import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SupportModule } from './support.module';
import { ContactService } from './services/contact.service';
import { ReviewService } from './services/review.service';
import { QuoteService } from './services/quote.service';
import { FaqService } from './services/faq.service';
import { LegalService } from './services/legal.service';
import { ClaimService } from './services/claim.service';
import { NotificationService } from './services/notification.service';
import { SupportConfigService } from './services/support-config.service';
import { SupportAnalyticsService } from './services/support-analytics.service';

describe('SupportModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        SupportModule,
      ],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  describe('Services', () => {
    it('should provide ContactService', () => {
      const contactService = module.get<ContactService>(ContactService);
      expect(contactService).toBeDefined();
      expect(contactService).toBeInstanceOf(ContactService);
    });

    it('should provide ReviewService', () => {
      const reviewService = module.get<ReviewService>(ReviewService);
      expect(reviewService).toBeDefined();
      expect(reviewService).toBeInstanceOf(ReviewService);
    });

    it('should provide QuoteService', () => {
      const quoteService = module.get<QuoteService>(QuoteService);
      expect(quoteService).toBeDefined();
      expect(quoteService).toBeInstanceOf(QuoteService);
    });

    it('should provide FaqService', () => {
      const faqService = module.get<FaqService>(FaqService);
      expect(faqService).toBeDefined();
      expect(faqService).toBeInstanceOf(FaqService);
    });

    it('should provide LegalService', () => {
      const legalService = module.get<LegalService>(LegalService);
      expect(legalService).toBeDefined();
      expect(legalService).toBeInstanceOf(LegalService);
    });

    it('should provide ClaimService', () => {
      const claimService = module.get<ClaimService>(ClaimService);
      expect(claimService).toBeDefined();
      expect(claimService).toBeInstanceOf(ClaimService);
    });

    it('should provide NotificationService', () => {
      const notificationService =
        module.get<NotificationService>(NotificationService);
      expect(notificationService).toBeDefined();
      expect(notificationService).toBeInstanceOf(NotificationService);
    });

    it('should provide SupportConfigService', () => {
      const configService =
        module.get<SupportConfigService>(SupportConfigService);
      expect(configService).toBeDefined();
      expect(configService).toBeInstanceOf(SupportConfigService);
    });

    it('should provide SupportAnalyticsService', () => {
      const analyticsService = module.get<SupportAnalyticsService>(
        SupportAnalyticsService,
      );
      expect(analyticsService).toBeDefined();
      expect(analyticsService).toBeInstanceOf(SupportAnalyticsService);
    });
  });

  describe('Configuration', () => {
    it('should load support configuration', () => {
      const configService =
        module.get<SupportConfigService>(SupportConfigService);
      const config = configService.getConfig();

      expect(config).toBeDefined();
      expect(config.contactEmail).toBeDefined();
      expect(config.businessHours).toBeDefined();
      expect(config.notifications).toBeDefined();
      expect(config.responseTimes).toBeDefined();
    });

    it('should validate business hours', () => {
      const configService =
        module.get<SupportConfigService>(SupportConfigService);
      const isWithinHours = configService.isWithinBusinessHours();

      expect(typeof isWithinHours).toBe('boolean');
    });
  });

  describe('Integration', () => {
    it('should handle contact form submission flow', async () => {
      const contactService = module.get<ContactService>(ContactService);

      const contactData = {
        name: 'Test User',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test message content',
        priority: 'normal' as const,
        category: 'general' as const,
      };

      const ticket = await contactService.submitContactForm(contactData);

      expect(ticket).toBeDefined();
      expect(ticket.id).toBeDefined();
      expect(ticket.status).toBe('open');
      expect(ticket.contactData.name).toBe(contactData.name);
    });

    it('should handle review submission flow', async () => {
      const reviewService = module.get<ReviewService>(ReviewService);

      const reviewData = {
        customerId: 'customer-123',
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        rating: 5,
        title: 'Great product',
        comment: 'Really satisfied with the quality',
        verified: false,
      };

      const review = await reviewService.submitReview(reviewData);

      expect(review).toBeDefined();
      expect(review.id).toBeDefined();
      expect(review.rating).toBe(5);
      expect(review.moderated).toBeDefined();
    });

    it('should handle quote request flow', async () => {
      const quoteService = module.get<QuoteService>(QuoteService);

      const quoteRequestData = {
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        projectDescription: 'Test project description',
        requiredProducts: [
          { name: 'Product A', quantity: 2 },
          { name: 'Product B', quantity: 1 },
        ],
        priority: 'normal' as const,
      };

      const quoteRequest =
        await quoteService.submitQuoteRequest(quoteRequestData);

      expect(quoteRequest).toBeDefined();
      expect(quoteRequest.id).toBeDefined();
      expect(quoteRequest.status).toBe('pending');
      expect(quoteRequest.requiredProducts).toHaveLength(2);
    });

    it('should handle claim submission flow', async () => {
      const claimService = module.get<ClaimService>(ClaimService);

      const claimData = {
        customerId: 'customer-123',
        customerName: 'Test Customer',
        customerEmail: 'customer@example.com',
        type: 'defective_product' as const,
        priority: 'high' as const,
        title: 'Defective product received',
        description: 'The product received is damaged',
        expectedResolution: 'Replacement or refund',
      };

      const claim = await claimService.submitClaim(claimData);

      expect(claim).toBeDefined();
      expect(claim.id).toBeDefined();
      expect(claim.status).toBe('open');
      expect(claim.timeline).toHaveLength(1);
    });
  });

  describe('Analytics', () => {
    it('should generate analytics data', async () => {
      const analyticsService = module.get<SupportAnalyticsService>(
        SupportAnalyticsService,
      );

      const analytics = await analyticsService.getAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.overview).toBeDefined();
      expect(analytics.departmentStats).toBeDefined();
      expect(analytics.trends).toBeDefined();
      expect(analytics.performanceMetrics).toBeDefined();
    });

    it('should generate KPIs', async () => {
      const analyticsService = module.get<SupportAnalyticsService>(
        SupportAnalyticsService,
      );

      const kpis = await analyticsService.getKPIs();

      expect(kpis).toBeDefined();
      expect(typeof kpis['Tickets actifs']).toBe('number');
      expect(typeof kpis['Satisfaction client']).toBe('number');
    });
  });

  describe('FAQ Management', () => {
    it('should initialize default FAQs and categories', () => {
      const faqService = module.get<FaqService>(FaqService);

      const categories = faqService.getAllCategories(true);
      expect(categories).resolves.toHaveLength(6); // Default categories
    });

    it('should handle FAQ search', async () => {
      const faqService = module.get<FaqService>(FaqService);

      const results = await faqService.getAllFAQs({ search: 'commande' });
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Legal Documents', () => {
    it('should initialize default legal documents', async () => {
      const legalService = module.get<LegalService>(LegalService);

      const documents = await legalService.getAllDocuments({ published: true });
      expect(documents).toBeDefined();
      expect(documents.length).toBeGreaterThan(0);
    });

    it('should retrieve document by type', async () => {
      const legalService = module.get<LegalService>(LegalService);

      const termsDoc = await legalService.getDocumentByType('terms');
      expect(termsDoc).toBeDefined();
      expect(termsDoc?.type).toBe('terms');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid contact data', async () => {
      const contactService = module.get<ContactService>(ContactService);

      const invalidData = {
        name: '',
        email: 'invalid-email',
        subject: '',
        message: 'Short',
        priority: 'normal' as const,
        category: 'general' as const,
      };

      await expect(
        contactService.submitContactForm(invalidData),
      ).rejects.toThrow();
    });

    it('should handle invalid review data', async () => {
      const reviewService = module.get<ReviewService>(ReviewService);

      const invalidData = {
        customerId: '',
        customerName: '',
        customerEmail: 'invalid-email',
        rating: 0,
        title: '',
        comment: '',
        verified: false,
      };

      await expect(reviewService.submitReview(invalidData)).rejects.toThrow();
    });
  });
});
