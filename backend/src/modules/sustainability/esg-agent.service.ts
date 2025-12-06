import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * IA-ESG - Agent ESG & Durabilité (v2.24.0)
 *
 * Board Member - Sustainability & Ethics
 * Budget: €32K (Dev €24K + APIs carbone €8K)
 * ROI: +€75K/an (conformité CSRD anticipée + réduction énergie -15% + image marque)
 *
 * 5 Responsabilités:
 * 1. Carbon Footprint Calculator - Scope 1/2/3 GHG Protocol
 * 2. CSR Compliance Monitor - CSRD, Taxonomie UE, Devoir de vigilance
 * 3. Sustainability KPI Dashboard - Indicateurs E/S/G temps réel
 * 4. Supplier Ethics Scorer - Évaluation environnement/social/gouvernance
 * 5. Green Product Labeling - Affichage carbone produits
 *
 * KPIs:
 * - carbon-intensity: <50g CO2/€
 * - csr-compliance-score: 100%
 * - esg-score-global: >75/100
 * - supplier-ethics-avg: >70/100
 * - green-products-share: >30%
 */

// ==================== INTERFACES ====================

export interface CarbonReport {
  period: string; // "2025-11"
  scope1: Scope1Emissions;
  scope2: Scope2Emissions;
  scope3Upstream: Scope3Emissions;
  scope3Downstream: Scope3Emissions;
  totalEmissions: number; // tCO2e
  revenue: number; // €
  intensity: number; // g CO2/€
  comparison: {
    vsLastMonth: number; // percentage change
    vsLastYear: number;
    vsTarget: string; // "ON_TRACK" | "BEHIND" | "AHEAD"
  };
  hotspots: EmissionHotspot[];
  recommendations: CarbonRecommendation[];
  generatedAt: Date;
}

export interface Scope1Emissions {
  fleet: number; // Company vehicles
  heating: number; // Gas heating
  refrigerants: number; // If applicable
  total: number;
  unit: 'tCO2e';
}

export interface Scope2Emissions {
  electricity_offices: number;
  electricity_warehouse: number;
  electricity_servers: number;
  total: number;
  unit: 'tCO2e';
}

export interface Scope3Emissions {
  purchased_goods?: number; // Upstream
  inbound_transport?: number; // Upstream
  outbound_delivery?: number; // Downstream
  packaging?: number; // Downstream
  end_of_life?: number; // Downstream
  total: number;
  unit: 'tCO2e';
}

export interface EmissionHotspot {
  category: string;
  emissions: number;
  percentage: number;
  trend: 'UP' | 'STABLE' | 'DOWN';
  reduciblePotential: number; // percentage that could be reduced
}

export interface CarbonRecommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  expectedReduction: number; // tCO2e/year
  cost: number; // € investment
  paybackPeriod: string;
  owner: string;
}

export interface CSRDComplianceReport {
  assessmentDate: Date;
  framework: string; // "CSRD/ESRS"
  applicableFrom: Date;
  overallReadiness: number; // 0-100
  categories: ESRSCategoryAssessment[];
  priorityActions: PriorityAction[];
}

export interface ESRSCategoryAssessment {
  category: string; // "E1_climate", "S1_workforce", etc.
  name: string;
  readiness: number; // 0-100
  gaps: string[];
  dataAvailable: number;
  dataRequired: number;
}

export interface PriorityAction {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  category: string;
  estimatedEffort: string;
  deadline?: Date;
}

export interface SupplierEthicsScore {
  supplierId: string;
  supplierName: string;
  assessmentDate: Date;
  scores: {
    environment: number; // 0-100
    social: number;
    governance: number;
    risk: number;
  };
  totalScore: number;
  status: 'APPROVED' | 'CONDITIONAL' | 'PROBATION' | 'REJECTED';
  certifications: string[];
  improvementAreas: string[];
  nextAuditDate: Date;
}

export interface DeliveryOption {
  id: string;
  carrier: string;
  mode: string; // "road", "rail", "air"
  vehicleType: string; // "diesel", "ev", "hybrid"
  distance: number; // km
  weight: number; // kg
}

export interface DeliveryCarbonComparison {
  options: DeliveryCarbonResult[];
  recommendedOption: string;
  savingsVsStandard: {
    kgCO2Avoided: number;
    percentage: number;
  };
  customerDisplay: {
    badge: string;
    message: string;
  };
}

export interface DeliveryCarbonResult {
  optionId: string;
  kgCO2: number;
  internalCarbonCost: number; // € at internal carbon price
  isGreenest: boolean;
}

export interface GreenProductLabel {
  productId: string;
  productName: string;
  carbonScore: 'A' | 'B' | 'C' | 'D' | 'E';
  totalCO2g: number;
  breakdown: {
    manufacturing: number;
    transport: number;
    packaging: number;
  };
  recyclability: number; // 0-100
  durability: 'HIGH' | 'MEDIUM' | 'LOW';
  badge: string | null; // "Éco-responsable" if A or B
}

export interface ESGDashboard {
  period: string;
  environmental: {
    carbonFootprint: number;
    carbonIntensity: number;
    renewableEnergyShare: number;
    recyclingRate: number;
    kmAvoided: number;
  };
  social: {
    employeeNPS: number;
    accidentRate: number;
    trainingHoursPerEmployee: number;
    genderPayGap: number;
  };
  governance: {
    supplierEthicsScore: number;
    suppliersAudited: number;
    corruptionIncidents: number;
  };
  overallScore: number;
  benchmark: {
    sector: string;
    averageScore: number;
    ourRank: string; // "Top 25%"
  };
}

// Mock interfaces for external services
interface CarbonCalculatorService {
  getGridFactor(country: string): Promise<number>;
  getEmissionFactor(category: string, subcategory: string): Promise<number>;
}

interface CSRComplianceService {
  getRequirements(category: string): Promise<any[]>;
  checkDataAvailability(category: string): Promise<{
    available: number;
    required: number;
    missing: string[];
  }>;
}

interface SupplierEthicsService {
  getQuestionnaire(supplierId: string): Promise<any>;
  getCertifications(supplierId: string): Promise<string[]>;
  getExternalData(supplierId: string): Promise<any>;
}

interface GreenLabelingService {
  calculateProductCarbon(productId: string): Promise<number>;
  getManufacturingData(productId: string): Promise<any>;
}

interface TransportDataService {
  getDeliveryStats(period: string): Promise<any[]>;
}

interface EnergyDataService {
  getConsumption(period: string): Promise<{
    offices: number;
    warehouse: number;
    servers: number;
  }>;
}

// ==================== MAIN SERVICE ====================

@Injectable()
export class ESGAgentService {
  private readonly logger = new Logger(ESGAgentService.name);

  // External services (to be injected)
  private carbonCalculator: CarbonCalculatorService;
  private complianceMonitor: CSRComplianceService;
  private supplierEthics: SupplierEthicsService;
  private greenLabeling: GreenLabelingService;
  private transportService: TransportDataService;
  private energyService: EnergyDataService;

  // Configuration
  private readonly config = {
    carbon: {
      targetIntensity: 50, // g CO2/€
      internalCarbonPrice: 50, // €/tCO2e
      gridFactorFR: 50, // g CO2/kWh (France nuclear mix)
    },
    supplier: {
      approvalThreshold: 70,
      conditionalThreshold: 60,
      probationThreshold: 40,
      weights: {
        environment: 0.30,
        social: 0.35,
        governance: 0.25,
        risk: 0.10,
      },
    },
    compliance: {
      csrdApplicableDate: new Date('2026-01-01'),
      readinessAlertThreshold: 80,
    },
    greenLabel: {
      thresholds: {
        A: 500, // g CO2
        B: 1500,
        C: 3000,
        D: 6000,
        // E: > 6000
      },
    },
  };

  // Transport emission factors (g CO2 per km)
  private readonly transportFactors: Record<string, number> = {
    'road_diesel': 180,
    'road_ev': 50,
    'road_hybrid': 120,
    'road_consolidated': 95,
    'rail': 30,
    'air': 500,
    'sea': 15,
  };

  constructor() {
    this.logger.log('IA-ESG (ESG & Sustainability Agent) initialized');
  }

  // ==================== 1. CARBON FOOTPRINT CALCULATOR ====================

  /**
   * Calculate monthly carbon footprint (Scope 1, 2, 3)
   * KPI: carbon-intensity <50g CO2/€
   */
  @Cron('0 6 1 * *') // 1st of month at 6am
  async calculateMonthlyCarbonFootprint(): Promise<CarbonReport> {
    const period = this.getPreviousMonth();
    this.logger.log(`🌍 Calculating carbon footprint for ${period}`);

    // Scope 1: Direct emissions
    const scope1 = await this.calculateScope1(period);

    // Scope 2: Energy indirect emissions
    const scope2 = await this.calculateScope2(period);

    // Scope 3 Upstream: Purchased goods, inbound transport
    const scope3Upstream = await this.calculateScope3Upstream(period);

    // Scope 3 Downstream: Deliveries, packaging, end-of-life
    const scope3Downstream = await this.calculateScope3Downstream(period);

    // Calculate totals
    const totalEmissions =
      scope1.total + scope2.total + scope3Upstream.total + scope3Downstream.total;

    // Get revenue for intensity calculation
    const revenue = await this.getRevenue(period);
    const intensity = (totalEmissions * 1000000) / revenue; // g CO2/€

    // Compare with previous periods
    const comparison = await this.compareWithHistory(totalEmissions, intensity);

    // Identify hotspots
    const hotspots = this.identifyHotspots(
      scope1,
      scope2,
      scope3Upstream,
      scope3Downstream,
    );

    // Generate reduction recommendations
    const recommendations = await this.generateRecommendations(hotspots);

    const report: CarbonReport = {
      period,
      scope1,
      scope2,
      scope3Upstream,
      scope3Downstream,
      totalEmissions,
      revenue,
      intensity,
      comparison,
      hotspots,
      recommendations,
      generatedAt: new Date(),
    };

    // Store report
    await this.storeReport(report);

    // Alert if intensity above target
    if (intensity > this.config.carbon.targetIntensity) {
      await this.alertHighIntensity(report);
    }

    this.logger.log(
      `✅ Carbon footprint: ${totalEmissions.toFixed(1)} tCO2e, intensity ${intensity.toFixed(1)}g/€`,
    );

    return report;
  }

  /**
   * Calculate Scope 1 emissions (direct)
   */
  private async calculateScope1(period: string): Promise<Scope1Emissions> {
    // For e-commerce, Scope 1 is typically minimal
    // Company vehicles (if any) and heating
    
    // Mock data - in reality would come from fleet management and utility bills
    const fleetKm = 5000; // km driven by company vehicles
    const gasConsumption = 500; // kWh gas for heating

    const fleet = (fleetKm * 200) / 1000000; // ~200g CO2/km, convert to tCO2e
    const heating = (gasConsumption * 0.185) / 1000; // ~185g CO2/kWh gas

    return {
      fleet,
      heating,
      refrigerants: 0,
      total: fleet + heating,
      unit: 'tCO2e',
    };
  }

  /**
   * Calculate Scope 2 emissions (energy indirect)
   */
  private async calculateScope2(period: string): Promise<Scope2Emissions> {
    const energyData = await this.energyService.getConsumption(period);
    const gridFactor = this.config.carbon.gridFactorFR; // g CO2/kWh

    const electricity_offices = (energyData.offices * gridFactor) / 1000000;
    const electricity_warehouse = (energyData.warehouse * gridFactor) / 1000000;
    const electricity_servers = (energyData.servers * gridFactor) / 1000000;

    return {
      electricity_offices,
      electricity_warehouse,
      electricity_servers,
      total: electricity_offices + electricity_warehouse + electricity_servers,
      unit: 'tCO2e',
    };
  }

  /**
   * Calculate Scope 3 Upstream emissions
   */
  private async calculateScope3Upstream(period: string): Promise<Scope3Emissions> {
    // Purchased goods: Based on purchasing data and supplier emission factors
    // This is the largest and most complex calculation
    
    // Mock: €500K purchases with average 0.3 kg CO2/€
    const purchaseValue = 500000;
    const purchaseFactor = 0.3; // kg CO2/€ (varies by category)
    const purchased_goods = (purchaseValue * purchaseFactor) / 1000;

    // Inbound transport: From suppliers to warehouse
    // Mock: 50 containers from China, 20 from Europe
    const inbound_transport = (50 * 2000) / 1000 + (20 * 500) / 1000; // kg to tonnes

    return {
      purchased_goods,
      inbound_transport,
      total: purchased_goods + inbound_transport,
      unit: 'tCO2e',
    };
  }

  /**
   * Calculate Scope 3 Downstream emissions
   */
  private async calculateScope3Downstream(period: string): Promise<Scope3Emissions> {
    // Get delivery data from IA-Transport
    const deliveries = await this.transportService.getDeliveryStats(period);

    // Calculate outbound delivery emissions
    const outbound_delivery = deliveries.reduce((sum, d) => {
      const factorKey = `${d.mode}_${d.vehicleType}`;
      const factor = this.transportFactors[factorKey] || this.transportFactors['road_diesel'];
      return sum + (d.distance * factor) / 1000000; // g to tonnes
    }, 0);

    // Packaging emissions: Based on packaging material usage
    // Mock: 5000 kg packaging used, ~1.5 kg CO2/kg packaging
    const packagingKg = 5000;
    const packaging = (packagingKg * 1.5) / 1000;

    // End-of-life: Estimate based on product category
    const end_of_life = outbound_delivery * 0.15; // Rough estimate

    return {
      outbound_delivery,
      packaging,
      end_of_life,
      total: outbound_delivery + packaging + end_of_life,
      unit: 'tCO2e',
    };
  }

  /**
   * Identify emission hotspots
   */
  private identifyHotspots(
    scope1: Scope1Emissions,
    scope2: Scope2Emissions,
    scope3Up: Scope3Emissions,
    scope3Down: Scope3Emissions,
  ): EmissionHotspot[] {
    const total = scope1.total + scope2.total + scope3Up.total + scope3Down.total;

    const categories: { name: string; value: number }[] = [
      { name: 'Purchased goods', value: scope3Up.purchased_goods || 0 },
      { name: 'Outbound delivery', value: scope3Down.outbound_delivery || 0 },
      { name: 'Inbound transport', value: scope3Up.inbound_transport || 0 },
      { name: 'Warehouse electricity', value: scope2.electricity_warehouse },
      { name: 'Packaging', value: scope3Down.packaging || 0 },
      { name: 'Office electricity', value: scope2.electricity_offices },
      { name: 'Fleet vehicles', value: scope1.fleet },
    ];

    return categories
      .map((cat) => ({
        category: cat.name,
        emissions: cat.value,
        percentage: (cat.value / total) * 100,
        trend: 'STABLE' as const, // Would compare with history
        reduciblePotential: this.estimateReduciblePotential(cat.name),
      }))
      .filter((h) => h.percentage > 1) // Only show significant categories
      .sort((a, b) => b.emissions - a.emissions)
      .slice(0, 5);
  }

  private estimateReduciblePotential(category: string): number {
    const potentials: Record<string, number> = {
      'Purchased goods': 15, // Through supplier engagement
      'Outbound delivery': 30, // Through route optimization, EV
      'Inbound transport': 20, // Through consolidation
      'Warehouse electricity': 50, // Through green energy
      'Packaging': 40, // Through recycled materials
      'Office electricity': 30, // Through efficiency
      'Fleet vehicles': 80, // Through EV transition
    };
    return potentials[category] || 10;
  }

  private async generateRecommendations(
    hotspots: EmissionHotspot[],
  ): Promise<CarbonRecommendation[]> {
    const recommendations: CarbonRecommendation[] = [];

    for (const hotspot of hotspots) {
      if (hotspot.category === 'Outbound delivery' && hotspot.reduciblePotential > 20) {
        recommendations.push({
          priority: 'HIGH',
          action: 'Optimize delivery routes + increase EV carrier share',
          expectedReduction: hotspot.emissions * 0.3,
          cost: 5000,
          paybackPeriod: '6 months',
          owner: 'IA-Transport',
        });
      }

      if (hotspot.category === 'Warehouse electricity') {
        recommendations.push({
          priority: 'MEDIUM',
          action: 'Switch to 100% renewable electricity contract',
          expectedReduction: hotspot.emissions * 0.8,
          cost: 2000, // Premium per year
          paybackPeriod: '12 months (reputation ROI)',
          owner: 'IA-CFO',
        });
      }

      if (hotspot.category === 'Packaging') {
        recommendations.push({
          priority: 'MEDIUM',
          action: 'Switch to recycled/recyclable packaging materials',
          expectedReduction: hotspot.emissions * 0.4,
          cost: 3000,
          paybackPeriod: '8 months',
          owner: 'IA-Stock',
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  // ==================== 2. CSR COMPLIANCE MONITOR ====================

  /**
   * Check CSRD compliance readiness
   * KPI: csr-compliance-score 100%
   */
  @Cron('0 8 1 */3 *') // Quarterly on 1st at 8am
  async checkCSRDCompliance(): Promise<CSRDComplianceReport> {
    this.logger.log('📋 Checking CSRD compliance readiness');

    const esrsCategories = [
      { id: 'E1_climate', name: 'Climate Change' },
      { id: 'E2_pollution', name: 'Pollution' },
      { id: 'E3_water', name: 'Water & Marine Resources' },
      { id: 'E4_biodiversity', name: 'Biodiversity & Ecosystems' },
      { id: 'E5_circular', name: 'Circular Economy' },
      { id: 'S1_workforce', name: 'Own Workforce' },
      { id: 'S2_value_chain', name: 'Workers in Value Chain' },
      { id: 'S3_communities', name: 'Affected Communities' },
      { id: 'S4_consumers', name: 'Consumers & End-users' },
      { id: 'G1_governance', name: 'Business Conduct' },
    ];

    const assessments: ESRSCategoryAssessment[] = await Promise.all(
      esrsCategories.map(async (cat) => {
        const requirements = await this.complianceMonitor.getRequirements(cat.id);
        const dataAvailability = await this.complianceMonitor.checkDataAvailability(cat.id);

        return {
          category: cat.id,
          name: cat.name,
          readiness: (dataAvailability.available / dataAvailability.required) * 100,
          gaps: dataAvailability.missing,
          dataAvailable: dataAvailability.available,
          dataRequired: dataAvailability.required,
        };
      }),
    );

    const overallReadiness =
      assessments.reduce((sum, a) => sum + a.readiness, 0) / assessments.length;

    const priorityActions = this.generatePriorityActions(assessments);

    const report: CSRDComplianceReport = {
      assessmentDate: new Date(),
      framework: 'CSRD/ESRS',
      applicableFrom: this.config.compliance.csrdApplicableDate,
      overallReadiness,
      categories: assessments,
      priorityActions,
    };

    // Alert if readiness below threshold
    if (overallReadiness < this.config.compliance.readinessAlertThreshold) {
      await this.alertLowReadiness(report);
    }

    this.logger.log(`✅ CSRD readiness: ${overallReadiness.toFixed(1)}%`);

    return report;
  }

  private generatePriorityActions(
    assessments: ESRSCategoryAssessment[],
  ): PriorityAction[] {
    const actions: PriorityAction[] = [];

    for (const assessment of assessments) {
      if (assessment.readiness < 50) {
        for (const gap of assessment.gaps.slice(0, 2)) {
          actions.push({
            priority: 'HIGH',
            action: `Complete data collection: ${gap}`,
            category: assessment.category,
            estimatedEffort: '3-5 days',
          });
        }
      } else if (assessment.readiness < 80) {
        for (const gap of assessment.gaps.slice(0, 1)) {
          actions.push({
            priority: 'MEDIUM',
            action: `Address gap: ${gap}`,
            category: assessment.category,
            estimatedEffort: '1-2 days',
          });
        }
      }
    }

    return actions
      .sort((a, b) => {
        const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 10); // Top 10 actions
  }

  // ==================== 3. SUPPLIER ETHICS SCORER ====================

  /**
   * Assess supplier ethics score
   * KPI: supplier-ethics-avg >70
   */
  async assessSupplierEthics(supplierId: string): Promise<SupplierEthicsScore> {
    this.logger.log(`🏭 Assessing ethics for supplier ${supplierId}`);

    // Get questionnaire responses
    const questionnaire = await this.supplierEthics.getQuestionnaire(supplierId);

    // Get certifications
    const certifications = await this.supplierEthics.getCertifications(supplierId);

    // Check external sources (RepRisk, sanctions, etc.)
    const externalData = await this.supplierEthics.getExternalData(supplierId);

    // Calculate sub-scores
    const environmentScore = this.calculateEnvironmentScore(questionnaire, certifications);
    const socialScore = this.calculateSocialScore(questionnaire, certifications);
    const governanceScore = this.calculateGovernanceScore(questionnaire, certifications);
    const riskScore = await this.calculateRiskScore(supplierId, externalData);

    // Weighted total
    const weights = this.config.supplier.weights;
    const totalScore =
      environmentScore * weights.environment +
      socialScore * weights.social +
      governanceScore * weights.governance +
      riskScore * weights.risk;

    // Determine status
    let status: SupplierEthicsScore['status'];
    if (totalScore >= this.config.supplier.approvalThreshold) {
      status = 'APPROVED';
    } else if (totalScore >= this.config.supplier.conditionalThreshold) {
      status = 'CONDITIONAL';
    } else if (totalScore >= this.config.supplier.probationThreshold) {
      status = 'PROBATION';
    } else {
      status = 'REJECTED';
    }

    const result: SupplierEthicsScore = {
      supplierId,
      supplierName: questionnaire.companyName || supplierId,
      assessmentDate: new Date(),
      scores: {
        environment: environmentScore,
        social: socialScore,
        governance: governanceScore,
        risk: riskScore,
      },
      totalScore,
      status,
      certifications,
      improvementAreas: this.identifyImprovementAreas(
        environmentScore,
        socialScore,
        governanceScore,
      ),
      nextAuditDate: this.calculateNextAuditDate(status),
    };

    // Notify Supplier Scorer agent
    await this.notifySupplierScorer(result);

    this.logger.log(
      `✅ Supplier ${supplierId} ethics score: ${totalScore.toFixed(0)}/100 - ${status}`,
    );

    return result;
  }

  private calculateEnvironmentScore(questionnaire: any, certifications: string[]): number {
    let score = 50; // Base score

    // Certifications
    if (certifications.includes('ISO 14001')) score += 15;
    if (certifications.includes('EMAS')) score += 10;

    // Questionnaire answers (simplified)
    if (questionnaire.hasEnvironmentalPolicy) score += 10;
    if (questionnaire.publishesCarbonFootprint) score += 10;
    if (questionnaire.renewableEnergyShare > 50) score += 5;

    return Math.min(100, score);
  }

  private calculateSocialScore(questionnaire: any, certifications: string[]): number {
    let score = 50;

    if (certifications.includes('SA8000')) score += 20;
    if (questionnaire.hasCodeOfConduct) score += 10;
    if (questionnaire.hasWorkersRepresentation) score += 10;
    if (questionnaire.accidentRateLTI === 0) score += 10;

    return Math.min(100, score);
  }

  private calculateGovernanceScore(questionnaire: any, certifications: string[]): number {
    let score = 60;

    if (questionnaire.hasAntiCorruptionPolicy) score += 15;
    if (questionnaire.hasWhistleblowerMechanism) score += 10;
    if (questionnaire.publishesAnnualReport) score += 10;
    if (!questionnaire.hasLegalViolations) score += 5;

    return Math.min(100, score);
  }

  private async calculateRiskScore(supplierId: string, externalData: any): Promise<number> {
    let score = 70; // Base score

    // Country risk
    const countryRisk = externalData.countryRisk || 'LOW';
    if (countryRisk === 'HIGH') score -= 30;
    else if (countryRisk === 'MEDIUM') score -= 15;

    // RepRisk incidents
    if (externalData.repRiskIncidents > 0) score -= externalData.repRiskIncidents * 10;

    // Sanctions
    if (externalData.onSanctionsList) score = 0;

    return Math.max(0, score);
  }

  private identifyImprovementAreas(
    envScore: number,
    socialScore: number,
    govScore: number,
  ): string[] {
    const areas: string[] = [];

    if (envScore < 70) areas.push('Environmental certifications (ISO 14001)');
    if (socialScore < 70) areas.push('Social audit (SA8000)');
    if (govScore < 70) areas.push('Governance policies');

    return areas;
  }

  private calculateNextAuditDate(status: SupplierEthicsScore['status']): Date {
    const now = new Date();
    switch (status) {
      case 'APPROVED':
        return new Date(now.setFullYear(now.getFullYear() + 1)); // Annual
      case 'CONDITIONAL':
        return new Date(now.setMonth(now.getMonth() + 6)); // 6 months
      case 'PROBATION':
        return new Date(now.setMonth(now.getMonth() + 3)); // 3 months
      default:
        return new Date(); // Immediate
    }
  }

  // ==================== 4. GREEN DELIVERY CARBON ====================

  /**
   * Calculate carbon for delivery options
   * Called by IA-Transport for green delivery choice
   */
  async calculateDeliveryCarbon(
    options: DeliveryOption[],
  ): Promise<DeliveryCarbonComparison> {
    const results: DeliveryCarbonResult[] = options.map((option) => {
      const factorKey = `${option.mode}_${option.vehicleType}`;
      const factor = this.transportFactors[factorKey] || this.transportFactors['road_diesel'];
      const kgCO2 = (option.distance * factor) / 1000;
      const internalCarbonCost = (kgCO2 / 1000) * this.config.carbon.internalCarbonPrice;

      return {
        optionId: option.id,
        kgCO2,
        internalCarbonCost,
        isGreenest: false,
      };
    });

    // Mark greenest option
    const minCarbon = Math.min(...results.map((r) => r.kgCO2));
    results.forEach((r) => {
      r.isGreenest = r.kgCO2 === minCarbon;
    });

    // Calculate savings vs standard (first option)
    const standardCarbon = results[0]?.kgCO2 || 0;
    const greenestCarbon = minCarbon;
    const kgCO2Avoided = standardCarbon - greenestCarbon;
    const percentage =
      standardCarbon > 0 ? ((standardCarbon - greenestCarbon) / standardCarbon) * 100 : 0;

    const greenestOption = results.find((r) => r.isGreenest);

    return {
      options: results,
      recommendedOption: greenestOption?.optionId || options[0]?.id || '',
      savingsVsStandard: {
        kgCO2Avoided,
        percentage,
      },
      customerDisplay: {
        badge: percentage > 30 ? '🌱 Livraison Éco' : '',
        message:
          kgCO2Avoided > 0
            ? `Cette option évite ${Math.round(kgCO2Avoided)} kg de CO2`
            : '',
      },
    };
  }

  // ==================== 5. GREEN PRODUCT LABELING ====================

  /**
   * Generate green label for a product
   */
  async generateGreenLabel(productId: string): Promise<GreenProductLabel> {
    // Get product data
    const manufacturingData = await this.greenLabeling.getManufacturingData(productId);
    const productCarbon = await this.greenLabeling.calculateProductCarbon(productId);

    // Calculate breakdown
    const breakdown = {
      manufacturing: productCarbon * 0.7, // 70% from manufacturing
      transport: productCarbon * 0.2, // 20% from transport
      packaging: productCarbon * 0.1, // 10% from packaging
    };

    // Determine score
    const thresholds = this.config.greenLabel.thresholds;
    let carbonScore: GreenProductLabel['carbonScore'];
    if (productCarbon <= thresholds.A) carbonScore = 'A';
    else if (productCarbon <= thresholds.B) carbonScore = 'B';
    else if (productCarbon <= thresholds.C) carbonScore = 'C';
    else if (productCarbon <= thresholds.D) carbonScore = 'D';
    else carbonScore = 'E';

    return {
      productId,
      productName: manufacturingData.name,
      carbonScore,
      totalCO2g: productCarbon,
      breakdown,
      recyclability: manufacturingData.recyclability || 50,
      durability: manufacturingData.durability || 'MEDIUM',
      badge: ['A', 'B'].includes(carbonScore) ? 'Éco-responsable' : null,
    };
  }

  // ==================== DASHBOARD ====================

  /**
   * Generate ESG dashboard data
   * KPI: esg-score-global >75
   */
  async generateESGDashboard(period: string): Promise<ESGDashboard> {
    // Get latest carbon data
    const carbonReport = await this.getLatestCarbonReport(period);

    // Get HR data (would come from IA-HR)
    const hrData = await this.getHRData(period);

    // Get supplier data
    const supplierData = await this.getSupplierAggregates();

    // Calculate overall ESG score
    const environmentalScore = Math.max(0, 100 - carbonReport.intensity);
    const socialScore = hrData.employeeNPS * 10; // Convert NPS to 0-100
    const governanceScore = supplierData.averageScore;

    const overallScore =
      environmentalScore * 0.4 + socialScore * 0.3 + governanceScore * 0.3;

    return {
      period,
      environmental: {
        carbonFootprint: carbonReport.totalEmissions,
        carbonIntensity: carbonReport.intensity,
        renewableEnergyShare: 45, // Mock - would come from energy data
        recyclingRate: 72, // Mock
        kmAvoided: 15000, // Mock - from route optimization
      },
      social: {
        employeeNPS: hrData.employeeNPS,
        accidentRate: hrData.accidentRate,
        trainingHoursPerEmployee: hrData.trainingHours,
        genderPayGap: hrData.genderPayGap,
      },
      governance: {
        supplierEthicsScore: supplierData.averageScore,
        suppliersAudited: supplierData.auditedPercentage,
        corruptionIncidents: 0,
      },
      overallScore,
      benchmark: {
        sector: 'E-commerce Auto Parts',
        averageScore: 62,
        ourRank: overallScore >= 75 ? 'Top 25%' : overallScore >= 60 ? 'Top 50%' : 'Below Average',
      },
    };
  }

  // ==================== HELPER METHODS ====================

  private getPreviousMonth(): string {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return now.toISOString().slice(0, 7);
  }

  private async getRevenue(period: string): Promise<number> {
    // Mock - would come from IA-CFO
    return 850000;
  }

  private async compareWithHistory(
    totalEmissions: number,
    intensity: number,
  ): Promise<CarbonReport['comparison']> {
    // Mock comparison - would query historical data
    return {
      vsLastMonth: -4.2,
      vsLastYear: -12.8,
      vsTarget: intensity <= this.config.carbon.targetIntensity ? 'ON_TRACK' : 'BEHIND',
    };
  }

  private async storeReport(report: CarbonReport): Promise<void> {
    this.logger.log(`💾 Storing carbon report for ${report.period}`);
    // TODO: Store in database
  }

  private async alertHighIntensity(report: CarbonReport): Promise<void> {
    this.logger.warn(
      `🚨 Carbon intensity ${report.intensity.toFixed(1)}g/€ exceeds target ${this.config.carbon.targetIntensity}g/€`,
    );
    // TODO: Emit event for IA-CEO
  }

  private async alertLowReadiness(report: CSRDComplianceReport): Promise<void> {
    this.logger.warn(
      `🚨 CSRD readiness ${report.overallReadiness.toFixed(1)}% below threshold ${this.config.compliance.readinessAlertThreshold}%`,
    );
    // TODO: Emit event for IA-CEO, IA-Legal
  }

  private async notifySupplierScorer(result: SupplierEthicsScore): Promise<void> {
    this.logger.log(`📤 Notifying Supplier Scorer: ${result.supplierId} - ${result.status}`);
    // TODO: Emit event for Supplier Scorer agent
  }

  private async getLatestCarbonReport(period: string): Promise<CarbonReport> {
    // Mock - would retrieve from database
    return {
      period,
      totalEmissions: 280.9,
      intensity: 33.0,
    } as CarbonReport;
  }

  private async getHRData(period: string): Promise<any> {
    // Mock - would come from IA-HR
    return {
      employeeNPS: 38,
      accidentRate: 0,
      trainingHours: 24,
      genderPayGap: 3.2,
    };
  }

  private async getSupplierAggregates(): Promise<any> {
    // Mock - would aggregate supplier scores
    return {
      averageScore: 72,
      auditedPercentage: 65,
    };
  }

  // ==================== FORMATTERS ====================

  /**
   * Format carbon report for display
   */
  formatCarbonReport(report: CarbonReport): string {
    const lines = [
      `🌍 CARBON FOOTPRINT REPORT - ${report.period}`,
      '',
      `Total Emissions: ${report.totalEmissions.toFixed(1)} tCO2e`,
      `├─ Scope 1 (Direct): ${report.scope1.total.toFixed(1)} tCO2e (${((report.scope1.total / report.totalEmissions) * 100).toFixed(1)}%)`,
      `├─ Scope 2 (Energy): ${report.scope2.total.toFixed(1)} tCO2e (${((report.scope2.total / report.totalEmissions) * 100).toFixed(1)}%)`,
      `├─ Scope 3 Upstream: ${report.scope3Upstream.total.toFixed(1)} tCO2e (${((report.scope3Upstream.total / report.totalEmissions) * 100).toFixed(1)}%)`,
      `└─ Scope 3 Downstream: ${report.scope3Downstream.total.toFixed(1)} tCO2e (${((report.scope3Downstream.total / report.totalEmissions) * 100).toFixed(1)}%)`,
      '',
      `Carbon Intensity: ${report.intensity.toFixed(1)} g CO2/€`,
      `├─ vs Last Month: ${report.comparison.vsLastMonth > 0 ? '+' : ''}${report.comparison.vsLastMonth.toFixed(1)}%`,
      `├─ vs Last Year: ${report.comparison.vsLastYear > 0 ? '+' : ''}${report.comparison.vsLastYear.toFixed(1)}%`,
      `└─ vs Target (${this.config.carbon.targetIntensity}g): ${report.comparison.vsTarget}`,
      '',
      '🔥 TOP HOTSPOTS:',
      ...report.hotspots.slice(0, 3).map(
        (h, i) => `${i + 1}. ${h.category}: ${h.emissions.toFixed(1)} tCO2e (${h.percentage.toFixed(0)}%)`,
      ),
    ];

    if (report.recommendations.length > 0) {
      lines.push('', '🎯 RECOMMENDATIONS:');
      for (const rec of report.recommendations.slice(0, 3)) {
        const emoji = rec.priority === 'HIGH' ? '🔴' : '🟡';
        lines.push(`${emoji} ${rec.action} → -${rec.expectedReduction.toFixed(1)} tCO2e/year`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format supplier ethics score for display
   */
  formatSupplierEthicsScore(score: SupplierEthicsScore): string {
    const statusEmoji = {
      APPROVED: '✅',
      CONDITIONAL: '🟡',
      PROBATION: '🟠',
      REJECTED: '🔴',
    };

    return [
      `🏭 SUPPLIER ETHICS AUDIT - ${score.supplierName}`,
      '',
      `Overall Score: ${score.totalScore.toFixed(0)}/100 ${statusEmoji[score.status]} ${score.status}`,
      '',
      'Breakdown:',
      `├─ Environment (30%): ${score.scores.environment.toFixed(0)}/100`,
      `├─ Social (35%): ${score.scores.social.toFixed(0)}/100`,
      `├─ Governance (25%): ${score.scores.governance.toFixed(0)}/100`,
      `└─ Risk (10%): ${score.scores.risk.toFixed(0)}/100`,
      '',
      `Certifications: ${score.certifications.join(', ') || 'None'}`,
      `Next Audit: ${score.nextAuditDate.toLocaleDateString('fr-FR')}`,
      ...(score.improvementAreas.length > 0
        ? ['', 'Improvement Areas:', ...score.improvementAreas.map((a) => `• ${a}`)]
        : []),
    ].join('\n');
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    return {
      status: 'healthy',
      details: {
        lastCarbonReport: this.getPreviousMonth(),
        csrdReadiness: 72,
        suppliersMonitored: 45,
        carbonAPIsAvailable: true,
      },
    };
  }
}
