import { Controller, Get, Query, Param, Post, Body } from '@nestjs/common';
import { LayoutService, LayoutConfig } from '../services/layout.service';
import { HeaderService } from '../services/header.service';
import { FooterService } from '../services/footer.service';
import { QuickSearchService } from '../services/quick-search.service';
import { SocialShareService } from '../services/social-share.service';
import { MetaTagsService } from '../services/meta-tags.service';

@Controller('api/layout')
export class LayoutController {
  constructor(
    private readonly layoutService: LayoutService,
    private readonly headerService: HeaderService,
    private readonly footerService: FooterService,
    private readonly quickSearchService: QuickSearchService,
    private readonly socialShareService: SocialShareService,
    private readonly metaTagsService: MetaTagsService,
  ) {}

  /**
   * Obtient la configuration complète du layout
   * GET /layout?context=admin&user=123
   */
  @Get()
  async getLayout(
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
    @Query('user') userId?: string,
  ) {
    return this.layoutService.getLayoutData(context, userId);
  }

  /**
   * Obtient les données du header
   * GET /layout/header?context=admin&user=123
   */
  @Get('header')
  async getHeader(
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
    @Query('user') userId?: string,
  ) {
    return this.headerService.getHeader(context, userId);
  }

  /**
   * 🆕 Obtient les données du header avec support multi-versions
   * GET /layout/header/advanced?type=main
   */
  @Get('header/advanced')
  async getAdvancedHeader(@Query('type') type: string = 'main') {
    return this.headerService.getHeaderData(type);
  }

  /**
   * Obtient les données du footer
   * GET /layout/footer?context=admin
   */
  @Get('footer')
  async getFooter(
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
  ) {
    return this.footerService.getFooter(context);
  }

  /**
   * Recherche rapide
   * GET /layout/search?q=iphone&context=public&limit=10
   */
  @Get('search')
  async quickSearch(
    @Query('q') query: string,
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
    @Query('limit') limit = 10,
  ) {
    if (!query) {
      return [];
    }
    return this.quickSearchService.quickSearch(query, context, Number(limit));
  }

  /**
   * Obtient les données pour l'interface de recherche
   * GET /layout/search-data?context=public
   */
  @Get('search-data')
  async getSearchData(
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
  ) {
    return this.quickSearchService.getSearchData(context);
  }

  /**
   * Génère les liens de partage social
   * GET /layout/share?url=https://example.com&title=Mon Article
   */
  @Get('share')
  async generateShareLinks(
    @Query('url') url: string,
    @Query('title') title: string,
    @Query('description') description?: string,
    @Query('image') image?: string,
    @Query('hashtags') hashtags?: string,
  ) {
    if (!url || !title) {
      throw new Error('URL et titre sont requis');
    }

    const shareData = {
      url,
      title,
      description,
      image,
      hashtags: hashtags ? hashtags.split(',') : undefined,
    };

    return this.socialShareService.generateShareLinks(shareData);
  }

  /**
   * Génère les boutons de partage
   * GET /layout/share-buttons?url=https://example.com&title=Mon Article
   */
  @Get('share-buttons')
  async generateShareButtons(
    @Query('url') url: string,
    @Query('title') title: string,
    @Query('description') description?: string,
    @Query('image') image?: string,
    @Query('hashtags') hashtags?: string,
    @Query('showCounts') showCounts = false,
  ) {
    if (!url || !title) {
      throw new Error('URL et titre sont requis');
    }

    const shareData = {
      url,
      title,
      description,
      image,
      hashtags: hashtags ? hashtags.split(',') : undefined,
    };

    return this.socialShareService.generateShareButtons(
      shareData,
      Boolean(showCounts),
    );
  }

  /**
   * Génère les meta tags pour une page
   * GET /layout/meta/:pageType?title=Mon Titre&description=Ma Description
   */
  @Get('meta/:pageType')
  async generateMetaTags(
    @Param('pageType') pageType: string,
    @Query('title') title?: string,
    @Query('description') description?: string,
    @Query('keywords') keywords?: string,
    @Query('author') author?: string,
    @Query('image') image?: string,
    @Query('canonical') canonical?: string,
  ) {
    const metaData = {
      title,
      description,
      keywords: keywords ? keywords.split(',') : undefined,
      author,
      image: image ? { url: image, alt: title || '' } : undefined,
      canonical,
    };

    return this.metaTagsService.generateMetaTags(pageType, metaData);
  }

  /**
   * Génère les balises HTML des meta tags
   * GET /layout/meta-html/:pageType
   */
  @Get('meta-html/:pageType')
  async generateMetaHtml(
    @Param('pageType') pageType: string,
    @Query('title') title?: string,
    @Query('description') description?: string,
    @Query('keywords') keywords?: string,
    @Query('author') author?: string,
    @Query('image') image?: string,
    @Query('canonical') canonical?: string,
  ) {
    const metaData = {
      title,
      description,
      keywords: keywords ? keywords.split(',') : undefined,
      author,
      image: image ? { url: image, alt: title || '' } : undefined,
      canonical,
    };

    const metaTags = await this.metaTagsService.generateMetaTags(
      pageType,
      metaData,
    );
    const htmlTags = this.metaTagsService.generateHtmlTags(metaTags);

    return {
      html: htmlTags.join('\n'),
      tags: htmlTags,
    };
  }

  /**
   * ✨ NOUVEAUX ENDPOINTS AVANCÉS
   * Obtient la configuration avancée du layout avec support multi-versions
   * POST /layout/advanced
   */
  @Post('advanced')
  async getAdvancedLayout(@Body() config: LayoutConfig) {
    return this.layoutService.getAdvancedLayoutData(config);
  }

  /**
   * Invalide le cache layout pour un type donné
   * POST /layout/invalidate-cache
   */
  @Post('invalidate-cache')
  async invalidateCache(
    @Body() body: { type?: string; context?: string; userId?: string },
  ) {
    if (body.type) {
      await this.layoutService.invalidateTypeCache(body.type);
    } else if (body.context) {
      await this.layoutService.invalidateCache(body.context, body.userId);
    }
    return { success: true, message: 'Cache invalidé avec succès' };
  }

  /**
   * Obtient les configurations par défaut pour tous les types
   * GET /layout/defaults
   */
  @Get('defaults')
  async getDefaultConfigs() {
    const contexts: ('admin' | 'commercial' | 'public')[] = [
      'admin',
      'commercial',
      'public',
    ];
    const defaults: Record<string, any> = {};

    for (const context of contexts) {
      defaults[context] = await this.layoutService.getLayoutData(context);
    }

    return defaults;
  }
}
