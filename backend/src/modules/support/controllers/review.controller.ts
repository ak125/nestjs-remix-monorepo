import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import {
  ReviewService,
  ReviewData,
  ReviewCreateRequest,
  ReviewFilters,
} from '../services/review.service';
import { DomainNotFoundException, ErrorCodes } from '@common/exceptions';
import { requireSessionUserId } from './session-user';

/**
 * Accès : lecture des avis réservée à l'équipe (`canSeeCustomerDetails`) ;
 * saisie, modération et suppression réservées à l'administration.
 */
@Controller('api/support/reviews')
export class ReviewController {
  private readonly logger = new Logger(ReviewController.name);

  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitReview(
    @Body()
    reviewData: ReviewCreateRequest,
  ): Promise<ReviewData> {
    this.logger.log('Submitting review');
    return this.reviewService.submitReview(reviewData);
  }

  @Get()
  @UseGuards(AuthenticatedGuard, PermissionsGuard)
  @RequirePermission('canSeeCustomerDetails')
  async getReviews(
    @Query('rating') rating?: string,
    @Query('published') published?: string,
    @Query('moderated') moderated?: string,
    @Query('verified') verified?: string,
    @Query('productId') productId?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ReviewData[]> {
    const filters: ReviewFilters = {};

    if (rating) filters.rating = parseInt(rating);
    if (published !== undefined) filters.published = published === 'true';
    if (moderated !== undefined) filters.moderated = moderated === 'true';
    if (verified !== undefined) filters.verified = verified === 'true';
    if (productId) filters.product_id = productId;
    if (customerId) filters.customer_id = customerId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.reviewService.getReviews(filters);
  }

  @Get('stats')
  @UseGuards(AuthenticatedGuard, PermissionsGuard)
  @RequirePermission('canSeeCustomerDetails')
  async getReviewStats(
    @Query('rating') rating?: string,
    @Query('moderated') moderated?: string,
    @Query('verified') verified?: string,
    @Query('productId') productId?: string,
    @Query('customerId') customerId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: Omit<ReviewFilters, 'published'> = {};

    if (rating) filters.rating = parseInt(rating);
    if (moderated !== undefined) filters.moderated = moderated === 'true';
    if (verified !== undefined) filters.verified = verified === 'true';
    if (productId) filters.product_id = productId;
    if (customerId) filters.customer_id = customerId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.reviewService.getReviewStats(filters);
  }

  @Get('product/:productId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getProductReviews(
    @Param('productId') productId: string,
  ): Promise<ReviewData[]> {
    return this.reviewService.getProductReviews(productId);
  }

  @Get('customer/:customerId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async getCustomerReviews(
    @Param('customerId') customerId: string,
  ): Promise<ReviewData[]> {
    return this.reviewService.getCustomerReviews(customerId);
  }

  @Get(':reviewId')
  @UseGuards(AuthenticatedGuard, PermissionsGuard)
  @RequirePermission('canSeeCustomerDetails')
  async getReview(@Param('reviewId') reviewId: string): Promise<ReviewData> {
    const review = await this.reviewService.getReview(reviewId);
    if (!review) {
      throw new DomainNotFoundException({
        message: `Review ${reviewId} not found`,
        code: ErrorCodes.SUPPORT.REVIEW_NOT_FOUND,
      });
    }
    return review;
  }

  @Put(':reviewId/moderate')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async moderateReview(
    @Req() req: { user?: { id?: string | number } },
    @Param('reviewId') reviewId: string,
    @Body()
    body: {
      action: 'approve' | 'reject';
      moderatorNote?: string;
    },
  ): Promise<ReviewData> {
    return this.reviewService.moderateReview(
      reviewId,
      body.action,
      requireSessionUserId(req),
      body.moderatorNote,
    );
  }

  @Put(':reviewId/helpful')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async markHelpful(
    @Param('reviewId') reviewId: string,
    @Body() body: { helpful: boolean },
  ): Promise<ReviewData> {
    return this.reviewService.markHelpful(reviewId, body.helpful);
  }

  @Put(':reviewId/verify')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  async verifyReview(
    @Param('reviewId') reviewId: string,
    @Body() body: { verified: boolean },
  ): Promise<ReviewData> {
    return this.reviewService.verifyReview(reviewId, body.verified);
  }

  @Delete(':reviewId')
  @UseGuards(AuthenticatedGuard, IsAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReview(@Param('reviewId') reviewId: string): Promise<void> {
    await this.reviewService.deleteReview(reviewId);
  }
}
