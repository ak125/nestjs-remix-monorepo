import { TABLES } from '@repo/database-types';
/**
 * 🧮 SERVICE CALCUL PANIER - Architecture moderne avancée
 *
 * Service spécialisé dans les calculs du panier :
 * ✅ Calculs de prix et totaux (équivalent shopping_cart.function.php)
 * ✅ TVA et taxes automatiques
 * ✅ Frais de livraison dynamiques
 * ✅ Remises et promotions avancées
 * ✅ Remises quantité et paliers
 * ✅ Intégration base de données pour règles métier
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CartItem } from '../../../database/services/cart-data.service';

export interface CartCalculation {
  subtotalHT: number;
  tva: number;
  totalTTC: number;
  shippingFee: number;
  grandTotal: number;
  promoDiscount: number;
  totalWeight: number;
  itemCount: number;
}

@Injectable()
export class CartCalculationService extends SupabaseBaseService {
  protected readonly logger = new Logger(CartCalculationService.name);
  private readonly TVA_RATE = 0.2; // 20%
  private readonly FREE_SHIPPING_THRESHOLD = 150; // € (aligné sur votre logique)
  private readonly STANDARD_SHIPPING_FEE = 15.9; // € (tarif par défaut)

  constructor() {
    super();
    this.logger.log(
      'CartCalculationService initialized - Advanced architecture',
    );
  }

  /**
   * Calculer tous les totaux du panier (équivalent shopping_cart.function.php)
   * ✅ P3.3 Optimisé: Batch query pour remises quantité
   */
  async calculateCart(
    items: CartItem[],
    promoDiscount: number = 0,
  ): Promise<CartCalculation> {
    let subtotalHT = 0;
    let totalWeight = 0;
    let itemCount = 0;

    // BATCH: Récupérer tous les paliers de remise en une requête
    const productIds = [...new Set(items.map((item) => item.product_id))];
    const discountMap = new Map<
      string,
      {
        discount_percent?: number;
        discount_amount?: number;
        min_quantity: number;
      }[]
    >();

    if (productIds.length > 0) {
      const { data: allDiscounts, error } = await this.supabase
        .from(TABLES.quantity_discounts)
        .select('product_id, min_quantity, discount_percent, discount_amount')
        .in('product_id', productIds)
        .eq('is_active', true)
        .order('min_quantity', { ascending: false });

      if (!error && allDiscounts) {
        // Grouper par product_id
        allDiscounts.forEach((d) => {
          const key = d.product_id;
          if (!discountMap.has(key)) {
            discountMap.set(key, []);
          }
          discountMap.get(key)!.push({
            discount_percent: d.discount_percent,
            discount_amount: d.discount_amount,
            min_quantity: d.min_quantity,
          });
        });
      }
    }

    // Calculer le sous-total avec Map lookup O(1)
    for (const item of items) {
      let itemPrice = item.price;

      // Appliquer remise quantité depuis Map
      const discounts = discountMap.get(item.product_id) || [];
      const applicableDiscount = discounts.find(
        (d) => item.quantity >= d.min_quantity,
      );

      if (applicableDiscount) {
        if (applicableDiscount.discount_percent) {
          itemPrice =
            item.price * (1 - applicableDiscount.discount_percent / 100);
        } else if (applicableDiscount.discount_amount) {
          itemPrice = Math.max(
            0,
            item.price - applicableDiscount.discount_amount,
          );
        }
      }

      subtotalHT += item.quantity * itemPrice;
      totalWeight += item.quantity * ((item as any).weight || 0);
      itemCount += item.quantity;
    }

    // TVA à 20%
    const tva = subtotalHT * this.TVA_RATE;
    const totalTTC = subtotalHT + tva;

    // Calculer les frais de port dynamiques
    const shippingFee = await this.calculateShipping(totalWeight, subtotalHT);

    // Total général
    const grandTotal = totalTTC + shippingFee - promoDiscount;

    return {
      subtotalHT: Math.round(subtotalHT * 100) / 100,
      tva: Math.round(tva * 100) / 100,
      totalTTC: Math.round(totalTTC * 100) / 100,
      shippingFee: Math.round(shippingFee * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100,
      promoDiscount: Math.round(promoDiscount * 100) / 100,
      totalWeight,
      itemCount,
    };
  }

  /**
   * Calculer les frais de port selon les règles métier
   */
  private async calculateShipping(
    weight: number,
    amount: number,
  ): Promise<number> {
    try {
      // Frais de port gratuits au-dessus du seuil
      if (amount >= this.FREE_SHIPPING_THRESHOLD) {
        return 0;
      }

      // Récupérer les règles de frais de port depuis la base
      const { data: shippingRules, error } = await this.supabase
        .from('___xtr_delivery_agent')
        .select('*')
        .eq('is_active', true)
        .order('min_weight', { ascending: true });

      if (error) {
        this.logger.warn(
          `Erreur récupération règles livraison: ${error.message}`,
        );
        return this.STANDARD_SHIPPING_FEE;
      }

      // Trouver la règle applicable selon le poids
      for (const rule of shippingRules || []) {
        if (weight <= (rule.max_weight || Infinity)) {
          return rule.price || this.STANDARD_SHIPPING_FEE;
        }
      }

      // Tarif par défaut si aucune règle ne correspond
      return this.STANDARD_SHIPPING_FEE;
    } catch (error) {
      this.logger.error(
        `Erreur calculateShipping: ${(error as any)?.message || error}`,
      );
      return this.STANDARD_SHIPPING_FEE;
    }
  }

  /**
   * Calculer le prix avec remise quantité
   */
  async calculateQuantityDiscount(
    productId: string,
    quantity: number,
    basePrice: number,
  ): Promise<number> {
    try {
      // Récupérer les paliers de remise depuis la base
      const { data: discountTiers, error } = await this.supabase
        .from(TABLES.quantity_discounts)
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .lte('min_quantity', quantity)
        .order('min_quantity', { ascending: false })
        .limit(1);

      if (error) {
        this.logger.warn(
          `Erreur récupération remises quantité: ${error.message}`,
        );
        return basePrice;
      }

      if (discountTiers && discountTiers.length > 0) {
        const discount = discountTiers[0];

        // Remise en pourcentage
        if (discount.discount_percent) {
          return basePrice * (1 - discount.discount_percent / 100);
        }

        // Remise en montant fixe
        if (discount.discount_amount) {
          return Math.max(0, basePrice - discount.discount_amount);
        }
      }

      return basePrice;
    } catch (error) {
      this.logger.error(
        `Erreur calculateQuantityDiscount: ${(error as any)?.message || error}`,
      );
      return basePrice;
    }
  }

  /**
   * Calculer la remise promotionnelle avancée
   */
  async calculatePromoDiscount(
    promoCode: string,
    subtotalHT: number,
  ): Promise<number> {
    try {
      // Récupérer les détails du code promo
      const { data: promo, error } = await this.supabase
        .from(TABLES.promo_codes)
        .select('*')
        .eq('code', promoCode)
        .eq('is_active', true)
        .single();

      if (error || !promo) {
        return 0;
      }

      // Vérifier les conditions d'utilisation
      if (promo.min_amount && subtotalHT < promo.min_amount) {
        return 0;
      }

      if (promo.max_amount && subtotalHT > promo.max_amount) {
        return 0;
      }

      // Calculer la remise selon le type
      let discount = 0;

      if (promo.discount_percent) {
        // Remise en pourcentage
        discount = subtotalHT * (promo.discount_percent / 100);
      } else if (promo.discount_amount) {
        // Remise en montant fixe
        discount = promo.discount_amount;
      }

      // Appliquer les limites de remise
      if (promo.max_discount && discount > promo.max_discount) {
        discount = promo.max_discount;
      }

      return Math.round(discount * 100) / 100;
    } catch (error) {
      this.logger.error(
        `Erreur calculatePromoDiscount: ${(error as any)?.message || error}`,
      );
      return 0;
    }
  }

  /**
   * Calculer les totaux par catégorie de produits
   */
  async calculateCategoryTotals(items: CartItem[]): Promise<{
    categories: { [key: string]: number };
    totalByCategory: number;
  }> {
    const categories: { [key: string]: number } = {};
    let totalByCategory = 0;

    for (const item of items) {
      try {
        // Récupérer la catégorie du produit
        const { data: product, error } = await this.supabase
          .from(TABLES.pieces)
          .select('category_id, categories(name)')
          .eq('id', item.product_id)
          .single();

        if (!error && product) {
          const categoryName = Array.isArray(product.categories)
            ? product.categories[0]?.name || 'Autre'
            : (product.categories as any)?.name || 'Autre';
          const itemTotal = item.price * item.quantity;

          categories[categoryName] =
            (categories[categoryName] || 0) + itemTotal;
          totalByCategory += itemTotal;
        }
      } catch {
        this.logger.warn(
          `Erreur récupération catégorie produit ${item.product_id}`,
        );
      }
    }

    return { categories, totalByCategory };
  }

  /**
   * Calculer les économies réalisées
   */
  async calculateSavings(items: CartItem[]): Promise<{
    quantityDiscountSavings: number;
    promoSavings: number;
    totalSavings: number;
  }> {
    let quantityDiscountSavings = 0;
    const promoSavings = 0;

    // Calculer les économies sur les remises quantité
    for (const item of items) {
      const originalPrice = item.price;
      const discountedPrice = await this.calculateQuantityDiscount(
        item.product_id,
        item.quantity,
        originalPrice,
      );

      quantityDiscountSavings +=
        (originalPrice - discountedPrice) * item.quantity;
    }

    // Les économies promo seront calculées séparément
    const totalSavings = quantityDiscountSavings + promoSavings;

    return {
      quantityDiscountSavings: Math.round(quantityDiscountSavings * 100) / 100,
      promoSavings: Math.round(promoSavings * 100) / 100,
      totalSavings: Math.round(totalSavings * 100) / 100,
    };
  }
}
