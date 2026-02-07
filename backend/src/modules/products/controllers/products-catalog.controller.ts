import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  Logger,
  UseInterceptors,
} from '@nestjs/common';
import { OperationFailedException } from '../../../common/exceptions';
import { ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ProductsCatalogService } from '../services/products-catalog.service';
import { ProductsAdminService } from '../services/products-admin.service';
import { SearchProductDto } from '../dto';
import { SearchProductSchema } from '../schemas/product.schemas';
import { ZodQueryValidationPipe } from '../../../common/pipes/zod-query-validation.pipe';
import { mapSortField } from './products-controller.utils';

@ApiTags('Products Catalog')
@Controller('api/products')
@UseInterceptors(CacheInterceptor)
export class ProductsCatalogController {
  private readonly logger = new Logger(ProductsCatalogController.name);

  constructor(
    private readonly catalogService: ProductsCatalogService,
    private readonly adminService: ProductsAdminService,
  ) {}

  /**
   * Récupérer toutes les gammes de pièces
   */
  @Get('gammes')
  async getGammes() {
    return this.catalogService.getGammes();
  }

  /**
   * Récupérer les produits d'une gamme spécifique avec pagination
   */
  @Get('gammes/:gammeId/products')
  @CacheTTL(300)
  async getProductsByGamme(
    @Param('gammeId') gammeId: string,
    @Query(new ZodQueryValidationPipe(SearchProductSchema))
    queryParams: SearchProductDto,
  ) {
    try {
      this.logger.log(
        `Recherche produits pour gamme ID: "${gammeId}" avec filtres:`,
        queryParams,
      );

      const options = {
        gammeId,
        search: queryParams.search || '',
        page: queryParams.page || 1,
        limit: Math.min(queryParams.limit || 24, 100),
        sortBy: mapSortField(queryParams.sortBy || 'name'),
        sortOrder: queryParams.sortOrder || 'asc',
      };

      const result = await this.adminService.findProductsByGamme(options);

      this.logger.log(
        `Trouvé ${result.pagination.total} produits pour gamme ${gammeId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche produits gamme ${gammeId}:`,
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la recherche des produits',
      });
    }
  }

  /**
   * Récupérer toutes les marques automobiles
   */
  @Get('brands')
  async getBrands() {
    return this.catalogService.getBrands();
  }

  /**
   * Récupérer les modèles d'une marque
   */
  @Get('brands/:brandId/models')
  @CacheTTL(600)
  async getModels(@Param('brandId', ParseIntPipe) brandId: number) {
    try {
      this.logger.log(`Récupération des modèles pour la marque ${brandId}`);
      const result = await this.catalogService.getModels(brandId);
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des modèles pour la marque ${brandId}:`,
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des modèles',
      });
    }
  }

  /**
   * Récupérer les types d'un modèle
   */
  @Get('models/:modelId/types')
  @CacheTTL(600)
  async getTypes(@Param('modelId', ParseIntPipe) modelId: number) {
    try {
      this.logger.log(`Récupération des types pour le modèle ${modelId}`);
      const result = await this.catalogService.getTypes(modelId);
      return result;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la récupération des types pour le modèle ${modelId}:`,
        error,
      );
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des types',
      });
    }
  }

  /**
   * Obtenir les statistiques des produits
   */
  @Get('stats')
  async getStats() {
    return this.catalogService.getStats();
  }
}
