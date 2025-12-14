import { Controller, Get, Header, Param, Logger } from '@nestjs/common';
import { SitemapScalableService } from '../services/sitemap-scalable.service';

/**
 * Contrôleur racine pour servir les sitemaps sans préfixe /api/sitemap
 * Routes accessibles directement depuis la racine du domaine:
 * - /sitemap.xml
 * - /sitemap-pieces-0-50000.xml
 * - etc.
 */
@Controller()
export class SitemapRootController {
  private readonly logger = new Logger(SitemapRootController.name);

  constructor(private readonly sitemapService: SitemapScalableService) {}

  // ============================================================================
  // INDEX PRINCIPAL
  // ============================================================================

  /**
   * Index maître - Point d'entrée principal
   * GET /sitemap.xml
   */
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=3600')
  async getMasterIndex() {
    this.logger.log('GET /sitemap.xml (root)');
    return this.sitemapService.generateSitemap('master-index');
  }

  /**
   * Index alternatif
   * GET /sitemap-index.xml
   */
  @Get('sitemap-index.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=3600')
  async getSitemapIndex() {
    this.logger.log('GET /sitemap-index.xml (root)');
    return this.sitemapService.generateSitemap('master-index');
  }

  // ============================================================================
  // SOUS-INDEX
  // ============================================================================

  @Get('sitemap-static.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=86400')
  async getStaticIndex() {
    this.logger.log('GET /sitemap-static.xml (root)');
    return this.sitemapService.generateSitemap('static-index');
  }

  @Get('sitemap-dynamic.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=1800')
  async getDynamicIndex() {
    this.logger.log('GET /sitemap-dynamic.xml (root)');
    return this.sitemapService.generateSitemap('dynamic-index');
  }

  @Get('sitemap-pages.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=604800')
  async getPages() {
    this.logger.log('GET /sitemap-pages.xml (root)');
    return this.sitemapService.generateSitemap('pages');
  }

  // ============================================================================
  // CATALOGUE
  // ============================================================================

  @Get('sitemap-catalog-index.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=3600')
  async getCatalogIndex() {
    this.logger.log('GET /sitemap-catalog-index.xml (root)');
    return this.sitemapService.generateSitemap('catalog-index');
  }

  @Get('sitemap-constructeurs.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=7200')
  async getConstructeurs() {
    this.logger.log('GET /sitemap-constructeurs.xml (root)');
    return this.sitemapService.generateSitemap('constructeurs');
  }

  @Get('sitemap-modeles-a-m.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=7200')
  async getModelesAM() {
    this.logger.log('GET /sitemap-modeles-a-m.xml (root)');
    return this.sitemapService.generateSitemap('modeles-a-m');
  }

  @Get('sitemap-modeles-n-z.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=7200')
  async getModelesNZ() {
    this.logger.log('GET /sitemap-modeles-n-z.xml (root)');
    return this.sitemapService.generateSitemap('modeles-n-z');
  }

  @Get('sitemap-types-:range.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=21600')
  async getTypes(@Param('range') range: string) {
    this.logger.log(`GET /sitemap-types-${range}.xml (root)`);
    const configName = `types-${range}`;
    return this.sitemapService.generateSitemap(configName);
  }

  // ============================================================================
  // BLOG
  // ============================================================================

  @Get('sitemap-blog-index.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=3600')
  async getBlogIndex() {
    this.logger.log('GET /sitemap-blog-index.xml (root)');
    return this.sitemapService.generateSitemap('blog-index');
  }

  @Get('sitemap-blog-:year.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=7200')
  async getBlogByYear(@Param('year') year: string) {
    this.logger.log(`GET /sitemap-blog-${year}.xml (root)`);
    const configName = `blog-${year}`;
    return this.sitemapService.generateSitemap(configName);
  }

  // ============================================================================
  // PRODUITS
  // ============================================================================

  @Get('sitemap-products-index.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=3600')
  async getProductsIndex() {
    this.logger.log('GET /sitemap-products-index.xml (root)');
    return this.sitemapService.generateSitemap('products-index');
  }

  @Get('sitemap-products-niveau1.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=7200')
  async getProductsNiveau1() {
    this.logger.log('GET /sitemap-products-niveau1.xml (root)');
    return this.sitemapService.generateSitemap('products-niveau1');
  }

  @Get('sitemap-products-niveau2.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=7200')
  async getProductsNiveau2() {
    this.logger.log('GET /sitemap-products-niveau2.xml (root)');
    return this.sitemapService.generateSitemap('products-niveau2');
  }

  // ============================================================================
  // PIECES (714k+ URLs depuis __sitemap_p_link)
  // ============================================================================

  @Get('sitemap-pieces-index.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=3600')
  async getPiecesIndex() {
    this.logger.log('GET /sitemap-pieces-index.xml (root)');
    return this.sitemapService.generateSitemap('pieces-index');
  }

  /**
   * Sitemap pieces (sharding par 50k URLs)
   * GET /sitemap-pieces-0-50000.xml
   * GET /sitemap-pieces-50001-100000.xml
   * etc.
   */
  @Get('sitemap-pieces-:range.xml')
  @Header('Content-Type', 'application/xml')
  @Header('Cache-Control', 'public, max-age=14400')
  async getPieces(@Param('range') range: string) {
    this.logger.log(`GET /sitemap-pieces-${range}.xml (root)`);
    const configName = `pieces-${range}`;
    return this.sitemapService.generateSitemap(configName);
  }
}
