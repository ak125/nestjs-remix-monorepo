/**
 * Service pour la gestion des constructeurs automobiles
 * Ce service gère les données des constructeurs, leurs modèles, et leurs types.
 * Il utilise les tables auto_marque, auto_modele, et auto_type de la base de données.
 */
import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

export interface Manufacturer {
  id: number;
  name: string;
  display_name?: string;
  logo_url?: string;
  slug: string;
  is_active: boolean;
  is_featured?: boolean;
  view_count?: number;
}

export interface ManufacturerWithModels extends Manufacturer {
  models: Model[];
}

export interface Model {
  id: number;
  name: string;
  start_year?: string;
  end_year?: string;
  slug: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  message?: string;
}

@Injectable()
export class ManufacturersService extends SupabaseBaseService {
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  protected readonly logger = new Logger(ManufacturersService.name);

  constructor(
    configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super(configService);
  }

  /**
   * Récupère la liste des constructeurs avec pagination
   */
  async findAll(options: {
    limit?: number;
    offset?: number;
    search?: string;
    featured?: boolean;
  } = {}): Promise<PaginatedResponse<Manufacturer>> {
    const cacheKey = `manufacturers:all:${JSON.stringify(options)}`;
    
    try {
      let query = this.client.from('auto_marque').select('*', { count: 'exact' });

      // Filtres
      if (options.search) {
        query = query.ilike('marque_name', `%${options.search}%`);
      }
      
      if (options.featured) {
        query = query.eq('marque_is_featured', true);
      }

      // Pagination
      const limit = Math.min(options.limit || 50, 100);
      const offset = options.offset || 0;
      
      query = query
        .eq('marque_is_active', true)
        .order('marque_name')
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Erreur lors de la récupération des constructeurs: ${error.message}`);
      }

      const manufacturers = data?.map(this.mapToManufacturer) || [];

      return {
        data: manufacturers,
        total: count || 0,
        hasNext: offset + limit < (count || 0),
        hasPrev: offset > 0,
        message: `${manufacturers.length} constructeurs trouvés`,
      };
    } catch (error) {
      this.logger.error('Erreur dans findAll:', error);
      return {
        data: [],
        total: 0,
        message: 'Erreur lors de la récupération des constructeurs',
      };
    }
  }

  /**
   * Récupère un constructeur par ID
   */
  async findOne(id: number): Promise<Manufacturer | null> {
    try {
      const { data, error } = await this.client
        .from('auto_marque')
        .select('*')
        .eq('marque_id', id)
        .eq('marque_is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToManufacturer(data);
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération du constructeur ${id}:`, error);
      return null;
    }
  }

  /**
   * Récupère un constructeur avec ses modèles
   */
  async findOneWithModels(id: number): Promise<ManufacturerWithModels | null> {
    try {
      const manufacturer = await this.findOne(id);
      if (!manufacturer) {
        return null;
      }

      const modelsResult = await this.getModelsByManufacturer(id, {
        limit: 50,
      });

      return {
        ...manufacturer,
        models: modelsResult.success ? modelsResult.data : [],
      };
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération du constructeur ${id} avec modèles:`, error);
      return null;
    }
  }

  /**
   * Recherche des constructeurs
   */
  async search(query: string, limit = 20): Promise<PaginatedResponse<Manufacturer>> {
    try {
      const { data, error, count } = await this.client
        .from('auto_marque')
        .select('*', { count: 'exact' })
        .eq('marque_is_active', true)
        .or(
          `marque_name.ilike.%${query}%,marque_slug.ilike.%${query}%`,
        )
        .order('marque_name')
        .limit(limit);

      if (error) {
        throw new Error(`Erreur lors de la recherche: ${error.message}`);
      }

      const manufacturers = data?.map(this.mapToManufacturer) || [];

      return {
        data: manufacturers,
        total: count || 0,
        message: `${manufacturers.length} résultats trouvés pour "${query}"`,
      };
    } catch (error) {
      this.logger.error('Erreur dans search:', error);
      return {
        data: [],
        total: 0,
        message: 'Erreur lors de la recherche',
      };
    }
  }

  /**
   * Récupère les constructeurs populaires
   */
  async getPopular(limit = 10): Promise<Manufacturer[]> {
    try {
      const { data, error } = await this.client
        .from('auto_marque')
        .select('*')
        .eq('marque_is_active', true)
        .order('marque_view_count', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Erreur lors de la récupération des constructeurs populaires: ${error.message}`);
      }

      return data?.map(this.mapToManufacturer) || [];
    } catch (error) {
      this.logger.error('Erreur dans getPopular:', error);
      return [];
    }
  }

  /**
   * Récupère les constructeurs en vedette
   */
  async getFeatured(limit = 6): Promise<Manufacturer[]> {
    try {
      const { data, error } = await this.client
        .from('auto_marque')
        .select('*')
        .eq('marque_is_active', true)
        .eq('marque_is_featured', true)
        .order('marque_name')
        .limit(limit);

      if (error) {
        throw new Error(`Erreur lors de la récupération des constructeurs en vedette: ${error.message}`);
      }

      return data?.map(this.mapToManufacturer) || [];
    } catch (error) {
      this.logger.error('Erreur dans getFeatured:', error);
      return [];
    }
  }

  /**
   * Récupère les modèles d'un constructeur
   */
  async getModelsByManufacturer(
    manufacturerId: number,
    options: { limit?: number; offset?: number } = {},
  ) {
    try {
      const { data, error } = await this.client
        .from('auto_modele')
        .select(
          `
          modele_id,
          modele_name,
          modele_date_debut,
          modele_date_fin
        `,
        )
        .eq('marque_id', manufacturerId)
        .range(
          options.offset || 0,
          (options.offset || 0) + (options.limit || 50) - 1,
        );

      if (error) {
        return { success: false, data: [], error: error.message };
      }

      const models =
        data?.map((model) => ({
          id: model.modele_id,
          name: model.modele_name,
          start_year: model.modele_date_debut,
          end_year: model.modele_date_fin,
          slug: this.generateSlug(model.modele_name),
        })) || [];

      return { success: true, data: models };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error('Erreur dans getModelsByManufacturer:', error);
      return {
        success: false,
        data: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Récupère les statistiques des constructeurs
   */
  async getStats() {
    try {
      const [activeCount, featuredCount, totalModels] = await Promise.all([
        this.client
          .from('auto_marque')
          .select('marque_id', { count: 'exact', head: true })
          .eq('marque_is_active', true),
        this.client
          .from('auto_marque')
          .select('marque_id', { count: 'exact', head: true })
          .eq('marque_is_active', true)
          .eq('marque_is_featured', true),
        this.client
          .from('auto_modele')
          .select('modele_id', { count: 'exact', head: true }),
      ]);

      return {
        active_manufacturers: activeCount.count || 0,
        featured_manufacturers: featuredCount.count || 0,
        total_models: totalModels.count || 0,
      };
    } catch (error) {
      this.logger.error('Erreur dans getStats:', error);
      return {
        active_manufacturers: 0,
        featured_manufacturers: 0,
        total_models: 0,
      };
    }
  }

  /**
   * Mapper les données de la base vers l'interface Manufacturer
   */
  private mapToManufacturer = (raw: any): Manufacturer => {
    return {
      id: raw.marque_id,
      name: raw.marque_name,
      display_name: raw.marque_display_name,
      logo_url: raw.marque_logo || undefined,
      slug: raw.marque_slug,
      is_active: raw.marque_is_active,
      is_featured: raw.marque_is_featured,
      view_count: raw.marque_view_count,
    };
  };

  /**
   * Génère un slug à partir d'un nom
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Incrémente le compteur de vues d'un constructeur
   */
  async incrementViewCount(id: number): Promise<void> {
    try {
      await this.client
        .from('auto_marque')
        .update({ marque_view_count: this.client.rpc('increment_view_count', { manufacturer_id: id }) })
        .eq('marque_id', id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error('Erreur lors de l\'incrémentation des vues:', errorMessage);
    }
  }
}
