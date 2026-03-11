import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseIndexationService } from '../../search/services/supabase-indexation.service';
import { BlogArticleTransformService } from './blog-article-transform.service';
import { normalizeTypeAlias } from '../../../common/utils/url-builder.utils';

/**
 * 🔗 BlogArticleRelationService - Relations et véhicules compatibles
 *
 * Responsabilité unique : Gestion des relations entre articles et véhicules
 * - Véhicules compatibles avec une gamme de pièce
 * - Debug des sections H2/H3
 * - Recherche d'articles avec H3
 *
 * Note: getCompatibleVehicles() est complexe (fait 5+ requêtes DB)
 * Candidat futur pour extraction vers CatalogService
 *
 * Extrait de BlogService pour réduire la complexité (SRP)
 */
@Injectable()
export class BlogArticleRelationService {
  private readonly logger = new Logger(BlogArticleRelationService.name);

  constructor(
    private readonly supabaseService: SupabaseIndexationService,
    private readonly transformService: BlogArticleTransformService,
  ) {}

  /**
   * 🚗 Charger les véhicules compatibles avec une gamme de pièce
   * Version simplifiée : requête directe sans multiples étapes
   * @param pg_id - ID de la pièce générique
   * @param limit - Nombre max de véhicules (défaut: 1000 = quasi illimité)
   * @param pg_alias - Alias de la gamme pour construire l'URL
   */
  async getCompatibleVehicles(
    pg_id: number,
    limit = 1000,
    pg_alias = '',
  ): Promise<any[]> {
    try {
      this.logger.log(
        `🚗 Chargement véhicules compatibles pour PG_ID: ${pg_id}`,
      );

      // Étape 1 : Récupérer les TYPE_ID compatibles depuis __cross_gamme_car_new
      // Niveau 1 = Véhicules les plus populaires
      let crossData = null;
      let crossError = null;

      for (const level of [1, 2, 3, 4]) {
        const result = await this.supabaseService.client
          .from('__cross_gamme_car_new')
          .select('cgc_type_id, cgc_level')
          .eq('cgc_pg_id', pg_id)
          .eq('cgc_level', level)
          .order('cgc_id', { ascending: true })
          .limit(limit);

        if (result.data && result.data.length > 0) {
          crossData = result.data;
          crossError = result.error;
          this.logger.log(
            `   ℹ️  Utilisation niveau ${level} (${result.data.length} véhicules trouvés)`,
          );
          break;
        }
      }

      if (crossError) {
        this.logger.error(`   ❌ Erreur Supabase cross_gamme_car:`, crossError);
        return [];
      }

      if (!crossData || crossData.length === 0) {
        this.logger.log(
          `   ℹ️  Aucun véhicule compatible trouvé pour PG_ID: ${pg_id}`,
        );
        return [];
      }

      // ⚠️ IMPORTANT: cgc_type_id est TEXT, mais type_id est INTEGER
      const typeIds = crossData
        .map((item) => parseInt(item.cgc_type_id, 10))
        .filter((id) => !isNaN(id));
      this.logger.log(
        `   📋 ${typeIds.length} TYPE_ID trouvés: ${typeIds.slice(0, 5).join(', ')}...`,
      );

      // Étape 2 : Charger les données des véhicules (AUTO_TYPE)
      const { data: typesData, error: typesError } =
        await this.supabaseService.client
          .from(TABLES.auto_type)
          .select('*')
          .in('type_id', typeIds)
          .eq('type_display', 1)
          .limit(limit);

      if (typesError) {
        this.logger.error(`   ❌ Erreur auto_type:`, typesError);
        return [];
      }

      if (!typesData || typesData.length === 0) {
        this.logger.warn(
          `   ⚠️  Aucun type trouvé dans auto_type pour ${typeIds.length} IDs`,
        );
        return [];
      }

      this.logger.log(
        `   ✅ ${typesData.length} types chargés depuis auto_type`,
      );

      // Étape 3 : Charger les modèles (AUTO_MODELE)
      const modeleIds = [
        ...new Set(typesData.map((t) => t.type_modele_id).filter((id) => id)),
      ];
      this.logger.log(
        `   📋 ${modeleIds.length} MODELE_ID uniques: ${modeleIds.slice(0, 5).join(', ')}...`,
      );

      const { data: modelesData, error: modelesError } =
        await this.supabaseService.client
          .from(TABLES.auto_modele)
          .select('*')
          .in('modele_id', modeleIds)
          .eq('modele_display', 1);

      if (modelesError) {
        this.logger.error(`   ❌ Erreur auto_modele:`, modelesError);
        return [];
      }

      this.logger.log(
        `   ✅ ${modelesData?.length || 0} modèles chargés depuis auto_modele`,
      );

      if (!modelesData || modelesData.length === 0) {
        this.logger.warn(`   ⚠️  Aucun modèle trouvé - arrêt assemblage`);
        return [];
      }

      // Étape 4 : Charger les marques (AUTO_MARQUE)
      const marqueIds = [
        ...new Set(
          modelesData.map((m) => m.modele_marque_id).filter((id) => id),
        ),
      ];
      this.logger.log(
        `   📋 ${marqueIds.length} MARQUE_ID uniques: ${marqueIds.slice(0, 5).join(', ')}...`,
      );

      const { data: marquesData, error: marquesError } =
        await this.supabaseService.client
          .from(TABLES.auto_marque)
          .select('*')
          .in('marque_id', marqueIds)
          .eq('marque_display', 1);

      if (marquesError) {
        this.logger.error(`   ❌ Erreur auto_marque:`, marquesError);
        return [];
      }

      this.logger.log(
        `   ✅ ${marquesData?.length || 0} marques chargées depuis auto_marque`,
      );

      if (!marquesData || marquesData.length === 0) {
        this.logger.warn(`   ⚠️  Aucune marque trouvée - arrêt assemblage`);
        return [];
      }

      // Créer des maps pour accès rapide
      const modelesMap = new Map(modelesData?.map((m) => [m.modele_id, m]));
      const marquesMap = new Map(marquesData?.map((m) => [m.marque_id, m]));

      this.logger.log(
        `   🗺️  Maps créées: ${modelesMap.size} modèles, ${marquesMap.size} marques`,
      );

      // Étape 5 : Assembler les données
      let skipped = 0;
      const vehicles = typesData
        .map((type) => {
          // ⚠️ IMPORTANT: Convertir type_modele_id (string) en number pour lookup
          const modeleId =
            typeof type.type_modele_id === 'string'
              ? parseInt(type.type_modele_id, 10)
              : type.type_modele_id;

          const modele = modelesMap.get(modeleId);
          const marque = modele
            ? marquesMap.get(modele.modele_marque_id)
            : null;

          if (!modele || !marque) {
            skipped++;
            if (skipped <= 3) {
              this.logger.warn(
                `   ⚠️  Type ${type.type_id} skipped: modele=${!!modele}, marque=${!!marque}, modeleId=${modeleId}`,
              );
            }
            return null;
          }

          // Période de production
          let period = '';
          if (type.type_year_to) {
            period = `${type.type_month_from}/${type.type_year_from} - ${type.type_month_to}/${type.type_year_to}`;
          } else {
            period = `depuis ${type.type_month_from}/${type.type_year_from}`;
          }

          return {
            type_id: type.type_id,
            type_alias: type.type_alias,
            type_name: type.type_name,
            type_power: type.type_power_ps,
            type_fuel: type.type_fuel,
            type_body: type.type_body,
            period,
            modele_id: modele.modele_id,
            modele_alias: modele.modele_alias,
            modele_name: modele.modele_name,
            // 🖼️ URL CDN complète pour l'image du modèle
            modele_pic: this.transformService.buildImageUrl(
              modele.modele_pic,
              'unused',
              marque.marque_alias,
            ),
            marque_id: marque.marque_id,
            marque_alias: marque.marque_alias,
            marque_name: marque.marque_name,
            // 🖼️ URL CDN complète pour le logo de la marque
            marque_logo: this.transformService.buildImageUrl(
              marque.marque_logo,
              'constructeurs-automobiles/marques-logos',
            ),
            // URL vers la gamme du véhicule
            catalog_url: pg_alias
              ? `/pieces/${pg_alias}-${pg_id}/${marque.marque_alias}-${marque.marque_id}/${modele.modele_alias}-${modele.modele_id}/${normalizeTypeAlias(type.type_alias, type.type_name)}-${type.type_id}.html`
              : `/constructeurs/${marque.marque_alias}-${marque.marque_id}/${modele.modele_alias}-${modele.modele_id}/${normalizeTypeAlias(type.type_alias, type.type_name)}-${type.type_id}.html`,
          };
        })
        .filter((v) => v !== null);

      this.logger.log(
        `   ✅ ${vehicles.length} véhicules compatibles assemblés`,
      );
      return vehicles;
    } catch (error) {
      this.logger.error(
        `❌ Erreur véhicules compatibles PG_ID ${pg_id}:`,
        error,
      );
      return [];
    }
  }

  /**
   * 🔍 DEBUG - Vérifier les sections h2/h3 d'un article
   */
  async debugArticleSections(ba_id: number) {
    try {
      this.logger.log(`🔍 Debug sections pour ba_id=${ba_id}`);

      // Charger les H2
      const { data: h2Data } = await this.supabaseService.client
        .from(TABLES.blog_advice_h2)
        .select('*')
        .eq('ba2_ba_id', ba_id)
        .order('ba2_id');

      // Récupérer les IDs des H2
      const h2Ids = h2Data?.map((h2) => h2.ba2_id) || [];

      // Charger les H3 qui appartiennent à ces H2
      let h3Data: any[] = [];
      if (h2Ids.length > 0) {
        const { data } = await this.supabaseService.client
          .from(TABLES.blog_advice_h3)
          .select('*')
          .in('ba3_ba2_id', h2Ids)
          .order('ba3_id');
        h3Data = data || [];
      }

      return {
        ba_id,
        h2_count: h2Data?.length || 0,
        h3_count: h3Data.length,
        h2_sections: h2Data?.map((h2) => ({
          id: h2.ba2_id,
          title: h2.ba2_h2,
        })),
        h3_sections: h3Data.map((h3) => ({
          id: h3.ba3_id,
          ba2_id: h3.ba3_ba2_id,
          title: h3.ba3_h3,
        })),
      };
    } catch (error) {
      this.logger.error(`❌ Erreur debug: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 🔍 DEBUG - Trouver les articles qui ont des H3
   */
  async findArticlesWithH3() {
    try {
      this.logger.log(`🔍 Recherche des articles avec H3`);

      // Récupérer quelques H3
      const { data: h3Samples } = await this.supabaseService.client
        .from(TABLES.blog_advice_h3)
        .select('ba3_ba2_id, ba3_h3')
        .limit(10);

      if (!h3Samples || h3Samples.length === 0) {
        return {
          message: 'Aucun H3 trouvé dans la base',
          count: 0,
        };
      }

      // Récupérer les ba2_id uniques
      const ba2Ids = [...new Set(h3Samples.map((h3) => h3.ba3_ba2_id))];

      // Récupérer les H2 correspondants pour avoir les ba_id
      const { data: h2Data } = await this.supabaseService.client
        .from(TABLES.blog_advice_h2)
        .select('ba2_id, ba2_ba_id, ba2_h2')
        .in('ba2_id', ba2Ids);

      return {
        message: `${h3Samples.length} H3 trouvés`,
        h3_samples: h3Samples,
        h2_parents: h2Data,
        articles_with_h3: [...new Set(h2Data?.map((h2) => h2.ba2_ba_id) || [])],
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur findArticlesWithH3: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
