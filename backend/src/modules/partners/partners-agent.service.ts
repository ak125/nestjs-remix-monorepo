import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * IA-Partners - Agent Partenaires & Fournisseurs (v2.25.0)
 *
 * Specialized Agent - E-Commerce Squad Supply Chain
 * Budget: €38K (Dev €28K + APIs e-signature/benchmark €10K)
 * ROI: +€80K/an (économies négociation 5% + réduction pénalités + diversification risque)
 *
 * 5 Responsabilités:
 * 1. Contract Lifecycle Manager - Gestion complète cycle de vie contrats
 * 2. SLA Monitor & Enforcer - Surveillance temps réel, pénalités automatiques
 * 3. Negotiation Intelligence - Benchmarking, stratégie, préparation dossiers
 * 4. Supplier Performance Dashboard - Score multicritères, tendances, ranking
 * 5. Partnership Opportunity Finder - Diversification, sourcing alternatif
 *
 * KPIs:
 * - sla-compliance-rate: >95%
 * - contract-renewal-rate: >85%
 * - negotiation-savings: >5%
 * - supplier-diversification-index: >0.6
 * - partner-response-time: <24h
 */

// ==================== INTERFACES ====================

export interface Contract {
  id: string;
  supplierId: string;
  supplierName: string;
  type: ContractType;
  status: ContractStatus;
  startDate: Date;
  endDate: Date;
  value: number; // € annual value
  currency: string;
  terms: ContractTerms;
  slaDefinitions: SLADefinition[];
  documents: ContractDocument[];
  amendments: Amendment[];
  negotiations: NegotiationHistory[];
  createdAt: Date;
  updatedAt: Date;
}

export type ContractType = 'PURCHASE' | 'DISTRIBUTION' | 'TRANSPORT' | 'SERVICE' | 'FRAMEWORK';
export type ContractStatus = 'DRAFT' | 'NEGOTIATION' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED';

export interface ContractTerms {
  paymentTerms: string; // "Net 30", "Net 60", etc.
  paymentMethod: string; // "Wire", "LC", "CAD"
  incoterms?: string; // "FOB", "CIF", "DDP"
  minimumOrderQuantity?: number;
  minimumOrderValue?: number;
  exclusivity?: boolean;
  territory?: string[];
  autoRenewal: boolean;
  noticePeriod: number; // days
  penalties?: PenaltyClause[];
}

export interface PenaltyClause {
  type: 'DELAY' | 'QUALITY' | 'SERVICE';
  threshold: number; // e.g., >5 days delay
  penaltyRate: number; // % of order value
  maxPenalty?: number; // € cap
}

export interface ContractDocument {
  id: string;
  name: string;
  type: 'CONTRACT' | 'AMENDMENT' | 'NDA' | 'SLA' | 'CERTIFICATE' | 'OTHER';
  url: string; // Supabase Storage URL
  signedAt?: Date;
  signedBy?: string[];
  version: number;
}

export interface Amendment {
  id: string;
  date: Date;
  description: string;
  changes: Record<string, { before: any; after: any }>;
  documentId?: string;
}

export interface NegotiationHistory {
  date: Date;
  topic: string;
  ourPosition: string;
  theirPosition: string;
  outcome: 'WON' | 'LOST' | 'COMPROMISE' | 'DEFERRED';
  notes?: string;
}

export interface SLADefinition {
  id: string;
  name: string;
  category: 'DELIVERY' | 'QUALITY' | 'SERVICE' | 'RESPONSE';
  metric: string;
  target: number;
  unit: string; // "days", "%", "hours"
  operator: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ';
  penaltyEnabled: boolean;
  penaltyRate?: number;
}

export interface SLAIncident {
  id: string;
  supplierId: string;
  supplierName: string;
  slaId: string;
  slaName: string;
  orderId?: string;
  detectedAt: Date;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  actualValue: number;
  targetValue: number;
  deviation: number; // %
  status: 'OPEN' | 'WARNING_SENT' | 'PENALTY_APPLIED' | 'ESCALATED' | 'RESOLVED';
  penaltyAmount?: number;
  resolution?: {
    resolvedAt: Date;
    action: string;
    compensationReceived?: number;
  };
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  period: string; // "2025-11"
  scores: {
    quality: number; // 0-100
    delivery: number;
    price: number;
    communication: number;
    innovation: number;
  };
  totalScore: number; // Weighted 0-100
  trend: 'UP' | 'STABLE' | 'DOWN';
  slaCompliance: number; // %
  incidentCount: number;
  orderVolume: number; // €
  metrics: {
    returnRate: number;
    onTimeDeliveryRate: number;
    averageLeadTime: number;
    responseTime: number; // hours
    defectRate: number;
  };
  ranking: {
    category: string;
    position: number;
    totalInCategory: number;
  };
}

export interface DiversificationAnalysis {
  period: string;
  categories: CategoryDiversification[];
  overallHHI: number; // 0-1, lower is more diversified
  diversificationIndex: number; // Inverse HHI, 0-1
  risks: ConcentrationRisk[];
  recommendations: DiversificationRecommendation[];
}

export interface CategoryDiversification {
  category: string;
  supplierCount: number;
  hhi: number;
  topSupplier: {
    id: string;
    name: string;
    share: number; // %
  };
  status: 'HEALTHY' | 'MODERATE_RISK' | 'HIGH_RISK';
}

export interface ConcentrationRisk {
  category: string;
  supplierId: string;
  supplierName: string;
  volumeShare: number; // %
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
}

export interface DiversificationRecommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  action: string;
  targetShare: number; // % target for top supplier
  potentialSuppliers?: string[];
}

export interface NegotiationBrief {
  supplierId: string;
  supplierName: string;
  contractId?: string;
  context: 'NEW' | 'RENEWAL' | 'AMENDMENT' | 'DISPUTE';
  generatedAt: Date;
  analysis: {
    currentSpend: number;
    historicalPerformance: number;
    marketPosition: 'STRONG' | 'NEUTRAL' | 'WEAK';
    alternatives: number; // count of alternatives
    dependencyLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  benchmarking: {
    ourPrice: number;
    marketAverage: number;
    marketLow: number;
    potentialSavings: number;
  };
  negotiationPoints: NegotiationPoint[];
  recommendedStrategy: 'AGGRESSIVE' | 'COLLABORATIVE' | 'CONSERVATIVE';
  targetOutcomes: string[];
}

export interface NegotiationPoint {
  topic: string;
  priority: 'MUST_HAVE' | 'NICE_TO_HAVE' | 'TRADEABLE';
  ourTarget: string;
  walkawayPoint?: string;
  justification: string;
}

export interface PartnerOpportunity {
  id: string;
  type: 'NEW_SUPPLIER' | 'BACKUP_SOURCE' | 'STRATEGIC_PARTNER' | 'CO_BRANDING';
  category: string;
  companyName: string;
  country: string;
  source: string; // How we found them
  status: 'IDENTIFIED' | 'RESEARCHING' | 'CONTACTED' | 'EVALUATING' | 'REJECTED' | 'ONBOARDING';
  dueDiligence?: DueDiligenceResult;
  potentialValue: number; // € annual
  strategicFit: number; // 0-100
  notes: string;
  createdAt: Date;
}

export interface DueDiligenceResult {
  performedAt: Date;
  checks: {
    companyStatus: 'PASS' | 'FAIL' | 'WARNING';
    creditScore: number;
    sanctionsList: boolean;
    ethicsScore?: number; // From IA-ESG
    financialHealth: 'GOOD' | 'FAIR' | 'POOR';
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: 'PROCEED' | 'PROCEED_WITH_CAUTION' | 'REJECT';
  notes: string;
}

export interface ContractAlert {
  id: string;
  type: 'EXPIRING' | 'SLA_BREACH' | 'PERFORMANCE_DROP' | 'CONCENTRATION_RISK' | 'PAYMENT_DUE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  contractId?: string;
  supplierId: string;
  message: string;
  dueDate?: Date;
  actionRequired: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: Date;
}

// Mock interfaces for external services
interface ContractRepository {
  findAll(): Promise<Contract[]>;
  findById(id: string): Promise<Contract | null>;
  findBySupplierId(supplierId: string): Promise<Contract[]>;
  findExpiring(days: number): Promise<Contract[]>;
  save(contract: Contract): Promise<Contract>;
}

interface SLAMonitoringService {
  getIncidents(supplierId: string, period: string): Promise<SLAIncident[]>;
  checkSLA(supplierId: string, slaId: string, actualValue: number): Promise<SLAIncident | null>;
}

interface ERPNextService {
  getSupplierOrders(supplierId: string, period: string): Promise<any[]>;
  getSupplierInvoices(supplierId: string, period: string): Promise<any[]>;
  getDeliveryRecords(supplierId: string, period: string): Promise<any[]>;
}

interface DueDiligenceService {
  checkInfogreffe(siret: string): Promise<any>;
  checkCreditScore(companyId: string): Promise<number>;
  checkSanctions(companyName: string, country: string): Promise<boolean>;
}

// ==================== MAIN SERVICE ====================

@Injectable()
export class PartnersAgentService {
  private readonly logger = new Logger(PartnersAgentService.name);

  // External services (to be injected)
  private contractRepository: ContractRepository;
  private slaMonitoring: SLAMonitoringService;
  private erpNext: ERPNextService;
  private dueDiligence: DueDiligenceService;

  // Configuration
  private readonly config = {
    contracts: {
      alertDays: [90, 60, 30, 14, 7], // Days before expiry to alert
      autoRenewalDefault: false,
      noticePeriodDefault: 90, // days
    },
    sla: {
      warningAfterIncidents: 1,
      reviewAfterIncidents: 2,
      probationAfterIncidents: 3,
      penaltyAutoApply: true,
    },
    performance: {
      weights: {
        quality: 0.30,
        delivery: 0.25,
        price: 0.20,
        communication: 0.15,
        innovation: 0.10,
      },
      alertThreshold: 60, // Score below this triggers alert
      excellenceThreshold: 85, // Score above this is excellent
    },
    diversification: {
      healthyHHI: 0.15, // HHI below this is healthy
      moderateHHI: 0.25, // HHI above this is moderate risk
      criticalShare: 0.40, // Single supplier above this is critical
    },
    validation: {
      contractValueThreshold: 10000, // € - needs IA-CFO approval
      newSupplierApproval: true,
    },
  };

  constructor() {
    this.logger.log('IA-Partners (Partners & Suppliers Agent) initialized');
  }

  // ==================== 1. CONTRACT LIFECYCLE MANAGER ====================

  /**
   * Check for expiring contracts and trigger renewal pipeline
   * Runs daily at 8am
   */
  @Cron('0 8 * * *')
  async checkExpiringContracts(): Promise<ContractAlert[]> {
    this.logger.log('📋 Checking for expiring contracts');
    const alerts: ContractAlert[] = [];

    for (const days of this.config.contracts.alertDays) {
      const expiringContracts = await this.contractRepository.findExpiring(days);

      for (const contract of expiringContracts) {
        const alert = await this.createExpiryAlert(contract, days);
        if (alert) {
          alerts.push(alert);
        }
      }
    }

    this.logger.log(`✅ Found ${alerts.length} expiring contract alerts`);
    return alerts;
  }

  /**
   * Create expiry alert for a contract
   */
  private async createExpiryAlert(
    contract: Contract,
    daysToExpiry: number,
  ): Promise<ContractAlert | null> {
    // Get supplier performance to determine action
    const performance = await this.calculateSupplierPerformance(
      contract.supplierId,
      this.getCurrentPeriod(),
    );

    let severity: ContractAlert['severity'];
    let actionRequired: string;

    if (daysToExpiry <= 14) {
      severity = 'CRITICAL';
      actionRequired = 'Immediate decision required: renew or find alternative';
    } else if (daysToExpiry <= 30) {
      severity = 'WARNING';
      actionRequired = performance.totalScore >= 70
        ? 'Prepare renewal negotiation'
        : 'Review supplier performance, consider alternatives';
    } else {
      severity = 'INFO';
      actionRequired = 'Review contract terms for upcoming renewal';
    }

    return {
      id: `alert-${contract.id}-${daysToExpiry}`,
      type: 'EXPIRING',
      severity,
      contractId: contract.id,
      supplierId: contract.supplierId,
      message: `Contract with ${contract.supplierName} expires in ${daysToExpiry} days`,
      dueDate: contract.endDate,
      actionRequired,
      status: 'PENDING',
      createdAt: new Date(),
    };
  }

  /**
   * Generate contract renewal brief
   */
  async generateRenewalBrief(contractId: string): Promise<NegotiationBrief> {
    const contract = await this.contractRepository.findById(contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Get historical data
    const performance = await this.calculateSupplierPerformance(
      contract.supplierId,
      this.getCurrentPeriod(),
    );

    // Get market benchmarking
    const benchmarking = await this.getBenchmarking(contract);

    // Analyze negotiation position
    const alternatives = await this.countAlternatives(contract.supplierId);
    const dependencyLevel = await this.calculateDependencyLevel(contract.supplierId);

    const marketPosition: NegotiationBrief['analysis']['marketPosition'] =
      alternatives > 3 ? 'STRONG' : alternatives > 1 ? 'NEUTRAL' : 'WEAK';

    // Determine strategy based on position and performance
    let recommendedStrategy: NegotiationBrief['recommendedStrategy'];
    if (marketPosition === 'STRONG' && performance.totalScore < 70) {
      recommendedStrategy = 'AGGRESSIVE';
    } else if (performance.totalScore >= 85) {
      recommendedStrategy = 'COLLABORATIVE';
    } else {
      recommendedStrategy = 'CONSERVATIVE';
    }

    // Generate negotiation points
    const negotiationPoints = this.generateNegotiationPoints(
      contract,
      performance,
      benchmarking,
    );

    return {
      supplierId: contract.supplierId,
      supplierName: contract.supplierName,
      contractId: contract.id,
      context: 'RENEWAL',
      generatedAt: new Date(),
      analysis: {
        currentSpend: contract.value,
        historicalPerformance: performance.totalScore,
        marketPosition,
        alternatives,
        dependencyLevel,
      },
      benchmarking,
      negotiationPoints,
      recommendedStrategy,
      targetOutcomes: this.generateTargetOutcomes(recommendedStrategy, benchmarking),
    };
  }

  private generateNegotiationPoints(
    contract: Contract,
    performance: SupplierPerformance,
    benchmarking: NegotiationBrief['benchmarking'],
  ): NegotiationPoint[] {
    const points: NegotiationPoint[] = [];

    // Price negotiation
    if (benchmarking.potentialSavings > 0) {
      points.push({
        topic: 'Prix unitaires',
        priority: 'MUST_HAVE',
        ourTarget: `-${((benchmarking.potentialSavings / benchmarking.ourPrice) * 100).toFixed(1)}%`,
        walkawayPoint: `-${((benchmarking.potentialSavings / benchmarking.ourPrice) * 50).toFixed(1)}%`,
        justification: `Prix marché moyen ${benchmarking.marketAverage.toFixed(2)}€ vs notre prix ${benchmarking.ourPrice.toFixed(2)}€`,
      });
    }

    // Delivery terms
    if (performance.metrics.onTimeDeliveryRate < 95) {
      points.push({
        topic: 'Délais de livraison',
        priority: 'MUST_HAVE',
        ourTarget: 'SLA 95% livraison dans les délais',
        walkawayPoint: 'SLA 90% avec pénalités',
        justification: `Taux actuel ${performance.metrics.onTimeDeliveryRate.toFixed(1)}% insuffisant`,
      });
    }

    // Payment terms
    if (contract.terms.paymentTerms === 'Net 30') {
      points.push({
        topic: 'Conditions de paiement',
        priority: 'NICE_TO_HAVE',
        ourTarget: 'Net 45 ou 2% escompte 10j',
        justification: 'Amélioration BFR',
      });
    }

    // Volume commitment
    points.push({
      topic: 'Engagement volume',
      priority: 'TRADEABLE',
      ourTarget: 'Remise volume progressif 5%/10%/15%',
      justification: 'Contrepartie de notre fidélité',
    });

    return points;
  }

  private generateTargetOutcomes(
    strategy: NegotiationBrief['recommendedStrategy'],
    benchmarking: NegotiationBrief['benchmarking'],
  ): string[] {
    const outcomes: string[] = [];

    switch (strategy) {
      case 'AGGRESSIVE':
        outcomes.push(`Réduction prix ${((benchmarking.potentialSavings / benchmarking.ourPrice) * 100).toFixed(0)}%`);
        outcomes.push('SLA renforcés avec pénalités automatiques');
        outcomes.push('Conditions paiement Net 60');
        outcomes.push('Backup supplier identifié en parallèle');
        break;
      case 'COLLABORATIVE':
        outcomes.push('Stabilité prix avec clause indexation');
        outcomes.push('Programme amélioration continue conjoint');
        outcomes.push('Accès prioritaire nouveaux produits');
        outcomes.push('Extension durée contrat 2→3 ans');
        break;
      case 'CONSERVATIVE':
        outcomes.push('Maintien conditions actuelles');
        outcomes.push('Ajout KPIs qualité mesurables');
        outcomes.push('Clause de sortie simplifiée');
        break;
    }

    return outcomes;
  }

  // ==================== 2. SLA MONITOR & ENFORCER ====================

  /**
   * Monitor SLA compliance in real-time
   * Called on each delivery/order event from ERPNext
   */
  async checkSLACompliance(
    supplierId: string,
    orderData: {
      orderId: string;
      expectedDeliveryDate: Date;
      actualDeliveryDate?: Date;
      qualityScore?: number;
      responseTime?: number;
    },
  ): Promise<SLAIncident | null> {
    // Get supplier's SLA definitions from contract
    const contracts = await this.contractRepository.findBySupplierId(supplierId);
    const activeContract = contracts.find((c) => c.status === 'ACTIVE');

    if (!activeContract || !activeContract.slaDefinitions.length) {
      return null;
    }

    // Check delivery SLA
    if (orderData.actualDeliveryDate && orderData.expectedDeliveryDate) {
      const delayDays = Math.ceil(
        (orderData.actualDeliveryDate.getTime() - orderData.expectedDeliveryDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const deliverySLA = activeContract.slaDefinitions.find(
        (sla) => sla.category === 'DELIVERY',
      );

      if (deliverySLA && delayDays > deliverySLA.target) {
        return this.createSLAIncident(
          supplierId,
          activeContract.supplierName,
          deliverySLA,
          orderData.orderId,
          delayDays,
        );
      }
    }

    // Check quality SLA
    if (orderData.qualityScore !== undefined) {
      const qualitySLA = activeContract.slaDefinitions.find(
        (sla) => sla.category === 'QUALITY',
      );

      if (qualitySLA && orderData.qualityScore < qualitySLA.target) {
        return this.createSLAIncident(
          supplierId,
          activeContract.supplierName,
          qualitySLA,
          orderData.orderId,
          orderData.qualityScore,
        );
      }
    }

    return null;
  }

  private async createSLAIncident(
    supplierId: string,
    supplierName: string,
    sla: SLADefinition,
    orderId: string,
    actualValue: number,
  ): Promise<SLAIncident> {
    const deviation = Math.abs((actualValue - sla.target) / sla.target) * 100;

    // Determine severity based on deviation and history
    const recentIncidents = await this.slaMonitoring.getIncidents(
      supplierId,
      this.getCurrentPeriod(),
    );
    const incidentCount = recentIncidents.length;

    let severity: SLAIncident['severity'];
    if (incidentCount >= this.config.sla.probationAfterIncidents || deviation > 50) {
      severity = 'CRITICAL';
    } else if (incidentCount >= this.config.sla.reviewAfterIncidents || deviation > 25) {
      severity = 'MAJOR';
    } else {
      severity = 'MINOR';
    }

    // Calculate penalty if applicable
    let penaltyAmount: number | undefined;
    if (sla.penaltyEnabled && sla.penaltyRate) {
      // Simplified: would calculate based on order value
      penaltyAmount = 100 * sla.penaltyRate; // Placeholder
    }

    const incident: SLAIncident = {
      id: `sla-${supplierId}-${Date.now()}`,
      supplierId,
      supplierName,
      slaId: sla.id,
      slaName: sla.name,
      orderId,
      detectedAt: new Date(),
      severity,
      actualValue,
      targetValue: sla.target,
      deviation,
      status: 'OPEN',
      penaltyAmount,
    };

    // Trigger escalation workflow
    await this.handleSLABreach(incident, incidentCount + 1);

    return incident;
  }

  /**
   * Handle SLA breach with escalation
   */
  private async handleSLABreach(
    incident: SLAIncident,
    totalIncidents: number,
  ): Promise<void> {
    this.logger.warn(
      `🚨 SLA breach: ${incident.supplierName} - ${incident.slaName} (${incident.severity})`,
    );

    if (incident.severity === 'MINOR' || totalIncidents === 1) {
      // Send warning
      await this.sendWarning(incident);
      incident.status = 'WARNING_SENT';
    } else if (incident.severity === 'MAJOR' || totalIncidents <= 3) {
      // Apply penalty and notify
      if (incident.penaltyAmount && this.config.sla.penaltyAutoApply) {
        await this.applyPenalty(incident);
        incident.status = 'PENALTY_APPLIED';
      }
      // Notify IA-CFO for invoice deduction
      await this.notifyIACFO(incident);
    } else {
      // Critical - escalate to legal and activate backup
      incident.status = 'ESCALATED';
      await this.escalateToLegal(incident);
      await this.notifyIAStock(incident); // Activate backup supplier
    }
  }

  private async sendWarning(incident: SLAIncident): Promise<void> {
    this.logger.log(
      `📧 Sending warning to ${incident.supplierName} for SLA breach`,
    );
    // TODO: Send email via notification service
  }

  private async applyPenalty(incident: SLAIncident): Promise<void> {
    this.logger.log(
      `💰 Applying penalty €${incident.penaltyAmount} to ${incident.supplierName}`,
    );
    // TODO: Create credit note in ERPNext
  }

  private async notifyIACFO(incident: SLAIncident): Promise<void> {
    this.logger.log(`📤 Notifying IA-CFO: deduct €${incident.penaltyAmount} from next invoice`);
    // TODO: Emit event for IA-CFO
  }

  private async escalateToLegal(incident: SLAIncident): Promise<void> {
    this.logger.log(`⚠️ Escalating to IA-Legal: formal notice required for ${incident.supplierName}`);
    // TODO: Emit event for IA-Legal
  }

  private async notifyIAStock(incident: SLAIncident): Promise<void> {
    this.logger.log(`📦 Notifying IA-Stock: activate backup supplier for ${incident.supplierName}`);
    // TODO: Emit event for IA-Stock
  }

  // ==================== 3. SUPPLIER PERFORMANCE DASHBOARD ====================

  /**
   * Calculate supplier performance score
   * KPI: Weighted multi-criteria score
   */
  async calculateSupplierPerformance(
    supplierId: string,
    period: string,
  ): Promise<SupplierPerformance> {
    // Get data from ERPNext
    const orders = await this.erpNext.getSupplierOrders(supplierId, period);
    const deliveries = await this.erpNext.getDeliveryRecords(supplierId, period);
    const incidents = await this.slaMonitoring.getIncidents(supplierId, period);

    // Calculate individual metrics
    const metrics = {
      returnRate: this.calculateReturnRate(orders),
      onTimeDeliveryRate: this.calculateOnTimeRate(deliveries),
      averageLeadTime: this.calculateAverageLeadTime(deliveries),
      responseTime: await this.calculateResponseTime(supplierId, period),
      defectRate: this.calculateDefectRate(orders),
    };

    // Calculate sub-scores (0-100)
    const scores = {
      quality: Math.max(0, 100 - metrics.returnRate * 10 - metrics.defectRate * 5),
      delivery: Math.min(100, metrics.onTimeDeliveryRate + (14 - metrics.averageLeadTime) * 2),
      price: await this.calculatePriceScore(supplierId, period),
      communication: Math.max(0, 100 - (metrics.responseTime - 24) * 2),
      innovation: await this.calculateInnovationScore(supplierId),
    };

    // Weighted total
    const weights = this.config.performance.weights;
    const totalScore =
      scores.quality * weights.quality +
      scores.delivery * weights.delivery +
      scores.price * weights.price +
      scores.communication * weights.communication +
      scores.innovation * weights.innovation;

    // Calculate trend (vs previous period)
    const previousPeriod = this.getPreviousPeriod(period);
    const trend = await this.calculateTrend(supplierId, totalScore, previousPeriod);

    // SLA compliance
    const slaCompliance = incidents.length === 0
      ? 100
      : Math.max(0, 100 - incidents.length * 10);

    // Get ranking in category
    const ranking = await this.getRanking(supplierId, totalScore);

    // Get supplier name
    const contracts = await this.contractRepository.findBySupplierId(supplierId);
    const supplierName = contracts[0]?.supplierName || supplierId;

    return {
      supplierId,
      supplierName,
      period,
      scores,
      totalScore,
      trend,
      slaCompliance,
      incidentCount: incidents.length,
      orderVolume: orders.reduce((sum, o) => sum + (o.total || 0), 0),
      metrics,
      ranking,
    };
  }

  /**
   * Calculate all supplier performances for dashboard
   */
  @Cron('0 7 1 * *') // 1st of month at 7am
  async generateMonthlyPerformanceReport(): Promise<SupplierPerformance[]> {
    const period = this.getPreviousPeriod(this.getCurrentPeriod());
    this.logger.log(`📊 Generating supplier performance report for ${period}`);

    const contracts = await this.contractRepository.findAll();
    const activeSuppliers = [
      ...new Set(
        contracts
          .filter((c) => c.status === 'ACTIVE')
          .map((c) => c.supplierId),
      ),
    ];

    const performances: SupplierPerformance[] = [];

    for (const supplierId of activeSuppliers) {
      const performance = await this.calculateSupplierPerformance(supplierId, period);
      performances.push(performance);

      // Alert if score below threshold
      if (performance.totalScore < this.config.performance.alertThreshold) {
        await this.createPerformanceAlert(performance);
      }
    }

    // Sort by score descending
    performances.sort((a, b) => b.totalScore - a.totalScore);

    this.logger.log(
      `✅ Generated performance report for ${performances.length} suppliers`,
    );

    return performances;
  }

  private calculateReturnRate(orders: any[]): number {
    if (!orders.length) return 0;
    const returns = orders.filter((o) => o.returned).length;
    return (returns / orders.length) * 100;
  }

  private calculateOnTimeRate(deliveries: any[]): number {
    if (!deliveries.length) return 100;
    const onTime = deliveries.filter(
      (d) => new Date(d.actualDate) <= new Date(d.expectedDate),
    ).length;
    return (onTime / deliveries.length) * 100;
  }

  private calculateAverageLeadTime(deliveries: any[]): number {
    if (!deliveries.length) return 14;
    const totalDays = deliveries.reduce((sum, d) => {
      const days = Math.ceil(
        (new Date(d.actualDate).getTime() - new Date(d.orderDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return sum + days;
    }, 0);
    return totalDays / deliveries.length;
  }

  private async calculateResponseTime(
    supplierId: string,
    period: string,
  ): Promise<number> {
    // Mock - would calculate from communication logs
    return 18; // hours
  }

  private calculateDefectRate(orders: any[]): number {
    if (!orders.length) return 0;
    const defective = orders.filter((o) => o.hasDefects).length;
    return (defective / orders.length) * 100;
  }

  private async calculatePriceScore(
    supplierId: string,
    period: string,
  ): Promise<number> {
    // Mock - would compare with market benchmarking
    return 75;
  }

  private async calculateInnovationScore(supplierId: string): Promise<number> {
    // Mock - based on new products, improvements suggested
    return 60;
  }

  private async calculateTrend(
    supplierId: string,
    currentScore: number,
    previousPeriod: string,
  ): Promise<SupplierPerformance['trend']> {
    // Mock - would compare with previous period
    const previousScore = currentScore - 2; // Placeholder
    if (currentScore > previousScore + 3) return 'UP';
    if (currentScore < previousScore - 3) return 'DOWN';
    return 'STABLE';
  }

  private async getRanking(
    supplierId: string,
    score: number,
  ): Promise<SupplierPerformance['ranking']> {
    // Mock - would calculate actual ranking
    return {
      category: 'Brake Parts',
      position: 3,
      totalInCategory: 8,
    };
  }

  private async createPerformanceAlert(
    performance: SupplierPerformance,
  ): Promise<void> {
    this.logger.warn(
      `⚠️ Low performance alert: ${performance.supplierName} score ${performance.totalScore.toFixed(0)}/100`,
    );
    // TODO: Create alert and notify relevant parties
  }

  // ==================== 4. DIVERSIFICATION ANALYSIS ====================

  /**
   * Analyze supplier portfolio diversification
   * KPI: supplier-diversification-index >0.6
   */
  @Cron('0 9 1 * *') // 1st of month at 9am
  async analyzeDiversification(): Promise<DiversificationAnalysis> {
    const period = this.getCurrentPeriod();
    this.logger.log(`🔍 Analyzing supplier diversification for ${period}`);

    // Get all supplier volumes by category
    const supplierVolumes = await this.getSupplierVolumesByCategory(period);

    const categories: CategoryDiversification[] = [];
    const risks: ConcentrationRisk[] = [];
    let totalHHI = 0;

    for (const [category, suppliers] of Object.entries(supplierVolumes)) {
      const totalVolume = Object.values(suppliers).reduce((sum, v) => sum + v, 0);

      // Calculate HHI (Herfindahl-Hirschman Index)
      let hhi = 0;
      let topSupplier = { id: '', name: '', share: 0 };

      for (const [supplierId, volume] of Object.entries(suppliers)) {
        const share = volume / totalVolume;
        hhi += share * share;

        if (share > topSupplier.share) {
          topSupplier = {
            id: supplierId,
            name: await this.getSupplierName(supplierId),
            share: share * 100,
          };
        }

        // Check for concentration risks
        if (share > this.config.diversification.criticalShare) {
          risks.push({
            category,
            supplierId,
            supplierName: await this.getSupplierName(supplierId),
            volumeShare: share * 100,
            riskLevel: share > 0.6 ? 'CRITICAL' : 'HIGH',
            reason: `Single source represents ${(share * 100).toFixed(0)}% of category volume`,
          });
        }
      }

      // Determine status
      let status: CategoryDiversification['status'];
      if (hhi < this.config.diversification.healthyHHI) {
        status = 'HEALTHY';
      } else if (hhi < this.config.diversification.moderateHHI) {
        status = 'MODERATE_RISK';
      } else {
        status = 'HIGH_RISK';
      }

      categories.push({
        category,
        supplierCount: Object.keys(suppliers).length,
        hhi,
        topSupplier,
        status,
      });

      totalHHI += hhi;
    }

    const overallHHI = totalHHI / categories.length;
    const diversificationIndex = 1 - overallHHI; // Inverse for "higher is better"

    // Generate recommendations
    const recommendations = this.generateDiversificationRecommendations(
      categories,
      risks,
    );

    const analysis: DiversificationAnalysis = {
      period,
      categories,
      overallHHI,
      diversificationIndex,
      risks,
      recommendations,
    };

    // Alert if diversification is low
    if (diversificationIndex < 0.6) {
      await this.alertLowDiversification(analysis);
    }

    this.logger.log(
      `✅ Diversification index: ${diversificationIndex.toFixed(2)}, ${risks.length} concentration risks`,
    );

    return analysis;
  }

  private async getSupplierVolumesByCategory(
    period: string,
  ): Promise<Record<string, Record<string, number>>> {
    // Mock - would aggregate from ERPNext
    return {
      'Brake Parts': {
        'supplier-1': 150000,
        'supplier-2': 80000,
        'supplier-3': 50000,
      },
      'Filters': {
        'supplier-4': 200000,
        'supplier-5': 30000,
      },
      'Electrical': {
        'supplier-6': 120000,
        'supplier-7': 100000,
        'supplier-8': 80000,
      },
    };
  }

  private async getSupplierName(supplierId: string): Promise<string> {
    const contracts = await this.contractRepository.findBySupplierId(supplierId);
    return contracts[0]?.supplierName || supplierId;
  }

  private generateDiversificationRecommendations(
    categories: CategoryDiversification[],
    risks: ConcentrationRisk[],
  ): DiversificationRecommendation[] {
    const recommendations: DiversificationRecommendation[] = [];

    for (const risk of risks.filter((r) => r.riskLevel === 'CRITICAL')) {
      recommendations.push({
        priority: 'HIGH',
        category: risk.category,
        action: `Find backup supplier for ${risk.category} to reduce dependency on ${risk.supplierName}`,
        targetShare: 30, // Target: reduce to 30% max
      });
    }

    for (const category of categories.filter((c) => c.status === 'HIGH_RISK')) {
      if (!recommendations.find((r) => r.category === category.category)) {
        recommendations.push({
          priority: 'MEDIUM',
          category: category.category,
          action: `Diversify ${category.category} suppliers (current HHI: ${(category.hhi * 100).toFixed(0)}%)`,
          targetShare: 25,
        });
      }
    }

    return recommendations;
  }

  private async alertLowDiversification(
    analysis: DiversificationAnalysis,
  ): Promise<void> {
    this.logger.warn(
      `⚠️ Low diversification alert: index ${analysis.diversificationIndex.toFixed(2)} < 0.6`,
    );
    // TODO: Notify IA-CFO and IA-CEO
  }

  // ==================== 5. PARTNERSHIP OPPORTUNITY FINDER ====================

  /**
   * Find new supplier opportunities
   */
  async findPartnerOpportunities(
    category: string,
    requirements?: {
      country?: string;
      minCreditScore?: number;
      certifications?: string[];
    },
  ): Promise<PartnerOpportunity[]> {
    this.logger.log(`🔍 Finding partner opportunities for ${category}`);

    // This would typically search external databases
    // Mock implementation
    const opportunities: PartnerOpportunity[] = [
      {
        id: `opp-${Date.now()}`,
        type: 'NEW_SUPPLIER',
        category,
        companyName: 'Auto Parts Europe GmbH',
        country: 'DE',
        source: 'Trade directory search',
        status: 'IDENTIFIED',
        potentialValue: 150000,
        strategicFit: 75,
        notes: 'ISO 9001 certified, good references',
        createdAt: new Date(),
      },
    ];

    return opportunities;
  }

  /**
   * Perform due diligence on potential partner
   */
  async performDueDiligence(opportunity: PartnerOpportunity): Promise<DueDiligenceResult> {
    this.logger.log(`🔍 Performing due diligence on ${opportunity.companyName}`);

    // Check company status
    const companyInfo = await this.dueDiligence.checkInfogreffe(
      opportunity.id, // Would be SIRET for French companies
    );

    // Check credit score
    const creditScore = await this.dueDiligence.checkCreditScore(opportunity.id);

    // Check sanctions
    const onSanctionsList = await this.dueDiligence.checkSanctions(
      opportunity.companyName,
      opportunity.country,
    );

    // Determine risk level
    let riskLevel: DueDiligenceResult['riskLevel'];
    let recommendation: DueDiligenceResult['recommendation'];

    if (onSanctionsList) {
      riskLevel = 'HIGH';
      recommendation = 'REJECT';
    } else if (creditScore < 50) {
      riskLevel = 'HIGH';
      recommendation = 'PROCEED_WITH_CAUTION';
    } else if (creditScore < 70) {
      riskLevel = 'MEDIUM';
      recommendation = 'PROCEED_WITH_CAUTION';
    } else {
      riskLevel = 'LOW';
      recommendation = 'PROCEED';
    }

    const result: DueDiligenceResult = {
      performedAt: new Date(),
      checks: {
        companyStatus: companyInfo?.active ? 'PASS' : 'FAIL',
        creditScore,
        sanctionsList: onSanctionsList,
        financialHealth: creditScore >= 70 ? 'GOOD' : creditScore >= 50 ? 'FAIR' : 'POOR',
      },
      riskLevel,
      recommendation,
      notes: `Credit score: ${creditScore}/100. ${onSanctionsList ? 'WARNING: On sanctions list!' : 'No sanctions found.'}`,
    };

    // Request ethics score from IA-ESG
    // TODO: await this.notifyIAESG(opportunity);

    return result;
  }

  // ==================== HELPER METHODS ====================

  private getCurrentPeriod(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private getPreviousPeriod(period: string): string {
    const date = new Date(period + '-01');
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 7);
  }

  private async getBenchmarking(
    contract: Contract,
  ): Promise<NegotiationBrief['benchmarking']> {
    // Mock - would query market data
    return {
      ourPrice: 100,
      marketAverage: 95,
      marketLow: 85,
      potentialSavings: 5,
    };
  }

  private async countAlternatives(supplierId: string): Promise<number> {
    // Mock - would query supplier database
    return 3;
  }

  private async calculateDependencyLevel(
    supplierId: string,
  ): Promise<'LOW' | 'MEDIUM' | 'HIGH'> {
    // Mock - based on volume share and alternatives
    return 'MEDIUM';
  }

  // ==================== FORMATTERS ====================

  /**
   * Format supplier performance for display
   */
  formatPerformance(performance: SupplierPerformance): string {
    const trendEmoji = {
      UP: '📈',
      STABLE: '➡️',
      DOWN: '📉',
    };

    return [
      `📊 SUPPLIER PERFORMANCE - ${performance.supplierName}`,
      `Period: ${performance.period}`,
      '',
      `Overall Score: ${performance.totalScore.toFixed(0)}/100 ${trendEmoji[performance.trend]}`,
      '',
      'Breakdown:',
      `├─ Quality (30%): ${performance.scores.quality.toFixed(0)}/100`,
      `├─ Delivery (25%): ${performance.scores.delivery.toFixed(0)}/100`,
      `├─ Price (20%): ${performance.scores.price.toFixed(0)}/100`,
      `├─ Communication (15%): ${performance.scores.communication.toFixed(0)}/100`,
      `└─ Innovation (10%): ${performance.scores.innovation.toFixed(0)}/100`,
      '',
      'Metrics:',
      `├─ On-time delivery: ${performance.metrics.onTimeDeliveryRate.toFixed(1)}%`,
      `├─ Return rate: ${performance.metrics.returnRate.toFixed(2)}%`,
      `├─ Avg lead time: ${performance.metrics.averageLeadTime.toFixed(0)} days`,
      `└─ Response time: ${performance.metrics.responseTime.toFixed(0)}h`,
      '',
      `SLA Compliance: ${performance.slaCompliance.toFixed(0)}% (${performance.incidentCount} incidents)`,
      `Order Volume: €${performance.orderVolume.toLocaleString('fr-FR')}`,
      `Ranking: #${performance.ranking.position}/${performance.ranking.totalInCategory} in ${performance.ranking.category}`,
    ].join('\n');
  }

  /**
   * Format diversification analysis for display
   */
  formatDiversification(analysis: DiversificationAnalysis): string {
    const statusEmoji = {
      HEALTHY: '✅',
      MODERATE_RISK: '⚠️',
      HIGH_RISK: '🔴',
    };

    const lines = [
      `🔍 DIVERSIFICATION ANALYSIS - ${analysis.period}`,
      '',
      `Diversification Index: ${(analysis.diversificationIndex * 100).toFixed(0)}% (target: >60%)`,
      `Overall HHI: ${(analysis.overallHHI * 100).toFixed(0)}%`,
      '',
      'Categories:',
    ];

    for (const cat of analysis.categories) {
      lines.push(
        `${statusEmoji[cat.status]} ${cat.category}: ${cat.supplierCount} suppliers, top supplier ${cat.topSupplier.share.toFixed(0)}%`,
      );
    }

    if (analysis.risks.length > 0) {
      lines.push('', '⚠️ Concentration Risks:');
      for (const risk of analysis.risks.slice(0, 5)) {
        lines.push(`• ${risk.category}: ${risk.supplierName} (${risk.volumeShare.toFixed(0)}%)`);
      }
    }

    if (analysis.recommendations.length > 0) {
      lines.push('', '🎯 Recommendations:');
      for (const rec of analysis.recommendations.slice(0, 3)) {
        const emoji = rec.priority === 'HIGH' ? '🔴' : '🟡';
        lines.push(`${emoji} ${rec.action}`);
      }
    }

    return lines.join('\n');
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    return {
      status: 'healthy',
      details: {
        activeContracts: 45,
        expiringNext30Days: 3,
        slaComplianceRate: 96.5,
        diversificationIndex: 0.68,
        pendingAlerts: 2,
      },
    };
  }
}
