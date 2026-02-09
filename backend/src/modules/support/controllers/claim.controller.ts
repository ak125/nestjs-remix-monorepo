import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ClaimService,
  Claim,
  ClaimResolution,
} from '../services/claim.service';
import {
  DomainNotFoundException,
  ErrorCodes,
} from '../../../common/exceptions';

@Controller('api/support/claims')
export class ClaimController {
  private readonly logger = new Logger(ClaimController.name);

  constructor(private readonly claimService: ClaimService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitClaim(
    @Body()
    claimData: Omit<
      Claim,
      'id' | 'status' | 'timeline' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<Claim> {
    this.logger.log('Submitting claim');
    return this.claimService.submitClaim(claimData);
  }

  @Get()
  async getAllClaims(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<Claim[]> {
    const filters = {
      status,
      type,
      priority,
      assignedTo,
      customerId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return this.claimService.getAllClaims(filters);
  }

  @Get('stats')
  async getClaimStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period =
      startDate && endDate
        ? { start: new Date(startDate), end: new Date(endDate) }
        : undefined;

    return this.claimService.getClaimStats(period);
  }

  @Get(':claimId')
  async getClaim(@Param('claimId') claimId: string): Promise<Claim> {
    const claim = await this.claimService.getClaim(claimId);
    if (!claim) {
      throw new DomainNotFoundException({
        message: `Claim ${claimId} not found`,
        code: ErrorCodes.SUPPORT.CLAIM_NOT_FOUND,
      });
    }
    return claim;
  }

  @Put(':claimId/status')
  async updateClaimStatus(
    @Param('claimId') claimId: string,
    @Body() body: { status: string; staffId: string; note?: string },
  ): Promise<Claim> {
    return this.claimService.updateClaimStatus(
      claimId,
      body.status as Claim['status'],
      body.staffId,
      body.note,
    );
  }

  @Put(':claimId/assign')
  async assignClaim(
    @Param('claimId') claimId: string,
    @Body() body: { staffId: string },
  ): Promise<Claim> {
    return this.claimService.assignClaim(claimId, body.staffId);
  }

  @Post(':claimId/timeline')
  async addTimelineEntry(
    @Param('claimId') claimId: string,
    @Body()
    entryData: {
      action: string;
      description: string;
      performedBy: string;
      visibility: 'internal' | 'customer' | 'both';
      attachments?: string[];
    },
  ): Promise<Claim> {
    return this.claimService.addTimelineEntry(claimId, entryData);
  }

  @Put(':claimId/resolve')
  async resolveClaim(
    @Param('claimId') claimId: string,
    @Body()
    body: {
      resolution: Omit<ClaimResolution, 'resolvedAt'>;
      resolvedBy: string;
    },
  ): Promise<Claim> {
    return this.claimService.resolveClaim(
      claimId,
      body.resolution,
      body.resolvedBy,
    );
  }

  @Put(':claimId/escalate')
  async escalateClaim(
    @Param('claimId') claimId: string,
    @Body() body: { escalatedBy: string; reason: string },
  ): Promise<Claim> {
    return this.claimService.escalateClaim(
      claimId,
      body.escalatedBy,
      body.reason,
    );
  }

  @Post(':claimId/satisfaction')
  async addSatisfactionRating(
    @Param('claimId') claimId: string,
    @Body() ratingData: { rating: number; feedback?: string },
  ): Promise<Claim> {
    return this.claimService.addSatisfactionRating(
      claimId,
      ratingData.rating,
      ratingData.feedback,
    );
  }
}
