import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

export interface CategoryBlogArticle {
  id: number;
  title: string;
  alias: string;
  preview: string;
  image: string;
  publishedDate: string;
  content?: string;
}

export interface RelatedCategory {
  id: number;
  name: string;
  alias: string;
  image: string;
  seoTitle: string;
  seoDescription: string;
}

export interface PopularMotorization {
  typeId: number;
  brand: string;
  brandAlias: string;
  model: string;
  modelAlias: string;
  modelImage: string;
  engine: string;
  engineAlias: string;
  powerHp: number;
  yearFrom: number;
  yearTo?: number;
  monthFrom?: number;
  seoContent?: string;
  categoryId: number;
  categoryAlias: string;
}

export interface Equipmentier {
  id: number;
  name: string;
  logo: string;
  content: string;
  sort: number;
}

export interface TechnicalInfo {
  id: number;
  content: string;
  order: number;
}

export interface CategoryFullContent {
  blogArticle?: CategoryBlogArticle | null;
  relatedCategories: RelatedCategory[];
  popularMotorizations: PopularMotorization[];
  equipmentiers: Equipmentier[];
  technicalInfo: TechnicalInfo[];
}

@Injectable()
export class CategoryContentService extends SupabaseBaseService {
  
  /**
   * Récupère l'article de blog principal pour une catégorie
   */
  async getCategoryBlogArticle(categoryId: number): Promise<CategoryBlogArticle | null> {
    try {
      const { data, error } = await this.supabase
        .from('blog_advice')
        .select(`
          ba_id,
          ba_h1,
          ba_alias,
          ba_preview,
          ba_wall,
          ba_update,
          pieces_gamme!inner(
            pg_name,
            pg_alias,
            pg_img
          )
        `)
        .eq('ba_pg_id', categoryId)
        .order('ba_update', { ascending: false })
        .order('ba_create', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.log(`Aucun article de blog trouvé pour la catégorie ${categoryId}`);
        return null;
      }

      // Déterminer l'image à utiliser
      let imageUrl = '';
      if (data.ba_wall && data.ba_wall !== 'no.jpg') {
        imageUrl = `https://ujttmmlwbdsngkhncfci.supabase.co/storage/v1/object/public/blog/conseils/mini/${data.ba_wall}`;
      } else if (data.pieces_gamme?.pg_img) {
        imageUrl = `https://ujttmmlwbdsngkhncfci.supabase.co/storage/v1/object/public/categories/${data.pieces_gamme.pg_img}`;
      }

      return {
        id: data.ba_id,
        title: data.ba_h1,
        alias: data.ba_alias,
        preview: data.ba_preview,
        image: imageUrl,
        publishedDate: data.ba_update,
      };
    } catch (error) {
      console.error('Erreur récupération article blog:', error);
      return null;
    }
  }

  /**
   * Récupère les catégories de la même famille
   */
  async getRelatedCategories(categoryId: number, familyId: number): Promise<RelatedCategory[]> {
    try {
      const { data, error } = await this.supabase
        .from('catalog_gamme')
        .select(`
          pieces_gamme!inner(
            pg_id,
            pg_name,
            pg_alias,
            pg_img,
            pg_name_meta,
            pg_display,
            pg_level,
            seo_gamme(
              sg_title,
              sg_descrip
            )
          )
        `)
        .eq('mc_mf_id', familyId)
        .neq('mc_pg_id', categoryId)
        .eq('pieces_gamme.pg_display', 1)
        .in('pieces_gamme.pg_level', [1, 2])
        .order('mc_sort');

      if (error) {
        console.error('Erreur récupération catégories liées:', error);
        return [];
      }

      return (data || []).map((item: any) => {
        const category = item.pieces_gamme;
        const seoData = category.seo_gamme?.[0];
        
        return {
          id: category.pg_id,
          name: category.pg_name,
          alias: category.pg_alias,
          image: category.pg_img 
            ? `https://ujttmmlwbdsngkhncfci.supabase.co/storage/v1/object/public/categories/${category.pg_img}`
            : 'https://ujttmmlwbdsngkhncfci.supabase.co/storage/v1/object/public/categories/no.png',
          seoTitle: seoData?.sg_title || 
                    `${category.pg_name_meta} neuf & à prix bas`,
          seoDescription: seoData?.sg_descrip || 
                          `Votre ${category.pg_name_meta} au meilleur tarif, de qualité & à prix pas cher pour toutes marques et modèles de voitures.`,
        };
      });
    } catch (error) {
      console.error('Erreur récupération catégories liées:', error);
      return [];
    }
  }

  /**
   * Récupère les motorisations populaires
   */
  async getPopularMotorizations(categoryId: number): Promise<PopularMotorization[]> {
    try {
      const { data, error } = await this.supabase
        .from('cross_gamme_car_new')
        .select(`
          cgc_type_id,
          cgc_level,
          auto_type!inner(
            type_id,
            type_name,
            type_alias,
            type_power_ps,
            type_year_from,
            type_year_to,
            type_month_from,
            type_display,
            auto_modele!inner(
              modele_id,
              modele_name,
              modele_alias,
              modele_pic,
              modele_display,
              auto_marque!inner(
                marque_id,
                marque_name,
                marque_alias,
                marque_display
              )
            )
          ),
          seo_gamme_car(
            sgc_descrip
          )
        `)
        .eq('cgc_pg_id', categoryId)
        .eq('cgc_level', 1)
        .eq('auto_type.type_display', 1)
        .eq('auto_type.auto_modele.modele_display', 1)
        .eq('auto_type.auto_modele.auto_marque.marque_display', 1)
        .order('auto_type.auto_modele.modele_name')
        .order('auto_type.type_name')
        .limit(20);

      if (error) {
        console.error('Erreur récupération motorisations:', error);
        return [];
      }

      return (data || []).map((item: any) => {
        const type = item.auto_type;
        const modele = type.auto_modele;
        const marque = modele.auto_marque;
        const seoData = item.seo_gamme_car?.[0];

        return {
          typeId: item.cgc_type_id,
          brand: marque.marque_name,
          brandAlias: marque.marque_alias,
          model: modele.modele_name,
          modelAlias: modele.modele_alias,
          modelImage: modele.modele_pic 
            ? `https://ujttmmlwbdsngkhncfci.supabase.co/storage/v1/object/public/vehicles/${marque.marque_alias}/${modele.modele_pic}`
            : 'https://ujttmmlwbdsngkhncfci.supabase.co/storage/v1/object/public/vehicles/no.png',
          engine: type.type_name,
          engineAlias: type.type_alias,
          powerHp: type.type_power_ps,
          yearFrom: type.type_year_from,
          yearTo: type.type_year_to,
          monthFrom: type.type_month_from,
          seoContent: seoData?.sgc_descrip,
          categoryId,
          categoryAlias: '', // Sera rempli par le service parent
        };
      });
    } catch (error) {
      console.error('Erreur récupération motorisations:', error);
      return [];
    }
  }

  /**
   * Récupère les équipementiers
   */
  async getEquipementiers(categoryId: number): Promise<Equipmentier[]> {
    try {
      const { data, error } = await this.supabase
        .from('seo_equip_gamme')
        .select(`
          seg_id,
          seg_content,
          pieces_marque!inner(
            pm_id,
            pm_name,
            pm_logo,
            pm_sort,
            pm_display
          )
        `)
        .eq('seg_pg_id', categoryId)
        .eq('pieces_marque.pm_display', 1)
        .not('seg_content', 'is', null)
        .order('pieces_marque.pm_sort')
        .order('seg_id');

      if (error) {
        console.error('Erreur récupération équipementiers:', error);
        return [];
      }

      return (data || []).map((item: any) => ({
        id: item.pieces_marque.pm_id,
        name: item.pieces_marque.pm_name,
        logo: item.pieces_marque.pm_logo 
          ? `https://ujttmmlwbdsngkhncfci.supabase.co/storage/v1/object/public/brands/${item.pieces_marque.pm_logo}`
          : 'https://ujttmmlwbdsngkhncfci.supabase.co/storage/v1/object/public/brands/no.png',
        content: item.seg_content,
        sort: item.pieces_marque.pm_sort,
      }));
    } catch (error) {
      console.error('Erreur récupération équipementiers:', error);
      return [];
    }
  }

  /**
   * Récupère les informations techniques
   */
  async getTechnicalInfo(categoryId: number): Promise<TechnicalInfo[]> {
    try {
      const { data, error } = await this.supabase
        .from('seo_gamme_info')
        .select('sgi_id, sgi_content')
        .eq('sgi_pg_id', categoryId)
        .order('sgi_id');

      if (error) {
        console.error('Erreur récupération infos techniques:', error);
        return [];
      }

      return (data || []).map((item: any, index: number) => ({
        id: item.sgi_id,
        content: item.sgi_content,
        order: index + 1,
      }));
    } catch (error) {
      console.error('Erreur récupération infos techniques:', error);
      return [];
    }
  }

  /**
   * Récupère toutes les données de contenu pour une catégorie
   */
  async getCategoryFullContent(categoryId: number, familyId: number, categoryAlias: string): Promise<CategoryFullContent> {
    const [
      blogArticle,
      relatedCategories,
      popularMotorizations,
      equipmentiers,
      technicalInfo,
    ] = await Promise.all([
      this.getCategoryBlogArticle(categoryId),
      this.getRelatedCategories(categoryId, familyId),
      this.getPopularMotorizations(categoryId),
      this.getEquipementiers(categoryId),
      this.getTechnicalInfo(categoryId),
    ]);

    // Ajouter l'alias de catégorie aux motorisations
    const motorizations = popularMotorizations.map(m => ({
      ...m,
      categoryAlias,
    }));

    return {
      blogArticle,
      relatedCategories,
      popularMotorizations: motorizations,
      equipmentiers,
      technicalInfo,
    };
  }
}