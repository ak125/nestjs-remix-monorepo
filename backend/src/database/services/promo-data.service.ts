import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';
import { ConfigService } from '@nestjs/config';

/**
 * 🎫 SERVICE DE DONNÉES CODES PROMO
 *
 * Service spécialisé pour la gestion des codes promotionnels
 * Suit l'architecture modulaire mise en place
 *
 * Responsabilités:
 * - Validation des codes promo
 * - Historique d'utilisation
 * - Gestion des limites d'usage
 */
@Injectable()
export class PromoDataService extends SupabaseBaseService {
  protected readonly logger = new Logger(PromoDataService.name);

  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('PromoDataService initialized');
  }

  /**
   * Récupère un code promo par son code
   */
  async getPromoByCode(code: string): Promise<any | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/promo_codes?code=eq.${code.toUpperCase()}&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data[0] || null;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération du code promo', error);
      return null;
    }
  }

  /**
   * Récupère un code promo actif et valide
   */
  async getValidPromoByCode(code: string): Promise<any | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/promo_codes?code=eq.${code.toUpperCase()}&active=eq.true&valid_from=lte.now()&valid_until=gte.now()&select=*`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data[0] || null;
    } catch (error) {
      this.logger.error('Erreur lors de la validation du code promo', error);
      return null;
    }
  }

  /**
   * Vérifie si un utilisateur a déjà utilisé un code promo
   */
  async checkPromoUsage(promoId: number, userId: number): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/promo_usage?promo_id=eq.${promoId}&user_id=eq.${userId}&select=id`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.length > 0;
    } catch (error) {
      this.logger.error("Erreur lors de la vérification d'utilisation", error);
      return false;
    }
  }

  /**
   * Enregistre l'utilisation d'un code promo
   */
  async recordPromoUsage(
    promoId: number,
    userId: number,
    orderId: number,
  ): Promise<boolean> {
    try {
      // Enregistrer l'utilisation
      const usageResponse = await fetch(`${this.baseUrl}/promo_usage`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          promo_id: promoId,
          user_id: userId,
          order_id: orderId,
          used_at: new Date().toISOString(),
        }),
      });

      if (!usageResponse.ok) {
        throw new Error(`HTTP error! status: ${usageResponse.status}`);
      }

      // Incrémenter le compteur d'utilisation
      const updateResponse = await fetch(
        `${this.baseUrl}/promo_codes?id=eq.${promoId}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({
            usage_count: 'usage_count + 1', // PostgreSQL expression
          }),
        },
      );

      return updateResponse.ok;
    } catch (error) {
      this.logger.error("Erreur lors de l'enregistrement d'utilisation", error);
      return false;
    }
  }

  /**
   * Récupère l'historique d'utilisation d'un code promo
   */
  async getPromoUsageHistory(promoId: number): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/promo_usage?promo_id=eq.${promoId}&select=*,___xtr_customer(*)&order=used_at.desc`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(
        "Erreur lors de la récupération de l'historique",
        error,
      );
      return [];
    }
  }

  /**
   * Met à jour un code promo
   */
  async updatePromoCode(promoId: number, updates: any): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/promo_codes?id=eq.${promoId}`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify(updates),
        },
      );

      return response.ok;
    } catch (error) {
      this.logger.error('Erreur lors de la mise à jour du code promo', error);
      return false;
    }
  }
}
