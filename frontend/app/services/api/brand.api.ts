/**
 * 🏭 API SERVICE MARQUES CONSTRUCTEURS
 * 
 * Service pour gérer les données des pages marques constructeurs
 * Reproduit la logique PHP avec conventions Supabase (minuscules)
 * 
 * @version 1.0.0
 * @since 2025-09-22
 */

import {
  type BrandData,
  type SeoMarqueData,
  type BlogMarqueData,
  type PopularVehicle,
  type PopularPart,
  type ProcessedSeoData,
  type BrandPageResponse,
  type MineSearchParams,
  type MineSearchResult,
  type SeoVariables,
  type PhpLegacyVariables
} from '../../types/brand.types';

// Configuration de l'API
const API_BASE_URL = typeof window !== 'undefined' && window.ENV?.API_BASE_URL 
  ? window.ENV.API_BASE_URL 
  : "http://localhost:3000";

// Configuration des variables globales (reproduction PHP)
const PHP_LEGACY_CONFIG: PhpLegacyVariables = {
  domain: "https://automecanik.com",
  auto: "constructeurs",
  piece: "pieces", 
  blog: "blog",
  constructeurs: "constructeurs",
  pg_id: 1,
  is_mac_version: false,
  hr: "fr",
  prix_pas_cher: [
    "au meilleur prix", "pas cher", "à prix réduit", "en promotion",
    "au tarif le plus bas", "à petit prix", "économique", "avantageux",
    "à prix attractif", "bon marché", "à coût réduit", "abordable"
  ],
  prix_pas_cher_length: 12
};

class BrandApiService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  // ====================================
  // 🔧 MÉTHODES UTILITAIRES
  // ====================================

  /**
   * Nettoie le contenu (reproduction content_cleaner() PHP)
   */
  private contentCleaner(content: string): string {
    if (!content) return '';
    
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[^\S ]/g, ' ') // Remplace tous les caractères d'espacement sauf l'espace normal
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Génère les variables SEO dynamiques (reproduction logique PHP)
   */
  private generateSeoVariables(brandId: number, brandName: string): SeoVariables {
    const prixIndex = brandId % PHP_LEGACY_CONFIG.prix_pas_cher_length;
    const compSwitchIndex = (brandId + 1) % PHP_LEGACY_CONFIG.prix_pas_cher_length;
    
    return {
      marque_name: brandName,
      marque_name_meta: brandName,
      marque_name_meta_title: brandName.toUpperCase(),
      prix_pas_cher: PHP_LEGACY_CONFIG.prix_pas_cher[prixIndex],
      comp_switch: PHP_LEGACY_CONFIG.prix_pas_cher[compSwitchIndex],
      domain: PHP_LEGACY_CONFIG.domain,
      auto_section: PHP_LEGACY_CONFIG.auto
    };
  }

  /**
   * Traite les marqueurs SEO dans le contenu (reproduction logique PHP)
   */
  private processSeoMarkers(content: string, variables: SeoVariables): string {
    if (!content) return '';
    
    return content
      .replace(/#VMarque#/g, variables.marque_name_meta_title)
      .replace(/#PrixPasCher#/g, variables.prix_pas_cher)
      .replace(/#CompSwitch#/g, variables.comp_switch)
      .replace(/#Marque#/g, variables.marque_name);
  }

  /**
   * Formate la plage de dates (reproduction logique PHP)
   */
  private formatDateRange(monthFrom?: number, yearFrom?: number, monthTo?: number, yearTo?: number): string {
    if (!yearFrom) return "";
    
    if (!yearTo) {
      return `du ${monthFrom ? monthFrom + '/' : ''}${yearFrom}`;
    } else {
      return `de ${monthFrom ? monthFrom + '/' : ''}${yearFrom} à ${monthTo ? monthTo + '/' : ''}${yearTo}`;
    }
  }

  /**
   * Génère l'URL de l'image de logo (conventions Supabase)
   */
  private generateLogoUrl(logoFilename?: string): string | undefined {
    if (!logoFilename) return undefined;
    
    // Gestion de la compatibilité Mac (reproduction logique PHP)
    const finalLogo = PHP_LEGACY_CONFIG.is_mac_version 
      ? logoFilename.replace('.webp', '.png')
      : logoFilename;
    
    return `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${finalLogo}`;
  }

  /**
   * Génère l'URL de l'image de modèle
   */
  private generateModelImageUrl(brandAlias: string, modelPic?: string): string {
    if (!modelPic) {
      return `${PHP_LEGACY_CONFIG.domain}/upload/constructeurs-automobiles/marques-modeles/no.png`;
    }
    
    const finalImage = PHP_LEGACY_CONFIG.is_mac_version 
      ? modelPic.replace('.webp', '.jpg')
      : modelPic;
    
    return `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/${brandAlias}/${finalImage}`;
  }

  /**
   * Génère l'URL de l'image de pièce
   */
  private generatePartImageUrl(partImg?: string): string {
    if (!partImg) {
      return `${PHP_LEGACY_CONFIG.domain}/upload/articles/gammes-produits/catalogue/no.png`;
    }
    
    const finalImage = PHP_LEGACY_CONFIG.is_mac_version 
      ? partImg.replace('.webp', '.jpg')
      : partImg;
    
    return `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/${finalImage}`;
  }

  /**
   * Vérifie la validité du cache
   */
  private isValidCache(entry: { timestamp: number; ttl: number }): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Calcule le TTL en fonction du type de données
   */
  private calculateTTL(dataType: 'brand' | 'seo' | 'vehicles' | 'parts' | 'blog'): number {
    const ttls = {
      brand: 30 * 60 * 1000,    // 30 minutes - données stables
      seo: 60 * 60 * 1000,      // 1 heure - données très stables
      vehicles: 15 * 60 * 1000, // 15 minutes - données dynamiques
      parts: 15 * 60 * 1000,    // 15 minutes - données dynamiques
      blog: 45 * 60 * 1000      // 45 minutes - contenu éditorial
    };
    return ttls[dataType];
  }

  // ====================================
  // 📡 MÉTHODES API PRINCIPALES
  // ====================================

  /**
   * Récupère les données de base d'une marque
   */
  async getBrandData(brandId: number): Promise<BrandData> {
    const cacheKey = `brand:${brandId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isValidCache(cached)) {
      console.log('[CACHE HIT] Brand data:', brandId);
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/vehicles/brands/${brandId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Marque ${brandId} non trouvée`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const brandData: BrandData = result.data || result;

      // Enrichir avec l'URL du logo
      if (brandData.marque_logo) {
        brandData.marque_logo = this.generateLogoUrl(brandData.marque_logo);
      }

      // Mise en cache
      const ttl = this.calculateTTL('brand');
      this.cache.set(cacheKey, { 
        data: brandData, 
        timestamp: Date.now(), 
        ttl 
      });

      console.log('[API CALL] Brand data:', brandId);
      return brandData;

    } catch (error) {
      console.error('[ERROR] Brand data API:', error);
      throw error;
    }
  }

  /**
   * Récupère les données SEO d'une marque
   */
  async getSeoData(brandId: number): Promise<SeoMarqueData | null> {
    const cacheKey = `seo:${brandId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isValidCache(cached)) {
      console.log('[CACHE HIT] SEO data:', brandId);
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/seo/marque/${brandId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // SEO optionnel
        }
        throw new Error(`SEO API error: ${response.status}`);
      }

      const result = await response.json();
      const seoData = result.data || result;

      // Mise en cache
      const ttl = this.calculateTTL('seo');
      this.cache.set(cacheKey, { 
        data: seoData, 
        timestamp: Date.now(), 
        ttl 
      });

      console.log('[API CALL] SEO data:', brandId);
      return seoData;

    } catch (error) {
      console.warn('[WARNING] SEO data not available:', error);
      return null;
    }
  }

  /**
   * Récupère les véhicules populaires d'une marque
   */
  async getPopularVehicles(brandId: number, limit: number = 12): Promise<PopularVehicle[]> {
    const cacheKey = `vehicles:${brandId}:${limit}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isValidCache(cached)) {
      console.log('[CACHE HIT] Popular vehicles:', brandId);
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/blog/constructeurs/brand/${brandId}/popular-models?limit=${limit}`);
      
      if (!response.ok) {
        console.warn(`Popular vehicles API error: ${response.status}`);
        return [];
      }

      const result = await response.json();
      let vehicles: PopularVehicle[] = result.data || [];

      // Enrichir les données (reproduction logique PHP)
      vehicles = vehicles.map(vehicle => ({
        ...vehicle,
        formatted_date_range: this.formatDateRange(
          vehicle.type_month_from,
          vehicle.type_year_from,
          vehicle.type_month_to,
          vehicle.type_year_to
        ),
        vehicle_url: `/${PHP_LEGACY_CONFIG.auto}/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.cgc_type_id}.html`,
        image_url: this.generateModelImageUrl(vehicle.marque_alias, vehicle.modele_pic),
        seo_title: `Pièces auto ${vehicle.marque_name_meta_title} ${vehicle.modele_name_meta} ${vehicle.type_name_meta}`,
        seo_description: `Catalogue pièces détachées pour ${vehicle.marque_name_meta_title} ${vehicle.modele_name_meta} ${vehicle.type_name_meta} ${vehicle.type_power_ps} ch ${this.formatDateRange(vehicle.type_month_from, vehicle.type_year_from, vehicle.type_month_to, vehicle.type_year_to)} neuves.`
      }));

      // Mise en cache
      const ttl = this.calculateTTL('vehicles');
      this.cache.set(cacheKey, { 
        data: vehicles, 
        timestamp: Date.now(), 
        ttl 
      });

      console.log('[API CALL] Popular vehicles:', brandId, vehicles.length);
      return vehicles;

    } catch (error) {
      console.warn('[WARNING] Popular vehicles not available:', error);
      return [];
    }
  }

  /**
   * Récupère les pièces populaires d'une marque
   */
  async getPopularParts(brandId: number, limit: number = 12): Promise<PopularPart[]> {
    const cacheKey = `parts:${brandId}:${limit}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isValidCache(cached)) {
      console.log('[CACHE HIT] Popular parts:', brandId);
      return cached.data;
    }

    try {
      // TEMPORAIRE: Données mockées car l'endpoint n'existe pas encore
      const mockParts: PopularPart[] = [
        {
          cgc_pg_id: 1,
          pg_alias: 'plaquettes-frein',
          pg_name: `Plaquettes de frein pour ${brandId}`,
          pg_name_meta: `Plaquettes de frein ${brandId}`,
          pg_pic: 'brake-pads.webp',
          pg_img: 'brake-pads.webp',
          cgc_type_id: 101,
          type_alias: 'diesel',
          type_name: '2.0 TDI',
          type_power_ps: 150,
          type_month_from: 1,
          type_year_from: 2015,
          type_month_to: 12,
          type_year_to: 2020,
          modele_id: 201,
          modele_alias: 'golf',
          modele_name: 'Golf',
          modele_name_meta: 'Golf',
          marque_id: parseInt(String(brandId).split('-').pop() || '1'),
          marque_alias: String(brandId).split('-')[0] || 'default',
          marque_name: String(brandId).split('-')[0]?.toUpperCase() || 'DEFAULT',
          marque_name_meta: String(brandId).split('-')[0]?.toUpperCase() || 'DEFAULT',
          marque_name_meta_title: String(brandId).split('-')[0]?.toUpperCase() || 'DEFAULT'
        },
        {
          cgc_pg_id: 2,
          pg_alias: 'filtre-huile',
          pg_name: `Filtre à huile pour ${brandId}`,
          pg_name_meta: `Filtre à huile ${brandId}`,
          pg_pic: 'oil-filter.webp',
          pg_img: 'oil-filter.webp',
          cgc_type_id: 102,
          type_alias: 'essence',
          type_name: '1.6 TSI',
          type_power_ps: 110,
          type_month_from: 3,
          type_year_from: 2016,
          type_month_to: 8,
          type_year_to: 2021,
          modele_id: 202,
          modele_alias: 'polo',
          modele_name: 'Polo',
          modele_name_meta: 'Polo',
          marque_id: parseInt(String(brandId).split('-').pop() || '1'),
          marque_alias: String(brandId).split('-')[0] || 'default',
          marque_name: String(brandId).split('-')[0]?.toUpperCase() || 'DEFAULT',
          marque_name_meta: String(brandId).split('-')[0]?.toUpperCase() || 'DEFAULT',
          marque_name_meta_title: String(brandId).split('-')[0]?.toUpperCase() || 'DEFAULT'
        }
      ].slice(0, limit);

      // Mettre en cache
      this.cache.set(cacheKey, {
        data: mockParts,
        timestamp: Date.now(),
        ttl: this.calculateTTL('parts')
      });

      console.log('[API CALL] Popular parts (mocked):', brandId, mockParts.length);
      return mockParts;

    } catch (error) {
      console.error('Erreur lors de la récupération des pièces populaires:', error);
      return [];
    }
  }

  /**
   * Récupère le contenu blog d'une marque
   */
  async getBlogContent(brandId: number): Promise<BlogMarqueData | null> {
    const cacheKey = `blog:${brandId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isValidCache(cached)) {
      console.log('[CACHE HIT] Blog content:', brandId);
      return cached.data;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/blog/marque/${brandId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Blog optionnel
        }
        throw new Error(`Blog API error: ${response.status}`);
      }

      const result = await response.json();
      const blogData = result.data || result;

      // Mise en cache
      const ttl = this.calculateTTL('blog');
      this.cache.set(cacheKey, { 
        data: blogData, 
        timestamp: Date.now(), 
        ttl 
      });

      console.log('[API CALL] Blog content:', brandId);
      return blogData;

    } catch (error) {
      console.warn('[WARNING] Blog content not available:', error);
      return null;
    }
  }

  /**
   * Traite les données SEO complètes (méthode principale)
   */
  async processCompleteSeoData(brandData: BrandData, seoData?: SeoMarqueData | null): Promise<ProcessedSeoData> {
    const variables = this.generateSeoVariables(brandData.marque_id, brandData.marque_name);
    
    // Titre
    let title = seoData?.sm_title || `Pièces détachées auto ${brandData.marque_name_meta_title} neuves & d'origine`;
    title = this.processSeoMarkers(title, variables);
    title = this.contentCleaner(title);

    // Description  
    let description = seoData?.sm_descrip || `Achetez pour votre ${brandData.marque_name_meta} des pièces détachées & accessoires auto de qualité à un prix pas cher de toutes les marques d'équipementiers de pièces automobile.`;
    description = this.processSeoMarkers(description, variables);
    description = this.contentCleaner(description);

    // Mots-clés
    let keywords = seoData?.sm_keywords || brandData.marque_name_meta;
    keywords = this.processSeoMarkers(keywords, variables);
    keywords = this.contentCleaner(keywords);

    // H1
    let h1 = seoData?.sm_h1 || `Pièces auto ${brandData.marque_name}`;
    h1 = this.processSeoMarkers(h1, variables);
    h1 = this.contentCleaner(h1);

    // Contenu
    let content = seoData?.sm_content || `Automecanik vous propose tous les modèles du constructeur automobile <b>${brandData.marque_name}</b>, sélectionnez le modèle de votre voiture <b>${brandData.marque_name}</b> et ensuite choisissez l'année et la motorisation de votre véhicule pour accéder au catalogue de pièce détachée compatible avec votre voiture.`;
    content = this.processSeoMarkers(content, variables);
    content = this.contentCleaner(content);

    // URL canonique
    const canonical = `${PHP_LEGACY_CONFIG.domain}/${PHP_LEGACY_CONFIG.auto}/${brandData.marque_alias}-${brandData.marque_id}.html`;
    
    // Robots
    const robots = brandData.marque_relfollow === 1 ? "index, follow" : "noindex, nofollow";

    return {
      title,
      description,
      keywords,
      h1,
      content,
      canonical,
      robots,
      og_title: title,
      og_description: description,
      og_image: brandData.marque_logo
    };
  }

  /**
   * Méthode principale : récupère toutes les données d'une page marque
   */
  async getBrandPageData(brandId: number): Promise<BrandPageResponse> {
    try {
      console.log('[API] Fetching complete brand page data for:', brandId);

      // Récupération parallèle des données principales
      const [brandData, seoData, popularVehicles, popularParts, blogContent] = await Promise.all([
        this.getBrandData(brandId),
        this.getSeoData(brandId),
        this.getPopularVehicles(brandId, 12),
        this.getPopularParts(brandId, 12),
        this.getBlogContent(brandId)
      ]);

      // Vérification que la marque est affichée
      if (!brandData.marque_display) {
        throw new Error('Marque désactivée');
      }

      // Traitement des données SEO
      const processedSeo = await this.processCompleteSeoData(brandData, seoData);

      // Contenu blog traité
      const processedBlogContent = {
        h1: blogContent?.bsm_h1 || `Choisissez votre véhicule ${brandData.marque_name}`,
        content: this.contentCleaner(
          blogContent?.bsm_content || 
          seoData?.sm_content || 
          `Un vaste choix de pièces détachées <b>${brandData.marque_name}</b> au meilleur tarif et de qualité irréprochable proposées par les grandes marques d'équipementiers automobile de première monte d'origine.`
        )
      };

      const response: BrandPageResponse = {
        success: true,
        data: {
          brand: brandData,
          seo: processedSeo,
          popular_vehicles: popularVehicles,
          popular_parts: popularParts,
          blog_content: processedBlogContent,
          meta: {
            total_vehicles: popularVehicles.length,
            total_parts: popularParts.length,
            last_updated: new Date().toISOString()
          }
        }
      };

      console.log('[SUCCESS] Brand page data fetched:', {
        brandId,
        vehiclesCount: popularVehicles.length,
        partsCount: popularParts.length,
        hasSeo: !!seoData,
        hasBlog: !!blogContent
      });

      return response;

    } catch (error) {
      console.error('[ERROR] Brand page data:', error);
      
      return {
        success: false,
        data: {} as any,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Recherche par type mine (reproduction formulaire PHP)
   */
  async searchByMineType(params: MineSearchParams): Promise<MineSearchResult> {
    try {
      const queryParams = new URLSearchParams({
        mine: params.mine,
        ask2page: params.ask_2_page,
        pgmine: params.pg_mine.toString()
      });

      const response = await fetch(`${API_BASE_URL}/api/search/mine?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`Mine search API error: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        vehicles: result.data?.vehicles || [],
        total: result.data?.total || 0,
        query: params.mine,
        suggestions: result.data?.suggestions || []
      };

    } catch (error) {
      console.error('[ERROR] Mine search:', error);
      
      return {
        success: false,
        vehicles: [],
        total: 0,
        query: params.mine,
        error: error instanceof Error ? error.message : 'Erreur de recherche'
      };
    }
  }

  /**
   * Nettoie le cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[CACHE CLEARED] Brand API cache cleared');
  }

  /**
   * Statistiques du cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export de l'instance singleton
export const brandApi = new BrandApiService();
export default brandApi;