import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * IA-HR - Agent RH IA (v2.22.0)
 *
 * Board Member - People & Culture
 * Budget: €42K (Dev €32K + SIRH APIs €10K)
 * ROI: +€95K/an (turnover -40% + productivité formation +15% + coûts recrutement -30%)
 *
 * 5 Responsabilités:
 * 1. Employee Satisfaction Monitor - eNPS, pulse surveys, signaux faibles
 * 2. Talent Acquisition Pipeline - Sourcing, ATS, assessment
 * 3. Training & Development Manager - Skills gap, formation, ROI
 * 4. Contract & Admin Lifecycle - Contrats, alertes, conformité
 * 5. Workforce Planning - Turnover prédictif, succession, charge
 *
 * KPIs:
 * - employee-nps: >40
 * - time-to-hire: <30j
 * - training-completion: >85%
 * - contract-compliance: 100%
 * - workforce-stability: turnover <15%
 */

// ==================== INTERFACES ====================

export interface ENPSReport {
  surveyId: string;
  status: 'DEPLOYED' | 'COLLECTING' | 'ANALYZING' | 'COMPLETE';
  quarter?: string;
  participation?: {
    total: number;
    responded: number;
    rate: number;
  };
}

export interface ENPSAnalysis {
  surveyId: string;
  enps: number; // -100 to +100
  distribution: {
    promoters: number; // 9-10
    passives: number; // 7-8
    detractors: number; // 0-6
  };
  byTeam: TeamENPS[];
  sentiments: SentimentAnalysis;
  trends: {
    vsLastQuarter: number;
    vsLastYear: number;
  };
  actionPlan: ActionPlanItem[] | null;
}

export interface TeamENPS {
  teamId: string;
  teamName: string;
  enps: number;
  headcount: number;
  status: 'EXCELLENT' | 'GOOD' | 'ATTENTION' | 'CRITICAL';
}

export interface SentimentAnalysis {
  positive: ThemeCount[];
  negative: ThemeCount[];
  suggestions: string[];
}

export interface ThemeCount {
  theme: string;
  count: number;
  percentage: number;
}

export interface ActionPlanItem {
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  owner: string;
  deadline: Date;
  budget?: number;
}

export interface SkillsGapReport {
  analysisDate: Date;
  teamId?: string;
  gaps: SkillGap[];
  recommendations: TrainingRecommendation[];
  totalBudget: number;
  budgetStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface SkillGap {
  skillId: string;
  skill: string;
  category: string;
  requiredLevel: number; // 1-5
  currentAverage: number;
  gap: number; // Negative means below requirement
  peopleBelowThreshold: string[];
  critical: boolean;
  businessImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface TrainingRecommendation {
  skillId: string;
  skill: string;
  training: TrainingCourse;
  participants: string[];
  totalCost: number;
  estimatedROI: string;
  duration: number; // hours
}

export interface TrainingCourse {
  id: string;
  name: string;
  provider: string;
  format: 'ONLINE' | 'CLASSROOM' | 'HYBRID';
  duration: number; // hours
  cost: number; // per person
  rating: number;
  certificationIncluded: boolean;
}

export interface ContractAlerts {
  scanDate: Date;
  urgent: ContractAlert[];
  upcoming: ContractAlert[];
  compliance: ComplianceStatus;
}

export interface ContractAlert {
  type:
    | 'TRIAL_END'
    | 'CONTRACT_END'
    | 'MEDICAL_VISIT'
    | 'ANNUAL_REVIEW'
    | 'ANNIVERSARY'
    | 'CERTIFICATION_EXPIRY';
  employeeId: string;
  employeeName: string;
  managerId: string;
  managerName: string;
  deadline: Date;
  daysRemaining: number;
  actionRequired: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export interface ComplianceStatus {
  contracts: { compliant: number; total: number };
  medicalVisits: { compliant: number; total: number };
  rgpdConsent: { compliant: number; total: number };
  professionalInterviews: { compliant: number; total: number };
  overallScore: number; // 0-100
}

export interface TurnoverPrediction {
  employeeId: string;
  name: string;
  team: string;
  position: string;
  tenure: number; // months
  riskScore: number; // 0-100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  topFactors: TurnoverFactor[];
  recommendedActions: RetentionAction[];
  predictedTimeframe?: string; // "3-6 months"
}

export interface TurnoverFactor {
  factor: string;
  weight: number;
  currentValue: any;
  riskThreshold: any;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
}

export interface RetentionAction {
  action: string;
  type: 'COMPENSATION' | 'CAREER' | 'WORKLOAD' | 'RECOGNITION' | 'TRAINING';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedImpact: number; // % reduction in risk
  cost?: number;
}

export interface WorkforcePlan {
  horizon: '3M' | '1Y' | '3Y';
  currentHeadcount: number;
  plannedHeadcount: number;
  recruitmentNeeds: RecruitmentNeed[];
  retirementRisk: RetirementRisk[];
  successionPlan: SuccessionItem[];
  budgetForecast: BudgetForecast;
}

export interface RecruitmentNeed {
  role: string;
  team: string;
  reason: 'GROWTH' | 'REPLACEMENT' | 'NEW_SKILL';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  targetDate: Date;
  estimatedCost: number;
}

export interface RetirementRisk {
  employeeId: string;
  name: string;
  position: string;
  yearsToRetirement: number;
  criticalKnowledge: string[];
  successorReady: boolean;
}

export interface SuccessionItem {
  position: string;
  currentHolder: string;
  successors: {
    name: string;
    readiness: 'READY' | 'READY_1Y' | 'READY_2Y' | 'DEVELOPMENT';
    gapsToFill: string[];
  }[];
}

export interface BudgetForecast {
  salaryMass: { current: number; projected: number };
  recruitmentCosts: number;
  trainingBudget: number;
  totalHRBudget: number;
}

// Mock interfaces for external services
interface EmployeeSurveyService {
  deploy(config: any): Promise<{ id: string }>;
  getResponses(surveyId: string): Promise<any[]>;
  sendReminder(surveyId: string): Promise<void>;
}

interface SkillsMatrixService {
  getInventory(teamId?: string): Promise<any[]>;
  getRequirements(teamId?: string): Promise<any[]>;
  findTraining(skillName: string): Promise<TrainingCourse>;
  updateSkillLevel(employeeId: string, skillId: string, level: number): Promise<void>;
}

interface ContractLifecycleService {
  getUpcomingDeadlines(config: any): Promise<ContractAlerts>;
  getContract(employeeId: string): Promise<any>;
  generateDocument(type: string, employeeId: string): Promise<string>;
}

interface TalentAcquisitionService {
  createJobPosting(job: any): Promise<string>;
  screenCandidates(jobId: string): Promise<any[]>;
  scheduleInterview(candidateId: string, interviewers: string[]): Promise<void>;
}

interface HRAnalyticsService {
  getAllEmployees(): Promise<any[]>;
  analyzeSentiment(texts: string[]): Promise<SentimentAnalysis>;
  predictTurnover(signals: any): Promise<number>;
  getWorkloadMetrics(employeeId: string): Promise<any>;
}

interface NotificationService {
  send(notification: any): Promise<void>;
  sendBulk(notifications: any[]): Promise<void>;
}

// ==================== MAIN SERVICE ====================

@Injectable()
export class HRAgentService {
  private readonly logger = new Logger(HRAgentService.name);

  // External services (to be injected)
  private surveyService: EmployeeSurveyService;
  private skillsService: SkillsMatrixService;
  private contractService: ContractLifecycleService;
  private recruitmentService: TalentAcquisitionService;
  private analyticsService: HRAnalyticsService;
  private notificationService: NotificationService;

  // Configuration
  private readonly config = {
    enps: {
      surveyDuration: 7, // days
      reminderDays: [3, 6],
      thresholds: {
        excellent: 40,
        good: 20,
        attention: 0,
        critical: -20,
      },
    },
    skills: {
      criticalGapThreshold: -1.5,
      trainingBudgetApprovalThreshold: 2000, // €
    },
    contracts: {
      alertWindows: {
        trialEnd: [15, 7, 1],
        contractEnd: [60, 30, 15],
        medicalVisit: [30, 7],
        annualReview: [30],
        anniversary: [7],
      },
    },
    turnover: {
      highRiskThreshold: 70,
      mediumRiskThreshold: 40,
    },
    workforce: {
      retirementAlertYears: 5,
    },
  };

  // eNPS Questions (standard)
  private readonly enpsQuestions = [
    {
      id: 'nps',
      type: 'scale',
      text: 'Sur une échelle de 0 à 10, recommanderiez-vous notre entreprise comme lieu de travail ?',
      required: true,
    },
    {
      id: 'satisfaction',
      type: 'scale',
      text: 'Êtes-vous satisfait(e) de votre travail actuel ?',
      required: true,
    },
    {
      id: 'manager',
      type: 'scale',
      text: 'Comment évaluez-vous le soutien de votre manager ?',
      required: true,
    },
    {
      id: 'workload',
      type: 'scale',
      text: 'Comment évaluez-vous votre charge de travail ?',
      required: true,
    },
    {
      id: 'growth',
      type: 'scale',
      text: 'Avez-vous des opportunités de développement professionnel ?',
      required: true,
    },
    {
      id: 'positive',
      type: 'text',
      text: "Qu'est-ce qui fonctionne bien dans l'entreprise ?",
      required: false,
    },
    {
      id: 'improve',
      type: 'text',
      text: 'Que pourrions-nous améliorer ?',
      required: false,
    },
  ];

  constructor() {
    this.logger.log('IA-HR (Agent RH) initialized');
  }

  // ==================== 1. EMPLOYEE SATISFACTION MONITOR ====================

  /**
   * Deploy eNPS survey
   * KPI: employee-nps >40
   */
  async runENPSSurvey(quarter: string): Promise<ENPSReport> {
    this.logger.log(`📊 Deploying eNPS survey for ${quarter}`);

    const survey = await this.surveyService.deploy({
      type: 'ENPS',
      name: `eNPS Survey ${quarter}`,
      questions: this.enpsQuestions,
      duration: this.config.enps.surveyDuration,
      anonymous: true,
      reminders: this.config.enps.reminderDays,
    });

    return {
      surveyId: survey.id,
      status: 'DEPLOYED',
      quarter,
    };
  }

  /**
   * Analyze completed eNPS survey
   */
  async analyzeENPSSurvey(surveyId: string): Promise<ENPSAnalysis> {
    this.logger.log(`📈 Analyzing eNPS survey ${surveyId}`);

    const responses = await this.surveyService.getResponses(surveyId);

    if (responses.length === 0) {
      throw new Error('No responses to analyze');
    }

    // Calculate eNPS
    const npsScores = responses.map((r) => r.answers.nps);
    const promoters = npsScores.filter((s) => s >= 9).length;
    const detractors = npsScores.filter((s) => s <= 6).length;
    const passives = npsScores.length - promoters - detractors;

    const enps = Math.round(
      ((promoters - detractors) / npsScores.length) * 100,
    );

    // Sentiment analysis on text responses
    const textResponses = responses
      .flatMap((r) => [r.answers.positive, r.answers.improve])
      .filter(Boolean);
    const sentiments = await this.analyticsService.analyzeSentiment(textResponses);

    // Group by team
    const byTeam = await this.calculateTeamENPS(responses);

    // Generate action plan if needed
    let actionPlan: ActionPlanItem[] | null = null;
    if (enps < this.config.enps.thresholds.good) {
      actionPlan = await this.generateActionPlan(responses, sentiments, byTeam);
    }

    // Alert if critical
    if (enps < this.config.enps.thresholds.attention) {
      await this.escalateToCEO('ENPS_CRITICAL', {
        enps,
        surveyId,
        byTeam: byTeam.filter((t) => t.status === 'CRITICAL'),
      });
    }

    return {
      surveyId,
      enps,
      distribution: {
        promoters,
        passives,
        detractors,
      },
      byTeam,
      sentiments,
      trends: {
        vsLastQuarter: 0, // TODO: Calculate from historical data
        vsLastYear: 0,
      },
      actionPlan,
    };
  }

  /**
   * Calculate eNPS by team
   */
  private async calculateTeamENPS(responses: any[]): Promise<TeamENPS[]> {
    const teamMap = new Map<string, number[]>();

    for (const response of responses) {
      const teamId = response.teamId || 'unknown';
      if (!teamMap.has(teamId)) {
        teamMap.set(teamId, []);
      }
      teamMap.get(teamId)!.push(response.answers.nps);
    }

    const teams: TeamENPS[] = [];
    for (const [teamId, scores] of teamMap.entries()) {
      const promoters = scores.filter((s) => s >= 9).length;
      const detractors = scores.filter((s) => s <= 6).length;
      const enps = Math.round(((promoters - detractors) / scores.length) * 100);

      let status: TeamENPS['status'];
      if (enps >= this.config.enps.thresholds.excellent) {
        status = 'EXCELLENT';
      } else if (enps >= this.config.enps.thresholds.good) {
        status = 'GOOD';
      } else if (enps >= this.config.enps.thresholds.attention) {
        status = 'ATTENTION';
      } else {
        status = 'CRITICAL';
      }

      teams.push({
        teamId,
        teamName: teamId, // TODO: Resolve team name
        enps,
        headcount: scores.length,
        status,
      });
    }

    return teams.sort((a, b) => b.enps - a.enps);
  }

  /**
   * Generate action plan based on survey results
   */
  private async generateActionPlan(
    responses: any[],
    sentiments: SentimentAnalysis,
    byTeam: TeamENPS[],
  ): Promise<ActionPlanItem[]> {
    const actions: ActionPlanItem[] = [];

    // Critical teams need immediate attention
    const criticalTeams = byTeam.filter((t) => t.status === 'CRITICAL');
    for (const team of criticalTeams) {
      actions.push({
        priority: 'URGENT',
        action: `Réunion d'urgence équipe ${team.teamName} - eNPS ${team.enps}`,
        owner: 'HR + Manager',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
      });
    }

    // Address top negative themes
    for (const theme of sentiments.negative.slice(0, 3)) {
      actions.push({
        priority: theme.percentage > 30 ? 'HIGH' : 'MEDIUM',
        action: `Adresser le problème: ${theme.theme}`,
        owner: 'HR',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month
      });
    }

    return actions;
  }

  // ==================== 2. TALENT ACQUISITION ====================

  /**
   * Track time-to-hire metric
   * KPI: time-to-hire <30j
   */
  async getRecruitmentMetrics(): Promise<{
    averageTimeToHire: number;
    openPositions: number;
    pipelineHealth: string;
  }> {
    // TODO: Implement recruitment metrics tracking
    return {
      averageTimeToHire: 35,
      openPositions: 3,
      pipelineHealth: 'GOOD',
    };
  }

  // ==================== 3. TRAINING & DEVELOPMENT ====================

  /**
   * Analyze skills gaps and recommend training
   * KPI: training-completion >85%
   */
  async analyzeSkillsGap(teamId?: string): Promise<SkillsGapReport> {
    this.logger.log(
      `📚 Analyzing skills gaps${teamId ? ` for team ${teamId}` : ''}`,
    );

    // 1. Get current skills inventory
    const inventory = await this.skillsService.getInventory(teamId);

    // 2. Get required skills from job descriptions
    const requirements = await this.skillsService.getRequirements(teamId);

    // 3. Calculate gaps
    const gaps: SkillGap[] = [];
    for (const req of requirements) {
      const current = inventory.find((i) => i.skillId === req.skillId);
      const avgLevel = current?.averageLevel || 0;
      const gap = avgLevel - req.requiredLevel;

      if (gap < 0) {
        gaps.push({
          skillId: req.skillId,
          skill: req.skillName,
          category: req.category,
          requiredLevel: req.requiredLevel,
          currentAverage: avgLevel,
          gap,
          peopleBelowThreshold: current?.belowThreshold || [],
          critical:
            gap < this.config.skills.criticalGapThreshold || req.critical,
          businessImpact: this.assessBusinessImpact(gap, req.critical),
        });
      }
    }

    // 4. Recommend trainings for critical gaps
    const recommendations: TrainingRecommendation[] = [];
    for (const gap of gaps.filter((g) => g.critical)) {
      const training = await this.skillsService.findTraining(gap.skill);
      if (training) {
        recommendations.push({
          skillId: gap.skillId,
          skill: gap.skill,
          training,
          participants: gap.peopleBelowThreshold,
          totalCost: training.cost * gap.peopleBelowThreshold.length,
          estimatedROI: this.estimateTrainingROI(gap, training),
          duration: training.duration,
        });
      }
    }

    // 5. Calculate total budget
    const totalBudget = recommendations.reduce((sum, r) => sum + r.totalCost, 0);

    // 6. Submit budget request if needed
    let budgetStatus: SkillsGapReport['budgetStatus'] = 'PENDING';
    if (totalBudget > this.config.skills.trainingBudgetApprovalThreshold) {
      await this.submitBudgetRequest('TRAINING', totalBudget, recommendations);
    } else {
      budgetStatus = 'APPROVED'; // Auto-approved under threshold
    }

    return {
      analysisDate: new Date(),
      teamId,
      gaps: gaps.sort((a, b) => a.gap - b.gap), // Most critical first
      recommendations,
      totalBudget,
      budgetStatus,
    };
  }

  /**
   * Assess business impact of skill gap
   */
  private assessBusinessImpact(
    gap: number,
    critical: boolean,
  ): SkillGap['businessImpact'] {
    if (critical && gap < -2) return 'CRITICAL';
    if (gap < -1.5) return 'HIGH';
    if (gap < -1) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Estimate ROI of training
   */
  private estimateTrainingROI(gap: SkillGap, training: TrainingCourse): string {
    // Simplified ROI estimation
    if (gap.businessImpact === 'CRITICAL') {
      return 'Velocity +30%, incidents -50%';
    } else if (gap.businessImpact === 'HIGH') {
      return 'Velocity +20%';
    }
    return 'Competency improvement';
  }

  // ==================== 4. CONTRACT & ADMIN LIFECYCLE ====================

  /**
   * Scan contract deadlines and send alerts
   * KPI: contract-compliance 100%
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async scanContractDeadlines(): Promise<ContractAlerts> {
    this.logger.log('📋 Scanning contract deadlines');

    const alerts = await this.contractService.getUpcomingDeadlines({
      trialEnd: { daysAhead: this.config.contracts.alertWindows.trialEnd },
      contractEnd: { daysAhead: this.config.contracts.alertWindows.contractEnd },
      medicalVisit: { daysAhead: this.config.contracts.alertWindows.medicalVisit },
      annualReview: { daysAhead: this.config.contracts.alertWindows.annualReview },
      anniversary: { daysAhead: this.config.contracts.alertWindows.anniversary },
    });

    // Notify managers for urgent items
    const notifications = alerts.urgent.map((alert) => ({
      to: alert.managerId,
      type: 'CONTRACT_ALERT',
      priority: 'HIGH' as const,
      title: `Action requise: ${alert.employeeName}`,
      body: `${alert.actionRequired} - Échéance: ${alert.daysRemaining}j`,
      data: alert,
    }));

    if (notifications.length > 0) {
      await this.notificationService.sendBulk(notifications);
    }

    // Log compliance status
    this.logger.log(
      `✅ Contract scan complete: ${alerts.urgent.length} urgent, ${alerts.upcoming.length} upcoming`,
    );
    this.logger.log(
      `📊 Compliance score: ${alerts.compliance.overallScore}%`,
    );

    return alerts;
  }

  // ==================== 5. WORKFORCE PLANNING ====================

  /**
   * Predict turnover risk for employees
   * KPI: workforce-stability turnover <15%
   */
  async predictTurnoverRisk(): Promise<TurnoverPrediction[]> {
    this.logger.log('🔮 Predicting turnover risk');

    const employees = await this.analyticsService.getAllEmployees();

    const predictions: TurnoverPrediction[] = [];

    for (const emp of employees) {
      const signals = await this.gatherTurnoverSignals(emp.id);
      const riskScore = await this.analyticsService.predictTurnover(signals);

      let riskLevel: TurnoverPrediction['riskLevel'];
      if (riskScore >= 80) riskLevel = 'CRITICAL';
      else if (riskScore >= this.config.turnover.highRiskThreshold)
        riskLevel = 'HIGH';
      else if (riskScore >= this.config.turnover.mediumRiskThreshold)
        riskLevel = 'MEDIUM';
      else riskLevel = 'LOW';

      predictions.push({
        employeeId: emp.id,
        name: emp.name,
        team: emp.team,
        position: emp.position,
        tenure: emp.tenureMonths,
        riskScore,
        riskLevel,
        topFactors: signals.factors.slice(0, 3),
        recommendedActions: this.getRetentionActions(signals, riskLevel),
        predictedTimeframe:
          riskLevel === 'CRITICAL'
            ? '0-3 months'
            : riskLevel === 'HIGH'
              ? '3-6 months'
              : undefined,
      });
    }

    // Alert for high-risk employees
    const highRisk = predictions.filter(
      (p) => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL',
    );
    if (highRisk.length > 0) {
      await this.alertHighTurnoverRisk(highRisk);
    }

    this.logger.log(
      `✅ Turnover prediction complete: ${highRisk.length} high risk employees`,
    );

    return predictions.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Gather turnover signals for an employee
   */
  private async gatherTurnoverSignals(employeeId: string): Promise<{
    factors: TurnoverFactor[];
    overallRisk: number;
  }> {
    const workload = await this.analyticsService.getWorkloadMetrics(employeeId);

    // Define turnover factors and their weights
    const factors: TurnoverFactor[] = [
      {
        factor: 'Overtime hours',
        weight: 0.25,
        currentValue: workload.overtimeHours,
        riskThreshold: 10,
        trend: workload.overtimeTrend,
      },
      {
        factor: 'eNPS score',
        weight: 0.20,
        currentValue: workload.lastEnpsScore,
        riskThreshold: 6,
        trend: workload.enpsTrend,
      },
      {
        factor: 'Tenure stability',
        weight: 0.15,
        currentValue: workload.tenureMonths,
        riskThreshold: 18, // 18 months is common departure point
        trend: 'STABLE',
      },
      {
        factor: 'Salary vs market',
        weight: 0.20,
        currentValue: workload.salaryPercentile,
        riskThreshold: 40, // Below 40th percentile
        trend: workload.salaryTrend,
      },
      {
        factor: 'Career progression',
        weight: 0.20,
        currentValue: workload.monthsSincePromotion,
        riskThreshold: 24, // 2 years without promotion
        trend: workload.careerTrend,
      },
    ];

    return {
      factors: factors.sort((a, b) => b.weight - a.weight),
      overallRisk: 0, // Calculated by ML model
    };
  }

  /**
   * Get retention actions based on risk signals
   */
  private getRetentionActions(
    signals: any,
    riskLevel: TurnoverPrediction['riskLevel'],
  ): RetentionAction[] {
    const actions: RetentionAction[] = [];

    // Add actions based on top factors
    for (const factor of signals.factors) {
      if (factor.factor === 'Overtime hours' && factor.trend === 'DECLINING') {
        actions.push({
          action: 'Réviser la charge de travail',
          type: 'WORKLOAD',
          priority: riskLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
          estimatedImpact: 20,
        });
      }
      if (factor.factor === 'Salary vs market' && factor.currentValue < 40) {
        actions.push({
          action: 'Révision salariale',
          type: 'COMPENSATION',
          priority: 'HIGH',
          estimatedImpact: 30,
          cost: factor.currentValue * 0.1, // 10% increase
        });
      }
      if (factor.factor === 'Career progression' && factor.currentValue > 24) {
        actions.push({
          action: 'Plan de développement de carrière',
          type: 'CAREER',
          priority: 'HIGH',
          estimatedImpact: 25,
        });
      }
    }

    return actions.sort((a, b) => b.estimatedImpact - a.estimatedImpact);
  }

  /**
   * Alert about high turnover risk
   */
  private async alertHighTurnoverRisk(
    predictions: TurnoverPrediction[],
  ): Promise<void> {
    this.logger.warn(
      `🚨 HIGH TURNOVER RISK: ${predictions.length} employees at risk`,
    );

    // Notify managers
    for (const pred of predictions) {
      await this.notificationService.send({
        to: pred.team, // Team manager
        type: 'TURNOVER_ALERT',
        priority: pred.riskLevel === 'CRITICAL' ? 'URGENT' : 'HIGH',
        title: `Risque de départ: ${pred.name}`,
        body: `Score de risque: ${pred.riskScore}%. Actions recommandées disponibles.`,
        data: pred,
      });
    }

    // If multiple critical risks, escalate to CEO
    const critical = predictions.filter((p) => p.riskLevel === 'CRITICAL');
    if (critical.length >= 2) {
      await this.escalateToCEO('TURNOVER_CRITICAL', { critical });
    }
  }

  /**
   * Generate workforce plan
   */
  async generateWorkforcePlan(horizon: WorkforcePlan['horizon']): Promise<WorkforcePlan> {
    this.logger.log(`📈 Generating workforce plan for ${horizon}`);

    // TODO: Implement full workforce planning logic
    return {
      horizon,
      currentHeadcount: 52,
      plannedHeadcount: 58,
      recruitmentNeeds: [],
      retirementRisk: [],
      successionPlan: [],
      budgetForecast: {
        salaryMass: { current: 2500000, projected: 2800000 },
        recruitmentCosts: 18000,
        trainingBudget: 25000,
        totalHRBudget: 2843000,
      },
    };
  }

  // ==================== COORDINATION & ESCALATION ====================

  /**
   * Escalate issue to CEO
   */
  private async escalateToCEO(type: string, data: any): Promise<void> {
    this.logger.warn(`🚨 Escalating to IA-CEO: ${type}`);
    // TODO: Emit event for IA-CEO via event bus
  }

  /**
   * Submit budget request to CFO
   */
  private async submitBudgetRequest(
    category: string,
    amount: number,
    details: any,
  ): Promise<void> {
    this.logger.log(`💰 Submitting budget request to IA-CFO: ${category} €${amount}`);
    // TODO: Emit event for IA-CFO via event bus
  }

  // ==================== FORMATTERS ====================

  /**
   * Format eNPS report for display
   */
  formatENPSReport(analysis: ENPSAnalysis): string {
    const statusEmoji = (enps: number): string => {
      if (enps >= 40) return '🟢';
      if (enps >= 20) return '🟢';
      if (enps >= 0) return '🟡';
      return '🔴';
    };

    const lines = [
      `📊 eNPS SURVEY RESULTS`,
      '',
      `Global Score: ${analysis.enps > 0 ? '+' : ''}${analysis.enps} ${statusEmoji(analysis.enps)}`,
      '',
      `Distribution:`,
      `├─ Promoters (9-10): ${analysis.distribution.promoters}`,
      `├─ Passives (7-8): ${analysis.distribution.passives}`,
      `└─ Detractors (0-6): ${analysis.distribution.detractors}`,
      '',
      `By Team:`,
    ];

    for (const team of analysis.byTeam) {
      const emoji =
        team.status === 'EXCELLENT'
          ? '🟢'
          : team.status === 'GOOD'
            ? '🟢'
            : team.status === 'ATTENTION'
              ? '🟡'
              : '🔴';
      lines.push(`├─ ${team.teamName}: ${team.enps > 0 ? '+' : ''}${team.enps} ${emoji}`);
    }

    if (analysis.actionPlan && analysis.actionPlan.length > 0) {
      lines.push('');
      lines.push('Action Plan:');
      for (const action of analysis.actionPlan) {
        const priorityEmoji =
          action.priority === 'URGENT'
            ? '🔴'
            : action.priority === 'HIGH'
              ? '🟠'
              : '🟡';
        lines.push(`${priorityEmoji} ${action.action} → ${action.owner}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format contract alerts for display
   */
  formatContractAlerts(alerts: ContractAlerts): string {
    const lines = [
      `📋 CONTRACT ALERTS - ${new Date(alerts.scanDate).toLocaleDateString('fr-FR')}`,
      '',
    ];

    if (alerts.urgent.length > 0) {
      lines.push('🔴 URGENT (Action required this week):');
      for (const alert of alerts.urgent) {
        lines.push(`├─ ${alert.employeeName} (${alert.type})`);
        lines.push(`│   └─ ${alert.actionRequired} - ${alert.daysRemaining}j`);
      }
      lines.push('');
    }

    if (alerts.upcoming.length > 0) {
      lines.push('🟡 UPCOMING (Next 30 days):');
      lines.push(`├─ ${alerts.upcoming.length} actions à planifier`);
      lines.push('');
    }

    lines.push('🟢 COMPLIANCE STATUS:');
    lines.push(
      `├─ Contrats signés: ${alerts.compliance.contracts.compliant}/${alerts.compliance.contracts.total}`,
    );
    lines.push(
      `├─ Visites médicales: ${alerts.compliance.medicalVisits.compliant}/${alerts.compliance.medicalVisits.total}`,
    );
    lines.push(
      `├─ RGPD consent: ${alerts.compliance.rgpdConsent.compliant}/${alerts.compliance.rgpdConsent.total}`,
    );
    lines.push(`└─ Score global: ${alerts.compliance.overallScore}%`);

    return lines.join('\n');
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
      surveyService: false,
      skillsService: false,
      contractService: false,
      analyticsService: false,
    };

    // TODO: Implement actual health checks

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
        lastSurveyScan: new Date(),
        lastContractScan: new Date(),
      },
    };
  }
}
