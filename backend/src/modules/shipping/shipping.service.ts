import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

/**
 * Service de gestion des expéditions avec grille tarifaire complète
 * ✅ Calcul des frais de port avec zones géographiques
 * ✅ Gestion France métropolitaine, Corse, DOM
 * ✅ Tarification Europe et International
 * ✅ Livraison gratuite au-dessus de 100€
 * ✅ Estimation des délais de livraison
 */
@Injectable()
export class ShippingService extends SupabaseBaseService {
  protected readonly logger = new Logger(ShippingService.name);

  constructor() {
    super();
  }

  // Grille tarifaire complète
  private readonly shippingRates = {
    FR: {
      zones: {
        metropolitan: {
          0: 4.9,
          1: 6.9,
          5: 9.9,
          10: 14.9,
          30: 19.9,
        },
        corsica: {
          0: 7.9,
          1: 9.9,
          5: 14.9,
          10: 19.9,
          30: 29.9,
        },
        dom: {
          0: 14.9,
          1: 19.9,
          5: 29.9,
          10: 39.9,
          30: 59.9,
        },
      },
    },
    EU: {
      0: 9.9,
      1: 14.9,
      5: 24.9,
      10: 34.9,
      30: 49.9,
    },
    WORLD: {
      0: 19.9,
      1: 39.9,
      5: 59.9,
      10: 89.9,
      30: 119.9,
    },
  };

  /**
   * Calculer les frais de port (équivalent commande.shippingfee.php)
   */
  async calculateShippingFee(orderId: number): Promise<number> {
    try {
      this.logger.log(`Calculating shipping fee for order: ${orderId}`);

      // Récupérer les informations de la commande
      const orderUrl = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}&select=*`;

      const orderResponse = await fetch(orderUrl, {
        method: 'GET',
        headers: this.headers,
      });

      if (!orderResponse.ok) {
        throw new Error('Impossible de récupérer les données de commande');
      }

      const orders = await orderResponse.json();
      const order = orders[0];

      if (!order) {
        throw new Error('Commande introuvable');
      }

      // Récupérer l'adresse de livraison si elle existe
      let deliveryAddress = null;
      if (order.ord_shipping_address_id) {
        const addressUrl = `${this.baseUrl}/___xtr_customer_delivery_address?cda_id=eq.${order.ord_shipping_address_id}&select=cda_postal_code,cda_country`;

        const addressResponse = await fetch(addressUrl, {
          method: 'GET',
          headers: this.headers,
        });

        if (addressResponse.ok) {
          const addresses = await addressResponse.json();
          deliveryAddress = addresses[0];
        }
      }

      // Récupérer les lignes de commande et estimer le poids
      const linesUrl = `${this.baseUrl}/___xtr_order_line?orl_ord_id=eq.${orderId}&select=orl_art_quantity`;

      const linesResponse = await fetch(linesUrl, {
        method: 'GET',
        headers: this.headers,
      });

      let totalWeight = 1; // Poids par défaut si pas de données
      if (linesResponse.ok) {
        const lines = await linesResponse.json();
        totalWeight = lines.reduce(
          (sum: number, line: any) =>
            sum + parseFloat(line.orl_art_quantity || '1') * 0.5, // 0.5kg par article
          0,
        );
      }

      // Livraison gratuite au-dessus de 100€
      if (parseFloat(order.ord_total_ttc || '0') >= 100) {
        this.logger.log('Free shipping applied (>= 100€)');
        await this.updateOrderShipping(orderId, 0);
        return 0;
      }

      // Déterminer la zone
      const zone = this.determineShippingZone(
        deliveryAddress?.cda_country || 'FR',
        deliveryAddress?.cda_postal_code || '75000',
      );

      // Calculer selon le poids
      const fee = this.getShippingFeeByWeight(zone, totalWeight);

      this.logger.log(
        `Shipping calculated: zone=${zone}, weight=${totalWeight}kg, fee=€${fee}`,
      );

      // Mettre à jour la commande
      await this.updateOrderShipping(orderId, fee);

      return fee;
    } catch (error) {
      this.logger.error('Error calculating shipping fee:', error);
      throw error;
    }
  }

  /**
   * Déterminer la zone de livraison
   */
  private determineShippingZone(country: string, postalCode: string): string {
    if (country !== 'FR') {
      const euCountries = [
        'DE',
        'BE',
        'ES',
        'IT',
        'NL',
        'PT',
        'LU',
        'AT',
        'DK',
        'SE',
        'FI',
        'IE',
      ];
      return euCountries.includes(country) ? 'EU' : 'WORLD';
    }

    // France
    const code = postalCode?.substring(0, 2);

    // Corse (codes postaux 20xxx)
    if (code === '20') {
      return 'FR_CORSICA';
    }

    // DOM
    if (['97', '98'].includes(code)) {
      return 'FR_DOM';
    }

    return 'FR_METRO';
  }

  /**
   * Obtenir le tarif selon le poids
   */
  private getShippingFeeByWeight(zone: string, weight: number): number {
    let rates: any;

    switch (zone) {
      case 'FR_METRO':
        rates = this.shippingRates.FR.zones.metropolitan;
        break;
      case 'FR_CORSICA':
        rates = this.shippingRates.FR.zones.corsica;
        break;
      case 'FR_DOM':
        rates = this.shippingRates.FR.zones.dom;
        break;
      case 'EU':
        rates = this.shippingRates.EU;
        break;
      default:
        rates = this.shippingRates.WORLD;
    }

    // Trouver le bon palier de poids
    const weightKeys = Object.keys(rates)
      .map((k) => parseFloat(k))
      .sort((a, b) => b - a);

    for (const key of weightKeys) {
      if (weight >= key) {
        return rates[key];
      }
    }

    return rates[0];
  }

  /**
   * Mettre à jour les frais de port dans la commande
   */
  private async updateOrderShipping(
    orderId: number,
    fee: number,
  ): Promise<void> {
    try {
      const updateUrl = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}`;

      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify({
          ord_shipping_cost: fee,
          ord_date_updated: new Date().toISOString(),
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Impossible de mettre à jour les frais de port');
      }

      this.logger.log(`Order ${orderId} shipping updated: €${fee}`);
    } catch (error) {
      this.logger.error('Error updating order shipping:', error);
      throw error;
    }
  }

  /**
   * Estimer le délai de livraison
   */
  async estimateDeliveryTime(orderId: number): Promise<{
    minDays: number;
    maxDays: number;
    estimatedDate: Date;
  }> {
    try {
      const orderUrl = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}&select=*,___xtr_customer_delivery_address!ord_shipping_address_id(cda_country,cda_postal_code)`;

      const orderResponse = await fetch(orderUrl, {
        method: 'GET',
        headers: this.headers,
      });

      if (!orderResponse.ok) {
        throw new Error('Impossible de récupérer les données de commande');
      }

      const orders = await orderResponse.json();
      const order = orders[0];

      if (!order) {
        throw new Error('Adresse de livraison introuvable');
      }

      const deliveryAddress = order.___xtr_customer_delivery_address;
      const zone = this.determineShippingZone(
        deliveryAddress?.cda_country || 'FR',
        deliveryAddress?.cda_postal_code || '75000',
      );

      let minDays: number, maxDays: number;

      switch (zone) {
        case 'FR_METRO':
          minDays = 2;
          maxDays = 3;
          break;
        case 'FR_CORSICA':
        case 'FR_DOM':
          minDays = 4;
          maxDays = 7;
          break;
        case 'EU':
          minDays = 5;
          maxDays = 8;
          break;
        default:
          minDays = 10;
          maxDays = 21;
      }

      const estimatedDate = new Date();
      estimatedDate.setDate(
        estimatedDate.getDate() + Math.round((minDays + maxDays) / 2),
      );

      return { minDays, maxDays, estimatedDate };
    } catch (error) {
      this.logger.error('Error estimating delivery time:', error);
      throw error;
    }
  }

  /**
   * Calculer les frais de port pour une estimation (sans mise à jour DB)
   */
  async calculateShippingEstimate(data: {
    weight: number;
    country: string;
    postalCode: string;
    orderAmount?: number;
  }): Promise<{
    fee: number;
    zone: string;
    freeShipping: boolean;
    deliveryEstimate: {
      minDays: number;
      maxDays: number;
    };
  }> {
    try {
      // Livraison gratuite au-dessus de 100€
      const freeShipping = (data.orderAmount || 0) >= 100;
      if (freeShipping) {
        return {
          fee: 0,
          zone: 'FREE',
          freeShipping: true,
          deliveryEstimate: { minDays: 2, maxDays: 3 },
        };
      }

      const zone = this.determineShippingZone(data.country, data.postalCode);
      const fee = this.getShippingFeeByWeight(zone, data.weight);

      // Estimation des délais selon la zone
      let minDays: number, maxDays: number;
      switch (zone) {
        case 'FR_METRO':
          minDays = 2;
          maxDays = 3;
          break;
        case 'FR_CORSICA':
        case 'FR_DOM':
          minDays = 4;
          maxDays = 7;
          break;
        case 'EU':
          minDays = 5;
          maxDays = 8;
          break;
        default:
          minDays = 10;
          maxDays = 21;
      }

      return {
        fee,
        zone,
        freeShipping: false,
        deliveryEstimate: { minDays, maxDays },
      };
    } catch (error) {
      this.logger.error('Error calculating shipping estimate:', error);
      throw error;
    }
  }

  /**
   * Obtenir les méthodes de livraison disponibles (compatibilité)
   */
  async getAvailableShippingMethods(zipCode: string): Promise<
    Array<{
      id: string;
      name: string;
      estimatedDays: number;
      baseCost: number;
    }>
  > {
    try {
      this.logger.log(`Getting shipping methods for: ${zipCode}`);

      const zone = this.determineShippingZone('FR', zipCode);
      const baseRate = this.getShippingFeeByWeight(zone, 1);

      return [
        {
          id: 'standard',
          name: 'Livraison standard',
          estimatedDays: zone === 'FR_METRO' ? 3 : 5,
          baseCost: baseRate,
        },
        {
          id: 'express',
          name: 'Livraison express',
          estimatedDays: zone === 'FR_METRO' ? 1 : 3,
          baseCost: baseRate * 1.5,
        },
      ];
    } catch (error) {
      this.logger.error('Error getting shipping methods:', error);
      throw error;
    }
  }
}
