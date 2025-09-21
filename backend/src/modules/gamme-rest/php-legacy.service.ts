import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

interface PhpLegacyResponse {
  status: number;
  redirect?: string;
  data?: {
    // Données principales de la gamme
    pg_id: string;
    pg_name_site: string;
    pg_name_meta: string;
    pg_alias: string;
    pg_relfollow: string;
    pg_img: string;
    pg_wall: string;
    pg_pic: string;
    
    // Données famille
    mf_id: string;
    mf_name_site: string;
    mf_name_meta: string;
    
    // Contenu de la page
    page_title: string;
    page_description: string;
    breadcrumb: Array<{name: string, url?: string}>;
    
    // Articles de conseil
    conseil_article?: {
      title: string;
      date: string;
      content: string;
    };
    
    // Catalogue des filtres
    catalog_sections: Array<{
      name: string;
      description: string;
      url: string;
      image?: string;
    }>;
    
    // Motorisations populaires
    popular_vehicles: Array<{
      brand: string;
      model: string;
      engine: string;
      power: string;
      description: string;
      url: string;
    }>;
    
    // Équipementiers
    brands: Array<{
      name: string;
      description: string;
      logo?: string;
    }>;
    
    // Informations techniques
    technical_info: Array<string>;
    
    isMacVersion?: boolean;
  };
  error?: string;
}

@Injectable()
export class PhpLegacyService extends SupabaseBaseService {
  constructor() {
    super();
  }

  async processGammeRequest(pg_id: string, userAgent?: string): Promise<PhpLegacyResponse> {
    try {
      // REDIRECTION - Exact PHP logic
      if (pg_id === '3940') {
        return {
          status: 301,
          redirect: '/pieces/corps-papillon-158.html'
        };
      }

      // QUERY SELECTOR - Exact PHP query
      const { data: selectorResult, error: selectorError } = await this.client
        .from('pieces_gamme')
        .select('pg_display')
        .eq('pg_id', pg_id)
        .in('pg_level', ['1', '2'])
        .single();

      if (selectorError || !selectorResult || selectorResult.pg_display !== '1') {
        return {
          status: 404,
          error: 'Gamme non trouvée ou non affichable'
        };
      }

      // QUERY PAGE - Exact PHP JOIN query
      const { data: pageResult, error: pageError } = await this.client
        .from('pieces_gamme')
        .select(`
          pg_alias,
          pg_name,
          pg_name_meta,
          pg_relfollow,
          pg_img,
          pg_wall,
          catalog_gamme!inner(
            catalog_family!inner(
              mf_id,
              mf_name,
              mf_name_meta,
              mf_display
            )
          )
        `)
        .eq('pg_id', pg_id)
        .eq('pg_display', '1')
        .in('pg_level', ['1', '2'])
        .eq('catalog_gamme.catalog_family.mf_display', '1')
        .single();

      if (pageError || !pageResult) {
        return {
          status: 500,
          error: 'Erreur lors de la récupération des données'
        };
      }

      // Extract family data
      const family = pageResult.catalog_gamme?.[0]?.catalog_family?.[0];

      // Detect Mac version from User-Agent
      const isMacVersion = userAgent?.includes('Macintosh') || userAgent?.includes('Mac OS') || false;

      // WALL - Exact PHP image logic
      let pg_pic: string;
      if (!isMacVersion) {
        pg_pic = pageResult.pg_img;
      } else {
        pg_pic = pageResult.pg_img?.replace('.webp', '.jpg') || pageResult.pg_img;
      }

      return {
        status: 200,
        data: {
          pg_id,
          pg_name_site: pageResult.pg_name,
          pg_name_meta: pageResult.pg_name_meta,
          pg_alias: pageResult.pg_alias,
          pg_relfollow: pageResult.pg_relfollow,
          pg_img: pageResult.pg_img,
          pg_wall: pageResult.pg_wall,
          pg_pic,
          mf_id: family?.mf_id,
          mf_name_site: family?.mf_name,
          mf_name_meta: family?.mf_name_meta,
          isMacVersion
        }
      };

    } catch (error) {
      console.error('PhpLegacyService Error:', error);
      return {
        status: 500,
        error: 'Erreur système'
      };
    }
  }
}