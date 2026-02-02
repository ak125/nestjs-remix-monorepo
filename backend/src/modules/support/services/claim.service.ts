import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';

export interface Claim {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderId?: string;
  productId?: string;
  type:
    | 'defective_product'
    | 'wrong_product'
    | 'missing_product'
    | 'delivery_issue'
    | 'billing_issue'
    | 'service_complaint'
    | 'other';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status:
    | 'open'
    | 'investigating'
    | 'pending_customer'
    | 'pending_supplier'
    | 'resolved'
    | 'closed'
    | 'rejected';
  title: string;
  description: string;
  expectedResolution: string;
  attachments?: string[];
  assignedTo?: string;
  resolution?: ClaimResolution;
  timeline: ClaimTimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  escalatedAt?: Date;
  satisfaction?: {
    rating: number;
    feedback?: string;
  };
}

export interface ClaimResolution {
  type:
    | 'refund'
    | 'replacement'
    | 'repair'
    | 'credit'
    | 'compensation'
    | 'explanation'
    | 'other';
  description: string;
  amount?: number;
  resolvedBy: string;
  resolvedAt: Date;
  followUpRequired: boolean;
  followUpDate?: Date;
}

export interface ClaimTimelineEntry {
  id: string;
  action: string;
  description: string;
  performedBy: string;
  performedAt: Date;
  visibility: 'internal' | 'customer' | 'both';
  attachments?: string[];
}

export interface ClaimStats {
  total: number;
  open: number;
  resolved: number;
  averageResolutionTime: number; // in hours
  satisfactionRating: number;
  typeBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  resolutionTypeBreakdown: Record<string, number>;
}

@Injectable()
export class ClaimService {
  private readonly logger = new Logger(ClaimService.name);

  /**
   * TODO ARCHITECTURE: Map purement in-memory sans persistance Supabase.
   * RISQUES CRITIQUES:
   * - Réclamations clients perdues au redémarrage serveur
   * - Timeline des actions perdues (historique juridique)
   * - Croissance mémoire non bornée
   *
   * ACTION REQUISE: Migrer vers Supabase URGENT avant mise en prod.
   * Table à créer: __claims (avec JSONB pour timeline)
   */
  private claims: Map<string, Claim> = new Map();

  constructor(private notificationService: NotificationService) {}

  async submitClaim(
    claimData: Omit<
      Claim,
      'id' | 'status' | 'timeline' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<Claim> {
    try {
      this.validateClaim(claimData);

      const claim: Claim = {
        ...claimData,
        id: this.generateClaimId(),
        status: 'open',
        timeline: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add initial timeline entry
      claim.timeline.push({
        id: this.generateTimelineId(),
        action: 'claim_created',
        description: 'Réclamation créée',
        performedBy: claim.customerId,
        performedAt: new Date(),
        visibility: 'both',
      });

      this.claims.set(claim.id, claim);

      // Notify staff about new claim
      await this.notificationService.notifyClaimOpened({
        customerName: claim.customerName,
        orderId: claim.orderId || 'N/A',
        reason: claim.title,
      });

      this.logger.log(`Claim submitted: ${claim.id} - Type: ${claim.type}`);
      return claim;
    } catch (error) {
      this.logger.error(
        `Failed to submit claim: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getClaim(claimId: string): Promise<Claim | null> {
    return this.claims.get(claimId) || null;
  }

  async getAllClaims(filters?: {
    status?: string;
    type?: string;
    priority?: string;
    assignedTo?: string;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Claim[]> {
    let claims = Array.from(this.claims.values());

    if (filters) {
      if (filters.status) {
        claims = claims.filter((c) => c.status === filters.status);
      }
      if (filters.type) {
        claims = claims.filter((c) => c.type === filters.type);
      }
      if (filters.priority) {
        claims = claims.filter((c) => c.priority === filters.priority);
      }
      if (filters.assignedTo) {
        claims = claims.filter((c) => c.assignedTo === filters.assignedTo);
      }
      if (filters.customerId) {
        claims = claims.filter((c) => c.customerId === filters.customerId);
      }
      if (filters.startDate) {
        claims = claims.filter((c) => c.createdAt >= filters.startDate!);
      }
      if (filters.endDate) {
        claims = claims.filter((c) => c.createdAt <= filters.endDate!);
      }
    }

    return claims.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateClaimStatus(
    claimId: string,
    status: Claim['status'],
    staffId: string,
    note?: string,
  ): Promise<Claim> {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const oldStatus = claim.status;
    claim.status = status;
    claim.updatedAt = new Date();

    if (status === 'resolved' || status === 'closed') {
      claim.resolvedAt = new Date();
    }

    // Add timeline entry
    claim.timeline.push({
      id: this.generateTimelineId(),
      action: 'status_changed',
      description: `Statut changé de "${oldStatus}" à "${status}"${note ? ` - ${note}` : ''}`,
      performedBy: staffId,
      performedAt: new Date(),
      visibility: 'both',
    });

    this.claims.set(claimId, claim);
    this.logger.log(`Claim ${claimId} status updated to ${status}`);

    return claim;
  }

  async assignClaim(claimId: string, staffId: string): Promise<Claim> {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const oldAssignee = claim.assignedTo;
    claim.assignedTo = staffId;
    claim.updatedAt = new Date();

    if (claim.status === 'open') {
      claim.status = 'investigating';
    }

    // Add timeline entry
    claim.timeline.push({
      id: this.generateTimelineId(),
      action: 'assigned',
      description: oldAssignee
        ? `Réassigné de ${oldAssignee} à ${staffId}`
        : `Assigné à ${staffId}`,
      performedBy: staffId,
      performedAt: new Date(),
      visibility: 'internal',
    });

    this.claims.set(claimId, claim);
    this.logger.log(`Claim ${claimId} assigned to ${staffId}`);

    return claim;
  }

  async addTimelineEntry(
    claimId: string,
    entry: Omit<ClaimTimelineEntry, 'id' | 'performedAt'>,
  ): Promise<Claim> {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const timelineEntry: ClaimTimelineEntry = {
      ...entry,
      id: this.generateTimelineId(),
      performedAt: new Date(),
    };

    claim.timeline.push(timelineEntry);
    claim.updatedAt = new Date();

    this.claims.set(claimId, claim);
    this.logger.log(`Timeline entry added to claim ${claimId}`);

    return claim;
  }

  async resolveClaim(
    claimId: string,
    resolution: Omit<ClaimResolution, 'resolvedAt'>,
    resolvedBy: string,
  ): Promise<Claim> {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    claim.resolution = {
      ...resolution,
      resolvedAt: new Date(),
    };
    claim.status = 'resolved';
    claim.resolvedAt = new Date();
    claim.updatedAt = new Date();

    // Add timeline entry
    claim.timeline.push({
      id: this.generateTimelineId(),
      action: 'resolved',
      description: `Réclamation résolue: ${resolution.type} - ${resolution.description}`,
      performedBy: resolvedBy,
      performedAt: new Date(),
      visibility: 'both',
    });

    this.claims.set(claimId, claim);
    this.logger.log(`Claim ${claimId} resolved with ${resolution.type}`);

    return claim;
  }

  async escalateClaim(
    claimId: string,
    escalatedBy: string,
    reason: string,
  ): Promise<Claim> {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    claim.priority = 'urgent';
    claim.escalatedAt = new Date();
    claim.updatedAt = new Date();

    // Add timeline entry
    claim.timeline.push({
      id: this.generateTimelineId(),
      action: 'escalated',
      description: `Réclamation escaladée - Raison: ${reason}`,
      performedBy: escalatedBy,
      performedAt: new Date(),
      visibility: 'internal',
    });

    this.claims.set(claimId, claim);
    this.logger.log(`Claim ${claimId} escalated by ${escalatedBy}`);

    return claim;
  }

  async addSatisfactionRating(
    claimId: string,
    rating: number,
    feedback?: string,
  ): Promise<Claim> {
    const claim = this.claims.get(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    if (claim.status !== 'resolved' && claim.status !== 'closed') {
      throw new Error('Can only rate resolved or closed claims');
    }

    claim.satisfaction = { rating, feedback };
    claim.updatedAt = new Date();

    // Add timeline entry
    claim.timeline.push({
      id: this.generateTimelineId(),
      action: 'satisfaction_rated',
      description: `Satisfaction évaluée: ${rating}/5${feedback ? ` - ${feedback}` : ''}`,
      performedBy: claim.customerId,
      performedAt: new Date(),
      visibility: 'both',
    });

    this.claims.set(claimId, claim);
    this.logger.log(
      `Satisfaction rating added to claim ${claimId}: ${rating}/5`,
    );

    return claim;
  }

  async getClaimStats(period?: {
    start: Date;
    end: Date;
  }): Promise<ClaimStats> {
    let claims = Array.from(this.claims.values());

    if (period) {
      claims = claims.filter(
        (c) => c.createdAt >= period.start && c.createdAt <= period.end,
      );
    }

    const total = claims.length;
    const open = claims.filter(
      (c) => !['resolved', 'closed', 'rejected'].includes(c.status),
    ).length;
    const resolved = claims.filter(
      (c) => c.status === 'resolved' || c.status === 'closed',
    ).length;

    // Calculate average resolution time
    const resolvedClaims = claims.filter((c) => c.resolvedAt);
    const averageResolutionTime =
      resolvedClaims.length > 0
        ? resolvedClaims.reduce((sum, c) => {
            const resolutionTime =
              c.resolvedAt!.getTime() - c.createdAt.getTime();
            return sum + resolutionTime / (1000 * 60 * 60); // Convert to hours
          }, 0) / resolvedClaims.length
        : 0;

    // Calculate satisfaction rating
    const ratedClaims = claims.filter((c) => c.satisfaction);
    const satisfactionRating =
      ratedClaims.length > 0
        ? ratedClaims.reduce((sum, c) => sum + c.satisfaction!.rating, 0) /
          ratedClaims.length
        : 0;

    // Type breakdown
    const typeBreakdown: Record<string, number> = {};
    claims.forEach((c) => {
      typeBreakdown[c.type] = (typeBreakdown[c.type] || 0) + 1;
    });

    // Priority breakdown
    const priorityBreakdown: Record<string, number> = {};
    claims.forEach((c) => {
      priorityBreakdown[c.priority] = (priorityBreakdown[c.priority] || 0) + 1;
    });

    // Resolution type breakdown
    const resolutionTypeBreakdown: Record<string, number> = {};
    claims
      .filter((c) => c.resolution)
      .forEach((c) => {
        const type = c.resolution!.type;
        resolutionTypeBreakdown[type] =
          (resolutionTypeBreakdown[type] || 0) + 1;
      });

    return {
      total,
      open,
      resolved,
      averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
      satisfactionRating: Math.round(satisfactionRating * 100) / 100,
      typeBreakdown,
      priorityBreakdown,
      resolutionTypeBreakdown,
    };
  }

  private validateClaim(
    data: Omit<Claim, 'id' | 'status' | 'timeline' | 'createdAt' | 'updatedAt'>,
  ): void {
    if (!data.customerId || !data.customerName || !data.customerEmail) {
      throw new Error('Customer information is required');
    }

    if (!data.title || data.title.length < 5) {
      throw new Error('Claim title must be at least 5 characters');
    }

    if (!data.description || data.description.length < 20) {
      throw new Error('Claim description must be at least 20 characters');
    }

    if (!data.expectedResolution || data.expectedResolution.length < 10) {
      throw new Error('Expected resolution must be at least 10 characters');
    }

    if (!this.isValidEmail(data.customerEmail)) {
      throw new Error('Invalid email format');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private generateClaimId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `CLM-${timestamp}-${random}`.toUpperCase();
  }

  private generateTimelineId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 3);
    return `TL-${timestamp}-${random}`.toUpperCase();
  }
}
