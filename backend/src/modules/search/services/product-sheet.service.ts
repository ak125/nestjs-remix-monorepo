import { Injectable, Logger } from '@nestjs/common';
import { MeilisearchService } from './meilisearch.service';

export interface ProductSheet {
  id: string;
  title: string;
  content: string;
  description?: string;
  category: string;
  type: string;
  tags?: string[];
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

@Injectable()
export class ProductSheetService {
  private readonly logger = new Logger(ProductSheetService.name);

  constructor(private readonly meilisearchService: MeilisearchService) {}

  /**
   * Recherche dans les fiches produits
   */
  async searchProductSheets(query: string, options: any = {}) {
    try {
      return await this.meilisearchService.searchProducts(query, options);
    } catch (error) {
      this.logger.error('Error searching product sheets:', error);
      throw error;
    }
  }

  /**
   * Obtient une fiche produit par ID
   */
  async getProductSheet(id: string): Promise<ProductSheet | null> {
    try {
      const index = this.meilisearchService.getIndex('products');
      return await index.getDocument(id);
    } catch (error) {
      this.logger.error(`Error getting product sheet ${id}:`, error);
      return null;
    }
  }

  /**
   * Indexe des fiches produits
   */
  async indexProductSheets(productSheets: ProductSheet[]) {
    try {
      return await this.meilisearchService.indexProducts(productSheets);
    } catch (error) {
      this.logger.error('Error indexing product sheets:', error);
      throw error;
    }
  }

  /**
   * Met à jour une fiche produit
   */
  async updateProductSheet(id: string, productSheet: Partial<ProductSheet>) {
    try {
      const index = this.meilisearchService.getIndex('products');
      return await index.addDocuments([{ id, ...productSheet }]);
    } catch (error) {
      this.logger.error(`Error updating product sheet ${id}:`, error);
      throw error;
    }
  }

  /**
   * Supprime une fiche produit
   */
  async deleteProductSheet(id: string) {
    try {
      const index = this.meilisearchService.getIndex('products');
      return await index.deleteDocument(id);
    } catch (error) {
      this.logger.error(`Error deleting product sheet ${id}:`, error);
      throw error;
    }
  }

  /**
   * Recherche par catégorie
   */
  async searchByCategory(category: string, options: any = {}) {
    try {
      return await this.meilisearchService.searchProducts('', {
        ...options,
        filter: [`category = "${category}"`],
      });
    } catch (error) {
      this.logger.error(`Error searching by category ${category}:`, error);
      throw error;
    }
  }

  /**
   * Obtient les catégories disponibles
   */
  async getCategories() {
    try {
      const results = await this.meilisearchService.getFacets('products', ['category']);
      return Object.keys(results.category || {});
    } catch (error) {
      this.logger.error('Error getting categories:', error);
      throw error;
    }
  }
}
