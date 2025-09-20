import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'pg';

// Interfaces adaptées pour PostgreSQL/Supabase (noms en minuscules)
export interface CarBrand {
  marque_id: number;
  marque_name: string;
  marque_alias?: string;
  marque_name_meta?: string;
  marque_logo?: string;
  marque_top: number;
  marque_display: number;
  marque_sort: number;
}

export interface CarYear {
  year_value: number;
  year_display: number;
}

export interface CarModel {
  model_id: number;
  model_name: string;
  model_alias?: string;
  model_display: number;
}

export interface CarType {
  type_id: number;
  type_name: string;
  type_mine?: string;
  type_url?: string;
  type_display: number;
}

export interface CatalogFamily {
  mf_id: number;
  mf_name: string;
  mf_name_system?: string;
  mf_description?: string;
  mf_pic?: string;
  mf_display: number;
  mf_sort: number;
  gammes?: ProductGamme[];
}

export interface ProductGamme {
  pg_id: number;
  pg_alias?: string;
  pg_name: string;
  pg_name_url?: string;
  pg_name_meta?: string;
  pg_img?: string;
  pg_pic?: string;
  pg_display: number;
  pg_level: number;
  pg_top?: number;
  sg_title?: string;
  sg_descrip?: string;
  ba_preview?: string;
  mc_mf_id?: number;
  mc_sort?: number;
}

export interface EquipmentBrand {
  pm_id: number;
  pm_name?: string;
  pm_name_meta?: string;
  pm_preview?: string;
  pm_logo?: string;
  pm_display: number;
  pm_top?: number;
  pm_sort: number;
}

export interface MineSearchRequest {
  mine: string;
  ask2page?: number;
}

export interface VehicleSearchParams {
  marque_id?: number;
  year?: number;
  model_id?: number;
  type_id?: number;
}

@Injectable()
export class AutomobileService {
  private readonly logger = new Logger(AutomobileService.name);
  private client: Client;

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    try {
      this.client = new Client({
        host: process.env.DATABASE_HOST || 'localhost',
        user: process.env.DATABASE_USER || 'postgres',
        password: process.env.DATABASE_PASSWORD || '',
        database: process.env.DATABASE_NAME || 'automecanik',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
      await this.client.connect();
      this.logger.log('PostgreSQL connection established');
    } catch (error) {
      this.logger.error('Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Récupère toutes les marques automobiles pour le sélecteur
   */
  async getCarBrandsForSelector(): Promise<CarBrand[]> {
    try {
      this.logger.debug('Récupération des marques pour le sélecteur');
      
      const query = `
        SELECT marque_id, marque_name, marque_top   
        FROM auto_marque 
        WHERE marque_display = 1 
        ORDER BY marque_sort
      `;
      
      const result = await this.client.query(query);
      return result.rows;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des marques pour sélecteur', error);
      throw error;
    }
  }

  /**
   * Récupère les marques pour le carousel (avec logos)
   */
  async getCarBrandsForCarousel(): Promise<CarBrand[]> {
    try {
      this.logger.debug('Récupération des marques pour le carousel');
      
      const query = `
        SELECT marque_id, marque_alias, marque_name_meta, marque_logo    
        FROM auto_marque
        WHERE marque_display = 1
        AND marque_id NOT IN (339,441) 
        ORDER BY marque_sort
      `;
      
      const result = await this.client.query(query);
      return result.rows;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des marques pour carousel', error);
      throw error;
    }
  }

  /**
   * Récupère les familles de catalogue avec leurs gammes
   */
  async getCatalogFamilies(): Promise<CatalogFamily[]> {
    try {
      this.logger.debug('Récupération des familles de catalogue');
      
      const query = `
        SELECT DISTINCT mf_id, 
               COALESCE(mf_name_system, mf_name) AS mf_name, 
               mf_description, 
               mf_pic 
        FROM pieces_gamme 
        JOIN catalog_gamme ON mc_pg_id = pg_id
        JOIN catalog_family ON mf_id = mc_mf_id
        WHERE pg_display = 1 AND pg_level = 1 AND mf_display = 1
        ORDER BY mf_sort
      `;
      
      const familiesResult = await this.client.query(query);
      const families = familiesResult.rows;

      // Pour chaque famille, récupérer ses gammes
      const familiesWithGammes = await Promise.all(
        families.map(async (family) => {
          const gammesQuery = `
            SELECT DISTINCT pg_id, pg_alias, pg_name, pg_name_url, 
                   pg_name_meta, pg_pic, pg_img 
            FROM pieces_gamme 
            JOIN catalog_gamme ON mc_pg_id = pg_id
            WHERE pg_display = 1 AND pg_level = 1 
            AND mc_mf_id = $1
            ORDER BY mc_sort
          `;
          
          const gammesResult = await this.client.query(gammesQuery, [family.mf_id]);
          
          return {
            ...family,
            gammes: gammesResult.rows
          };
        })
      );

      return familiesWithGammes;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des familles de catalogue', error);
      throw error;
    }
  }

  /**
   * Récupère les gammes les plus vendues (TOP)
   */
  async getTopSellingGammes(): Promise<ProductGamme[]> {
    try {
      this.logger.debug('Récupération des gammes les plus vendues');
      
      const query = `
        SELECT DISTINCT pg_id, pg_alias, pg_name, pg_name_url, 
               pg_name_meta, pg_img, 
               sg_title, sg_descrip, ba_preview,
               mc_mf_id, mc_sort
        FROM pieces_gamme 
        LEFT JOIN catalog_gamme ON mc_pg_id = pg_id 
        LEFT JOIN __seo_gamme ON sg_pg_id = pg_id 
        LEFT JOIN __blog_advice ON ba_pg_id = pg_id
        WHERE pg_display = 1 AND pg_level = 1 AND pg_top = 1
        ORDER BY mc_mf_id, mc_sort
      `;
      
      const result = await this.client.query(query);
      return result.rows;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des gammes top', error);
      throw error;
    }
  }

  /**
   * Récupère les marques d'équipementiers TOP
   */
  async getTopEquipmentBrands(): Promise<EquipmentBrand[]> {
    try {
      this.logger.debug('Récupération des marques d\'équipementiers top');
      
      const query = `
        SELECT pm_id, pm_name, pm_name_meta, pm_preview, pm_logo
        FROM pieces_marque
        WHERE pm_display = 1 
        AND pm_top = 1
        ORDER BY pm_sort
      `;
      
      const result = await this.client.query(query);
      return result.rows;
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des équipementiers top', error);
      throw error;
    }
  }

  /**
   * Récupère les années disponibles pour une marque
   */
  async getYearsByBrand(marqueId: number): Promise<number[]> {
    try {
      this.logger.debug(`Récupération des années pour la marque ${marqueId}`);
      
      // Note: Assurez-vous que votre table auto_year existe avec ces colonnes
      const query = `
        SELECT DISTINCT year_value
        FROM auto_year
        WHERE marque_id = $1
        AND year_display = 1
        ORDER BY year_value DESC
      `;
      
      const result = await this.client.query(query, [marqueId]);
      return result.rows.map(row => row.year_value);
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des années pour marque ${marqueId}`, error);
      throw error;
    }
  }

  /**
   * Récupère les modèles disponibles pour une marque et une année
   */
  async getModelsByBrandAndYear(marqueId: number, year: number): Promise<CarModel[]> {
    try {
      this.logger.debug(`Récupération des modèles pour marque ${marqueId} et année ${year}`);
      
      const query = `
        SELECT model_id, model_name, model_alias
        FROM auto_model
        WHERE marque_id = $1
        AND year_value = $2
        AND model_display = 1
        ORDER BY model_sort
      `;
      
      const result = await this.client.query(query, [marqueId, year]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des modèles`, error);
      throw error;
    }
  }

  /**
   * Récupère les types/motorisations disponibles
   */
  async getTypesByBrandYearAndModel(marqueId: number, year: number, modelId: number): Promise<CarType[]> {
    try {
      this.logger.debug(`Récupération des types pour marque ${marqueId}, année ${year}, modèle ${modelId}`);
      
      const query = `
        SELECT type_id, type_name, type_mine, type_url
        FROM auto_type
        WHERE marque_id = $1
        AND year_value = $2
        AND model_id = $3
        AND type_display = 1
        ORDER BY type_sort
      `;
      
      const result = await this.client.query(query, [marqueId, year, modelId]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des types`, error);
      throw error;
    }
  }

  /**
   * Recherche par type mine
   */
  async searchByMineType(mine: string): Promise<any> {
    try {
      this.logger.debug(`Recherche par type mine: ${mine}`);
      
      const query = `
        SELECT t.type_id, t.type_name, t.type_mine, t.type_url,
               m.marque_name, m.marque_alias, m.marque_id,
               mod.model_name, mod.model_id,
               t.year_value
        FROM auto_type t
        JOIN auto_marque m ON t.marque_id = m.marque_id
        JOIN auto_model mod ON t.model_id = mod.model_id
        WHERE UPPER(t.type_mine) LIKE UPPER($1)
        AND t.type_display = 1
        ORDER BY m.marque_name, mod.model_name, t.year_value DESC
        LIMIT 10
      `;
      
      const result = await this.client.query(query, [`%${mine}%`]);
      return result.rows;
    } catch (error) {
      this.logger.error(`Erreur lors de la recherche par type mine ${mine}`, error);
      throw error;
    }
  }

  /**
   * Méthode pour nettoyer le contenu HTML
   */
  contentCleaner(content: string): string {
    if (!content) return '';
    
    return content
      .replace(/<[^>]*>/g, '') // Supprime les balises HTML
      .replace(/\s+/g, ' ') // Remplace les espaces multiples par un seul
      .trim(); // Supprime les espaces en début et fin
  }

  /**
   * Génère les URLs pour les véhicules
   */
  generateVehicleUrl(marqueAlias: string, marqueId: number): string {
    return `/auto/${marqueAlias}-${marqueId}.html`;
  }

  /**
   * Génère les URLs pour les pièces
   */
  generatePieceUrl(pgAlias: string, pgId: number): string {
    return `/piece/${pgAlias}-${pgId}.html`;
  }

  /**
   * Récupère les données complètes pour la page d'accueil
   */
  async getHomePageData(): Promise<{
    carBrandsSelector: CarBrand[];
    carBrandsCarousel: CarBrand[];
    catalogFamilies: CatalogFamily[];
    topGammes: ProductGamme[];
    topEquipmentBrands: EquipmentBrand[];
  }> {
    try {
      this.logger.debug('Récupération des données complètes pour la page d\'accueil');
      
      const [
        carBrandsSelector,
        carBrandsCarousel,
        catalogFamilies,
        topGammes,
        topEquipmentBrands
      ] = await Promise.all([
        this.getCarBrandsForSelector(),
        this.getCarBrandsForCarousel(),
        this.getCatalogFamilies(),
        this.getTopSellingGammes(),
        this.getTopEquipmentBrands()
      ]);

      return {
        carBrandsSelector,
        carBrandsCarousel,
        catalogFamilies,
        topGammes,
        topEquipmentBrands
      };
    } catch (error) {
      this.logger.error('Erreur lors de la récupération des données de la page d\'accueil', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.end();
    }
  }
}