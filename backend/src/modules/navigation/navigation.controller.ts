import { Controller, Get, Query, Logger, Delete } from '@nestjs/common';
import { NavigationService } from './navigation.service';
import { CommercialMenuService } from './services/commercial-menu.service';
import { ExpeditionMenuService } from './services/expedition-menu.service';
import { SeoMenuService } from './services/seo-menu.service';

@Controller('navigation')
export class NavigationController {
  private readonly logger = new Logger(NavigationController.name);

  constructor(
    private readonly navigationService: NavigationService,
    private readonly commercialMenuService: CommercialMenuService,
    private readonly expeditionMenuService: ExpeditionMenuService,
    private readonly seoMenuService: SeoMenuService,
  ) {}

  /**
   * GET /navigation
   * Récupère la navigation principale selon le contexte
   */
  @Get()
  async getNavigation(
    @Query('context') context: 'admin' | 'user' | 'commercial' = 'user',
  ) {
    try {
      this.logger.log(`Récupération navigation pour contexte: ${context}`);

      const navigation =
        await this.navigationService.getMainNavigation(context);

      return {
        success: true,
        data: navigation,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération de la navigation:',
        error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération de la navigation',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /navigation/commercial
   * Menu spécialisé commercial
   */
  @Get('commercial')
  async getCommercialMenu() {
    try {
      this.logger.log('Récupération menu commercial');

      const menu = await this.commercialMenuService.getMenu();

      return {
        success: true,
        data: menu,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur menu commercial:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération du menu commercial',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /navigation/expedition
   * Menu spécialisé expédition
   */
  @Get('expedition')
  async getExpeditionMenu() {
    try {
      this.logger.log('Récupération menu expédition');

      const menu = await this.expeditionMenuService.getMenu();

      return {
        success: true,
        data: menu,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur menu expédition:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération du menu expédition',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /navigation/seo
   * Menu optimisé SEO
   */
  @Get('seo')
  async getSeoMenu() {
    try {
      this.logger.log('Récupération menu SEO');

      const menu = await this.seoMenuService.getMenu();

      return {
        success: true,
        data: menu,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur menu SEO:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération du menu SEO',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * DELETE /navigation/cache
   * Invalide le cache de navigation
   */
  @Delete('cache')
  async invalidateCache(@Query('context') context?: string) {
    try {
      this.logger.log(`Invalidation cache navigation: ${context || 'tous'}`);

      await this.navigationService.invalidateCache(context);

      return {
        success: true,
        message: `Cache invalidé pour ${context || 'tous les contextes'}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur invalidation cache:', error);
      return {
        success: false,
        error: "Erreur lors de l'invalidation du cache",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * GET /navigation/menu/:module
   * Récupère un menu structuré par module
   */
  @Get('menu/:module')
  async getMenuByModule(
    @Query('module')
    module: 'admin' | 'commercial' | 'seo' | 'expedition' | 'staff',
    @Query('userRole') userRole?: string,
    @Query('userId') userId?: string,
  ) {
    try {
      this.logger.log(`Récupération menu pour module: ${module}`);

      const menuItems = await this.navigationService.getMenuByModule({
        module,
        userRole,
        userId,
      });

      return {
        success: true,
        data: {
          module,
          items: menuItems,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur récupération menu module:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération du menu',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
