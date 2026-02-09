/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ReviewService } from './review.service';
import { QuoteService } from './quote.service';
import { ClaimService } from './claim.service';
import { FaqService } from './faq.service';
import {
  getErrorMessage,
  getErrorStack,
} from '../../../common/utils/error.utils';

export interface SupportAnalytics {
  overview: {
    totalTickets: number;
    activeTickets: number;
    resolvedTickets: number;
    averageResponseTime: number;
    customerSatisfaction: number;
    totalReviews: number;
    averageRating: number;
  };

  timeSeriesData: {
    date: string;
    tickets: number;
    reviews: number;
    quotes: number;
    claims: number;
  }[];

  departmentStats: {
    contact: any;
    reviews: any;
    quotes: any;
    claims: any;
    faq: any;
  };

  trends: {
    ticketsGrowth: number;
    satisfactionTrend: number;
    responseTimeTrend: number;
    reviewsGrowth: number;
  };

  topIssues: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;

  performanceMetrics: {
    firstResponseTime: number;
    resolutionTime: number;
    escalationRate: number;
    reopenRate: number;
  };
}

export interface AgentPerformance {
  agentId: string;
  agentName: string;
  totalTickets: number;
  resolvedTickets: number;
  averageResponseTime: number;
  customerSatisfaction: number;
  resolutionRate: number;
  workload: 'low' | 'normal' | 'high' | 'overloaded';
}

export interface SupportReport {
  period: { start: Date; end: Date };
  summary: {
    totalContacts: number;
    totalReviews: number;
    totalQuotes: number;
    totalClaims: number;
    customerSatisfaction: number;
  };
  keyMetrics: Record<string, number>;
  insights: string[];
  recommendations: string[];
  generatedAt: Date;
}

/** Shape of stats returned by ContactService.getStats() */
interface ContactStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  avgResponseTime: number;
  satisfactionRating: number;
  [key: string]: unknown;
}

/** Shape of stats returned by ClaimService.getClaimStats() */
interface ClaimStats {
  total: number;
  open: number;
  resolved: number;
  satisfactionRating: number;
}

@Injectable()
export class SupportAnalyticsService {
  private readonly logger = new Logger(SupportAnalyticsService.name);

  constructor(
    private readonly contactService: ContactService,
    private readonly reviewService: ReviewService,
    private readonly quoteService: QuoteService,
    private readonly claimService: ClaimService,
    private readonly faqService: FaqService,
  ) {}

  async getAnalytics(period?: {
    start: Date;
    end: Date;
  }): Promise<SupportAnalytics> {
    try {
      const [contactStats, reviewStats, quoteStats, claimStats, faqStats] =
        await Promise.all([
          this.contactService.getStats(),
          this.reviewService.getReviewStats(),
          this.quoteService.getQuoteStats(period),
          this.claimService.getClaimStats(period),
          this.faqService.getFAQStats(),
        ]);
      const overview = {
        totalTickets: contactStats.total + claimStats.total,
        activeTickets:
          contactStats.open + contactStats.inProgress + claimStats.open,
        resolvedTickets: contactStats.resolved + claimStats.resolved,
        averageResponseTime: contactStats.avgResponseTime,
        customerSatisfaction:
          (contactStats.satisfactionRating + claimStats.satisfactionRating) / 2,
        totalReviews: reviewStats.total,
        averageRating: reviewStats.averageRating,
      };

      const timeSeriesData = this.generateTimeSeriesData(period);

      const departmentStats = {
        contact: contactStats,
        reviews: reviewStats,
        quotes: quoteStats,
        claims: claimStats,
        faq: faqStats,
      };

      const trends = this.calculateTrends(period);
      const topIssues = this.getTopIssues(contactStats, claimStats);
      const performanceMetrics = this.calculatePerformanceMetrics(
        contactStats,
        claimStats,
      );

      return {
        overview,
        timeSeriesData,
        departmentStats,
        trends,
        topIssues,
        performanceMetrics,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate analytics: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  async getAgentPerformance(agentId?: string): Promise<AgentPerformance[]> {
    // This would typically fetch from database
    // For now, return mock data
    const mockAgents: AgentPerformance[] = [
      {
        agentId: 'agent-1',
        agentName: 'Marie Dupont',
        totalTickets: 45,
        resolvedTickets: 42,
        averageResponseTime: 25,
        customerSatisfaction: 4.8,
        resolutionRate: 93.3,
        workload: 'normal',
      },
      {
        agentId: 'agent-2',
        agentName: 'Pierre Martin',
        totalTickets: 38,
        resolvedTickets: 35,
        averageResponseTime: 32,
        customerSatisfaction: 4.6,
        resolutionRate: 92.1,
        workload: 'normal',
      },
    ];

    if (agentId) {
      return mockAgents.filter((agent) => agent.agentId === agentId);
    }

    return mockAgents;
  }

  async generateReport(period: {
    start: Date;
    end: Date;
  }): Promise<SupportReport> {
    const analytics = await this.getAnalytics(period);

    const [contactStats, reviewStats, quoteStats, claimStats] =
      await Promise.all([
        this.contactService.getStats(),
        this.reviewService.getReviewStats(),
        this.quoteService.getQuoteStats(period),
        this.claimService.getClaimStats(period),
      ]);

    const summary = {
      totalContacts: contactStats.total,
      totalReviews: reviewStats.total,
      totalQuotes: quoteStats.totalRequests,
      totalClaims: claimStats.total,
      customerSatisfaction: analytics.overview.customerSatisfaction,
    };

    const keyMetrics = {
      responseTime: contactStats.avgResponseTime,
      resolutionRate:
        (claimStats.resolved / Math.max(claimStats.total, 1)) * 100,
      conversionRate: quoteStats.conversionRate,
      satisfactionScore: analytics.overview.customerSatisfaction,
      reviewRating: reviewStats.averageRating,
    };

    const insights = this.generateInsights(analytics, keyMetrics);
    const recommendations = this.generateRecommendations(analytics, keyMetrics);

    return {
      period,
      summary,
      keyMetrics,
      insights,
      recommendations,
      generatedAt: new Date(),
    };
  }

  async getKPIs(): Promise<Record<string, number>> {
    const analytics = await this.getAnalytics();

    return {
      'Tickets actifs': analytics.overview.activeTickets,
      'Temps de réponse moyen (min)': analytics.overview.averageResponseTime,
      'Satisfaction client':
        Math.round(analytics.overview.customerSatisfaction * 100) / 100,
      'Note moyenne des avis':
        Math.round(analytics.overview.averageRating * 100) / 100,
      'Taux de résolution': analytics.performanceMetrics.resolutionTime,
      "Taux d'escalade": analytics.performanceMetrics.escalationRate,
    };
  }

  async getWorkloadDistribution(): Promise<Record<string, number>> {
    const agents = await this.getAgentPerformance();

    const distribution: Record<string, number> = {
      low: 0,
      normal: 0,
      high: 0,
      overloaded: 0,
    };

    agents.forEach((agent) => {
      distribution[agent.workload]++;
    });

    return distribution;
  }

  async getSatisfactionTrend(
    days: number = 30,
  ): Promise<Array<{ date: string; satisfaction: number }>> {
    // This would typically fetch from database
    // For now, generate mock data
    const trend = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Generate realistic satisfaction data (4.0 - 5.0)
      const satisfaction = 4.0 + Math.random() * 1.0;

      trend.push({
        date: date.toISOString().split('T')[0],
        satisfaction: Math.round(satisfaction * 100) / 100,
      });
    }

    return trend;
  }

  private generateTimeSeriesData(_period?: { start: Date; end: Date }) {
    // This would typically fetch from database based on period
    // For now, generate mock data
    const data = [];
    const days = 30;
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      data.push({
        date: date.toISOString().split('T')[0],
        tickets: Math.floor(Math.random() * 20) + 5,
        reviews: Math.floor(Math.random() * 15) + 3,
        quotes: Math.floor(Math.random() * 10) + 2,
        claims: Math.floor(Math.random() * 8) + 1,
      });
    }

    return data;
  }

  private calculateTrends(_period?: { start: Date; end: Date }) {
    // Mock trend calculations (period would be used for real data)
    return {
      ticketsGrowth: Math.round((Math.random() * 20 - 10) * 100) / 100, // -10% to +10%
      satisfactionTrend: Math.round((Math.random() * 1 - 0.5) * 100) / 100, // -0.5 to +0.5
      responseTimeTrend: Math.round((Math.random() * 30 - 15) * 100) / 100, // -15% to +15%
      reviewsGrowth: Math.round((Math.random() * 25 - 12.5) * 100) / 100, // -12.5% to +12.5%
    };
  }

  private getTopIssues(_contactStats: ContactStats, _claimStats: ClaimStats) {
    // Mock data - would use contactStats and claimStats for real aggregation
    const issues = [
      { category: 'Livraison', count: 25, percentage: 35 },
      { category: 'Produit défectueux', count: 18, percentage: 25 },
      { category: 'Facturation', count: 12, percentage: 17 },
      { category: 'Commande', count: 10, percentage: 14 },
      { category: 'Autre', count: 6, percentage: 9 },
    ];

    return issues;
  }

  private calculatePerformanceMetrics(
    contactStats: ContactStats,
    _claimStats: ClaimStats,
  ) {
    // claimStats would be used for more detailed performance analysis
    return {
      firstResponseTime: contactStats.avgResponseTime || 45, // minutes
      resolutionTime: Math.round(
        (contactStats.resolved / Math.max(contactStats.total, 1)) * 100,
      ), // percentage
      escalationRate: Math.round(Math.random() * 10), // percentage
      reopenRate: Math.round(Math.random() * 5), // percentage
    };
  }

  private generateInsights(
    analytics: SupportAnalytics,
    _keyMetrics: Record<string, number>,
  ): string[] {
    // keyMetrics would be used for more detailed insights generation
    const insights = [];

    if (analytics.overview.averageResponseTime > 60) {
      insights.push(
        "Le temps de réponse moyen dépasse 1 heure - considérer l'augmentation de l'équipe support",
      );
    }

    if (analytics.overview.customerSatisfaction < 4.0) {
      insights.push(
        'La satisfaction client est en dessous de 4/5 - analyser les causes principales',
      );
    }

    if (analytics.trends.ticketsGrowth > 15) {
      insights.push(
        'Forte croissance du nombre de tickets - prévoir des ressources supplémentaires',
      );
    }

    if (analytics.overview.averageRating < 4.0) {
      insights.push(
        'La note moyenne des avis est faible - améliorer la qualité des produits/services',
      );
    }

    if (analytics.performanceMetrics.escalationRate > 15) {
      insights.push(
        "Taux d'escalade élevé - former l'équipe de première ligne",
      );
    }

    return insights;
  }

  private generateRecommendations(
    analytics: SupportAnalytics,
    keyMetrics: Record<string, number>,
  ): string[] {
    const recommendations = [];

    if (analytics.overview.averageResponseTime > 45) {
      recommendations.push(
        'Implémenter un système de réponse automatique pour réduire le temps de première réponse',
      );
    }

    if (analytics.overview.customerSatisfaction < 4.5) {
      recommendations.push(
        "Organiser des formations sur la relation client pour l'équipe support",
      );
    }

    if (keyMetrics.conversionRate < 25) {
      recommendations.push(
        'Améliorer le processus de devis pour augmenter le taux de conversion',
      );
    }

    recommendations.push(
      'Analyser les FAQ les plus consultées pour identifier les améliorations produit',
    );
    recommendations.push(
      'Mettre en place des sondages de satisfaction post-résolution',
    );

    return recommendations;
  }
}
