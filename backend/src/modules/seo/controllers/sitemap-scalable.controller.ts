import { Controller, Get, Header, Param, Logger } from '@nestjs/common';
import { SitemapScalableService } from '../services/sitemap-scalable.service';

@Controller('api/sitemap')
export class SitemapScalableController {
  private readonly logger = new Logger(SitemapScalableController.name);

  constructor(private readonly sitemapService: SitemapScalableService) {}

  /**
   * Index maître - Point d'entrée principal
   * GET /sitemap.xml
   */
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  async getMasterIndex() {
    this.logger.log('GET /sitemap.xml');
    return this.sitemapService.generateSitemap('master-index');
  }

  /**
   * Sous-index statique
   * GET /sitemap-static.xml
   */
  @Get('sitemap-static.xml')
  @Header('Content-Type', 'application/xml')
  async getStaticIndex() {
    this.logger.log('GET /sitemap-static.xml');
    return this.sitemapService.generateSitemap('static-index');
  }

  /**
   * Sous-index dynamique
   * GET /sitemap-dynamic.xml
   */
  @Get('sitemap-dynamic.xml')
  @Header('Content-Type', 'application/xml')
  async getDynamicIndex() {
    this.logger.log('GET /sitemap-dynamic.xml');
    return this.sitemapService.generateSitemap('dynamic-index');
  }

  /**
   * Sitemap pages statiques
   * GET /sitemap-pages.xml
   */
  @Get('sitemap-pages.xml')
  @Header('Content-Type', 'application/xml')
  async getPages() {
    this.logger.log('GET /sitemap-pages.xml');
    return this.sitemapService.generateSitemap('pages');
  }

  // ============================================================================
  // CATALOGUE
  // ============================================================================

  /**
   * Sous-index catalogue
   * GET /sitemap-catalog-index.xml
   */
  @Get('sitemap-catalog-index.xml')
  @Header('Content-Type', 'application/xml')
  async getCatalogIndex() {
    this.logger.log('GET /sitemap-catalog-index.xml');
    return this.sitemapService.generateSitemap('catalog-index');
  }

  /**
   * Sitemap constructeurs
   * GET /sitemap-constructeurs.xml
   */
  @Get('sitemap-constructeurs.xml')
  @Header('Content-Type', 'application/xml')
  async getConstructeurs() {
    this.logger.log('GET /sitemap-constructeurs.xml');
    return this.sitemapService.generateSitemap('constructeurs');
  }

  /**
   * Sitemap modèles A-M
   * GET /sitemap-modeles-a-m.xml
   */
  @Get('sitemap-modeles-a-m.xml')
  @Header('Content-Type', 'application/xml')
  async getModelesAM() {
    this.logger.log('GET /sitemap-modeles-a-m.xml');
    return this.sitemapService.generateSitemap('modeles-a-m');
  }

  /**
   * Sitemap modèles N-Z
   * GET /sitemap-modeles-n-z.xml
   */
  @Get('sitemap-modeles-n-z.xml')
  @Header('Content-Type', 'application/xml')
  async getModelesNZ() {
    this.logger.log('GET /sitemap-modeles-n-z.xml');
    return this.sitemapService.generateSitemap('modeles-n-z');
  }

  /**
   * Sitemap types (sharding numérique)
   * GET /sitemap-types-0-10000.xml
   * GET /sitemap-types-10001-20000.xml
   * etc.
   */
  @Get('sitemap-types-:range.xml')
  @Header('Content-Type', 'application/xml')
  async getTypes(@Param('range') range: string) {
    this.logger.log(`GET /sitemap-types-${range}.xml`);
    const configName = `types-${range}`;
    return this.sitemapService.generateSitemap(configName);
  }

  // ============================================================================
  // BLOG
  // ============================================================================

  /**
   * Sous-index blog
   * GET /sitemap-blog-index.xml
   */
  @Get('sitemap-blog-index.xml')
  @Header('Content-Type', 'application/xml')
  async getBlogIndex() {
    this.logger.log('GET /sitemap-blog-index.xml');
    return this.sitemapService.generateSitemap('blog-index');
  }

  /**
   * Sitemap blog par année
   * GET /sitemap-blog-2025.xml
   * GET /sitemap-blog-2024.xml
   * etc.
   */
  @Get('sitemap-blog-:year.xml')
  @Header('Content-Type', 'application/xml')
  async getBlogByYear(@Param('year') year: string) {
    this.logger.log(`GET /sitemap-blog-${year}.xml`);
    const configName = `blog-${year}`;
    return this.sitemapService.generateSitemap(configName);
  }

  // ============================================================================
  // PRODUITS
  // ============================================================================

  /**
   * Sous-index produits
   * GET /sitemap-products-index.xml
   */
  @Get('sitemap-products-index.xml')
  @Header('Content-Type', 'application/xml')
  async getProductsIndex() {
    this.logger.log('GET /sitemap-products-index.xml');
    return this.sitemapService.generateSitemap('products-index');
  }

  /**
   * Sitemap produits niveau 1
   * GET /sitemap-products-niveau1.xml
   */
  @Get('sitemap-products-niveau1.xml')
  @Header('Content-Type', 'application/xml')
  async getProductsNiveau1() {
    this.logger.log('GET /sitemap-products-niveau1.xml');
    return this.sitemapService.generateSitemap('products-niveau1');
  }

  /**
   * Sitemap produits niveau 2
   * GET /sitemap-products-niveau2.xml
   */
  @Get('sitemap-products-niveau2.xml')
  @Header('Content-Type', 'application/xml')
  async getProductsNiveau2() {
    this.logger.log('GET /sitemap-products-niveau2.xml');
    return this.sitemapService.generateSitemap('products-niveau2');
  }

  // ============================================================================
  // PIÈCES PRÉ-CALCULÉES (714k+ URLs depuis __sitemap_p_link)
  // ============================================================================

  /**
   * Sous-index pièces
   * GET /sitemap-pieces-index.xml
   */
  @Get('sitemap-pieces-index.xml')
  @Header('Content-Type', 'application/xml')
  async getPiecesIndex() {
    this.logger.log('GET /sitemap-pieces-index.xml');
    return this.sitemapService.generateSitemap('pieces-index');
  }

  /**
   * Sitemap pièces (sharding par 50k URLs)
   * GET /sitemap-pieces-0-50000.xml
   * GET /sitemap-pieces-50001-100000.xml
   * etc.
   */
  @Get('sitemap-pieces-:range.xml')
  @Header('Content-Type', 'application/xml')
  async getPieces(@Param('range') range: string) {
    this.logger.log(`GET /sitemap-pieces-${range}.xml`);
    const configName = `pieces-${range}`;
    return this.sitemapService.generateSitemap(configName);
  }
}
