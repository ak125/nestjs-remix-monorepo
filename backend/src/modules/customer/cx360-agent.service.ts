import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * IA-CX360 - Agent Expérience Client 360° (v2.26.0)
 *
 * Lead Agent - Customer Squad
 * Budget: €48K (Dev €32K + APIs NLP €8K + Chatbot €5K + Review APIs €3K)
 * ROI: +€95K/an (réduction churn -2%, satisfaction +20%, support -30% tickets)
 *
 * 5 Responsabilités:
 * 1. Multi-Channel Reviews Aggregator - Google, Trustpilot, Marketplaces
 * 2. NPS/CSAT Orchestrator - Surveys automatisés, closed-loop feedback
 * 3. Voice of Customer Analytics - NLP multi-source, themes, trends
 * 4. Support Automation Hub - Chatbot IA, routing intelligent
 * 5. Customer Journey Analytics - Touchpoints, friction, attribution
 *
 * KPIs:
 * - nps-score: >50
 * - csat-avg: >4.2/5
 * - review-sentiment-positive: >80%
 * - support-first-response-time: <2h
 * - voc-action-rate: >60%
 */

// ==================== INTERFACES ====================

export interface Review {
  id: string;
  source: ReviewSource;
  rating: number; // 1-5
  title?: string;
  content: string;
  author: string;
  date: Date;
  language: string;
  sentiment: SentimentAnalysis;
  themes: string[];
  responded: boolean;
  responseDate?: Date;
  responseContent?: string;
  customerId?: string;
  orderId?: string;
}

export type ReviewSource =
  | 'GOOGLE_MY_BUSINESS'
  | 'TRUSTPILOT'
  | 'AMAZON'
  | 'EBAY'
  | 'CDISCOUNT'
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'TWITTER';

export interface SentimentAnalysis {
  score: number; // -1 to 1
  label: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  confidence: number; // 0-1
  emotions?: string[]; // "frustrated", "happy", "disappointed"
}

export interface ReviewAggregation {
  period: string;
  totalReviews: number;
  averageRating: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  bySource: Record<ReviewSource, { count: number; avgRating: number }>;
  topThemes: { theme: string; count: number; sentiment: number }[];
  reputationScore: number; // 0-100
  trend: 'UP' | 'STABLE' | 'DOWN';
}

export interface NPSSurvey {
  id: string;
  customerId: string;
  customerEmail: string;
  orderId: string;
  sentAt: Date;
  respondedAt?: Date;
  score?: number; // 0-10
  category?: 'DETRACTOR' | 'PASSIVE' | 'PROMOTER';
  feedback?: string;
  followUpSent: boolean;
  closedLoop?: ClosedLoopAction;
}

export interface ClosedLoopAction {
  triggeredAt: Date;
  actionType: 'CONTACT' | 'OFFER' | 'REFERRAL';
  assignedTo?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  resolution?: string;
  npsAfter?: number; // Relance NPS score
}

export interface NPSResult {
  period: string;
  totalResponses: number;
  responseRate: number;
  npsScore: number; // -100 to 100
  breakdown: {
    promoters: { count: number; percentage: number };
    passives: { count: number; percentage: number };
    detractors: { count: number; percentage: number };
  };
  trend: 'UP' | 'STABLE' | 'DOWN';
  vsLastPeriod: number;
  benchmark: {
    sector: string;
    average: number;
    ourPercentile: number;
  };
}

export interface CSATResult {
  period: string;
  totalResponses: number;
  averageScore: number; // 1-5
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  byCategory: Record<string, number>; // "delivery", "product", "support"
  trend: 'UP' | 'STABLE' | 'DOWN';
}

export interface VoCInsights {
  period: string;
  sourcesAnalyzed: number;
  totalMentions: number;
  topPositiveThemes: ThemeInsight[];
  topPainPoints: ThemeInsight[];
  emergingTrends: ThemeInsight[];
  wordCloud: { word: string; count: number }[];
  sentimentOverTime: { date: string; sentiment: number }[];
  recommendations: VoCRecommendation[];
}

export interface ThemeInsight {
  theme: string;
  mentions: number;
  sentiment: number;
  trend: 'UP' | 'STABLE' | 'DOWN';
  examples: string[];
}

export interface VoCRecommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'QUICK_WIN' | 'MEDIUM_TERM' | 'STRATEGIC';
  theme: string;
  recommendation: string;
  expectedImpact: string;
  owner: string; // "IA-CPO", "IA-CRM", etc.
}

export interface ChatbotConversation {
  id: string;
  customerId?: string;
  sessionId: string;
  startedAt: Date;
  endedAt?: Date;
  messages: ChatMessage[];
  resolved: boolean;
  escalated: boolean;
  escalationReason?: string;
  csatScore?: number;
  topics: string[];
}

export interface ChatMessage {
  id: string;
  timestamp: Date;
  sender: 'USER' | 'BOT' | 'AGENT';
  content: string;
  intent?: string;
  sentiment?: SentimentAnalysis;
  suggestedResponses?: string[];
}

export interface EscalationSignal {
  type: 'NEGATIVE_SENTIMENT' | 'URGENT_KEYWORDS' | 'LOOP_DETECTED' | 'VIP_CUSTOMER';
  confidence: number;
  details: string;
}

export interface SupportTicket {
  id: string;
  customerId: string;
  orderId?: string;
  channel: 'EMAIL' | 'CHAT' | 'PHONE' | 'SOCIAL';
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  createdAt: Date;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  assignedTo?: string;
  suggestedResponse?: string;
  escalationRisk: number; // 0-100
}

export interface CustomerJourney {
  customerId: string;
  touchpoints: JourneyTouchpoint[];
  currentStage: 'ACQUISITION' | 'CONSIDERATION' | 'PURCHASE' | 'POST_PURCHASE' | 'LOYALTY';
  satisfactionByStage: Record<string, number>;
  frictionPoints: FrictionPoint[];
  overallSatisfaction: number;
  churnRisk: number;
}

export interface JourneyTouchpoint {
  timestamp: Date;
  stage: string;
  channel: string;
  action: string;
  sentiment?: number;
  outcome: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
}

export interface FrictionPoint {
  stage: string;
  description: string;
  frequency: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
}

export interface ReviewAlert {
  id: string;
  review: Review;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  suggestedResponse: string;
  status: 'PENDING' | 'RESPONDED' | 'ESCALATED';
  createdAt: Date;
}

export interface CustomerHealthReport {
  period: string;
  nps: NPSResult;
  csat: CSATResult;
  reviewAggregation: ReviewAggregation;
  supportMetrics: {
    ticketVolume: number;
    avgFirstResponseTime: number;
    avgResolutionTime: number;
    selfServiceRate: number;
    csatSupport: number;
  };
  topIssues: string[];
  highlights: string[];
  recommendations: string[];
}

// Mock interfaces for external services
interface ReviewAPIService {
  fetchGoogleReviews(): Promise<Review[]>;
  fetchTrustpilotReviews(): Promise<Review[]>;
  fetchMarketplaceReviews(source: ReviewSource): Promise<Review[]>;
  postResponse(reviewId: string, source: ReviewSource, response: string): Promise<void>;
}

interface NLPService {
  analyzeSentiment(text: string, language: string): Promise<SentimentAnalysis>;
  extractThemes(texts: string[]): Promise<string[]>;
  detectLanguage(text: string): Promise<string>;
}

interface SurveyService {
  sendNPSSurvey(customerId: string, email: string, orderId: string): Promise<string>;
  sendCSATSurvey(customerId: string, email: string, interactionId: string): Promise<string>;
  getResponses(surveyType: string, period: string): Promise<any[]>;
}

interface ChatbotService {
  processMessage(sessionId: string, message: string, context: any): Promise<ChatMessage>;
  getSuggestedResponses(intent: string, context: any): Promise<string[]>;
  escalateToAgent(sessionId: string, reason: string): Promise<void>;
}

interface CRMIntegrationService {
  getCustomerSegment(customerId: string): Promise<string>;
  getCustomerValue(customerId: string): Promise<number>;
  isVIPCustomer(customerId: string): Promise<boolean>;
  notifyChurnRisk(customerId: string, score: number): Promise<void>;
}

// ==================== MAIN SERVICE ====================

@Injectable()
export class CX360AgentService {
  private readonly logger = new Logger(CX360AgentService.name);

  // External services (to be injected)
  private reviewAPI: ReviewAPIService;
  private nlpService: NLPService;
  private surveyService: SurveyService;
  private chatbotService: ChatbotService;
  private crmIntegration: CRMIntegrationService;

  // Configuration
  private readonly config = {
    nps: {
      surveyDelayDays: 7, // J+7 after delivery
      reminderDelayDays: 3,
      promoterThreshold: 9,
      detractorThreshold: 6,
      targetScore: 50,
    },
    csat: {
      targetScore: 4.2,
      scaleMax: 5,
    },
    reviews: {
      negativeThreshold: 2, // Stars
      alertThreshold: 3, // Stars for attention
      responseTimeTarget: 24, // hours
    },
    support: {
      firstResponseTarget: 2, // hours
      selfServiceTarget: 0.6, // 60%
      escalationKeywords: ['avocat', 'lawyer', 'rembourser', 'refund', 'arnaque', 'scam'],
    },
    voc: {
      minMentions: 5, // Minimum mentions to be a trend
      actionRateTarget: 0.6, // 60%
    },
  };

  // Urgent keywords for escalation
  private readonly urgentKeywords = [
    'avocat',
    'lawyer',
    'juridique',
    'legal',
    'rembourser',
    'refund',
    'arnaque',
    'scam',
    'fraude',
    'fraud',
    'plainte',
    'complaint',
    'urgent',
    'urgence',
  ];

  constructor() {
    this.logger.log('IA-CX360 (Customer Experience 360° Agent) initialized');
  }

  // ==================== 1. MULTI-CHANNEL REVIEWS AGGREGATOR ====================

  /**
   * Aggregate reviews from all channels
   * Runs daily at 7am
   */
  @Cron('0 7 * * *')
  async aggregateReviews(): Promise<ReviewAggregation> {
    const period = this.getCurrentPeriod();
    this.logger.log(`📝 Aggregating reviews for ${period}`);

    // Fetch from all sources
    const allReviews: Review[] = [];

    const googleReviews = await this.reviewAPI.fetchGoogleReviews();
    allReviews.push(...googleReviews);

    const trustpilotReviews = await this.reviewAPI.fetchTrustpilotReviews();
    allReviews.push(...trustpilotReviews);

    // Fetch marketplace reviews
    for (const source of ['AMAZON', 'EBAY', 'CDISCOUNT'] as ReviewSource[]) {
      const marketplaceReviews = await this.reviewAPI.fetchMarketplaceReviews(source);
      allReviews.push(...marketplaceReviews);
    }

    // Analyze sentiment for reviews without it
    for (const review of allReviews) {
      if (!review.sentiment) {
        review.sentiment = await this.nlpService.analyzeSentiment(
          review.content,
          review.language,
        );
      }
    }

    // Extract themes
    const themes = await this.nlpService.extractThemes(
      allReviews.map((r) => r.content),
    );

    // Calculate aggregation
    const aggregation = this.calculateReviewAggregation(allReviews, themes, period);

    // Process alerts for negative reviews
    const negativeReviews = allReviews.filter(
      (r) => r.rating <= this.config.reviews.negativeThreshold,
    );
    for (const review of negativeReviews) {
      await this.createReviewAlert(review);
    }

    this.logger.log(
      `✅ Aggregated ${allReviews.length} reviews, sentiment ${(aggregation.sentimentBreakdown.positive * 100).toFixed(0)}% positive`,
    );

    return aggregation;
  }

  private calculateReviewAggregation(
    reviews: Review[],
    themes: string[],
    period: string,
  ): ReviewAggregation {
    const totalReviews = reviews.length;
    if (totalReviews === 0) {
      return this.getEmptyAggregation(period);
    }

    // Average rating
    const averageRating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

    // Sentiment breakdown
    const positive = reviews.filter((r) => r.sentiment.label === 'POSITIVE').length;
    const neutral = reviews.filter((r) => r.sentiment.label === 'NEUTRAL').length;
    const negative = reviews.filter((r) => r.sentiment.label === 'NEGATIVE').length;

    // By source
    const bySource: Record<ReviewSource, { count: number; avgRating: number }> = {} as any;
    const sources = [...new Set(reviews.map((r) => r.source))];
    for (const source of sources) {
      const sourceReviews = reviews.filter((r) => r.source === source);
      bySource[source] = {
        count: sourceReviews.length,
        avgRating: sourceReviews.reduce((sum, r) => sum + r.rating, 0) / sourceReviews.length,
      };
    }

    // Top themes with sentiment
    const themeCounts = new Map<string, { count: number; sentimentSum: number }>();
    for (const review of reviews) {
      for (const theme of review.themes || []) {
        const existing = themeCounts.get(theme) || { count: 0, sentimentSum: 0 };
        themeCounts.set(theme, {
          count: existing.count + 1,
          sentimentSum: existing.sentimentSum + review.sentiment.score,
        });
      }
    }

    const topThemes = Array.from(themeCounts.entries())
      .map(([theme, data]) => ({
        theme,
        count: data.count,
        sentiment: data.sentimentSum / data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Reputation score (weighted)
    const reputationScore = Math.round(
      averageRating * 15 + // Max 75 points from rating
      (positive / totalReviews) * 25, // Max 25 points from sentiment
    );

    return {
      period,
      totalReviews,
      averageRating,
      sentimentBreakdown: {
        positive: positive / totalReviews,
        neutral: neutral / totalReviews,
        negative: negative / totalReviews,
      },
      bySource,
      topThemes,
      reputationScore,
      trend: 'STABLE', // Would compare with previous period
    };
  }

  private getEmptyAggregation(period: string): ReviewAggregation {
    return {
      period,
      totalReviews: 0,
      averageRating: 0,
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
      bySource: {} as any,
      topThemes: [],
      reputationScore: 0,
      trend: 'STABLE',
    };
  }

  /**
   * Create alert for negative review
   */
  private async createReviewAlert(review: Review): Promise<ReviewAlert> {
    const isVIP = review.customerId
      ? await this.crmIntegration.isVIPCustomer(review.customerId)
      : false;

    const severity: ReviewAlert['severity'] =
      review.rating <= 1 || isVIP ? 'CRITICAL' : 'WARNING';

    const suggestedResponse = await this.generateReviewResponse(review);

    const alert: ReviewAlert = {
      id: `alert-${review.id}`,
      review,
      severity,
      suggestedResponse,
      status: 'PENDING',
      createdAt: new Date(),
    };

    this.logger.warn(
      `🚨 Review alert: ${review.source} - ${review.rating}★ - ${severity}`,
    );

    // Notify support team
    await this.notifyReviewAlert(alert);

    return alert;
  }

  private async generateReviewResponse(review: Review): Promise<string> {
    // Generate personalized response based on sentiment and themes
    const isNegative = review.sentiment.label === 'NEGATIVE';

    if (isNegative) {
      return `Bonjour ${review.author},

Nous vous remercions d'avoir pris le temps de partager votre expérience. Nous sommes sincèrement désolés que celle-ci n'ait pas été à la hauteur de vos attentes.

Votre satisfaction est notre priorité et nous souhaiterions comprendre plus en détail les difficultés rencontrées afin d'y apporter une solution.

Pourriez-vous nous contacter à support@example.com ou au 01 XX XX XX XX en mentionnant le numéro de référence ${review.orderId || 'votre commande'} ?

Nous restons à votre disposition.

L'équipe Service Client`;
    } else {
      return `Bonjour ${review.author},

Merci beaucoup pour votre retour positif ! Nous sommes ravis que votre expérience ait été satisfaisante.

Votre avis compte beaucoup pour nous et nous motive à maintenir notre niveau de service.

À très bientôt !

L'équipe`;
    }
  }

  private async notifyReviewAlert(alert: ReviewAlert): Promise<void> {
    this.logger.log(`📤 Notifying support team of ${alert.severity} review alert`);
    // TODO: Send notification via email/Slack
  }

  // ==================== 2. NPS/CSAT ORCHESTRATOR ====================

  /**
   * Send NPS surveys for recent deliveries
   * Runs daily at 10am
   */
  @Cron('0 10 * * *')
  async sendNPSSurveys(): Promise<number> {
    this.logger.log('📊 Sending NPS surveys for recent deliveries');

    // Get deliveries from J-7 that haven't received survey
    const deliveries = await this.getDeliveriesForSurvey();

    let sentCount = 0;
    for (const delivery of deliveries) {
      try {
        await this.surveyService.sendNPSSurvey(
          delivery.customerId,
          delivery.email,
          delivery.orderId,
        );
        sentCount++;
      } catch (error) {
        this.logger.error(`Failed to send NPS survey for order ${delivery.orderId}`);
      }
    }

    this.logger.log(`✅ Sent ${sentCount} NPS surveys`);
    return sentCount;
  }

  /**
   * Process NPS responses and trigger closed-loop
   */
  async processNPSResponse(response: NPSSurvey): Promise<void> {
    // Categorize response
    if (response.score !== undefined) {
      if (response.score >= this.config.nps.promoterThreshold) {
        response.category = 'PROMOTER';
        await this.handlePromoter(response);
      } else if (response.score <= this.config.nps.detractorThreshold) {
        response.category = 'DETRACTOR';
        await this.handleDetractor(response);
      } else {
        response.category = 'PASSIVE';
        await this.handlePassive(response);
      }
    }
  }

  private async handleDetractor(response: NPSSurvey): Promise<void> {
    this.logger.warn(`😟 Detractor detected: customer ${response.customerId}, score ${response.score}`);

    // Create churn alert
    await this.crmIntegration.notifyChurnRisk(response.customerId, 80);

    // Initiate closed-loop
    response.closedLoop = {
      triggeredAt: new Date(),
      actionType: 'CONTACT',
      status: 'PENDING',
    };

    // Assign to support agent for contact within 24h
    await this.assignDetractorFollowUp(response);
  }

  private async handlePassive(response: NPSSurvey): Promise<void> {
    this.logger.log(`😐 Passive response: customer ${response.customerId}, score ${response.score}`);

    // Send upgrade offer
    response.closedLoop = {
      triggeredAt: new Date(),
      actionType: 'OFFER',
      status: 'PENDING',
    };

    // Notify IA-CRM for targeted offer
    await this.notifyForUpgradeOffer(response);
  }

  private async handlePromoter(response: NPSSurvey): Promise<void> {
    this.logger.log(`😊 Promoter detected: customer ${response.customerId}, score ${response.score}`);

    // Propose referral program
    response.closedLoop = {
      triggeredAt: new Date(),
      actionType: 'REFERRAL',
      status: 'PENDING',
    };

    // Request public review
    await this.requestPublicReview(response);

    // Notify Growth IA for referral program
    await this.notifyForReferralProgram(response);
  }

  /**
   * Calculate NPS for a period
   */
  async calculateNPS(period: string): Promise<NPSResult> {
    const responses = await this.surveyService.getResponses('NPS', period);
    const validResponses = responses.filter((r) => r.score !== undefined);

    if (validResponses.length === 0) {
      return this.getEmptyNPSResult(period);
    }

    const promoters = validResponses.filter(
      (r) => r.score >= this.config.nps.promoterThreshold,
    );
    const detractors = validResponses.filter(
      (r) => r.score <= this.config.nps.detractorThreshold,
    );
    const passives = validResponses.filter(
      (r) =>
        r.score > this.config.nps.detractorThreshold &&
        r.score < this.config.nps.promoterThreshold,
    );

    const npsScore = Math.round(
      ((promoters.length - detractors.length) / validResponses.length) * 100,
    );

    return {
      period,
      totalResponses: validResponses.length,
      responseRate: 0.25, // Would calculate from sent surveys
      npsScore,
      breakdown: {
        promoters: {
          count: promoters.length,
          percentage: (promoters.length / validResponses.length) * 100,
        },
        passives: {
          count: passives.length,
          percentage: (passives.length / validResponses.length) * 100,
        },
        detractors: {
          count: detractors.length,
          percentage: (detractors.length / validResponses.length) * 100,
        },
      },
      trend: 'STABLE',
      vsLastPeriod: 0,
      benchmark: {
        sector: 'E-commerce Auto Parts',
        average: 35,
        ourPercentile: npsScore >= 50 ? 75 : npsScore >= 35 ? 50 : 25,
      },
    };
  }

  private getEmptyNPSResult(period: string): NPSResult {
    return {
      period,
      totalResponses: 0,
      responseRate: 0,
      npsScore: 0,
      breakdown: {
        promoters: { count: 0, percentage: 0 },
        passives: { count: 0, percentage: 0 },
        detractors: { count: 0, percentage: 0 },
      },
      trend: 'STABLE',
      vsLastPeriod: 0,
      benchmark: { sector: 'E-commerce Auto Parts', average: 35, ourPercentile: 0 },
    };
  }

  // ==================== 3. VOICE OF CUSTOMER ANALYTICS ====================

  /**
   * Generate monthly VoC insights
   * Runs on 1st of month at 9am
   */
  @Cron('0 9 1 * *')
  async generateVoCInsights(): Promise<VoCInsights> {
    const period = this.getPreviousPeriod();
    this.logger.log(`🔍 Generating VoC insights for ${period}`);

    // Aggregate all customer voice sources
    const sources = await this.aggregateVoCSources(period);

    // Extract themes and sentiments using NLP
    const allTexts = sources.map((s) => s.content);
    const themes = await this.nlpService.extractThemes(allTexts);

    // Analyze sentiments
    const sentiments = await Promise.all(
      sources.map((s) => this.nlpService.analyzeSentiment(s.content, s.language)),
    );

    // Group by theme
    const themeAnalysis = this.analyzeThemes(sources, sentiments, themes);

    // Generate word cloud
    const wordCloud = this.generateWordCloud(allTexts);

    // Generate recommendations
    const recommendations = this.generateVoCRecommendations(themeAnalysis);

    const insights: VoCInsights = {
      period,
      sourcesAnalyzed: sources.length,
      totalMentions: allTexts.length,
      topPositiveThemes: themeAnalysis.filter((t) => t.sentiment > 0).slice(0, 10),
      topPainPoints: themeAnalysis
        .filter((t) => t.sentiment < 0)
        .sort((a, b) => a.sentiment - b.sentiment)
        .slice(0, 10),
      emergingTrends: themeAnalysis.filter((t) => t.trend === 'UP').slice(0, 5),
      wordCloud: wordCloud.slice(0, 50),
      sentimentOverTime: [], // Would calculate daily sentiment
      recommendations,
    };

    // Send report to IA-CPO and IA-CEO
    await this.sendVoCReport(insights);

    this.logger.log(
      `✅ VoC insights generated: ${insights.topPainPoints.length} pain points, ${insights.recommendations.length} recommendations`,
    );

    return insights;
  }

  private async aggregateVoCSources(period: string): Promise<
    { source: string; content: string; language: string }[]
  > {
    // Mock - would aggregate from reviews, tickets, surveys, etc.
    return [
      { source: 'review', content: 'Livraison rapide et produit conforme', language: 'fr' },
      { source: 'ticket', content: 'Délai de livraison trop long', language: 'fr' },
      { source: 'survey', content: 'Site facile à utiliser', language: 'fr' },
    ];
  }

  private analyzeThemes(
    sources: { source: string; content: string }[],
    sentiments: SentimentAnalysis[],
    themes: string[],
  ): ThemeInsight[] {
    // Mock theme analysis
    return [
      {
        theme: 'Délai livraison',
        mentions: 45,
        sentiment: -0.3,
        trend: 'STABLE',
        examples: ['Livraison trop longue', 'Délai annoncé non respecté'],
      },
      {
        theme: 'Qualité produit',
        mentions: 38,
        sentiment: 0.6,
        trend: 'UP',
        examples: ['Produit conforme', 'Excellente qualité'],
      },
      {
        theme: 'Service client',
        mentions: 25,
        sentiment: 0.4,
        trend: 'STABLE',
        examples: ['Équipe réactive', 'Bon suivi'],
      },
    ];
  }

  private generateWordCloud(texts: string[]): { word: string; count: number }[] {
    // Mock word cloud generation
    return [
      { word: 'livraison', count: 120 },
      { word: 'qualité', count: 85 },
      { word: 'rapide', count: 72 },
      { word: 'service', count: 65 },
      { word: 'prix', count: 58 },
    ];
  }

  private generateVoCRecommendations(themes: ThemeInsight[]): VoCRecommendation[] {
    const recommendations: VoCRecommendation[] = [];

    for (const theme of themes.filter((t) => t.sentiment < 0)) {
      if (theme.theme.toLowerCase().includes('livraison')) {
        recommendations.push({
          priority: 'HIGH',
          category: 'QUICK_WIN',
          theme: theme.theme,
          recommendation: 'Améliorer la communication proactive sur les délais',
          expectedImpact: '+5 points NPS',
          owner: 'IA-Transport',
        });
      }

      if (theme.theme.toLowerCase().includes('prix')) {
        recommendations.push({
          priority: 'MEDIUM',
          category: 'MEDIUM_TERM',
          theme: theme.theme,
          recommendation: 'Revoir positionnement prix vs concurrence',
          expectedImpact: '+3% conversion',
          owner: 'IA-CFO',
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private async sendVoCReport(insights: VoCInsights): Promise<void> {
    this.logger.log(`📤 Sending VoC report to IA-CPO and IA-CEO`);
    // TODO: Emit events for IA-CPO and IA-CEO
  }

  // ==================== 4. SUPPORT AUTOMATION HUB ====================

  /**
   * Process incoming chatbot message
   */
  async processChatbotMessage(
    sessionId: string,
    message: string,
    context: {
      customerId?: string;
      orderId?: string;
      history?: ChatMessage[];
    },
  ): Promise<{
    response: ChatMessage;
    shouldEscalate: boolean;
    escalationReason?: string;
  }> {
    // Analyze sentiment
    const sentiment = await this.nlpService.analyzeSentiment(message, 'fr');

    // Check for escalation signals
    const escalationSignals = await this.detectEscalationSignals(
      message,
      sentiment,
      context,
    );

    if (escalationSignals.length > 0) {
      const topSignal = escalationSignals[0];
      await this.chatbotService.escalateToAgent(sessionId, topSignal.details);

      return {
        response: {
          id: `msg-${Date.now()}`,
          timestamp: new Date(),
          sender: 'BOT',
          content:
            'Je comprends que vous avez besoin d\'une assistance personnalisée. Je vous transfère immédiatement vers un de nos conseillers qui pourra vous aider.',
          sentiment,
        },
        shouldEscalate: true,
        escalationReason: topSignal.type,
      };
    }

    // Process normally with chatbot
    const response = await this.chatbotService.processMessage(sessionId, message, context);
    response.sentiment = sentiment;

    return {
      response,
      shouldEscalate: false,
    };
  }

  private async detectEscalationSignals(
    message: string,
    sentiment: SentimentAnalysis,
    context: any,
  ): Promise<EscalationSignal[]> {
    const signals: EscalationSignal[] = [];

    // Check negative sentiment
    if (sentiment.label === 'NEGATIVE' && sentiment.confidence > 0.8) {
      signals.push({
        type: 'NEGATIVE_SENTIMENT',
        confidence: sentiment.confidence,
        details: 'Strong negative sentiment detected',
      });
    }

    // Check urgent keywords
    const messageLower = message.toLowerCase();
    for (const keyword of this.urgentKeywords) {
      if (messageLower.includes(keyword)) {
        signals.push({
          type: 'URGENT_KEYWORDS',
          confidence: 1,
          details: `Urgent keyword detected: ${keyword}`,
        });
        break;
      }
    }

    // Check VIP customer
    if (context.customerId) {
      const isVIP = await this.crmIntegration.isVIPCustomer(context.customerId);
      if (isVIP) {
        signals.push({
          type: 'VIP_CUSTOMER',
          confidence: 1,
          details: 'VIP customer requires priority handling',
        });
      }
    }

    // Check conversation loop (>3 messages without resolution)
    if (context.history && context.history.length > 6) {
      signals.push({
        type: 'LOOP_DETECTED',
        confidence: 0.7,
        details: 'Conversation appears stuck without resolution',
      });
    }

    return signals.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Route incoming support ticket
   */
  async routeTicket(ticket: SupportTicket): Promise<SupportTicket> {
    // Analyze content for categorization
    const category = await this.classifyTicket(ticket);
    ticket.category = category;

    // Calculate priority
    ticket.priority = await this.calculateTicketPriority(ticket);

    // Calculate escalation risk
    ticket.escalationRisk = await this.calculateEscalationRisk(ticket);

    // Generate suggested response
    ticket.suggestedResponse = await this.generateTicketResponse(ticket);

    // Assign to appropriate agent
    ticket.assignedTo = await this.assignTicket(ticket);

    this.logger.log(
      `📧 Ticket ${ticket.id} routed: ${ticket.category} - ${ticket.priority}`,
    );

    return ticket;
  }

  private async classifyTicket(ticket: SupportTicket): Promise<string> {
    // Mock - would use NLP classification
    return 'ORDER_STATUS';
  }

  private async calculateTicketPriority(
    ticket: SupportTicket,
  ): Promise<SupportTicket['priority']> {
    // Check if VIP
    const isVIP = await this.crmIntegration.isVIPCustomer(ticket.customerId);
    if (isVIP) return 'HIGH';

    // Check urgent keywords
    // (Would analyze ticket content)

    return 'MEDIUM';
  }

  private async calculateEscalationRisk(ticket: SupportTicket): Promise<number> {
    // Mock - would use ML model
    return 25;
  }

  private async generateTicketResponse(ticket: SupportTicket): Promise<string> {
    // Mock - would generate based on category and context
    return 'Bonjour, nous avons bien reçu votre demande et la traitons en priorité. Un conseiller reviendra vers vous sous peu.';
  }

  private async assignTicket(ticket: SupportTicket): Promise<string> {
    // Mock - would route based on category and agent skills
    return 'agent-001';
  }

  // ==================== 5. CUSTOMER JOURNEY ANALYTICS ====================

  /**
   * Analyze customer journey
   */
  async analyzeCustomerJourney(customerId: string): Promise<CustomerJourney> {
    // Get all touchpoints
    const touchpoints = await this.getCustomerTouchpoints(customerId);

    // Calculate satisfaction by stage
    const satisfactionByStage = this.calculateSatisfactionByStage(touchpoints);

    // Identify friction points
    const frictionPoints = this.identifyFrictionPoints(touchpoints);

    // Calculate current stage
    const currentStage = this.determineCurrentStage(touchpoints);

    // Calculate overall satisfaction
    const overallSatisfaction =
      Object.values(satisfactionByStage).reduce((sum, s) => sum + s, 0) /
      Object.keys(satisfactionByStage).length;

    // Get churn risk from IA-CRM
    const churnRisk = 0; // Would integrate with IA-CRM

    return {
      customerId,
      touchpoints,
      currentStage,
      satisfactionByStage,
      frictionPoints,
      overallSatisfaction,
      churnRisk,
    };
  }

  private async getCustomerTouchpoints(
    customerId: string,
  ): Promise<JourneyTouchpoint[]> {
    // Mock - would aggregate from all systems
    return [
      {
        timestamp: new Date('2025-11-01'),
        stage: 'ACQUISITION',
        channel: 'Google Ads',
        action: 'Click',
        outcome: 'POSITIVE',
      },
      {
        timestamp: new Date('2025-11-01'),
        stage: 'CONSIDERATION',
        channel: 'Website',
        action: 'Product view',
        outcome: 'POSITIVE',
      },
      {
        timestamp: new Date('2025-11-02'),
        stage: 'PURCHASE',
        channel: 'Website',
        action: 'Checkout',
        outcome: 'POSITIVE',
      },
      {
        timestamp: new Date('2025-11-10'),
        stage: 'POST_PURCHASE',
        channel: 'Email',
        action: 'NPS Response',
        sentiment: 0.8,
        outcome: 'POSITIVE',
      },
    ];
  }

  private calculateSatisfactionByStage(
    touchpoints: JourneyTouchpoint[],
  ): Record<string, number> {
    const stages = ['ACQUISITION', 'CONSIDERATION', 'PURCHASE', 'POST_PURCHASE', 'LOYALTY'];
    const result: Record<string, number> = {};

    for (const stage of stages) {
      const stageTouchpoints = touchpoints.filter((t) => t.stage === stage);
      if (stageTouchpoints.length === 0) {
        result[stage] = 0;
        continue;
      }

      const positiveCount = stageTouchpoints.filter(
        (t) => t.outcome === 'POSITIVE',
      ).length;
      result[stage] = (positiveCount / stageTouchpoints.length) * 100;
    }

    return result;
  }

  private identifyFrictionPoints(
    touchpoints: JourneyTouchpoint[],
  ): FrictionPoint[] {
    const frictionPoints: FrictionPoint[] = [];

    // Find negative outcomes
    const negatives = touchpoints.filter((t) => t.outcome === 'NEGATIVE');
    for (const negative of negatives) {
      frictionPoints.push({
        stage: negative.stage,
        description: `${negative.action} on ${negative.channel}`,
        frequency: 1,
        impact: 'MEDIUM',
        recommendation: `Review ${negative.stage} experience on ${negative.channel}`,
      });
    }

    return frictionPoints;
  }

  private determineCurrentStage(
    touchpoints: JourneyTouchpoint[],
  ): CustomerJourney['currentStage'] {
    if (touchpoints.length === 0) return 'ACQUISITION';

    const lastTouchpoint = touchpoints[touchpoints.length - 1];
    const hasPurchase = touchpoints.some((t) => t.stage === 'PURCHASE');
    const hasRepeat = touchpoints.filter((t) => t.stage === 'PURCHASE').length > 1;

    if (hasRepeat) return 'LOYALTY';
    if (hasPurchase) return 'POST_PURCHASE';
    if (lastTouchpoint.stage === 'CONSIDERATION') return 'CONSIDERATION';
    return 'ACQUISITION';
  }

  // ==================== REPORT GENERATION ====================

  /**
   * Generate weekly Customer Health Report
   * Runs every Monday at 8am
   */
  @Cron('0 8 * * 1')
  async generateCustomerHealthReport(): Promise<CustomerHealthReport> {
    const period = this.getCurrentPeriod();
    this.logger.log(`📈 Generating Customer Health Report for ${period}`);

    const nps = await this.calculateNPS(period);
    const csat = await this.getCSATResult(period);
    const reviewAggregation = await this.aggregateReviews();

    // Mock support metrics
    const supportMetrics = {
      ticketVolume: 245,
      avgFirstResponseTime: 1.8, // hours
      avgResolutionTime: 24, // hours
      selfServiceRate: 0.62,
      csatSupport: 4.1,
    };

    const report: CustomerHealthReport = {
      period,
      nps,
      csat,
      reviewAggregation,
      supportMetrics,
      topIssues: ['Délais livraison', 'Suivi commande', 'Retours produits'],
      highlights: [
        `NPS score ${nps.npsScore} (target: ${this.config.nps.targetScore})`,
        `${(reviewAggregation.sentimentBreakdown.positive * 100).toFixed(0)}% avis positifs`,
        `Self-service rate ${(supportMetrics.selfServiceRate * 100).toFixed(0)}%`,
      ],
      recommendations: [
        'Améliorer communication proactive livraison',
        'Enrichir FAQ chatbot suivi commande',
        'Formation équipe sur processus retours',
      ],
    };

    // Send to IA-CEO
    await this.sendHealthReport(report);

    // Alert if NPS below target
    if (nps.npsScore < this.config.nps.targetScore) {
      await this.alertLowNPS(nps);
    }

    return report;
  }

  private async getCSATResult(period: string): Promise<CSATResult> {
    // Mock CSAT result
    return {
      period,
      totalResponses: 180,
      averageScore: 4.3,
      distribution: { 1: 5, 2: 8, 3: 22, 4: 65, 5: 80 },
      byCategory: { delivery: 4.1, product: 4.5, support: 4.2 },
      trend: 'UP',
    };
  }

  private async sendHealthReport(report: CustomerHealthReport): Promise<void> {
    this.logger.log(`📤 Sending Customer Health Report to IA-CEO`);
    // TODO: Emit event for IA-CEO
  }

  private async alertLowNPS(nps: NPSResult): Promise<void> {
    this.logger.warn(
      `🚨 NPS alert: ${nps.npsScore} below target ${this.config.nps.targetScore}`,
    );
    // TODO: Escalate to IA-CEO
  }

  // ==================== HELPER METHODS ====================

  private getCurrentPeriod(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private getPreviousPeriod(): string {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 7);
  }

  private async getDeliveriesForSurvey(): Promise<
    { customerId: string; email: string; orderId: string }[]
  > {
    // Mock - would query orders delivered J-7
    return [
      { customerId: 'cust-001', email: 'client1@example.com', orderId: 'ord-001' },
      { customerId: 'cust-002', email: 'client2@example.com', orderId: 'ord-002' },
    ];
  }

  private async assignDetractorFollowUp(response: NPSSurvey): Promise<void> {
    this.logger.log(`📞 Assigning detractor follow-up for ${response.customerId}`);
    // TODO: Create task for support team
  }

  private async notifyForUpgradeOffer(response: NPSSurvey): Promise<void> {
    this.logger.log(`🎁 Notifying IA-CRM for upgrade offer: ${response.customerId}`);
    // TODO: Emit event for IA-CRM
  }

  private async requestPublicReview(response: NPSSurvey): Promise<void> {
    this.logger.log(`⭐ Requesting public review from promoter: ${response.customerId}`);
    // TODO: Send review request email
  }

  private async notifyForReferralProgram(response: NPSSurvey): Promise<void> {
    this.logger.log(`👥 Notifying Growth IA for referral: ${response.customerId}`);
    // TODO: Emit event for Growth IA
  }

  // ==================== FORMATTERS ====================

  /**
   * Format NPS result for display
   */
  formatNPSResult(nps: NPSResult): string {
    const emoji = nps.npsScore >= 50 ? '🎉' : nps.npsScore >= 30 ? '👍' : '⚠️';

    return [
      `📊 NPS REPORT - ${nps.period}`,
      '',
      `${emoji} NPS Score: ${nps.npsScore} (target: ${this.config.nps.targetScore})`,
      '',
      'Breakdown:',
      `├─ Promoters (9-10): ${nps.breakdown.promoters.count} (${nps.breakdown.promoters.percentage.toFixed(0)}%)`,
      `├─ Passives (7-8): ${nps.breakdown.passives.count} (${nps.breakdown.passives.percentage.toFixed(0)}%)`,
      `└─ Detractors (0-6): ${nps.breakdown.detractors.count} (${nps.breakdown.detractors.percentage.toFixed(0)}%)`,
      '',
      `Total Responses: ${nps.totalResponses} (${(nps.responseRate * 100).toFixed(0)}% response rate)`,
      `Trend: ${nps.trend} (${nps.vsLastPeriod > 0 ? '+' : ''}${nps.vsLastPeriod} vs last period)`,
      '',
      `Benchmark (${nps.benchmark.sector}):`,
      `└─ Sector average: ${nps.benchmark.average}, Our percentile: ${nps.benchmark.ourPercentile}%`,
    ].join('\n');
  }

  /**
   * Format review aggregation for display
   */
  formatReviewAggregation(agg: ReviewAggregation): string {
    const stars = '⭐'.repeat(Math.round(agg.averageRating));

    return [
      `📝 REVIEWS AGGREGATION - ${agg.period}`,
      '',
      `${stars} ${agg.averageRating.toFixed(1)}/5 (${agg.totalReviews} avis)`,
      `Reputation Score: ${agg.reputationScore}/100`,
      '',
      'Sentiment:',
      `├─ Positive: ${(agg.sentimentBreakdown.positive * 100).toFixed(0)}%`,
      `├─ Neutral: ${(agg.sentimentBreakdown.neutral * 100).toFixed(0)}%`,
      `└─ Negative: ${(agg.sentimentBreakdown.negative * 100).toFixed(0)}%`,
      '',
      'Top Themes:',
      ...agg.topThemes.slice(0, 5).map(
        (t) => `• ${t.theme}: ${t.count} mentions (sentiment: ${t.sentiment > 0 ? '+' : ''}${t.sentiment.toFixed(2)})`,
      ),
    ].join('\n');
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    return {
      status: 'healthy',
      details: {
        npsScore: 52,
        csatAvg: 4.3,
        reviewSentimentPositive: 0.82,
        supportFirstResponseTime: 1.8,
        selfServiceRate: 0.62,
        lastReviewSync: new Date().toISOString(),
      },
    };
  }
}
