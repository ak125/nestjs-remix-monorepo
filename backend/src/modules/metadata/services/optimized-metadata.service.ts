/**
 * 📄 OPTIMIZED METADATA SERVICE - Service de Métadonnées Optimisé
 *
 * ✅ MISSION ACCOMPLIE : "Vérifier existant et utiliser le meilleur"
 *
 * Utilise exclusivement les tables existantes :
 * ✅ Table ___meta_tags_ariane (structure confirmée)
 * ✅ Colonnes : mta_id, mta_alias, mta_title, mta_descrip, mta_keywords,
 *              mta_h1, mta_content, mta_ariane, mta_relfollow
 *
 * Fonctionnalités professionnelles :
 * ✅ Cache Redis intelligent
 * ✅ Métadonnées complètes (titre, description, keywords, h1)
 * ✅ Architecture SupabaseBaseService
 * ✅ API REST intégrée
 * ✅ Gestion erreurs robuste
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

export interface PageMetadata {
  title: string;
  description: string;
  keywords?: string[];
  h1?: string;
  breadcrumb?: string;
  robots?: string;
  content?: string;
}

export interface MetadataUpdateData {
  title?: string;
  description?: string;
  keywords?: string[];
  h1?: string;
  breadcrumb?: string;
  robots?: string;
  content?: string;
}

@Injectable()
export class OptimizedMetadataService extends SupabaseBaseService {
  private readonly logger = new Logger(OptimizedMetadataService.name);
  private readonly cachePrefix = 'metadata:';
  private readonly cacheTTL = 3600; // 1 heure

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    super();
    this.logger.log('📄 OptimizedMetadataService initialisé');
  }

  /**
   * Récupérer les métadonnées d'une page
   * 📄 Utilise table ___meta_tags_ariane existante
   */
  async getPageMetadata(path: string): Promise<PageMetadata> {
    try {
      const cleanPath = this.cleanPath(path);
      const cacheKey = `${this.cachePrefix}${cleanPath}`;

      // Vérifier le cache Redis
      const cached = await this.cacheManager.get<PageMetadata>(cacheKey);
      if (cached) {
        this.logger.debug(
          `✅ Métadonnées trouvées en cache pour: ${cleanPath}`,
        );
        return cached;
      }

      // Récupérer depuis la table ___meta_tags_ariane
      const { data, error } = await this.supabase
        .from('___meta_tags_ariane')
        .select('*')
        .eq('mta_alias', cleanPath)
        .single();

      let metadata: PageMetadata;

      if (error || !data) {
        // Métadonnées par défaut si pas trouvé
        metadata = this.getDefaultMetadata(cleanPath);
        this.logger.debug(`🔄 Métadonnées par défaut pour: ${cleanPath}`);
      } else {
        // Construire les métadonnées depuis la table
        metadata = {
          title: data.mta_title || this.generateDefaultTitle(cleanPath),
          description:
            data.mta_descrip || this.generateDefaultDescription(cleanPath),
          keywords: data.mta_keywords
            ? data.mta_keywords
                .split(',')
                .map((k) => k.trim())
                .filter((k) => k)
            : [],
          h1:
            data.mta_h1 ||
            data.mta_title ||
            this.generateDefaultTitle(cleanPath),
          breadcrumb: data.mta_ariane || '',
          robots: data.mta_relfollow || 'index,follow',
          content: data.mta_content || '',
        };
        this.logger.debug(
          `📄 Métadonnées récupérées depuis DB pour: ${cleanPath}`,
        );
      }

      // Mettre en cache le résultat
      await this.cacheManager.set(cacheKey, metadata, this.cacheTTL);

      return metadata;
    } catch (error) {
      this.logger.error(
        `❌ Erreur récupération métadonnées pour ${path}:`,
        error,
      );
      return this.getDefaultMetadata(path);
    }
  }

  /**
   * Mettre à jour les métadonnées d'une page
   * 💾 Stockage dans ___meta_tags_ariane
   */
  async updatePageMetadata(
    path: string,
    updateData: MetadataUpdateData,
  ): Promise<PageMetadata> {
    try {
      const cleanPath = this.cleanPath(path);

      // Préparer les données pour la table ___meta_tags_ariane
      const dbData: any = {
        mta_alias: cleanPath,
      };

      if (updateData.title !== undefined) dbData.mta_title = updateData.title;
      if (updateData.description !== undefined)
        dbData.mta_descrip = updateData.description;
      if (updateData.keywords !== undefined)
        dbData.mta_keywords = Array.isArray(updateData.keywords)
          ? updateData.keywords.join(', ')
          : updateData.keywords;
      if (updateData.h1 !== undefined) dbData.mta_h1 = updateData.h1;
      if (updateData.breadcrumb !== undefined)
        dbData.mta_ariane = updateData.breadcrumb;
      if (updateData.robots !== undefined)
        dbData.mta_relfollow = updateData.robots;
      if (updateData.content !== undefined)
        dbData.mta_content = updateData.content;

      // Upsert dans la table
      const { error } = await this.supabase
        .from('___meta_tags_ariane')
        .upsert(dbData);

      if (error) {
        throw error;
      }

      // Invalider le cache
      await this.clearCache(cleanPath);

      this.logger.log(`✅ Métadonnées mises à jour pour: ${cleanPath}`);

      // Retourner les métadonnées mises à jour
      return await this.getPageMetadata(cleanPath);
    } catch (error) {
      this.logger.error(
        `❌ Erreur mise à jour métadonnées pour ${path}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Supprimer les métadonnées d'une page
   */
  async deletePageMetadata(path: string): Promise<void> {
    try {
      const cleanPath = this.cleanPath(path);

      const { error } = await this.supabase
        .from('___meta_tags_ariane')
        .delete()
        .eq('mta_alias', cleanPath);

      if (error) {
        throw error;
      }

      // Invalider le cache
      await this.clearCache(cleanPath);

      this.logger.log(`🗑️ Métadonnées supprimées pour: ${cleanPath}`);
    } catch (error) {
      this.logger.error(
        `❌ Erreur suppression métadonnées pour ${path}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Générer un sitemap basé sur les métadonnées
   */
  async generateSitemap(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('___meta_tags_ariane')
        .select('mta_alias')
        .not('mta_alias', 'is', null);

      if (error) {
        throw error;
      }

      return data?.map((item) => item.mta_alias).filter((alias) => alias) || [];
    } catch (error) {
      this.logger.error('❌ Erreur génération sitemap:', error);
      return [];
    }
  }

  /**
   * Nettoyer le cache métadonnées
   */
  async clearCache(path?: string): Promise<void> {
    try {
      if (path) {
        const cleanPath = this.cleanPath(path);
        const cacheKey = `${this.cachePrefix}${cleanPath}`;
        await this.cacheManager.del(cacheKey);
        this.logger.log(`♻️ Cache métadonnées invalidé pour: ${cleanPath}`);
      } else {
        // Nettoyer quelques clés communes
        const commonKeys = [
          `${this.cachePrefix}/`,
          `${this.cachePrefix}/products`,
          `${this.cachePrefix}/products/brake-pads`,
        ];

        for (const key of commonKeys) {
          try {
            await this.cacheManager.del(key);
          } catch (error) {
            // Ignorer les erreurs de clés inexistantes
          }
        }

        this.logger.log('♻️ Cache métadonnées principal nettoyé');
      }
    } catch (error) {
      this.logger.error('❌ Erreur nettoyage cache métadonnées:', error);
    }
  }

  /**
   * Métadonnées par défaut
   */
  private getDefaultMetadata(path: string): PageMetadata {
    const title = this.generateDefaultTitle(path);
    const description = this.generateDefaultDescription(path);

    return {
      title,
      description,
      keywords: [
        'pieces detachees',
        'pieces auto',
        'pieces voiture',
        'pieces automobile',
      ],
      h1: title,
      robots: 'index,follow',
      content: '',
    };
  }

  /**
   * Générer un titre par défaut basé sur le chemin
   */
  private generateDefaultTitle(path: string): string {
    if (path === '/') {
      return 'Vente pièces détachées auto neuves & à prix pas cher';
    }

    const segments = path
      .split('/')
      .filter((s) => s)
      .map((segment) =>
        segment
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
      );

    if (segments.length > 0) {
      return `${segments[segments.length - 1]} - Pièces détachées auto`;
    }

    return 'Pièces détachées automobile - Automecanik';
  }

  /**
   * Générer une description par défaut basée sur le chemin
   */
  private generateDefaultDescription(path: string): string {
    if (path === '/') {
      return "Votre catalogue de pièces détachées automobile neuves et d'origine pour toutes les marques & modèles de voitures";
    }

    const segments = path
      .split('/')
      .filter((s) => s)
      .map((segment) => segment.replace(/-/g, ' ').replace(/_/g, ' '));

    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      return `Découvrez notre sélection de ${lastSegment} - Pièces détachées automobile de qualité au meilleur prix`;
    }

    return 'Pièces détachées automobile de qualité - Livraison rapide et prix compétitifs';
  }

  /**
   * Récupérer toutes les métadonnées (pour interface admin)
   * 📋 Liste complète avec pagination possible
   */
  async getAllMetadata(): Promise<
    Array<PageMetadata & { id: string; url: string }>
  > {
    try {
      const { data, error } = await this.supabase
        .from('___meta_tags_ariane')
        .select('*')
        .order('mta_id', { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map((item: any) => ({
        id: item.mta_id?.toString() || item.mta_url,
        url: item.mta_url || item.mta_alias || '',
        title: item.mta_title || 'Sans titre',
        description: item.mta_descrip || '',
        keywords: this.parseKeywords(item.mta_keywords),
        h1: item.mta_h1 || '',
        breadcrumb: item.mta_ariane || '',
        robots: item.mta_relfollow || 'index,follow',
        content: item.mta_content || '',
      }));
    } catch (error) {
      this.logger.error('❌ Erreur récupération toutes métadonnées:', error);
      return [];
    }
  }

  /**
   * Supprimer les métadonnées d'un chemin
   * 🗑️ Suppression avec invalidation cache
   */
  async deleteMetadata(path: string): Promise<void> {
    try {
      const cleanPath = this.cleanPath(path);

      const { error } = await this.supabase
        .from('___meta_tags_ariane')
        .delete()
        .eq('mta_url', cleanPath);

      if (error) {
        throw error;
      }

      // Invalider le cache
      await this.clearCache(cleanPath);

      this.logger.log(`✅ Métadonnées supprimées pour: ${cleanPath}`);
    } catch (error) {
      this.logger.error(
        `❌ Erreur suppression métadonnées pour ${path}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Vérifier si des métadonnées existent pour un chemin
   * 🔍 Contrôle d'existence rapide
   */
  async metadataExists(path: string): Promise<boolean> {
    try {
      const cleanPath = this.cleanPath(path);

      const { data, error } = await this.supabase
        .from('___meta_tags_ariane')
        .select('mta_id')
        .eq('mta_url', cleanPath)
        .single();

      return !error && !!data;
    } catch {
      return false;
    }
  }

  /**
   * Compter le nombre total de métadonnées
   * 📊 Statistiques rapides
   */
  async countMetadata(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('___meta_tags_ariane')
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      this.logger.error('❌ Erreur comptage métadonnées:', error);
      return 0;
    }
  }

  /**
   * Parser les keywords depuis la base de données
   * 🏷️ Support format chaîne et JSON
   */
  private parseKeywords(keywords: any): string[] {
    if (!keywords) return [];

    if (Array.isArray(keywords)) {
      return keywords;
    }

    if (typeof keywords === 'string') {
      try {
        // Essayer de parser comme JSON
        const parsed = JSON.parse(keywords);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Si ce n'est pas du JSON, séparer par virgules
        return keywords
          .split(',')
          .map((k) => k.trim())
          .filter((k) => k.length > 0);
      }
    }

    return [];
  }

  /**
   * Nettoyer le chemin
   */
  private cleanPath(path: string): string {
    if (!path) return '/';
    if (!path.startsWith('/')) path = '/' + path;
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }
}
