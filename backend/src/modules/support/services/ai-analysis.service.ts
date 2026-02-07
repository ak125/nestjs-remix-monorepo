import { Injectable, Logger } from '@nestjs/common';
import { ContactTicket, ContactFormData } from './contact.service';
import { ReviewData } from './review.service';
import { getErrorMessage } from '../../../common/utils/error.utils';

export interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotions: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface SmartCategorization {
  category: string;
  subcategory: string;
  confidence: number;
  suggestedAgent?: string;
  themes?: string[];
  issues?: string[];
}

export interface SmartResponse {
  response: string;
  confidence: number;
  tone: 'formal' | 'friendly' | 'apologetic' | 'professional';
  requiresHuman: boolean;
  suggestedActions?: string[];
}

export interface EscalationPrediction {
  riskLevel: number; // 0-100
  escalationProbability: number;
  suggestedActions: string[];
  timeToEscalation?: number; // minutes
  priority: 'low' | 'medium' | 'high' | 'critical';
}

@Injectable()
export class AISentimentService {
  private readonly logger = new Logger(AISentimentService.name);

  /**
   * Analyse le sentiment d'un avis client
   */
  async analyzeReviewSentiment(review: ReviewData): Promise<SentimentAnalysis> {
    try {
      const text = `${review.title || ''} ${review.comment || ''}`.trim();

      // Mots-clés sentiment
      const positiveKeywords = [
        'excellent',
        'parfait',
        'génial',
        'super',
        'recommande',
        'satisfait',
        'content',
        'merveilleux',
        'formidable',
        'top',
        'bravo',
        'merci',
      ];

      const negativeKeywords = [
        'horrible',
        'nul',
        'décevant',
        'problème',
        'défaut',
        'cassé',
        'mauvais',
        'insatisfait',
        'arnaque',
        'scandale',
        'inadmissible',
      ];

      const urgentKeywords = [
        'urgent',
        'immédiat',
        'rapidement',
        'vite',
        'emergency',
        'critique',
      ];

      const emotions = this.extractEmotions(text);
      const sentiment = this.calculateSentiment(
        text,
        positiveKeywords,
        negativeKeywords,
      );
      const urgency = this.calculateUrgency(
        text,
        urgentKeywords,
        review.rating,
      );

      return {
        sentiment: sentiment.type,
        confidence: sentiment.confidence,
        emotions,
        urgency,
      };
    } catch (error) {
      this.logger.error(`Erreur analyse sentiment: ${getErrorMessage(error)}`);
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        emotions: [],
        urgency: 'medium',
      };
    }
  }

  /**
   * Analyse le sentiment d'un ticket support
   */
  async analyzeTicketSentiment(
    ticket: ContactTicket | ContactFormData,
  ): Promise<SentimentAnalysis> {
    try {
      const subject = 'subject' in ticket ? ticket.subject : '';
      const text =
        `${subject || ''} ${this.extractMessageFromTicket(ticket)}`.trim();

      const criticalKeywords = [
        'urgent',
        'critique',
        'bloqué',
        'panne',
        'arrêt',
        'impossible',
        'emergency',
        'immédiat',
        'grave',
        'important',
      ];

      const sentiment = this.analyzeTextSentiment(text);
      const urgency = this.calculateTicketUrgency(
        text,
        criticalKeywords,
        ticket.priority,
      );
      const emotions = this.extractEmotions(text);

      return {
        sentiment: sentiment.type,
        confidence: sentiment.confidence,
        emotions,
        urgency,
      };
    } catch (error) {
      this.logger.error(`Erreur analyse ticket: ${getErrorMessage(error)}`);
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        emotions: [],
        urgency: ticket.priority === 'urgent' ? 'critical' : 'medium',
      };
    }
  }

  // ==================== MÉTHODES PRIVÉES ====================

  private calculateSentiment(
    text: string,
    positive: string[],
    negative: string[],
  ): {
    type: 'positive' | 'negative' | 'neutral';
    confidence: number;
  } {
    const lowerText = text.toLowerCase();

    const positiveCount = positive.filter((word) =>
      lowerText.includes(word),
    ).length;
    const negativeCount = negative.filter((word) =>
      lowerText.includes(word),
    ).length;

    if (positiveCount > negativeCount) {
      return {
        type: 'positive',
        confidence: Math.min(0.9, 0.6 + positiveCount * 0.1),
      };
    } else if (negativeCount > positiveCount) {
      return {
        type: 'negative',
        confidence: Math.min(0.9, 0.6 + negativeCount * 0.1),
      };
    }

    return { type: 'neutral', confidence: 0.5 };
  }

  private calculateUrgency(
    text: string,
    urgentWords: string[],
    rating?: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    const lowerText = text.toLowerCase();
    const urgentCount = urgentWords.filter((word) =>
      lowerText.includes(word),
    ).length;

    // Rating très bas = urgence élevée
    if (rating && rating <= 2) return 'high';

    if (urgentCount >= 2) return 'critical';
    if (urgentCount === 1) return 'high';

    return rating && rating >= 4 ? 'low' : 'medium';
  }

  private calculateTicketUrgency(
    text: string,
    criticalWords: string[],
    priority?: string,
  ): 'low' | 'medium' | 'high' | 'critical' {
    const lowerText = text.toLowerCase();
    const criticalCount = criticalWords.filter((word) =>
      lowerText.includes(word),
    ).length;

    if (priority === 'urgent' || criticalCount >= 2) return 'critical';
    if (priority === 'high' || criticalCount === 1) return 'high';
    if (priority === 'low') return 'low';

    return 'medium';
  }

  private extractEmotions(text: string): string[] {
    const emotionMap = {
      frustration: ['frustré', 'énervé', 'agacé', 'exaspéré'],
      colère: ['furieux', 'en colère', 'rage', 'indigné'],
      déception: ['déçu', 'tristesse', 'désappointé'],
      satisfaction: ['satisfait', 'content', 'heureux', 'ravi'],
      reconnaissance: ['merci', 'reconnaissant', 'gratitude'],
      inquiétude: ['inquiet', 'soucieux', 'préoccupé', 'anxieux'],
    };

    const lowerText = text.toLowerCase();
    const detectedEmotions: string[] = [];

    Object.entries(emotionMap).forEach(([emotion, keywords]) => {
      if (keywords.some((keyword) => lowerText.includes(keyword))) {
        detectedEmotions.push(emotion);
      }
    });

    return detectedEmotions;
  }

  private analyzeTextSentiment(text: string): {
    type: 'positive' | 'negative' | 'neutral';
    confidence: number;
  } {
    // Analyse simple basée sur les mots-clés
    const positiveWords = [
      'bon',
      'bien',
      'excellent',
      'parfait',
      'super',
      'génial',
      'top',
      'merci',
      'satisfait',
    ];
    const negativeWords = [
      'mauvais',
      'nul',
      'problème',
      'panne',
      'cassé',
      'défaut',
      'horrible',
      'inacceptable',
    ];

    return this.calculateSentiment(text, positiveWords, negativeWords);
  }

  private extractMessageFromTicket(
    ticket: ContactTicket | ContactFormData,
  ): string {
    if ('message' in ticket) {
      return ticket.message;
    }

    try {
      const content = JSON.parse(ticket.msg_content || '{}');
      return content.message || content.description || '';
    } catch {
      return ticket.msg_content || '';
    }
  }
}

@Injectable()
export class AICategorizationService {
  private readonly logger = new Logger(AICategorizationService.name);

  /**
   * Catégorise automatiquement un ticket
   */
  async categorizeTicket(
    ticket: ContactTicket | ContactFormData,
  ): Promise<SmartCategorization> {
    try {
      const subject = 'subject' in ticket ? ticket.subject : '';
      const text =
        `${subject || ''} ${this.extractMessage(ticket)}`.toLowerCase();

      const categories = this.getCategoryRules();
      let bestMatch = {
        category: 'general',
        confidence: 0.3,
        subcategory: 'other',
      };

      // Recherche de la meilleure correspondance
      for (const [category, rules] of Object.entries(categories)) {
        const confidence = this.calculateCategoryConfidence(
          text,
          rules.keywords,
        );

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            category,
            confidence,
            subcategory: this.findSubcategory(text, rules.subcategories),
            // suggestedAgent: rules.suggestedAgent, // Propriété non définie dans SmartCategorization
          };
        }
      }

      const themes = this.extractThemes(text);
      const issues = this.extractIssues(text);

      return {
        ...bestMatch,
        themes,
        issues,
      };
    } catch (error) {
      this.logger.error(`Erreur catégorisation: ${getErrorMessage(error)}`);
      return {
        category: 'general',
        subcategory: 'other',
        confidence: 0.3,
      };
    }
  }

  /**
   * Catégorise un avis client
   */
  async categorizeReview(review: ReviewData): Promise<SmartCategorization> {
    try {
      const text =
        `${review.title || ''} ${review.comment || ''}`.toLowerCase();

      const themes = this.extractReviewThemes(text);
      const issues = review.rating <= 3 ? this.extractIssues(text) : [];

      return {
        category: this.getReviewCategory(review.rating),
        subcategory: this.getReviewSubcategory(themes, issues),
        confidence: 0.8,
        themes,
        issues,
      };
    } catch (error) {
      this.logger.error(
        `Erreur catégorisation avis: ${getErrorMessage(error)}`,
      );
      return {
        category: 'product_feedback',
        subcategory: 'general',
        confidence: 0.5,
      };
    }
  }

  // ==================== MÉTHODES PRIVÉES ====================

  private getCategoryRules() {
    return {
      technical: {
        keywords: [
          'bug',
          'erreur',
          'panne',
          'dysfonctionnement',
          'problème technique',
          'plantage',
        ],
        subcategories: ['software', 'hardware', 'integration', 'performance'],
        suggestedAgent: 'tech-support',
      },
      billing: {
        keywords: [
          'facture',
          'paiement',
          'facturation',
          'prix',
          'tarif',
          'remboursement',
        ],
        subcategories: ['invoice', 'payment', 'refund', 'pricing'],
        suggestedAgent: 'billing-team',
      },
      complaint: {
        keywords: ['plainte', 'réclamation', 'insatisfait', 'déçu', 'problème'],
        subcategories: ['product', 'service', 'delivery', 'quality'],
        suggestedAgent: 'customer-relations',
      },
      general: {
        keywords: ['information', 'question', 'demande', 'renseignement'],
        subcategories: ['info', 'question', 'other'],
        suggestedAgent: 'general-support',
      },
    };
  }

  private calculateCategoryConfidence(
    text: string,
    keywords: string[],
  ): number {
    const matches = keywords.filter((keyword) => text.includes(keyword)).length;
    return Math.min(0.9, 0.4 + matches * 0.2);
  }

  private findSubcategory(text: string, subcategories: string[]): string {
    for (const sub of subcategories) {
      if (text.includes(sub)) return sub;
    }
    return subcategories[0] || 'other';
  }

  private extractThemes(text: string): string[] {
    const themeKeywords = {
      qualité: ['qualité', 'défaut', 'finition'],
      livraison: ['livraison', 'délai', 'transport'],
      prix: ['prix', 'tarif', 'coût', 'cher'],
      service: ['service', 'accueil', 'personnel'],
    };

    const themes: string[] = [];
    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      if (keywords.some((keyword) => text.includes(keyword))) {
        themes.push(theme);
      }
    });

    return themes;
  }

  private extractIssues(text: string): string[] {
    const issueKeywords = [
      'cassé',
      'défectueux',
      'panne',
      'problème',
      'erreur',
      'retard',
      'manque',
      'incomplet',
      'incorrect',
    ];

    return issueKeywords.filter((issue) => text.includes(issue));
  }

  private extractReviewThemes(text: string): string[] {
    const themes = this.extractThemes(text);

    // Thèmes spécifiques aux avis
    const reviewSpecific = {
      recommandation: ['recommande', 'conseille'],
      expérience: ['expérience', 'ressenti'],
      comparaison: ['comparé', 'versus', 'mieux que'],
    };

    Object.entries(reviewSpecific).forEach(([theme, keywords]) => {
      if (keywords.some((keyword) => text.includes(keyword))) {
        themes.push(theme);
      }
    });

    return themes;
  }

  private getReviewCategory(rating: number): string {
    if (rating >= 4) return 'positive_feedback';
    if (rating <= 2) return 'negative_feedback';
    return 'neutral_feedback';
  }

  private getReviewSubcategory(themes: string[], issues: string[]): string {
    if (issues.length > 0) return 'product_issue';
    if (themes.includes('service')) return 'service_feedback';
    if (themes.includes('livraison')) return 'delivery_feedback';
    return 'general_feedback';
  }

  private extractMessage(ticket: ContactTicket | ContactFormData): string {
    if ('message' in ticket) return ticket.message;

    try {
      const content = JSON.parse(ticket.msg_content || '{}');
      return content.message || '';
    } catch {
      return ticket.msg_content || '';
    }
  }
}
