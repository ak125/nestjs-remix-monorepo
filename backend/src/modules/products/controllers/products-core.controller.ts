import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UsePipes,
  Logger,
  UseInterceptors,
} from '@nestjs/common';
import { OperationFailedException } from '../../../common/exceptions';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ProductsService } from '../products.service';
import { StockService } from '../services/stock.service';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateStockDto,
  SearchProductDto,
} from '../dto';
import {
  CreateProductSchema,
  UpdateProductSchema,
  UpdateStockSchema,
} from '../schemas/product.schemas';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';

@ApiTags('Products')
@Controller('api/products')
@UseInterceptors(CacheInterceptor)
export class ProductsCoreController {
  private readonly logger = new Logger(ProductsCoreController.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly stockService: StockService,
  ) {}

  /**
   * Récupérer toutes les pièces avec filtres
   */
  @Get('pieces')
  async getPieces(@Query() filters: SearchProductDto) {
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
  async findAll(@Query() filters: SearchProductDto) {
    return this.productsService.findAll(filters);
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
      throw new OperationFailedException({
        message: 'Erreur lors de la création du produit',
      });
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
      throw new OperationFailedException({
        message: 'Erreur lors de la mise à jour du produit',
      });
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
      throw new OperationFailedException({
        message: 'Erreur lors de la mise à jour du stock',
      });
    }
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
    } catch (error: unknown) {
      this.logger.warn(
        `Impossible de récupérer le stock pour le produit ${id}:`,
        error instanceof Error ? error.message : error,
      );
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
}
