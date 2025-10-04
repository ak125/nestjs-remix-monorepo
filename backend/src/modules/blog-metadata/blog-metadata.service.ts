/**
 * 📝 BLOG METADATA SERVICE
 * 
 * Service générique pour récupérer les métadonnées SEO
 * depuis la table __blog_meta_tags_ariane de Supabase
 * 
 * Utilisable par toutes les pages du blog
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SupabaseClient } from '@supabase/supabase-js';

export interface BlogMetadata {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  ariane: string;
  content: string | null;
  relfollow: string;
}

@Injectable()
export class BlogMetadataService {
  private readonly logger = new Logger(BlogMetadataService.name);
  private client: SupabaseClient;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject('SUPABASE_CLIENT') supabaseClient: SupabaseClient,
  ) {
    this.client = supabaseClient;
  }

  /**
   * Récupérer les métadonnées d'une page par son alias
   * @param alias - Clé unique de la page (ex: 'constructeurs', 'advice', 'article')
   * @returns Métadonnées SEO formatées
   */
  async getMetadata(alias: string): Promise<BlogMetadata> {
    try {
      this.logger.log(`🔍 Récupération métadonnées pour alias="${alias}"`);

      // 1️⃣ Vérifier le cache Redis
      const cacheKey = `blog-meta:${alias}`;
      const cached = await this.cacheManager.get<BlogMetadata>(cacheKey);
      
      if (cached) {
        this.logger.log(`✅ Métadonnées depuis cache pour "${alias}"`);
        return cached;
      }

      // 2️⃣ Requête Supabase
      const { data, error } = await this.client
        .from('__blog_meta_tags_ariane')
        .select('*')
        .eq('mta_alias', alias)
        .single();

      // 3️⃣ Fallback si aucune donnée trouvée
      if (error || !data) {
        this.logger.warn(
          `⚠️ Aucune métadonnée trouvée pour "${alias}":`,
          error?.message || 'Pas de données',
        );
        
        return this.getDefaultMetadata(alias);
      }

      this.logger.log(`✅ Métadonnées récupérées pour "${alias}"`);

      // 4️⃣ Formater et normaliser les données
      const metadata: BlogMetadata = {
        title: data.mta_title || 'Automecanik - Pièces Auto',
        description: data.mta_descrip || '',
        keywords: data.mta_keywords || '',
        h1: data.mta_h1 || data.mta_title || '',
        ariane: data.mta_ariane || '',
        content: data.mta_content || null,
        relfollow: this.normalizeRelFollow(data.mta_relfollow),
      };

      // 5️⃣ Mise en cache (1 heure)
      await this.cacheManager.set(cacheKey, metadata, 3600);

      return metadata;
    } catch (error) {
      this.logger.error(
        `❌ Erreur getMetadata pour "${alias}":`,
        error instanceof Error ? error.message : error,
      );
      
      return this.getDefaultMetadata(alias);
    }
  }

  /**
   * Récupérer toutes les métadonnées disponibles
   * Utile pour générer des sitemaps ou des listes de pages
   */
  async getAllMetadata(): Promise<BlogMetadata[]> {
    try {
      this.logger.log('🔍 Récupération de toutes les métadonnées');

      // Vérifier le cache
      const cacheKey = 'blog-meta:all';
      const cached = await this.cacheManager.get<BlogMetadata[]>(cacheKey);
      
      if (cached) {
        this.logger.log(`✅ ${cached.length} métadonnées depuis cache`);
        return cached;
      }

      // Requête Supabase
      const { data, error } = await this.client
        .from('__blog_meta_tags_ariane')
        .select('*')
        .order('mta_alias', { ascending: true });

      if (error || !data) {
        this.logger.warn('⚠️ Erreur récupération toutes métadonnées:', error);
        return [];
      }

      this.logger.log(`✅ ${data.length} métadonnées récupérées`);

      // Formater toutes les métadonnées
      const allMetadata = data.map((item) => ({
        title: item.mta_title || 'Automecanik',
        description: item.mta_descrip || '',
        keywords: item.mta_keywords || '',
        h1: item.mta_h1 || item.mta_title || '',
        ariane: item.mta_ariane || '',
        content: item.mta_content || null,
        relfollow: this.normalizeRelFollow(item.mta_relfollow),
      }));

      // Cache 1 heure
      await this.cacheManager.set(cacheKey, allMetadata, 3600);

      return allMetadata;
    } catch (error) {
      this.logger.error('❌ Erreur getAllMetadata:', error);
      return [];
    }
  }

  /**
   * Récupérer la liste des alias disponibles
   */
  async getAvailableAliases(): Promise<string[]> {
    try {
      const cacheKey = 'blog-meta:aliases';
      const cached = await this.cacheManager.get<string[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const { data, error } = await this.client
        .from('__blog_meta_tags_ariane')
        .select('mta_alias')
        .order('mta_alias', { ascending: true });

      if (error || !data) {
        this.logger.warn('⚠️ Erreur récupération aliases:', error);
        return [];
      }

      const aliases = data.map((item) => item.mta_alias);
      
      await this.cacheManager.set(cacheKey, aliases, 3600);
      
      return aliases;
    } catch (error) {
      this.logger.error('❌ Erreur getAvailableAliases:', error);
      return [];
    }
  }

  /**
   * Invalider le cache d'un alias spécifique
   */
  async invalidateCache(alias: string): Promise<void> {
    const cacheKey = `blog-meta:${alias}`;
    await this.cacheManager.del(cacheKey);
    this.logger.log(`🗑️ Cache invalidé pour "${alias}"`);
  }

  /**
   * Invalider tout le cache des métadonnées
   */
  async invalidateAllCache(): Promise<void> {
    // Récupérer tous les alias pour invalider leurs caches
    const aliases = await this.getAvailableAliases();
    
    for (const alias of aliases) {
      await this.invalidateCache(alias);
    }
    
    // Invalider le cache global
    await this.cacheManager.del('blog-meta:all');
    await this.cacheManager.del('blog-meta:aliases');
    
    this.logger.log('🗑️ Tout le cache des métadonnées invalidé');
  }

  /**
   * Normaliser la valeur de mta_relfollow
   * Gère les formats: "1", "0", "index, follow", "noindex, nofollow"
   */
  private normalizeRelFollow(value: string | null | undefined): string {
    if (!value) {
      return 'index, follow';
    }

    // Format numérique (legacy)
    if (value === '1') {
      return 'index, follow';
    }
    
    if (value === '0') {
      return 'noindex, nofollow';
    }

    // Format texte standard
    if (value === 'index, follow' || value === 'index,follow') {
      return 'index, follow';
    }

    if (value === 'noindex, nofollow' || value === 'noindex,nofollow') {
      return 'noindex, nofollow';
    }

    // Par défaut, on indexe
    return 'index, follow';
  }

  /**
   * Métadonnées par défaut selon l'alias
   */
  private getDefaultMetadata(alias: string): BlogMetadata {
    const defaults: Record<string, BlogMetadata> = {
      home: {
        title: 'Automecanik - Pièces détachées automobiles',
        description: 'Découvrez notre catalogue complet de pièces auto.',
        keywords: 'pièces auto, accessoires, automecanik',
        h1: 'Bienvenue sur Automecanik',
        ariane: 'Accueil',
        content: null,
        relfollow: 'index, follow',
      },
      constructeurs: {
        title: 'Catalogue Technique Auto - Toutes les marques',
        description: 'Pièces détachées pour toutes les marques automobiles.',
        keywords: 'constructeurs, marques auto, catalogue',
        h1: 'Catalogue des Constructeurs Automobiles',
        ariane: 'Accueil > Constructeurs',
        content: null,
        relfollow: 'index, follow',
      },
      advice: {
        title: 'Conseils & Guides Auto | Automecanik',
        description: 'Tous nos conseils pour l\'entretien de votre véhicule.',
        keywords: 'conseils auto, guides, entretien',
        h1: 'Conseils & Guides',
        ariane: 'Accueil > Conseils',
        content: null,
        relfollow: 'index, follow',
      },
      article: {
        title: 'Article | Automecanik',
        description: 'Article du blog Automecanik',
        keywords: 'article, blog, auto',
        h1: 'Article',
        ariane: 'Accueil > Blog > Article',
        content: null,
        relfollow: 'index, follow',
      },
      guide: {
        title: 'Guides Techniques | Automecanik',
        description: 'Guides techniques pour la réparation automobile',
        keywords: 'guides, techniques, réparation',
        h1: 'Guides Techniques',
        ariane: 'Accueil > Guides',
        content: null,
        relfollow: 'index, follow',
      },
    };

    return (
      defaults[alias] || {
        title: 'Automecanik - Pièces Auto',
        description: 'Pièces détachées automobiles de qualité',
        keywords: 'pièces auto',
        h1: 'Automecanik',
        ariane: 'Accueil',
        content: null,
        relfollow: 'index, follow',
      }
    );
  }
}
