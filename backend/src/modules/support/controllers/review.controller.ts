import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ReviewService,
  ReviewData,
  ReviewFilters,
} from '../services/review.service';

@Controller('api/support/reviews')
export class ReviewController {
  private readonly logger = new Logger(ReviewController.name);

  constructor(private reviewService: ReviewService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitReview(
    @Body()
    reviewData: Omit<
      ReviewData,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'helpful'
      | 'notHelpful'
      | 'moderated'
      | 'published'
    >,
  ): Promise<ReviewData> {
    this.logger.log('Submitting review');
    return this.reviewService.submitReview(reviewData);
  }

  @Get()
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
    if (productId) filters.productId = productId;
    if (customerId) filters.customerId = customerId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.reviewService.getReviews(filters);
  }

  @Get('stats')
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
    if (productId) filters.productId = productId;
    if (customerId) filters.customerId = customerId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.reviewService.getReviewStats(filters);
  }

  @Get('product/:productId')
  async getProductReviews(
    @Param('productId') productId: string,
  ): Promise<ReviewData[]> {
    return this.reviewService.getProductReviews(productId);
  }

  @Get('customer/:customerId')
  async getCustomerReviews(
    @Param('customerId') customerId: string,
  ): Promise<ReviewData[]> {
    return this.reviewService.getCustomerReviews(customerId);
  }

  @Get(':reviewId')
  async getReview(@Param('reviewId') reviewId: string): Promise<ReviewData> {
    const review = await this.reviewService.getReview(reviewId);
    if (!review) {
      throw new Error(`Review ${reviewId} not found`);
    }
    return review;
  }

  @Put(':reviewId/moderate')
  async moderateReview(
    @Param('reviewId') reviewId: string,
    @Body()
    body: {
      action: 'approve' | 'reject';
      moderatorId: string;
      moderatorNote?: string;
    },
  ): Promise<ReviewData> {
    return this.reviewService.moderateReview(
      reviewId,
      body.action,
      body.moderatorId,
      body.moderatorNote,
    );
  }

  @Put(':reviewId/helpful')
  async markHelpful(
    @Param('reviewId') reviewId: string,
    @Body() body: { helpful: boolean },
  ): Promise<ReviewData> {
    return this.reviewService.markHelpful(reviewId, body.helpful);
  }

  @Put(':reviewId/verify')
  async verifyReview(
    @Param('reviewId') reviewId: string,
    @Body() body: { verified: boolean },
  ): Promise<ReviewData> {
    return this.reviewService.verifyReview(reviewId, body.verified);
  }

  @Delete(':reviewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReview(@Param('reviewId') reviewId: string): Promise<void> {
    await this.reviewService.deleteReview(reviewId);
  }
}
