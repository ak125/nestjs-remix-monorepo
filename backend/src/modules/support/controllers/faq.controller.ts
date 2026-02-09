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
import { FaqService, FAQ, FAQCategory } from '../services/faq.service';
import {
  DomainNotFoundException,
  ErrorCodes,
} from '../../../common/exceptions';

@Controller('api/support/faq')
export class FaqController {
  private readonly logger = new Logger(FaqController.name);

  constructor(private readonly faqService: FaqService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createFAQ(
    @Body()
    faqData: Omit<
      FAQ,
      'id' | 'helpful' | 'notHelpful' | 'views' | 'lastUpdated'
    >,
  ): Promise<FAQ> {
    this.logger.log('Creating FAQ');
    return this.faqService.createFAQ(faqData);
  }

  @Get()
  async getAllFAQs(
    @Query('category') category?: string,
    @Query('published') published?: string,
    @Query('tags') tags?: string,
    @Query('search') search?: string,
  ): Promise<FAQ[]> {
    const filters = {
      category,
      published: published !== undefined ? published === 'true' : undefined,
      tags: tags ? tags.split(',') : undefined,
      search,
    };

    return this.faqService.getAllFAQs(filters);
  }

  @Get('stats')
  async getFAQStats() {
    return this.faqService.getFAQStats();
  }

  @Get('categories')
  async getAllCategories(
    @Query('published') published?: string,
  ): Promise<FAQCategory[]> {
    const publishedOnly = published === 'true';
    return this.faqService.getAllCategories(publishedOnly);
  }

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(
    @Body() categoryData: Omit<FAQCategory, 'faqCount'>,
  ): Promise<FAQCategory> {
    return this.faqService.createCategory(categoryData);
  }

  @Get('categories/:categoryId')
  async getCategory(
    @Param('categoryId') categoryId: string,
  ): Promise<FAQCategory> {
    const category = await this.faqService.getCategory(categoryId);
    if (!category) {
      throw new DomainNotFoundException({
        message: `Category ${categoryId} not found`,
        code: ErrorCodes.SUPPORT.FAQ_CATEGORY_NOT_FOUND,
      });
    }
    return category;
  }

  @Put('categories/:categoryId')
  async updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() updates: Partial<Omit<FAQCategory, 'faqCount'>>,
  ): Promise<FAQCategory> {
    return this.faqService.updateCategory(categoryId, updates);
  }

  @Delete('categories/:categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Param('categoryId') categoryId: string): Promise<void> {
    await this.faqService.deleteCategory(categoryId);
  }

  @Get(':faqId')
  async getFAQ(
    @Param('faqId') faqId: string,
    @Query('incrementView') incrementView?: string,
  ): Promise<FAQ> {
    const shouldIncrementView = incrementView === 'true';
    const faq = await this.faqService.getFAQ(faqId, shouldIncrementView);
    if (!faq) {
      throw new DomainNotFoundException({
        message: `FAQ ${faqId} not found`,
        code: ErrorCodes.SUPPORT.FAQ_NOT_FOUND,
      });
    }
    return faq;
  }

  @Put(':faqId')
  async updateFAQ(
    @Param('faqId') faqId: string,
    @Body()
    updates: Partial<Omit<FAQ, 'id' | 'helpful' | 'notHelpful' | 'views'>>,
  ): Promise<FAQ> {
    return this.faqService.updateFAQ(faqId, updates);
  }

  @Delete(':faqId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFAQ(@Param('faqId') faqId: string): Promise<void> {
    await this.faqService.deleteFAQ(faqId);
  }

  @Put(':faqId/helpful')
  async markHelpful(
    @Param('faqId') faqId: string,
    @Body() body: { helpful: boolean },
  ): Promise<FAQ> {
    return this.faqService.markHelpful(faqId, body.helpful);
  }
}
