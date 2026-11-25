import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Logger,
  ParseIntPipe,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { User } from '@common/decorators/user.decorator';
import { ZodValidationPipe } from '@common/pipes/zod-validation.pipe';
import { SuppliersService } from './suppliers.service';
import { SupplierCardService } from './supplier-card.service';
import {
  CreatePriceRuleSchema,
  CreateSupplierCardSchema,
  PutBrandSourcesSchema,
  UpdateSupplierCardSchema,
  type CreatePriceRuleDto,
  type CreateSupplierCardDto,
  type PutBrandSourcesDto,
  type UpdateSupplierCardDto,
} from './dto/supplier.schemas';

/** Auteur d'une écriture de fiche : l'id de l'admin connecté, jamais un nom codé. */
function actorOf(userId: unknown): string {
  const id =
    userId === null || userId === undefined ? '' : String(userId).trim();
  if (!id) throw new UnauthorizedException('Utilisateur non identifié');
  return id;
}

/**
 * Fournisseurs : routes réservées aux administrateurs (lecture, bon de
 * commande, désactivation). Le seul client HTTP est la page
 * `admin.suppliers.$id.tsx`, qui exige déjà un admin.
 */
@Controller('api/suppliers')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class SuppliersController {
  private readonly logger = new Logger(SuppliersController.name);

  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly supplierCards: SupplierCardService,
  ) {}

  // ===== FICHE FOURNISSEUR (mandat CH) =====
  // Écritures sous AuthenticatedGuard + IsAdminGuard (classe). Aucune route ne
  // lit ni ne sert la valeur d'un secret : la fiche porte le nom et l'état.

  @Get(':id/card')
  getCard(@Param('id') id: string) {
    return this.supplierCards.getCard(id);
  }

  @Post('card')
  createCard(
    @Body(new ZodValidationPipe(CreateSupplierCardSchema))
    body: CreateSupplierCardDto,
    @User('id') userId: unknown,
  ) {
    return this.supplierCards.createCard(body, actorOf(userId));
  }

  @Put(':id/card')
  updateCard(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSupplierCardSchema))
    body: UpdateSupplierCardDto,
    @User('id') userId: unknown,
  ) {
    return this.supplierCards.updateCard(id, body, actorOf(userId));
  }

  /** Validation humaine de la localisation (jamais automatique). */
  @Post(':id/location-validation')
  async validateLocation(@Param('id') id: string, @User('id') userId: unknown) {
    await this.supplierCards.validateLocation(id, actorOf(userId));
    return { success: true, id };
  }

  /**
   * Règle de remise / marge fournisseur × marque × famille ou sous-famille
   * (complément CH-2). Écrite dans supplier_price_profiles comme ligne
   * 'condition' (complément CH-3), non lue par le calcul des prix
   * (branchement : mandat séparé).
   */
  @Post(':id/price-rules')
  createPriceRule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreatePriceRuleSchema))
    body: CreatePriceRuleDto,
    @User('id') userId: unknown,
  ) {
    return this.supplierCards.createPriceRule(id, body, actorOf(userId));
  }

  /** Retrait d'une règle : active = false, sans suppression. */
  @Post(':id/price-rules/:ruleId/retire')
  async retirePriceRule(
    @Param('id') id: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @User('id') userId: unknown,
  ) {
    await this.supplierCards.retirePriceRule(id, ruleId, actorOf(userId));
    return { success: true, id: ruleId };
  }

  // ===== SOURCES D'ACHAT PAR MARQUE (mandat DQ) =====
  // Liste ordonnée des fiches qui fournissent une marque (plateforme puis
  // direct), point de livraison, nature et surcoût. Non lue par les prix.

  @Get('brands/:pmId/sources')
  getBrandSources(@Param('pmId') pmId: string) {
    return this.supplierCards.getBrandSources(pmId);
  }

  /** Remplace la liste entière : rang = position, auteur tracé. */
  @Put('brands/:pmId/sources')
  putBrandSources(
    @Param('pmId') pmId: string,
    @Body(new ZodValidationPipe(PutBrandSourcesSchema))
    body: PutBrandSourcesDto,
    @User('id') userId: unknown,
  ) {
    return this.supplierCards.putBrandSources(pmId, body, actorOf(userId));
  }

  /**
   * Test global du service fournisseurs
   */
  @Get('test')
  async testSuppliersGlobal() {
    try {
      const testResult = await this.suppliersService.testSuppliersService();
      return {
        success: true,
        data: testResult,
        message: 'Test du service fournisseurs terminé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error testing suppliers service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tester le service fournisseurs
   */
  @Get('test/service')
  async testSuppliersService() {
    try {
      const testResult = await this.suppliersService.testSuppliersService();
      return {
        success: true,
        data: testResult,
        message: 'Test du service fournisseurs terminé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error testing suppliers service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Générer un bon de commande fournisseur
   */
  @Post(':id/purchase-order')
  async generatePurchaseOrder(
    @Param('id') supplierId: string,
    @Body() { items }: { items: any[] },
  ) {
    try {
      const purchaseOrder = await this.suppliersService.generatePurchaseOrder(
        parseInt(supplierId),
        items,
      );
      return {
        success: true,
        data: purchaseOrder,
        message: 'Bon de commande généré avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error generating purchase order:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Obtenir les fournisseurs d'un produit
   */
  @Get('product/:productId')
  async getProductSuppliers(@Param('productId') productId: string) {
    try {
      const suppliers =
        await this.suppliersService.getProductSuppliers(productId);
      return {
        success: true,
        data: suppliers,
        message: 'Fournisseurs du produit récupérés avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting product suppliers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Retirer un fournisseur : `spl_status = 'archive'` et `spl_display = '0'`
   * (sans DELETE ; liens et prix intacts). 404 si l'id n'existe pas.
   */
  @Post(':id/deactivate')
  async deactivateSupplier(
    @Param('id') supplierId: string,
    @User('id') userId: unknown,
  ) {
    await this.supplierCards.deactivateSupplier(supplierId, actorOf(userId));
    return {
      success: true,
      message: 'Fournisseur archivé',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/details')
  async getSupplierDetails(@Param('id') id: string) {
    try {
      const supplier = await this.suppliersService.getSupplierById(
        parseInt(id),
      );
      const links = await this.suppliersService.getSupplierLinks(parseInt(id));

      // Grouper par type (marques vs articles)
      const brands = links.filter((link) => link.type === 'brand');
      const articles = links.filter((link) => link.type === 'article');

      return {
        success: true,
        data: {
          supplier,
          brands,
          articles,
          statistics: {
            totalBrands: brands.length,
            activeBrands: brands.filter((b) => b.isActive).length,
            totalArticles: articles.length,
            activeArticles: articles.filter((a) => a.isActive).length,
          },
        },
        message: 'Détails du fournisseur récupérés avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting supplier details:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Route par défaut pour lister tous les fournisseurs (pour le dashboard)
   */
  @Get()
  async getAllSuppliers() {
    try {
      // Utiliser la même logique que la route /all mais simplifiée pour le dashboard
      const result = await this.suppliersService.getSuppliers({
        page: 1,
        limit: 1000, // Récupérer tous les suppliers pour les stats
        search: '',
        isActive: true,
      });

      return {
        success: true,
        suppliers: result.items || [],
        total: result.total || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting all suppliers:', error);
      return {
        success: false,
        suppliers: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Récupérer tous les fournisseurs avec filtres
   */
  @Get('all')
  async getSuppliers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('brandId') brandId?: string,
  ) {
    try {
      const options = {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        search,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        brandId: brandId ? parseInt(brandId) : undefined,
      };

      const result = await this.suppliersService.getSuppliers(options);
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting suppliers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Tester les liens d'un fournisseur
   */
  @Get('test-links/:id')
  async testSupplierLinks(@Param('id') id: string) {
    try {
      const links = await this.suppliersService.getSupplierLinks(id);

      return {
        success: true,
        data: {
          supplierId: id,
          linksCount: links.length,
          links: links.slice(0, 3), // Juste les 3 premiers pour test
        },
        message: 'Liens du fournisseur récupérés',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting supplier links ${id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test des liens pour debug
   */
  @Get('test-links')
  async testAllSupplierLinks() {
    try {
      const testResult = await this.suppliersService.testSupplierLinksTable();

      return {
        success: true,
        data: testResult,
        message: 'Test de la table liens terminé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error testing supplier links:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test de la table pieces_gamme pour debug
   */
  @Get('test-gammes')
  async testGammes() {
    try {
      const testResult = await this.suppliersService.testPiecesGammeTable();

      return {
        success: true,
        data: testResult,
        message: 'Test de la table pieces_gamme terminé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error testing pieces_gamme:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
  @Get('test-marques')
  async testMarques() {
    try {
      const testResult = await this.suppliersService.testPiecesMarqueTable();

      return {
        success: true,
        data: testResult,
        message: 'Test de la table pieces_marque terminé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error testing pieces_marque:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
  @Get('test-pieces')
  async testPieces() {
    try {
      const testResult = await this.suppliersService.testPiecesTable();

      return {
        success: true,
        data: testResult,
        message: 'Test de la table pieces terminé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error testing pieces:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Récupérer un fournisseur par ID (simple)
   */
  @Get('simple/:id')
  async getSupplierSimple(@Param('id') id: string) {
    try {
      const supplier = await this.suppliersService.getSupplierById(id);

      return {
        success: true,
        data: supplier,
        message: 'Fournisseur récupéré avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting supplier ${id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Récupérer un fournisseur par ID avec ses liens
   */
  @Get('details/:id')
  async getSupplierById(@Param('id') id: string) {
    try {
      const supplier = await this.suppliersService.getSupplierById(id);
      const links = await this.suppliersService.getSupplierLinks(id);
      const stats = await this.suppliersService.getSupplierStatistics(id);

      return {
        success: true,
        data: {
          ...supplier,
          links,
          statistics: stats,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error getting supplier ${id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
