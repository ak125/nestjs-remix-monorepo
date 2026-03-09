import { Injectable, Logger, Optional } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import {
  DomainNotFoundException,
  DatabaseException,
  ErrorCodes,
} from '../../common/exceptions';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';
import { ShippingCalculatorService } from '../cart/services/shipping-calculator.service';

/**
 * Service de gestion des expéditions post-commande
 * Délègue le calcul des tarifs à ShippingCalculatorService (grille Colissimo 2026 depuis DB)
 */
@Injectable()
export class ShippingService extends SupabaseBaseService {
  protected readonly logger = new Logger(ShippingService.name);

  constructor(
    @Optional()
    private readonly shippingCalculator?: ShippingCalculatorService,
  ) {
    super();
  }

  /**
   * Calculer les frais de port pour une commande existante
   */
  async calculateShippingFee(orderId: number): Promise<number> {
    try {
      this.logger.log(`Calculating shipping fee for order: ${orderId}`);

      const orderUrl = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}&select=*`;
      const orderResponse = await fetch(orderUrl, {
        method: 'GET',
        headers: this.headers,
      });

      if (!orderResponse.ok) {
        throw new DatabaseException({
          code: ErrorCodes.SHIPPING.DATA_FETCH_FAILED,
          message: 'Impossible de récupérer les données de commande',
        });
      }

      const orders = await orderResponse.json();
      const order = orders[0];

      if (!order) {
        throw new DomainNotFoundException({
          code: ErrorCodes.SHIPPING.ORDER_NOT_FOUND,
          message: 'Commande introuvable',
        });
      }

      // Récupérer l'adresse de livraison
      let postalCode = '75000';
      if (order.ord_shipping_address_id) {
        const addressUrl = `${this.baseUrl}/___xtr_customer_delivery_address?cda_id=eq.${order.ord_shipping_address_id}&select=cda_postal_code,cda_country`;
        const addressResponse = await fetch(addressUrl, {
          method: 'GET',
          headers: this.headers,
        });
        if (addressResponse.ok) {
          const addresses = await addressResponse.json();
          if (addresses[0]?.cda_postal_code) {
            postalCode = addresses[0].cda_postal_code;
          }
        }
      }

      // Récupérer les lignes de commande pour estimer le poids
      const linesUrl = `${this.baseUrl}/___xtr_order_line?orl_ord_id=eq.${orderId}&select=orl_art_id,orl_art_quantity`;
      const linesResponse = await fetch(linesUrl, {
        method: 'GET',
        headers: this.headers,
      });

      let totalWeightG = 1000; // 1kg par défaut
      if (linesResponse.ok && this.shippingCalculator) {
        const lines = await linesResponse.json();
        const items = (lines || []).map(
          (line: { orl_art_id: string; orl_art_quantity: string }) => ({
            productId: String(line.orl_art_id),
            quantity: parseInt(line.orl_art_quantity || '1', 10),
          }),
        );
        totalWeightG = await this.shippingCalculator.getCartItemsWeight(items);
      }

      const subtotal = parseFloat(order.ord_total_ttc || '0');

      // Calculer via ShippingCalculatorService (grille Colissimo 2026 depuis DB)
      let fee: number;
      if (this.shippingCalculator) {
        const zone = this.shippingCalculator.determineZone(postalCode);
        fee = this.shippingCalculator.calculateByWeight(
          totalWeightG,
          subtotal,
          zone,
        );
      } else {
        // Fallback si ShippingCalculatorService non injecté
        fee = subtotal >= 150 ? 0 : 15.9;
      }

      this.logger.log(
        `Shipping calculated: postal=${postalCode}, weight=${totalWeightG}g, fee=€${fee}`,
      );

      await this.updateOrderShipping(orderId, fee);
      return fee;
    } catch (error) {
      this.logger.error('Error calculating shipping fee:', error);
      throw error;
    }
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
        throw new DatabaseException({
          code: ErrorCodes.SHIPPING.UPDATE_FAILED,
          message: 'Impossible de mettre à jour les frais de port',
        });
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
        throw new DatabaseException({
          code: ErrorCodes.SHIPPING.DATA_FETCH_FAILED,
          message: 'Impossible de récupérer les données de commande',
        });
      }

      const orders = await orderResponse.json();
      const order = orders[0];

      if (!order) {
        throw new DomainNotFoundException({
          code: ErrorCodes.SHIPPING.ADDRESS_NOT_FOUND,
          message: 'Adresse de livraison introuvable',
        });
      }

      const deliveryAddress = order.___xtr_customer_delivery_address;
      const postalCode = deliveryAddress?.cda_postal_code || '75000';
      const zone = this.shippingCalculator
        ? this.shippingCalculator.determineZone(postalCode)
        : 'france';

      let minDays: number, maxDays: number;
      switch (zone) {
        case 'france':
          minDays = 2;
          maxDays = 3;
          break;
        case 'corse':
          minDays = 3;
          maxDays = 5;
          break;
        case 'domtom1':
        case 'domtom2':
          minDays = 6;
          maxDays = 18;
          break;
        default:
          minDays = 2;
          maxDays = 3;
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
   * Obtenir les méthodes de livraison disponibles
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

      const zone = this.shippingCalculator
        ? this.shippingCalculator.determineZone(zipCode)
        : 'france';

      // Calculer le tarif pour 1kg dans la zone
      const baseCost = this.shippingCalculator
        ? this.shippingCalculator.calculateByWeight(1000, 0, zone)
        : 9.59;

      return [
        {
          id: 'standard',
          name: 'Livraison standard',
          estimatedDays: zone === 'france' || zone === 'corse' ? 3 : 7,
          baseCost,
        },
      ];
    } catch (error) {
      this.logger.error('Error getting shipping methods:', error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les expéditions avec données de tracking
   */
  async getAllShipmentsWithTracking() {
    try {
      this.logger.log('Fetching all shipments with tracking data');

      const { data: orders, error: ordersError } = await this.supabase
        .from(TABLES.xtr_order)
        .select(
          `
          ord_id,
          ord_ref,
          ord_cst_id,
          ord_total_ttc,
          ord_status,
          ord_date_created,
          ord_date_modified,
          ord_shipping_address_id
        `,
        )
        .in('ord_status', [2, 3, 4, 5])
        .order('ord_date_modified', { ascending: false })
        .limit(50);

      if (ordersError) {
        throw new DatabaseException({
          code: ErrorCodes.SHIPPING.DATA_FETCH_FAILED,
          message: `Database error: ${ordersError.message}`,
          details: ordersError.message,
        });
      }

      const customerIds = [
        ...new Set(
          (orders || [])
            .map((o) => o.ord_cst_id)
            .filter((id): id is number => id != null),
        ),
      ];
      const addressIds = [
        ...new Set(
          (orders || [])
            .map((o) => o.ord_shipping_address_id)
            .filter((id): id is number => id != null),
        ),
      ];

      const customerMap = new Map<
        number,
        { cst_firstname: string; cst_lastname: string; cst_company: string }
      >();
      if (customerIds.length > 0) {
        const { data: customersData } = await this.supabase
          .from(TABLES.xtr_customer)
          .select('cst_id, cst_firstname, cst_lastname, cst_company')
          .in('cst_id', customerIds);

        (customersData || []).forEach((c) => {
          customerMap.set(c.cst_id, c);
        });
      }

      const addressMap = new Map<number, { city: string; country: string }>();
      if (addressIds.length > 0) {
        const { data: addressesData } = await this.supabase
          .from(TABLES.xtr_customer_delivery_address)
          .select('cda_id, cda_city, cda_country')
          .in('cda_id', addressIds);

        (addressesData || []).forEach((a) => {
          addressMap.set(a.cda_id, {
            city: a.cda_city || 'Non défini',
            country: a.cda_country || 'FR',
          });
        });
      }

      const trackingData = (orders || []).map((order) => {
        const customer = customerMap.get(order.ord_cst_id);
        const shippingAddress = order.ord_shipping_address_id
          ? addressMap.get(order.ord_shipping_address_id) || {
              city: 'Non défini',
              country: 'FR',
            }
          : { city: 'Non défini', country: 'FR' };

        const customerName = customer
          ? `${customer.cst_firstname || ''} ${customer.cst_lastname || ''}`.trim()
          : `Client #${order.ord_cst_id}`;

        return {
          id: order.ord_id.toString(),
          trackingNumber: `CO${order.ord_id}FR`,
          orderNumber: order.ord_ref || `CMD-${order.ord_id}`,
          customerName: customerName || `Client #${order.ord_cst_id}`,
          carrier: {
            name: 'Colissimo',
            logo: '/images/carriers/colissimo.png',
          },
          status: 'in_transit',
          shippingAddress,
          lastUpdate: order.ord_date_modified || new Date().toISOString(),
          totalAmount: parseFloat(order.ord_total_ttc || '0'),
        };
      });

      this.logger.log(
        `Retrieved ${trackingData.length} shipments with tracking`,
      );
      return trackingData;
    } catch (error) {
      this.logger.error('Error fetching shipments with tracking:', error);
      throw error;
    }
  }
}
