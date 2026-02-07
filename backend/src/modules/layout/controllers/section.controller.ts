import { Controller, Get, Query, Param } from '@nestjs/common';
import { HeaderService } from '../services/header.service';
import { FooterService } from '../services/footer.service';
import { QuickSearchService } from '../services/quick-search.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';

@Controller('layout/sections')
export class SectionController {
  constructor(
    private readonly headerService: HeaderService,
    private readonly footerService: FooterService,
    private readonly quickSearchService: QuickSearchService,
  ) {}

  /**
   * Obtient une section spécifique du layout
   * GET /layout/sections/header?context=admin&user=123
   */
  @Get(':section')
  async getSection(
    @Param('section') section: string,
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
  ) {
    switch (section) {
      case 'header':
        return this.headerService.getHeader(context);
      case 'footer':
        return this.footerService.getFooter(context);
      case 'search-data':
        return this.quickSearchService.getSearchData(context);
      default:
        throw new DatabaseException({
          code: ErrorCodes.LAYOUT.SECTION_NOT_SUPPORTED,
          message: `Section ${section} non supportée`,
        });
    }
  }

  /**
   * Obtient le header avec des options personnalisées
   * GET /layout/sections/header/custom?context=admin&showActions=false
   */
  @Get('header/custom')
  async getCustomHeader(
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
    @Query('showActions') showActions = true,
    @Query('showNotifications') showNotifications = true,
    @Query('showBreadcrumbs') showBreadcrumbs = true,
  ) {
    const header = await this.headerService.getHeader(context);

    // Personnaliser le header selon les paramètres
    if (!showActions && 'actions' in header) {
      (header as Record<string, unknown>).actions = [];
    }
    if (!showNotifications && 'notifications' in header) {
      (header as Record<string, unknown>).notifications = undefined;
    }
    if (!showBreadcrumbs && 'breadcrumbs' in header) {
      (header as Record<string, unknown>).breadcrumbs = [];
    }

    return header;
  }

  /**
   * Obtient le footer avec options
   * GET /layout/sections/footer/custom?context=public&showNewsletter=false
   */
  @Get('footer/custom')
  async getCustomFooter(
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
    @Query('showNewsletter') showNewsletter?: boolean,
    @Query('showSocial') showSocial = true,
    @Query('showLegal') showLegal = true,
  ) {
    const footer = await this.footerService.getFooter(context);

    // Personnaliser le footer
    if (showNewsletter !== undefined) {
      footer.showNewsletter = showNewsletter;
    }
    if (!showSocial) {
      footer.social = [];
    }
    if (!showLegal) {
      footer.legal = [];
    }

    return footer;
  }

  /**
   * Recherche dans une section spécifique
   * GET /layout/sections/search?q=test&type=products
   */
  @Get('search/filtered')
  async searchInSection(
    @Query('q') query: string,
    @Query('type') type?: 'product' | 'category' | 'page' | 'user' | 'order',
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
    @Query('limit') limit = 10,
  ) {
    if (!query) {
      return [];
    }

    const results = await this.quickSearchService.quickSearch(
      query,
      context,
      Number(limit),
    );

    // Filtrer par type si spécifié
    if (type) {
      return results.filter((result) => result.type === type);
    }

    return results;
  }
}
