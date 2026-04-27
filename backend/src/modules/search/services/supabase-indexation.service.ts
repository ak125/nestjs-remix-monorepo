import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { VehicleNamingService } from './vehicle-naming.service';

/**
 * 📊 SERVICE INDEXATION DONNÉES RÉELLES SUPABASE
 *
 * Importe les véhicules et produits depuis les vraies tables Supabase :
 * - auto_marque (117 marques avec logos)
 * - auto_modele (5,745 modèles avec périodes)
 * - auto_type (48,918 types/motorisations avec spécifications)
 * - pieces (pour les produits)
 */
@Injectable()
export class SupabaseIndexationService extends SupabaseBaseService {
  protected readonly logger = new Logger(SupabaseIndexationService.name);

  constructor(private readonly vehicleNamingService?: VehicleNamingService) {
    super();
  }

  /**
   * 🚗 Récupérer TOUS les véhicules réels avec noms complets
   *
   * NOUVELLE VERSION : Utilise le VehicleNamingService pour construire
   * des noms comme "AUDI A3 II 2.0 TDI 140 ch de 2005 à 2008"
   */
  async getAllVehiclesFromSupabase(limit: number = 1000, offset: number = 0) {
    try {
      this.logger.log(
        `🔍 Récupération véhicules avec noms complets - Limit: ${limit}, Offset: ${offset}`,
      );

      // Si le service de nommage est disponible, utiliser la méthode avancée
      if (this.vehicleNamingService) {
        const vehiclesWithNames =
          await this.vehicleNamingService.getVehiclesWithFullNames(limit);

        this.logger.log(
          `✅ Récupérés ${vehiclesWithNames.length} véhicules avec noms complets`,
        );
        return vehiclesWithNames;
      }

      // Sinon, fallback sur l'ancienne méthode
      this.logger.warn(
        '⚠️ VehicleNamingService non disponible, utilisation méthode basique',
      );

      const { data: vehicles, error } = await this.client
        .from(TABLES.auto_type)
        .select(
          `
          type_id,
          type_name,
          type_modele_id,
          type_marque_id,
          type_fuel,
          type_power_ps,
          type_year_from,
          type_year_to
        `,
        )
        .eq('type_display', '1')
        .range(offset, offset + limit - 1);

      if (error) {
        this.logger.error('❌ Erreur récupération véhicules:', error);
        throw error;
      }

      // Transformation basique
      const basicVehicles =
        vehicles?.map((vehicle) => ({
          id: `vehicle_${vehicle.type_id}`,
          type: 'vehicle',
          typeId: vehicle.type_id,
          name: vehicle.type_name,
          displayName: `${vehicle.type_name} (${vehicle.type_fuel})`,
          fullName: `UNKNOWN UNKNOWN ${vehicle.type_name}`,
          motorisation: vehicle.type_name,
          searchTerms: [vehicle.type_name, vehicle.type_fuel].filter(Boolean),
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })) || [];

      return basicVehicles;

      if (error) {
        this.logger.error('❌ Erreur récupération véhicules:', error);
        throw error;
      }

      this.logger.log(
        `✅ Récupéré ${vehicles?.length || 0} véhicules depuis Supabase`,
      );

      // Transformer les données pour Meilisearch avec toutes les informations
      const transformedVehicles =
        vehicles?.map((vehicle: any) => {
          const marque = vehicle.auto_modele?.auto_marque;
          const modele = vehicle.auto_modele;

          return {
            id: `vehicle_${vehicle.type_id}`,
            type: 'vehicle',
            typeId: vehicle.type_id,

            // Informations du véhicule
            name: vehicle.type_name,
            displayName: vehicle.type_name,
            fullName: `${marque?.marque_name} ${modele?.modele_name} ${vehicle.type_name}`,

            // Informations moteur
            motorisation: vehicle.type_name,
            engineCode: vehicle.type_code_moteur || vehicle.type_engine,
            engineName: vehicle.type_nom_moteur,
            fuel: vehicle.type_fuel,
            power: vehicle.type_power,

            // Informations marque
            brandId: marque?.marque_id,
            brandName: marque?.marque_name,
            brandCode: marque?.marque_alias,
            brandCountry: marque?.marque_country,

            // Informations modèle
            modelId: modele?.modele_id,
            modelName: modele?.modele_name,
            modelAlias: modele?.modele_alias,
            modelFullName: modele?.modele_ful_name,

            // Période de fabrication
            yearFrom: vehicle.type_year_from || vehicle.type_pf_deb,
            yearTo: vehicle.type_year_to || vehicle.type_pf_fin,

            // Métadonnées pour recherche
            searchTerms: [
              marque?.marque_name,
              modele?.modele_name,
              modele?.modele_ful_name,
              vehicle.type_name,
              vehicle.type_nom_moteur,
              vehicle.type_code_moteur,
              vehicle.type_engine,
            ].filter(Boolean),

            // Données d'indexation
            isActive: vehicle.type_display === 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }) || [];

      return {
        success: true,
        data: transformedVehicles,
        count: transformedVehicles.length,
        totalInQuery: vehicles?.length || 0,
      };
    } catch (error) {
      this.logger.error('❌ Erreur getAllVehiclesFromSupabase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: [],
        count: 0,
      };
    }
  }

  /**
   * 🔧 Récupérer TOUS les produits réels avec filtres inclus
   * MODIFIÉ : Prioriser les filtres en les récupérant séparément
   */
  async getAllProductsFromSupabase(limit: number = 1000, offset: number = 0) {
    try {
      this.logger.log(
        `🔍 Récupération produits Supabase avec filtres - Limit: ${limit}, Offset: ${offset}`,
      );

      // 1. Récupérer d'abord tous les filtres (priorité)
      const { data: filters, error: filtersError } = await this.client
        .from(TABLES.pieces)
        .select(
          `
          piece_id,
          piece_name,
          piece_ref,
          piece_des,
          piece_display,
          piece_has_img,
          piece_has_oem,
          piece_year
        `,
        )
        .ilike('piece_name', '%filtre%')
        .not('piece_name', 'is', null)
        .not('piece_name', 'eq', '')
        .order('piece_name')
        .limit(Math.min(200, limit)); // Max 200 filtres

      // 2. Récupérer les produits actifs normaux
      const remainingLimit = Math.max(0, limit - (filters?.length || 0));
      let activeProducts: any[] = [];

      if (remainingLimit > 0) {
        const { data: products, error: productsError } = await this.client
          .from(TABLES.pieces)
          .select(
            `
            piece_id,
            piece_name,
            piece_ref,
            piece_des,
            piece_display,
            piece_has_img,
            piece_has_oem,
            piece_year
          `,
          )
          .eq('piece_display', true)
          .not('piece_name', 'is', null)
          .not('piece_name', 'eq', '')
          .not('piece_name', 'ilike', '%filtre%') // Exclure les filtres déjà récupérés
          .order('piece_name')
          .range(offset, offset + remainingLimit - 1);

        if (productsError) {
          this.logger.error(
            '❌ Erreur récupération produits actifs:',
            productsError,
          );
        } else {
          activeProducts = products || [];
        }
      }

      // 3. Combiner filtres + produits actifs
      const allProducts = [...(filters || []), ...activeProducts];

      if (filtersError && !filters) {
        this.logger.error('❌ Erreur récupération filtres:', filtersError);
        throw filtersError;
      }

      this.logger.log(
        `✅ Récupéré ${allProducts.length} produits depuis Supabase (${filters?.length || 0} filtres + ${activeProducts.length} actifs)`,
      );

      // Transformer les données pour Meilisearch
      const transformedProducts =
        allProducts?.map((product: any) => {
          // 🏭 Déterminer l'équipementier basé sur la référence
          const brand = this.extractBrandFromReference(product.piece_ref || '');

          return {
            id: `product_${product.piece_id}`,
            type: 'product',
            productId: product.piece_id,
            name: product.piece_name,
            reference: product.piece_ref,
            description: product.piece_des,

            // 🏭 Informations équipementier
            brand: brand,
            brandId: product.piece_pm_id || null,
            productGroupId: product.piece_pg_id || null,
            articleGroupId: product.piece_ga_id || null,

            // Métadonnées pour recherche
            searchTerms: [
              product.piece_name,
              product.piece_ref,
              product.piece_des,
              brand, // Ajouter la marque aux termes de recherche
            ].filter(Boolean),

            // Données d'indexation
            isActive: product.piece_display === true,
            isFilter:
              product.piece_name?.toLowerCase().includes('filtre') || false,

            // Métadonnées supplémentaires
            year: product.piece_year || null,
            weight: product.piece_weight_kgm || 0,
            hasImage: product.piece_has_img || false,
            hasOEM: product.piece_has_oem || false,
            quantity: product.piece_qty_sale || 1,

            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }) || [];

      return {
        success: true,
        data: transformedProducts,
        count: transformedProducts.length,
        totalInQuery: allProducts?.length || 0,
        filterCount: filters?.length || 0,
      };
    } catch (error) {
      this.logger.error('❌ Erreur getAllProductsFromSupabase:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: [],
        count: 0,
        totalInQuery: 0,
      };
    }
  }

  /**
   * 📊 Obtenir les statistiques des tables Supabase
   */
  async getSupabaseStats() {
    try {
      this.logger.log('📊 Récupération statistiques Supabase...');

      const [marquesResult, modelesResult, typesResult, piecesResult] =
        await Promise.all([
          // Marques actives
          this.client
            .from(TABLES.auto_marque)
            .select('marque_id', { count: 'exact' })
            .eq('marque_display', 1),

          // Modèles actifs
          this.client
            .from(TABLES.auto_modele)
            .select('modele_id', { count: 'exact' })
            .eq('modele_display', 1),

          // Types actifs
          this.client
            .from(TABLES.auto_type)
            .select('type_id', { count: 'exact' })
            .eq('type_display', 1),

          // Pièces actives
          this.client
            .from(TABLES.pieces)
            .select('piece_id', { count: 'exact' })
            .eq('piece_display', true),
        ]);

      const stats = {
        marques: {
          total: marquesResult.count || 0,
          error: marquesResult.error?.message,
        },
        modeles: {
          total: modelesResult.count || 0,
          error: modelesResult.error?.message,
        },
        types: {
          total: typesResult.count || 0,
          error: typesResult.error?.message,
        },
        pieces: {
          total: piecesResult.count || 0,
          error: piecesResult.error?.message,
        },
      };

      this.logger.log(
        '📊 Statistiques Supabase:',
        JSON.stringify(stats, null, 2),
      );
      return stats;
    } catch (error) {
      this.logger.error('❌ Erreur getSupabaseStats:', error);
      return {
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * 🔍 Test de connexion et récupération d'échantillons
   */
  async testSupabaseConnection() {
    try {
      this.logger.log('🧪 Test connexion Supabase...');

      // Test 1: Récupérer 3 marques (simple, pas de relation)
      const { data: sampleBrands, error: brandsError } = await this.client
        .from(TABLES.auto_marque)
        .select('marque_id, marque_name, marque_logo, marque_display')
        .eq('marque_display', 1)
        .limit(3);

      if (brandsError) {
        this.logger.error('❌ Erreur test marques:', brandsError);
        return { success: false, error: brandsError.message };
      }

      // Test 2: Récupérer 3 types simples (sans jointure)
      const { data: sampleTypes, error: typesError } = await this.client
        .from(TABLES.auto_type)
        .select('type_id, type_name, type_display, type_modele_id')
        .eq('type_display', 1)
        .limit(3);

      if (typesError) {
        this.logger.error('❌ Erreur test types:', typesError);
        return { success: false, error: typesError.message };
      }

      // Test 3: Récupérer 3 produits simples
      const { data: sampleProducts, error: productsError } = await this.client
        .from(TABLES.pieces)
        .select('piece_id, piece_name, piece_ref, piece_display')
        .eq('piece_display', true)
        .not('piece_name', 'is', null)
        .limit(3);

      if (productsError) {
        this.logger.error('❌ Erreur test produits:', productsError);
        return { success: false, error: productsError.message };
      }

      this.logger.log(
        '✅ Test connexion Supabase réussi - Données récupérées avec succès',
      );
      return {
        success: true,
        samples: {
          brands: sampleBrands,
          types: sampleTypes,
          products: sampleProducts,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur testSupabaseConnection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * 🔧 Accès au client Supabase pour les services externes
   * Permet aux autres services d'accéder au client configuré
   */
  getClient() {
    return this.client;
  }

  /**
   * 🏭 Extraire l'équipementier/marque depuis la référence de pièce
   */
  private extractBrandFromReference(reference: string): string {
    if (!reference) return 'INCONNU';

    const ref = reference.toLowerCase().replace(/\s+/g, '');

    // Patterns de références courantes
    const brandPatterns = {
      bosch: ['0986', '0 986', 'bosch'],
      'mann-filter': ['mann', 'hum', 'w'],
      mahle: ['lx', 'ox', 'kx', 'mahle'],
      fram: ['fram', 'ca'],
      purflux: ['purflux', 'a', 'l'],
      knecht: ['knecht', 'lx'],
      champion: ['champion', 'cof'],
      febi: ['febi', '49', '48'],
      sachs: ['sachs', 'zf'],
      valeo: ['valeo', '585'],
    };

    // Recherche de correspondance
    for (const [brand, patterns] of Object.entries(brandPatterns)) {
      if (patterns.some((pattern) => ref.includes(pattern))) {
        return brand.toUpperCase();
      }
    }

    // Si aucune correspondance, retourner le début de la référence
    const firstPart = reference.split(' ')[0] || reference.substring(0, 4);
    return firstPart.toUpperCase();
  }
}
