import { Injectable, Logger } from '@nestjs/common';
import { ShippingDataService } from '../../../database/services/shipping-data.service';

/**
 * 🚚 SERVICE DE CALCUL SHIPPING
 *
 * Responsabilités:
 * - Déterminer la zone de livraison selon le code postal
 * - Calculer le coût de livraison selon le poids
 * - Gérer les seuils de livraison gratuite
 * - Estimer les délais de livraison
 */
@Injectable()
export class ShippingCalculationService {
  private readonly logger = new Logger(ShippingCalculationService.name);

  // Seuil pour livraison gratuite
  private readonly FREE_SHIPPING_THRESHOLD = 50; // 50€

  constructor(private readonly shippingDataService: ShippingDataService) {
    this.logger.log('ShippingCalculationService initialized');
  }

  /**
   * 🗺️ Déterminer la zone de livraison selon le code postal
   */
  determineZone(postalCode: string): string {
    if (!postalCode || postalCode.trim() === '') {
      throw new Error('Code postal requis');
    }

    const code = postalCode.trim();

    // Corse: 2A (20000-20199), 2B (20200-20620)
    if (code.startsWith('20')) {
      return 'FR-CORSE';
    }

    // DOM-TOM Zone 1: Guadeloupe (971), Martinique (972), Guyane (973)
    if (code.startsWith('971') || code.startsWith('972') || code.startsWith('973')) {
      return 'FR-DOMTOM1';
    }

    // DOM-TOM Zone 2: Réunion (974), Mayotte (976)
    if (code.startsWith('974') || code.startsWith('976')) {
      return 'FR-DOMTOM2';
    }

    // France métropolitaine (01-95 sauf 20)
    const firstTwo = parseInt(code.substring(0, 2));
    if (firstTwo >= 1 && firstTwo <= 95 && firstTwo !== 20) {
      return 'FR-IDF'; // Simplifié pour l'instant, pourrait distinguer IDF/Province
    }

    throw new Error(`Code postal invalide ou zone non supportée: ${postalCode}`);
  }

  /**
   * 💰 Calculer le coût de livraison
   */
  async calculateShippingCost(
    postalCode: string,
    weight: number,
    subtotal: number,
  ): Promise<{
    zone: string;
    cost: number;
    isFree: boolean;
    estimatedDays: number;
    method: string;
  }> {
    try {
      // 1. Déterminer la zone
      const zone = this.determineZone(postalCode);
      this.logger.log(`📍 Zone déterminée: ${zone} pour CP ${postalCode}`);

      // 2. Vérifier si livraison gratuite
      if (subtotal >= this.FREE_SHIPPING_THRESHOLD) {
        this.logger.log(
          `🎁 Livraison gratuite activée (subtotal: ${subtotal}€ >= ${this.FREE_SHIPPING_THRESHOLD}€)`,
        );
        return {
          zone,
          cost: 0,
          isFree: true,
          estimatedDays: 3,
          method: 'Colissimo - Livraison gratuite',
        };
      }

      // 3. Récupérer les tarifs pour la zone
      const rates = await this.getShippingRatesForZone(zone, weight);

      if (!rates || rates.length === 0) {
        throw new Error(`Aucun tarif trouvé pour zone ${zone}`);
      }

      // 4. Sélectionner le tarif le plus adapté (poids croissant)
      const selectedRate = rates[0];

      this.logger.log(
        `💰 Tarif sélectionné: ${selectedRate.cost}€ (poids max: ${selectedRate.max_weight}kg)`,
      );

      return {
        zone,
        cost: parseFloat(selectedRate.cost),
        isFree: false,
        estimatedDays: selectedRate.estimated_days || 3,
        method: selectedRate.method_name || 'Colissimo',
      };
    } catch (error) {
      this.logger.error('Erreur calcul shipping:', error);
      throw error;
    }
  }

  /**
   * 📊 Récupérer les tarifs pour une zone et un poids
   */
  private async getShippingRatesForZone(
    zone: string,
    weight: number,
  ): Promise<any[]> {
    try {
      // Sélectionner la table selon la zone
      let tableName = '';
      switch (zone) {
        case 'FR-CORSE':
          tableName = '___xtr_delivery_ape_corse';
          break;
        case 'FR-DOMTOM1':
          tableName = '___xtr_delivery_ape_domtom1';
          break;
        case 'FR-DOMTOM2':
          tableName = '___xtr_delivery_ape_domtom2';
          break;
        default:
          tableName = '___xtr_delivery_ape_france';
      }

      this.logger.log(
        `🔍 Recherche tarifs dans ${tableName} pour ${weight}kg`,
      );

      // Requête directe Supabase pour récupérer les tarifs
      const { data, error } = await this.shippingDataService['client']
        .from(tableName)
        .select('*')
        .gte('pri_weight_max_kg', weight)
        .order('pri_weight_max_kg', { ascending: true })
        .limit(1);

      if (error) {
        this.logger.error(`Erreur requête ${tableName}:`, error);
        throw error;
      }

      if (!data || data.length === 0) {
        // Fallback: prendre le tarif maximum si poids trop élevé
        const { data: fallbackData, error: fallbackError } =
          await this.shippingDataService['client']
            .from(tableName)
            .select('*')
            .order('pri_weight_max_kg', { ascending: false })
            .limit(1);

        if (fallbackError || !fallbackData || fallbackData.length === 0) {
          throw new Error(`Aucun tarif disponible pour ${zone}`);
        }

        data.push(fallbackData[0]);
      }

      // Mapper les données au format attendu
      return data.map((rate) => ({
        zone,
        min_weight: parseFloat(rate.pri_weight_min_kg) || 0,
        max_weight: parseFloat(rate.pri_weight_max_kg) || 30,
        cost: parseFloat(rate.pri_price_ttc) || 0,
        estimated_days: 3, // Par défaut Colissimo
        method_name: 'Colissimo',
      }));
    } catch (error) {
      this.logger.error('Erreur récupération tarifs:', error);
      throw error;
    }
  }

  /**
   * 🎯 Calculer le poids total du panier
   */
  calculateTotalWeight(items: Array<{ weight?: number; quantity: number }>): number {
    return items.reduce((total, item) => {
      const weight = item.weight || 0;
      return total + weight * item.quantity;
    }, 0);
  }

  /**
   * 💡 Calculer combien il manque pour la livraison gratuite
   */
  calculateRemainingForFreeShipping(subtotal: number): number {
    if (subtotal >= this.FREE_SHIPPING_THRESHOLD) {
      return 0;
    }
    return this.FREE_SHIPPING_THRESHOLD - subtotal;
  }

  /**
   * 🚚 Obtenir toutes les méthodes disponibles pour une zone
   */
  async getAvailableShippingMethods(
    postalCode: string,
    weight: number,
    subtotal: number,
  ): Promise<any[]> {
    try {
      const zone = this.determineZone(postalCode);
      const rates = await this.getShippingRatesForZone(zone, weight);

      // Si livraison gratuite active
      if (subtotal >= this.FREE_SHIPPING_THRESHOLD) {
        return [
          {
            id: 1,
            name: 'Colissimo - Livraison gratuite',
            description: `Livraison gratuite dès ${this.FREE_SHIPPING_THRESHOLD}€`,
            cost: 0,
            estimated_days: 3,
            is_free: true,
            logo_url: null,
          },
        ];
      }

      // Retourner les méthodes disponibles
      return rates.map((rate, index) => ({
        id: index + 1,
        name: rate.method_name,
        description: `Poids jusqu'à ${rate.max_weight}kg`,
        cost: rate.cost,
        estimated_days: rate.estimated_days,
        is_free: false,
        logo_url: null,
      }));
    } catch (error) {
      this.logger.error('Erreur récupération méthodes:', error);
      return [];
    }
  }
}
