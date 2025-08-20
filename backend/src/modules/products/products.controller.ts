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
} from '@nestjs/common';
import { ProductsService } from './products.service';

// Interfaces simples pour les DTOs
interface CreateProductDto {
  name: string;
  sku: string;
  description?: string;
  price?: number;
  stock_quantity?: number;
  range_id?: number;
  brand_id?: number;
  is_active?: boolean;
}

interface UpdateProductDto extends Partial<CreateProductDto> {}

/**
 * Contrôleur Products adapté aux vraies tables de la base de données
 * Utilise les tables : pieces, pieces_gamme, auto_marque, etc.
 */
@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

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
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  /**
   * Mettre à jour une pièce
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
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
  async updateStock(
    @Param('id') id: string,
    @Body('quantity') quantity: number,
  ) {
    return this.productsService.updateStock(id, quantity);
  }

  /**
   * Rechercher des pièces par véhicule
   */
  @Get('search/vehicle')
  async searchByVehicle(@Query() query: any) {
    return this.productsService.searchByVehicle(
      query.brandId,
      query.modelId,
      query.typeId,
    );
  }

  /**
   * Récupérer les modèles d'une marque
   */
  @Get('brands/:brandId/models')
  async getModels(@Param('brandId', ParseIntPipe) brandId: number) {
    return this.productsService.getModels(brandId);
  }

  /**
   * Récupérer les types d'un modèle
   */
  @Get('models/:modelId/types')
  async getTypes(@Param('modelId', ParseIntPipe) modelId: number) {
    return this.productsService.getTypes(modelId);
  }

  /**
   * Récupérer les pièces populaires
   */
  @Get('popular')
  async getPopularProducts(@Query('limit') limit?: number) {
    return this.productsService.getPopularProducts(limit);
  }
}
