import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DomainNotFoundException,
  BusinessRuleException,
  DomainValidationException,
  ErrorCodes,
} from '../../../common/exceptions';
import { NotificationService } from './notification.service';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  getErrorMessage,
  getErrorStack,
} from '../../../common/utils/error.utils';

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

interface ClaimRow {
  clm_id: string;
  clm_customer_id: string;
  clm_customer_name: string;
  clm_customer_email: string;
  clm_customer_phone: string | null;
  clm_order_id: string | null;
  clm_product_id: string | null;
  clm_type: string;
  clm_priority: string;
  clm_status: string;
  clm_title: string;
  clm_description: string;
  clm_expected_resolution: string;
  clm_attachments: string[] | null;
  clm_assigned_to: string | null;
  clm_resolution: ClaimResolution | null;
  clm_timeline: ClaimTimelineEntry[] | null;
  clm_satisfaction: { rating: number; feedback?: string } | null;
  clm_created_at: string;
  clm_updated_at: string;
  clm_resolved_at: string | null;
  clm_escalated_at: string | null;
}

@Injectable()
export class ClaimService extends SupabaseBaseService {
  protected override readonly logger = new Logger(ClaimService.name);

  private readonly TABLE = '__claims';

  constructor(
    private readonly notificationService: NotificationService,
    configService?: ConfigService,
  ) {
    super(configService);
  }

  private rowToClaim(row: ClaimRow): Claim {
    return {
      id: row.clm_id,
      customerId: row.clm_customer_id,
      customerName: row.clm_customer_name,
      customerEmail: row.clm_customer_email,
      customerPhone: row.clm_customer_phone ?? undefined,
      orderId: row.clm_order_id ?? undefined,
      productId: row.clm_product_id ?? undefined,
      type: row.clm_type as Claim['type'],
      priority: row.clm_priority as Claim['priority'],
      status: row.clm_status as Claim['status'],
      title: row.clm_title,
      description: row.clm_description,
      expectedResolution: row.clm_expected_resolution,
      attachments: row.clm_attachments ?? undefined,
      assignedTo: row.clm_assigned_to ?? undefined,
      resolution: row.clm_resolution ?? undefined,
      timeline: (row.clm_timeline ?? []).map((entry) => ({
        ...entry,
        performedAt: new Date(entry.performedAt),
      })),
      createdAt: new Date(row.clm_created_at),
      updatedAt: new Date(row.clm_updated_at),
      resolvedAt: row.clm_resolved_at
        ? new Date(row.clm_resolved_at)
        : undefined,
      escalatedAt: row.clm_escalated_at
        ? new Date(row.clm_escalated_at)
        : undefined,
      satisfaction: row.clm_satisfaction ?? undefined,
    };
  }

  private claimToRow(claim: Claim): Omit<
    ClaimRow,
    'clm_created_at' | 'clm_updated_at'
  > & {
    clm_created_at: string;
    clm_updated_at: string;
    clm_resolved_at: string | null;
    clm_escalated_at: string | null;
  } {
    return {
      clm_id: claim.id,
      clm_customer_id: claim.customerId,
      clm_customer_name: claim.customerName,
      clm_customer_email: claim.customerEmail,
      clm_customer_phone: claim.customerPhone ?? null,
      clm_order_id: claim.orderId ?? null,
      clm_product_id: claim.productId ?? null,
      clm_type: claim.type,
      clm_priority: claim.priority,
      clm_status: claim.status,
      clm_title: claim.title,
      clm_description: claim.description,
      clm_expected_resolution: claim.expectedResolution,
      clm_attachments: claim.attachments ?? null,
      clm_assigned_to: claim.assignedTo ?? null,
      clm_resolution: claim.resolution ?? null,
      clm_timeline: claim.timeline ?? null,
      clm_satisfaction: claim.satisfaction ?? null,
      clm_created_at: claim.createdAt.toISOString(),
      clm_updated_at: claim.updatedAt.toISOString(),
      clm_resolved_at: claim.resolvedAt?.toISOString() ?? null,
      clm_escalated_at: claim.escalatedAt?.toISOString() ?? null,
    };
  }

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

      const row = this.claimToRow(claim);
      const { error } = await this.supabase.from(this.TABLE).insert(row);

      if (error) {
        this.logger.error(`Failed to insert claim: ${error.message}`);
        throw new Error(`Failed to insert claim: ${error.message}`);
      }

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
        `Failed to submit claim: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw error;
    }
  }

  async getClaim(claimId: string): Promise<Claim | null> {
    const { data, error } = await this.supabase
      .from(this.TABLE)
      .select()
      .eq('clm_id', claimId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      this.logger.error(`Failed to get claim ${claimId}: ${error.message}`);
      return null;
    }

    return this.rowToClaim(data as ClaimRow);
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
    let query = this.supabase.from(this.TABLE).select();

    if (filters) {
      if (filters.status) {
        query = query.eq('clm_status', filters.status);
      }
      if (filters.type) {
        query = query.eq('clm_type', filters.type);
      }
      if (filters.priority) {
        query = query.eq('clm_priority', filters.priority);
      }
      if (filters.assignedTo) {
        query = query.eq('clm_assigned_to', filters.assignedTo);
      }
      if (filters.customerId) {
        query = query.eq('clm_customer_id', filters.customerId);
      }
      if (filters.startDate) {
        query = query.gte('clm_created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('clm_created_at', filters.endDate.toISOString());
      }
    }

    const { data, error } = await query.order('clm_created_at', {
      ascending: false,
    });

    if (error) {
      this.logger.error(`Failed to get claims: ${error.message}`);
      return [];
    }

    return (data as ClaimRow[]).map((row) => this.rowToClaim(row));
  }

  async updateClaimStatus(
    claimId: string,
    status: Claim['status'],
    staffId: string,
    note?: string,
  ): Promise<Claim> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.CLAIM_NOT_FOUND,
        message: `Claim ${claimId} not found`,
      });
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

    const { error } = await this.supabase
      .from(this.TABLE)
      .update({
        clm_status: claim.status,
        clm_updated_at: claim.updatedAt.toISOString(),
        clm_resolved_at: claim.resolvedAt?.toISOString() ?? null,
        clm_timeline: claim.timeline,
      })
      .eq('clm_id', claimId);

    if (error) {
      this.logger.error(`Failed to update claim status: ${error.message}`);
      throw new Error(`Failed to update claim status: ${error.message}`);
    }

    this.logger.log(`Claim ${claimId} status updated to ${status}`);
    return claim;
  }

  async assignClaim(claimId: string, staffId: string): Promise<Claim> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.CLAIM_NOT_FOUND,
        message: `Claim ${claimId} not found`,
      });
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

    const { error } = await this.supabase
      .from(this.TABLE)
      .update({
        clm_assigned_to: claim.assignedTo,
        clm_status: claim.status,
        clm_updated_at: claim.updatedAt.toISOString(),
        clm_timeline: claim.timeline,
      })
      .eq('clm_id', claimId);

    if (error) {
      this.logger.error(`Failed to assign claim: ${error.message}`);
      throw new Error(`Failed to assign claim: ${error.message}`);
    }

    this.logger.log(`Claim ${claimId} assigned to ${staffId}`);
    return claim;
  }

  async addTimelineEntry(
    claimId: string,
    entry: Omit<ClaimTimelineEntry, 'id' | 'performedAt'>,
  ): Promise<Claim> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.CLAIM_NOT_FOUND,
        message: `Claim ${claimId} not found`,
      });
    }

    const timelineEntry: ClaimTimelineEntry = {
      ...entry,
      id: this.generateTimelineId(),
      performedAt: new Date(),
    };

    claim.timeline.push(timelineEntry);
    claim.updatedAt = new Date();

    const { error } = await this.supabase
      .from(this.TABLE)
      .update({
        clm_timeline: claim.timeline,
        clm_updated_at: claim.updatedAt.toISOString(),
      })
      .eq('clm_id', claimId);

    if (error) {
      this.logger.error(`Failed to add timeline entry: ${error.message}`);
      throw new Error(`Failed to add timeline entry: ${error.message}`);
    }

    this.logger.log(`Timeline entry added to claim ${claimId}`);
    return claim;
  }

  async resolveClaim(
    claimId: string,
    resolution: Omit<ClaimResolution, 'resolvedAt'>,
    resolvedBy: string,
  ): Promise<Claim> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.CLAIM_NOT_FOUND,
        message: `Claim ${claimId} not found`,
      });
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

    const { error } = await this.supabase
      .from(this.TABLE)
      .update({
        clm_resolution: claim.resolution,
        clm_status: claim.status,
        clm_resolved_at: claim.resolvedAt.toISOString(),
        clm_updated_at: claim.updatedAt.toISOString(),
        clm_timeline: claim.timeline,
      })
      .eq('clm_id', claimId);

    if (error) {
      this.logger.error(`Failed to resolve claim: ${error.message}`);
      throw new Error(`Failed to resolve claim: ${error.message}`);
    }

    this.logger.log(`Claim ${claimId} resolved with ${resolution.type}`);
    return claim;
  }

  async escalateClaim(
    claimId: string,
    escalatedBy: string,
    reason: string,
  ): Promise<Claim> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.CLAIM_NOT_FOUND,
        message: `Claim ${claimId} not found`,
      });
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

    const { error } = await this.supabase
      .from(this.TABLE)
      .update({
        clm_priority: claim.priority,
        clm_escalated_at: claim.escalatedAt.toISOString(),
        clm_updated_at: claim.updatedAt.toISOString(),
        clm_timeline: claim.timeline,
      })
      .eq('clm_id', claimId);

    if (error) {
      this.logger.error(`Failed to escalate claim: ${error.message}`);
      throw new Error(`Failed to escalate claim: ${error.message}`);
    }

    this.logger.log(`Claim ${claimId} escalated by ${escalatedBy}`);
    return claim;
  }

  async addSatisfactionRating(
    claimId: string,
    rating: number,
    feedback?: string,
  ): Promise<Claim> {
    const claim = await this.getClaim(claimId);
    if (!claim) {
      throw new DomainNotFoundException({
        code: ErrorCodes.SUPPORT.CLAIM_NOT_FOUND,
        message: `Claim ${claimId} not found`,
      });
    }

    if (claim.status !== 'resolved' && claim.status !== 'closed') {
      throw new BusinessRuleException({
        code: ErrorCodes.SUPPORT.CLAIM_INVALID_STATE,
        message: 'Can only rate resolved or closed claims',
      });
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

    const { error } = await this.supabase
      .from(this.TABLE)
      .update({
        clm_satisfaction: claim.satisfaction,
        clm_updated_at: claim.updatedAt.toISOString(),
        clm_timeline: claim.timeline,
      })
      .eq('clm_id', claimId);

    if (error) {
      this.logger.error(`Failed to add satisfaction rating: ${error.message}`);
      throw new Error(`Failed to add satisfaction rating: ${error.message}`);
    }

    this.logger.log(
      `Satisfaction rating added to claim ${claimId}: ${rating}/5`,
    );

    return claim;
  }

  async getClaimStats(period?: {
    start: Date;
    end: Date;
  }): Promise<ClaimStats> {
    let query = this.supabase.from(this.TABLE).select();

    if (period) {
      query = query
        .gte('clm_created_at', period.start.toISOString())
        .lte('clm_created_at', period.end.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to get claim stats: ${error.message}`);
      return {
        total: 0,
        open: 0,
        resolved: 0,
        averageResolutionTime: 0,
        satisfactionRating: 0,
        typeBreakdown: {},
        priorityBreakdown: {},
        resolutionTypeBreakdown: {},
      };
    }

    const claims = (data as ClaimRow[]).map((row) => this.rowToClaim(row));

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
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.REQUIRED_FIELD,
        message: 'Customer information is required',
      });
    }

    if (!data.title || data.title.length < 5) {
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.FAILED,
        message: 'Claim title must be at least 5 characters',
      });
    }

    if (!data.description || data.description.length < 20) {
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.FAILED,
        message: 'Claim description must be at least 20 characters',
      });
    }

    if (!data.expectedResolution || data.expectedResolution.length < 10) {
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.FAILED,
        message: 'Expected resolution must be at least 10 characters',
      });
    }

    if (!this.isValidEmail(data.customerEmail)) {
      throw new DomainValidationException({
        code: ErrorCodes.VALIDATION.INVALID_EMAIL,
        message: 'Invalid email format',
      });
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
