import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UsePipes,
  HttpException,
  HttpStatus,
  Logger,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ProductsService } from './products.service';
import { StockService } from './services/stock.service';
import { PricingService } from './services/pricing.service';
import {
  CreateProductDto,
  UpdateProductDto,
  SearchProductDto,
  UpdateStockDto,
  VehicleSearchDto,
  PopularProductsDto,
} from './dto';
import {
  CreateProductSchema,
  UpdateProductSchema,
  SearchProductSchema,
  UpdateStockSchema,
  VehicleSearchSchema,
  PopularProductsSchema,
} from './schemas/product.schemas';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ZodQueryValidationPipe } from '../../common/pipes/zod-query-validation.pipe';

/**
 * Contrôleur Products adapté aux vraies tables de la base de données
 * Utilise les tables : pieces, pieces_gamme, auto_marque, etc.
 *
 * Améliorations ajoutées :
 * - Validation avec Zod schemas
 * - Cache Redis pour les endpoints fréquents
 * - Logging structuré
 * - Gestion d'erreurs améliorée
 * - Types stricts pour les DTOs
 */
@ApiTags('products')
@Controller('api/products')
@UseInterceptors(CacheInterceptor)
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly stockService: StockService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Mapper les noms de champs de l'API vers les noms de colonnes en base de données
   */
  private mapSortField(apiField: string): string {
    const fieldMapping: Record<string, string> = {
      name: 'piece_name',
      sku: 'piece_ref',
      price: 'piece_price',
      stock_quantity: 'piece_stock',
      created_at: 'piece_id', // Utiliser piece_id comme proxy pour l'ordre de création
      updated_at: 'piece_id', // Utiliser piece_id comme proxy
    };

    return fieldMapping[apiField] || 'piece_name'; // Défaut : piece_name
  }

  /**
   * Debug - Vérifier le contenu des tables
   */
  @Get('debug/tables')
  async debugTables() {
    return this.productsService.debugTables();
  }

  /**
   * Récupérer toutes les gammes de pièces
   */
  @Get('gammes')
  async getGammes() {
    return this.productsService.getGammes();
  }

  /**
   * Récupérer les produits d'une gamme spécifique avec pagination
   * Cache: 5 minutes pour améliorer les performances
   */
  @Get('gammes/:gammeId/products')
  @CacheTTL(300) // 5 minutes de cache
  async getProductsByGamme(
    @Param('gammeId') gammeId: string,
    @Query(new ZodQueryValidationPipe(SearchProductSchema))
    queryParams: SearchProductDto,
  ) {
    try {
      this.logger.log(
        `🔍 [DEBUG] Recherche produits pour gamme ID: "${gammeId}" (type: ${typeof gammeId}) avec filtres:`,
        queryParams,
      );

      const options = {
        gammeId,
        search: queryParams.search || '',
        page: queryParams.page || 1,
        limit: Math.min(queryParams.limit || 24, 100), // Limitation max 100
        sortBy: this.mapSortField(queryParams.sortBy || 'name'),
        sortOrder: queryParams.sortOrder || 'asc',
      };

      const result = await this.productsService.findProductsByGamme(options);

      this.logger.log(
        `Trouvé ${result.pagination.total} produits pour gamme ${gammeId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche produits gamme ${gammeId}:`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la recherche des produits',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test simple des marques
   */
  @Get('brands-test')
  async getBrandsTest() {
    return this.productsService.getBrandsTest();
  }

  /**
   * 🔍 PHASE 9: Recherche produits pour ProductSearch component
   * Endpoint: GET /api/products/search?query=...&limit=10
   */
  @Get('search')
  @ApiOperation({
    summary: 'Search products by name or reference',
    description:
      'Full-text search across product catalog. Returns up to 50 results. Cached for 1 minute.',
  })
  @ApiQuery({
    name: 'query',
    required: true,
    description: 'Search term (min 2 characters)',
    example: 'plaquettes frein',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum results (max 50)',
    example: '10',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results found',
    schema: {
      example: {
        results: [
          {
            id: 123,
            name: 'Plaquettes de frein avant',
            reference: 'PF-001',
            price: 45.99,
            stock: 15,
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameter',
  })
  @CacheTTL(60) // Cache 1 minute
  async searchProducts(
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ) {
    try {
      if (!query || query.trim().length < 2) {
        return { results: [] };
      }

      const searchLimit = limit ? Math.min(parseInt(limit, 10), 50) : 10;

      this.logger.log(
        `🔍 Recherche produits: "${query}" (limit: ${searchLimit})`,
      );

      const results = await this.productsService.searchProducts(
        query,
        searchLimit,
      );

      this.logger.log(`✅ Trouvé ${results.length} résultats pour "${query}"`);

      return { results };
    } catch (error) {
      this.logger.error(`❌ Erreur recherche produits: ${error.message}`);
      return { results: [] }; // Retourner tableau vide plutôt qu'erreur
    }
  }

  /**
   * Récupérer toutes les marques automobiles
   */
  @Get('brands')
  async getBrands() {
    return this.productsService.getBrands();
  }

  /**
   * Obtenir les statistiques des produits
   */
  @Get('stats')
  async getStats() {
    return this.productsService.getStats();
  }

  /**
   * DEBUG: Examiner la structure réelle des données
   */
  @Get('debug-real-data')
  async debugRealData() {
    return this.productsService.debugRealData();
  }

  /**
   * DEBUG: Analyser la distribution des stocks
   */
  @Get('debug-stock-distribution')
  async debugStockDistribution() {
    return this.productsService.debugStockDistribution();
  }

  /**
   * Récupérer toutes les pièces avec filtres
   */
  @Get('pieces')
  async getPieces(@Query() filters: any) {
    return this.productsService.findAll(filters);
  }

  /**
   * Récupérer les vraies pièces avec pagination
   */
  @Get('pieces-catalog')
  async getPiecesCatalog(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const options = {
      search: search || '',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 24,
    };
    return this.productsService.findAllPieces(options);
  }

  /**
   * Récupérer toutes les pièces (endpoint principal)
   */
  @Get()
  async findAll(@Query() filters: any) {
    return this.productsService.findAll(filters);
  }

  /**
   * Récupérer une pièce par ID avec informations de stock
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get product details by ID',
    description:
      'Retrieve complete product information including stock availability, pricing, and specifications.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: '12345',
  })
  @ApiResponse({
    status: 200,
    description: 'Product details retrieved',
    schema: {
      example: {
        id: 12345,
        name: 'Plaquettes de frein avant',
        reference: 'PF-001',
        price: 45.99,
        description: 'Plaquettes haute performance',
        stock: {
          available: 15,
          reserved: 2,
          total: 17,
          status: 'in_stock',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
  })
  async findOne(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);

    // Ajouter les informations de stock au produit
    try {
      const stock = await this.stockService.getProductStock(id);
      return {
        ...product,
        stock,
      };
    } catch (error: any) {
      this.logger.warn(
        `Impossible de récupérer le stock pour le produit ${id}:`,
        error?.message || error,
      );
      // Retourner le produit sans info de stock en cas d'erreur
      return {
        ...product,
        stock: {
          available: 0,
          reserved: 0,
          total: 0,
          status: 'out_of_stock',
        },
      };
    }
  }

  /**
   * Créer une nouvelle pièce
   */
  @Post()
  @UsePipes(new ZodValidationPipe(CreateProductSchema))
  async create(@Body() createProductDto: CreateProductDto) {
    try {
      this.logger.log("Création d'un nouveau produit:", {
        name: createProductDto.name,
        sku: createProductDto.sku,
      });

      const result = await this.productsService.create(createProductDto);

      this.logger.log(`Produit créé avec succès: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error('Erreur lors de la création du produit:', error);
      throw new HttpException(
        'Erreur lors de la création du produit',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Mettre à jour une pièce
   */
  @Put(':id')
  @UsePipes(new ZodValidationPipe(UpdateProductSchema))
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    try {
      this.logger.log(`Mise à jour du produit ${id}:`, updateProductDto);

      const result = await this.productsService.update(id, updateProductDto);

      this.logger.log(`Produit ${id} mis à jour avec succès`);
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour du produit ${id}:`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la mise à jour du produit',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Supprimer une pièce
   */
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  /**
   * Mettre à jour le stock d'une pièce
   */
  @Put(':id/stock')
  @UsePipes(new ZodValidationPipe(UpdateStockSchema))
  async updateStock(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
  ) {
    try {
      this.logger.log(
        `Mise à jour du stock pour produit ${id}:`,
        updateStockDto,
      );

      const result = await this.productsService.updateStock(
        id,
        updateStockDto.quantity,
      );

      this.logger.log(`Stock du produit ${id} mis à jour avec succès`);
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour du stock du produit ${id}:`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la mise à jour du stock',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Rechercher des pièces par véhicule
   */
  @Get('search/vehicle')
  async searchByVehicle(
    @Query(new ZodQueryValidationPipe(VehicleSearchSchema))
    query: VehicleSearchDto,
  ) {
    try {
      this.logger.log('Recherche de pièces par véhicule:', query);

      const result = await this.productsService.searchByVehicle(
        query.brandId,
        query.modelId || 0, // Valeur par défaut si undefined
        query.typeId,
      );

      this.logger.log(`Trouvé ${result.length} pièces pour le véhicule`);
      return result;
    } catch (error) {
      this.logger.error('Erreur lors de la recherche par véhicule:', error);
      throw new HttpException(
        'Erreur lors de la recherche par véhicule',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les modèles d'une marque
   */
  @Get('brands/:brandId/models')
  @CacheTTL(600) // 10 minutes de cache pour les modèles
  async getModels(@Param('brandId', ParseIntPipe) brandId: number) {
    try {
      this.logger.log(`Récupération des modèles pour la marque ${brandId}`);
      const result = await this.productsService.getModels(brandId);
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des modèles pour la marque ${brandId}:`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des modèles',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les types d'un modèle
   */
  @Get('models/:modelId/types')
  @CacheTTL(600) // 10 minutes de cache pour les types
  async getTypes(@Param('modelId', ParseIntPipe) modelId: number) {
    try {
      this.logger.log(`Récupération des types pour le modèle ${modelId}`);
      const result = await this.productsService.getTypes(modelId);
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des types pour le modèle ${modelId}:`,
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des types',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔍 RECHERCHE PAR RÉFÉRENCE - Trouve une pièce par sa référence
   * @param reference - Référence de la pièce (ex: KTBWP8841)
   * @returns Données de la pièce et pricing si trouvé
   */
  @Get('search/:reference')
  @CacheTTL(300) // 5 minutes de cache
  async searchByReference(@Param('reference') reference: string) {
    try {
      this.logger.log(`Recherche par référence: ${reference}`);
      return await this.pricingService.searchByReference(reference);
    } catch (error) {
      this.logger.error(`Erreur recherche référence ${reference}:`, error);
      throw new HttpException(
        'Erreur lors de la recherche',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Récupérer les pièces populaires
   */
  @Get('popular')
  @CacheTTL(300) // 5 minutes de cache pour les produits populaires
  async getPopularProducts(
    @Query(new ZodQueryValidationPipe(PopularProductsSchema))
    query: PopularProductsDto = {},
  ) {
    try {
      this.logger.log('Récupération des produits populaires:', query);

      const result = await this.productsService.getPopularProducts(
        query.limit || 10,
      );

      this.logger.log(`Trouvé ${result.length} produits populaires`);
      return result;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des produits populaires:',
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération des produits populaires',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📋 Obtenir la liste de réapprovisionnement
   */
  @Get('inventory/reorder-list')
  @CacheTTL(60) // Cache 1 minute
  async getReorderList() {
    try {
      const reorderList = await this.stockService.getReorderList();
      return {
        success: true,
        count: reorderList.length,
        items: reorderList,
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération de la liste de réapprovisionnement:',
        error,
      );
      throw new HttpException(
        'Erreur lors de la récupération de la liste de réapprovisionnement',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 📊 Rapport d'inventaire global
   */
  @Get('inventory/report')
  @CacheTTL(300) // Cache 5 minutes
  async getInventoryReport() {
    try {
      const report = await this.stockService.getInventoryReport();
      return {
        success: true,
        report,
      };
    } catch (error) {
      this.logger.error(
        "Erreur lors de la génération du rapport d'inventaire:",
        error,
      );
      throw new HttpException(
        "Erreur lors de la génération du rapport d'inventaire",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔄 Simuler un réapprovisionnement (pour tests/démo)
   */
  @Post('inventory/restock/:id')
  async simulateRestock(
    @Param('id') id: string,
    @Body() body: { quantity: number },
  ) {
    try {
      const productId = parseInt(id, 10);
      const success = await this.stockService.simulateRestock(
        productId,
        body.quantity,
      );

      if (success) {
        return {
          success: true,
          message: `Réapprovisionnement de ${body.quantity} unités effectué`,
          productId,
        };
      } else {
        throw new HttpException(
          'Échec du réapprovisionnement',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    } catch (error) {
      this.logger.error('Erreur lors du réapprovisionnement:', error);
      throw new HttpException(
        'Erreur lors du réapprovisionnement',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Diagnostic des valeurs piece_activ dans la base
   */
  @Get('debug-piece-activ')
  async debugPieceActiv() {
    try {
      // Test différentes valeurs pour piece_activ
      const tests = [
        { name: 'String "1"', value: '1', type: 'string' },
        { name: 'Number 1', value: 1, type: 'number' },
        { name: 'String "0"', value: '0', type: 'string' },
        { name: 'Number 0', value: 0, type: 'number' },
        { name: 'Boolean true', value: true, type: 'boolean' },
        { name: 'Boolean false', value: false, type: 'boolean' },
      ];

      const results = [];

      for (const test of tests) {
        try {
          const { count } = await (this.productsService as any).client
            .from('pieces')
            .select('*', { count: 'exact', head: true })
            .eq('piece_activ', test.value);

          results.push({
            ...test,
            count: count || 0,
            success: true,
          });
        } catch (error) {
          results.push({
            ...test,
            count: 0,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        message: 'Diagnostic piece_activ terminé',
        tests: results,
        recommendation: results.filter((r) => r.count > 0),
      };
    } catch (error) {
      this.logger.error('Erreur dans debugPieceActiv:', error);
      throw new HttpException(
        'Erreur lors du diagnostic piece_activ',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🏪 INTERFACE COMMERCIALE - Liste produits avec prix/stock
   * Pour page /products/admin (level 3+)
   */
  @Get('admin/list')
  @CacheTTL(60) // Cache 1 minute
  async getProductsAdmin(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('isActive') isActive?: string,
    @Query('lowStock') lowStock?: string,
    @Query('gammeId') gammeId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
  ) {
    try {
      this.logger.log('🏪 GET /admin/list - Query params:', {
        search,
        page,
        limit,
        sortBy,
        sortOrder,
        isActive,
        lowStock,
        gammeId,
        brandId,
        categoryId,
      });

      const options = {
        search: search || '',
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? Math.min(parseInt(limit, 10), 100) : 50,
        sortBy: sortBy || 'piece_name',
        sortOrder: sortOrder || 'asc',
        isActive:
          isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        lowStock: lowStock === 'true',
        gammeId: gammeId ? parseInt(gammeId, 10) : undefined,
        categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
        brandId: brandId ? parseInt(brandId, 10) : undefined,
      };

      const result =
        await this.productsService.getProductsForCommercial(options);

      this.logger.log(
        `✅ Retourné ${result.products.length} produits (total: ${result.pagination.total})`,
      );
      return result;
    } catch (error) {
      this.logger.error('❌ Erreur getProductsAdmin:', error);
      throw new HttpException(
        'Erreur lors de la récupération des produits',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🔄 TOGGLE ACTIVATION - Activer/désactiver produit
   */
  @Put(':id/status')
  async toggleProductStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    try {
      this.logger.log(`🔄 Toggle status produit ${id} -> ${isActive}`);

      const result = await this.productsService.toggleProductStatus(
        id,
        isActive,
      );

      this.logger.log(`✅ Produit ${id} ${isActive ? 'activé' : 'désactivé'}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Erreur toggle status produit ${id}:`, error);
      throw new HttpException(
        'Erreur lors de la mise à jour du statut',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 🎯 FILTRES - Récupérer listes pour dropdowns
   */
  @Get('filters/lists')
  @CacheTTL(600) // Cache 10 minutes
  async getFilterLists(
    @Query('gammeId') gammeId?: string,
    @Query('brandId') brandId?: string,
  ) {
    try {
      this.logger.log('📋 Récupération listes filtres', {
        gammeId,
        brandId,
      });

      let gammes: any[] = [];
      let brands: any[] = [];

      // Logique de filtrage dynamique :
      // - Si SEULEMENT gammeId : filtrer les marques par gamme
      // - Si SEULEMENT brandId : filtrer les gammes par marque
      // - Si les deux OU aucun : retourner toutes les listes complètes
      if (gammeId && !brandId) {
        // Uniquement gamme sélectionnée, filtrer les marques
        [gammes, brands] = await Promise.all([
          this.productsService.getGammesForFilters(),
          this.productsService.getBrandsForGamme(parseInt(gammeId, 10)),
        ]);
      } else if (brandId && !gammeId) {
        // Uniquement marque sélectionnée, filtrer les gammes
        [gammes, brands] = await Promise.all([
          this.productsService.getGammesForBrand(parseInt(brandId, 10)),
          this.productsService.getPieceBrandsForFilters(),
        ]);
      } else {
        // Les deux filtres actifs OU aucun filtre : retourner toutes les listes
        [gammes, brands] = await Promise.all([
          this.productsService.getGammesForFilters(),
          this.productsService.getPieceBrandsForFilters(),
        ]);
      }

      this.logger.log(
        `✅ Listes: ${gammes.length} gammes, ${brands.length} marques`,
      );

      return {
        gammes,
        brands,
      };
    } catch (error) {
      this.logger.error('❌ Erreur getFilterLists:', error);
      throw new HttpException(
        'Erreur lors de la récupération des listes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
