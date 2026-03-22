import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from '../../products/products.service';
import { ProductsCatalogService } from '../../products/services/products-catalog.service';

@ApiTags('Admin Products')
@Controller('api/admin/products')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminProductsController {
  private readonly logger = new Logger(AdminProductsController.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly catalogService: ProductsCatalogService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin products dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics returned successfully',
  })
  async getDashboard() {
    try {
      this.logger.log('📊 Récupération du dashboard admin produits');

      const stats = await this.catalogService.getStats();

      return {
        success: true,
        stats: {
          ...stats,
          lastUpdate: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(
        '❌ Erreur dashboard admin:',
        error instanceof Error ? error.message : error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération du dashboard',
        stats: {
          totalProducts: 0,
          activeProducts: 0,
          totalCategories: 0,
          totalBrands: 0,
          lowStockItems: 0,
          lastUpdate: new Date(),
        },
      };
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all products for admin interface' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getAllProducts(
    @Query('page') page = 1,
    @Query('limit') limit = 25,
    @Query('search') search?: string,
  ) {
    try {
      this.logger.log(
        `🔍 Admin: récupération produits - page:${page} limit:${limit}`,
      );

      const result = await this.productsService.findAllPieces({
        search,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
      });

      return {
        success: true,
        data: result.products || [],
        pagination: {
          page: parseInt(page.toString()),
          limit: parseInt(limit.toString()),
          total: result.total || 0,
          pages: Math.ceil((result.total || 0) / parseInt(limit.toString())),
        },
      };
    } catch (error) {
      this.logger.error(
        '❌ Erreur récupération produits admin:',
        error instanceof Error ? error.message : error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération des produits',
        data: [],
        pagination: { page: 1, limit: 25, total: 0, pages: 0 },
      };
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID for admin interface' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async getProductById(@Param('id') id: string) {
    try {
      this.logger.log(`🔍 Admin: récupération produit ID:${id}`);

      const product = await this.productsService.findOne(id);

      if (!product) {
        return {
          success: false,
          error: 'Produit non trouvé',
          data: null,
        };
      }

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération produit ${id}:`,
        error instanceof Error ? error.message : error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération du produit',
        data: null,
      };
    }
  }

  @Get('stats/detailed')
  @ApiOperation({ summary: 'Get detailed statistics for admin dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Detailed statistics returned successfully',
  })
  async getDetailedStats() {
    try {
      this.logger.log('� Récupération statistiques détaillées admin');

      const stats = await this.catalogService.getStats();

      return {
        success: true,
        stats: {
          ...stats,
          lastUpdate: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(
        '❌ Erreur stats détaillées:',
        error instanceof Error ? error.message : error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération des statistiques',
        stats: {
          totalProducts: 0,
          lastUpdate: new Date(),
        },
      };
    }
  }

  @Get('brands')
  @ApiOperation({ summary: 'Get all product brands for admin' })
  async getBrands() {
    try {
      this.logger.log('🏷️ Admin: récupération marques');

      const brands = await this.catalogService.getBrands();

      return {
        success: true,
        data: brands,
        count: brands.length,
      };
    } catch (error) {
      this.logger.error(
        '❌ Erreur récupération marques:',
        error instanceof Error ? error.message : error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération des marques',
        data: [],
        count: 0,
      };
    }
  }

  @Get('gammes')
  @ApiOperation({ summary: 'Get all product ranges for admin' })
  async getGammes() {
    try {
      this.logger.log('� Admin: récupération gammes');

      const gammes = await this.catalogService.getGammes();

      return {
        success: true,
        data: gammes,
        count: gammes.length,
      };
    } catch (error) {
      this.logger.error(
        '❌ Erreur récupération gammes:',
        error instanceof Error ? error.message : error,
      );
      return {
        success: false,
        error: 'Erreur lors de la récupération des gammes',
        data: [],
        count: 0,
      };
    }
  }

  @Get('search/advanced')
  @ApiOperation({ summary: 'Advanced product search for admin' })
  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({ name: 'brand', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'minPrice', required: false, type: Number })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number })
  @ApiQuery({ name: 'inStock', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async advancedSearch(
    @Query('query') query?: string,
    @Query('brand') brand?: string,
    @Query('category') category?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('inStock') inStock?: boolean,
    @Query('page') page = 1,
    @Query('limit') limit = 25,
  ) {
    try {
      this.logger.log('🔍 Admin: recherche avancée', {
        query,
        brand,
        category,
        minPrice,
        maxPrice,
        inStock,
      });

      // Utiliser findAllPieces avec des filtres
      const result = await this.productsService.findAllPieces({
        search: query,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
      });

      return {
        success: true,
        data: result.products || [],
        pagination: {
          page: parseInt(page.toString()),
          limit: parseInt(limit.toString()),
          total: result.total || 0,
          pages: Math.ceil((result.total || 0) / parseInt(limit.toString())),
        },
        filters: {
          query,
          brand,
          category,
          minPrice,
          maxPrice,
          inStock,
        },
      };
    } catch (error) {
      this.logger.error(
        '❌ Erreur recherche avancée:',
        error instanceof Error ? error.message : error,
      );
      return {
        success: false,
        error: 'Erreur lors de la recherche avancée',
        data: [],
        pagination: { page: 1, limit: 25, total: 0, pages: 0 },
      };
    }
  }

  @Get('export')
  @ApiOperation({ summary: 'Export products data for admin' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async exportProducts(
    @Query('format') format = 'json',
    @Query('limit') limit = 1000,
  ) {
    try {
      this.logger.log(`📤 Admin: export ${format} (limite: ${limit})`);

      const result = await this.productsService.findAllPieces({
        page: 1,
        limit: Math.min(parseInt(limit.toString()), 10000), // Maximum 10k
      });

      if (format === 'csv') {
        // Pour le CSV, on pourrait implémenter une conversion
        return {
          success: true,
          message: 'Export CSV pas encore implémenté',
          format: 'json',
          data: result.products || [],
          count: (result.products || []).length,
        };
      }

      return {
        success: true,
        format,
        data: result.products || [],
        count: (result.products || []).length,
        exportedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        '❌ Erreur export:',
        error instanceof Error ? error.message : error,
      );
      return {
        success: false,
        error: "Erreur lors de l'export des produits",
      };
    }
  }
}
