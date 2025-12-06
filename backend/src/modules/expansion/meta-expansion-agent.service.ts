/**
 * Meta-Expansion Agent Service - AI-COS v2.29.0
 * 
 * Expansion Squad : Marketing Global + Legal + Partenariats
 * Budget: €52K | ROI: +35% CA international, 0 litige
 * 
 * 15 Agents répartis en 3 piliers:
 * - Marketing Global (5): IA-CMO, International Marketer, Localization Engine, Currency Manager, Market Entry Analyzer
 * - Legal (5): IA-Legal, Compliance Bot, Contract AI, IP Monitor, RGPD Auditor
 * - Partnerships (5): IA-Partners, Alliance Manager, M&A Scout, Franchise Bot, Channel Manager
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ExpansionPillar = 'MARKETING_GLOBAL' | 'LEGAL' | 'PARTNERSHIPS';
export type MarketTier = 'TIER_1' | 'TIER_2' | 'TIER_3';
export type MarketStatus = 'ACTIVE' | 'PLANNED' | 'EVALUATION' | 'ON_HOLD';

export interface Market {
  country: string;
  countryCode: string;
  status: MarketStatus;
  tier: MarketTier;
  languages: string[];
  currency: string;
  legalEntityRequired: boolean;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  rgpdCompliant: boolean;
  vatRate: number;
  warrantyYears: number;
  returnDays: number;
}

export interface MarketEntryAnalysis {
  analysisId: string;
  market: Market;
  tam: number;  // Total Addressable Market
  sam: number;  // Serviceable Addressable Market
  som: number;  // Serviceable Obtainable Market
  competitorCount: number;
  entryBarriers: string[];
  requiredInvestment: number;
  expectedROI: number;
  timeToBreakeven: number; // months
  riskScore: number; // 0-100
  recommendation: 'GO' | 'CONDITIONAL' | 'NO_GO';
  createdAt: Date;
}

export interface LocalizationTask {
  taskId: string;
  contentType: 'PRODUCT_CATALOG' | 'MARKETING' | 'LEGAL' | 'SUPPORT';
  sourceLanguage: string;
  targetLanguage: string;
  stringCount: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED';
  qualityScore?: number;
  tmLeverage: number; // % from Translation Memory
  assignedTo?: string;
  dueDate: Date;
  completedAt?: Date;
}

export interface ComplianceStatus {
  country: string;
  rgpdStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';
  vatRegistered: boolean;
  termsLocalised: boolean;
  privacyLocalised: boolean;
  trademarkRegistered: boolean;
  lastAuditDate: Date;
  nextAuditDate: Date;
  issues: ComplianceIssue[];
}

export interface ComplianceIssue {
  issueId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'RGPD' | 'TAX' | 'CONSUMER' | 'IP' | 'OTHER';
  description: string;
  remediation: string;
  deadline: Date;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
}

export interface Partnership {
  partnerId: string;
  name: string;
  type: 'STRATEGIC' | 'DISTRIBUTION' | 'FRANCHISE' | 'AFFILIATE' | 'SUPPLIER';
  country: string;
  status: 'PROSPECT' | 'NEGOTIATION' | 'ACTIVE' | 'ON_HOLD' | 'TERMINATED';
  startDate?: Date;
  contractEndDate?: Date;
  revenueShare?: number;
  roi: number;
  performanceScore: number; // 0-100
}

export interface IPViolation {
  violationId: string;
  type: 'COUNTERFEIT' | 'TRADEMARK' | 'COPYRIGHT' | 'PATENT';
  platform: string;
  country: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'DETECTED' | 'INVESTIGATING' | 'ACTION_TAKEN' | 'RESOLVED';
  detectedAt: Date;
  resolvedAt?: Date;
  actionTaken?: string;
}

export interface ExpansionMetrics {
  // Revenue
  internationalRevenueShare: number; // Target >25%
  revenueByCountry: Record<string, number>;
  
  // Market Entry
  marketEntrySuccessRate: number; // Target >80%
  activeMarkets: number;
  marketsInPipeline: number;
  
  // Localization
  localizationQualityScore: number; // Target >95%
  tmLeverageAvg: number;
  pendingStrings: number;
  
  // Legal
  legalComplianceScore: number; // Target 100%
  openIssues: number;
  activeContracts: number;
  ipViolationsDetected: number;
  contractReviewTime: number; // hours, Target <24h
  
  // Partnerships
  partnershipROI: number; // Target >3x
  activePartnerships: number;
  franchiseRevenueGrowth: number; // Target >20%
  
  // Currency
  fxMarginLoss: number; // Target <2%
}

// ============================================================================
// META-EXPANSION AGENT SERVICE
// ============================================================================

@Injectable()
export class MetaExpansionAgentService implements OnModuleInit {
  private readonly logger = new Logger('Meta-Expansion');
  
  // Markets configuration
  private markets: Map<string, Market> = new Map();
  
  // Localization tasks
  private localizationTasks: Map<string, LocalizationTask> = new Map();
  
  // Compliance status by country
  private complianceStatus: Map<string, ComplianceStatus> = new Map();
  
  // Partnerships
  private partnerships: Map<string, Partnership> = new Map();
  
  // IP Violations
  private ipViolations: Map<string, IPViolation> = new Map();
  
  // Market analyses
  private marketAnalyses: Map<string, MarketEntryAnalysis> = new Map();
  
  // Current metrics
  private metrics: ExpansionMetrics;

  // Managed agents by pillar
  private readonly marketingGlobalAgents = [
    'IA-CMO', 'International Marketer', 'Localization Engine', 'Currency Manager', 'Market Entry Analyzer'
  ];
  private readonly legalAgents = [
    'IA-Legal', 'Compliance Bot', 'Contract AI', 'IP Monitor', 'RGPD Auditor'
  ];
  private readonly partnershipAgents = [
    'IA-Partners', 'Alliance Manager', 'M&A Scout', 'Franchise Bot', 'Channel Manager'
  ];

  constructor(
    private readonly eventEmitter: EventEmitter2
  ) {
    this.initializeMarkets();
    this.initializeMetrics();
  }

  async onModuleInit() {
    this.logger.log('Meta-Expansion Agent initialized');
    this.setupEventListeners();
  }

  // -------------------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------------------

  private initializeMarkets(): void {
    // Tier 1 - Priority Markets
    this.markets.set('DE', {
      country: 'Germany',
      countryCode: 'DE',
      status: 'ACTIVE',
      tier: 'TIER_1',
      languages: ['de'],
      currency: 'EUR',
      legalEntityRequired: true,
      complexity: 'MEDIUM',
      rgpdCompliant: true,
      vatRate: 19,
      warrantyYears: 2,
      returnDays: 14
    });

    this.markets.set('ES', {
      country: 'Spain',
      countryCode: 'ES',
      status: 'ACTIVE',
      tier: 'TIER_1',
      languages: ['es'],
      currency: 'EUR',
      legalEntityRequired: false,
      complexity: 'LOW',
      rgpdCompliant: true,
      vatRate: 21,
      warrantyYears: 3,
      returnDays: 14
    });

    this.markets.set('IT', {
      country: 'Italy',
      countryCode: 'IT',
      status: 'PLANNED',
      tier: 'TIER_1',
      languages: ['it'],
      currency: 'EUR',
      legalEntityRequired: false,
      complexity: 'LOW',
      rgpdCompliant: true,
      vatRate: 22,
      warrantyYears: 2,
      returnDays: 14
    });

    // Tier 2 - Expansion Markets
    this.markets.set('BE', {
      country: 'Belgium',
      countryCode: 'BE',
      status: 'PLANNED',
      tier: 'TIER_2',
      languages: ['fr', 'nl', 'de'],
      currency: 'EUR',
      legalEntityRequired: false,
      complexity: 'MEDIUM',
      rgpdCompliant: true,
      vatRate: 21,
      warrantyYears: 2,
      returnDays: 14
    });

    this.markets.set('CH', {
      country: 'Switzerland',
      countryCode: 'CH',
      status: 'PLANNED',
      tier: 'TIER_2',
      languages: ['fr', 'de', 'it'],
      currency: 'CHF',
      legalEntityRequired: true,
      complexity: 'HIGH',
      rgpdCompliant: false, // CH-DSG specific
      vatRate: 8.1,
      warrantyYears: 2,
      returnDays: 14
    });

    this.markets.set('GB', {
      country: 'United Kingdom',
      countryCode: 'GB',
      status: 'PLANNED',
      tier: 'TIER_2',
      languages: ['en'],
      currency: 'GBP',
      legalEntityRequired: true,
      complexity: 'HIGH', // Post-Brexit
      rgpdCompliant: false, // UK-GDPR specific
      vatRate: 20,
      warrantyYears: 6,
      returnDays: 14
    });

    // Tier 3 - Future Markets
    this.markets.set('PL', {
      country: 'Poland',
      countryCode: 'PL',
      status: 'EVALUATION',
      tier: 'TIER_3',
      languages: ['pl'],
      currency: 'PLN',
      legalEntityRequired: false,
      complexity: 'MEDIUM',
      rgpdCompliant: true,
      vatRate: 23,
      warrantyYears: 2,
      returnDays: 14
    });
  }

  private initializeMetrics(): void {
    this.metrics = {
      internationalRevenueShare: 0,
      revenueByCountry: {},
      marketEntrySuccessRate: 0,
      activeMarkets: 0,
      marketsInPipeline: 0,
      localizationQualityScore: 0,
      tmLeverageAvg: 0,
      pendingStrings: 0,
      legalComplianceScore: 100,
      openIssues: 0,
      activeContracts: 0,
      ipViolationsDetected: 0,
      contractReviewTime: 0,
      partnershipROI: 0,
      activePartnerships: 0,
      franchiseRevenueGrowth: 0,
      fxMarginLoss: 0
    };
  }

  private setupEventListeners(): void {
    this.eventEmitter.on('expansion.market.entry', (market: any) => {
      this.handleMarketEntryRequest(market);
    });

    this.eventEmitter.on('expansion.localization', (task: any) => {
      this.handleLocalizationRequest(task);
    });

    this.eventEmitter.on('expansion.compliance.alert', (alert: any) => {
      this.handleComplianceAlert(alert);
    });

    this.eventEmitter.on('expansion.ip.violation', (violation: any) => {
      this.handleIPViolation(violation);
    });

    this.eventEmitter.on('meta.EXPANSION', (event: any) => {
      this.handleMetaEvent(event);
    });

    this.logger.log('Event listeners configured');
  }

  // -------------------------------------------------------------------------
  // SAGA WORKFLOWS
  // -------------------------------------------------------------------------

  /**
   * SAGA: Market Entry Analysis
   * Trigger: Demande d'évaluation nouveau marché
   */
  async executeSaga_MarketEntryAnalysis(countryCode: string): Promise<MarketEntryAnalysis> {
    this.logger.log(`SAGA: Market Entry Analysis for ${countryCode}`);

    const market = this.markets.get(countryCode);
    if (!market) {
      throw new Error(`Unknown market: ${countryCode}`);
    }

    // Step 1: Market Entry Analyzer → TAM/SAM/SOM estimation
    const marketSize = await this.executeAgent('Market Entry Analyzer', 'estimateMarketSize', { countryCode });
    
    // Step 2: Compliance Bot → Check réglementations pays
    const regulations = await this.executeAgent('Compliance Bot', 'checkRegulations', { countryCode });
    
    // Step 3: IA-Legal → Structure juridique requise
    const legalStructure = await this.executeAgent('IA-Legal', 'analyzeLegalRequirements', { 
      countryCode, 
      entityRequired: market.legalEntityRequired 
    });
    
    // Step 4: Currency Manager → Analyse devise, fiscalité
    const currencyAnalysis = await this.executeAgent('Currency Manager', 'analyzeCurrency', {
      currency: market.currency,
      vatRate: market.vatRate
    });
    
    // Step 5: Localization Engine → Effort adaptation contenu
    const localizationEffort = await this.executeAgent('Localization Engine', 'estimateEffort', {
      languages: market.languages
    });
    
    // Step 6: Alliance Manager → Partenaires locaux potentiels
    const potentialPartners = await this.executeAgent('Alliance Manager', 'findLocalPartners', { countryCode });
    
    // Step 7: IA-CMO → Budget marketing entrée
    const marketingBudget = await this.executeAgent('IA-CMO', 'estimateEntryBudget', {
      countryCode,
      complexity: market.complexity
    });

    // Consolidate analysis
    const analysis: MarketEntryAnalysis = {
      analysisId: `mea_${countryCode}_${Date.now()}`,
      market,
      tam: marketSize.tam || 50000000,
      sam: marketSize.sam || 15000000,
      som: marketSize.som || 3000000,
      competitorCount: marketSize.competitors || 10,
      entryBarriers: [...(regulations.barriers || []), ...(legalStructure.barriers || [])],
      requiredInvestment: (legalStructure.cost || 0) + (localizationEffort.cost || 0) + (marketingBudget.budget || 0),
      expectedROI: 2.5,
      timeToBreakeven: market.complexity === 'HIGH' ? 24 : market.complexity === 'MEDIUM' ? 18 : 12,
      riskScore: this.calculateRiskScore(market, regulations),
      recommendation: this.determineRecommendation(market),
      createdAt: new Date()
    };

    this.marketAnalyses.set(analysis.analysisId, analysis);

    // Step 8: Business case consolidé → IA-CEO
    this.eventEmitter.emit('meta.BOARD', {
      eventType: 'REQUEST',
      payload: {
        type: 'MARKET_ENTRY_DECISION',
        analysis,
        requiredApproval: analysis.requiredInvestment > 50000 ? 'CEO' : 'CFO'
      }
    });

    this.logger.log(`SAGA completed: Market Entry Analysis for ${countryCode} - ${analysis.recommendation}`);
    return analysis;
  }

  /**
   * SAGA: International Campaign Launch
   * Trigger: Lancement campagne multi-pays
   */
  async executeSaga_InternationalCampaign(campaign: {
    name: string;
    countries: string[];
    budget: number;
    content: any;
  }): Promise<void> {
    this.logger.log(`SAGA: International Campaign Launch - ${campaign.name}`);

    // Step 1: IA-CMO → Brief campagne globale
    const brief = await this.executeAgent('IA-CMO', 'createCampaignBrief', {
      name: campaign.name,
      budget: campaign.budget,
      countries: campaign.countries
    });

    // Step 2: Localization Engine → Adaptation par marché
    for (const countryCode of campaign.countries) {
      const market = this.markets.get(countryCode);
      if (!market) continue;

      for (const language of market.languages) {
        // Create localization task
        const task: LocalizationTask = {
          taskId: `loc_${campaign.name}_${language}_${Date.now()}`,
          contentType: 'MARKETING',
          sourceLanguage: 'fr',
          targetLanguage: language,
          stringCount: 50, // Estimate
          status: 'PENDING',
          tmLeverage: 0,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        };
        
        this.localizationTasks.set(task.taskId, task);
        
        await this.executeAgent('Localization Engine', 'localizeContent', {
          task,
          content: campaign.content,
          culturalAdaptation: true
        });
      }
    }

    // Step 3: Compliance Bot → Vérification légale par pays
    for (const countryCode of campaign.countries) {
      await this.executeAgent('Compliance Bot', 'validateCampaign', {
        countryCode,
        campaignContent: campaign.content
      });
    }

    // Step 4: International Marketer → Setup campagnes locales
    await this.executeAgent('International Marketer', 'setupLocalCampaigns', {
      campaign,
      brief
    });

    // Step 5: Currency Manager → Pricing local optimisé
    for (const countryCode of campaign.countries) {
      const market = this.markets.get(countryCode);
      if (!market) continue;

      await this.executeAgent('Currency Manager', 'optimizeLocalPricing', {
        countryCode,
        currency: market.currency,
        vatRate: market.vatRate
      });
    }

    // Step 6: Meta-Marketing → Coordination SEA/Social/SEO
    this.eventEmitter.emit('meta.MARKETING', {
      eventType: 'REQUEST',
      payload: {
        type: 'COORDINATE_INTERNATIONAL_CAMPAIGN',
        campaign,
        countries: campaign.countries
      }
    });

    this.logger.log(`SAGA completed: International Campaign ${campaign.name} launched in ${campaign.countries.length} countries`);
  }

  /**
   * SAGA: Legal Compliance Audit
   * Trigger: Trimestriel ou changement réglementaire
   */
  @Cron('0 9 1 */3 *') // First day of each quarter at 9am
  async executeSaga_LegalComplianceAudit(): Promise<void> {
    this.logger.log('SAGA: Legal Compliance Audit - Quarterly');

    const activeMarkets = Array.from(this.markets.values())
      .filter(m => m.status === 'ACTIVE');

    for (const market of activeMarkets) {
      // Step 1: Compliance Bot → Scan réglementations par pays
      const regulations = await this.executeAgent('Compliance Bot', 'scanRegulations', {
        countryCode: market.countryCode
      });

      // Step 2: RGPD Auditor → Audit protection données
      const dataProtectionAudit = await this.executeAgent('RGPD Auditor', 'auditDataProtection', {
        countryCode: market.countryCode,
        framework: market.rgpdCompliant ? 'RGPD' : market.countryCode === 'GB' ? 'UK-GDPR' : 'CH-DSG'
      });

      // Step 3: Contract AI → Review CGV/CGU par pays
      const termsReview = await this.executeAgent('Contract AI', 'reviewTerms', {
        countryCode: market.countryCode,
        language: market.languages[0]
      });

      // Step 4: IP Monitor → Vérification marques déposées
      const ipStatus = await this.executeAgent('IP Monitor', 'checkTrademarks', {
        countryCode: market.countryCode
      });

      // Update compliance status
      const status: ComplianceStatus = {
        country: market.country,
        rgpdStatus: dataProtectionAudit.compliant ? 'COMPLIANT' : 'PARTIAL',
        vatRegistered: true,
        termsLocalised: termsReview.localised,
        privacyLocalised: termsReview.privacyLocalised,
        trademarkRegistered: ipStatus.registered,
        lastAuditDate: new Date(),
        nextAuditDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // +90 days
        issues: []
      };

      // Collect issues
      if (!dataProtectionAudit.compliant) {
        status.issues.push({
          issueId: `issue_${Date.now()}`,
          severity: 'HIGH',
          category: 'RGPD',
          description: dataProtectionAudit.issue,
          remediation: dataProtectionAudit.remediation,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'OPEN'
        });
      }

      this.complianceStatus.set(market.countryCode, status);
    }

    // Step 5: IA-Legal → Consolidation findings
    const consolidatedReport = await this.executeAgent('IA-Legal', 'consolidateComplianceReport', {
      statuses: Array.from(this.complianceStatus.values())
    });

    // Step 6 & 7: Génération plan de remédiation & Rapport Board
    this.eventEmitter.emit('meta.BOARD', {
      eventType: 'NOTIFY',
      payload: {
        type: 'QUARTERLY_COMPLIANCE_REPORT',
        report: consolidatedReport,
        openIssues: this.countOpenIssues()
      }
    });

    this.logger.log('SAGA completed: Legal Compliance Audit');
  }

  /**
   * SAGA: Strategic Partnership
   * Trigger: Opportunité partenariat identifiée
   */
  async executeSaga_StrategicPartnership(opportunity: {
    partnerName: string;
    partnerCountry: string;
    type: Partnership['type'];
    proposedTerms: any;
  }): Promise<Partnership> {
    this.logger.log(`SAGA: Strategic Partnership with ${opportunity.partnerName}`);

    // Step 1: Alliance Manager → Qualification opportunité
    const qualification = await this.executeAgent('Alliance Manager', 'qualifyOpportunity', {
      partner: opportunity.partnerName,
      type: opportunity.type
    });

    if (!qualification.qualified) {
      this.logger.warn(`Partnership opportunity not qualified: ${qualification.reason}`);
      throw new Error(qualification.reason);
    }

    // Step 2: M&A Scout → Due diligence partenaire
    const dueDiligence = await this.executeAgent('M&A Scout', 'performDueDiligence', {
      partnerName: opportunity.partnerName,
      country: opportunity.partnerCountry
    });

    if (dueDiligence.riskLevel === 'HIGH') {
      this.logger.warn(`High risk partner: ${dueDiligence.risks.join(', ')}`);
    }

    // Step 3: IA-Legal → Framework juridique
    const legalFramework = await this.executeAgent('IA-Legal', 'prepareLegalFramework', {
      type: opportunity.type,
      country: opportunity.partnerCountry
    });

    // Step 4: Contract AI → Draft contrat partenariat
    const contractDraft = await this.executeAgent('Contract AI', 'draftPartnershipContract', {
      partner: opportunity.partnerName,
      type: opportunity.type,
      terms: opportunity.proposedTerms,
      legalFramework
    });

    // Step 5: IA-CFO → Modèle économique, partage revenus
    const financialModel = await this.executeAgent('IA-CFO', 'modelPartnershipEconomics', {
      type: opportunity.type,
      terms: opportunity.proposedTerms
    });

    // Step 6: IA-CEO → Validation stratégique
    const ceoApproval = await this.requestBoardApproval({
      type: 'PARTNERSHIP',
      partner: opportunity.partnerName,
      investment: financialModel.requiredInvestment,
      expectedROI: financialModel.expectedROI
    });

    if (!ceoApproval.approved) {
      throw new Error(`Partnership not approved: ${ceoApproval.reason}`);
    }

    // Create partnership record
    const partnership: Partnership = {
      partnerId: `partner_${Date.now()}`,
      name: opportunity.partnerName,
      type: opportunity.type,
      country: opportunity.partnerCountry,
      status: 'NEGOTIATION',
      revenueShare: opportunity.proposedTerms.revenueShare,
      roi: financialModel.expectedROI,
      performanceScore: 0
    };

    this.partnerships.set(partnership.partnerId, partnership);

    // Step 7: Channel Manager → Intégration distribution
    if (opportunity.type === 'DISTRIBUTION' || opportunity.type === 'FRANCHISE') {
      await this.executeAgent('Channel Manager', 'prepareIntegration', {
        partnerId: partnership.partnerId,
        type: opportunity.type
      });
    }

    this.logger.log(`SAGA completed: Partnership ${partnership.partnerId} created with ${opportunity.partnerName}`);
    return partnership;
  }

  /**
   * SAGA: Franchise Expansion
   * Trigger: Demande franchise ou licence
   */
  async executeSaga_FranchiseExpansion(franchise: {
    candidateName: string;
    country: string;
    territory: string;
  }): Promise<void> {
    this.logger.log(`SAGA: Franchise Expansion - ${franchise.candidateName}`);

    // Step 1: Franchise Bot → Qualification candidat
    const qualification = await this.executeAgent('Franchise Bot', 'qualifyCandidate', franchise);

    if (!qualification.qualified) {
      throw new Error(`Candidate not qualified: ${qualification.reason}`);
    }

    // Step 2: M&A Scout → Due diligence franchisé
    const dueDiligence = await this.executeAgent('M&A Scout', 'franchiseeDueDiligence', {
      candidateName: franchise.candidateName,
      country: franchise.country
    });

    // Step 3: Compliance Bot → Réglementation franchise locale
    const franchiseRegulations = await this.executeAgent('Compliance Bot', 'checkFranchiseRegulations', {
      country: franchise.country
    });

    // Step 4: IA-Legal → Contrat franchise type
    const franchiseContract = await this.executeAgent('IA-Legal', 'prepareFranchiseContract', {
      country: franchise.country,
      territory: franchise.territory,
      regulations: franchiseRegulations
    });

    // Step 5: Currency Manager → Modèle redevances
    const market = this.markets.get(franchise.country);
    const royaltyModel = await this.executeAgent('Currency Manager', 'modelRoyalties', {
      currency: market?.currency || 'EUR',
      territory: franchise.territory
    });

    // Step 6: International Marketer → Kit marketing local
    await this.executeAgent('International Marketer', 'createFranchiseKit', {
      territory: franchise.territory,
      country: franchise.country
    });

    // Step 7: Localization Engine → Adaptation branding
    await this.executeAgent('Localization Engine', 'adaptBranding', {
      country: franchise.country,
      languages: market?.languages || ['en']
    });

    // Step 8: IA-CFO → Projections financières
    this.eventEmitter.emit('meta.BOARD', {
      eventType: 'REQUEST',
      payload: {
        type: 'FRANCHISE_APPROVAL',
        candidate: franchise.candidateName,
        territory: franchise.territory,
        projectedRevenue: royaltyModel.projectedAnnualRoyalties
      }
    });

    this.logger.log(`SAGA completed: Franchise expansion for ${franchise.candidateName}`);
  }

  /**
   * SAGA: IP Protection & Enforcement
   * Trigger: Détection contrefaçon ou violation marque
   */
  async executeSaga_IPProtection(violation: IPViolation): Promise<void> {
    this.logger.log(`SAGA: IP Protection - ${violation.type} on ${violation.platform}`);

    // Step 1: Already detected by IP Monitor
    this.ipViolations.set(violation.violationId, violation);

    // Step 2: Meta-Expansion → Évaluation gravité
    const severityAssessment = await this.assessViolationSeverity(violation);

    // Step 3: IA-Legal → Stratégie enforcement
    const enforcementStrategy = await this.executeAgent('IA-Legal', 'determineEnforcementStrategy', {
      violation,
      severity: severityAssessment
    });

    // Execute based on strategy
    switch (enforcementStrategy.action) {
      case 'CEASE_AND_DESIST':
        // Step 4: Contract AI → Lettre mise en demeure
        await this.executeAgent('Contract AI', 'generateCeaseAndDesist', {
          violation,
          deadline: 14 // days
        });
        break;

      case 'MARKETPLACE_REPORT':
        await this.executeAgent('IP Monitor', 'reportToMarketplace', {
          platform: violation.platform,
          violationId: violation.violationId
        });
        break;

      case 'LEGAL_ACTION':
        // Escalate to IA-Legal for legal proceedings
        this.eventEmitter.emit('meta.BOARD', {
          eventType: 'ESCALATE',
          payload: {
            type: 'IP_LEGAL_ACTION',
            violation,
            estimatedCost: enforcementStrategy.estimatedCost
          }
        });
        break;
    }

    // Step 5 & 6: Track and document
    violation.status = 'ACTION_TAKEN';
    violation.actionTaken = enforcementStrategy.action;
    this.ipViolations.set(violation.violationId, violation);

    this.logger.log(`SAGA completed: IP Protection action ${enforcementStrategy.action} taken`);
  }

  // -------------------------------------------------------------------------
  // IP MONITORING (Continuous)
  // -------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async scanForIPViolations(): Promise<void> {
    this.logger.log('Scanning for IP violations...');

    const violations = await this.executeAgent('IP Monitor', 'scanMarketplaces', {
      platforms: ['Amazon', 'eBay', 'AliExpress', 'Wish'],
      keywords: ['automecanik', 'auto mecanik', 'automecanic']
    });

    for (const v of violations.found || []) {
      const violation: IPViolation = {
        violationId: `ip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: v.type,
        platform: v.platform,
        country: v.country,
        severity: v.severity,
        status: 'DETECTED',
        detectedAt: new Date()
      };

      // Trigger IP Protection SAGA for HIGH severity
      if (violation.severity === 'HIGH') {
        await this.executeSaga_IPProtection(violation);
      } else {
        this.ipViolations.set(violation.violationId, violation);
      }
    }

    this.metrics.ipViolationsDetected = this.ipViolations.size;
  }

  // -------------------------------------------------------------------------
  // HELPER METHODS
  // -------------------------------------------------------------------------

  private async executeAgent(agentName: string, action: string, params: any): Promise<any> {
    this.logger.debug(`Executing ${agentName}.${action}()`);
    await this.simulateAgentDelay();
    return { success: true, agent: agentName, action, result: {} };
  }

  private async simulateAgentDelay(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private calculateRiskScore(market: Market, regulations: any): number {
    let score = 0;
    
    if (market.complexity === 'HIGH') score += 30;
    else if (market.complexity === 'MEDIUM') score += 15;
    
    if (market.legalEntityRequired) score += 20;
    if (!market.rgpdCompliant) score += 15;
    if (market.currency !== 'EUR') score += 10;
    
    return Math.min(100, score);
  }

  private determineRecommendation(market: Market): 'GO' | 'CONDITIONAL' | 'NO_GO' {
    if (market.complexity === 'LOW') return 'GO';
    if (market.complexity === 'MEDIUM') return 'CONDITIONAL';
    return 'CONDITIONAL';
  }

  private countOpenIssues(): number {
    let count = 0;
    for (const status of this.complianceStatus.values()) {
      count += status.issues.filter(i => i.status === 'OPEN').length;
    }
    return count;
  }

  private async assessViolationSeverity(violation: IPViolation): Promise<any> {
    return {
      severity: violation.severity,
      estimatedDamage: violation.severity === 'HIGH' ? 10000 : 1000,
      urgency: violation.severity === 'HIGH' ? 'IMMEDIATE' : 'STANDARD'
    };
  }

  private async requestBoardApproval(request: any): Promise<{ approved: boolean; reason?: string }> {
    // In production, would wait for actual approval
    return { approved: true };
  }

  // -------------------------------------------------------------------------
  // EVENT HANDLING
  // -------------------------------------------------------------------------

  private handleMarketEntryRequest(market: any): void {
    this.executeSaga_MarketEntryAnalysis(market.countryCode);
  }

  private handleLocalizationRequest(task: any): void {
    this.logger.log(`Localization request: ${task.contentType} to ${task.targetLanguage}`);
  }

  private handleComplianceAlert(alert: any): void {
    this.logger.warn(`Compliance alert: ${alert.description}`);
  }

  private handleIPViolation(violation: any): void {
    const ipViolation: IPViolation = {
      violationId: `ip_${Date.now()}`,
      type: violation.type,
      platform: violation.platform,
      country: violation.country,
      severity: violation.severity,
      status: 'DETECTED',
      detectedAt: new Date()
    };
    this.executeSaga_IPProtection(ipViolation);
  }

  private handleMetaEvent(event: any): void {
    switch (event.payload?.type) {
      case 'MARKET_ENTRY_REQUEST':
        this.executeSaga_MarketEntryAnalysis(event.payload.countryCode);
        break;
      case 'INTERNATIONAL_CAMPAIGN':
        this.executeSaga_InternationalCampaign(event.payload.campaign);
        break;
      case 'PARTNERSHIP_OPPORTUNITY':
        this.executeSaga_StrategicPartnership(event.payload);
        break;
    }
  }

  // -------------------------------------------------------------------------
  // PUBLIC API
  // -------------------------------------------------------------------------

  getMarkets(): Market[] {
    return Array.from(this.markets.values());
  }

  getMarketsByTier(tier: MarketTier): Market[] {
    return Array.from(this.markets.values()).filter(m => m.tier === tier);
  }

  getActiveMarkets(): Market[] {
    return Array.from(this.markets.values()).filter(m => m.status === 'ACTIVE');
  }

  getComplianceStatus(countryCode: string): ComplianceStatus | undefined {
    return this.complianceStatus.get(countryCode);
  }

  getAllComplianceStatuses(): ComplianceStatus[] {
    return Array.from(this.complianceStatus.values());
  }

  getPartnerships(): Partnership[] {
    return Array.from(this.partnerships.values());
  }

  getActivePartnerships(): Partnership[] {
    return Array.from(this.partnerships.values()).filter(p => p.status === 'ACTIVE');
  }

  getIPViolations(): IPViolation[] {
    return Array.from(this.ipViolations.values());
  }

  getMetrics(): ExpansionMetrics {
    // Update computed metrics
    this.metrics.activeMarkets = this.getActiveMarkets().length;
    this.metrics.marketsInPipeline = Array.from(this.markets.values())
      .filter(m => m.status === 'PLANNED' || m.status === 'EVALUATION').length;
    this.metrics.activePartnerships = this.getActivePartnerships().length;
    this.metrics.openIssues = this.countOpenIssues();
    
    return { ...this.metrics };
  }

  getManagedAgents(): { marketing: string[]; legal: string[]; partnerships: string[] } {
    return {
      marketing: [...this.marketingGlobalAgents],
      legal: [...this.legalAgents],
      partnerships: [...this.partnershipAgents]
    };
  }

  getDashboardData(): {
    revenue: { total: number; byCountry: Record<string, { share: number; amount: number }> };
    legal: { compliance: number; openIssues: number; ipAlerts: number; contracts: number };
    partnerships: { active: number; pipeline: number; avgROI: number; franchises: number };
    localization: { languages: number; quality: number; tmLeverage: number; pending: number };
    marketEntry: { inProgress: string[]; pipeline: string[]; successRate: number };
  } {
    const activeMarkets = this.getActiveMarkets();
    const plannedMarkets = Array.from(this.markets.values())
      .filter(m => m.status === 'PLANNED');

    return {
      revenue: {
        total: 3225000, // Example
        byCountry: {
          FR: { share: 65, amount: 2100000 },
          DE: { share: 18, amount: 580000 },
          ES: { share: 10, amount: 320000 },
          IT: { share: 7, amount: 225000 }
        }
      },
      legal: {
        compliance: this.metrics.legalComplianceScore,
        openIssues: this.countOpenIssues(),
        ipAlerts: Array.from(this.ipViolations.values())
          .filter(v => v.status !== 'RESOLVED').length,
        contracts: this.metrics.activeContracts
      },
      partnerships: {
        active: this.getActivePartnerships().length,
        pipeline: Array.from(this.partnerships.values())
          .filter(p => p.status === 'PROSPECT' || p.status === 'NEGOTIATION').length,
        avgROI: this.metrics.partnershipROI,
        franchises: Array.from(this.partnerships.values())
          .filter(p => p.type === 'FRANCHISE' && p.status === 'ACTIVE').length
      },
      localization: {
        languages: new Set(activeMarkets.flatMap(m => m.languages)).size,
        quality: this.metrics.localizationQualityScore,
        tmLeverage: this.metrics.tmLeverageAvg,
        pending: this.metrics.pendingStrings
      },
      marketEntry: {
        inProgress: plannedMarkets.slice(0, 2).map(m => m.countryCode),
        pipeline: plannedMarkets.slice(2).map(m => m.countryCode),
        successRate: this.metrics.marketEntrySuccessRate
      }
    };
  }

  /**
   * Trigger market entry analysis
   */
  async analyzeMarket(countryCode: string): Promise<MarketEntryAnalysis> {
    return this.executeSaga_MarketEntryAnalysis(countryCode);
  }

  /**
   * Launch international campaign
   */
  async launchCampaign(campaign: {
    name: string;
    countries: string[];
    budget: number;
    content: any;
  }): Promise<void> {
    await this.executeSaga_InternationalCampaign(campaign);
  }

  /**
   * Initiate partnership
   */
  async initiatePartnership(opportunity: {
    partnerName: string;
    partnerCountry: string;
    type: Partnership['type'];
    proposedTerms: any;
  }): Promise<Partnership> {
    return this.executeSaga_StrategicPartnership(opportunity);
  }
}
