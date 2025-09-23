// 📁 frontend/app/services/api/enhanced-brand.api.ts
// 🏭 Service API amélioré pour les marques - Basé sur l'analyse des fichiers PHP fournis
// Version 2.0 - Intégration des nouvelles fonctionnalités et optimisations

import type { 
  BrandData, 
  SeoData, 
  PopularVehicle, 
  PopularPart, 
  BlogContent 
} from "../../routes/constructeurs.$brand";

// 🎯 Configuration basée sur l'analyse des versions PHP
interface EnhancedBrandApiConfig {
  baseUrl: string;
  cacheTTL: number;
  enableSeoVariables: boolean;
  enableImageOptimization: boolean;
  supportWebP: boolean;
}

// 🚗 Interface pour les véhicules populaires avec SEO dynamique
interface VehicleWithSeo extends PopularVehicle {
  // SEO dynamique généré côté client
  seo_title_generated?: string;
  seo_content_generated?: string;
  vehicle_url?: string;
  image_url_optimized?: string;
  date_range_formatted?: string;
}

// 🔧 Interface pour les pièces populaires avec variables SEO
interface PartWithSeo extends PopularPart {
  // SEO dynamique généré côté client
  seo_title_generated?: string;
  seo_content_generated?: string;
  part_url?: string;
  image_url_optimized?: string;
  // Variables de switch SEO (équivalent #CompSwitch#)
  comp_switch_values?: {
    title?: string;
    content?: string;
    link_text?: string;
  };
}

// 📊 Interface de réponse enrichie
interface EnhancedBrandResponse {
  brand: BrandData;
  seo: {
    title: string;
    description: string;
    keywords: string;
    robots: string;
    canonical: string;
    h1: string;
    content: string;
  };
  popularVehicles: VehicleWithSeo[];
  popularParts: PartWithSeo[];
  blogContent: BlogContent;
  // Nouvelles métadonnées basées sur l'analyse PHP
  analytics: {
    page_type: 'brand';
    brand_id: number;
    brand_name: string;
    vehicles_count: number;
    parts_count: number;
  };
  performance: {
    load_time: number;
    cache_hit: boolean;
    api_calls: number;
  };
}

/**
 * 🏭 Service API amélioré pour les pages marques
 * Intègre toutes les fonctionnalités découvertes dans les fichiers PHP
 */
export class EnhancedBrandApiService {
  private config: EnhancedBrandApiConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor(config: EnhancedBrandApiConfig) {
    this.config = config;
  }

  /**
   * 🔧 Nettoyeur de contenu avancé (basé sur content_cleaner PHP)
   */
  private contentCleaner(content: string): string {
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/[^\x20-\x7E\u00C0-\u017F\u0100-\u024F]/g, '')
      .trim();
  }

  /**
   * 🎯 Générateur de variables SEO dynamiques (équivalent PHP)
   */
  private generateSeoVariables(brandId: number, typeId: number, content: string): string {
    // Tableau équivalent $PrixPasCher du PHP
    const prixPasCher = [
      "à petit prix", "à prix compétitif", "au meilleur tarif", "à prix cassé",
      "à prix mini", "en promotion", "à prix réduit", "pas cher",
      "à prix attractif", "en solde", "à tarif préférentiel", "à coût réduit"
    ];
    
    const prixPasCherTab = brandId % prixPasCher.length;
    
    return content
      .replace(/#PrixPasCher#/g, prixPasCher[prixPasCherTab])
      .replace(/#VMarque#/g, '{{BRAND_NAME}}'); // Placeholder pour remplacement ultérieur
  }

  /**
   * 🔄 Générateur de contenu #CompSwitch# (basé sur l'analyse PHP)
   */
  private generateCompSwitchContent(typeId: number, pgId: number = 0, switchType: number = 1): string {
    const compSwitchContents = {
      1: ["de qualité", "d'origine", "certifiées", "garanties", "premium"],
      2: ["neuves", "reconditionnées", "d'occasion", "en stock", "disponibles"],  
      3: ["compatibles", "adaptées", "spécialisées", "dédiées", "conçues"]
    };
    
    const contents = compSwitchContents[switchType as keyof typeof compSwitchContents] || compSwitchContents[1];
    const index = (typeId + pgId + switchType) % contents.length;
    return contents[index];
  }

  /**
   * 🖼️ Optimiseur d'images (gestion WebP/fallback basée sur PHP)
   */
  private getOptimizedImageUrl(basePath: string, filename: string): string {
    if (!filename) return `${basePath}/no.png`;
    
    // Détection WebP support (simulé - en réalité on utiliserait une détection navigateur)
    const supportsWebP = this.config.supportWebP;
    
    if (!supportsWebP && filename.includes('.webp')) {
      filename = filename.replace('.webp', '.jpg');
    }
    
    return `${basePath}/${filename}`;
  }

  /**
   * 🔗 Générateur d'URLs véhicules (reproduit la logique PHP)
   */
  private generateVehicleUrl(vehicle: PopularVehicle): string {
    return `/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.cgc_type_id}.html`;
  }

  /**
   * 🔗 Générateur d'URLs pièces (reproduit la logique PHP)
   */
  private generatePartUrl(part: PopularPart): string {
    return `/pieces/${part.pg_alias}-${part.cgc_pg_id}/${part.marque_alias}-${part.marque_id}/${part.modele_alias}-${part.modele_id}/${part.type_alias}-${part.type_id}.html`;
  }

  /**
   * 📅 Formateur de plages de dates (reproduit la logique PHP)
   */
  private formatDateRange(monthFrom?: number, yearFrom?: number, monthTo?: number, yearTo?: number): string {
    if (!yearFrom) return "";
    
    if (!yearTo) {
      return `du ${monthFrom ? monthFrom + '/' : ''}${yearFrom}`;
    } else {
      const fromDate = monthFrom ? `${monthFrom}/${yearFrom}` : `${yearFrom}`;
      const toDate = monthTo ? `${monthTo}/${yearTo}` : `${yearTo}`;
      return `de ${fromDate} à ${toDate}`;
    }
  }

  /**
   * 🚗 Enrichissement des données véhicules avec SEO
   */
  private enrichVehicleData(vehicle: PopularVehicle): VehicleWithSeo {
    const dateRange = this.formatDateRange(
      vehicle.type_month_from,
      vehicle.type_year_from, 
      vehicle.type_month_to,
      vehicle.type_year_to
    );

    // Génération SEO basée sur l'analyse des fichiers PHP
    const seoTitle = `Pièces auto ${vehicle.marque_name_meta_title} ${vehicle.modele_name_meta} ${vehicle.type_name_meta} ${this.generateCompSwitchContent(vehicle.cgc_type_id, 0, 1)}`;
    
    const seoContent = `Catalogue pièces détachées pour ${vehicle.marque_name_meta_title} ${vehicle.modele_name_meta} ${vehicle.type_name_meta} ${vehicle.type_power_ps} ch ${dateRange} neuves ${this.generateCompSwitchContent(vehicle.cgc_type_id, 0, 2)}`;

    return {
      ...vehicle,
      seo_title_generated: this.contentCleaner(seoTitle),
      seo_content_generated: this.contentCleaner(seoContent),
      vehicle_url: this.generateVehicleUrl(vehicle),
      image_url_optimized: this.getOptimizedImageUrl(
        'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/' + vehicle.marque_alias,
        vehicle.modele_pic || ''
      ),
      date_range_formatted: dateRange
    };
  }

  /**
   * 🔧 Enrichissement des données pièces avec SEO
   */
  private enrichPartData(part: PopularPart): PartWithSeo {
    // Génération des variables #CompSwitch# selon l'analyse PHP
    const compSwitchTitle = this.generateCompSwitchContent(part.type_id, part.cgc_pg_id, 1);
    const compSwitchContent = this.generateCompSwitchContent(part.type_id, part.cgc_pg_id, 2);
    const compSwitchLink = this.generateCompSwitchContent(part.type_id, part.cgc_pg_id, 3);

    const seoTitle = `${part.pg_name} pour ${part.marque_name} ${part.modele_name} ${part.type_name}`;
    const seoContent = `Achetez ${part.pg_name_meta} ${part.marque_name} ${part.modele_name} ${part.type_name} ${compSwitchContent}, d'origine à prix bas.`;

    return {
      ...part,
      seo_title_generated: this.contentCleaner(seoTitle),
      seo_content_generated: this.contentCleaner(seoContent),
      part_url: this.generatePartUrl(part),
      image_url_optimized: this.getOptimizedImageUrl(
        'https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue',
        part.pg_img || ''
      ),
      comp_switch_values: {
        title: compSwitchTitle,
        content: compSwitchContent,
        link_text: compSwitchLink
      }
    };
  }

  /**
   * 🏭 Méthode principale - récupération des données marque enrichies
   */
  async getBrandData(brandId: number): Promise<EnhancedBrandResponse> {
    const startTime = performance.now();
    const cacheKey = `brand_${brandId}`;
    
    // Vérification cache
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.config.cacheTTL) {
      return {
        ...cached.data,
        performance: {
          ...cached.data.performance,
          cache_hit: true
        }
      };
    }

    try {
      // Appels API parallèles (optimisation basée sur l'analyse PHP)
      const [brandResponse, seoResponse, vehiclesResponse, partsResponse, blogResponse] = await Promise.all([
        fetch(`${this.config.baseUrl}/api/vehicles/brands/${brandId}`),
        fetch(`${this.config.baseUrl}/api/seo/marque/${brandId}`).catch(() => ({ ok: false })),
        fetch(`${this.config.baseUrl}/api/brands/${brandId}/popular-vehicles`).catch(() => ({ ok: false })),
        fetch(`${this.config.baseUrl}/api/brands/${brandId}/popular-parts`).catch(() => ({ ok: false })),
        fetch(`${this.config.baseUrl}/api/blog/marque/${brandId}`).catch(() => ({ ok: false }))
      ]);

      if (!brandResponse.ok) {
        throw new Error(`Brand API error: ${brandResponse.status}`);
      }

      const brandData = await brandResponse.json();
      const brand: BrandData = brandData.data?.brand || brandData.data;

      // Traitement des données SEO
      let seoData: SeoData = {};
      if (seoResponse.ok) {
        const seoResult = await seoResponse.json();
        seoData = seoResult.data || {};
      }

      // Traitement des véhicules populaires
      let popularVehicles: PopularVehicle[] = [];
      if (vehiclesResponse.ok) {
        const vehiclesResult = await vehiclesResponse.json();
        popularVehicles = vehiclesResult.data || [];
      }

      // Traitement des pièces populaires  
      let popularParts: PopularPart[] = [];
      if (partsResponse.ok) {
        const partsResult = await partsResponse.json();
        popularParts = partsResult.data || [];
      }

      // Traitement du contenu blog
      let blogContent: BlogContent = {};
      if (blogResponse.ok) {
        const blogResult = await blogResponse.json();
        blogContent = blogResult.data || {};
      }

      // Génération des métadonnées SEO enrichies
      const pageTitle = seoData.sm_title 
        ? this.generateSeoVariables(brandId, 0, seoData.sm_title.replace('{{BRAND_NAME}}', brand.marque_name_meta_title))
        : `Pièces détachées auto ${brand.marque_name_meta_title} neuves & d'origine`;

      const pageDescription = seoData.sm_descrip || 
        `Achetez pour votre ${brand.marque_name_meta} des pièces détachées & accessoires auto de qualité à un prix pas cher de toutes les marques d'équipementiers de pièces automobile.`;

      const pageRobots = brand.marque_relfollow === 1 ? "index, follow" : "noindex, nofollow";
      const canonicalUrl = `${this.config.baseUrl}/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`;

      // Enrichissement des données
      const enrichedVehicles = popularVehicles.map(v => this.enrichVehicleData(v));
      const enrichedParts = popularParts.map(p => this.enrichPartData(p));

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      const result: EnhancedBrandResponse = {
        brand,
        seo: {
          title: this.contentCleaner(pageTitle),
          description: this.contentCleaner(pageDescription),
          keywords: seoData.sm_keywords || brand.marque_name_meta,
          robots: pageRobots,
          canonical: canonicalUrl,
          h1: seoData.sm_h1 || `Pièces auto ${brand.marque_name}`,
          content: this.contentCleaner(seoData.sm_content || `Automecanik vous propose tous les modèles du constructeur automobile <b>${brand.marque_name}</b>`)
        },
        popularVehicles: enrichedVehicles,
        popularParts: enrichedParts,
        blogContent,
        analytics: {
          page_type: 'brand',
          brand_id: brand.marque_id,
          brand_name: brand.marque_name,
          vehicles_count: enrichedVehicles.length,
          parts_count: enrichedParts.length
        },
        performance: {
          load_time: loadTime,
          cache_hit: false,
          api_calls: 5
        }
      };

      // Mise en cache
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

      return result;

    } catch (error) {
      console.error('Enhanced Brand API Error:', error);
      throw error;
    }
  }

  /**
   * 🧹 Nettoyage du cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 📊 Statistiques du cache
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 🏭 Instance par défaut du service
export const enhancedBrandApi = new EnhancedBrandApiService({
  baseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  enableSeoVariables: true,
  enableImageOptimization: true,
  supportWebP: typeof window !== 'undefined' && 'createImageBitmap' in window
});