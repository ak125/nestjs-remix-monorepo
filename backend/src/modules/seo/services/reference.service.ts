import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

/**
 * Interface pour une référence SEO (R4)
 */
export interface SeoReference {
  id: number;
  slug: string;
  title: string;
  metaDescription: string | null;
  definition: string;
  roleMecanique: string | null;
  roleNegatif: string | null; // NOUVEAU: "Ce que ça NE fait PAS"
  composition: string[] | null;
  confusionsCourantes: string[] | null;
  symptomesAssocies: string[] | null;
  reglesMetier: string[] | null; // NOUVEAU: Règles anti-erreur
  scopeLimites: string | null; // NOUVEAU: Variantes et limitations
  contentHtml: string | null;
  schemaJson: Record<string, unknown> | null;
  pgId: number | null;
  gammeName: string | null;
  gammeSlug: string | null;
  relatedReferences: number[] | null;
  blogSlugs: string[] | null;
  canonicalUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface pour la liste des références (version légère)
 */
export interface SeoReferenceListItem {
  id: number;
  slug: string;
  title: string;
  metaDescription: string | null;
  definition: string;
  pgId: number | null;
  gammeName: string | null;
  gammeSlug: string | null;
}

/**
 * Service pour gérer les pages Référence (R4)
 * Ces pages contiennent les définitions canoniques des pièces auto
 */
@Injectable()
export class ReferenceService {
  private readonly logger = new Logger(ReferenceService.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Récupère une référence par son slug
   * @param slug - Le slug URL de la référence (ex: "kit-embrayage")
   * @returns La référence complète ou null si non trouvée
   */
  async getBySlug(slug: string): Promise<SeoReference | null> {
    this.logger.debug(`🔍 Fetching reference: ${slug}`);

    const { data, error } = await this.supabase.rpc(
      'get_seo_reference_by_slug',
      {
        p_slug: slug,
      },
    );

    if (error) {
      this.logger.error(`❌ Error fetching reference ${slug}:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      this.logger.debug(`Reference not found: ${slug}`);
      return null;
    }

    const row = data[0];
    return this.mapRowToReference(row);
  }

  /**
   * Récupère toutes les références publiées
   * @returns Liste des références (version légère)
   */
  async getAll(): Promise<SeoReferenceListItem[]> {
    this.logger.debug('📚 Fetching all references');

    const { data, error } = await this.supabase.rpc('get_all_seo_references');

    if (error) {
      this.logger.error('❌ Error fetching all references:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as number,
      slug: row.slug as string,
      title: row.title as string,
      metaDescription: row.meta_description as string | null,
      definition: row.definition as string,
      pgId: row.pg_id as number | null,
      gammeName: row.gamme_name as string | null,
      gammeSlug: row.gamme_slug as string | null,
    }));
  }

  /**
   * Récupère les références liées à une référence donnée
   * @param refId - L'ID de la référence
   * @returns Liste des références liées
   */
  async getRelatedReferences(refId: number): Promise<SeoReferenceListItem[]> {
    this.logger.debug(`🔗 Fetching related references for ID: ${refId}`);

    // D'abord, récupérer les IDs des références liées
    const { data: refData, error: refError } = await this.supabase
      .from('__seo_reference')
      .select('related_references')
      .eq('id', refId)
      .single();

    if (refError || !refData?.related_references?.length) {
      return [];
    }

    // Ensuite, récupérer les détails
    const { data, error } = await this.supabase
      .from('__seo_reference')
      .select('id, slug, title, meta_description, definition, pg_id')
      .in(
        'id',
        refData.related_references.map((id) => String(id)),
      )
      .eq('is_published', true);

    if (error) {
      this.logger.error('❌ Error fetching related references:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      metaDescription: row.meta_description,
      definition: row.definition?.substring(0, 300) + '...',
      pgId: row.pg_id,
      gammeName: null,
      gammeSlug: null,
    }));
  }

  /**
   * Vérifie si une référence existe pour un slug donné
   * @param slug - Le slug à vérifier
   * @returns true si la référence existe et est publiée
   */
  async exists(slug: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('__seo_reference')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug)
      .eq('is_published', true);

    return !error && (count ?? 0) > 0;
  }

  /**
   * Récupère le slug de référence pour une gamme donnée (par pg_id)
   * @param pgId - L'ID de la gamme
   * @returns Le slug de la référence ou null
   */
  async getReferenceSlugByGammeId(pgId: number): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('__seo_reference')
      .select('slug')
      .eq('pg_id', pgId)
      .eq('is_published', true)
      .single();

    if (error || !data) {
      return null;
    }

    return data.slug;
  }

  /**
   * Génère le Schema.org DefinedTerm pour une référence
   * @param ref - La référence
   * @returns Le JSON-LD Schema.org
   */
  generateSchemaJson(ref: SeoReference): Record<string, unknown> {
    return {
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: ref.title
        .replace(' : Définition, rôle et composition', '')
        .replace(' : Définition et rôle', ''),
      description: ref.definition.substring(0, 300),
      inDefinedTermSet: {
        '@type': 'DefinedTermSet',
        name: 'Référence Auto - Pièces Automobiles',
        url: 'https://automecanik.com/reference-auto',
      },
      url: `https://automecanik.com/reference-auto/${ref.slug}`,
    };
  }

  /**
   * Mappe une ligne de la base de données vers une SeoReference
   */
  private mapRowToReference(row: Record<string, unknown>): SeoReference {
    return {
      id: row.id as number,
      slug: row.slug as string,
      title: row.title as string,
      metaDescription: row.meta_description as string | null,
      definition: row.definition as string,
      roleMecanique: row.role_mecanique as string | null,
      roleNegatif: row.role_negatif as string | null, // NOUVEAU
      composition: row.composition as string[] | null,
      confusionsCourantes: row.confusions_courantes as string[] | null,
      symptomesAssocies: row.symptomes_associes as string[] | null,
      reglesMetier: row.regles_metier as string[] | null, // NOUVEAU
      scopeLimites: row.scope_limites as string | null, // NOUVEAU
      contentHtml: row.content_html as string | null,
      schemaJson: row.schema_json as Record<string, unknown> | null,
      pgId: row.pg_id as number | null,
      gammeName: row.gamme_name as string | null,
      gammeSlug: row.gamme_slug as string | null,
      relatedReferences: row.related_references as number[] | null,
      blogSlugs: row.blog_slugs as string[] | null,
      canonicalUrl: row.canonical_url as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }
}
