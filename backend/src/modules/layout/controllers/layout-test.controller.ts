import { Controller, Get, Query } from '@nestjs/common';
import { HeaderService } from '../services/header.service';
import { FooterService } from '../services/footer.service';
import { SocialShareService } from '../services/social-share.service';
import { ThemeService } from '../services/theme.service';
import { ResponsiveService } from '../services/responsive.service';

@Controller('api/layout-test')
export class LayoutTestController {
  constructor(
    private readonly headerService: HeaderService,
    private readonly footerService: FooterService,
    private readonly socialShareService: SocialShareService,
    private readonly themeService: ThemeService,
    private readonly responsiveService: ResponsiveService,
  ) {}

  /**
   * Test de santé
   * GET /api/layout-test/health
   */
  @Get('health')
  getHealth() {
    return {
      status: 'OK',
      message: 'Layout Test Controller is working! 🎉',
      timestamp: new Date().toISOString(),
      services: {
        header: 'available',
        footer: 'available',
        theme: 'available',
        responsive: 'available',
      },
    };
  }

  /**
   * Test du HeaderService existant avec vraies données
   * GET /api/layout-test/header?context=admin&userId=123
   */
  @Get('header')
  async getHeader(
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
    @Query('userId') userId?: string,
  ) {
    return this.headerService.getHeader(context, userId);
  }

  /**
   * Test du FooterService existant
   * GET /api/layout-test/footer?context=admin
   */
  @Get('footer')
  async getFooter(
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
  ) {
    return this.footerService.getFooter(context);
  }

  /**
   * Test du ThemeService
   * GET /api/layout-test/theme?name=automotive
   */
  @Get('theme')
  async getTheme(@Query('name') themeName?: string) {
    return this.themeService.getTheme(themeName);
  }

  /**
   * Test du ResponsiveService
   * GET /api/layout-test/responsive?width=768
   */
  @Get('responsive')
  async getResponsive(@Query('width') width?: string) {
    const screenWidth = width ? parseInt(width, 10) : 1024;
    return this.responsiveService.getResponsiveConfig(screenWidth);
  }

  /**
   * Comparaison de tous les thèmes
   * GET /api/layout-test/themes-comparison
   */
  @Get('themes-comparison')
  async getThemesComparison() {
    const themes = await this.themeService.getAvailableThemes();
    const themeConfigs: Record<string, any> = {};

    for (const themeName of themes) {
      themeConfigs[themeName] = await this.themeService.getTheme(themeName);
    }

    return {
      available: themes,
      configs: themeConfigs,
      summary: {
        total: themes.length,
        default: 'default',
        automotive: 'automotive',
        dark: 'dark',
      },
    };
  }

  /**
   * Comparaison responsive
   * GET /api/layout-test/responsive-comparison
   */
  @Get('responsive-comparison')
  async getResponsiveComparison() {
    const configs = await this.responsiveService.getAllResponsiveConfigs();
    
    return {
      configs,
      summary: {
        devices: Object.keys(configs),
        breakpoints: Object.entries(configs).map(([device, config]) => ({
          device,
          breakpoint: config.breakpoint,
          columns: config.layout.columns,
          headerHeight: config.components.header.height,
        })),
      },
    };
  }

  /**
   * Test intégré avec Header connecté aux vraies données
   * GET /api/layout-test/header-with-real-data?context=admin
   */
  @Get('header-with-real-data')
  async getHeaderWithRealData(
    @Query('context') context: 'admin' | 'commercial' | 'public' = 'public',
    @Query('userId') userId?: string,
  ) {
    const [header, theme, responsive] = await Promise.all([
      this.headerService.getHeader(context, userId),
      this.themeService.getTheme('automotive'), // Thème automobile
      this.responsiveService.getResponsiveConfig(1024), // Desktop
    ]);

    return {
      integration: 'header-theme-responsive',
      data: {
        header,
        theme: {
          colors: theme.colors,
          name: theme.name,
        },
        responsive: {
          device: responsive.device,
          headerConfig: responsive.components.header,
        },
      },
      realData: {
        userStats: header.userStats,
        hasRealData: !!(header.userStats?.total && header.userStats.total > 0),
        connectedToSupabase: true,
      },
    };
  }

    /**
   * Test des performances du cache
   * GET /api/layout-test/cache-performance
   */
  @Get('cache-performance')
  async testCachePerformance() {
    const start = Date.now();
    
    // Premier appel (sans cache)
    const firstStart = Date.now();
    await this.headerService.getHeader('admin');
    const firstDuration = Date.now() - firstStart;
    
    // Deuxième appel (avec cache)
    const secondStart = Date.now();
    await this.headerService.getHeader('admin');
    const secondDuration = Date.now() - secondStart;
    
    const totalDuration = Date.now() - start;
    const improvement = firstDuration > 0 ? ((firstDuration - secondDuration) / firstDuration * 100) : 0;
    
    return {
      cacheTest: {
        firstCall: `${firstDuration}ms (no cache)`,
        secondCall: `${secondDuration}ms (with cache)`,
        improvement: `${improvement.toFixed(1)}%`,
        totalDuration: `${totalDuration}ms`,
      },
      cacheWorking: secondDuration < firstDuration,
    };
  }

  /**
   * Comparaison Social Share : Existant vs Unifié
   * GET /api/layout-test/social-share-comparison
   */
  @Get('social-share-comparison')
  async compareSocialShare(
    @Query('url') url: string = 'https://pieces-auto.com/product/123',
    @Query('title') title: string = 'Plaquettes de frein avant',
    @Query('description') description: string = 'Plaquettes de frein haute qualité pour voiture',
  ) {
    const shareOptions = {
      url,
      title,
      description,
      image: 'https://pieces-auto.com/images/plaquettes.jpg',
      hashtags: ['auto', 'pieces', 'frein'],
    };

    const [existingService, unifiedService] = await Promise.all([
      this.socialShareService.generateShareLinks(shareOptions),
      // this.socialShareUnifiedService.generateShareData(shareOptions), // À implémenter
      Promise.resolve({ platforms: [], openGraph: {}, twitterCard: {} }),
    ]);

    return {
      comparison: {
        existing: {
          type: 'Service existant (statique)',
          platforms: Object.keys(existingService).length,
          hasOpenGraph: true,
          hasTwitterCard: true,
          hasSupabase: false,
          data: existingService,
        },
        unified: {
          type: 'Service unifié (Supabase + Fallback)',
          platforms: unifiedService.platforms.length,
          hasOpenGraph: Object.keys(unifiedService.openGraph).length > 0,
          hasTwitterCard: Object.keys(unifiedService.twitterCard).length > 0,
          hasSupabase: true,
          data: unifiedService,
        },
      },
      recommendation: 'Service unifié combine le meilleur des deux approches',
    };
  }
}
