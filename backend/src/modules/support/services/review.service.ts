import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { NotificationService } from './notification.service';

export interface ReviewData {
  msg_id: string;
  msg_cst_id: string; // Client ID
  msg_cnfa_id?: string; // Staff ID si modéré
  msg_ord_id?: string; // Order ID pour vérification d'achat
  msg_date: string;
  msg_subject: string; // Titre de l'avis
  msg_content: string; // Contenu JSON avec rating, comment, etc.
  msg_parent_id?: string; // Pour les réponses du staff
  msg_open: '0' | '1'; // 1 = en cours de modération, 0 = traité
  msg_close: '0' | '1'; // 1 = publié/rejeté, 0 = en attente

  // Données dérivées du JSON dans msg_content
  rating: number;
  title: string;
  comment: string;
  product_id?: string;
  images?: string[];
  verified: boolean;
  moderated: boolean;
  published: boolean;
  helpful: number;
  notHelpful: number;
  moderatorNote?: string;
  moderatedBy?: string;
  moderatedAt?: Date;

  // Informations client
  customer?: {
    cst_name: string;
    cst_fname: string;
    cst_mail: string;
    cst_phone?: string;
  };

  // Informations produit
  product?: {
    pce_id: string;
    pce_designation: string;
    pce_marque?: string;
    pce_prix_ttc?: number;
  };
}

export interface ReviewCreateRequest {
  name: string;
  email: string;
  product_id: string;
  order_id?: string; // Pour vérification d'achat
  rating: number; // 1-5
  title: string;
  comment: string;
  images?: string[];
  customer_id?: string; // ID du client existant si connecté
}

export interface ReviewFilters {
  rating?: number;
  published?: boolean;
  moderated?: boolean;
  verified?: boolean;
  product_id?: string;
  customer_id?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ReviewStats {
  total: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  totalPublished: number;
  totalPending: number;
  totalRejected: number;
  verifiedReviews: number;
}

@Injectable()
export class ReviewService extends SupabaseBaseService {
  protected readonly logger = new Logger(ReviewService.name);

  constructor(private notificationService: NotificationService) {
    super();
  }

  /**
   * Soumettre un nouvel avis produit
   */
  async submitReview(reviewData: ReviewCreateRequest): Promise<ReviewData> {
    try {
      this.validateReviewData(reviewData);

      // Vérifier ou créer le client
      const customer = await this.findOrCreateCustomer(
        reviewData.customer_id,
        reviewData.name,
        reviewData.email,
      );

      // Vérifier l'achat si un order_id est fourni
      const verified = reviewData.order_id
        ? await this.verifyPurchase(
            customer.cst_id,
            reviewData.product_id,
            reviewData.order_id,
          )
        : false;

      // Préparer le contenu JSON
      const contentData = {
        type: 'review',
        rating: reviewData.rating,
        comment: reviewData.comment,
        product_id: reviewData.product_id,
        images: reviewData.images || [],
        verified,
        moderated: false,
        published: false, // Nécessite modération par défaut
        helpful: 0,
        notHelpful: 0,
        createdAt: new Date().toISOString(),
      };

      // Créer le message d'avis dans ___xtr_msg
      const { data: reviewMessage, error } = await this.supabase
        .from('___xtr_msg')
        .insert({
          msg_cst_id: customer.cst_id,
          msg_ord_id: reviewData.order_id || null,
          msg_date: new Date().toISOString(),
          msg_subject: reviewData.title,
          msg_content: JSON.stringify(contentData),
          msg_open: '1', // En cours de modération
          msg_close: '0', // Pas encore traité
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(
          `Erreur lors de la création de l'avis: ${error.message}`,
        );
      }

      // Enrichir avec les données client et produit
      const enrichedReview = await this.enrichReviewData(reviewMessage);

      // Notifier le personnel
      await this.notificationService.notifyNewReview({
        customerName: `${customer.cst_fname} ${customer.cst_name}`,
        rating: reviewData.rating,
        comment: reviewData.comment,
      });

      this.logger.log(
        `Avis soumis: ${reviewMessage.msg_id} - Note: ${reviewData.rating}/5`,
      );
      return enrichedReview;
    } catch (error) {
      this.logger.error(
        `Échec de soumission d'avis: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Récupérer un avis par ID
   */
  async getReview(reviewId: string): Promise<ReviewData | null> {
    try {
      const { data: message, error } = await this.supabase
        .from('___xtr_msg')
        .select('*')
        .eq('msg_id', reviewId)
        .single();

      if (error || !message) {
        return null;
      }

      // Vérifier que c'est bien un avis
      const content = JSON.parse(message.msg_content || '{}');
      if (content.type !== 'review') {
        return null;
      }

      return await this.enrichReviewData(message);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération de l'avis ${reviewId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Récupérer les avis avec filtres
   */
  async getReviews(filters?: ReviewFilters): Promise<ReviewData[]> {
    try {
      let query = this.supabase
        .from('___xtr_msg')
        .select('*')
        .like('msg_content', '%"type":"review"%')
        .order('msg_date', { ascending: false });

      // Appliquer les filtres
      if (filters) {
        if (filters.customer_id) {
          query = query.eq('msg_cst_id', filters.customer_id);
        }
        if (filters.startDate) {
          query = query.gte('msg_date', filters.startDate.toISOString());
        }
        if (filters.endDate) {
          query = query.lte('msg_date', filters.endDate.toISOString());
        }
      }

      const { data: messages, error } = await query;

      if (error) {
        throw new Error(
          `Erreur lors de la récupération des avis: ${error.message}`,
        );
      }

      // Enrichir les données et appliquer les filtres JSON
      const reviews = await Promise.all(
        messages.map((message) => this.enrichReviewData(message)),
      );

      return this.applyContentFilters(reviews, filters);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des avis: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Modérer un avis (approuver ou rejeter)
   */
  async moderateReview(
    reviewId: string,
    action: 'approve' | 'reject',
    moderatorId: string,
    moderatorNote?: string,
  ): Promise<ReviewData> {
    try {
      const review = await this.getReview(reviewId);
      if (!review) {
        throw new NotFoundException(`Avis ${reviewId} introuvable`);
      }

      // Mettre à jour le contenu JSON
      const content = JSON.parse(review.msg_content || '{}');
      content.moderated = true;
      content.published = action === 'approve';
      content.moderatedBy = moderatorId;
      content.moderatedAt = new Date().toISOString();
      content.moderatorNote = moderatorNote;

      // Mettre à jour le message
      const { data: updatedMessage, error } = await this.supabase
        .from('___xtr_msg')
        .update({
          msg_content: JSON.stringify(content),
          msg_cnfa_id: moderatorId,
          msg_open: '0', // Plus en cours de modération
          msg_close: '1', // Traité
        })
        .eq('msg_id', reviewId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erreur lors de la modération: ${error.message}`);
      }

      this.logger.log(
        `Avis ${reviewId} ${action === 'approve' ? 'approuvé' : 'rejeté'} par ${moderatorId}`,
      );
      return await this.enrichReviewData(updatedMessage);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la modération de l'avis ${reviewId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Marquer un avis comme utile ou non
   */
  async markHelpful(reviewId: string, helpful: boolean): Promise<ReviewData> {
    try {
      const review = await this.getReview(reviewId);
      if (!review) {
        throw new NotFoundException(`Avis ${reviewId} introuvable`);
      }

      // Mettre à jour le contenu JSON
      const content = JSON.parse(review.msg_content || '{}');
      if (helpful) {
        content.helpful = (content.helpful || 0) + 1;
      } else {
        content.notHelpful = (content.notHelpful || 0) + 1;
      }

      // Mettre à jour le message
      const { data: updatedMessage, error } = await this.supabase
        .from('___xtr_msg')
        .update({
          msg_content: JSON.stringify(content),
        })
        .eq('msg_id', reviewId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erreur lors de la mise à jour: ${error.message}`);
      }

      return await this.enrichReviewData(updatedMessage);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour de l'avis ${reviewId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Obtenir les statistiques des avis
   */
  async getReviewStats(
    filters?: Omit<ReviewFilters, 'published'>,
  ): Promise<ReviewStats> {
    try {
      const reviews = await this.getReviews(filters);

      const total = reviews.length;
      const totalPublished = reviews.filter((r) => r.published).length;
      const totalPending = reviews.filter((r) => !r.moderated).length;
      const totalRejected = reviews.filter(
        (r) => r.moderated && !r.published,
      ).length;
      const verifiedReviews = reviews.filter((r) => r.verified).length;

      // Calculer la note moyenne
      const averageRating =
        total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;

      // Distribution des notes
      const ratingDistribution: Record<string, number> = {};
      for (let i = 1; i <= 5; i++) {
        ratingDistribution[i.toString()] = reviews.filter(
          (r) => r.rating === i,
        ).length;
      }

      return {
        total,
        averageRating: Math.round(averageRating * 100) / 100,
        ratingDistribution,
        totalPublished,
        totalPending,
        totalRejected,
        verifiedReviews,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors du calcul des statistiques: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Obtenir les avis d'un produit
   */
  async getProductReviews(productId: string): Promise<ReviewData[]> {
    return this.getReviews({ product_id: productId, published: true });
  }

  /**
   * Obtenir les avis d'un client
   */
  async getCustomerReviews(customerId: string): Promise<ReviewData[]> {
    return this.getReviews({ customer_id: customerId });
  }

  /**
   * Vérifier le statut d'un avis
   */
  async verifyReview(reviewId: string, verified: boolean): Promise<ReviewData> {
    try {
      const review = await this.getReview(reviewId);
      if (!review) {
        throw new NotFoundException(`Avis ${reviewId} introuvable`);
      }

      // Mettre à jour le contenu JSON
      const content = JSON.parse(review.msg_content || '{}');
      content.verified = verified;

      // Mettre à jour le message
      const { data: updatedMessage, error } = await this.supabase
        .from('___xtr_msg')
        .update({
          msg_content: JSON.stringify(content),
        })
        .eq('msg_id', reviewId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Erreur lors de la vérification: ${error.message}`);
      }

      this.logger.log(
        `Statut de vérification de l'avis ${reviewId} mis à jour: ${verified}`,
      );
      return await this.enrichReviewData(updatedMessage);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la vérification de l'avis ${reviewId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Supprimer un avis
   */
  async deleteReview(reviewId: string): Promise<void> {
    try {
      const review = await this.getReview(reviewId);
      if (!review) {
        throw new NotFoundException(`Avis ${reviewId} introuvable`);
      }

      const { error } = await this.supabase
        .from('___xtr_msg')
        .delete()
        .eq('msg_id', reviewId);

      if (error) {
        throw new Error(`Erreur lors de la suppression: ${error.message}`);
      }

      this.logger.log(`Avis ${reviewId} supprimé`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression de l'avis ${reviewId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  /**
   * Trouver ou créer un client
   */
  private async findOrCreateCustomer(
    customerId?: string,
    name?: string,
    email?: string,
  ): Promise<any> {
    try {
      if (customerId) {
        // Rechercher le client existant
        const { data: customer, error } = await this.supabase
          .from('___xtr_customer')
          .select('*')
          .eq('cst_id', customerId)
          .single();

        if (customer && !error) {
          return customer;
        }
      }

      if (email) {
        // Rechercher par email
        const { data: customer, error } = await this.supabase
          .from('___xtr_customer')
          .select('*')
          .eq('cst_mail', email)
          .single();

        if (customer && !error) {
          return customer;
        }
      }

      // Créer un nouveau client si pas trouvé
      if (name && email) {
        const [firstName, ...lastNameParts] = name.split(' ');
        const lastName = lastNameParts.join(' ') || firstName;

        const { data: newCustomer, error } = await this.supabase
          .from('___xtr_customer')
          .insert({
            cst_fname: firstName,
            cst_name: lastName,
            cst_mail: email,
            cst_date: new Date().toISOString(),
          })
          .select('*')
          .single();

        if (error) {
          throw new Error(
            `Erreur lors de la création du client: ${error.message}`,
          );
        }

        return newCustomer;
      }

      throw new Error('Informations client insuffisantes');
    } catch (error) {
      this.logger.error(
        `Erreur dans findOrCreateCustomer: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Vérifier si un client a acheté un produit
   */
  private async verifyPurchase(
    customerId: string,
    productId: string,
    orderId?: string,
  ): Promise<boolean> {
    try {
      let query = this.supabase
        .from('___xtr_order_line')
        .select('*, ___xtr_order!inner(*)')
        .eq('ordl_pce_id', productId)
        .eq('___xtr_order.ord_cst_id', customerId);

      if (orderId) {
        query = query.eq('ordl_ord_id', orderId);
      }

      const { data: orderLines, error } = await query;

      if (error) {
        this.logger.error(
          `Erreur lors de la vérification d'achat: ${error.message}`,
        );
        return false;
      }

      return orderLines && orderLines.length > 0;
    } catch (error) {
      this.logger.error(
        `Erreur dans verifyPurchase: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Enrichir les données d'avis avec informations client et produit
   */
  private async enrichReviewData(message: any): Promise<ReviewData> {
    try {
      const content = JSON.parse(message.msg_content || '{}');

      // Récupérer les informations client
      const { data: customer } = await this.supabase
        .from('___xtr_customer')
        .select('*')
        .eq('cst_id', message.msg_cst_id)
        .single();

      // Récupérer les informations produit si disponible
      let product = null;
      if (content.product_id) {
        const { data: productData } = await this.supabase
          .from('pieces')
          .select('*')
          .eq('pce_id', content.product_id)
          .single();
        product = productData;
      }

      // Construire l'objet ReviewData
      return {
        msg_id: message.msg_id,
        msg_cst_id: message.msg_cst_id,
        msg_cnfa_id: message.msg_cnfa_id,
        msg_ord_id: message.msg_ord_id,
        msg_date: message.msg_date,
        msg_subject: message.msg_subject,
        msg_content: message.msg_content,
        msg_parent_id: message.msg_parent_id,
        msg_open: message.msg_open,
        msg_close: message.msg_close,

        // Données dérivées du JSON
        rating: content.rating || 0,
        title: message.msg_subject || '',
        comment: content.comment || '',
        product_id: content.product_id,
        images: content.images || [],
        verified: content.verified || false,
        moderated: content.moderated || false,
        published: content.published || false,
        helpful: content.helpful || 0,
        notHelpful: content.notHelpful || 0,
        moderatorNote: content.moderatorNote,
        moderatedBy: content.moderatedBy,
        moderatedAt: content.moderatedAt
          ? new Date(content.moderatedAt)
          : undefined,

        // Informations client
        customer: customer || undefined,

        // Informations produit
        product: product || undefined,
      };
    } catch (error) {
      this.logger.error(
        `Erreur dans enrichReviewData: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Appliquer les filtres basés sur le contenu JSON
   */
  private applyContentFilters(
    reviews: ReviewData[],
    filters?: ReviewFilters,
  ): ReviewData[] {
    if (!filters) {
      return reviews;
    }

    return reviews
      .filter((review) => {
        if (filters.rating !== undefined && review.rating !== filters.rating) {
          return false;
        }
        if (
          filters.published !== undefined &&
          review.published !== filters.published
        ) {
          return false;
        }
        if (
          filters.moderated !== undefined &&
          review.moderated !== filters.moderated
        ) {
          return false;
        }
        if (
          filters.verified !== undefined &&
          review.verified !== filters.verified
        ) {
          return false;
        }
        if (filters.product_id && review.product_id !== filters.product_id) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.msg_date).getTime() - new Date(a.msg_date).getTime(),
      );
  }

  /**
   * Valider les données d'avis
   */
  private validateReviewData(data: ReviewCreateRequest): void {
    if (!data.name || !data.email) {
      throw new BadRequestException('Nom et email requis');
    }

    if (!data.product_id) {
      throw new BadRequestException('ID produit requis');
    }

    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('La note doit être entre 1 et 5');
    }

    if (!data.title || data.title.length < 5) {
      throw new BadRequestException(
        'Le titre doit contenir au moins 5 caractères',
      );
    }

    if (!data.comment || data.comment.length < 10) {
      throw new BadRequestException(
        'Le commentaire doit contenir au moins 10 caractères',
      );
    }

    if (data.comment.length > 2000) {
      throw new BadRequestException(
        'Le commentaire ne peut pas dépasser 2000 caractères',
      );
    }

    if (data.images && data.images.length > 5) {
      throw new BadRequestException('Maximum 5 images par avis');
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new BadRequestException('Format email invalide');
    }
  }
}
