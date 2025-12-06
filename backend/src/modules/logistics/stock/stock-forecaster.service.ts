import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Stock Forecaster Agent (IA-Stock)
 *
 * Specialized Agent - E-Commerce Squad (Logistique & Supply Chain)
 *
 * Responsibilities:
 * 1. Demand Forecasting ML (Prophet/ARIMA) - horizons J+7/14/30/90
 * 2. Rupture Prevention - alertes J-14, PO auto ERPNext
 * 3. Surstock Alert - rotation >90j, coordination liquidation
 * 4. Safety Stock Optimizer - calcul dynamique σ×Z×√LeadTime
 * 5. Supplier Lead Time Tracker - intégration ERPNext
 *
 * KPIs: rupture-stock <5%, surstock-rate <10%, forecast-accuracy >85%, inventory-turnover >6x/an
 */
@Injectable()
export class StockForecasterService {
  private readonly logger = new Logger(StockForecasterService.name);

  // Mock dependencies - à remplacer par vrais services
  private erpnext = {
    getStockLevels: async () => [],
    getSalesHistory: async (_params: any) => [],
    getAverageLeadTime: async () => 7,
    createPurchaseOrderDraft: async (_items: any[]) => {},
  };
  private prophet = {
    predict: async (_params: any) => ({}),
  };
  private redis = {
    set: async (_key: string, _value: any, _ex: string, _ttl: number) => {},
  };
  private slack = {
    send: async (_params: any) => {},
  };

  /**
   * Daily Stock Forecast - Runs at 6am
   * Predicts demand for J+7, J+14, J+30 and identifies at-risk SKUs
   */
  @Cron('0 6 * * *')
  async runDailyForecast(): Promise<ForecastReport> {
    this.logger.log('Running daily stock forecast...');

    // 1. Fetch current stock from ERPNext (source of truth)
    const stock = await this.erpnext.getStockLevels();

    // 2. Get sales history (last 365 days)
    const salesHistory = await this.erpnext.getSalesHistory({
      period: '365d',
      granularity: 'daily',
    });

    // 3. Run Prophet forecast
    const forecasts = await this.prophet.predict({
      history: salesHistory,
      horizons: [7, 14, 30],
      seasonality: ['weekly', 'yearly'],
    });

    // 4. Calculate safety stock
    const leadTime = await this.erpnext.getAverageLeadTime();
    const safetyStock = this.calculateSafetyStock(forecasts, {
      serviceLevel: 0.95,
      leadTime,
    });

    // 5. Identify at-risk SKUs
    const atRisk = stock.filter(
      (item: StockItem) => item.quantity < (safetyStock[item.sku] || 0) * 1.2,
    );

    // 6. Generate alerts
    if (atRisk.length > 0) {
      await this.alertRuptureRisk(atRisk);
    }

    // 7. Cache results for dashboard
    await this.redis.set('stock:forecast:latest', forecasts, 'EX', 86400);

    this.logger.log(
      `Forecast complete: ${atRisk.length} SKUs at risk identified`,
    );

    return { forecasts, atRisk, safetyStock };
  }

  /**
   * Surstock Detection - Weekly scan (Mondays 7am)
   * Identifies products with rotation >90 days
   */
  @Cron('0 7 * * 1')
  async detectSurstock(): Promise<SurstockReport> {
    this.logger.log('Scanning for surstock...');

    const stock = await this.erpnext.getStockLevels();
    const turnover = await this.calculateTurnoverRate();

    const surstock = stock.filter((item: StockItem) => {
      const avgRotation = turnover[item.sku] || 30;
      const daysOfStock = item.quantity / (avgRotation / 30);
      return daysOfStock > 90; // >3 months stock
    });

    if (surstock.length > 0) {
      await this.triggerLiquidationWorkflow(surstock);
    }

    const totalValue = this.calculateValue(surstock);
    this.logger.log(
      `Surstock detected: ${surstock.length} SKUs, €${totalValue} value`,
    );

    return { surstock, totalValue };
  }

  /**
   * Seasonal Spike Preparation
   * Called manually or by scheduler before major events
   */
  async prepareSeasonalSpike(event: SeasonalEvent): Promise<SeasonalReport> {
    this.logger.log(`Preparing for seasonal spike: ${event.name}`);

    // 1. Get category-specific uplift predictions
    const uplifts = this.getSeasonalUplifts(event);

    // 2. Adjust safety stock for impacted categories
    const adjustments = await this.adjustSafetyStock(uplifts, event.multiplier);

    // 3. Generate pre-orders for suppliers
    const preOrders = await this.generatePreOrders(adjustments, event.leadDays);

    this.logger.log(
      `Seasonal prep complete: ${preOrders.length} POs generated`,
    );

    return { event, uplifts, adjustments, preOrders };
  }

  /**
   * Calculate dynamic safety stock
   * Formula: Safety Stock = σ × Z × √(Lead Time)
   */
  private calculateSafetyStock(
    forecasts: any,
    params: { serviceLevel: number; leadTime: number },
  ): Record<string, number> {
    const zScore = this.getZScore(params.serviceLevel); // 1.65 for 95%
    const safetyStock: Record<string, number> = {};

    // Mock calculation - replace with actual forecast data
    Object.keys(forecasts).forEach((sku) => {
      const stdDev = forecasts[sku]?.stdDev || 10;
      safetyStock[sku] = stdDev * zScore * Math.sqrt(params.leadTime);
    });

    return safetyStock;
  }

  /**
   * Get Z-score for service level
   */
  private getZScore(serviceLevel: number): number {
    // Common Z-scores for service levels
    const zScores: Record<number, number> = {
      0.9: 1.28,
      0.95: 1.65,
      0.99: 2.33,
    };
    return zScores[serviceLevel] || 1.65;
  }

  /**
   * Calculate turnover rate per SKU
   */
  private async calculateTurnoverRate(): Promise<Record<string, number>> {
    // Mock - would query ERPNext sales data
    return {};
  }

  /**
   * Calculate total value of stock items
   */
  private calculateValue(items: StockItem[]): number {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitCost || 0), 0);
  }

  /**
   * Alert for rupture risk via Slack
   */
  private async alertRuptureRisk(items: StockItem[]): Promise<void> {
    const critical = items.filter((i) => (i.daysUntilRupture || 999) < 7);
    const warning = items.filter(
      (i) => (i.daysUntilRupture || 999) >= 7 && (i.daysUntilRupture || 999) < 14,
    );

    if (critical.length > 0) {
      await this.slack.send({
        channel: '#stock-alerts',
        text: `🔴 RUPTURE CRITIQUE: ${critical.length} SKUs < J+7`,
        attachments: critical.map(this.formatStockAlert),
      });

      // Auto-create PO draft in ERPNext
      await this.erpnext.createPurchaseOrderDraft(critical);
    }

    if (warning.length > 0) {
      await this.slack.send({
        channel: '#stock-alerts',
        text: `🟠 ATTENTION: ${warning.length} SKUs < J+14`,
      });
    }
  }

  /**
   * Format stock alert for Slack attachment
   */
  private formatStockAlert(item: StockItem): any {
    return {
      title: item.sku,
      fields: [
        { title: 'Stock', value: item.quantity.toString(), short: true },
        { title: 'Jours restants', value: item.daysUntilRupture?.toString() || 'N/A', short: true },
      ],
      color: (item.daysUntilRupture || 999) < 7 ? 'danger' : 'warning',
    };
  }

  /**
   * Trigger liquidation workflow for surstock items
   */
  private async triggerLiquidationWorkflow(items: StockItem[]): Promise<void> {
    // Categorize by rotation days
    const rotation90_120 = items.filter(
      (i) => (i.rotationDays || 0) >= 90 && (i.rotationDays || 0) < 120,
    );
    const rotation120_180 = items.filter(
      (i) => (i.rotationDays || 0) >= 120 && (i.rotationDays || 0) < 180,
    );
    const rotation180plus = items.filter((i) => (i.rotationDays || 0) >= 180);

    this.logger.log(
      `Liquidation workflow: ${rotation90_120.length} SKUs -10%, ${rotation120_180.length} SKUs -20%, ${rotation180plus.length} SKUs -30%`,
    );

    // TODO: Integrate with Pricing Bot, IA-Ads, IA-Merch
    // await this.pricingBot.applyDiscount(rotation90_120, 0.10);
    // await this.adsAgent.createPromo(rotation120_180, 0.20);
    // await this.merchAgent.createBundles(rotation180plus);
  }

  /**
   * Get seasonal uplifts by category
   */
  private getSeasonalUplifts(event: SeasonalEvent): Record<string, number> {
    const uplifts: Record<string, Record<string, number>> = {
      BLACK_FRIDAY: {
        'pneus-hiver': 1.5,
        batteries: 0.6,
        freinage: 0.4,
      },
      NOEL: {
        'accessoires-interieur': 0.8,
        'cadeaux-auto': 1.2,
      },
      ETE: {
        climatisation: 0.8,
        'pneus-ete': 0.5,
      },
    };
    return uplifts[event.type] || {};
  }

  /**
   * Adjust safety stock for seasonal events
   */
  private async adjustSafetyStock(
    uplifts: Record<string, number>,
    multiplier: number,
  ): Promise<any[]> {
    // Mock - would update safety stock in system
    return Object.entries(uplifts).map(([category, uplift]) => ({
      category,
      uplift,
      newMultiplier: 1 + uplift * multiplier,
    }));
  }

  /**
   * Generate pre-orders for suppliers
   */
  private async generatePreOrders(
    adjustments: any[],
    leadDays: number,
  ): Promise<any[]> {
    // Mock - would create POs in ERPNext
    this.logger.log(
      `Generating pre-orders ${leadDays} days in advance for ${adjustments.length} categories`,
    );
    return [];
  }
}

// Types
interface StockItem {
  sku: string;
  quantity: number;
  unitCost?: number;
  daysUntilRupture?: number;
  rotationDays?: number;
}

interface ForecastReport {
  forecasts: any;
  atRisk: StockItem[];
  safetyStock: Record<string, number>;
}

interface SurstockReport {
  surstock: StockItem[];
  totalValue: number;
}

interface SeasonalEvent {
  name: string;
  type: string;
  multiplier: number;
  leadDays: number;
}

interface SeasonalReport {
  event: SeasonalEvent;
  uplifts: Record<string, number>;
  adjustments: any[];
  preOrders: any[];
}
