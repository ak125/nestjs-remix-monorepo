import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  Logger,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { OperationFailedException } from '../../../common/exceptions';
import { AdminResponseInterceptor } from '../../../common/interceptors/admin-response.interceptor';
import { ApiTags } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ProductsService } from '../products.service';
import { ProductsCatalogService } from '../services/products-catalog.service';
import { ProductsAdminService } from '../services/products-admin.service';
import { getErrorMessage } from '../../../common/utils/error.utils';

@ApiTags('Products Admin')
@Controller('api/products')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
@UseInterceptors(CacheInterceptor, AdminResponseInterceptor)
export class ProductsAdminController {
  private readonly logger = new Logger(ProductsAdminController.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly catalogService: ProductsCatalogService,
    private readonly adminService: ProductsAdminService,
  ) {}

  /**
   * Debug - Vérifier le contenu des tables
   */
  @Get('debug/tables')
  async debugTables() {
    return this.catalogService.debugTables();
  }

  /**
   * DEBUG: Examiner la structure réelle des données
   */
  @Get('debug-real-data')
  async debugRealData() {
    return this.catalogService.debugRealData();
  }

  /**
   * DEBUG: Analyser la distribution des stocks
   */
  @Get('debug-stock-distribution')
  async debugStockDistribution() {
    return this.catalogService.debugStockDistribution();
  }

  /**
   * Diagnostic des valeurs piece_activ dans la base
   */
  @Get('debug-piece-activ')
  async debugPieceActiv() {
    try {
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
            error: getErrorMessage(error),
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
      throw new OperationFailedException({
        message: 'Erreur lors du diagnostic piece_activ',
      });
    }
  }

  /**
   * INTERFACE COMMERCIALE - Liste produits avec prix/stock
   */
  @Get('admin/list')
  @CacheTTL(60)
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
      this.logger.log('GET /admin/list - Query params:', {
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

      const result = await this.adminService.getProductsForCommercial(options);

      this.logger.log(
        `Retourné ${result.products.length} produits (total: ${result.pagination.total})`,
      );
      return result;
    } catch (error) {
      this.logger.error('Erreur getProductsAdmin:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des produits',
      });
    }
  }

  /**
   * TOGGLE ACTIVATION - Activer/désactiver produit
   */
  @Put(':id/status')
  async toggleProductStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    try {
      this.logger.log(`Toggle status produit ${id} -> ${isActive}`);

      const result = await this.adminService.toggleProductStatus(id, isActive);

      this.logger.log(`Produit ${id} ${isActive ? 'activé' : 'désactivé'}`);
      return result;
    } catch (error) {
      this.logger.error(`Erreur toggle status produit ${id}:`, error);
      throw new OperationFailedException({
        message: 'Erreur lors de la mise à jour du statut',
      });
    }
  }

  /**
   * FILTRES - Récupérer listes pour dropdowns
   */
  @Get('filters/lists')
  @CacheTTL(600)
  async getFilterLists(
    @Query('gammeId') gammeId?: string,
    @Query('brandId') brandId?: string,
  ) {
    try {
      this.logger.log('Récupération listes filtres', {
        gammeId,
        brandId,
      });

      let gammes: any[] = [];
      let brands: any[] = [];

      if (gammeId && !brandId) {
        [gammes, brands] = await Promise.all([
          this.adminService.getGammesForFilters(),
          this.adminService.getBrandsForGamme(parseInt(gammeId, 10)),
        ]);
      } else if (brandId && !gammeId) {
        [gammes, brands] = await Promise.all([
          this.adminService.getGammesForBrand(parseInt(brandId, 10)),
          this.adminService.getPieceBrandsForFilters(),
        ]);
      } else {
        [gammes, brands] = await Promise.all([
          this.adminService.getGammesForFilters(),
          this.adminService.getPieceBrandsForFilters(),
        ]);
      }

      this.logger.log(
        `Listes: ${gammes.length} gammes, ${brands.length} marques`,
      );

      return {
        gammes,
        brands,
      };
    } catch (error) {
      this.logger.error('Erreur getFilterLists:', error);
      throw new OperationFailedException({
        message: 'Erreur lors de la récupération des listes',
      });
    }
  }
}
