import { Injectable, Logger } from '@nestjs/common';
import { ContactTicket, ContactFormData } from './contact.service';
import { ReviewData } from './review.service';
import { SentimentAnalysis, SmartCategorization } from './ai-analysis.service';

export interface SmartResponse {
  response: string;
  confidence: number;
  tone: 'formal' | 'friendly' | 'apologetic' | 'professional';
  requiresHuman: boolean;
  suggestedActions?: string[];
  estimatedResolutionTime?: number; // minutes
}

export interface EscalationPrediction {
  riskLevel: number; // 0-100
  escalationProbability: number;
  suggestedActions: string[];
  timeToEscalation?: number; // minutes
  priority: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
}

export interface WorkflowOptimization {
  recommendedAgent?: string;
  estimatedResolutionTime: number;
  priority: number; // 1-10
  suggestedNextSteps: string[];
  automationOpportunities: string[];
}

@Injectable()
export class AISmartResponseService {
  private readonly logger = new Logger(AISmartResponseService.name);

  /**
   * Génère une réponse intelligente pour un ticket
   */
  async generateTicketResponse(
    ticket: ContactTicket | ContactFormData,
    sentiment?: SentimentAnalysis,
    categorization?: SmartCategorization,
  ): Promise<SmartResponse> {
    try {
      const messageText = this.extractMessage(ticket);
      const category = categorization?.category || ticket.category || 'general';
      const urgency = sentiment?.urgency || 'medium';

      const responseTemplate = this.getResponseTemplate(category, urgency);
      const tone = this.determineTone(sentiment, urgency);
      const response = this.personalizeResponse(responseTemplate, ticket, tone);

      const confidence = this.calculateConfidence(
        category,
        urgency,
        messageText,
      );
      const requiresHuman = this.shouldRequireHuman(
        urgency,
        confidence,
        category,
      );
      const suggestedActions = this.getSuggestedActions(category, urgency);
      const estimatedTime = this.estimateResolutionTime(category, urgency);

      return {
        response,
        confidence,
        tone,
        requiresHuman,
        suggestedActions,
        estimatedResolutionTime: estimatedTime,
      };
    } catch (error) {
      this.logger.error(`Erreur génération réponse: ${error.message}`);
      return this.getFallbackResponse();
    }
  }

  /**
   * Génère une réponse publique pour un avis
   */
  async generateReviewResponse(
    review: ReviewData,
    sentiment?: SentimentAnalysis,
  ): Promise<SmartResponse> {
    try {
      const rating = review.rating;
      const isPositive = rating >= 4;
      const isNegative = rating <= 2;

      let template: string;
      let tone: 'formal' | 'friendly' | 'apologetic' | 'professional';

      if (isPositive) {
        template = this.getPositiveReviewTemplate();
        tone = 'friendly';
      } else if (isNegative) {
        template = this.getNegativeReviewTemplate();
        tone = 'apologetic';
      } else {
        template = this.getNeutralReviewTemplate();
        tone = 'professional';
      }

      const response = this.personalizeReviewResponse(template, review);
      const shouldPublish = this.shouldPublishResponse(rating, sentiment);

      return {
        response,
        confidence: 0.8,
        tone,
        requiresHuman: rating <= 2, // Avis très négatifs nécessitent validation humaine
        suggestedActions: this.getReviewActions(rating),
      };
    } catch (error) {
      this.logger.error(`Erreur réponse avis: ${error.message}`);
      return {
        response:
          'Merci pour votre avis. Nous prenons en compte vos commentaires.',
        confidence: 0.5,
        tone: 'professional',
        requiresHuman: true,
      };
    }
  }

  // ==================== TEMPLATES DE RÉPONSES ====================

  private getResponseTemplate(category: string, urgency: string): string {
    const templates = {
      technical: {
        low: `Bonjour,

Merci pour votre message concernant le problème technique rencontré.

Notre équipe technique va analyser votre demande et vous proposer une solution dans les plus brefs délais. En attendant, vous pouvez consulter notre FAQ qui contient les solutions aux problèmes les plus courants.

Nous reviendrons vers vous sous 24h avec une réponse détaillée.

Cordialement,
L'équipe support technique`,

        medium: `Bonjour,

Nous avons bien reçu votre demande d'assistance technique et comprenons l'importance de résoudre ce problème rapidement.

Un technicien spécialisé va prendre en charge votre dossier et vous contactera dans les 4 heures qui suivent pour vous proposer une solution adaptée.

En cas d'urgence, n'hésitez pas à nous contacter directement par téléphone.

Bien à vous,
L'équipe support`,

        high: `Bonjour,

Votre demande a été classée en priorité haute. Nous comprenons l'impact que ce problème technique peut avoir sur votre activité.

Un ingénieur expert va immédiatement prendre en charge votre dossier. Vous devriez recevoir une première réponse dans l'heure qui suit.

Merci de votre patience.

L'équipe technique d'urgence`,

        critical: `Bonjour,

Votre demande a été escaladée en urgence critique. Notre équipe d'intervention prioritaire a été immédiatement notifiée.

Un responsable technique va vous contacter dans les 30 minutes pour débuter la résolution de ce problème critique.

Nous mettons tout en œuvre pour résoudre cette situation rapidement.

L'équipe d'intervention d'urgence`,
      },

      billing: {
        low: `Bonjour,

Merci pour votre demande concernant la facturation.

Notre service comptabilité va examiner votre dossier et vous fournir les informations demandées sous 48h ouvrées.

Si vous avez des questions urgentes concernant un paiement, n'hésitez pas à nous le signaler.

Cordialement,
Le service facturation`,

        medium: `Bonjour,

Nous avons bien reçu votre demande relative à votre facturation.

Notre équipe comptable va traiter votre dossier en priorité et vous répondre sous 24h ouvrées avec toutes les informations nécessaires.

Merci de votre confiance.

Le service clients`,

        high: `Bonjour,

Votre demande de facturation a été classée prioritaire.

Un responsable du service comptable va examiner votre dossier immédiatement et vous contacter sous 4h pour résoudre cette situation.

Nous nous excusons pour tout désagrément.

Le responsable facturation`,

        critical: `Bonjour,

Nous traitons votre demande de facturation en urgence absolue.

Un responsable senior va vous contacter dans l'heure qui suit pour régler cette situation de manière définitive.

Nous nous excusons sincèrement pour cette situation.

La direction du service clients`,
      },

      complaint: {
        low: `Bonjour,

Nous avons pris connaissance de votre réclamation et la prenons très au sérieux.

Un responsable du service clients va analyser votre situation et vous proposer une solution satisfaisante sous 48h.

Nous nous excusons pour les désagréments occasionnés.

Cordialement,
Le service clients`,

        medium: `Bonjour,

Merci d'avoir pris le temps de nous faire part de votre mécontentement. Votre satisfaction est notre priorité.

Un manager du service clients va personnellement s'occuper de votre dossier et vous contacter sous 24h pour trouver une solution appropriée.

Nous nous engageons à rectifier cette situation.

L'équipe relation clients`,

        high: `Bonjour,

Nous avons reçu votre réclamation et nous en excusons sincèrement.

Un responsable senior va immédiatement prendre en charge votre dossier et vous contacter sous 4h avec une proposition de résolution concrète.

Votre satisfaction est notre priorité absolue.

Le responsable relation clients`,

        critical: `Bonjour,

Nous prenons votre réclamation très au sérieux et nous excusons profondément pour cette situation inacceptable.

La direction va personnellement intervenir et vous contacter dans l'heure qui suit pour résoudre cette situation et vous proposer une compensation appropriée.

Nous ferons tout notre possible pour regagner votre confiance.

La direction`,
      },

      general: {
        low: `Bonjour,

Merci pour votre message. Nous avons bien reçu votre demande d'information.

Notre équipe va traiter votre demande et vous répondre sous 48h ouvrées avec toutes les informations nécessaires.

N'hésitez pas à nous recontacter si vous avez d'autres questions.

Cordialement,
L'équipe support`,

        medium: `Bonjour,

Nous avons bien reçu votre demande et vous en remercions.

Un conseiller va examiner votre question et vous fournir une réponse complète sous 24h.

Merci de votre confiance.

L'équipe support`,

        high: `Bonjour,

Votre demande a été traitée en priorité.

Un conseiller spécialisé va vous répondre sous 4h avec toutes les informations demandées.

Merci de votre patience.

Le service clients`,

        critical: `Bonjour,

Votre demande urgente a été immédiatement transmise à notre équipe.

Vous recevrez une réponse détaillée dans l'heure qui suit.

Merci de nous avoir contactés.

L'équipe d'urgence`,
      },
    };

    const categoryTemplates = templates[category] || templates.general;
    return categoryTemplates[urgency] || categoryTemplates.medium;
  }

  private getPositiveReviewTemplate(): string {
    return `Bonjour {customerName},

Merci infiniment pour ce merveilleux avis ! 🌟

Nous sommes ravis que {productAspect} ait répondu à vos attentes. Votre satisfaction est notre plus belle récompense.

N'hésitez pas à nous recommander à vos proches, et merci encore pour votre confiance.

Très cordialement,
L'équipe {companyName}`;
  }

  private getNegativeReviewTemplate(): string {
    return `Bonjour {customerName},

Nous vous remercions pour ce retour, même s'il nous attriste profondément.

Nous prenons très au sérieux vos remarques concernant {issueAspect} et allons immédiatement investiguer pour comprendre ce qui s'est passé.

Un responsable va vous contacter personnellement sous 24h pour trouver une solution et s'assurer que vous soyez pleinement satisfait(e).

Nous vous présentons nos excuses et nous nous engageons à faire mieux.

Sincèrement,
L'équipe {companyName}`;
  }

  private getNeutralReviewTemplate(): string {
    return `Bonjour {customerName},

Merci pour ce retour constructif sur votre expérience.

Nous prenons en compte vos commentaires pour continuer à améliorer nos produits et services.

Si vous avez des suggestions spécifiques, nous serions ravis d'en discuter avec vous.

Cordialement,
L'équipe {companyName}`;
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  private determineTone(
    sentiment?: SentimentAnalysis,
    urgency?: string,
  ): 'formal' | 'friendly' | 'apologetic' | 'professional' {
    if (sentiment?.sentiment === 'negative' || urgency === 'critical') {
      return 'apologetic';
    }
    if (sentiment?.sentiment === 'positive') {
      return 'friendly';
    }
    if (urgency === 'high') {
      return 'professional';
    }
    return 'formal';
  }

  private personalizeResponse(
    template: string,
    ticket: ContactTicket | ContactFormData,
    tone: string,
  ): string {
    let response = template;

    // Personnalisation basique
    if ('name' in ticket) {
      response = response.replace(
        '{customerName}',
        ticket.name || 'Cher(e) client(e)',
      );
    }

    response = response.replace('{companyName}', 'notre entreprise');

    return response;
  }

  private personalizeReviewResponse(
    template: string,
    review: ReviewData,
  ): string {
    let response = template;

    response = response.replace(
      '{customerName}',
      review.customer?.cst_name || 'Cher(e) client(e)',
    );
    response = response.replace('{productAspect}', 'notre produit');
    response = response.replace('{issueAspect}', 'les points mentionnés');
    response = response.replace('{companyName}', 'notre entreprise');

    return response;
  }

  private calculateConfidence(
    category: string,
    urgency: string,
    messageText: string,
  ): number {
    let confidence = 0.7; // Base confidence

    // Bonus si catégorie bien définie
    if (['technical', 'billing', 'complaint'].includes(category)) {
      confidence += 0.1;
    }

    // Malus si urgence critique (nécessite plus d'attention humaine)
    if (urgency === 'critical') {
      confidence -= 0.2;
    }

    // Bonus si message court et simple
    if (messageText.length < 200) {
      confidence += 0.1;
    }

    return Math.max(0.3, Math.min(0.9, confidence));
  }

  private shouldRequireHuman(
    urgency: string,
    confidence: number,
    category: string,
  ): boolean {
    if (urgency === 'critical') return true;
    if (confidence < 0.6) return true;
    if (category === 'complaint' && urgency === 'high') return true;

    return false;
  }

  private getSuggestedActions(category: string, urgency: string): string[] {
    const actions = {
      technical: [
        'Vérifier les logs',
        'Reproduire le problème',
        'Contacter le support niveau 2',
      ],
      billing: [
        'Vérifier la facturation',
        'Contrôler les paiements',
        'Générer un avoir si nécessaire',
      ],
      complaint: [
        'Escalader au manager',
        'Proposer une compensation',
        'Suivre personnellement',
      ],
      general: [
        'Fournir les informations',
        'Orienter vers la bonne équipe',
        'Programmer un suivi',
      ],
    };

    const baseActions = actions[category] || actions.general;

    if (urgency === 'critical') {
      return ['URGENCE: Traiter immédiatement', ...baseActions];
    }

    return baseActions;
  }

  private estimateResolutionTime(category: string, urgency: string): number {
    const baseTimes = {
      technical: { low: 1440, medium: 480, high: 240, critical: 60 }, // minutes
      billing: { low: 2880, medium: 1440, high: 240, critical: 60 },
      complaint: { low: 2880, medium: 720, high: 240, critical: 30 },
      general: { low: 2880, medium: 1440, high: 480, critical: 120 },
    };

    const categoryTimes = baseTimes[category] || baseTimes.general;
    return categoryTimes[urgency] || categoryTimes.medium;
  }

  private getReviewActions(rating: number): string[] {
    if (rating >= 4) {
      return [
        'Remercier le client',
        'Partager en interne',
        'Utiliser comme témoignage',
      ];
    } else if (rating <= 2) {
      return [
        'Contacter le client',
        'Investiguer le problème',
        'Proposer une solution',
      ];
    } else {
      return [
        'Analyser les commentaires',
        'Identifier les améliorations possibles',
      ];
    }
  }

  private shouldPublishResponse(
    rating: number,
    sentiment?: SentimentAnalysis,
  ): boolean {
    // Publier automatiquement pour les avis positifs
    if (rating >= 4) return true;

    // Ne pas publier automatiquement pour les avis très négatifs
    if (rating <= 2) return false;

    // Pour les avis neutres, dépend du sentiment
    return sentiment?.sentiment !== 'negative';
  }

  private getFallbackResponse(): SmartResponse {
    return {
      response: `Bonjour,

Merci pour votre message. Nous avons bien reçu votre demande et allons la traiter dans les plus brefs délais.

Un membre de notre équipe vous recontactera sous 24h pour vous apporter une réponse personnalisée.

Merci de votre patience.

Cordialement,
L'équipe support`,
      confidence: 0.5,
      tone: 'professional',
      requiresHuman: true,
      suggestedActions: ['Examiner manuellement', 'Contacter le client'],
    };
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

@Injectable()
export class AIPredictiveService {
  private readonly logger = new Logger(AIPredictiveService.name);

  /**
   * Prédit le risque d'escalation d'un ticket
   */
  async predictEscalation(
    ticket: ContactTicket | ContactFormData,
    sentiment?: SentimentAnalysis,
    categorization?: SmartCategorization,
  ): Promise<EscalationPrediction> {
    try {
      const factors = this.calculateEscalationFactors(
        ticket,
        sentiment,
        categorization,
      );
      const riskLevel = this.calculateRiskLevel(factors);
      const escalationProbability =
        this.calculateEscalationProbability(factors);
      const timeToEscalation = this.estimateTimeToEscalation(factors);
      const priority = this.determinePriority(riskLevel);
      const suggestedActions = this.getEscalationActions(riskLevel, factors);
      const reasoning = this.generateReasoning(factors);

      return {
        riskLevel,
        escalationProbability,
        suggestedActions,
        timeToEscalation,
        priority,
        reasoning,
      };
    } catch (error) {
      this.logger.error(`Erreur prédiction escalation: ${error.message}`);
      return {
        riskLevel: 50,
        escalationProbability: 0.3,
        suggestedActions: ['Surveiller de près'],
        priority: 'medium',
        reasoning: 'Analyse standard par défaut',
      };
    }
  }

  /**
   * Optimise l'attribution des tickets
   */
  async optimizeWorkflow(
    ticket: ContactTicket | ContactFormData,
    categorization?: SmartCategorization,
  ): Promise<WorkflowOptimization> {
    try {
      const category = categorization?.category || ticket.category || 'general';
      const urgency = this.extractUrgency(ticket);

      const recommendedAgent = this.getRecommendedAgent(category, urgency);
      const estimatedTime = this.estimateWorkflowTime(category, urgency);
      const priority = this.calculateWorkflowPriority(urgency, category);
      const nextSteps = this.getSuggestedNextSteps(category);
      const automationOps = this.identifyAutomationOpportunities(
        category,
        ticket,
      );

      return {
        recommendedAgent,
        estimatedResolutionTime: estimatedTime,
        priority,
        suggestedNextSteps: nextSteps,
        automationOpportunities: automationOps,
      };
    } catch (error) {
      this.logger.error(`Erreur optimisation workflow: ${error.message}`);
      return {
        estimatedResolutionTime: 1440, // 24h par défaut
        priority: 5,
        suggestedNextSteps: ['Analyser la demande', 'Contacter le client'],
        automationOpportunities: [],
      };
    }
  }

  // ==================== MÉTHODES PRIVÉES ====================

  private calculateEscalationFactors(
    ticket: ContactTicket | ContactFormData,
    sentiment?: SentimentAnalysis,
    categorization?: SmartCategorization,
  ) {
    return {
      sentimentScore:
        sentiment?.sentiment === 'negative'
          ? 30
          : sentiment?.sentiment === 'positive'
            ? -10
            : 0,
      urgencyScore: this.getUrgencyScore(
        sentiment?.urgency || this.extractUrgency(ticket),
      ),
      categoryScore: this.getCategoryRiskScore(
        categorization?.category || ticket.category,
      ),
      emotionScore: sentiment?.emotions?.includes('colère') ? 25 : 0,
      timeScore: 0, // Pourrait être calculé selon l'heure/jour
      customerHistoryScore: 0, // À implémenter avec l'historique client
    };
  }

  private calculateRiskLevel(factors: any): number {
    const totalScore = Object.values(factors).reduce(
      (sum: number, score: any) => sum + Number(score),
      0,
    ) as number;
    return Math.max(0, Math.min(100, 50 + totalScore));
  }

  private calculateEscalationProbability(factors: any): number {
    const riskLevel = this.calculateRiskLevel(factors);
    return Math.min(0.9, riskLevel / 100);
  }

  private estimateTimeToEscalation(factors: any): number {
    const riskLevel = this.calculateRiskLevel(factors);

    if (riskLevel >= 80) return 30; // 30 minutes
    if (riskLevel >= 60) return 120; // 2 heures
    if (riskLevel >= 40) return 480; // 8 heures

    return 1440; // 24 heures
  }

  private determinePriority(
    riskLevel: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (riskLevel >= 80) return 'critical';
    if (riskLevel >= 60) return 'high';
    if (riskLevel >= 40) return 'medium';
    return 'low';
  }

  private getEscalationActions(riskLevel: number, factors: any): string[] {
    const actions = [];

    if (riskLevel >= 80) {
      actions.push('Escalader immédiatement au manager');
      actions.push('Contacter le client par téléphone');
    }

    if (riskLevel >= 60) {
      actions.push('Assigner à un agent senior');
      actions.push("Suivre de près l'évolution");
    }

    if (factors.emotionScore > 20) {
      actions.push('Réponse empathique requise');
    }

    if (actions.length === 0) {
      actions.push('Traitement standard');
    }

    return actions;
  }

  private generateReasoning(factors: any): string {
    const reasons = [];

    if (factors.sentimentScore > 20) {
      reasons.push('sentiment très négatif détecté');
    }

    if (factors.urgencyScore > 15) {
      reasons.push('urgence élevée');
    }

    if (factors.emotionScore > 20) {
      reasons.push('émotions fortes exprimées');
    }

    return reasons.length > 0
      ? `Risque élevé dû à: ${reasons.join(', ')}`
      : 'Facteurs de risque dans la normale';
  }

  private getUrgencyScore(urgency: string): number {
    const scores = { low: 0, medium: 5, high: 15, critical: 25 };
    return scores[urgency] || 5;
  }

  private getCategoryRiskScore(category?: string): number {
    const scores = {
      complaint: 20,
      billing: 15,
      technical: 10,
      general: 5,
    };
    return scores[category || 'general'] || 5;
  }

  private extractUrgency(ticket: ContactTicket | ContactFormData): string {
    if ('priority' in ticket) return ticket.priority;

    try {
      const content = JSON.parse(ticket.msg_content || '{}');
      return content.priority || 'medium';
    } catch {
      return 'medium';
    }
  }

  private getRecommendedAgent(category: string, urgency: string): string {
    const agentMapping = {
      technical: urgency === 'critical' ? 'senior-tech' : 'tech-support',
      billing: urgency === 'critical' ? 'billing-manager' : 'billing-team',
      complaint:
        urgency === 'high' ? 'customer-relations-senior' : 'customer-relations',
      general: 'general-support',
    };

    return agentMapping[category] || 'general-support';
  }

  private estimateWorkflowTime(category: string, urgency: string): number {
    // En minutes
    const baseTimes = {
      technical: { low: 480, medium: 240, high: 120, critical: 30 },
      billing: { low: 1440, medium: 480, high: 120, critical: 30 },
      complaint: { low: 1440, medium: 240, high: 60, critical: 15 },
      general: { low: 1440, medium: 480, high: 240, critical: 60 },
    };

    const categoryTimes = baseTimes[category] || baseTimes.general;
    return categoryTimes[urgency] || categoryTimes.medium;
  }

  private calculateWorkflowPriority(urgency: string, category: string): number {
    const urgencyPoints = { low: 1, medium: 3, high: 7, critical: 10 };
    const categoryPoints = {
      complaint: 3,
      billing: 2,
      technical: 2,
      general: 1,
    };

    return (urgencyPoints[urgency] || 3) + (categoryPoints[category] || 1);
  }

  private getSuggestedNextSteps(category: string): string[] {
    const steps = {
      technical: [
        'Reproduire le problème',
        'Consulter la base de connaissances',
        'Escalader si nécessaire',
      ],
      billing: [
        'Vérifier les données de facturation',
        'Contrôler les paiements',
        'Proposer une solution',
      ],
      complaint: [
        'Écouter activement le client',
        'Investiguer le problème',
        'Proposer une compensation si approprié',
      ],
      general: [
        'Analyser la demande',
        'Fournir les informations demandées',
        'Programmer un suivi',
      ],
    };

    return steps[category] || steps.general;
  }

  private identifyAutomationOpportunities(
    category: string,
    ticket: ContactTicket | ContactFormData,
  ): string[] {
    const opportunities = [];

    const message = this.extractMessage(ticket);

    if (message.includes('mot de passe') || message.includes('password')) {
      opportunities.push(
        'Lien automatique de réinitialisation de mot de passe',
      );
    }

    if (message.includes('facture') || message.includes('invoice')) {
      opportunities.push('Envoi automatique de la facture par email');
    }

    if (category === 'general' && message.includes('horaires')) {
      opportunities.push("Réponse automatique avec les horaires d'ouverture");
    }

    return opportunities;
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
