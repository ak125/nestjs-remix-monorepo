import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
  position: number;
}

@Injectable()
export class BreadcrumbCacheService extends SupabaseBaseService {
  protected readonly logger = new Logger(BreadcrumbCacheService.name);

  /**
   * 🔍 Récupérer le breadcrumb depuis le cache (table ___meta_tags_ariane)
   */
  async getCachedBreadcrumb(alias: string): Promise<BreadcrumbItem[] | null> {
    try {
      const { data, error } = await this.client
        .from('___meta_tags_ariane')
        .select('mta_ariane')
        .eq('mta_alias', alias)
        .single();

      if (error || !data?.mta_ariane) {
        return null;
      }

      // Parser le JSON (peut être array ou object avec metadata)
      const parsed = JSON.parse(data.mta_ariane);

      // Si c'est déjà un array de breadcrumb items
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => ({
          label: item.label || item.name,
          href: item.href || item.path || item.item,
          active: item.active ?? index === parsed.length - 1,
          position: index + 1,
        }));
      }

      return null;
    } catch {
      this.logger.debug(`Pas de breadcrumb en cache pour: ${alias}`);
      return null;
    }
  }

  /**
   * 💾 Sauvegarder le breadcrumb dans le cache
   */
  async saveBreadcrumb(
    alias: string,
    breadcrumb: BreadcrumbItem[],
    metadata?: {
      title?: string;
      description?: string;
      h1?: string;
    },
  ): Promise<boolean> {
    try {
      const breadcrumbData = breadcrumb.map((item) => ({
        label: item.label,
        path: item.href,
        active: item.active,
      }));

      const mta_id = `breadcrumb_${alias.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;

      const { error } = await this.client.from('___meta_tags_ariane').upsert(
        {
          mta_id,
          mta_alias: alias,
          mta_ariane: JSON.stringify(breadcrumbData),
          mta_title: metadata?.title,
          mta_h1: metadata?.h1,
          mta_descrip: metadata?.description,
          mta_relfollow: 'follow',
        },
        {
          onConflict: 'mta_alias',
        },
      );

      if (error) {
        this.logger.error(`Erreur sauvegarde breadcrumb: ${error.message}`);
        return false;
      }

      this.logger.log(`✅ Breadcrumb sauvegardé: ${alias}`);
      return true;
    } catch (error) {
      this.logger.error(`Erreur inattendue: ${error}`);
      return false;
    }
  }

  /**
   * 🚗 Générer le breadcrumb pour une page de véhicule
   */
  generateVehicleBreadcrumb(
    brandName: string,
    brandAlias: string,
    brandId: number,
    modelName: string,
    typeName: string,
  ): BreadcrumbItem[] {
    return [
      {
        label: 'Accueil',
        href: '/',
        active: false,
        position: 1,
      },
      {
        label: brandName,
        href: `/constructeurs/${brandAlias}-${brandId}.html`,
        active: false,
        position: 2,
      },
      {
        label: `${modelName} ${typeName}`,
        active: true,
        position: 3,
      },
    ];
  }

  /**
   * 🏭 Générer le breadcrumb pour une page de gamme
   */
  generateGammeBreadcrumb(
    gammeName: string,
    gammeAlias: string,
  ): BreadcrumbItem[] {
    return [
      {
        label: 'Accueil',
        href: '/',
        active: false,
        position: 1,
      },
      {
        label: 'Catalogue',
        href: '/pieces/catalogue',
        active: false,
        position: 2,
      },
      {
        label: gammeName,
        href: `/pieces/${gammeAlias}`,
        active: true,
        position: 3,
      },
    ];
  }

  /**
   * 🔧 Générer le breadcrumb pour une page de pièce
   */
  generatePieceBreadcrumb(
    gammeName: string,
    gammeAlias: string,
    brandName: string,
    modelName: string,
    typeName: string,
  ): BreadcrumbItem[] {
    return [
      {
        label: 'Accueil',
        href: '/',
        active: false,
        position: 1,
      },
      {
        label: 'Catalogue',
        href: '/pieces/catalogue',
        active: false,
        position: 2,
      },
      {
        label: gammeName,
        href: `/pieces/${gammeAlias}`,
        active: false,
        position: 3,
      },
      {
        label: brandName,
        active: false,
        position: 4,
      },
      {
        label: `${modelName} ${typeName}`,
        active: true,
        position: 5,
      },
    ];
  }
}
