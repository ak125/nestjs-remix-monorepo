import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { RequirePermission } from '@auth/decorators/require-permission.decorator';
import { PermissionsService } from '@auth/permissions.service';
import {
  ClaimService,
  Claim,
  ClaimResolution,
  CLAIM_TIMELINE_VISIBILITIES,
  ClaimTimelineVisibility,
} from '../services/claim.service';
import {
  DomainNotFoundException,
  DomainValidationException,
  ErrorCodes,
} from '@common/exceptions';
import { requireSessionUserId } from './session-user';

interface RequestWithUser {
  user?: {
    id?: string | number;
    email?: string;
    firstName?: string;
    lastName?: string;
    level?: string | number;
  };
}

/** Champs qu'un client peut renseigner ; l'identité vient de la session. */
type ClaimSubmission = Partial<
  Pick<
    Claim,
    | 'type'
    | 'title'
    | 'description'
    | 'expectedResolution'
    | 'orderId'
    | 'productId'
    | 'attachments'
    | 'customerPhone'
  >
>;

/** Entrées de l'historique montrées au client ; toute autre valeur reste interne. */
const CUSTOMER_VISIBLE: ReadonlyArray<ClaimTimelineVisibility> = [
  'customer',
  'both',
];

/**
 * Accès :
 * - client connecté : dépôt, liste et lecture de SES réclamations, note de
 *   satisfaction sur les siennes ; notes internes et affectation masquées ;
 * - équipe (`canSeeCustomerDetails`) : lecture de toutes les réclamations ;
 * - administrateur : actions de traitement, l'auteur étant pris de la session.
 */
@Controller('api/support/claims')
export class ClaimController {
  private readonly logger = new Logger(ClaimController.name);

  constructor(
    private readonly claimService: ClaimService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Post()
  @UseGuards(AuthenticatedGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitClaim(
    @Req() req: RequestWithUser,
    @Body() body: ClaimSubmission,
  ): Promise<Claim> {
    const user = req.user;
    this.logger.log('Submitting claim');
    return this.claimService.submitClaim({
      customerId: requireSessionUserId(req),
      customerName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
      customerEmail: user?.email ?? '',
      customerPhone: body?.customerPhone,
      orderId: body?.orderId,
      productId: body?.productId,
      type: body?.type as Claim['type'],
      priority: 'normal',
      title: body?.title as string,
      description: body?.description as string,
      expectedResolution: body?.expectedResolution as string,
      attachments: body?.attachments,
    });
  }

  @Get()
  @UseGuards(AuthenticatedGuard)
  async getAllClaims(
    @Req() req: RequestWithUser,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<Claim[]> {
    const isStaff = this.isStaff(req);
    const filters = {
      status,
      type,
      priority,
      assignedTo: isStaff ? assignedTo : undefined,
      customerId: isStaff ? customerId : requireSessionUserId(req),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const claims = await this.claimService.getAllClaims(filters);
    return isStaff ? claims : claims.map((claim) => this.toCustomerView(claim));
  }

  @Get('stats')
  @UseGuards(AuthenticatedGuard, PermissionsGuard)
  @RequirePermission('canSeeCustomerDetails')
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
  @UseGuards(AuthenticatedGuard)
  async getClaim(
    @Req() req: RequestWithUser,
    @Param('claimId') claimId: string,
  ): Promise<Claim> {
    if (this.isStaff(req)) {
      const claim = await this.claimService.getClaim(claimId);
      if (!claim) throw this.claimNotFound(claimId);
      return claim;
    }
    return this.toCustomerView(await this.getOwnClaim(req, claimId));
  }

  @Put(':claimId/status')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async updateClaimStatus(
    @Req() req: RequestWithUser,
    @Param('claimId') claimId: string,
    @Body() body: { status: string; note?: string },
  ): Promise<Claim> {
    return this.claimService.updateClaimStatus(
      claimId,
      body.status as Claim['status'],
      requireSessionUserId(req),
      body.note,
    );
  }

  @Put(':claimId/assign')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async assignClaim(
    @Req() req: RequestWithUser,
    @Param('claimId') claimId: string,
    @Body() body: { staffId: string },
  ): Promise<Claim> {
    return this.claimService.assignClaim(
      claimId,
      body.staffId,
      requireSessionUserId(req),
    );
  }

  @Post(':claimId/timeline')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async addTimelineEntry(
    @Req() req: RequestWithUser,
    @Param('claimId') claimId: string,
    @Body()
    entryData: {
      action: string;
      description: string;
      visibility: ClaimTimelineVisibility;
      attachments?: string[];
    },
  ): Promise<Claim> {
    if (!CLAIM_TIMELINE_VISIBILITIES.includes(entryData?.visibility)) {
      throw new DomainValidationException({
        message: `La visibilité doit valoir ${CLAIM_TIMELINE_VISIBILITIES.join(', ')}`,
        code: ErrorCodes.VALIDATION.INVALID_FORMAT,
      });
    }
    return this.claimService.addTimelineEntry(claimId, {
      action: entryData.action,
      description: entryData.description,
      visibility: entryData.visibility,
      attachments: entryData.attachments,
      performedBy: requireSessionUserId(req),
    });
  }

  @Put(':claimId/resolve')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async resolveClaim(
    @Req() req: RequestWithUser,
    @Param('claimId') claimId: string,
    @Body()
    body: {
      resolution: Omit<ClaimResolution, 'resolvedAt' | 'resolvedBy'>;
    },
  ): Promise<Claim> {
    const resolvedBy = requireSessionUserId(req);
    return this.claimService.resolveClaim(
      claimId,
      { ...body.resolution, resolvedBy },
      resolvedBy,
    );
  }

  @Put(':claimId/escalate')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async escalateClaim(
    @Req() req: RequestWithUser,
    @Param('claimId') claimId: string,
    @Body() body: { reason: string },
  ): Promise<Claim> {
    return this.claimService.escalateClaim(
      claimId,
      requireSessionUserId(req),
      body.reason,
    );
  }

  @Post(':claimId/satisfaction')
  @UseGuards(AuthenticatedGuard)
  async addSatisfactionRating(
    @Req() req: RequestWithUser,
    @Param('claimId') claimId: string,
    @Body() ratingData: { rating: number; feedback?: string },
  ): Promise<Claim> {
    await this.getOwnClaim(req, claimId);

    const rating = ratingData?.rating;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new DomainValidationException({
        message: 'La note doit être un entier entre 1 et 5',
        code: ErrorCodes.VALIDATION.INVALID_RANGE,
      });
    }
    const feedback =
      typeof ratingData.feedback === 'string' ? ratingData.feedback : undefined;

    return this.toCustomerView(
      await this.claimService.addSatisfactionRating(claimId, rating, feedback),
    );
  }

  private isStaff(req: RequestWithUser): boolean {
    const level = parseInt(String(req.user?.level ?? 0), 10) || 0;
    return this.permissionsService.hasPermission(
      level,
      'canSeeCustomerDetails',
    );
  }

  /** Réclamation du client connecté ; celle d'un autre client est « introuvable ». */
  private async getOwnClaim(
    req: RequestWithUser,
    claimId: string,
  ): Promise<Claim> {
    const userId = requireSessionUserId(req);
    const claim = await this.claimService.getClaim(claimId);
    if (!claim || claim.customerId !== userId) {
      throw this.claimNotFound(claimId);
    }
    return claim;
  }

  private claimNotFound(claimId: string): DomainNotFoundException {
    return new DomainNotFoundException({
      message: `Claim ${claimId} not found`,
      code: ErrorCodes.SUPPORT.CLAIM_NOT_FOUND,
    });
  }

  /**
   * Vue client : sans l'affectation, et seulement les entrées marquées pour le
   * client. Une entrée sans visibilité connue reste interne.
   */
  private toCustomerView(claim: Claim): Claim {
    return {
      ...claim,
      assignedTo: undefined,
      timeline: claim.timeline.filter((entry) =>
        CUSTOMER_VISIBLE.includes(entry.visibility),
      ),
    };
  }
}
