import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * IA-RD - Agent Innovation & R&D IA (v2.23.0)
 *
 * Board Member - Strategy & Innovation
 * Budget: €38K (Dev €28K + APIs veille tech €10K)
 * ROI: +€120K/an (anticipation marché EV + first-mover advantage)
 *
 * 5 Responsabilités:
 * 1. Tech Radar Automotive - Veille électrification/ADAS/connectivité
 * 2. Market Disruption Detector - Alertes précoces disruptions
 * 3. Product Opportunity Finder - Identification nouvelles catégories
 * 4. Competitive Intelligence - Surveillance concurrents
 * 5. Patent & Regulation Watch - Brevets et réglementations
 *
 * KPIs:
 * - tech-coverage: >90%
 * - disruption-lead-time: >6 mois
 * - opportunities-validated: >5/trimestre
 * - competitive-response-time: <48h
 * - regulation-compliance-lead: >12 mois
 */

// ==================== INTERFACES ====================

export type TechnologyMaturity = 'EMERGING' | 'GROWING' | 'MATURE' | 'DECLINING';
export type TechnologyCategory =
  | 'ELECTRIFICATION'
  | 'ADAS'
  | 'CONNECTIVITY'
  | 'MANUFACTURING'
  | 'HYDROGEN';

export interface Technology {
  id: string;
  name: string;
  category: TechnologyCategory;
  description: string;
  maturity: TechnologyMaturity;
  timeToImpact: string; // "6-12 months", "1-2 years", etc.
  relevanceScore: number; // 0-10
  sources: string[];
  lastUpdated: Date;
}

export interface TechRadar {
  period: string; // "2025-12"
  generatedAt: Date;
  technologies: TechRadarItem[];
  summary: {
    emerging: number;
    growing: number;
    mature: number;
    declining: number;
  };
  highlights: string[];
}

export interface TechRadarItem {
  name: string;
  category: TechnologyCategory;
  maturity: TechnologyMaturity;
  relevance: number;
  timeToImpact: string;
  catalogOpportunity: CatalogOpportunity | null;
  movement: 'UP' | 'STABLE' | 'DOWN' | 'NEW';
}

export interface CatalogOpportunity {
  productCategory: string;
  estimatedMarketSize: number;
  currentCoverage: number; // percentage
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DisruptionAlert {
  id: string;
  source: string;
  title: string;
  summary: string;
  impactScore: number; // 1-10
  catalogExposure: number; // percentage of catalog affected
  timeline: 'SHORT' | 'MEDIUM' | 'LONG'; // <1 year, 1-3 years, >3 years
  affectedBrands: string[];
  affectedCategories: string[];
  recommendedActions: RecommendedAction[];
  detectedAt: Date;
  status: 'NEW' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED';
}

export interface RecommendedAction {
  priority: 'IMMEDIATE' | 'SHORT_TERM' | 'MEDIUM_TERM';
  action: string;
  owner: string;
  estimatedEffort: string;
}

export interface EVOpportunityReport {
  period: string;
  generatedAt: Date;
  parkData: VehicleParkData;
  serviceWave: ServiceWaveProjection;
  opportunities: ProductOpportunity[];
  totalAddressableMarket: number;
  recommendedPriorities: string[];
}

export interface VehicleParkData {
  country: string;
  totalRegistrations: number;
  breakdown: {
    BEV: { count: number; share: number; yoyGrowth: number };
    PHEV: { count: number; share: number; yoyGrowth: number };
    HEV: { count: number; share: number; yoyGrowth: number };
    ICE: { count: number; share: number; yoyGrowth: number };
  };
  topEVModels: {
    model: string;
    brand: string;
    count: number;
    firstServiceWave: string;
  }[];
}

export interface ServiceWaveProjection {
  year2026: { vehicles: number; serviceRevenue: number };
  year2027: { vehicles: number; serviceRevenue: number };
  year2028: { vehicles: number; serviceRevenue: number };
}

export interface ProductOpportunity {
  id: string;
  category: string;
  description: string;
  marketSize: number; // €/year
  currentCoverage: number; // percentage
  gap: string[];
  marginPotential: number; // percentage
  sourcingComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  suppliersIdentified: number;
  timeToMarket: string;
  score: number; // 0-10
  recommendation: 'PRIORITY_HIGH' | 'PRIORITY_MEDIUM' | 'PRIORITY_LOW' | 'WATCH';
  businessCase?: BusinessCase;
}

export interface BusinessCase {
  investmentRequired: number;
  expectedRevenue: number[];
  paybackPeriod: string;
  risks: string[];
}

export interface CompetitiveReport {
  period: string;
  analyzedAt: Date;
  competitors: string[];
  critical: CompetitorMove[];
  notable: CompetitorMove[];
  opportunities: CompetitiveOpportunity[];
}

export interface CompetitorMove {
  competitor: string;
  type: 'NEW_PRODUCT' | 'PRICE_CHANGE' | 'CAMPAIGN' | 'PARTNERSHIP' | 'ACQUISITION';
  details: any;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  detectedAt: Date;
  ourResponse?: string;
}

export interface CompetitiveOpportunity {
  description: string;
  source: string;
  actionSuggested: string;
}

export interface RegulationAlert {
  id: string;
  regulation: RegulationInfo;
  impact: RegulationImpact;
  compliancePlan: CompliancePlan;
}

export interface RegulationInfo {
  reference: string; // "EU 2025/XXX"
  title: string;
  source: 'EUR-Lex' | 'JORF' | 'UNECE' | 'OTHER';
  effectiveDate: Date;
  transitionPeriod?: string;
  scope: string;
  url: string;
}

export interface RegulationImpact {
  relevant: boolean;
  productsAffected: number;
  categories: string[];
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  description: string;
}

export interface CompliancePlan {
  status: 'COMPLIANT' | 'ACTION_REQUIRED' | 'NOT_APPLICABLE' | 'MONITORING';
  actions: {
    action: string;
    deadline: Date;
    owner: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  }[];
  nextReview: Date;
}

export interface SourcingAssessment {
  feasibility: number; // 0-1
  suppliersAvailable: number;
  leadTime: string;
  minimumOrderQuantity: number;
  risks: string[];
}

// Mock interfaces for external services
interface TechRadarService {
  getLatestNews(params: any): Promise<any[]>;
  getTechnologies(category: string): Promise<Technology[]>;
}

interface MarketIntelligenceService {
  getVehicleParkData(params: any): Promise<VehicleParkData>;
  getMarketTrends(segment: string): Promise<any>;
}

interface PatentWatchService {
  searchPatents(query: string): Promise<any[]>;
  getExpiringPatents(category: string, months: number): Promise<any[]>;
}

interface CompetitiveIntelService {
  getNewProducts(competitor: string): Promise<any[]>;
  getPriceChanges(competitor: string, threshold: number): Promise<any[]>;
  getNews(competitor: string): Promise<any[]>;
}

interface RegulationMonitorService {
  getNew(params: any): Promise<RegulationInfo[]>;
  getUpcoming(months: number): Promise<RegulationInfo[]>;
}

interface CatalogService {
  getEVCoverage(): Promise<any>;
  getCategories(): Promise<string[]>;
  getProductsByCategory(category: string): Promise<any[]>;
}

// ==================== MAIN SERVICE ====================

@Injectable()
export class RDAgentService {
  private readonly logger = new Logger(RDAgentService.name);

  // External services (to be injected)
  private techRadar: TechRadarService;
  private marketIntel: MarketIntelligenceService;
  private patentWatch: PatentWatchService;
  private competitiveIntel: CompetitiveIntelService;
  private regulationMonitor: RegulationMonitorService;
  private catalogService: CatalogService;

  // Configuration
  private readonly config = {
    competitors: ['oscaro', 'mister-auto', 'autodoc', 'amazon-auto', 'norauto'],
    techCategories: [
      'ELECTRIFICATION',
      'ADAS',
      'CONNECTIVITY',
      'MANUFACTURING',
      'HYDROGEN',
    ] as TechnologyCategory[],
    disruption: {
      alertThreshold: 7, // Score out of 10
    },
    opportunity: {
      minMarketSize: 500000, // €500K minimum
      minScore: 5, // Out of 10
    },
    sources: {
      tech: ['arxiv', 'ieee', 'sae', 'google_patents', 'crunchbase'],
      market: ['aaa_data', 'ccfa', 'sp_global', 'ihs_markit'],
      regulation: ['eur-lex', 'jorf', 'unece'],
    },
  };

  // In-memory cache for tech radar
  private techRadarCache: TechRadar | null = null;

  constructor() {
    this.logger.log('IA-RD (Innovation & R&D Agent) initialized');
  }

  // ==================== 1. TECH RADAR AUTOMOTIVE ====================

  /**
   * Generate monthly Tech Radar
   * KPI: tech-coverage >90%
   */
  @Cron('0 9 1 * *') // 1st of month at 9am
  async generateTechRadar(): Promise<TechRadar> {
    this.logger.log('🔬 Generating Tech Radar');

    const technologies: TechRadarItem[] = [];

    for (const category of this.config.techCategories) {
      const techs = await this.techRadar.getTechnologies(category);

      for (const tech of techs) {
        const relevance = await this.assessRelevance(tech);
        const catalogOpportunity = await this.mapToCatalog(tech);
        const previousMaturity = this.getPreviousMaturity(tech.id);

        technologies.push({
          name: tech.name,
          category: tech.category,
          maturity: tech.maturity,
          relevance,
          timeToImpact: tech.timeToImpact,
          catalogOpportunity,
          movement: this.calculateMovement(tech.maturity, previousMaturity),
        });
      }
    }

    // Generate summary
    const summary = {
      emerging: technologies.filter((t) => t.maturity === 'EMERGING').length,
      growing: technologies.filter((t) => t.maturity === 'GROWING').length,
      mature: technologies.filter((t) => t.maturity === 'MATURE').length,
      declining: technologies.filter((t) => t.maturity === 'DECLINING').length,
    };

    // Generate highlights
    const highlights = this.generateHighlights(technologies);

    const radar: TechRadar = {
      period: new Date().toISOString().slice(0, 7),
      generatedAt: new Date(),
      technologies: technologies.sort((a, b) => b.relevance - a.relevance),
      summary,
      highlights,
    };

    // Cache and distribute
    this.techRadarCache = radar;
    await this.distributeTechRadar(radar);

    this.logger.log(
      `✅ Tech Radar generated: ${technologies.length} technologies tracked`,
    );

    return radar;
  }

  /**
   * Assess relevance of a technology to our business
   */
  private async assessRelevance(tech: Technology): Promise<number> {
    let score = 5; // Base score

    // Higher relevance for electrification (our growth area)
    if (tech.category === 'ELECTRIFICATION') score += 2;

    // Adjust based on maturity
    if (tech.maturity === 'GROWING') score += 1;
    if (tech.maturity === 'EMERGING') score += 0.5;

    // Adjust based on time to impact
    if (tech.timeToImpact.includes('6-12 months')) score += 1;

    return Math.min(10, score);
  }

  /**
   * Map technology to catalog opportunities
   */
  private async mapToCatalog(tech: Technology): Promise<CatalogOpportunity | null> {
    // Map technologies to product categories
    const mappings: Record<string, string[]> = {
      'solid-state-battery': ['batteries', 'ev-components'],
      'lidar': ['adas-sensors', 'safety-systems'],
      'v2x-communication': ['connected-car', 'electronics'],
      '3d-printing': ['custom-parts', 'rare-parts'],
      'hydrogen-fuel-cell': ['hydrogen-components'],
    };

    const techKey = tech.name.toLowerCase().replace(/\s+/g, '-');
    const categories = mappings[techKey];

    if (!categories) return null;

    const currentCoverage = await this.getCatalogCoverage(categories[0]);

    return {
      productCategory: categories[0],
      estimatedMarketSize: this.estimateMarketSize(tech),
      currentCoverage,
      priority: currentCoverage < 30 ? 'HIGH' : currentCoverage < 60 ? 'MEDIUM' : 'LOW',
    };
  }

  private getPreviousMaturity(techId: string): TechnologyMaturity | null {
    // TODO: Retrieve from historical data
    return null;
  }

  private calculateMovement(
    current: TechnologyMaturity,
    previous: TechnologyMaturity | null,
  ): TechRadarItem['movement'] {
    if (!previous) return 'NEW';
    
    const order: TechnologyMaturity[] = ['EMERGING', 'GROWING', 'MATURE', 'DECLINING'];
    const currentIdx = order.indexOf(current);
    const previousIdx = order.indexOf(previous);
    
    if (currentIdx < previousIdx) return 'UP';
    if (currentIdx > previousIdx) return 'DOWN';
    return 'STABLE';
  }

  private generateHighlights(technologies: TechRadarItem[]): string[] {
    const highlights: string[] = [];

    const newTechs = technologies.filter((t) => t.movement === 'NEW');
    if (newTechs.length > 0) {
      highlights.push(`${newTechs.length} nouvelles technologies détectées`);
    }

    const highRelevance = technologies.filter((t) => t.relevance >= 8);
    if (highRelevance.length > 0) {
      highlights.push(
        `${highRelevance.length} technologies à haute pertinence: ${highRelevance.map((t) => t.name).join(', ')}`,
      );
    }

    const evGrowing = technologies.filter(
      (t) => t.category === 'ELECTRIFICATION' && t.maturity === 'GROWING',
    );
    if (evGrowing.length > 0) {
      highlights.push(`Électrification en croissance: ${evGrowing.length} technologies`);
    }

    return highlights;
  }

  private estimateMarketSize(tech: Technology): number {
    // Simplified market size estimation
    const baseSizes: Record<TechnologyCategory, number> = {
      ELECTRIFICATION: 50000000,
      ADAS: 30000000,
      CONNECTIVITY: 15000000,
      MANUFACTURING: 10000000,
      HYDROGEN: 5000000,
    };

    const maturityMultipliers: Record<TechnologyMaturity, number> = {
      EMERGING: 0.1,
      GROWING: 0.5,
      MATURE: 1.0,
      DECLINING: 0.3,
    };

    return baseSizes[tech.category] * maturityMultipliers[tech.maturity];
  }

  private async getCatalogCoverage(category: string): Promise<number> {
    // TODO: Calculate actual coverage from catalog
    return 30; // Mock 30% coverage
  }

  private async distributeTechRadar(radar: TechRadar): Promise<void> {
    this.logger.log('📤 Distributing Tech Radar to stakeholders');
    // TODO: Send to IA-CEO, IA-Merch, Purchasing via event bus
  }

  // ==================== 2. MARKET DISRUPTION DETECTOR ====================

  /**
   * Monitor tech disruptions in real-time
   * KPI: disruption-lead-time >6 months
   */
  @Cron(CronExpression.EVERY_HOUR)
  async monitorDisruptions(): Promise<DisruptionAlert[]> {
    const news = await this.techRadar.getLatestNews({
      sources: ['reuters', 'automotive_news', 'electrek', 'oem_press'],
      keywords: ['EV', 'electric', 'battery', 'ADAS', 'autonomous', 'end of production'],
      since: new Date(Date.now() - 60 * 60 * 1000), // Last hour
    });

    const alerts: DisruptionAlert[] = [];

    for (const item of news) {
      const impact = await this.assessDisruptionImpact(item);

      if (impact.score >= this.config.disruption.alertThreshold) {
        const alert: DisruptionAlert = {
          id: `disruption-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source: item.source,
          title: item.title,
          summary: item.summary,
          impactScore: impact.score,
          catalogExposure: impact.catalogExposure,
          timeline: impact.timeline,
          affectedBrands: impact.affectedBrands,
          affectedCategories: impact.affectedCategories,
          recommendedActions: impact.actions,
          detectedAt: new Date(),
          status: 'NEW',
        };

        alerts.push(alert);
        await this.escalateDisruption(alert);
      }
    }

    if (alerts.length > 0) {
      this.logger.warn(`🚨 ${alerts.length} disruption alert(s) detected`);
    }

    return alerts;
  }

  /**
   * Assess impact of a potential disruption
   */
  private async assessDisruptionImpact(newsItem: any): Promise<{
    score: number;
    catalogExposure: number;
    timeline: 'SHORT' | 'MEDIUM' | 'LONG';
    affectedBrands: string[];
    affectedCategories: string[];
    actions: RecommendedAction[];
  }> {
    // Extract entities from news (NLP)
    const brands = this.extractBrands(newsItem.title + ' ' + newsItem.summary);
    const categories = this.extractCategories(newsItem.title + ' ' + newsItem.summary);

    // Calculate catalog exposure
    const catalogExposure = await this.calculateCatalogExposure(brands, categories);

    // Determine timeline
    const timeline = this.determineTimeline(newsItem);

    // Calculate score
    let score = 0;
    score += catalogExposure > 30 ? 3 : catalogExposure > 10 ? 2 : 1;
    score += brands.length >= 3 ? 3 : brands.length >= 1 ? 2 : 1;
    score += timeline === 'SHORT' ? 3 : timeline === 'MEDIUM' ? 2 : 1;

    // Generate recommended actions
    const actions = this.generateDisruptionActions(catalogExposure, timeline);

    return {
      score,
      catalogExposure,
      timeline,
      affectedBrands: brands,
      affectedCategories: categories,
      actions,
    };
  }

  private extractBrands(text: string): string[] {
    const brands = [
      'Stellantis', 'Peugeot', 'Citroën', 'Fiat', 'Opel',
      'Renault', 'Dacia', 'Volkswagen', 'BMW', 'Mercedes',
      'Toyota', 'Honda', 'Tesla', 'Ford', 'Hyundai', 'Kia',
    ];
    return brands.filter((b) => text.toLowerCase().includes(b.toLowerCase()));
  }

  private extractCategories(text: string): string[] {
    const keywords: Record<string, string> = {
      'electric': 'EV Components',
      'battery': 'Batteries',
      'brake': 'Brakes',
      'engine': 'Engine Parts',
      'diesel': 'Diesel Parts',
      'sensor': 'ADAS Sensors',
    };

    const found: string[] = [];
    for (const [keyword, category] of Object.entries(keywords)) {
      if (text.toLowerCase().includes(keyword)) {
        found.push(category);
      }
    }
    return [...new Set(found)];
  }

  private async calculateCatalogExposure(
    brands: string[],
    categories: string[],
  ): Promise<number> {
    // TODO: Calculate actual exposure from catalog
    // Mock: 10% per brand, 5% per category
    return Math.min(100, brands.length * 10 + categories.length * 5);
  }

  private determineTimeline(newsItem: any): 'SHORT' | 'MEDIUM' | 'LONG' {
    const text = (newsItem.title + ' ' + newsItem.summary).toLowerCase();
    
    if (text.includes('2025') || text.includes('immediate') || text.includes('this year')) {
      return 'SHORT';
    }
    if (text.includes('2026') || text.includes('2027') || text.includes('next year')) {
      return 'MEDIUM';
    }
    return 'LONG';
  }

  private generateDisruptionActions(
    exposure: number,
    timeline: 'SHORT' | 'MEDIUM' | 'LONG',
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    if (exposure > 30 && timeline === 'SHORT') {
      actions.push({
        priority: 'IMMEDIATE',
        action: 'Réunion d\'urgence stratégie produit',
        owner: 'IA-CEO + IA-Merch',
        estimatedEffort: '2h',
      });
    }

    if (exposure > 10) {
      actions.push({
        priority: timeline === 'SHORT' ? 'IMMEDIATE' : 'SHORT_TERM',
        action: 'Analyse impact catalogue détaillée',
        owner: 'IA-RD',
        estimatedEffort: '1 jour',
      });
    }

    actions.push({
      priority: 'MEDIUM_TERM',
      action: 'Plan d\'adaptation catalogue',
      owner: 'IA-Merch + Purchasing',
      estimatedEffort: '1 semaine',
    });

    return actions;
  }

  private async escalateDisruption(alert: DisruptionAlert): Promise<void> {
    this.logger.warn(
      `🚨 DISRUPTION ALERT: ${alert.title} (Score: ${alert.impactScore}/10, Exposure: ${alert.catalogExposure}%)`,
    );
    // TODO: Emit event for IA-CEO via event bus
  }

  // ==================== 3. PRODUCT OPPORTUNITY FINDER ====================

  /**
   * Scan EV market for parts opportunities
   * KPI: opportunities-validated >5/quarter
   */
  @Cron('0 8 1 * 1') // First Monday of month at 8am
  async scanEVOpportunities(): Promise<EVOpportunityReport> {
    this.logger.log('🔋 Scanning EV parts opportunities');

    // 1. Get current vehicle park data
    const parkData = await this.marketIntel.getVehicleParkData({
      country: 'FR',
      period: 'last_12_months',
      breakdown: ['powertrain', 'brand', 'model'],
    });

    // 2. Project service wave timing
    const serviceWave = this.projectServiceWave(parkData);

    // 3. Identify catalog gaps
    const currentCatalog = await this.catalogService.getEVCoverage();
    const gaps = await this.identifyCatalogGaps(parkData, currentCatalog);

    // 4. Score opportunities
    const opportunities: ProductOpportunity[] = [];
    for (const gap of gaps) {
      const marketSize = await this.estimateGapMarketSize(gap);
      const sourcing = await this.assessSourcingComplexity(gap);
      const margin = await this.estimateMargin(gap);

      if (marketSize >= this.config.opportunity.minMarketSize) {
        const score = this.calculateOpportunityScore(marketSize, sourcing, margin);

        opportunities.push({
          id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          category: gap.category,
          description: gap.description,
          marketSize,
          currentCoverage: gap.currentCoverage,
          gap: gap.missingModels,
          marginPotential: margin,
          sourcingComplexity: sourcing.complexity,
          suppliersIdentified: sourcing.suppliersAvailable,
          timeToMarket: sourcing.leadTime,
          score,
          recommendation: this.getRecommendation(score),
        });
      }
    }

    // Sort by score
    opportunities.sort((a, b) => b.score - a.score);

    const report: EVOpportunityReport = {
      period: new Date().toISOString().slice(0, 7),
      generatedAt: new Date(),
      parkData,
      serviceWave,
      opportunities,
      totalAddressableMarket: opportunities.reduce((sum, o) => sum + o.marketSize, 0),
      recommendedPriorities: opportunities
        .filter((o) => o.recommendation === 'PRIORITY_HIGH')
        .map((o) => o.category),
    };

    // Notify stakeholders
    const highPriority = opportunities.filter((o) => o.score >= 7);
    if (highPriority.length > 0) {
      await this.notifyOpportunities(highPriority);
    }

    this.logger.log(
      `✅ EV Opportunity scan complete: ${opportunities.length} opportunities, €${(report.totalAddressableMarket / 1000000).toFixed(1)}M TAM`,
    );

    return report;
  }

  private projectServiceWave(parkData: VehicleParkData): ServiceWaveProjection {
    // EVs typically need first major service at 3-5 years
    // Calculate when current EVs will need service
    return {
      year2026: { vehicles: 150000, serviceRevenue: 45000000 },
      year2027: { vehicles: 280000, serviceRevenue: 84000000 },
      year2028: { vehicles: 450000, serviceRevenue: 135000000 },
    };
  }

  private async identifyCatalogGaps(
    parkData: VehicleParkData,
    currentCatalog: any,
  ): Promise<any[]> {
    // Compare top EV models with catalog coverage
    const gaps: any[] = [];

    const evCategories = [
      { category: 'EV Brake Pads', description: 'Plaquettes frein régénératif' },
      { category: 'Cabin Air Filters HEPA', description: 'Filtres habitacle haute performance' },
      { category: 'EV Charging Cables', description: 'Câbles de charge Type 2/CCS' },
      { category: 'ADAS Sensor Kits', description: 'Kits nettoyage capteurs ADAS' },
      { category: 'HV Battery Coolant', description: 'Liquide refroidissement batterie' },
    ];

    for (const cat of evCategories) {
      const coverage = await this.getCatalogCoverage(cat.category);
      if (coverage < 80) {
        gaps.push({
          ...cat,
          currentCoverage: coverage,
          missingModels: parkData.topEVModels
            .filter(() => Math.random() > 0.5) // Mock: random models missing
            .map((m) => m.model),
        });
      }
    }

    return gaps;
  }

  private async estimateGapMarketSize(gap: any): Promise<number> {
    // Mock market size estimation
    const baseSizes: Record<string, number> = {
      'EV Brake Pads': 8000000,
      'Cabin Air Filters HEPA': 3000000,
      'EV Charging Cables': 12000000,
      'ADAS Sensor Kits': 2000000,
      'HV Battery Coolant': 1500000,
    };
    return baseSizes[gap.category] || 1000000;
  }

  private async assessSourcingComplexity(gap: any): Promise<{
    complexity: 'LOW' | 'MEDIUM' | 'HIGH';
    suppliersAvailable: number;
    leadTime: string;
  }> {
    // Mock sourcing assessment
    return {
      complexity: Math.random() > 0.5 ? 'MEDIUM' : 'LOW',
      suppliersAvailable: Math.floor(Math.random() * 5) + 1,
      leadTime: '2-4 mois',
    };
  }

  private async estimateMargin(gap: any): Promise<number> {
    // Mock margin estimation (as percentage)
    const margins: Record<string, number> = {
      'EV Brake Pads': 0.35,
      'Cabin Air Filters HEPA': 0.45,
      'EV Charging Cables': 0.28,
      'ADAS Sensor Kits': 0.40,
      'HV Battery Coolant': 0.32,
    };
    return margins[gap.category] || 0.25;
  }

  private calculateOpportunityScore(
    marketSize: number,
    sourcing: any,
    margin: number,
  ): number {
    // Weighted scoring (0-10)
    const sizeScore = Math.min(10, marketSize / 1000000); // €1M = 1 point
    const sourcingScore =
      sourcing.complexity === 'LOW' ? 3 : sourcing.complexity === 'MEDIUM' ? 2 : 1;
    const marginScore = margin * 10; // 50% margin = 5 points

    return Math.min(10, sizeScore * 0.4 + sourcingScore * 0.3 + marginScore * 0.3);
  }

  private getRecommendation(
    score: number,
  ): ProductOpportunity['recommendation'] {
    if (score >= 7) return 'PRIORITY_HIGH';
    if (score >= 5) return 'PRIORITY_MEDIUM';
    if (score >= 3) return 'PRIORITY_LOW';
    return 'WATCH';
  }

  private async notifyOpportunities(opportunities: ProductOpportunity[]): Promise<void> {
    this.logger.log(
      `📤 Notifying ${opportunities.length} high-priority opportunities`,
    );
    // TODO: Send to IA-CEO, IA-Merch, Purchasing via event bus
  }

  // ==================== 4. COMPETITIVE INTELLIGENCE ====================

  /**
   * Track competitor moves
   * KPI: competitive-response-time <48h
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async trackCompetitors(): Promise<CompetitiveReport> {
    this.logger.log('📡 Tracking competitor movements');

    const moves: CompetitorMove[] = [];
    const opportunities: CompetitiveOpportunity[] = [];

    for (const competitor of this.config.competitors) {
      // Check new products
      const newProducts = await this.competitiveIntel.getNewProducts(competitor);
      for (const product of newProducts) {
        moves.push({
          competitor,
          type: 'NEW_PRODUCT',
          details: product,
          impact: this.assessMoveImpact(product),
          detectedAt: new Date(),
        });
      }

      // Check price changes
      const priceChanges = await this.competitiveIntel.getPriceChanges(competitor, 0.1);
      for (const change of priceChanges) {
        moves.push({
          competitor,
          type: 'PRICE_CHANGE',
          details: change,
          impact: change.changePercent > 0.15 ? 'HIGH' : 'MEDIUM',
          detectedAt: new Date(),
        });
      }

      // Check news for partnerships/acquisitions
      const news = await this.competitiveIntel.getNews(competitor);
      for (const item of news) {
        if (this.isSignificantNews(item)) {
          moves.push({
            competitor,
            type: this.classifyNews(item),
            details: item,
            impact: 'MEDIUM',
            detectedAt: new Date(),
          });
        }
      }
    }

    // Categorize moves
    const critical = moves.filter((m) => m.impact === 'HIGH');
    const notable = moves.filter((m) => m.impact !== 'HIGH');

    // Alert on critical moves
    for (const move of critical) {
      await this.alertCompetitiveMove(move);
    }

    // Identify opportunities from competitor weaknesses
    opportunities.push(...this.findCompetitiveOpportunities(moves));

    const report: CompetitiveReport = {
      period: new Date().toISOString().slice(0, 10),
      analyzedAt: new Date(),
      competitors: this.config.competitors,
      critical,
      notable,
      opportunities,
    };

    this.logger.log(
      `✅ Competitive tracking complete: ${critical.length} critical, ${notable.length} notable moves`,
    );

    return report;
  }

  private assessMoveImpact(product: any): 'HIGH' | 'MEDIUM' | 'LOW' {
    // Assess based on category overlap and market size
    return 'MEDIUM'; // Simplified
  }

  private isSignificantNews(item: any): boolean {
    const keywords = ['partnership', 'acquisition', 'launch', 'exclusive', 'funding'];
    return keywords.some((k) => item.title?.toLowerCase().includes(k));
  }

  private classifyNews(item: any): CompetitorMove['type'] {
    const title = item.title?.toLowerCase() || '';
    if (title.includes('acquisition')) return 'ACQUISITION';
    if (title.includes('partnership')) return 'PARTNERSHIP';
    if (title.includes('campaign')) return 'CAMPAIGN';
    return 'NEW_PRODUCT';
  }

  private findCompetitiveOpportunities(moves: CompetitorMove[]): CompetitiveOpportunity[] {
    // Look for competitor weaknesses mentioned in reviews/news
    return []; // Simplified
  }

  private async alertCompetitiveMove(move: CompetitorMove): Promise<void> {
    this.logger.warn(
      `🚨 COMPETITIVE ALERT: ${move.competitor} - ${move.type}`,
    );
    // TODO: Send notification via event bus
  }

  // ==================== 5. PATENT & REGULATION WATCH ====================

  /**
   * Monitor regulations
   * KPI: regulation-compliance-lead >12 months
   */
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async monitorRegulations(): Promise<RegulationAlert[]> {
    this.logger.log('📜 Monitoring regulations');

    const newRegulations = await this.regulationMonitor.getNew({
      sources: this.config.sources.regulation,
      keywords: ['vehicle', 'automotive', 'battery', 'safety', 'emissions', 'parts'],
    });

    const alerts: RegulationAlert[] = [];

    for (const reg of newRegulations) {
      const impact = await this.assessRegulationImpact(reg);

      if (impact.relevant) {
        const compliancePlan = await this.generateCompliancePlan(reg, impact);

        alerts.push({
          id: `reg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          regulation: reg,
          impact,
          compliancePlan,
        });

        // Notify IA-Legal
        await this.notifyLegal(reg, impact);
      }
    }

    if (alerts.length > 0) {
      this.logger.log(`📋 ${alerts.length} relevant regulation(s) detected`);
    }

    return alerts;
  }

  private async assessRegulationImpact(reg: RegulationInfo): Promise<RegulationImpact> {
    // Analyze regulation scope vs our catalog
    const keywords = reg.title.toLowerCase() + ' ' + reg.scope.toLowerCase();
    
    const relevant = [
      'vehicle', 'automotive', 'spare parts', 'battery', 'electric',
    ].some((k) => keywords.includes(k));

    if (!relevant) {
      return {
        relevant: false,
        productsAffected: 0,
        categories: [],
        riskLevel: 'NONE',
        description: 'Non applicable à notre activité',
      };
    }

    // Simplified impact assessment
    return {
      relevant: true,
      productsAffected: 100, // Mock
      categories: ['EV Components', 'Batteries'],
      riskLevel: 'MEDIUM',
      description: 'Impact potentiel sur les pièces EV',
    };
  }

  private async generateCompliancePlan(
    reg: RegulationInfo,
    impact: RegulationImpact,
  ): Promise<CompliancePlan> {
    const monthsToEffective = Math.floor(
      (reg.effectiveDate.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000),
    );

    if (!impact.relevant || impact.riskLevel === 'NONE') {
      return {
        status: 'NOT_APPLICABLE',
        actions: [],
        nextReview: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      };
    }

    return {
      status: monthsToEffective > 12 ? 'MONITORING' : 'ACTION_REQUIRED',
      actions: [
        {
          action: 'Analyse détaillée des exigences',
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          owner: 'IA-RD + IA-Legal',
          status: 'PENDING',
        },
        {
          action: 'Évaluation conformité catalogue',
          deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          owner: 'IA-Merch',
          status: 'PENDING',
        },
      ],
      nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  private async notifyLegal(reg: RegulationInfo, impact: RegulationImpact): Promise<void> {
    this.logger.log(`📤 Notifying IA-Legal: ${reg.reference}`);
    // TODO: Send to IA-Legal via event bus
  }

  // ==================== FORMATTERS ====================

  /**
   * Format EV Opportunity Report for display
   */
  formatEVOpportunityReport(report: EVOpportunityReport): string {
    const lines = [
      `🔋 EV PARTS OPPORTUNITY REPORT - ${report.period}`,
      '',
      'Market Context:',
      `├─ EV share (BEV+PHEV): ${(report.parkData.breakdown.BEV.share + report.parkData.breakdown.PHEV.share).toFixed(1)}%`,
      `├─ YoY Growth BEV: +${report.parkData.breakdown.BEV.yoyGrowth}%`,
      `└─ Total Addressable Market: €${(report.totalAddressableMarket / 1000000).toFixed(1)}M`,
      '',
      '🎯 TOP OPPORTUNITIES:',
    ];

    for (let i = 0; i < Math.min(5, report.opportunities.length); i++) {
      const opp = report.opportunities[i];
      const emoji =
        opp.recommendation === 'PRIORITY_HIGH' ? '⭐' : '📌';
      lines.push(
        `${i + 1}. ${opp.category} ${emoji}`,
        `   ├─ Market size: €${(opp.marketSize / 1000000).toFixed(1)}M/year`,
        `   ├─ Current coverage: ${opp.currentCoverage}%`,
        `   ├─ Margin potential: ${(opp.marginPotential * 100).toFixed(0)}%`,
        `   └─ Score: ${opp.score.toFixed(1)}/10`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Format Disruption Alert for display
   */
  formatDisruptionAlert(alert: DisruptionAlert): string {
    return [
      `🚨 TECH DISRUPTION ALERT - Score: ${alert.impactScore}/10`,
      '',
      `Source: ${alert.source}`,
      `Title: ${alert.title}`,
      '',
      'Impact Analysis:',
      `├─ Catalog exposure: ${alert.catalogExposure}%`,
      `├─ Timeline: ${alert.timeline}`,
      `├─ Brands affected: ${alert.affectedBrands.join(', ') || 'N/A'}`,
      `└─ Categories: ${alert.affectedCategories.join(', ') || 'N/A'}`,
      '',
      'Recommended Actions:',
      ...alert.recommendedActions.map(
        (a) => `${a.priority === 'IMMEDIATE' ? '🔴' : '🟡'} ${a.action} → ${a.owner}`,
      ),
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
        lastTechRadar: this.techRadarCache?.generatedAt || null,
        techCoverage: this.techRadarCache?.technologies.length || 0,
        monitoredCompetitors: this.config.competitors.length,
      },
    };
  }
}
