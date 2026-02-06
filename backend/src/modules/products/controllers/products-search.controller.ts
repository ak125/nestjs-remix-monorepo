import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ProductsService } from '../products.service';
import { PricingService } from '../services/pricing.service';
import { VehicleSearchDto, PopularProductsDto } from '../dto';
import {
  VehicleSearchSchema,
  PopularProductsSchema,
} from '../schemas/product.schemas';
import { ZodQueryValidationPipe } from '../../../common/pipes/zod-query-validation.pipe';

@ApiTags('Products Search')
@Controller('api/products')
@UseInterceptors(CacheInterceptor)
export class ProductsSearchController {
  private readonly logger = new Logger(ProductsSearchController.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Recherche produits pour ProductSearch component
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
  @CacheTTL(60)
  async searchProducts(
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ) {
    try {
      if (!query || query.trim().length < 2) {
        return { results: [] };
      }

      const searchLimit = limit ? Math.min(parseInt(limit, 10), 50) : 10;

      this.logger.log(`Recherche produits: "${query}" (limit: ${searchLimit})`);

      const results = await this.productsService.searchProducts(
        query,
        searchLimit,
      );

      this.logger.log(`Trouvé ${results.length} résultats pour "${query}"`);

      return { results };
    } catch (error) {
      this.logger.error(`Erreur recherche produits: ${error.message}`);
      return { results: [] };
    }
  }

  /**
   * Rechercher des pièces par véhicule
   * MUST be before search/:reference to avoid route conflict
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
        query.modelId || 0,
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
   * Recherche par référence — trouve une pièce par sa référence
   */
  @Get('search/:reference')
  @CacheTTL(300)
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
  @CacheTTL(300)
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
}
