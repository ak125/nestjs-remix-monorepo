import { Injectable, Logger } from '@nestjs/common';
import { ProductsService } from '../../products/products.service';
import { CreateProductDto, UpdateProductDto } from '../../products/dto';
import {
  AdminBulkOperationsDto,
  AdminProductFiltersDto,
} from '../dto/admin-products.dto';

@Injectable()
export class AdminProductsService {
  private readonly logger = new Logger(AdminProductsService.name);

  constructor(private readonly productsService: ProductsService) {}

  async getGeneralStats() {
    try {
      // Simuler des statistiques générales - À remplacer par de vraies requêtes
      return {
        totalProducts: 1250,
        activeProducts: 1100,
        inactiveProducts: 150,
        archivedProducts: 25,
        totalStock: 25000,
        totalValue: 450000,
        averagePrice: 125.5,
        lowStockCount: 45,
        outOfStockCount: 12,
      };
    } catch (error) {
      this.logger.error('Erreur récupération statistiques générales:', error);
      throw error;
    }
  }

  async getStockAlerts() {
    try {
      // Simuler des alertes de stock
      return [
        {
          productId: '1',
          name: 'Filtre à huile',
          currentStock: 2,
          minStock: 10,
          severity: 'critical' as const,
        },
        {
          productId: '2',
          name: 'Plaquettes de frein avant',
          currentStock: 8,
          minStock: 15,
          severity: 'low' as const,
        },
      ];
    } catch (error) {
      this.logger.error('Erreur récupération alertes stock:', error);
      throw error;
    }
  }

  async getRecentActivity() {
    try {
      // Simuler l'activité récente
      return [
        {
          timestamp: new Date().toISOString(),
          action: 'UPDATE_STOCK',
          productId: '1',
          productName: 'Filtre à huile',
          userId: 'admin',
          details: { oldQuantity: 5, newQuantity: 2 },
        },
      ];
    } catch (error) {
      this.logger.error('Erreur récupération activité récente:', error);
      throw error;
    }
  }

  async getTopProducts() {
    try {
      // Simuler les top produits
      return [
        {
          productId: '1',
          name: 'Filtre à huile',
          totalSales: 150,
          revenue: 4500,
          margin: 35,
        },
      ];
    } catch (error) {
      this.logger.error('Erreur récupération top produits:', error);
      throw error;
    }
  }

  async getLowStockProducts() {
    try {
      // Simuler les produits en stock faible
      return [
        {
          productId: '1',
          name: 'Filtre à huile',
          currentStock: 2,
          minStock: 10,
        },
      ];
    } catch (error) {
      this.logger.error('Erreur récupération produits stock faible:', error);
      throw error;
    }
  }

  async findAllWithAdminDetails(filters: AdminProductFiltersDto) {
    try {
      // Utiliser le service produits existant avec des informations admin étendues
      const result = await this.productsService.findAll(filters);

      // Ajouter des détails admin si nécessaire
      if (result.data) {
        result.data = result.data.map((product: any) => ({
          ...product,
          admin: {
            canEdit: true,
            canDelete: product.stock_quantity === 0,
            lastModified: product.updated_at,
            createdBy: 'system', // À récupérer depuis la DB
          },
        }));
      }

      return result;
    } catch (error) {
      this.logger.error('Erreur recherche admin produits:', error);
      throw error;
    }
  }

  async findOneWithAdminDetails(id: string) {
    try {
      const product = await this.productsService.findOne(id);

      if (product) {
        return {
          ...product,
          admin: {
            canEdit: true,
            canDelete: product.stock_quantity === 0,
            lastModified: product.updated_at,
            createdBy: 'system', // À récupérer depuis la DB
          },
        };
      }

      return null;
    } catch (error) {
      this.logger.error(`Erreur récupération détails admin produit ${id}:`, error);
      throw error;
    }
  }

  async getStockHistory(id: string) {
    try {
      // Simuler l'historique de stock
      return [
        {
          date: new Date().toISOString(),
          previousQuantity: 5,
          newQuantity: 2,
          change: -3,
          reason: 'sale',
          userId: 'system',
          notes: 'Vente automatique',
        },
      ];
    } catch (error) {
      this.logger.error(`Erreur historique stock produit ${id}:`, error);
      throw error;
    }
  }

  async getPriceHistory(id: string) {
    try {
      // Simuler l'historique de prix
      return [
        {
          date: new Date().toISOString(),
          previousPrice: 25.0,
          newPrice: 30.0,
          change: 5.0,
          reason: 'manual_adjustment',
          userId: 'admin',
          notes: 'Ajustement inflation',
        },
      ];
    } catch (error) {
      this.logger.error(`Erreur historique prix produit ${id}:`, error);
      throw error;
    }
  }

  async getSalesStats(id: string) {
    try {
      // Simuler les statistiques de vente
      return {
        totalSales: 150,
        revenue: 4500,
        averageOrderValue: 30,
        monthlyTrend: [
          { month: '2024-01', sales: 45 },
          { month: '2024-02', sales: 55 },
          { month: '2024-03', sales: 50 },
        ],
      };
    } catch (error) {
      this.logger.error(`Erreur stats vente produit ${id}:`, error);
      throw error;
    }
  }

  async getRelatedProducts(id: string, _limit: number) {
    try {
      // Simuler les produits liés
      return [
        {
          productId: '2',
          name: 'Joint de filtre à huile',
          relation: 'accessory',
          frequency: 85,
        },
      ];
    } catch (error) {
      this.logger.error(`Erreur produits liés ${id}:`, error);
      throw error;
    }
  }

  async findBySku(sku: string) {
    try {
      // Utiliser le service produits existant
      const products = await this.productsService.findAll({ search: sku });
      return products.data?.find((p: any) => p.sku === sku) || null;
    } catch (error) {
      this.logger.error(`Erreur recherche par SKU ${sku}:`, error);
      throw error;
    }
  }

  async create(createProductDto: CreateProductDto) {
    try {
      return await this.productsService.create(createProductDto);
    } catch (error) {
      this.logger.error('Erreur création admin produit:', error);
      throw error;
    }
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    try {
      return await this.productsService.update(id, updateProductDto);
    } catch (error) {
      this.logger.error(`Erreur mise à jour admin produit ${id}:`, error);
      throw error;
    }
  }

  async softDelete(id: string) {
    try {
      return await this.productsService.remove(id);
    } catch (error) {
      this.logger.error(`Erreur suppression admin produit ${id}:`, error);
      throw error;
    }
  }

  async performBulkOperation(bulkDto: AdminBulkOperationsDto) {
    try {
      this.logger.log(`Opération en lot: ${bulkDto.operation} sur ${bulkDto.productIds.length} produits`);

      let successCount = 0;
      let errorCount = 0;
      const errors: any[] = [];

      for (const productId of bulkDto.productIds) {
        try {
          switch (bulkDto.operation) {
            case 'activate':
              await this.update(productId, { is_active: true });
              break;
            case 'deactivate':
              await this.update(productId, { is_active: false });
              break;
            case 'delete':
              await this.softDelete(productId);
              break;
            case 'update_stock':
              if (bulkDto.parameters?.quantity !== undefined) {
                await this.updateStockWithHistory(
                  productId,
                  bulkDto.parameters.quantity,
                  {
                    reason: 'bulk_update',
                    notes: bulkDto.adminNotes || 'Mise à jour en lot',
                  },
                );
              }
              break;
            case 'update_price':
              if (bulkDto.parameters?.newPrice !== undefined) {
                await this.update(productId, {
                  price: bulkDto.parameters.newPrice,
                });
              }
              break;
            default:
              throw new Error(`Opération non supportée: ${bulkDto.operation}`);
          }
          successCount++;
        } catch (error) {
          errorCount++;
          const errorMessage =
            error instanceof Error ? error.message : 'Erreur inconnue';
          errors.push({ productId, error: errorMessage });
        }
      }

      return {
        operation: bulkDto.operation,
        totalProcessed: bulkDto.productIds.length,
        successCount,
        errorCount,
        errors,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Erreur opération en lot admin:', error);
      throw error;
    }
  }

  async updateStockWithHistory(
    id: string,
    quantity: number,
    options: {
      reason?: string;
      notes?: string;
      min_stock?: number;
    } = {},
  ) {
    try {
      // Récupérer la quantité actuelle
      const currentProduct = await this.findOneWithAdminDetails(id);
      if (!currentProduct) {
        throw new Error('Produit non trouvé');
      }

      // Mettre à jour le stock
      const updateData: any = { stock_quantity: quantity };
      if (options.min_stock !== undefined) {
        updateData.min_stock = options.min_stock;
      }

      const result = await this.update(id, updateData);

      // TODO: Enregistrer dans l'historique des stocks
      this.logger.log(`Stock mis à jour pour ${id}: ${currentProduct.stock_quantity} -> ${quantity}`);

      return result;
    } catch (error) {
      this.logger.error(`Erreur mise à jour stock avec historique ${id}:`, error);
      throw error;
    }
  }

  async logActivity(activity: {
    action: string;
    productId: string;
    details: any;
    userId: string;
  }) {
    try {
      // TODO: Enregistrer l'activité en base de données
      this.logger.log('Activité admin enregistrée:', activity);
    } catch (error) {
      this.logger.error('Erreur enregistrement activité admin:', error);
      // Ne pas faire échouer l'opération principale si le log échoue
    }
  }

  async exportProducts(
    format: 'csv' | 'excel',
    filters?: AdminProductFiltersDto,
  ) {
    try {
      const products = await this.findAllWithAdminDetails(filters || {});

      // Simuler l'export
      return {
        format,
        filename: `products_export_${new Date().toISOString().split('T')[0]}.${format}`,
        totalRecords: products.total || 0,
        downloadUrl: `/admin/products/download/export_${Date.now()}.${format}`,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 heure
      };
    } catch (error) {
      this.logger.error('Erreur export admin produits:', error);
      throw error;
    }
  }

  async analyzeProducts() {
    try {
      // Simuler l'analyse des produits
      return {
        dataQuality: {
          complete: 85,
          missingImages: 45,
          missingDescriptions: 23,
          missingPrices: 5,
          missingReferences: 2,
          duplicateSkus: [
            { sku: 'FILTER001', productIds: ['1', '2'] },
          ],
        },
        performance: {
          bestSellers: [
            { productId: '1', name: 'Filtre à huile', sales: 150 },
          ],
          worstSellers: [
            { productId: '99', name: 'Pièce rare', sales: 1 },
          ],
        },
        stock: {
          totalValue: 450000,
          deadStock: [
            { productId: '88', name: 'Pièce obsolète', daysStagnant: 365 },
          ],
          fastMoving: [
            { productId: '1', name: 'Filtre à huile', turnoverRate: 12 },
          ],
        },
      };
    } catch (error) {
      this.logger.error('Erreur analyse admin produits:', error);
      throw error;
    }
  }

  async getRecommendations(analysis: any) {
    try {
      const recommendations: any[] = [];

      // Recommandations basées sur l'analyse
      if (analysis.dataQuality.missingImages > 20) {
        recommendations.push({
          type: 'data',
          priority: 'high',
          title: 'Images manquantes',
          description: `${analysis.dataQuality.missingImages} produits sans image`,
          actionUrl: '/admin/products?hasImage=false',
        });
      }

      if (analysis.stock.deadStock.length > 0) {
        recommendations.push({
          type: 'stock',
          priority: 'medium',
          title: 'Stock dormant détecté',
          description: `${analysis.stock.deadStock.length} produits sans mouvement depuis plus d'un an`,
          actionUrl: '/admin/products/dead-stock',
        });
      }

      return recommendations;
    } catch (error) {
      this.logger.error('Erreur génération recommandations admin:', error);
      return [];
    }
  }
}
