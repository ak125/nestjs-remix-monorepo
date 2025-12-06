import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

/**
 * Transport Optimizer Agent (IA-Transport)
 *
 * Specialized Agent - E-Commerce Squad (Logistique & Supply Chain)
 *
 * Responsibilities:
 * 1. Carrier Cost Comparator - temps réel Colissimo/Chronopost/Mondial Relay/DPD
 * 2. Route Optimization - Dijkstra + heuristiques zones/horaires
 * 3. Delivery Promise Engine - stock+picking+transit = ETA 95%
 * 4. Multi-Warehouse Routing - Single/Split/Hybrid strategies
 * 5. Carbon Footprint Tracker - option éco-responsable
 *
 * KPIs: delivery-cost <€8, delivery-time <48h, carrier-sla >95%, delivery-carbon -15%
 */
@Injectable()
export class TransportOptimizerService {
  private readonly logger = new Logger(TransportOptimizerService.name);

  // Mock dependencies - à remplacer par vrais services
  private carrierApi = {
    getColissimoRate: async (_pkg: PackageInfo, _dest: AddressDto) =>
      ({ carrier: 'colissimo', price: 6.9, transitDays: 2, co2: 0.8, available: true }),
    getChronopostRate: async (_pkg: PackageInfo, _dest: AddressDto) =>
      ({ carrier: 'chronopost', price: 12.5, transitDays: 1, co2: 1.2, available: true }),
    getMondialRelayRate: async (_pkg: PackageInfo, _dest: AddressDto) =>
      ({ carrier: 'mondial_relay', price: 4.5, transitDays: 4, co2: 0.5, available: true }),
    getDpdRate: async (_pkg: PackageInfo, _dest: AddressDto) =>
      ({ carrier: 'dpd', price: 7.2, transitDays: 2, co2: 0.9, available: true }),
  };
  private warehouseService = {
    getStockBySku: async (_sku: string) => ({ quantity: 10 }),
    getNearestWithStock: async (_sku: string, _postalCode: string) => ({ id: 'LYON', name: 'Lyon Warehouse' }),
  };
  private redis = {
    get: async (_key: string) => null,
    set: async (_key: string, _value: string, _ex: string, _ttl: number) => {},
  };
  private orderService = {
    findByTrackingNumber: async (_tracking: string) => ({
      id: '12345',
      customerEmail: 'client@example.com',
      customerId: 'cust_123',
      promisedDeliveryDate: new Date(),
    }),
  };
  private notificationService = {
    sendDelayNotification: async (_params: any) => {},
  };
  private couponService = {
    generateCompensation: async (_params: any) => ({ code: 'SORRY10' }),
  };
  private carrierScorer = {
    logIncident: async (_params: any) => {},
  };

  /**
   * Get best shipping options for checkout
   * Called when customer selects delivery method
   */
  async getShippingOptions(
    cart: CartDto,
    destination: AddressDto,
  ): Promise<ShippingOption[]> {
    const cacheKey = `shipping:${cart.id}:${destination.postalCode}`;

    // Check cache (15min TTL)
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    this.logger.log(`Calculating shipping options for cart ${cart.id} to ${destination.postalCode}`);

    // Calculate package dimensions
    const packageInfo = this.calculatePackage(cart.items);

    // Query all carriers in parallel
    const [colissimo, chronopost, mondialRelay, dpd] = await Promise.all([
      this.carrierApi.getColissimoRate(packageInfo, destination),
      this.carrierApi.getChronopostRate(packageInfo, destination),
      this.carrierApi.getMondialRelayRate(packageInfo, destination),
      this.carrierApi.getDpdRate(packageInfo, destination),
    ]);

    // Build options with rankings
    const options = this.rankOptions([colissimo, chronopost, mondialRelay, dpd]);

    // Cache results (15min)
    await this.redis.set(cacheKey, JSON.stringify(options), 'EX', 900);

    return options;
  }

  /**
   * Calculate delivery promise for product page
   * Shows "Delivered by [DATE] if ordered before [TIME]"
   */
  async getDeliveryPromise(
    sku: string,
    postalCode: string,
  ): Promise<DeliveryPromise> {
    // 1. Check stock availability
    const stock = await this.warehouseService.getStockBySku(sku);

    if (stock.quantity <= 0) {
      return { available: false, message: 'Rupture de stock' };
    }

    // 2. Get nearest warehouse with stock
    const warehouse = await this.warehouseService.getNearestWithStock(sku, postalCode);

    // 3. Calculate ETA
    const pickingTime = 4; // hours
    const transitTime = await this.getTransitTime(warehouse, postalCode);
    const cutoffHour = 14; // 2pm

    const now = new Date();
    const isBeforeCutoff = now.getHours() < cutoffHour;

    const deliveryDate = this.calculateDeliveryDate(
      now,
      pickingTime,
      transitTime,
      isBeforeCutoff,
    );

    return {
      available: true,
      deliveryDate,
      message: `Livré le ${this.formatDate(deliveryDate)}`,
      cutoffMessage: isBeforeCutoff
        ? `Commandé avant ${cutoffHour}h`
        : 'Expédié demain',
    };
  }

  /**
   * Decide split shipping strategy for multi-warehouse orders
   */
  async decideSplitStrategy(
    order: OrderDto,
    customerType: 'standard' | 'prime',
  ): Promise<SplitDecision> {
    // Group items by warehouse
    const itemsByWarehouse = this.groupByWarehouse(order.items);

    if (Object.keys(itemsByWarehouse).length === 1) {
      return { strategy: 'SINGLE', shipments: 1 };
    }

    this.logger.log(`Multi-warehouse order detected: ${Object.keys(itemsByWarehouse).length} warehouses`);

    // Calculate options
    const singleShipCost = await this.calculateConsolidatedCost(order);
    const splitShipCost = await this.calculateSplitCost(itemsByWarehouse, order.destination);
    const singleShipDelay = await this.calculateConsolidationDelay(itemsByWarehouse);

    // Decision logic
    const costSaving = splitShipCost - singleShipCost;

    if (customerType === 'prime') {
      // Prime: prioritize speed
      return {
        strategy: 'SPLIT',
        shipments: Object.keys(itemsByWarehouse).length,
        reason: 'Prime customer - speed priority',
      };
    }

    if (costSaving > 5 && singleShipDelay < 24) {
      // Significant saving, acceptable delay
      return {
        strategy: 'CONSOLIDATE',
        shipments: 1,
        reason: `Save €${costSaving.toFixed(2)} with +${singleShipDelay}h delay`,
      };
    }

    return {
      strategy: 'SPLIT',
      shipments: Object.keys(itemsByWarehouse).length,
      reason: 'Optimal delivery time',
    };
  }

  /**
   * Handle delivery delay detection and customer notification
   * Called via webhook when carrier reports delay
   */
  async handleDeliveryDelay(tracking: TrackingUpdate): Promise<void> {
    const order = await this.orderService.findByTrackingNumber(tracking.number);

    const originalEta = order.promisedDeliveryDate;
    const newEta = tracking.estimatedDelivery;
    const delayHours = this.calculateDelayHours(originalEta, newEta);

    this.logger.warn(`Delivery delay detected: Order ${order.id}, +${delayHours}h`);

    if (delayHours > 24) {
      // Notify customer proactively
      await this.notificationService.sendDelayNotification({
        orderId: order.id,
        customerEmail: order.customerEmail,
        originalEta,
        newEta,
        reason: tracking.delayReason,
      });

      // Generate compensation if >48h delay
      if (delayHours > 48) {
        const coupon = await this.couponService.generateCompensation({
          customerId: order.customerId,
          discount: 10, // percent
          maxValue: 15, // euros
          reason: 'delivery_delay',
        });

        this.logger.log(`Compensation coupon ${coupon.code} generated for order ${order.id}`);
      }

      // Log carrier incident for Supplier Scorer
      await this.carrierScorer.logIncident({
        carrier: tracking.carrier,
        type: 'SLA_BREACH',
        delayHours,
        orderId: order.id,
      });
    }
  }

  /**
   * Daily carrier performance analysis
   */
  @Cron('0 7 * * *')
  async analyzeCarrierPerformance(): Promise<CarrierPerformanceReport> {
    this.logger.log('Analyzing carrier performance...');

    // Mock - would query delivery history from last 30 days
    const performance = {
      colissimo: { slaCompliance: 0.94, avgDelay: 2.1, incidents: 12 },
      chronopost: { slaCompliance: 0.91, avgDelay: 1.8, incidents: 18 },
      mondial_relay: { slaCompliance: 0.89, avgDelay: 3.2, incidents: 25 },
      dpd: { slaCompliance: 0.92, avgDelay: 2.4, incidents: 15 },
    };

    // Alert if any carrier below 90% SLA
    for (const [carrier, stats] of Object.entries(performance)) {
      if (stats.slaCompliance < 0.9) {
        this.logger.warn(`Carrier ${carrier} below SLA threshold: ${(stats.slaCompliance * 100).toFixed(1)}%`);
      }
    }

    return performance;
  }

  /**
   * Calculate package dimensions from cart items
   */
  private calculatePackage(items: CartItemDto[]): PackageInfo {
    // Simplified calculation - would need actual product dimensions
    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0.5) * item.quantity, 0);

    return {
      weight: totalWeight,
      length: 30,
      width: 20,
      height: 15,
    };
  }

  /**
   * Rank shipping options and add badges
   */
  private rankOptions(options: CarrierRate[]): ShippingOption[] {
    // Filter valid options
    const valid = options.filter((o) => o.available);

    // Find best in each category
    const cheapest = valid.reduce((a, b) => (a.price < b.price ? a : b));
    const fastest = valid.reduce((a, b) => (a.transitDays < b.transitDays ? a : b));
    const greenest = valid.reduce((a, b) => (a.co2 < b.co2 ? a : b));

    return valid.map((option) => ({
      ...option,
      badges: [
        option === cheapest ? 'CHEAPEST' : null,
        option === fastest ? 'FASTEST' : null,
        option === greenest ? 'ECO' : null,
      ].filter(Boolean) as string[],
      recommended: option === cheapest, // Default recommendation: best price
    }));
  }

  /**
   * Get transit time between warehouse and destination
   */
  private async getTransitTime(_warehouse: any, _postalCode: string): Promise<number> {
    // Mock - would query carrier APIs or use zone mapping
    return 48; // hours
  }

  /**
   * Calculate delivery date based on current time and transit
   */
  private calculateDeliveryDate(
    now: Date,
    pickingHours: number,
    transitHours: number,
    isBeforeCutoff: boolean,
  ): Date {
    const totalHours = pickingHours + transitHours + (isBeforeCutoff ? 0 : 24);
    const deliveryDate = new Date(now.getTime() + totalHours * 60 * 60 * 1000);

    // Skip weekends
    while (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
    }

    return deliveryDate;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }

  /**
   * Group order items by warehouse
   */
  private groupByWarehouse(items: OrderItemDto[]): Record<string, OrderItemDto[]> {
    return items.reduce((acc, item) => {
      const warehouse = item.warehouseId || 'DEFAULT';
      if (!acc[warehouse]) acc[warehouse] = [];
      acc[warehouse].push(item);
      return acc;
    }, {} as Record<string, OrderItemDto[]>);
  }

  /**
   * Calculate cost for consolidated shipment
   */
  private async calculateConsolidatedCost(_order: OrderDto): Promise<number> {
    // Mock - would calculate based on total weight and destination
    return 8.5;
  }

  /**
   * Calculate cost for split shipments
   */
  private async calculateSplitCost(
    _itemsByWarehouse: Record<string, OrderItemDto[]>,
    _destination: AddressDto,
  ): Promise<number> {
    // Mock - would calculate each shipment separately
    return 14.2;
  }

  /**
   * Calculate delay for consolidation (transfer between warehouses)
   */
  private async calculateConsolidationDelay(
    _itemsByWarehouse: Record<string, OrderItemDto[]>,
  ): Promise<number> {
    // Mock - would calculate based on warehouse distances
    return 48; // hours
  }

  /**
   * Calculate delay between two dates in hours
   */
  private calculateDelayHours(original: Date, newDate: Date): number {
    return Math.round((newDate.getTime() - original.getTime()) / (1000 * 60 * 60));
  }
}

// Types
interface CartDto {
  id: string;
  items: CartItemDto[];
}

interface CartItemDto {
  sku: string;
  quantity: number;
  weight?: number;
}

interface AddressDto {
  postalCode: string;
  city: string;
  country: string;
}

interface OrderDto {
  id: string;
  items: OrderItemDto[];
  destination: AddressDto;
}

interface OrderItemDto {
  sku: string;
  quantity: number;
  warehouseId?: string;
}

interface PackageInfo {
  weight: number;
  length: number;
  width: number;
  height: number;
}

interface CarrierRate {
  carrier: string;
  price: number;
  transitDays: number;
  co2: number;
  available: boolean;
}

interface ShippingOption extends CarrierRate {
  badges: string[];
  recommended: boolean;
}

interface DeliveryPromise {
  available: boolean;
  deliveryDate?: Date;
  message: string;
  cutoffMessage?: string;
}

interface SplitDecision {
  strategy: 'SINGLE' | 'SPLIT' | 'CONSOLIDATE';
  shipments: number;
  reason?: string;
}

interface TrackingUpdate {
  number: string;
  carrier: string;
  estimatedDelivery: Date;
  delayReason?: string;
}

interface CarrierPerformanceReport {
  [carrier: string]: {
    slaCompliance: number;
    avgDelay: number;
    incidents: number;
  };
}
