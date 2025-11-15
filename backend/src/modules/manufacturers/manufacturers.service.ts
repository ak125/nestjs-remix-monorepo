/**
 * 🏭 SERVICE MANUFACTURERS SIMPLE
 *
 * Utilise UNIQUEMENT les tables existantes auto_* sans enrichissement :
 * - auto_marque (117 marques avec logos)
 * - auto_modele (5745 modèles avec périodes)
 * - auto_type (48918 types/motorisations)
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

@Injectable()
export class ManufacturersService extends SupabaseBaseService {
  protected readonly logger = new Logger(ManufacturersService.name);

  constructor(
    configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super(configService);
  }

  /**
   * Méthode de debug pour diagnostiquer la configuration
   */
  async debugConfiguration() {
    return {
      supabaseUrl: this.supabaseUrl,
      hasServiceKey: !!this.supabaseServiceKey,
      serviceKeyLength: this.supabaseServiceKey?.length || 0,
      clientInitialized: !!this.client,
    };
  }

  /**
   * Test direct de connexion à la base
   */
  async testDatabaseConnection() {
    try {
      const { data, error } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_name, marque_display')
        .gte('marque_display', 1)
        .limit(3);

      return {
        success: !error,
        error: error?.message || null,
        dataCount: data?.length || 0,
        sampleData: data?.[0] || null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        dataCount: 0,
        sampleData: null,
      };
    }
  }

  /**
   * Récupérer tous les constructeurs depuis auto_marque
   */
  async getAllManufacturers(search?: string): Promise<{
    data: any[];
    total: number;
    message: string;
  }> {
    try {
      // Clé de cache basée sur la recherche
      const cacheKey = `manufacturers_${search || 'all'}`;

      // Vérifier le cache d'abord
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.logger.log(`✅ Cache hit pour ${cacheKey}`);
        return cached as any;
      }

      this.logger.log('Récupération des constructeurs depuis auto_marque...');
      this.logger.log(`URL Supabase utilisée: ${this.supabaseUrl}`);
      this.logger.log(
        `Service Key présente: ${this.supabaseServiceKey ? 'Oui' : 'Non'}`,
      );

      let query = this.client
        .from('auto_marque')
        .select(
          `
          marque_id,
          marque_name,
          marque_logo,
          marque_display
        `,
        )
        .gte('marque_display', 1)
        .order('marque_name', { ascending: true });

      // Recherche par nom si fourni
      if (search) {
        query = query.ilike('marque_name', `%${search}%`);
      }

      const { data: manufacturers, error } = await query;

      this.logger.log(`Erreur Supabase: ${error ? error.message : 'Aucune'}`);
      this.logger.log(
        `Nombre d'enregistrements: ${manufacturers?.length || 0}`,
      );

      if (error) {
        throw new Error(`Erreur base de données: ${error.message}`);
      }

      this.logger.log(
        `✅ ${manufacturers?.length || 0} constructeurs récupérés`,
      );

      const formattedData =
        manufacturers?.map((m: any) => ({
          id: m.marque_id,
          name: m.marque_name,
          logo_url: m.marque_logo
            ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${m.marque_logo}`
            : null,
          slug: this.generateSlug(m.marque_name),
          is_active: m.marque_display >= 1,
        })) || [];

      const result = {
        data: formattedData,
        total: formattedData.length,
        message: `${formattedData.length} constructeurs trouvés`,
      };

      // Mettre en cache le résultat
      await this.cacheManager.set(cacheKey, result);
      this.logger.log(`✅ Résultat mis en cache : ${cacheKey}`);

      return result;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des constructeurs:',
        error,
      );
      throw new Error(
        `Erreur lors de la récupération des constructeurs: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
    }
  }

  /**
   * Récupérer un constructeur par ID depuis auto_marque
   */
  async getManufacturerById(id: number, includeModels = true) {
    try {
      const { data: manufacturer, error } = await this.client
        .from('auto_marque')
        .select(
          `
          marque_id,
          marque_name,
          marque_logo,
          marque_display
        `,
        )
        .eq('marque_id', id)
        .gte('marque_display', 1)
        .single();

      if (error || !manufacturer) {
        return {
          success: false,
          data: null,
          error: 'Constructeur non trouvé',
        };
      }

      const formattedManufacturer = {
        id: manufacturer.marque_id,
        name: manufacturer.marque_name,
        logo_url: manufacturer.marque_logo
          ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${manufacturer.marque_logo}`
          : null,
        slug: this.generateSlug(manufacturer.marque_name),
        is_active: manufacturer.marque_display >= 1,
      };

      let models = [];
      if (includeModels) {
        const modelsResult = await this.getModelsByManufacturer(id, {
          limit: 50,
        });
        models = modelsResult.data || [];
      }

      return {
        success: true,
        data: {
          manufacturer: formattedManufacturer,
          models: models,
        },
        error: null,
      };
    } catch (error) {
      this.logger.error(`Erreur getManufacturerById(${id}):`, error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer les modèles d'un constructeur depuis auto_modele
   */
  async getModelsByManufacturer(
    manufacturerId: number,
    filters?: {
      search?: string;
      active_only?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    try {
      let query = this.client
        .from('auto_modele')
        .select(
          `
          modele_id,
          modele_name,
          modele_alias,
          modele_year_from,
          modele_year_to,
          modele_display
        `,
        )
        .eq('modele_marque_id', manufacturerId)
        .order('modele_name', { ascending: true });

      // Filtres optionnels
      if (filters?.search) {
        query = query.ilike('modele_name', `%${filters.search}%`);
      }

      if (filters?.active_only) {
        query = query.gte('modele_display', 1);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(
          filters.offset,
          (filters.offset || 0) + (filters.limit || 50) - 1,
        );
      }

      const { data: models, error } = await query;

      if (error) {
        throw new Error(`Erreur base de données: ${error.message}`);
      }

      const formattedModels =
        models?.map((m: any) => ({
          id: m.modele_id,
          manufacturer_id: manufacturerId,
          code: m.modele_alias || `M${m.modele_id}`,
          name: m.modele_name,
          year_start: m.modele_year_from,
          year_end: m.modele_year_to,
          is_active: m.modele_display >= 1,
        })) || [];

      this.logger.log(
        `✅ ${formattedModels.length} modèles récupérés pour constructeur ${manufacturerId}`,
      );

      return {
        data: formattedModels,
        total: formattedModels.length,
        message: `${formattedModels.length} modèles trouvés`,
      };
    } catch (error) {
      this.logger.error(
        `Erreur getModelsByManufacturer(${manufacturerId}):`,
        error,
      );
      throw new Error(
        `Erreur lors de la récupération des modèles: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
    }
  }

  /**
   * Récupérer les types d'un modèle depuis auto_type
   */
  async getTypesByModel(
    modelId: number,
    filters?: {
      search?: string;
      fuel_type?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    try {
      let query = this.client
        .from('auto_type')
        .select(
          `
          type_id,
          type_name,
          type_fuel,
          type_power_ps,
          type_power_kw,
          type_liter,
          type_engine,
          type_year_from,
          type_year_to
        `,
        )
        .eq('type_modele_id', modelId)
        .order('type_name', { ascending: true });

      // Filtres optionnels
      if (filters?.search) {
        query = query.ilike('type_name', `%${filters.search}%`);
      }

      if (filters?.fuel_type) {
        query = query.eq('type_fuel', filters.fuel_type);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(
          filters.offset,
          (filters.offset || 0) + (filters.limit || 50) - 1,
        );
      }

      const { data: types, error } = await query;

      if (error) {
        throw new Error(`Erreur base de données: ${error.message}`);
      }

      const formattedTypes =
        types?.map((t: any) => ({
          id: t.type_id,
          model_id: modelId,
          name: t.type_name,
          fuel_type: t.type_fuel,
          power_hp: t.type_power_ps ? parseInt(t.type_power_ps, 10) : null,
          power_kw: t.type_power_kw ? parseInt(t.type_power_kw, 10) : null,
          engine_size: t.type_liter,
          engine_code: t.type_engine,
          year_from: t.type_year_from ? parseInt(t.type_year_from, 10) : 0,
          year_to: t.type_year_to ? parseInt(t.type_year_to, 10) : 0,
        })) || [];

      return {
        data: formattedTypes,
        total: formattedTypes.length,
        message: `${formattedTypes.length} types trouvés`,
      };
    } catch (error) {
      this.logger.error(`Erreur getTypesByModel(${modelId}):`, error);
      throw new Error(
        `Erreur lors de la récupération des types: ${
          error instanceof Error ? error.message : 'Erreur inconnue'
        }`,
      );
    }
  }

  /**
   * Récupérer les types de carburant disponibles (inspiré de votre service)
   */
  async getFuelTypes() {
    try {
      const cacheKey = 'types_fuel_types';
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      // Approche simplifiée : échantillon de 5000 pour éviter timeout
      const { data, error } = await this.client
        .from('auto_type')
        .select('type_fuel')
        .not('type_fuel', 'is', null)
        .not('type_fuel', 'eq', '')
        .limit(5000);

      if (error) {
        throw new Error(
          `Erreur récupération types carburant: ${error.message}`,
        );
      }

      const fuelTypes = [
        ...new Set(data?.map((item) => item.type_fuel).filter(Boolean)),
      ];
      const result = fuelTypes.sort();

      await this.cacheManager.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error('Erreur getFuelTypes:', error);
      // Fallback avec les types connus
      return [
        'Diesel',
        'Essence',
        'Électrique',
        'Essence-Électrique',
        'GPL',
        'Gaz naturel',
      ];
    }
  }

  /**
   * Récupérer les gammes de puissance (inspiré de votre service)
   */
  async getPowerRanges() {
    try {
      const cacheKey = 'types_power_ranges';
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const { data, error } = await this.client
        .from('auto_type')
        .select('type_power_ps, type_power_kw')
        .not('type_power_ps', 'is', null);

      if (error) {
        throw new Error(
          `Erreur récupération gammes puissance: ${error.message}`,
        );
      }

      const powers =
        data
          ?.map((t) => ({
            ps: t.type_power_ps ? parseInt(t.type_power_ps, 10) : 0,
            kw: t.type_power_kw ? parseInt(t.type_power_kw, 10) : 0,
          }))
          .filter((p) => p.ps > 0) || [];

      const result = {
        ps: {
          min: Math.min(...powers.map((p) => p.ps)),
          max: Math.max(...powers.map((p) => p.ps)),
        },
        kw: {
          min: Math.min(...powers.map((p) => p.kw)),
          max: Math.max(...powers.map((p) => p.kw)),
        },
      };

      await this.cacheManager.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error('Erreur getPowerRanges:', error);
      return { ps: { min: 0, max: 0 }, kw: { min: 0, max: 0 } };
    }
  }

  /**
   * Rechercher des types par critères multiples (inspiré de votre service)
   */
  async searchTypes(filters?: {
    manufacturerId?: number;
    search?: string;
    fuel_type?: string;
    min_power?: number;
    max_power?: number;
    year_from?: number;
    year_to?: number;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = this.client.from('auto_type').select(
        `
          type_id,
          type_name,
          type_fuel,
          type_power_ps,
          type_power_kw,
          type_liter,
          type_engine,
          type_year_from,
          type_year_to,
          auto_modele!type_modele_id (
            modele_id,
            modele_name,
            auto_marque!modele_marque_id (
              marque_id,
              marque_name,
              marque_logo
            )
          )
        `,
        { count: 'exact' },
      );

      // Filtres
      if (filters?.manufacturerId) {
        query = query.eq(
          'auto_modele.modele_marque_id',
          filters.manufacturerId,
        );
      }

      if (filters?.search) {
        query = query.ilike('type_name', `%${filters.search}%`);
      }

      if (filters?.fuel_type) {
        query = query.eq('type_fuel', filters.fuel_type);
      }

      if (filters?.min_power) {
        query = query.gte('type_power_ps', filters.min_power);
      }

      if (filters?.max_power) {
        query = query.lte('type_power_ps', filters.max_power);
      }

      if (filters?.year_from) {
        query = query.gte('type_year_from', filters.year_from);
      }

      if (filters?.year_to) {
        query = query.lte('type_year_to', filters.year_to);
      }

      const limit = Math.min(filters?.limit || 50, 100);
      const offset = filters?.offset || 0;

      const { data, error, count } = await query
        .order('type_name')
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Erreur recherche types: ${error.message}`);
      }

      const formattedTypes =
        data?.map((t: any) => ({
          id: t.type_id,
          name: t.type_name,
          fuel_type: t.type_fuel,
          power_hp: t.type_power_ps ? parseInt(t.type_power_ps, 10) : null,
          power_kw: t.type_power_kw ? parseInt(t.type_power_kw, 10) : null,
          engine_size: t.type_liter,
          engine_code: t.type_engine,
          year_from: t.type_year_from ? parseInt(t.type_year_from, 10) : 0,
          year_to: t.type_year_to ? parseInt(t.type_year_to, 10) : 0,
          model: {
            id: t.auto_modele?.modele_id,
            name: t.auto_modele?.modele_name,
            manufacturer: {
              id: t.auto_modele?.auto_marque?.marque_id,
              name: t.auto_modele?.auto_marque?.marque_name,
              logo_url: t.auto_modele?.auto_marque?.marque_logo
                ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${t.auto_modele.auto_marque.marque_logo}`
                : null,
            },
          },
        })) || [];

      return {
        data: formattedTypes,
        total: count || 0,
        hasNext: offset + limit < (count || 0),
        hasPrev: offset > 0,
        message: `${formattedTypes.length} types trouvés`,
      };
    } catch (error) {
      this.logger.error('Erreur searchTypes:', error);
      return {
        data: [],
        total: 0,
        hasNext: false,
        hasPrev: false,
        message: 'Erreur lors de la recherche de types',
      };
    }
  }

  /**
   * Récupérer les types par catégorie de carburant
   */
  async getTypesByFuelType(fuelType: string, limit = 20) {
    try {
      const cacheKey = `types_by_fuel_${fuelType}_${limit}`;
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const { data, error } = await this.client
        .from('auto_type')
        .select(
          `
          type_id,
          type_name,
          type_fuel,
          type_power_ps,
          type_power_kw,
          type_modele_id,
          auto_modele!type_modele_id(
            modele_name,
            modele_marque_id,
            auto_marque!modele_marque_id(marque_name, marque_logo)
          )
        `,
        )
        .eq('type_fuel', fuelType)
        .limit(limit)
        .order('type_power_ps', { ascending: false, nullsFirst: false });

      if (error) {
        throw new Error(`Erreur types par carburant: ${error.message}`);
      }

      const formattedTypes =
        data?.map((t: any) => ({
          id: t.type_id,
          name: t.type_name,
          fuel_type: t.type_fuel,
          power_hp: t.type_power_ps ? parseInt(t.type_power_ps, 10) : null,
          power_kw: t.type_power_kw ? parseInt(t.type_power_kw, 10) : null,
          model: {
            id: t.type_modele_id,
            name: t.auto_modele?.modele_name,
            manufacturer: {
              id: t.auto_modele?.auto_marque?.marque_id,
              name: t.auto_modele?.auto_marque?.marque_name,
              logo_url: t.auto_modele?.auto_marque?.marque_logo
                ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${t.auto_modele.auto_marque.marque_logo}`
                : null,
            },
          },
        })) || [];

      const result = {
        data: formattedTypes,
        fuel_type: fuelType,
        total: formattedTypes.length,
      };

      await this.cacheManager.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error('Erreur getTypesByFuelType:', error);
      return { data: [], fuel_type: fuelType, total: 0 };
    }
  }

  /**
   * Récupérer les statistiques des types
   */
  async getTypesStats() {
    try {
      const cacheKey = 'types_stats';
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const [totalTypes, fuelTypesData, avgPower] = await Promise.all([
        this.client
          .from('auto_type')
          .select('type_id', { count: 'exact', head: true }),
        this.client
          .from('auto_type')
          .select('type_fuel')
          .not('type_fuel', 'is', null),
        this.client
          .from('auto_type')
          .select('type_power_ps')
          .not('type_power_ps', 'is', null)
          .gt('type_power_ps', 0),
      ]);

      const fuelTypes = [
        ...new Set(fuelTypesData.data?.map((item) => item.type_fuel)),
      ];
      const totalPower =
        avgPower.data?.reduce(
          (sum, item) => sum + parseInt(item.type_power_ps, 10),
          0,
        ) || 0;
      const avgHorsepower = avgPower.data?.length
        ? Math.round(totalPower / avgPower.data.length)
        : 0;

      const stats = {
        total_types: totalTypes.count || 0,
        fuel_types_count: fuelTypes.length,
        average_horsepower: avgHorsepower,
        fuel_types: fuelTypes.sort(),
        last_updated: new Date().toISOString(),
      };

      await this.cacheManager.set(cacheKey, stats);
      return stats;
    } catch (error) {
      this.logger.error('Erreur getTypesStats:', error);
      return {
        total_types: 0,
        fuel_types_count: 0,
        average_horsepower: 0,
        fuel_types: [],
        last_updated: new Date().toISOString(),
      };
    }
  }

  /**
   * Nettoyer le cache des constructeurs
   */
  async clearCache(pattern?: string) {
    if (pattern) {
      // Nettoyer un pattern spécifique
      await this.cacheManager.del(`manufacturers_${pattern}`);
      this.logger.log(`🧹 Cache nettoyé pour pattern: ${pattern}`);
    } else {
      // Nettoyer tout le cache (si la méthode existe)
      if (this.cacheManager.reset) {
        await this.cacheManager.reset();
        this.logger.log('🧹 Cache entièrement nettoyé');
      }
    }
  }

  /**
   * Récupérer les constructeurs populaires (par nombre de modèles)
   */
  async getPopularManufacturers(limit = 10) {
    try {
      const cacheKey = `manufacturers_popular_${limit}`;
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      // Utilisons une approche simple - les marques avec le plus de modèles
      const { data: popular, error } = await this.client
        .from('auto_marque')
        .select(
          `
          marque_id,
          marque_name,
          marque_logo,
          marque_display
        `,
        )
        .gte('marque_display', 1)
        .in('marque_name', [
          'VOLKSWAGEN',
          'BMW',
          'AUDI',
          'MERCEDES',
          'TOYOTA',
          'PEUGEOT',
          'RENAULT',
          'FORD',
          'OPEL',
          'FIAT',
        ])
        .order('marque_name')
        .limit(limit);

      if (error) {
        throw new Error(`Erreur récupération populaires: ${error.message}`);
      }

      const formattedData =
        popular?.map((m: any) => ({
          id: m.marque_id,
          name: m.marque_name,
          logo_url: m.marque_logo
            ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${m.marque_logo}`
            : null,
          slug: this.generateSlug(m.marque_name),
          is_active: m.marque_display >= 1,
          is_popular: true,
        })) || [];

      const result = {
        data: formattedData,
        message: `${formattedData.length} constructeurs populaires`,
      };

      await this.cacheManager.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error('Erreur getPopularManufacturers:', error);
      return {
        data: [],
        message: 'Erreur lors de la récupération des constructeurs populaires',
      };
    }
  }

  /**
   * 🆕 Récupérer les bestsellers d'une marque (véhicules + pièces)
   * Utilise la fonction RPC get_brand_bestsellers_optimized
   */
  async getBrandBestsellers(
    brandAlias: string,
    limitVehicles = 12,
    limitParts = 12,
  ) {
    try {
      const cacheKey = `brand_bestsellers_${brandAlias}_${limitVehicles}_${limitParts}`;
      const cached = await this.cacheManager.get(cacheKey);
      
      if (cached) {
        this.logger.log(`✅ Cache hit: ${cacheKey}`);
        return cached as any;
      }

      this.logger.log(`🔍 Récupération bestsellers pour marque: ${brandAlias}`);

      // 1️⃣ Récupérer l'ID de la marque depuis l'alias
      const { data: brand, error: brandError } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_name, marque_alias')
        .eq('marque_alias', brandAlias)
        .single();

      if (brandError || !brand) {
        this.logger.warn(`⚠️ Marque non trouvée: ${brandAlias}`);
        return {
          success: false,
          data: { vehicles: [], parts: [] },
          error: `Marque "${brandAlias}" non trouvée`,
        };
      }

      // 2️⃣ Appeler la fonction RPC optimisée
      const { data: bestsellers, error: rpcError } = await this.client.rpc(
        'get_brand_bestsellers_optimized',
        {
          p_marque_id: brand.marque_id,
          p_limit_vehicles: limitVehicles,
          p_limit_parts: limitParts,
        },
      );

      if (rpcError) {
        this.logger.error(
          `❌ Erreur RPC get_brand_bestsellers_optimized: ${rpcError.message}`,
        );
        return {
          success: false,
          data: { vehicles: [], parts: [] },
          error: rpcError.message,
        };
      }

      // 3️⃣ Transformer et enrichir les données
      const result = {
        success: true,
        data: {
          vehicles: bestsellers?.vehicles || [],
          parts: bestsellers?.parts || [],
        },
        meta: {
          brand_id: brand.marque_id,
          brand_name: brand.marque_name,
          brand_alias: brand.marque_alias,
          total_vehicles: bestsellers?.vehicles?.length || 0,
          total_parts: bestsellers?.parts?.length || 0,
          generated_at: new Date().toISOString(),
        },
      };

      // 4️⃣ Mettre en cache (TTL 1h)
      await this.cacheManager.set(cacheKey, result, 3600);
      this.logger.log(
        `✅ Bestsellers récupérés: ${result.meta.total_vehicles} véhicules, ${result.meta.total_parts} pièces`,
      );

      return result;
    } catch (error) {
      this.logger.error('❌ Erreur getBrandBestsellers:', error.message);
      return {
        success: false,
        data: { vehicles: [], parts: [] },
        error: error.message,
      };
    }
  }

  /**
   * Récupérer les constructeurs en vedette
   */
  async getFeaturedManufacturers(limit = 6) {
    try {
      const cacheKey = `manufacturers_featured_${limit}`;
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      // Prendre les constructeurs avec le plus de modèles comme "vedette"
      const { data: featured, error } = await this.client
        .from('auto_marque')
        .select(
          `
          marque_id,
          marque_name,
          marque_logo,
          marque_display
        `,
        )
        .gte('marque_display', 1)
        .in('marque_name', [
          'AUDI',
          'BMW',
          'MERCEDES',
          'VOLKSWAGEN',
          'PEUGEOT',
          'RENAULT',
          'TOYOTA',
          'FORD',
        ])
        .order('marque_name')
        .limit(limit);

      if (error) {
        throw new Error(`Erreur récupération vedettes: ${error.message}`);
      }

      const formattedData =
        featured?.map((m: any) => ({
          id: m.marque_id,
          name: m.marque_name,
          logo_url: m.marque_logo
            ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${m.marque_logo}`
            : null,
          slug: this.generateSlug(m.marque_name),
          is_active: m.marque_display >= 1,
          is_featured: true,
        })) || [];

      const result = {
        data: formattedData,
        message: `${formattedData.length} constructeurs en vedette`,
      };

      await this.cacheManager.set(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.error('Erreur getFeaturedManufacturers:', error);
      return {
        data: [],
        message: 'Erreur lors de la récupération des constructeurs vedettes',
      };
    }
  }

  /**
   * Récupérer les statistiques globales
   */
  async getStats() {
    try {
      const cacheKey = 'manufacturers_stats';
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const [manufacturersCount, modelsCount, typesCount] = await Promise.all([
        this.client
          .from('auto_marque')
          .select('marque_id', { count: 'exact', head: true })
          .gte('marque_display', 1),
        this.client
          .from('auto_modele')
          .select('modele_id', { count: 'exact', head: true })
          .gte('modele_display', 1),
        this.client
          .from('auto_type')
          .select('type_id', { count: 'exact', head: true }),
      ]);

      const stats = {
        manufacturers_count: manufacturersCount.count || 0,
        models_count: modelsCount.count || 0,
        types_count: typesCount.count || 0,
        last_updated: new Date().toISOString(),
      };

      await this.cacheManager.set(cacheKey, stats);
      return stats;
    } catch (error) {
      this.logger.error('Erreur getStats:', error);
      return {
        manufacturers_count: 0,
        models_count: 0,
        types_count: 0,
        last_updated: new Date().toISOString(),
      };
    }
  }

  /**
   * Générer un slug à partir d'un nom
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .replace(/[^a-z0-9]+/g, '-') // Remplace les caractères spéciaux par des tirets
      .replace(/^-|-$/g, ''); // Supprime les tirets en début et fin
  }

  /**
   * 1️⃣ MÉTHODE SIMPLE : Récupère les marques avec leurs logos
   * ✅ Sans FK - Fonctionne parfaitement
   */
  async getBrandsWithLogos(limit = 100) {
    try {
      const cacheKey = `brands_logos:${limit}`;

      // Vérifier le cache
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.logger.log(`✅ Cache hit pour ${cacheKey}`);
        return cached;
      }

      this.logger.log(`🔍 Récupération des ${limit} marques avec logos...`);

      const { data, error } = await this.client
        .from('auto_marque')
        .select(
          'marque_id, marque_name, marque_alias, marque_logo, marque_display',
        )
        .eq('marque_display', 1)
        .order('marque_name', { ascending: true })
        .limit(limit);

      if (error) {
        this.logger.error('❌ Erreur Supabase getBrandsWithLogos:', error);
        throw new Error(`Supabase error: ${error.message}`);
      }

      const formattedBrands = data.map((brand) => ({
        id: brand.marque_id,
        name: brand.marque_name,
        alias: brand.marque_alias,
        logo: brand.marque_logo
          ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${brand.marque_logo}`
          : null,
        slug: this.generateSlug(brand.marque_name),
      }));

      this.logger.log(`✅ ${formattedBrands.length} marques récupérées`);

      // Mise en cache
      await this.cacheManager.set(cacheKey, formattedBrands, 3600);

      return formattedBrands;
    } catch (error) {
      this.logger.error('❌ Erreur getBrandsWithLogos:', error.message);
      throw error;
    }
  }

  /**
   * 2️⃣ MÉTHODE MOYENNE : SEO dynamique avec requêtes séparées
   * ✅ Sans FK - Requêtes simples successives
   */
  async getDynamicSeoData(
    marqueId: number,
    modeleId?: number,
    typeId?: number,
  ) {
    try {
      this.logger.log(
        `🔍 Récupération SEO pour marque=${marqueId}, modele=${modeleId}, type=${typeId}`,
      );

      let title = '';
      let description = '';
      let h1 = '';

      // 1. Toujours récupérer la marque
      const { data: marque, error: marqueError } = await this.client
        .from('auto_marque')
        .select('marque_name, marque_alias')
        .eq('marque_id', marqueId)
        .single();

      if (marqueError || !marque) {
        throw new Error(`Marque ${marqueId} non trouvée`);
      }

      // 2. Si modeleId fourni, récupérer le modèle
      let modele = null;
      if (modeleId) {
        const { data: modeleData, error: modeleError } = await this.client
          .from('auto_modele')
          .select('modele_name, modele_alias')
          .eq('modele_id', modeleId)
          .single();

        if (!modeleError && modeleData) {
          modele = modeleData;
        }
      }

      // 3. Si typeId fourni, récupérer le type
      let type = null;
      if (typeId) {
        const { data: typeData, error: typeError } = await this.client
          .from('auto_type')
          .select('type_name, type_year_from, type_year_to')
          .eq('type_id', typeId)
          .single();

        if (!typeError && typeData) {
          type = typeData;
        }
      }

      // 4. Construire le SEO selon le niveau
      if (type && modele) {
        // Niveau TYPE
        const dateRange =
          type.type_year_from && type.type_year_to
            ? ` (${type.type_year_from}-${type.type_year_to})`
            : '';
        title = `${marque.marque_name} ${modele.modele_name} ${type.type_name}${dateRange} - Pièces Auto`;
        h1 = `Pièces détachées pour ${marque.marque_name} ${modele.modele_name} ${type.type_name}`;
        description = `Trouvez toutes les pièces détachées pour votre ${marque.marque_name} ${modele.modele_name} ${type.type_name}${dateRange}. Large catalogue, prix compétitifs.`;
      } else if (modele) {
        // Niveau MODÈLE
        title = `${marque.marque_name} ${modele.modele_name} - Pièces Auto`;
        h1 = `Pièces détachées ${marque.marque_name} ${modele.modele_name}`;
        description = `Découvrez notre gamme complète de pièces pour ${marque.marque_name} ${modele.modele_name}. Qualité garantie.`;
      } else {
        // Niveau MARQUE uniquement
        title = `Pièces Auto ${marque.marque_name} - Catalogue Complet`;
        h1 = `Pièces détachées ${marque.marque_name}`;
        description = `Large choix de pièces détachées pour véhicules ${marque.marque_name}. Livraison rapide, prix compétitifs.`;
      }

      this.logger.log(`✅ SEO généré pour ${marque.marque_name}`);

      return {
        title,
        description,
        h1,
        breadcrumb: {
          marque: {
            id: marqueId,
            name: marque.marque_name,
            alias: marque.marque_alias,
          },
          modele: modele
            ? {
                id: modeleId,
                name: modele.modele_name,
                alias: modele.modele_alias,
              }
            : null,
          type: type ? { id: typeId, name: type.type_name } : null,
        },
      };
    } catch (error) {
      this.logger.error('❌ Erreur getDynamicSeoData:', error.message);
      throw error;
    }
  }

  /**
   * 3️⃣ MÉTHODE COMPLEXE : Modèles populaires avec images
   * ✅ SANS FK - Utilise 4 requêtes séparées + jointure manuelle
   */
  async getPopularModelsWithImages(limit = 10) {
    try {
      const cacheKey = `popular_models:${limit}`;

      // Vérifier le cache
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.logger.log(`✅ Cache hit pour ${cacheKey}`);
        return cached;
      }

      this.logger.log(
        `🔍 Récupération des ${limit} modèles populaires (4 requêtes séparées)...`,
      );

      // 1️⃣ Récupérer les types (véhicules) les plus populaires
      // NOTE: tous les champs auto_type sont STRING dans Supabase
      const { data: types, error: typesError } = await this.client
        .from('auto_type')
        .select(
          'type_id, type_name, type_year_from, type_year_to, type_modele_id',
        )
        .eq('type_display', '1') // STRING pas NUMBER
        .order('type_id', { ascending: false })
        .limit(limit * 3); // x3 car beaucoup de modèles ont "no.webp"

      if (typesError || !types || types.length === 0) {
        this.logger.warn('⚠️ Aucun type trouvé');
        return [];
      }

      this.logger.log(`✅ ${types.length} types récupérés`);

      // 2️⃣ Récupérer les modèles correspondants (avec images valides)
      const modeleIds = [...new Set(types.map((t) => t.type_modele_id))];
      const { data: modeles, error: modelesError } = await this.client
        .from('auto_modele')
        .select(
          'modele_id, modele_name, modele_alias, modele_mdg_id, modele_pic',
        )
        .in('modele_id', modeleIds)
        .gte('modele_display', 1)
        .not('modele_pic', 'is', null)
        .not('modele_pic', 'eq', 'no.webp'); // Exclure les images placeholder

      if (modelesError || !modeles) {
        this.logger.error('❌ Erreur récupération modèles:', modelesError);
        return [];
      }

      this.logger.log(`✅ ${modeles.length} modèles récupérés`);

      // 3️⃣ Récupérer les groupes de modèles
      const mdgIds = [...new Set(modeles.map((m) => m.modele_mdg_id))];
      const { data: groups, error: groupsError } = await this.client
        .from('auto_modele_group')
        .select('mdg_id, mdg_name, mdg_marque_id')
        .in('mdg_id', mdgIds);

      if (groupsError || !groups) {
        this.logger.error('❌ Erreur récupération groupes:', groupsError);
        return [];
      }

      this.logger.log(`✅ ${groups.length} groupes récupérés`);

      // 4️⃣ Récupérer les marques
      const marqueIds = [...new Set(groups.map((g) => g.mdg_marque_id))];
      const { data: marques, error: marquesError } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_name, marque_alias')
        .in('marque_id', marqueIds);

      if (marquesError || !marques) {
        this.logger.error('❌ Erreur récupération marques:', marquesError);
        return [];
      }

      this.logger.log(`✅ ${marques.length} marques récupérées`);

      // 5️⃣ JOINTURE MANUELLE : Associer toutes les données
      const formattedModels = types
        .map((type) => {
          const modele = modeles.find(
            (m) => m.modele_id === parseInt(type.type_modele_id),
          );
          if (!modele) return null;

          const group = groups.find((g) => g.mdg_id === modele.modele_mdg_id);
          if (!group) return null;

          const marque = marques.find(
            (m) => m.marque_id === group.mdg_marque_id,
          );
          if (!marque) return null;

          // Construire l'URL de l'image depuis le modèle
          const imageName = modele.modele_pic
            .replace('.webp', '.jpg')
            .replace(/\\/g, '/');
          const imageUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-concepts/${marque.marque_alias}/${imageName}`;

          const dateRange =
            type.type_year_from && type.type_year_to
              ? `${type.type_year_from}-${type.type_year_to}`
              : '';

          return {
            id: parseInt(type.type_id),
            name: `${marque.marque_name} ${modele.modele_name} ${type.type_name}`,
            brandName: marque.marque_name,
            modelName: modele.modele_name,
            typeName: type.type_name,
            dateRange,
            imageUrl,
            slug: this.generateSlug(
              `${marque.marque_name}-${modele.modele_name}-${type.type_name}`,
            ),
          };
        })
        .filter(Boolean) // Supprimer les null
        .slice(0, limit); // Limiter au nombre demandé

      this.logger.log(
        `✅ ${formattedModels.length} modèles populaires formatés`,
      );

      // Mise en cache
      await this.cacheManager.set(cacheKey, formattedModels, 3600);

      return formattedModels;
    } catch (error) {
      this.logger.error('❌ Erreur getPopularModelsWithImages:', error.message);
      throw error;
    }
  }

  /**
   * 🆕 NOUVELLE MÉTHODE : Récupération d'une marque avec tous ses modèles par alias
   * ✅ Utilisée pour les pages détail constructeur (ex: /blog-pieces-auto/auto/audi)
   */

  /**
   * 4️⃣ NOUVELLE MÉTHODE : Récupération des métadonnées SEO depuis __blog_meta_tags_ariane
   * ✅ Utilise la table de métadonnées pour les pages blog
   */
  async getBrandWithModelsByAlias(alias: string) {
    try {
      this.logger.log(
        `🔍 Récupération marque et modèles pour alias="${alias}"`,
      );

      // 1. Récupérer la marque par alias
      const { data: brandData, error: brandError } = await this.client
        .from('auto_marque')
        .select(
          'marque_id, marque_name, marque_name_meta, marque_alias, marque_logo, marque_relfollow, marque_display',
        )
        .eq('marque_alias', alias)
        .eq('marque_display', 1)
        .single();

      if (brandError || !brandData) {
        this.logger.warn(`⚠️ Marque non trouvée pour alias="${alias}"`);
        return null;
      }

      this.logger.log(
        `✅ Marque trouvée: ${brandData.marque_name} (ID: ${brandData.marque_id})`,
      );

      // 2. Récupérer les modèles groupés (modele_parent = 0) avec TOUTES les infos
      const { data: modelsData, error: modelsError } = await this.client
        .from('auto_modele')
        .select('*') // Récupérer TOUTES les colonnes disponibles
        .eq('modele_marque_id', brandData.marque_id)
        .eq('modele_parent', 0)
        .eq('modele_display', 1)
        .order('modele_sort', { ascending: true })
        .order('modele_name', { ascending: true });

      if (modelsError) {
        this.logger.error(
          '❌ Erreur récupération modèles:',
          modelsError.message,
        );
        throw modelsError;
      }

      this.logger.log(`✅ ${modelsData?.length || 0} modèles récupérés`);

      // Log des colonnes disponibles pour debug (première fois seulement)
      if (modelsData && modelsData.length > 0) {
        this.logger.log(
          `📋 Colonnes disponibles: ${Object.keys(modelsData[0]).join(', ')}`,
        );
      }

      // 3. Récupérer le contenu SEO depuis __BLOG_SEO_MARQUE
      const { data: seoData } = await this.client
        .from('__blog_seo_marque')
        .select('bsm_title, bsm_descrip, bsm_keywords, bsm_h1, bsm_content')
        .eq('bsm_marque_id', brandData.marque_id)
        .single();

      // 4. Si pas de SEO blog, essayer __SEO_MARQUE
      let seoContent = null;
      if (!seoData) {
        const { data: fallbackSeoData } = await this.client
          .from('__seo_marque')
          .select('sm_content')
          .eq('sm_marque_id', brandData.marque_id)
          .single();

        seoContent = fallbackSeoData?.sm_content || null;
      }

      // 5. Construire les métadonnées
      const metadata = {
        title:
          seoData?.bsm_title ||
          `Pièces détachées ${brandData.marque_name_meta} à prix pas cher`,
        description:
          seoData?.bsm_descrip ||
          `Automecanik vous offre tous les conseilles d'achat de toutes les pièces et accessoires autos à prix pas cher du constructeur ${brandData.marque_name_meta}`,
        keywords: seoData?.bsm_keywords || brandData.marque_name,
        h1:
          seoData?.bsm_h1 ||
          `Choisissez votre véhicule ${brandData.marque_name}`,
        content:
          seoData?.bsm_content ||
          seoContent ||
          `Un vaste choix de pièces détachées <b>${brandData.marque_name}</b> au meilleur tarif et de qualité irréprochable proposées par les grandes marques d'équipementiers automobile de première monte d'origine.`,
        relfollow:
          brandData.marque_relfollow === 1
            ? 'index, follow'
            : 'noindex, nofollow',
      };

      // 6. Pour chaque modèle, compter ses motorisations (types) ET récupérer les carburants disponibles
      const modelIds = modelsData.map((m) => m.modele_id);
      const { data: typesCountData } = await this.client
        .from('auto_type')
        .select('type_modele_id, type_fuel')
        .in('type_modele_id', modelIds)
        .eq('type_display', '1');

      // Créer un map pour compter les motorisations ET les carburants par modèle
      const motorisationsCount: Record<string, number> = {};
      const fuelTypesByModel: Record<string, Set<string>> = {};

      if (typesCountData) {
        typesCountData.forEach((type: any) => {
          // Compter les motorisations
          motorisationsCount[type.type_modele_id] =
            (motorisationsCount[type.type_modele_id] || 0) + 1;

          // Collecter les types de carburant uniques
          if (!fuelTypesByModel[type.type_modele_id]) {
            fuelTypesByModel[type.type_modele_id] = new Set();
          }
          if (type.type_fuel) {
            fuelTypesByModel[type.type_modele_id].add(type.type_fuel);
          }
        });
      }

      // 7. Formater les modèles avec TOUTES les infos disponibles
      const models = (modelsData || []).map((model) => {
        // Construire l'URL de l'image
        let imageUrl = null;
        if (
          model.modele_pic &&
          model.modele_pic !== 'no.webp' &&
          model.modele_pic !== ''
        ) {
          imageUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/${brandData.marque_alias}/${model.modele_pic}`;
        } else {
          imageUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/no.png`;
        }

        // Formater la période
        let dateRange = '';
        if (!model.modele_year_to || model.modele_year_to === null) {
          dateRange = `du ${model.modele_month_from}/${model.modele_year_from}`;
        } else {
          dateRange = `de ${model.modele_year_from} à ${model.modele_year_to}`;
        }

        // Compter les motorisations pour ce modèle
        const motorisationsCountForModel =
          motorisationsCount[model.modele_id] || 0;

        // Récupérer les types de carburant disponibles (triés: Diesel avant Essence)
        const fuelTypes = fuelTypesByModel[model.modele_id]
          ? Array.from(fuelTypesByModel[model.modele_id]).sort((a, b) => {
              // Ordre: Diesel > Essence > Hybride > Électrique > Autres
              const order: Record<string, number> = {
                Diesel: 1,
                diesel: 1,
                Essence: 2,
                essence: 2,
                Hybride: 3,
                hybride: 3,
                Électrique: 4,
                électrique: 4,
                Electric: 4,
                electric: 4,
              };
              const orderA = order[a] || 99;
              const orderB = order[b] || 99;
              return orderA - orderB;
            })
          : [];

        return {
          id: model.modele_id,
          name: model.modele_name,
          alias: model.modele_alias,
          imageUrl,
          dateRange,
          yearFrom: model.modele_year_from,
          yearTo: model.modele_year_to,
          monthFrom: model.modele_month_from,
          monthTo: model.modele_month_to,
          // Nouvelles infos enrichies
          motorisationsCount: motorisationsCountForModel,
          modele_fuel_types: fuelTypes,
          parent: model.modele_parent,
          sort: model.modele_sort,
          display: model.modele_display,
          // Infos supplémentaires si disponibles dans la DB
          ...Object.keys(model).reduce(
            (acc: Record<string, any>, key) => {
              // Exclure les colonnes déjà mappées
              if (
                !key.startsWith('modele_') ||
                [
                  'modele_id',
                  'modele_name',
                  'modele_alias',
                  'modele_pic',
                  'modele_year_from',
                  'modele_year_to',
                  'modele_month_from',
                  'modele_month_to',
                  'modele_parent',
                  'modele_sort',
                  'modele_display',
                  'modele_marque_id',
                ].includes(key)
              ) {
                return acc;
              }
              // Ajouter les autres colonnes disponibles
              acc[key] = (model as any)[key];
              return acc;
            },
            {} as Record<string, any>,
          ),
        };
      });

      return {
        brand: {
          id: brandData.marque_id,
          name: brandData.marque_name,
          alias: brandData.marque_alias,
          logo: brandData.marque_logo
            ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${brandData.marque_logo}`
            : null,
        },
        models,
        metadata,
      };
    } catch (error) {
      this.logger.error('❌ Erreur getBrandWithModelsByAlias:', error.message);
      throw error;
    }
  }

  /**
   * Récupérer un modèle et ses motorisations (types) par alias de marque et modèle
   */
  async getModelWithTypesByAlias(brandAlias: string, modelAlias: string) {
    try {
      this.logger.log(
        `🔍 Récupération modèle et types pour brand="${brandAlias}", model="${modelAlias}"`,
      );

      // 1. Récupérer la marque par alias
      const { data: brandData, error: brandError } = await this.client
        .from('auto_marque')
        .select('marque_id, marque_name, marque_alias, marque_logo')
        .eq('marque_alias', brandAlias)
        .eq('marque_display', 1)
        .single();

      if (brandError || !brandData) {
        this.logger.warn(`⚠️ Marque non trouvée pour alias="${brandAlias}"`);
        throw new Error(`Marque ${brandAlias} non trouvée`);
      }

      // 2. Récupérer le modèle par alias
      const { data: modelData, error: modelError } = await this.client
        .from('auto_modele')
        .select(
          'modele_id, modele_name, modele_alias, modele_pic, modele_year_from, modele_year_to, modele_body',
        )
        .eq('modele_marque_id', brandData.marque_id)
        .eq('modele_alias', modelAlias)
        .eq('modele_display', 1)
        .single();

      if (modelError || !modelData) {
        this.logger.warn(
          `⚠️ Modèle non trouvé pour alias="${modelAlias}" de marque ${brandData.marque_name}`,
        );
        throw new Error(`Modèle ${modelAlias} non trouvé`);
      }

      this.logger.log(
        `✅ Modèle trouvé: ${modelData.modele_name} (ID: ${modelData.modele_id})`,
      );

      // 3. Récupérer les types (motorisations) de ce modèle
      const { data: typesData, error: typesError } = await this.client
        .from('auto_type')
        .select(
          `
          type_id,
          type_name,
          type_power_kw,
          type_power_ps,
          type_fuel,
          type_body,
          type_engine,
          type_tmf_id,
          type_month_from,
          type_year_from,
          type_month_to,
          type_year_to
        `,
        )
        .eq('type_modele_id', modelData.modele_id)
        .eq('type_display', '1')
        .order('type_name', { ascending: true });

      if (typesError) {
        this.logger.error('❌ Erreur récupération types:', typesError.message);
        throw typesError;
      }

      this.logger.log(`✅ ${typesData?.length || 0} motorisations récupérées`);

      // 3.5. DÉSACTIVÉ : Récupération des codes moteurs
      // La table cars_engine n'a pas de liaison directe avec auto_type.
      // type_tmf_id → eng_mfa_id donne le fabricant du moteur (Alfa, Audi, etc.),
      // pas le code moteur spécifique au véhicule.
      // TODO: Trouver la vraie table de liaison ou colonne pour les codes moteurs.
      const engineCodeMap: Record<string, string> = {};

      // 4. Construire l'URL de l'image du modèle
      let imageUrl = null;
      if (
        modelData.modele_pic &&
        modelData.modele_pic !== 'no.webp' &&
        modelData.modele_pic !== ''
      ) {
        imageUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-concepts/${brandData.marque_alias}/${modelData.modele_pic}`;
      } else {
        imageUrl = `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-concepts/no.png`;
      }

      // 5. Formater les types avec les codes moteurs
      const types = (typesData || []).map((type) => ({
        id: type.type_id,
        designation: type.type_name,
        kw: type.type_power_kw,
        ch: type.type_power_ps,
        carburant: type.type_fuel,
        carosserie: type.type_body,
        engineCode: engineCodeMap[type.type_tmf_id] || null,
        monthFrom: type.type_month_from,
        yearFrom: type.type_year_from,
        monthTo: type.type_month_to,
        yearTo: type.type_year_to,
      }));

      // 6. Retourner les données complètes
      return {
        brand: {
          id: brandData.marque_id,
          name: brandData.marque_name,
          alias: brandData.marque_alias,
          logo: brandData.marque_logo
            ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${brandData.marque_logo}`
            : null,
        },
        model: {
          id: modelData.modele_id,
          name: modelData.modele_name,
          alias: modelData.modele_alias,
          imageUrl,
          yearFrom: modelData.modele_year_from,
          yearTo: modelData.modele_year_to,
          body: modelData.modele_body || null,
        },
        types,
        metadata: null, // TODO: Ajouter les métadonnées SEO si nécessaire
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur inconnue';
      this.logger.error('❌ Erreur getModelWithTypesByAlias:', errorMessage);
      throw error;
    }
  }

  async getPageMetadata(alias: string) {
    try {
      this.logger.log(`🔍 Récupération métadonnées pour alias="${alias}"`);

      // Vérifier le cache d'abord
      const cacheKey = `meta:${alias}`;
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.logger.log('✅ Métadonnées récupérées depuis le cache');
        return cached;
      }

      // Requête Supabase
      const { data, error } = await this.client
        .from('__blog_meta_tags_ariane')
        .select('*')
        .eq('mta_alias', alias)
        .single();

      if (error) {
        this.logger.warn(
          `⚠️ Aucune métadonnée trouvée pour "${alias}":`,
          error.message,
        );

        // Retourner des métadonnées par défaut
        const defaultMeta = {
          title: 'Catalogue Technique Auto - Pièces détachées | Automecanik',
          description:
            'Découvrez notre catalogue complet de pièces détachées automobiles. Qualité OEM garantie pour toutes les marques.',
          keywords:
            'pièces auto, catalogue, constructeurs, pièces détachées, OEM',
          h1: 'Pièces Auto & Accessoires',
          ariane: 'Accueil > Blog > Pièces Auto',
          content: null,
          relfollow: 'index, follow',
        };

        return defaultMeta;
      }

      this.logger.log(`✅ Métadonnées récupérées pour "${alias}"`);

      // Formater les données
      const metadata = {
        title: data.mta_title || 'Automecanik',
        description: data.mta_descrip || '',
        keywords: data.mta_keywords || '',
        h1: data.mta_h1 || data.mta_title || '',
        ariane: data.mta_ariane || '',
        content: data.mta_content || null,
        relfollow:
          data.mta_relfollow === '1' || data.mta_relfollow === 'index, follow'
            ? 'index, follow'
            : 'noindex, nofollow',
      };

      // Mise en cache (1 heure)
      await this.cacheManager.set(cacheKey, metadata, 3600);

      return metadata;
    } catch (error) {
      this.logger.error('❌ Erreur getPageMetadata:', error.message);

      // Retourner des métadonnées par défaut en cas d'erreur
      return {
        title: 'Catalogue Technique Auto | Automecanik',
        description: 'Pièces détachées automobiles de qualité',
        keywords: 'pièces auto, catalogue',
        h1: 'Pièces Auto',
        ariane: 'Accueil',
        content: null,
        relfollow: 'index, follow',
      };
    }
  }
}
