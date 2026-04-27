import { TABLES } from '@repo/database-types';
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

/**
 * PopularGammesService
 *
 * Service dédié pour le maillage interne SEO.
 * Fournit les gammes populaires pour les liens internes sur les pages véhicules.
 *
 * @purpose Découplage Catalog↔Vehicles - Ce service est la seule dépendance
 *          que VehiclesModule a sur CatalogModule pour le maillage SEO.
 *
 * @see VehiclesController.getBrandMaillageData()
 */
@Injectable()
export class PopularGammesService extends SupabaseBaseService {
  protected readonly logger = new Logger(PopularGammesService.name);

  /**
   * Récupère les gammes populaires pour le maillage interne SEO
   *
   * @param limit - Nombre de gammes à retourner (défaut: 8)
   * @returns Liste des gammes avec URLs et ancres SEO variées
   */
  async getPopularGammesForMaillage(limit: number = 8): Promise<{
    data: Array<{
      pg_id: string;
      pg_name: string;
      pg_alias: string;
      pg_img: string | null;
      link: string;
      anchor: string;
    }>;
    success: boolean;
  }> {
    try {
      this.logger.log(`🔗 Récupération ${limit} gammes pour maillage SEO...`);

      // Récupérer les gammes TOP avec images
      const { data: topGammes, error } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name, pg_alias, pg_img')
        .eq('pg_top', '1')
        .eq('pg_display', '1')
        .order('pg_id', { ascending: true })
        .limit(limit);

      if (error) {
        this.logger.error('❌ Erreur récupération gammes maillage:', error);
        return { data: [], success: false };
      }

      // Variations d'ancres SEO pour diversifier le maillage
      const anchorVariations = [
        (name: string) => `${name} au meilleur prix`,
        (name: string) => `Acheter ${name.toLowerCase()}`,
        (name: string) => `${name} pas cher`,
        (name: string) => `Voir ${name.toLowerCase()}`,
        (name: string) => `Catalogue ${name.toLowerCase()}`,
        (name: string) => `${name} de qualité`,
        (name: string) => `${name} d'origine`,
        (name: string) => `Découvrir ${name.toLowerCase()}`,
      ];

      const formattedGammes = (topGammes || []).map((gamme, index) => ({
        pg_id: gamme.pg_id,
        pg_name: gamme.pg_name,
        pg_alias: gamme.pg_alias,
        pg_img: gamme.pg_img,
        link: `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`,
        anchor: anchorVariations[index % anchorVariations.length](
          gamme.pg_name,
        ),
      }));

      this.logger.log(
        `✅ ${formattedGammes.length} gammes pour maillage récupérées`,
      );

      return {
        data: formattedGammes,
        success: true,
      };
    } catch (error) {
      this.logger.error('❌ Erreur gammes maillage:', error);
      return { data: [], success: false };
    }
  }
}
