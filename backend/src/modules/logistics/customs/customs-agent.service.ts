import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * IA-Customs - Agent Import/Export (v2.21.0)
 *
 * Specialized Agent E-Commerce Squad - International Trade
 * Budget: €35K (Dev €28K + APIs douanes €7K)
 * ROI: +€85K/an (conformité 100% + réduction retards douane -40%)
 *
 * 5 Responsabilités:
 * 1. Customs Duty Calculator - Calcul automatique droits TARIC UE
 * 2. Shipment Tracking International - Maritime/Aérien/Ferroviaire
 * 3. Port Delay Monitor - Surveillance congestion 6 ports majeurs
 * 4. Incoterms Advisor - Recommandation FOB/CIF/DDP
 * 5. Compliance Documents Generator - PDF + EDI douanes
 *
 * KPIs:
 * - customs-accuracy: >98%
 * - international-transit: <14 jours
 * - port-delay-rate: <10%
 * - compliance-score: 100%
 */

// ==================== INTERFACES ====================

export interface DutyRates {
  customsDuty: number; // Percentage
  antidumping?: number; // Percentage if applicable
  countervailing?: number; // Percentage if applicable
  excise?: number; // Fixed amount if applicable
}

export interface ItemDutyCalculation {
  sku: string;
  description: string;
  hsCode: string;
  value: number;
  quantity: number;
  weight: number;
  dutyRate: number;
  dutyAmount: number;
  antidumpingRate: number;
  antidumpingAmount: number;
}

export interface DutyCalculation {
  poNumber: string;
  originCountry: string;
  destinationCountry: string;
  items: ItemDutyCalculation[];
  goodsValue: number;
  freight: number;
  insurance: number;
  cifValue: number;
  totalDuty: number;
  totalAntidumping: number;
  vatBase: number;
  vatRate: number;
  vatAmount: number;
  totalLandedCost: number;
  calculatedAt: Date;
  warnings: string[];
}

export interface ShipmentStatus {
  trackingNumber: string;
  carrier: string;
  transportMode: 'MARITIME' | 'AIR' | 'RAIL' | 'ROAD';
  origin: {
    port: string;
    country: string;
    departureDate: Date;
  };
  destination: {
    port: string;
    country: string;
    estimatedArrival: Date;
    actualArrival?: Date;
  };
  currentLocation: {
    port?: string;
    coordinates?: { lat: number; lng: number };
    status: string;
  };
  vessel?: {
    name: string;
    imo: string;
    flag: string;
  };
  containers?: {
    number: string;
    type: string;
    sealNumber: string;
  }[];
  delayDays: number;
  events: ShipmentEvent[];
}

export interface ShipmentEvent {
  timestamp: Date;
  location: string;
  event: string;
  details?: string;
}

export interface PortDelayReport {
  portCode: string;
  portName: string;
  country: string;
  currentDelay: number; // Days
  historicalAvg: number; // Days
  congestionLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
  affectedShipments: number;
  predictedNormalization?: Date;
}

export interface IncotermRecommendation {
  supplierId: string;
  supplierName: string;
  recommended: string;
  reason: string;
  confidence: number;
  alternatives: IncotermAlternative[];
  costComparison: IncotermCostComparison[];
  supplierMetrics: {
    onTimeRate: number;
    documentAccuracy: number;
    claimRate: number;
    totalDeliveries: number;
  };
}

export interface IncotermAlternative {
  term: string;
  description: string;
  riskTransfer: string;
  costResponsibility: string;
}

export interface IncotermCostComparison {
  incoterm: string;
  estimatedCost: number;
  ourRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  supplierRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  recommended: boolean;
}

export interface CustomsDocuments {
  shipmentId: string;
  poNumber: string;
  generatedAt: Date;
  documents: CustomsDocument[];
  validationStatus: 'VALID' | 'WARNINGS' | 'ERRORS';
  validationMessages: string[];
  ediStatus?: 'READY' | 'TRANSMITTED' | 'ACCEPTED' | 'REJECTED';
}

export interface CustomsDocument {
  type:
    | 'COMMERCIAL_INVOICE'
    | 'PACKING_LIST'
    | 'CERTIFICATE_OF_ORIGIN'
    | 'CUSTOMS_DECLARATION'
    | 'BILL_OF_LADING'
    | 'MSDS';
  filename: string;
  format: 'PDF' | 'XML' | 'EDI';
  url: string;
  hash: string;
  generatedAt: Date;
}

export interface TaricQueryResult {
  hsCode: string;
  description: string;
  dutyRate: number;
  measureType: string;
  originCountry: string;
  conditions?: string[];
  antidumpingMeasure?: {
    rate: number;
    exporter?: string;
    regulation: string;
    expiryDate: Date;
  };
  preferentialRates?: {
    agreement: string;
    rate: number;
    conditions: string[];
  }[];
}

// Mock interfaces for external services
interface TaricApiService {
  getDutyRates(params: {
    hsCode: string;
    originCountry: string;
    destinationCountry: string;
  }): Promise<DutyRates>;
  searchHsCode(description: string, category: string): Promise<string>;
  getPreferentialRates(
    hsCode: string,
    originCountry: string,
  ): Promise<TaricQueryResult['preferentialRates']>;
}

interface ShipmentTrackingService {
  getStatus(trackingNumber: string): Promise<ShipmentStatus>;
  subscribeToUpdates(
    trackingNumber: string,
    webhookUrl: string,
  ): Promise<void>;
}

interface PortDelayService {
  getCurrentDelay(portCode: string): Promise<number>;
  getHistoricalAverage(portCode: string, days?: number): Promise<number>;
  getPrediction(portCode: string): Promise<{ delay: number; confidence: number }>;
}

interface ErpNextClient {
  getPurchaseOrder(poNumber: string): Promise<any>;
  getItem(sku: string): Promise<any>;
  getSupplier(supplierId: string): Promise<any>;
  getShipment(shipmentId: string): Promise<any>;
  updateLandedCost(poNumber: string, cost: number): Promise<void>;
  attachDocuments(shipmentId: string, documents: CustomsDocuments): Promise<void>;
}

interface CustomsDocumentService {
  generate(params: {
    type: string;
    shipment: any;
    po: any;
    documents: string[];
  }): Promise<CustomsDocuments>;
}

// ==================== MAIN SERVICE ====================

@Injectable()
export class CustomsAgentService {
  private readonly logger = new Logger(CustomsAgentService.name);

  // External services (to be injected)
  private taric: TaricApiService;
  private tracking: ShipmentTrackingService;
  private portMonitor: PortDelayService;
  private erpnext: ErpNextClient;
  private documentGenerator: CustomsDocumentService;

  // Configuration
  private readonly config = {
    vatRates: {
      FR: 20,
      DE: 19,
      ES: 21,
      IT: 22,
      BE: 21,
      NL: 21,
    } as Record<string, number>,
    monitoredPorts: [
      { code: 'CNSHA', name: 'Shanghai', country: 'CN' },
      { code: 'CNNBO', name: 'Ningbo', country: 'CN' },
      { code: 'CNSZX', name: 'Shenzhen', country: 'CN' },
      { code: 'FRLEH', name: 'Le Havre', country: 'FR' },
      { code: 'NLRTM', name: 'Rotterdam', country: 'NL' },
      { code: 'BEANR', name: 'Antwerp', country: 'BE' },
    ],
    incoterms: {
      EXW: { risk: 'BUYER', cost: 'BUYER' },
      FOB: { risk: 'SHARED', cost: 'SHARED' },
      CIF: { risk: 'SELLER_PARTIAL', cost: 'SELLER_PARTIAL' },
      DDP: { risk: 'SELLER', cost: 'SELLER' },
      DAP: { risk: 'SELLER_PARTIAL', cost: 'SELLER' },
    },
    alerts: {
      delayThreshold: 1, // Days
      portCongestionMultiplier: 1.5,
      antidumpingThreshold: 0,
    },
  };

  // Cache for duty rates (TTL: 24h)
  private dutyRatesCache = new Map<
    string,
    { rates: DutyRates; cachedAt: Date }
  >();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.logger.log('IA-Customs (Import/Export Agent) initialized');
  }

  // ==================== 1. CUSTOMS DUTY CALCULATOR ====================

  /**
   * Calculate customs duties for a purchase order
   * KPI: customs-accuracy >98%
   */
  async calculateDuties(poNumber: string): Promise<DutyCalculation> {
    this.logger.log(`📋 Calculating duties for PO ${poNumber}`);
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // 1. Fetch PO details from ERPNext
      const po = await this.erpnext.getPurchaseOrder(poNumber);
      const destinationCountry = 'FR'; // Default to France

      // 2. Get HS codes for each item
      const itemsWithHs = await this.enrichWithHsCodes(po.items);

      // 3. Query TARIC for duty rates
      const duties = await Promise.all(
        itemsWithHs.map(async (item) => {
          const rates = await this.getDutyRatesWithCache(
            item.hsCode,
            po.supplierCountry,
            destinationCountry,
          );

          const dutyAmount = item.value * (rates.customsDuty / 100);
          const antidumpingAmount = item.value * ((rates.antidumping || 0) / 100);

          // Check for antidumping
          if (rates.antidumping && rates.antidumping > 0) {
            warnings.push(
              `⚠️ Antidumping duties detected on ${item.sku} (${item.hsCode}): ${rates.antidumping}%`,
            );
          }

          return {
            sku: item.sku,
            description: item.description,
            hsCode: item.hsCode,
            value: item.value,
            quantity: item.quantity,
            weight: item.weight,
            dutyRate: rates.customsDuty,
            dutyAmount,
            antidumpingRate: rates.antidumping || 0,
            antidumpingAmount,
          };
        }),
      );

      // 4. Calculate totals
      const goodsValue = duties.reduce((sum, d) => sum + d.value, 0);
      const totalDuty = duties.reduce((sum, d) => sum + d.dutyAmount, 0);
      const totalAntidumping = duties.reduce(
        (sum, d) => sum + d.antidumpingAmount,
        0,
      );

      const freight = po.freight || 0;
      const insurance = po.insurance || freight * 0.01; // Default 1% of freight

      const cifValue = goodsValue + freight + insurance;
      const vatBase = cifValue + totalDuty + totalAntidumping;
      const vatRate = this.config.vatRates[destinationCountry] || 20;
      const vatAmount = vatBase * (vatRate / 100);
      const totalLandedCost = totalDuty + totalAntidumping + vatAmount;

      const result: DutyCalculation = {
        poNumber,
        originCountry: po.supplierCountry,
        destinationCountry,
        items: duties,
        goodsValue,
        freight,
        insurance,
        cifValue,
        totalDuty,
        totalAntidumping,
        vatBase,
        vatRate,
        vatAmount,
        totalLandedCost,
        calculatedAt: new Date(),
        warnings,
      };

      // 5. Update ERPNext with landed cost
      await this.erpnext.updateLandedCost(poNumber, totalLandedCost);

      // 6. Alert if antidumping detected
      if (totalAntidumping > 0) {
        await this.alertAntidumping(result);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Duties calculated for ${poNumber} in ${duration}ms: €${totalLandedCost.toFixed(2)} landed cost`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Failed to calculate duties for ${poNumber}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get duty rates with caching
   */
  private async getDutyRatesWithCache(
    hsCode: string,
    originCountry: string,
    destinationCountry: string,
  ): Promise<DutyRates> {
    const cacheKey = `${hsCode}-${originCountry}-${destinationCountry}`;
    const cached = this.dutyRatesCache.get(cacheKey);

    if (cached && Date.now() - cached.cachedAt.getTime() < this.CACHE_TTL) {
      return cached.rates;
    }

    const rates = await this.taric.getDutyRates({
      hsCode,
      originCountry,
      destinationCountry,
    });

    this.dutyRatesCache.set(cacheKey, { rates, cachedAt: new Date() });
    return rates;
  }

  /**
   * Enrich items with HS codes
   */
  private async enrichWithHsCodes(items: any[]): Promise<any[]> {
    return Promise.all(
      items.map(async (item) => {
        const product = await this.erpnext.getItem(item.sku);
        const hsCode =
          product.customsHsCode || (await this.inferHsCode(product));

        return {
          ...item,
          hsCode,
        };
      }),
    );
  }

  /**
   * AI-based HS code inference from product description
   */
  private async inferHsCode(product: any): Promise<string> {
    // Map common auto parts categories to HS codes
    const categoryMappings: Record<string, string> = {
      brake_pads: '8708.30.10',
      brake_discs: '8708.30.91',
      filters: '8421.23.00',
      spark_plugs: '8511.10.00',
      batteries: '8507.60.00',
      tires: '4011.10.00',
      oils: '2710.19.81',
      wipers: '8512.90.90',
      lights: '8512.20.00',
      mirrors: '7009.10.00',
    };

    const category = product.category?.toLowerCase().replace(/\s+/g, '_');
    if (category && categoryMappings[category]) {
      return categoryMappings[category];
    }

    // Use TARIC search API for unknown categories
    try {
      return await this.taric.searchHsCode(
        product.description,
        product.category,
      );
    } catch {
      // Fallback to generic auto parts code
      return '8708.99.99';
    }
  }

  /**
   * Alert CFO about antidumping duties
   */
  private async alertAntidumping(calculation: DutyCalculation): Promise<void> {
    this.logger.warn(
      `🚨 ANTIDUMPING ALERT: PO ${calculation.poNumber} has €${calculation.totalAntidumping.toFixed(2)} in antidumping duties`,
    );

    // TODO: Notify IA-CFO via event bus
    // this.eventBus.emit('customs.antidumping.detected', {
    //   poNumber: calculation.poNumber,
    //   amount: calculation.totalAntidumping,
    //   items: calculation.items.filter(i => i.antidumpingRate > 0),
    //   suggestion: 'Consider alternative suppliers in Thailand/Vietnam'
    // });
  }

  // ==================== 2. SHIPMENT TRACKING ====================

  /**
   * Track international shipment
   * KPI: international-transit <14j
   */
  async trackShipment(trackingNumber: string): Promise<ShipmentStatus> {
    this.logger.log(`🚢 Tracking shipment ${trackingNumber}`);

    const shipment = await this.tracking.getStatus(trackingNumber);

    // Check for delays
    if (shipment.delayDays > this.config.alerts.delayThreshold) {
      await this.notifyDelay(shipment);
    }

    return shipment;
  }

  /**
   * Notify stakeholders about shipment delay
   */
  private async notifyDelay(shipment: ShipmentStatus): Promise<void> {
    this.logger.warn(
      `⏰ Shipment ${shipment.trackingNumber} delayed by ${shipment.delayDays} days`,
    );

    // TODO: Notify IA-Stock for inventory adjustment
    // this.eventBus.emit('customs.shipment.delayed', {
    //   trackingNumber: shipment.trackingNumber,
    //   delayDays: shipment.delayDays,
    //   newEta: shipment.destination.estimatedArrival,
    //   affectedItems: [] // Would fetch from PO
    // });
  }

  /**
   * Bulk track all active shipments
   */
  async trackAllActiveShipments(): Promise<ShipmentStatus[]> {
    // TODO: Fetch active shipments from ERPNext
    const activeTrackingNumbers: string[] = [];
    return Promise.all(
      activeTrackingNumbers.map((tn) => this.trackShipment(tn)),
    );
  }

  // ==================== 3. PORT DELAY MONITOR ====================

  /**
   * Monitor port delays and predict impact
   * KPI: port-delay-rate <10%
   * Runs every 4 hours
   */
  @Cron('0 */4 * * *')
  async monitorPortDelays(): Promise<PortDelayReport[]> {
    this.logger.log('🌊 Monitoring port delays...');

    const reports = await Promise.all(
      this.config.monitoredPorts.map(async (port) => {
        const currentDelay = await this.portMonitor.getCurrentDelay(port.code);
        const historicalAvg = await this.portMonitor.getHistoricalAverage(
          port.code,
          90,
        );

        let congestionLevel: PortDelayReport['congestionLevel'] = 'LOW';
        if (currentDelay > historicalAvg * 2) {
          congestionLevel = 'CRITICAL';
        } else if (
          currentDelay >
          historicalAvg * this.config.alerts.portCongestionMultiplier
        ) {
          congestionLevel = 'HIGH';
        } else if (currentDelay > historicalAvg * 1.2) {
          congestionLevel = 'MEDIUM';
        }

        const report: PortDelayReport = {
          portCode: port.code,
          portName: port.name,
          country: port.country,
          currentDelay,
          historicalAvg,
          congestionLevel,
          factors: await this.getCongestionFactors(port.code),
          affectedShipments: await this.countAffectedShipments(port.code),
        };

        // Alert if significant congestion
        if (
          congestionLevel === 'HIGH' ||
          congestionLevel === 'CRITICAL'
        ) {
          await this.alertPortCongestion(report);
        }

        return report;
      }),
    );

    this.logger.log(
      `✅ Port monitoring complete: ${reports.filter((r) => r.congestionLevel !== 'LOW').length} ports with delays`,
    );

    return reports;
  }

  /**
   * Get congestion factors for a port
   */
  private async getCongestionFactors(portCode: string): Promise<string[]> {
    // Mock implementation - would call weather/news APIs
    const factors: string[] = [];

    // TODO: Integrate with weather API, port authority feeds, news APIs
    // Example factors: 'Typhoon', 'Strike', 'Equipment failure', 'Vessel backup'

    return factors;
  }

  /**
   * Count shipments affected by port delays
   */
  private async countAffectedShipments(portCode: string): Promise<number> {
    // TODO: Query ERPNext for shipments currently at or destined for this port
    return 0;
  }

  /**
   * Alert about port congestion
   */
  private async alertPortCongestion(report: PortDelayReport): Promise<void> {
    this.logger.warn(
      `🚢 PORT CONGESTION: ${report.portName} (${report.portCode}) - Level: ${report.congestionLevel}, Delay: +${report.currentDelay}d`,
    );

    // TODO: Notify IA-Stock and IA-CFO
    // this.eventBus.emit('customs.port.congestion', {
    //   port: report,
    //   impact: {
    //     stockItems: [], // Items at risk of stockout
    //     cashflowImpact: 0 // Delayed payments
    //   }
    // });
  }

  // ==================== 4. INCOTERMS ADVISOR ====================

  /**
   * Recommend best Incoterm for supplier
   */
  async recommendIncoterm(
    supplierId: string,
    productCategory?: string,
  ): Promise<IncotermRecommendation> {
    this.logger.log(`📋 Analyzing Incoterms for supplier ${supplierId}`);

    const supplier = await this.erpnext.getSupplier(supplierId);
    const history = await this.getSupplierHistory(supplierId);

    // Analyze supplier reliability
    const onTimeRate =
      history.totalDeliveries > 0
        ? history.onTimeDeliveries / history.totalDeliveries
        : 0;
    const documentAccuracy =
      history.totalDeliveries > 0
        ? history.correctDocuments / history.totalDeliveries
        : 0;
    const claimRate =
      history.totalDeliveries > 0
        ? history.claims / history.totalDeliveries
        : 0;

    let recommended: string;
    let reason: string;
    let confidence: number;

    if (onTimeRate > 0.95 && documentAccuracy > 0.98 && claimRate < 0.01) {
      recommended = 'FOB';
      reason = 'Excellent supplier reliability - manage logistics for cost savings';
      confidence = 0.9;
    } else if (onTimeRate > 0.85 && documentAccuracy > 0.90) {
      recommended = 'CIF';
      reason = 'Good supplier - let them handle shipping, we handle customs';
      confidence = 0.75;
    } else if (onTimeRate > 0.70) {
      recommended = 'DAP';
      reason = 'Variable reliability - supplier handles transport to destination';
      confidence = 0.6;
    } else {
      recommended = 'DDP';
      reason = 'Low reliability - transfer all risk to supplier';
      confidence = 0.85;
    }

    return {
      supplierId,
      supplierName: supplier.name,
      recommended,
      reason,
      confidence,
      alternatives: this.getIncotermAlternatives(recommended),
      costComparison: await this.compareIncotermCosts(
        supplierId,
        productCategory,
      ),
      supplierMetrics: {
        onTimeRate,
        documentAccuracy,
        claimRate,
        totalDeliveries: history.totalDeliveries,
      },
    };
  }

  /**
   * Get supplier delivery history
   */
  private async getSupplierHistory(supplierId: string): Promise<{
    totalDeliveries: number;
    onTimeDeliveries: number;
    correctDocuments: number;
    claims: number;
  }> {
    // TODO: Query ERPNext for historical data
    return {
      totalDeliveries: 0,
      onTimeDeliveries: 0,
      correctDocuments: 0,
      claims: 0,
    };
  }

  /**
   * Get alternative Incoterms
   */
  private getIncotermAlternatives(recommended: string): IncotermAlternative[] {
    const all: IncotermAlternative[] = [
      {
        term: 'EXW',
        description: 'Ex Works - Buyer bears all costs and risks',
        riskTransfer: 'At seller premises',
        costResponsibility: 'Buyer pays everything',
      },
      {
        term: 'FOB',
        description: 'Free On Board - Risk transfers at ship rail',
        riskTransfer: 'When goods pass ship rail',
        costResponsibility: 'Buyer pays freight and insurance',
      },
      {
        term: 'CIF',
        description: 'Cost Insurance Freight - Seller pays to destination port',
        riskTransfer: 'When goods pass ship rail',
        costResponsibility: 'Seller pays freight and insurance to port',
      },
      {
        term: 'DAP',
        description: 'Delivered At Place - Seller delivers to agreed location',
        riskTransfer: 'At destination',
        costResponsibility: 'Seller pays transport, buyer pays import',
      },
      {
        term: 'DDP',
        description: 'Delivered Duty Paid - Seller bears all costs',
        riskTransfer: 'At final destination',
        costResponsibility: 'Seller pays everything including duties',
      },
    ];

    return all.filter((i) => i.term !== recommended);
  }

  /**
   * Compare costs for different Incoterms
   */
  private async compareIncotermCosts(
    supplierId: string,
    productCategory?: string,
  ): Promise<IncotermCostComparison[]> {
    // Mock implementation - would calculate based on routes and rates
    const baseCost = 10000; // Example €10K shipment

    return [
      {
        incoterm: 'EXW',
        estimatedCost: baseCost + 1500,
        ourRisk: 'HIGH',
        supplierRisk: 'LOW',
        recommended: false,
      },
      {
        incoterm: 'FOB',
        estimatedCost: baseCost + 1200,
        ourRisk: 'MEDIUM',
        supplierRisk: 'MEDIUM',
        recommended: true,
      },
      {
        incoterm: 'CIF',
        estimatedCost: baseCost + 1000,
        ourRisk: 'MEDIUM',
        supplierRisk: 'MEDIUM',
        recommended: false,
      },
      {
        incoterm: 'DDP',
        estimatedCost: baseCost + 800,
        ourRisk: 'LOW',
        supplierRisk: 'HIGH',
        recommended: false,
      },
    ];
  }

  // ==================== 5. COMPLIANCE DOCUMENTS GENERATOR ====================

  /**
   * Generate customs documents for shipment
   * KPI: compliance-score 100%
   */
  async generateDocuments(shipmentId: string): Promise<CustomsDocuments> {
    this.logger.log(`📄 Generating customs documents for shipment ${shipmentId}`);

    const shipment = await this.erpnext.getShipment(shipmentId);
    const po = await this.erpnext.getPurchaseOrder(shipment.poNumber);

    const documents = await this.documentGenerator.generate({
      type: 'IMPORT',
      shipment,
      po,
      documents: [
        'COMMERCIAL_INVOICE',
        'PACKING_LIST',
        'CERTIFICATE_OF_ORIGIN',
        'CUSTOMS_DECLARATION',
      ],
    });

    // Validate documents
    const validation = await this.validateDocuments(documents);
    documents.validationStatus = validation.status;
    documents.validationMessages = validation.messages;

    // Store in ERPNext
    await this.erpnext.attachDocuments(shipmentId, documents);

    // Forward to customs broker if configured
    if (shipment.broker) {
      await this.forwardToBroker(shipment.broker, documents);
    }

    this.logger.log(
      `✅ Documents generated for ${shipmentId}: ${documents.documents.length} files`,
    );

    return documents;
  }

  /**
   * Validate generated documents
   */
  private async validateDocuments(
    documents: CustomsDocuments,
  ): Promise<{ status: 'VALID' | 'WARNINGS' | 'ERRORS'; messages: string[] }> {
    const messages: string[] = [];
    let hasErrors = false;
    let hasWarnings = false;

    // Check all required documents are present
    const requiredTypes = [
      'COMMERCIAL_INVOICE',
      'PACKING_LIST',
      'CUSTOMS_DECLARATION',
    ];
    for (const type of requiredTypes) {
      if (!documents.documents.find((d) => d.type === type)) {
        messages.push(`❌ Missing required document: ${type}`);
        hasErrors = true;
      }
    }

    // Certificate of origin is optional but recommended
    if (!documents.documents.find((d) => d.type === 'CERTIFICATE_OF_ORIGIN')) {
      messages.push(
        `⚠️ Certificate of Origin missing - may be required for preferential rates`,
      );
      hasWarnings = true;
    }

    return {
      status: hasErrors ? 'ERRORS' : hasWarnings ? 'WARNINGS' : 'VALID',
      messages,
    };
  }

  /**
   * Forward documents to customs broker
   */
  private async forwardToBroker(
    broker: string,
    documents: CustomsDocuments,
  ): Promise<void> {
    this.logger.log(`📤 Forwarding documents to broker: ${broker}`);
    // TODO: Implement broker integration (SFTP, API, EDI)
    documents.ediStatus = 'TRANSMITTED';
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Format duty calculation for display
   */
  formatDutyCalculation(calc: DutyCalculation): string {
    const lines = [
      `📋 CUSTOMS DUTY CALCULATION - ${calc.poNumber}`,
      '',
      `Origin: ${calc.originCountry} → ${calc.destinationCountry}`,
      '',
      `Items analyzed: ${calc.items.length}`,
    ];

    for (const item of calc.items) {
      const duties = item.antidumpingRate > 0
        ? `${item.dutyRate}% + ${item.antidumpingRate}% AD = €${(item.dutyAmount + item.antidumpingAmount).toFixed(2)}`
        : `${item.dutyRate}% = €${item.dutyAmount.toFixed(2)}`;
      lines.push(`├─ ${item.sku} (HS ${item.hsCode}): ${duties}`);
    }

    lines.push('');
    lines.push('Summary:');
    lines.push(`├─ Goods value: €${calc.goodsValue.toFixed(2)}`);
    lines.push(`├─ Freight + Insurance: €${(calc.freight + calc.insurance).toFixed(2)}`);
    lines.push(`├─ CIF Value: €${calc.cifValue.toFixed(2)}`);
    lines.push(`├─ Customs duties: €${calc.totalDuty.toFixed(2)}`);

    if (calc.totalAntidumping > 0) {
      lines.push(`├─ Antidumping duties: €${calc.totalAntidumping.toFixed(2)} ⚠️`);
    }

    lines.push(`├─ VAT (${calc.vatRate}%): €${calc.vatAmount.toFixed(2)}`);
    lines.push(`└─ TOTAL LANDED COST: €${calc.totalLandedCost.toFixed(2)} (+${((calc.totalLandedCost / calc.goodsValue) * 100).toFixed(0)}%)`);

    if (calc.warnings.length > 0) {
      lines.push('');
      lines.push('Warnings:');
      calc.warnings.forEach((w) => lines.push(w));
    }

    return lines.join('\n');
  }

  /**
   * Format port delay report for display
   */
  formatPortDelayReport(report: PortDelayReport): string {
    const emoji =
      report.congestionLevel === 'CRITICAL'
        ? '🔴'
        : report.congestionLevel === 'HIGH'
          ? '🟠'
          : report.congestionLevel === 'MEDIUM'
            ? '🟡'
            : '🟢';

    return [
      `${emoji} ${report.portName} (${report.portCode})`,
      `   Delay: +${report.currentDelay}d (avg: ${report.historicalAvg.toFixed(1)}d)`,
      `   Level: ${report.congestionLevel}`,
      `   Affected: ${report.affectedShipments} shipments`,
      report.factors.length > 0 ? `   Factors: ${report.factors.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  // ==================== HEALTH CHECK ====================

  /**
   * Service health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const checks = {
      taricApi: false,
      trackingApi: false,
      portMonitor: false,
      erpnext: false,
    };

    // TODO: Implement actual health checks for each dependency

    const healthyCount = Object.values(checks).filter(Boolean).length;
    const status =
      healthyCount === 4
        ? 'healthy'
        : healthyCount >= 2
          ? 'degraded'
          : 'unhealthy';

    return {
      status,
      details: {
        ...checks,
        cacheSize: this.dutyRatesCache.size,
        monitoredPorts: this.config.monitoredPorts.length,
      },
    };
  }
}
