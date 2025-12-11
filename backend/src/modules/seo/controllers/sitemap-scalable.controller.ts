import { Controller, Get, Header, Param, Logger } from '@nestjs/common';
import { SitemapScalableService } from '../services/sitemap-scalable.service';

@Controller('sitemap-v2')
export class SitemapScalableController {
  private readonly logger = new Logger(SitemapScalableController.name);

  constructor(private readonly sitemapService: SitemapScalableService) {}

  /**
   * Index maître - Point d'entrée principal
   * GET /sitemap-v2/sitemap-index.xml
   */
  @Get('sitemap-index.xml')
  @Header('Content-Type', 'application/xml')
  async getMasterIndex() {
    this.logger.log('GET /sitemap-v2/sitemap-index.xml');
    return this.sitemapService.generateSitemap('master-index');
  }

  /**
   * Sous-index statique
   * GET /sitemap-v2/sitemap-static.xml
   */
  @Get('sitemap-static.xml')
  @Header('Content-Type', 'application/xml')
  async getStaticIndex() {
    this.logger.log('GET /sitemap-v2/sitemap-static.xml');
    return this.sitemapService.generateSitemap('static-index');
  }

  /**
   * Sous-index dynamique
   * GET /sitemap-v2/sitemap-dynamic.xml
   */
  @Get('sitemap-dynamic.xml')
  @Header('Content-Type', 'application/xml')
  async getDynamicIndex() {
    this.logger.log('GET /sitemap-v2/sitemap-dynamic.xml');
    return this.sitemapService.generateSitemap('dynamic-index');
  }

  /**
   * Sitemap pages statiques
   * GET /sitemap-v2/sitemap-pages.xml
   */
  @Get('sitemap-pages.xml')
  @Header('Content-Type', 'application/xml')
  async getPages() {
    this.logger.log('GET /sitemap-v2/sitemap-pages.xml');
    return this.sitemapService.generateSitemap('pages');
  }

  // ============================================================================
  // CATALOGUE
  // ============================================================================

  /**
   * Sous-index catalogue
   * GET /sitemap-v2/sitemap-catalog-index.xml
   */
  @Get('sitemap-catalog-index.xml')
  @Header('Content-Type', 'application/xml')
  async getCatalogIndex() {
    this.logger.log('GET /sitemap-v2/sitemap-catalog-index.xml');
    return this.sitemapService.generateSitemap('catalog-index');
  }

  /**
   * Sitemap constructeurs
   * GET /sitemap-v2/sitemap-constructeurs.xml
   */
  @Get('sitemap-constructeurs.xml')
  @Header('Content-Type', 'application/xml')
  async getConstructeurs() {
    this.logger.log('GET /sitemap-v2/sitemap-constructeurs.xml');
    return this.sitemapService.generateSitemap('constructeurs');
  }

  /**
   * Sitemap modèles A-M
   * GET /sitemap-v2/sitemap-modeles-a-m.xml
   */
  @Get('sitemap-modeles-a-m.xml')
  @Header('Content-Type', 'application/xml')
  async getModelesAM() {
    this.logger.log('GET /sitemap-v2/sitemap-modeles-a-m.xml');
    return this.sitemapService.generateSitemap('modeles-a-m');
  }

  /**
   * Sitemap modèles N-Z
   * GET /sitemap-v2/sitemap-modeles-n-z.xml
   */
  @Get('sitemap-modeles-n-z.xml')
  @Header('Content-Type', 'application/xml')
  async getModelesNZ() {
    this.logger.log('GET /sitemap-v2/sitemap-modeles-n-z.xml');
    return this.sitemapService.generateSitemap('modeles-n-z');
  }

  /**
   * Sitemap types (sharding numérique)
   * GET /sitemap-v2/sitemap-types-0-10000.xml
   * GET /sitemap-v2/sitemap-types-10001-20000.xml
   * etc.
   */
  @Get('sitemap-types-:range.xml')
  @Header('Content-Type', 'application/xml')
  async getTypes(@Param('range') range: string) {
    this.logger.log(`GET /sitemap-v2/sitemap-types-${range}.xml`);
    const configName = `types-${range}`;
    return this.sitemapService.generateSitemap(configName);
  }

  // ============================================================================
  // BLOG
  // ============================================================================

  /**
   * Sous-index blog
   * GET /sitemap-v2/sitemap-blog-index.xml
   */
  @Get('sitemap-blog-index.xml')
  @Header('Content-Type', 'application/xml')
  async getBlogIndex() {
    this.logger.log('GET /sitemap-v2/sitemap-blog-index.xml');
    return this.sitemapService.generateSitemap('blog-index');
  }

  /**
   * Sitemap blog par année
   * GET /sitemap-v2/sitemap-blog-2025.xml
   * GET /sitemap-v2/sitemap-blog-2024.xml
   * etc.
   */
  @Get('sitemap-blog-:year.xml')
  @Header('Content-Type', 'application/xml')
  async getBlogByYear(@Param('year') year: string) {
    this.logger.log(`GET /sitemap-v2/sitemap-blog-${year}.xml`);
    const configName = `blog-${year}`;
    return this.sitemapService.generateSitemap(configName);
  }

  // ============================================================================
  // PRODUITS
  // ============================================================================

  /**
   * Sous-index produits
   * GET /sitemap-v2/sitemap-products-index.xml
   */
  @Get('sitemap-products-index.xml')
  @Header('Content-Type', 'application/xml')
  async getProductsIndex() {
    this.logger.log('GET /sitemap-v2/sitemap-products-index.xml');
    return this.sitemapService.generateSitemap('products-index');
  }

  /**
   * Sitemap produits niveau 1
   * GET /sitemap-v2/sitemap-products-niveau1.xml
   */
  @Get('sitemap-products-niveau1.xml')
  @Header('Content-Type', 'application/xml')
  async getProductsNiveau1() {
    this.logger.log('GET /sitemap-v2/sitemap-products-niveau1.xml');
    return this.sitemapService.generateSitemap('products-niveau1');
  }

  /**
   * Sitemap produits niveau 2
   * GET /sitemap-v2/sitemap-products-niveau2.xml
   */
  @Get('sitemap-products-niveau2.xml')
  @Header('Content-Type', 'application/xml')
  async getProductsNiveau2() {
    this.logger.log('GET /sitemap-v2/sitemap-products-niveau2.xml');
    return this.sitemapService.generateSitemap('products-niveau2');
  }

  // ============================================================================
  // PIÈCES PRÉ-CALCULÉES (714k+ URLs depuis __sitemap_p_link)
  // ============================================================================

  /**
   * Sous-index pièces
   * GET /sitemap-v2/sitemap-pieces-index.xml
   */
  @Get('sitemap-pieces-index.xml')
  @Header('Content-Type', 'application/xml')
  async getPiecesIndex() {
    this.logger.log('GET /sitemap-v2/sitemap-pieces-index.xml');
    return this.sitemapService.generateSitemap('pieces-index');
  }

  /**
   * Sitemap pièces (sharding par 50k URLs)
   * GET /sitemap-v2/sitemap-pieces-0-50000.xml
   * GET /sitemap-v2/sitemap-pieces-50001-100000.xml
   * etc.
   */
  @Get('sitemap-pieces-:range.xml')
  @Header('Content-Type', 'application/xml')
  async getPieces(@Param('range') range: string) {
    this.logger.log(`GET /sitemap-v2/sitemap-pieces-${range}.xml`);
    const configName = `pieces-${range}`;
    return this.sitemapService.generateSitemap(configName);
  }

  // ============================================================================
  // ENDPOINT GÉNÉRIQUE (DOIT ÃŠTRE EN DERNIER)
  // ============================================================================

  /**
   * Endpoint générique pour tester n'importe quel sitemap
   * GET /sitemap-v2/:name
   * ⚠️ DOIT ÃŠTRE EN DERNIER car il capture tout
   */
  @Get(':name')
  @Header('Content-Type', 'application/xml')
  async getGeneric(@Param('name') name: string) {
    // Retirer .xml si présent
    const configName = name.replace('.xml', '');
    this.logger.log(`GET /sitemap-v2/${name} ←’ config: ${configName}`);
    return this.sitemapService.generateSitemap(configName);
  }
}
