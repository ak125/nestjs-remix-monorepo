// 📁 backend/src/modules/catalog/services/catalog-family.service.ts
// 🏭 Service pour gérer les familles de catalogue

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { CatalogFamily, CatalogFamilyWithGammes } from '../interfaces/catalog-family.interface';

@Injectable()
export class CatalogFamilyService extends SupabaseBaseService {

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * 👨‍👩‍👧‍👦 Récupère toutes les familles du catalogue
   */
  async getAllFamilies(): Promise<CatalogFamily[]> {
    try {
      this.logger.log('👨‍👩‍👧‍👦 Récupération des familles de catalogue...');

      const { data: families, error } = await this.supabase
        .from('catalog_family')
        .select('*')
        .eq('mf_display', '1')
        .order('mf_sort', { ascending: true });

      if (error) {
        this.logger.error('❌ Erreur récupération familles:', error);
        throw new BadRequestException(
          'Erreur lors de la récupération des familles',
        );
      }

      this.logger.log(`✅ ${families?.length || 0} familles trouvées`);
      return families || [];

    } catch (error) {
      this.logger.error('❌ Erreur familles catalogue:', error);
      throw new BadRequestException('Erreur lors de la récupération des familles');
    }
  }

  /**
   * 🏠 Récupère les familles pour la page d'accueil (réplique exacte de la logique PHP)
   * Équivalent de la requête PHP lignes 155-172
   */
  async getHomepageFamilies(): Promise<CatalogFamily[]> {
    try {
      this.logger.log('🏠 Récupération familles homepage (logique PHP)...');

      // Requête SQL équivalente au PHP :
      // SELECT DISTINCT MF_ID, IF(MF_NAME_SYSTEM IS NULL, MF_NAME, MF_NAME_SYSTEM) AS MF_NAME, 
      //   MF_DESCRIPTION, MF_PIC 
      //   FROM PIECES_GAMME 
      //   JOIN CATALOG_GAMME ON MC_PG_ID = PG_ID
      //   JOIN CATALOG_FAMILY ON MF_ID = MC_MF_ID
      //   WHERE PG_DISPLAY = 1 AND PG_LEVEL = 1 AND MF_DISPLAY = 1
      //   ORDER BY MF_SORT

      const { data: families, error } = await this.supabase
        .from('pieces_gamme')
        .select(`
          catalog_gamme!inner(
            catalog_family!inner(
              mf_id,
              mf_name,
              mf_name_system,
              mf_description,
              mf_pic,
              mf_display,
              mf_sort
            )
          )
        `)
        .eq('pg_display', 1)
        .eq('pg_level', 1)
        .eq('catalog_gamme.catalog_family.mf_display', 1)
        .order('catalog_gamme.catalog_family.mf_sort', { ascending: true });

      if (error) {
        this.logger.error('❌ Erreur récupération familles homepage:', error);
        throw new BadRequestException('Erreur lors de la récupération des familles homepage');
      }

      // Extraire les familles uniques et appliquer la logique IF du PHP
      const uniqueFamilies = new Map();
      
      families?.forEach((item: any) => {
        const family = item.catalog_gamme?.catalog_family;
        if (family && !uniqueFamilies.has(family.mf_id)) {
          // Logique PHP : IF(MF_NAME_SYSTEM IS NULL, MF_NAME, MF_NAME_SYSTEM)
          const displayName = family.mf_name_system || family.mf_name;
          
          uniqueFamilies.set(family.mf_id, {
            ...family,
            mf_name: displayName  // Utiliser le nom système en priorité
          });
        }
      });

      const result = Array.from(uniqueFamilies.values());
      this.logger.log(`✅ ${result.length} familles homepage trouvées`);
      return result;

    } catch (error) {
      this.logger.error('❌ Erreur familles homepage:', error);
      throw new BadRequestException('Erreur lors de la récupération des familles homepage');
    }
  }

  /**
   * 👨‍👩‍👧‍👦 Récupère les familles avec leurs gammes associées
   */
  async getFamiliesWithGammes(): Promise<{ [familyId: string]: any[] }> {
    try {
      this.logger.log('👨‍👩‍👧‍👦 Récupération familles avec gammes...');

      // 1. Récupérer toutes les familles
      const families = await this.getAllFamilies();

      // 2. Récupérer toutes les gammes
      const { data: allGammes, error: gammesError } = await this.supabase
        .from('pieces_gamme')
        .select(`
          pg_id,
          pg_alias,
          pg_name,
          pg_name_url,
          pg_pic,
          pg_img,
          pg_display,
          pg_top,
          pg_parent,
          pg_level,
          pg_sitemap
        `)
        .eq('pg_display', 1)
        .order('pg_name', { ascending: true });

      if (gammesError) {
        this.logger.error('❌ Erreur récupération gammes:', gammesError);
        throw new BadRequestException('Erreur lors de la récupération des gammes');
      }

      // 3. Organiser les familles par ID avec leurs gammes
      const familiesMap: { [familyId: string]: any[] } = {};

      // Initialiser toutes les familles
      for (const family of families) {
        familiesMap[family.mf_id] = [];
      }

      // Assigner les gammes aux familles en fonction de pg_parent
      for (const gamme of allGammes || []) {
        // Chercher la famille correspondante par nom ou ID
        const family = families.find(f => 
          f.mf_id === gamme.pg_parent || 
          f.mf_name === gamme.pg_parent ||
          f.mf_name_system === gamme.pg_parent
        );

        if (family) {
          familiesMap[family.mf_id].push({
            ...gamme,
            is_featured: gamme.pg_top === 1,
            is_displayed: gamme.pg_display === 1,
          });
        }
      }

      // Nettoyer les familles vides
      const cleanedFamiliesMap: { [familyId: string]: any[] } = {};
      for (const [familyId, gammes] of Object.entries(familiesMap)) {
        if (gammes.length > 0) {
          cleanedFamiliesMap[familyId] = gammes;
        }
      }

      this.logger.log(
        `✅ ${Object.keys(cleanedFamiliesMap).length} familles avec gammes trouvées`,
      );
      return cleanedFamiliesMap;

    } catch (error) {
      this.logger.error('❌ Erreur familles avec gammes:', error);
      throw new BadRequestException('Erreur lors de la récupération des familles avec gammes');
    }
  }

  /**
   * �‍👩‍👧‍👦 Récupère toutes les familles formatées comme des gammes pour la homepage
   */
  async getAllFamiliesAsGammes(): Promise<{ [familyId: string]: any[] }> {
    try {
      this.logger.log('👨‍👩‍👧‍👦 Récupération de toutes les familles comme gammes...');

      const families = await this.getAllFamilies();
      const familiesMap: { [familyId: string]: any[] } = {};

      // Convertir chaque famille en format gamme
      for (const family of families) {
        familiesMap[family.mf_id] = [
          {
            pg_id: family.mf_id,
            pg_alias: family.mf_name_meta || family.mf_name,
            pg_name: family.mf_name,
            pg_name_url:
              family.mf_name_system ||
              family.mf_name.toLowerCase().replace(/\s+/g, '-'),
            pg_pic: family.mf_pic,
            pg_img: family.mf_pic,
            pg_display: family.mf_display,
            pg_top: 1, // Toutes les familles sont mises en avant
            pg_parent: null,
            pg_level: 0,
            pg_sitemap: 1,
            is_featured: true,
            is_displayed: family.mf_display === '1',
            mf_description: family.mf_description, // Ajouter la description de la famille
          },
        ];
      }

      this.logger.log(`✅ ${Object.keys(familiesMap).length} familles converties en gammes`);
      return familiesMap;

    } catch (error) {
      this.logger.error('❌ Erreur conversion familles en gammes:', error);
      throw new BadRequestException('Erreur lors de la conversion des familles en gammes');
    }
  }

  /**
   * �🔍 Récupère une famille par son ID
   */
  async getFamilyById(familyId: string): Promise<CatalogFamily | null> {
    try {
      const { data: family, error } = await this.supabase
        .from('catalog_family')
        .select('*')
        .eq('mf_id', familyId)
        .eq('mf_display', '1')
        .single();

      if (error) {
        this.logger.warn(`⚠️ Famille ${familyId} non trouvée:`, error);
        return null;
      }

      return family;

    } catch (error) {
      this.logger.error(`❌ Erreur récupération famille ${familyId}:`, error);
      return null;
    }
  }
}