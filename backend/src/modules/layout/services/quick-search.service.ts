import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../cache/cache.service';
// import { DatabaseService } from '../../../database/database.service'; // Temporarily removed

export interface QuickSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: 'product' | 'category' | 'page' | 'user' | 'order';
  url: string;
  image?: string;
  price?: number;
  badge?: {
    text: string;
    color: string;
  };
}

export interface QuickSearchData {
  suggestions: string[];
  trending: string[];
  recentSearches: string[];
  popularCategories: Array<{
    id: string;
    name: string;
    url: string;
    count: number;
  }>;
}

@Injectable()
export class QuickSearchService {
  private readonly logger = new Logger(QuickSearchService.name);

  constructor(
    private readonly cacheService: CacheService,
    // private readonly databaseService: DatabaseService, // Temporarily removed
  ) {}

  /**
   * Recherche rapide avec suggestions
   */
  async quickSearch(
    query: string,
    context: 'admin' | 'commercial' | 'public',
    limit = 10,
  ): Promise<QuickSearchResult[]> {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const cleanQuery = query.trim().toLowerCase();
      const cacheKey = `quick-search:${context}:${cleanQuery}:${limit}`;

      // Vérifier le cache (5 minutes)
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached as QuickSearchResult[];
      }

      // Effectuer la recherche selon le contexte
      const results = await this.performSearch(cleanQuery, context, limit);

      // Mettre en cache
      await this.cacheService.set(cacheKey, results, 300);

      return results;
    } catch (error) {
      this.logger.error('Erreur recherche rapide:', error);
      return [];
    }
  }

  /**
   * Obtient les données pour l'interface de recherche
   */
  async getSearchData(context: string): Promise<QuickSearchData> {
    try {
      const cacheKey = `search-data:${context}`;

      // Vérifier le cache (30 minutes)
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached as QuickSearchData;
      }

      // Générer les données selon le contexte
      const searchData = await this.buildSearchDataForContext(context);

      // Mettre en cache
      await this.cacheService.set(cacheKey, searchData, 1800);

      return searchData;
    } catch (error) {
      this.logger.error('Erreur données recherche:', error);
      return this.getFallbackSearchData();
    }
  }

  /**
   * Effectue la recherche selon le contexte
   */
  private async performSearch(
    query: string,
    context: string,
    limit: number,
  ): Promise<QuickSearchResult[]> {
    const results: QuickSearchResult[] = [];

    switch (context) {
      case 'admin':
        results.push(...(await this.searchForAdmin(query)));
        break;
      case 'commercial':
        results.push(...(await this.searchForCommercial(query)));
        break;
      case 'public':
        results.push(...(await this.searchForPublic(query)));
        break;
    }

    return results.slice(0, limit);
  }

  /**
   * Recherche pour l'administration
   */
  private async searchForAdmin(query: string): Promise<QuickSearchResult[]> {
    const results: QuickSearchResult[] = [];

    try {
      // TODO: Remplacer par vraies requêtes database quand DatabaseService sera réparé
      // Mock data pour les produits
      const mockProducts = [
        {
          id: '1',
          name: `Produit ${query}`,
          description: 'Description produit mock',
          price: 99.99,
          image_url: '/images/product-mock.jpg',
        },
      ];

      if (mockProducts) {
        results.push(
          ...mockProducts.map((product) => ({
            id: product.id,
            title: product.name,
            subtitle: `Produit #${product.id}`,
            description: product.description?.substring(0, 100),
            type: 'product' as const,
            url: `/admin/products/${product.id}`,
            image: product.image_url,
            price: product.price,
          })),
        );
      }

      // Mock data pour les utilisateurs
      const mockUsers = [
        {
          id: '1',
          username: 'admin',
          email: 'admin@example.com',
          full_name: 'Administrateur',
        },
      ];

      if (mockUsers) {
        results.push(
          ...mockUsers.map((user) => ({
            id: user.id,
            title: user.full_name || user.username,
            subtitle: user.email,
            type: 'user' as const,
            url: `/admin/users/${user.id}`,
          })),
        );
      }
    } catch (error) {
      this.logger.error('Erreur recherche admin:', error);
    }

    return results;
  }

  /**
   * Recherche pour le commercial
   */
  private async searchForCommercial(query: string): Promise<QuickSearchResult[]> {
    const results: QuickSearchResult[] = [];

    try {
      // Mock data pour les produits commerciaux
      const mockProducts = [
        {
          id: '1',
          name: `Produit commercial ${query}`,
          price: 149.99,
          stock_quantity: 5,
        },
      ];

      if (mockProducts) {
        results.push(
          ...mockProducts.map((product) => ({
            id: product.id,
            title: product.name,
            subtitle: `Prix: ${product.price}€`,
            type: 'product' as const,
            url: `/commercial/products/${product.id}`,
            price: product.price,
            badge:
              product.stock_quantity <= 10
                ? { text: 'Stock faible', color: 'red' }
                : undefined,
          })),
        );
      }
    } catch (error) {
      this.logger.error('Erreur recherche commercial:', error);
    }

    return results;
  }

  /**
   * Recherche pour le public
   */
  private async searchForPublic(query: string): Promise<QuickSearchResult[]> {
    const results: QuickSearchResult[] = [];

    try {
      // Mock data pour les produits publics
      const mockProducts = [
        {
          id: '1',
          name: `Produit public ${query}`,
          description: 'Description publique',
          price: 199.99,
          image_url: '/images/public-product.jpg',
          is_featured: true,
        },
      ];

      if (mockProducts) {
        results.push(
          ...mockProducts.map((product) => ({
            id: product.id,
            title: product.name,
            description: product.description?.substring(0, 100),
            type: 'product' as const,
            url: `/products/${product.id}`,
            image: product.image_url,
            price: product.price,
            badge: product.is_featured
              ? { text: 'Vedette', color: 'gold' }
              : undefined,
          })),
        );
      }
    } catch (error) {
      this.logger.error('Erreur recherche public:', error);
    }

    return results;
  } /**
   * Construit les données de recherche selon le contexte
   */
  private async buildSearchDataForContext(
    context: string,
  ): Promise<QuickSearchData> {
    switch (context) {
      case 'admin':
        return this.buildAdminSearchData();
      case 'commercial':
        return this.buildCommercialSearchData();
      case 'public':
        return this.buildPublicSearchData();
      default:
        return this.getFallbackSearchData();
    }
  }

  /**
   * Données de recherche pour l'admin
   */
  private async buildAdminSearchData(): Promise<QuickSearchData> {
    return {
      suggestions: [
        'utilisateurs',
        'produits',
        'commandes',
        'catégories',
        'paramètres',
      ],
      trending: ['dashboard', 'analytics', 'reports'],
      recentSearches: [],
      popularCategories: [],
    };
  }

  /**
   * Données de recherche pour le commercial
   */
  private async buildCommercialSearchData(): Promise<QuickSearchData> {
    return {
      suggestions: ['produits', 'clients', 'commandes', 'devis'],
      trending: ['bestsellers', 'nouveautés', 'promotions'],
      recentSearches: [],
      popularCategories: [],
    };
  }

  /**
   * Données de recherche pour le public
   */
  private async buildPublicSearchData(): Promise<QuickSearchData> {
    try {
      // Mock data pour les catégories populaires
      const mockCategories = [
        { id: '1', name: 'Électronique', products_count: 150 },
        { id: '2', name: 'Mode', products_count: 89 },
        { id: '3', name: 'Maison', products_count: 67 },
      ];

      const popularCategories =
        mockCategories?.map((cat) => ({
          id: cat.id,
          name: cat.name,
          url: `/categories/${cat.id}`,
          count: cat.products_count || 0,
        })) || [];

      return {
        suggestions: [
          'ordinateurs',
          'smartphones',
          'tablettes',
          'accessoires',
          'gaming',
        ],
        trending: ['iphone', 'macbook', 'gaming', 'headphones'],
        recentSearches: [],
        popularCategories,
      };
    } catch (error) {
      this.logger.error('Erreur données recherche publiques:', error);
      return this.getFallbackSearchData();
    }
  }

  /**
   * Données de recherche par défaut
   */
  private getFallbackSearchData(): QuickSearchData {
    return {
      suggestions: [],
      trending: [],
      recentSearches: [],
      popularCategories: [],
    };
  }
}
