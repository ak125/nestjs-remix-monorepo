import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface MetaTagsArianeData {
  mta_id: string;
  mta_title: string;
  mta_descrip: string;
  mta_keywords: string;
  mta_ariane: string;
  mta_h1: string;
  mta_content: string;
  mta_alias: string;
  mta_relfollow: string;
}

@Injectable()
export class MetaTagsArianeService extends SupabaseBaseService {
  protected readonly logger = new Logger(MetaTagsArianeService.name);

  constructor() {
    super();
  }

  /**
   * Récupère les meta tags ariane par alias
   */
  async getByAlias(alias: string): Promise<MetaTagsArianeData | null> {
    try {
      this.logger.log(`🔍 Recherche meta tags pour alias: ${alias}`);

      const { data, error } = await this.supabase
        .from(TABLES.meta_tags_ariane)
        .select('*')
        .eq('mta_alias', alias)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Pas de résultat trouvé
          this.logger.log(`ℹ️ Aucun meta tag trouvé pour alias: ${alias}`);
          return null;
        }
        throw error;
      }

      this.logger.log(`✅ Meta tags trouvés pour ${alias}`);
      return data as MetaTagsArianeData;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération meta tags pour ${alias}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Récupère les meta tags ariane par ID de type
   */
  async getByTypeId(typeId: number): Promise<MetaTagsArianeData | null> {
    try {
      this.logger.log(`🔍 Recherche meta tags pour type_id: ${typeId}`);

      // L'alias est généralement formaté comme "constructeur-marque-modele-type-{type_id}"
      // On va chercher tous les meta tags qui contiennent le type_id
      const { data, error } = await this.supabase
        .from(TABLES.meta_tags_ariane)
        .select('*')
        .ilike('mta_alias', `%-${typeId}`)
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          this.logger.log(`ℹ️ Aucun meta tag trouvé pour type_id: ${typeId}`);
          return null;
        }
        throw error;
      }

      this.logger.log(`✅ Meta tags trouvés pour type_id ${typeId}`);
      return data as MetaTagsArianeData;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération meta tags pour type_id ${typeId}:`,
        error,
      );
      return null;
    }
  }
}
