import { Injectable, Logger } from '@nestjs/common';

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags: string[];
  order: number;
  published: boolean;
  helpful: number;
  notHelpful: number;
  views: number;
  lastUpdated: Date;
  createdBy: string;
  updatedBy?: string;
}

export interface FAQCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  order: number;
  published: boolean;
  faqCount: number;
}

export interface FAQStats {
  totalFAQs: number;
  publishedFAQs: number;
  totalViews: number;
  totalCategories: number;
  mostViewedFAQ: FAQ | null;
  mostHelpfulFAQ: FAQ | null;
  categoryStats: Record<string, { faqs: number; views: number }>;
}

@Injectable()
export class FaqService {
  private readonly logger = new Logger(FaqService.name);
  private faqs: Map<string, FAQ> = new Map();
  private categories: Map<string, FAQCategory> = new Map();

  constructor() {
    this.initializeDefaultCategories();
    this.initializeDefaultFAQs();
  }

  private initializeDefaultCategories(): void {
    const defaultCategories: Omit<FAQCategory, 'faqCount'>[] = [
      {
        id: 'orders',
        name: 'Commandes',
        description: 'Questions sur le processus de commande',
        icon: '📦',
        order: 1,
        published: true,
      },
      {
        id: 'shipping',
        name: 'Livraison',
        description: 'Informations sur la livraison',
        icon: '🚚',
        order: 2,
        published: true,
      },
      {
        id: 'returns',
        name: 'Retours',
        description: 'Politique de retour et échange',
        icon: '↩️',
        order: 3,
        published: true,
      },
      {
        id: 'payment',
        name: 'Paiement',
        description: 'Méthodes de paiement et facturation',
        icon: '💳',
        order: 4,
        published: true,
      },
      {
        id: 'technical',
        name: 'Support technique',
        description: 'Aide technique et installation',
        icon: '🔧',
        order: 5,
        published: true,
      },
      {
        id: 'account',
        name: 'Compte client',
        description: 'Gestion de votre compte',
        icon: '👤',
        order: 6,
        published: true,
      },
    ];

    defaultCategories.forEach((category) => {
      this.categories.set(category.id, { ...category, faqCount: 0 });
    });

    this.logger.log(`Initialized ${defaultCategories.length} FAQ categories`);
  }

  private initializeDefaultFAQs(): void {
    const defaultFAQs: Omit<FAQ, 'helpful' | 'notHelpful' | 'views'>[] = [
      {
        id: 'order-status',
        question: 'Comment puis-je suivre ma commande ?',
        answer:
          'Vous pouvez suivre votre commande en vous connectant à votre compte et en consultant la section "Mes commandes". Vous recevrez également un email avec le numéro de suivi dès que votre commande sera expédiée.',
        category: 'orders',
        tags: ['suivi', 'commande', 'statut'],
        order: 1,
        published: true,
        lastUpdated: new Date(),
        createdBy: 'system',
      },
      {
        id: 'delivery-time',
        question: 'Quels sont les délais de livraison ?',
        answer:
          'Les délais de livraison standard sont de 2-3 jours ouvrés pour la France métropolitaine. Pour les commandes urgentes, nous proposons une livraison express en 24h.',
        category: 'shipping',
        tags: ['livraison', 'délai', 'express'],
        order: 1,
        published: true,
        lastUpdated: new Date(),
        createdBy: 'system',
      },
      {
        id: 'return-policy',
        question: 'Quelle est votre politique de retour ?',
        answer:
          "Vous disposez de 14 jours pour retourner un produit. Les produits doivent être dans leur emballage d'origine et en parfait état. Les frais de retour sont à votre charge sauf en cas de produit défectueux.",
        category: 'returns',
        tags: ['retour', 'remboursement', 'échange'],
        order: 1,
        published: true,
        lastUpdated: new Date(),
        createdBy: 'system',
      },
      {
        id: 'payment-methods',
        question: 'Quels moyens de paiement acceptez-vous ?',
        answer:
          'Nous acceptons les cartes bancaires (Visa, Mastercard), PayPal, et les virements bancaires pour les commandes professionnelles.',
        category: 'payment',
        tags: ['paiement', 'carte', 'paypal'],
        order: 1,
        published: true,
        lastUpdated: new Date(),
        createdBy: 'system',
      },
    ];

    defaultFAQs.forEach((faq) => {
      this.faqs.set(faq.id, { ...faq, helpful: 0, notHelpful: 0, views: 0 });
      this.updateCategoryCount(faq.category);
    });

    this.logger.log(`Initialized ${defaultFAQs.length} default FAQs`);
  }

  async createFAQ(
    faqData: Omit<
      FAQ,
      'id' | 'helpful' | 'notHelpful' | 'views' | 'lastUpdated'
    >,
  ): Promise<FAQ> {
    this.validateFAQ(faqData);

    const faq: FAQ = {
      ...faqData,
      id: this.generateFAQId(),
      helpful: 0,
      notHelpful: 0,
      views: 0,
      lastUpdated: new Date(),
    };

    this.faqs.set(faq.id, faq);
    this.updateCategoryCount(faq.category);

    this.logger.log(`FAQ created: ${faq.id}`);
    return faq;
  }

  async getFAQ(
    faqId: string,
    incrementView: boolean = false,
  ): Promise<FAQ | null> {
    const faq = this.faqs.get(faqId);
    if (!faq) return null;

    if (incrementView) {
      faq.views += 1;
      this.faqs.set(faqId, faq);
    }

    return faq;
  }

  async getAllFAQs(filters?: {
    category?: string;
    published?: boolean;
    tags?: string[];
    search?: string;
  }): Promise<FAQ[]> {
    let faqs = Array.from(this.faqs.values());

    if (filters) {
      if (filters.category) {
        faqs = faqs.filter((f) => f.category === filters.category);
      }
      if (filters.published !== undefined) {
        faqs = faqs.filter((f) => f.published === filters.published);
      }
      if (filters.tags && filters.tags.length > 0) {
        faqs = faqs.filter((f) =>
          filters.tags!.some((tag) => f.tags.includes(tag)),
        );
      }
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        faqs = faqs.filter(
          (f) =>
            f.question.toLowerCase().includes(searchLower) ||
            f.answer.toLowerCase().includes(searchLower) ||
            f.tags.some((tag) => tag.toLowerCase().includes(searchLower)),
        );
      }
    }

    return faqs.sort((a, b) => {
      if (a.category !== b.category) {
        const catA = this.categories.get(a.category);
        const catB = this.categories.get(b.category);
        return (catA?.order || 999) - (catB?.order || 999);
      }
      return a.order - b.order;
    });
  }

  async updateFAQ(
    faqId: string,
    updates: Partial<Omit<FAQ, 'id' | 'helpful' | 'notHelpful' | 'views'>>,
  ): Promise<FAQ> {
    const faq = this.faqs.get(faqId);
    if (!faq) {
      throw new Error(`FAQ ${faqId} not found`);
    }

    const oldCategory = faq.category;
    const updatedFAQ = { ...faq, ...updates, lastUpdated: new Date() };

    if (updates.category && updates.category !== oldCategory) {
      this.updateCategoryCount(oldCategory, -1);
      this.updateCategoryCount(updates.category, 1);
    }

    this.faqs.set(faqId, updatedFAQ);
    this.logger.log(`FAQ updated: ${faqId}`);

    return updatedFAQ;
  }

  async deleteFAQ(faqId: string): Promise<void> {
    const faq = this.faqs.get(faqId);
    if (!faq) {
      throw new Error(`FAQ ${faqId} not found`);
    }

    this.faqs.delete(faqId);
    this.updateCategoryCount(faq.category, -1);
    this.logger.log(`FAQ deleted: ${faqId}`);
  }

  async markHelpful(faqId: string, helpful: boolean): Promise<FAQ> {
    const faq = this.faqs.get(faqId);
    if (!faq) {
      throw new Error(`FAQ ${faqId} not found`);
    }

    if (helpful) {
      faq.helpful += 1;
    } else {
      faq.notHelpful += 1;
    }

    this.faqs.set(faqId, faq);
    return faq;
  }

  async createCategory(
    categoryData: Omit<FAQCategory, 'faqCount'>,
  ): Promise<FAQCategory> {
    this.validateCategory(categoryData);

    const category: FAQCategory = { ...categoryData, faqCount: 0 };
    this.categories.set(category.id, category);

    this.logger.log(`FAQ category created: ${category.id}`);
    return category;
  }

  async getCategory(categoryId: string): Promise<FAQCategory | null> {
    return this.categories.get(categoryId) || null;
  }

  async getAllCategories(
    publishedOnly: boolean = false,
  ): Promise<FAQCategory[]> {
    let categories = Array.from(this.categories.values());

    if (publishedOnly) {
      categories = categories.filter((c) => c.published);
    }

    return categories.sort((a, b) => a.order - b.order);
  }

  async updateCategory(
    categoryId: string,
    updates: Partial<Omit<FAQCategory, 'faqCount'>>,
  ): Promise<FAQCategory> {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    const updatedCategory = { ...category, ...updates };
    this.categories.set(categoryId, updatedCategory);
    this.logger.log(`FAQ category updated: ${categoryId}`);

    return updatedCategory;
  }

  async deleteCategory(categoryId: string): Promise<void> {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    // Check if category has FAQs
    const faqsInCategory = Array.from(this.faqs.values()).filter(
      (f) => f.category === categoryId,
    );

    if (faqsInCategory.length > 0) {
      throw new Error('Cannot delete category with existing FAQs');
    }

    this.categories.delete(categoryId);
    this.logger.log(`FAQ category deleted: ${categoryId}`);
  }

  async getFAQStats(): Promise<FAQStats> {
    const faqs = Array.from(this.faqs.values());
    const categories = Array.from(this.categories.values());

    const totalFAQs = faqs.length;
    const publishedFAQs = faqs.filter((f) => f.published).length;
    const totalViews = faqs.reduce((sum, f) => sum + f.views, 0);
    const totalCategories = categories.filter((c) => c.published).length;

    // Most viewed FAQ
    const mostViewedFAQ = faqs.reduce(
      (max, f) => (f.views > (max?.views || 0) ? f : max),
      null as FAQ | null,
    );

    // Most helpful FAQ
    const mostHelpfulFAQ = faqs.reduce(
      (max, f) => {
        const helpfulRatio =
          f.helpful + f.notHelpful > 0
            ? f.helpful / (f.helpful + f.notHelpful)
            : 0;
        const maxRatio =
          max && max.helpful + max.notHelpful > 0
            ? max.helpful / (max.helpful + max.notHelpful)
            : 0;
        return helpfulRatio > maxRatio ? f : max;
      },
      null as FAQ | null,
    );

    // Category stats
    const categoryStats: Record<string, { faqs: number; views: number }> = {};
    categories.forEach((cat) => {
      const categoryFAQs = faqs.filter((f) => f.category === cat.id);
      categoryStats[cat.id] = {
        faqs: categoryFAQs.length,
        views: categoryFAQs.reduce((sum, f) => sum + f.views, 0),
      };
    });

    return {
      totalFAQs,
      publishedFAQs,
      totalViews,
      totalCategories,
      mostViewedFAQ,
      mostHelpfulFAQ,
      categoryStats,
    };
  }

  private validateFAQ(
    data: Omit<FAQ, 'id' | 'helpful' | 'notHelpful' | 'views' | 'lastUpdated'>,
  ): void {
    if (!data.question || data.question.length < 10) {
      throw new Error('Question must be at least 10 characters');
    }

    if (!data.answer || data.answer.length < 20) {
      throw new Error('Answer must be at least 20 characters');
    }

    if (!data.category) {
      throw new Error('Category is required');
    }

    if (!this.categories.has(data.category)) {
      throw new Error('Invalid category');
    }

    if (data.order < 0) {
      throw new Error('Order must be a positive number');
    }
  }

  private validateCategory(data: Omit<FAQCategory, 'faqCount'>): void {
    if (!data.id || !data.name) {
      throw new Error('Category ID and name are required');
    }

    if (this.categories.has(data.id)) {
      throw new Error('Category ID already exists');
    }

    if (data.order < 0) {
      throw new Error('Order must be a positive number');
    }
  }

  private updateCategoryCount(categoryId: string, delta: number = 1): void {
    const category = this.categories.get(categoryId);
    if (category) {
      category.faqCount = Math.max(0, category.faqCount + delta);
      this.categories.set(categoryId, category);
    }
  }

  private generateFAQId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `FAQ-${timestamp}-${random}`.toUpperCase();
  }
}
