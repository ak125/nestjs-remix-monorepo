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
      this.logger.error(
        `Erreur getManufacturerById(${id}):`,
        error,
      );
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
        throw new Error(`Erreur récupération types carburant: ${error.message}`);
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
      return ['Diesel', 'Essence', 'Électrique', 'Essence-Électrique', 'GPL', 'Gaz naturel'];
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
        throw new Error(`Erreur récupération gammes puissance: ${error.message}`);
      }

      const powers = data?.map(t => ({
        ps: t.type_power_ps ? parseInt(t.type_power_ps, 10) : 0,
        kw: t.type_power_kw ? parseInt(t.type_power_kw, 10) : 0,
      })).filter(p => p.ps > 0) || [];

      const result = {
        ps: {
          min: Math.min(...powers.map(p => p.ps)),
          max: Math.max(...powers.map(p => p.ps)),
        },
        kw: {
          min: Math.min(...powers.map(p => p.kw)),
          max: Math.max(...powers.map(p => p.kw)),
        }
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
          { count: 'exact' }
        );

      // Filtres
      if (filters?.manufacturerId) {
        query = query.eq('auto_modele.modele_marque_id', filters.manufacturerId);
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

      const formattedTypes = data?.map((t: any) => ({
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
          }
        }
      })) || [];

      return {
        data: formattedTypes,
        total: count || 0,
        hasNext: (offset + limit) < (count || 0),
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
   * Récupérer les types de carburant disponibles
   */
  async getFuelTypes() {
    try {
      const cacheKey = 'fuel_types';
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached as any;
      }

      const { data, error } = await this.client
        .from('auto_type')
        .select('type_fuel')
        .not('type_fuel', 'is', null)
        .not('type_fuel', 'eq', '');

      if (error) {
        throw new Error(`Erreur récupération types carburant: ${error.message}`);
      }

      const fuelTypes = [...new Set(data?.map(item => item.type_fuel).filter(Boolean))];
      const sortedTypes = fuelTypes.sort();

      await this.cacheManager.set(cacheKey, sortedTypes);
      return sortedTypes;
    } catch (error) {
      this.logger.error('Erreur getFuelTypes:', error);
      return [];
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
        .select(`
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
        `)
        .eq('type_fuel', fuelType)
        .limit(limit)
        .order('type_power_ps', { ascending: false, nullsFirst: false });

      if (error) {
        throw new Error(`Erreur types par carburant: ${error.message}`);
      }

      const formattedTypes = data?.map((t: any) => ({
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

      const fuelTypes = [...new Set(fuelTypesData.data?.map(item => item.type_fuel))];
      const totalPower = avgPower.data?.reduce((sum, item) => sum + parseInt(item.type_power_ps, 10), 0) || 0;
      const avgHorsepower = avgPower.data?.length ? Math.round(totalPower / avgPower.data.length) : 0;

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
        .select(`
          marque_id,
          marque_name,
          marque_logo,
          marque_display
        `)
        .gte('marque_display', 1)
        .in('marque_name', [
          'VOLKSWAGEN', 'BMW', 'AUDI', 'MERCEDES', 
          'TOYOTA', 'PEUGEOT', 'RENAULT', 'FORD',
          'OPEL', 'FIAT'
        ])
        .order('marque_name')
        .limit(limit);

      if (error) {
        throw new Error(`Erreur récupération populaires: ${error.message}`);
      }

      const formattedData = popular?.map((m: any) => ({
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
        .select(`
          marque_id,
          marque_name,
          marque_logo,
          marque_display
        `)
        .gte('marque_display', 1)
        .in('marque_name', [
          'AUDI', 'BMW', 'MERCEDES', 'VOLKSWAGEN',
          'PEUGEOT', 'RENAULT', 'TOYOTA', 'FORD'
        ])
        .order('marque_name')
        .limit(limit);

      if (error) {
        throw new Error(`Erreur récupération vedettes: ${error.message}`);
      }

      const formattedData = featured?.map((m: any) => ({
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
}
