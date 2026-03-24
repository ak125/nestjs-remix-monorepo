import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '../../../cache/cache.service';

/**
 * 📊 SERVICE D'ANALYTICS PANIER
 *
 * Suivi et analyse des comportements d'achat:
 * - Taux d'abandon de panier
 * - Valeur moyenne du panier
 * - Taux de conversion
 * - Produits fréquemment abandonnés
 * - Durée moyenne dans le panier
 */
@Injectable()
export class CartAnalyticsService {
  protected readonly logger = new Logger(CartAnalyticsService.name);

  // Préfixes Redis pour les analytics
  private readonly ANALYTICS_PREFIX = 'analytics:cart:';
  private readonly CART_CREATED_KEY = `${this.ANALYTICS_PREFIX}created`;
  private readonly CART_CONVERTED_KEY = `${this.ANALYTICS_PREFIX}converted`;
  private readonly CART_ABANDONED_KEY = `${this.ANALYTICS_PREFIX}abandoned`;
  private readonly CART_VALUES_KEY = `${this.ANALYTICS_PREFIX}values`;
  private readonly PRODUCT_ABANDONED_KEY = `${this.ANALYTICS_PREFIX}products_abandoned`;

  // Durées
  private readonly ABANDONED_AFTER_MINUTES = 60; // Considéré abandonné après 60min
  private readonly ANALYTICS_TTL = 30 * 24 * 60 * 60; // 30 jours

  constructor(
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('📊 CartAnalyticsService initialized');
  }

  /**
   * 📝 Enregistrer la création d'un panier
   */
  async trackCartCreated(
    sessionId: string,
    cartData: {
      itemCount: number;
      subtotal: number;
      timestamp: number;
    },
  ): Promise<void> {
    try {
      // Incrémenter compteur global
      await this.incrementCounter(this.CART_CREATED_KEY);

      // Stocker données du panier pour suivi abandon
      const cartKey = `${this.ANALYTICS_PREFIX}cart:${sessionId}`;
      await this.cacheService.set(
        cartKey,
        {
          ...cartData,
          status: 'active',
        },
        this.ANALYTICS_TTL,
      );

      this.logger.log(`📝 Panier créé tracké: ${sessionId}`);

      // Emit event for abandoned cart detection (decoupled via EventEmitter)
      const userId = parseInt(sessionId, 10);
      if (!isNaN(userId) && userId > 0) {
        this.eventEmitter.emit('cart.activity', { userId, sessionId });
      }
    } catch (error) {
      this.logger.error('Erreur trackCartCreated:', error);
    }
  }

  /**
   * ✅ Enregistrer une conversion (commande validée)
   */
  async trackCartConverted(
    sessionId: string,
    orderData: {
      orderId: number;
      total: number;
      itemCount: number;
      timestamp: number;
    },
  ): Promise<void> {
    try {
      // Incrémenter compteur conversions
      await this.incrementCounter(this.CART_CONVERTED_KEY);

      // Enregistrer valeur du panier
      await this.trackCartValue(orderData.total);

      // Marquer le panier comme converti
      const cartKey = `${this.ANALYTICS_PREFIX}cart:${sessionId}`;
      await this.cacheService.set(
        cartKey,
        {
          status: 'converted',
          orderId: orderData.orderId,
          total: orderData.total,
          itemCount: orderData.itemCount,
          timestamp: orderData.timestamp,
        },
        this.ANALYTICS_TTL,
      );

      this.logger.log(
        `✅ Conversion trackée: ${sessionId} → Commande ${orderData.orderId}`,
      );
    } catch (error) {
      this.logger.error('Erreur trackCartConverted:', error);
    }
  }

  /**
   * ❌ Marquer un panier comme abandonné
   */
  async trackCartAbandoned(
    sessionId: string,
    cartData: {
      itemCount: number;
      subtotal: number;
      items: Array<{ product_id: string; quantity: number }>;
    },
  ): Promise<void> {
    try {
      // Incrémenter compteur abandons
      await this.incrementCounter(this.CART_ABANDONED_KEY);

      // Tracker produits abandonnés
      for (const item of cartData.items) {
        await this.trackProductAbandoned(item.product_id, item.quantity);
      }

      // Marquer panier comme abandonné
      const cartKey = `${this.ANALYTICS_PREFIX}cart:${sessionId}`;
      await this.cacheService.set(
        cartKey,
        {
          status: 'abandoned',
          itemCount: cartData.itemCount,
          subtotal: cartData.subtotal,
          timestamp: Date.now(),
        },
        this.ANALYTICS_TTL,
      );

      this.logger.log(
        `❌ Abandon tracké: ${sessionId} - ${cartData.itemCount} articles`,
      );
    } catch (error) {
      this.logger.error('Erreur trackCartAbandoned:', error);
    }
  }

  /**
   * 📊 Obtenir le taux d'abandon
   */
  async getAbandonmentRate(): Promise<{
    created: number;
    converted: number;
    abandoned: number;
    abandonmentRate: number;
    conversionRate: number;
  }> {
    try {
      const created = await this.getCounter(this.CART_CREATED_KEY);
      const converted = await this.getCounter(this.CART_CONVERTED_KEY);
      const abandoned = await this.getCounter(this.CART_ABANDONED_KEY);

      const abandonmentRate =
        created > 0 ? Math.round((abandoned / created) * 100 * 100) / 100 : 0;
      const conversionRate =
        created > 0 ? Math.round((converted / created) * 100 * 100) / 100 : 0;

      return {
        created,
        converted,
        abandoned,
        abandonmentRate,
        conversionRate,
      };
    } catch (error) {
      this.logger.error('Erreur getAbandonmentRate:', error);
      return {
        created: 0,
        converted: 0,
        abandoned: 0,
        abandonmentRate: 0,
        conversionRate: 0,
      };
    }
  }

  /**
   * 💰 Obtenir la valeur moyenne du panier
   */
  async getAverageCartValue(): Promise<{
    average: number;
    total: number;
    count: number;
  }> {
    try {
      const values = await this.cacheService.get<number[]>(
        this.CART_VALUES_KEY,
      );

      if (!values || values.length === 0) {
        return { average: 0, total: 0, count: 0 };
      }

      const total = values.reduce((sum, val) => sum + val, 0);
      const average = Math.round((total / values.length) * 100) / 100;

      return {
        average,
        total: Math.round(total * 100) / 100,
        count: values.length,
      };
    } catch (error) {
      this.logger.error('Erreur getAverageCartValue:', error);
      return { average: 0, total: 0, count: 0 };
    }
  }

  /**
   * 🏆 Obtenir les produits les plus abandonnés
   */
  async getTopAbandonedProducts(limit: number = 10): Promise<
    Array<{
      productId: string;
      abandonCount: number;
      totalQuantity: number;
    }>
  > {
    try {
      const abandonedData = await this.cacheService.get<
        Record<string, { count: number; quantity: number }>
      >(this.PRODUCT_ABANDONED_KEY);

      if (!abandonedData) {
        return [];
      }

      // Convertir en array et trier
      const sorted = Object.entries(abandonedData)
        .map(([productId, data]) => ({
          productId,
          abandonCount: data.count,
          totalQuantity: data.quantity,
        }))
        .sort((a, b) => b.abandonCount - a.abandonCount)
        .slice(0, limit);

      return sorted;
    } catch (error) {
      this.logger.error('Erreur getTopAbandonedProducts:', error);
      return [];
    }
  }

  /**
   * 📈 Obtenir un rapport complet des analytics
   */
  async getComprehensiveReport(): Promise<{
    abandonmentRate: {
      created: number;
      converted: number;
      abandoned: number;
      abandonmentRate: number;
      conversionRate: number;
    };
    averageCartValue: {
      average: number;
      total: number;
      count: number;
    };
    topAbandonedProducts: Array<{
      productId: string;
      abandonCount: number;
      totalQuantity: number;
    }>;
  }> {
    try {
      const [abandonmentRate, averageCartValue, topAbandonedProducts] =
        await Promise.all([
          this.getAbandonmentRate(),
          this.getAverageCartValue(),
          this.getTopAbandonedProducts(10),
        ]);

      return {
        abandonmentRate,
        averageCartValue,
        topAbandonedProducts,
      };
    } catch (error) {
      this.logger.error('Erreur getComprehensiveReport:', error);
      return {
        abandonmentRate: {
          created: 0,
          converted: 0,
          abandoned: 0,
          abandonmentRate: 0,
          conversionRate: 0,
        },
        averageCartValue: { average: 0, total: 0, count: 0 },
        topAbandonedProducts: [],
      };
    }
  }

  /**
   * 🔄 Réinitialiser les compteurs analytics
   */
  async resetAnalytics(): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.del(this.CART_CREATED_KEY),
        this.cacheService.del(this.CART_CONVERTED_KEY),
        this.cacheService.del(this.CART_ABANDONED_KEY),
        this.cacheService.del(this.CART_VALUES_KEY),
        this.cacheService.del(this.PRODUCT_ABANDONED_KEY),
      ]);

      this.logger.log('🔄 Analytics réinitialisées');
    } catch (error) {
      this.logger.error('Erreur resetAnalytics:', error);
    }
  }

  // =============== MÉTHODES PRIVÉES ===============

  /**
   * Incrémenter un compteur
   */
  private async incrementCounter(key: string): Promise<void> {
    try {
      const current = await this.getCounter(key);
      await this.cacheService.set(key, current + 1, this.ANALYTICS_TTL);
    } catch (error) {
      this.logger.error(`Erreur incrementCounter ${key}:`, error);
    }
  }

  /**
   * Récupérer un compteur
   */
  private async getCounter(key: string): Promise<number> {
    try {
      const value = await this.cacheService.get<number>(key);
      return value || 0;
    } catch (error) {
      this.logger.error(`Erreur getCounter ${key}:`, error);
      return 0;
    }
  }

  /**
   * Enregistrer une valeur de panier
   */
  private async trackCartValue(value: number): Promise<void> {
    try {
      const values =
        (await this.cacheService.get<number[]>(this.CART_VALUES_KEY)) || [];

      values.push(value);

      // Garder seulement les 1000 dernières valeurs
      const trimmedValues = values.slice(-1000);

      await this.cacheService.set(
        this.CART_VALUES_KEY,
        trimmedValues,
        this.ANALYTICS_TTL,
      );
    } catch (error) {
      this.logger.error('Erreur trackCartValue:', error);
    }
  }

  /**
   * Tracker un produit abandonné
   */
  private async trackProductAbandoned(
    productId: string,
    quantity: number,
  ): Promise<void> {
    try {
      const abandonedData =
        (await this.cacheService.get<
          Record<string, { count: number; quantity: number }>
        >(this.PRODUCT_ABANDONED_KEY)) || {};

      if (!abandonedData[productId]) {
        abandonedData[productId] = { count: 0, quantity: 0 };
      }

      abandonedData[productId].count += 1;
      abandonedData[productId].quantity += quantity;

      await this.cacheService.set(
        this.PRODUCT_ABANDONED_KEY,
        abandonedData,
        this.ANALYTICS_TTL,
      );
    } catch (error) {
      this.logger.error('Erreur trackProductAbandoned:', error);
    }
  }
}
