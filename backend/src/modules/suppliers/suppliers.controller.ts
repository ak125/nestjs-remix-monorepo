import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Logger,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

@Controller('api/suppliers')
export class SuppliersController {
  private readonly logger = new Logger(SuppliersController.name);

  constructor(private readonly suppliersService: SuppliersService) {}

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
   * Désactiver un fournisseur
   */
  @Post(':id/deactivate')
  async deactivateSupplier(@Param('id') supplierId: string) {
    try {
      await this.suppliersService.deactivateSupplier(parseInt(supplierId));
      return {
        success: true,
        message: 'Fournisseur désactivé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error deactivating supplier:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Créer un nouveau fournisseur
   */
  @Post('create')
  async createSupplier(@Body() supplierData: any) {
    try {
      const supplier = await this.suppliersService.createSupplier(supplierData);
      return {
        success: true,
        data: supplier,
        message: 'Fournisseur créé avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error creating supplier:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Désactiver un fournisseur
   */

  /**
   * Obtenir un fournisseur avec ses articles et marques (version détaillée)
   */
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
  async testSupplierLinks() {
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

  /**
   * Lier un fournisseur à une marque
   */
  @Post('link/:supplierId/brand/:brandId')
  async linkSupplierToBrand(
    @Param('supplierId') supplierId: string,
    @Param('brandId') brandId: string,
    @Body() options: any = {},
  ) {
    try {
      const link = await this.suppliersService.linkSupplierToBrand(
        parseInt(supplierId),
        parseInt(brandId),
        options,
      );
      return {
        success: true,
        data: link,
        message: 'Liaison fournisseur-marque créée avec succès',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error linking supplier to brand:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Trouver le meilleur fournisseur pour un produit
   */
  @Post('best-for-product/:productId')
  async findBestSupplierForProduct(
    @Param('productId') productId: string,
    @Body() criteria: any = {},
  ) {
    try {
      const result = await this.suppliersService.findBestSupplierForProduct(
        parseInt(productId),
        criteria,
      );
      return {
        success: true,
        data: result,
        message: result
          ? 'Meilleur fournisseur trouvé'
          : 'Aucun fournisseur approprié trouvé',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error finding best supplier for product:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Attribution automatique de fournisseurs pour plusieurs produits
   */
  @Post('auto-assign')
  async autoAssignSuppliers(
    @Body() requestData: { productIds: number[]; criteria?: any },
  ) {
    try {
      const { productIds, criteria = {} } = requestData;

      if (!productIds || productIds.length === 0) {
        return {
          success: false,
          error: 'La liste des IDs de produits est requise',
          timestamp: new Date().toISOString(),
        };
      }

      const results = await this.suppliersService.autoAssignSuppliers(
        productIds,
        criteria,
      );

      const successCount = results.length;
      const totalCount = productIds.length;

      return {
        success: true,
        data: {
          results,
          summary: {
            totalProducts: totalCount,
            successfulAssignments: successCount,
            failedAssignments: totalCount - successCount,
          },
        },
        message: `Attribution terminée: ${successCount}/${totalCount} produits traités`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error auto-assigning suppliers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Test d'attribution automatique avec données d'exemple
   */
  @Get('test/auto-assign')
  async testAutoAssignment() {
    try {
      // IDs de produits d'exemple
      const testProductIds = [1, 2, 3, 4, 5];

      const testCriteria = {
        maxDeliveryTime: 10,
        minDiscountRate: 5,
        isPreferred: false,
      };

      const results = await this.suppliersService.autoAssignSuppliers(
        testProductIds,
        testCriteria,
      );

      return {
        success: true,
        data: {
          testProductIds,
          testCriteria,
          results,
          summary: {
            totalProducts: testProductIds.length,
            successfulAssignments: results.length,
            averageScore:
              results.length > 0
                ? results.reduce((sum, r) => sum + r.score, 0) / results.length
                : 0,
          },
        },
        message: "Test d'attribution automatique terminé",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error testing auto assignment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Analyser un fournisseur spécifique
   */
  @Get('analyze/:id')
  async analyzeSupplier(@Param('id') id: string) {
    try {
      const supplier = await this.suppliersService.getSupplierById(
        parseInt(id),
      );

      // Test avec un produit d'exemple
      const testProductId = 1;
      const score = await this.suppliersService.findBestSupplierForProduct(
        testProductId,
        {},
      );

      return {
        success: true,
        data: {
          supplier,
          testProductScore: score?.supplier.id === parseInt(id) ? score : null,
          analysis: {
            hasDiscount: (supplier.discount_rate || 0) > 0,
            fastDelivery: (supplier.delivery_delay || 0) <= 7,
            isActive: supplier.is_active,
            hasContactInfo: !!(supplier.email || supplier.phone),
            hasAddress: !!(supplier.address1 && supplier.city),
          },
        },
        message: 'Analyse du fournisseur terminée',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Error analyzing supplier ${id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
