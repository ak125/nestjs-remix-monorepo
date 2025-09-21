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
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ProductsService } from './products.service';
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
@Controller('api/products')
@UseInterceptors(CacheInterceptor)
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(private readonly productsService: ProductsService) {}

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
   * Récupérer des produits réels enrichis avec pagination
   */
  @Get('catalog-real')
  async getRealCatalog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const options = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 50) : 12,
      search: search || '',
    };
    return this.productsService.getRealCatalog(options);
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
   * Récupérer une pièce par ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
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
}
