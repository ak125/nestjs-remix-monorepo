import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';

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
export class ReferenceService extends SupabaseBaseService {
  protected override readonly logger = new Logger(ReferenceService.name);

  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * Récupère une référence par son slug
   * @param slug - Le slug URL de la référence (ex: "kit-embrayage")
   * @returns La référence complète ou null si non trouvée
   */
  async getBySlug(slug: string): Promise<SeoReference | null> {
    this.logger.debug(`🔍 Fetching reference: ${slug}`);

    // 🛡️ RPC Safety Gate
    const { data, error } = await this.callRpc<any[]>(
      'get_seo_reference_by_slug',
      { p_slug: slug },
      { source: 'api' },
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

    // 🛡️ RPC Safety Gate
    const { data, error } = await this.callRpc<any[]>(
      'get_all_seo_references',
      {},
      { source: 'api' },
    );

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

  // ============================================
  // MÉTHODES DE GÉNÉRATION (Phase 7 - Draft + Review)
  // ============================================

  /**
   * Génère des entrées R4 Reference depuis les gammes existantes
   * Les entrées sont créées en mode DRAFT (is_published: false)
   * @returns Nombre d'entrées créées et ignorées
   */
  async generateFromGammes(): Promise<{ created: number; skipped: number }> {
    this.logger.log('🏭 Generating R4 References from gammes...');

    // 1. Récupérer gammes avec descriptions
    const { data: gammes, error: gammeError } = await this.supabase
      .from('__pg_gammes')
      .select('id, pg_alias, label, description')
      .not('pg_alias', 'is', null);

    if (gammeError || !gammes) {
      this.logger.error('❌ Error fetching gammes:', gammeError);
      return { created: 0, skipped: 0 };
    }

    let created = 0;
    let skipped = 0;

    for (const gamme of gammes) {
      // 2. Vérifier si entrée existe déjà (publiée ou draft)
      const { count } = await this.supabase
        .from('__seo_reference')
        .select('id', { count: 'exact', head: true })
        .eq('slug', gamme.pg_alias);

      if ((count ?? 0) > 0) {
        skipped++;
        continue;
      }

      // 3. Créer entrée R4 en DRAFT
      const { error: insertError } = await this.supabase
        .from('__seo_reference')
        .insert({
          slug: gamme.pg_alias,
          title: `Qu'est-ce qu'un ${gamme.label} ?`,
          meta_description: `Définition technique du ${gamme.label}: rôle, composition, fonctionnement.`,
          definition:
            gamme.description ||
            `Le ${gamme.label} est une pièce automobile essentielle.`,
          role_mecanique: `Rôle mécanique du ${gamme.label} dans le véhicule.`,
          pg_id: gamme.id,
          is_published: false, // ← DRAFT - validation manuelle requise
        });

      if (insertError) {
        this.logger.error(
          `❌ Error inserting reference ${gamme.pg_alias}:`,
          insertError,
        );
        continue;
      }

      created++;
    }

    this.logger.log(
      `✅ Generation complete: ${created} created, ${skipped} skipped`,
    );
    return { created, skipped };
  }

  /**
   * Récupère tous les drafts (non publiés)
   * @returns Liste des références en mode draft
   */
  async getDrafts(): Promise<SeoReferenceListItem[]> {
    this.logger.debug('📝 Fetching draft references');

    const { data, error } = await this.supabase
      .from('__seo_reference')
      .select(
        'id, slug, title, meta_description, definition, pg_id, is_published, created_at',
      )
      .eq('is_published', false)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('❌ Error fetching drafts:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      metaDescription: row.meta_description,
      definition: row.definition?.substring(0, 200) + '...',
      pgId: row.pg_id,
      gammeName: null,
      gammeSlug: null,
    }));
  }

  /**
   * Publie une référence (is_published: true)
   * @param slug - Le slug de la référence à publier
   * @returns Succès ou échec
   */
  async publish(slug: string): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`📢 Publishing reference: ${slug}`);

    const { error } = await this.supabase
      .from('__seo_reference')
      .update({
        is_published: true,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', slug);

    if (error) {
      this.logger.error(`❌ Error publishing ${slug}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Met à jour une référence (draft ou publiée)
   * @param slug - Le slug de la référence
   * @param updates - Les champs à mettre à jour
   * @returns Succès ou échec
   */
  async update(
    slug: string,
    updates: Partial<{
      title: string;
      meta_description: string;
      definition: string;
      role_mecanique: string;
      role_negatif: string;
      composition: string[];
      confusions_courantes: string[];
      symptomes_associes: string[];
      regles_metier: string[];
      scope_limites: string;
      content_html: string;
    }>,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`✏️ Updating reference: ${slug}`);

    const { error } = await this.supabase
      .from('__seo_reference')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', slug);

    if (error) {
      this.logger.error(`❌ Error updating ${slug}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Supprime une référence draft (non publiée)
   * @param slug - Le slug de la référence à supprimer
   * @returns Succès ou échec
   */
  async deleteDraft(
    slug: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`🗑️ Deleting draft reference: ${slug}`);

    // Vérifier que c'est bien un draft
    const { data: existing } = await this.supabase
      .from('__seo_reference')
      .select('is_published')
      .eq('slug', slug)
      .single();

    if (existing?.is_published) {
      return { success: false, error: 'Cannot delete published reference' };
    }

    const { error } = await this.supabase
      .from('__seo_reference')
      .delete()
      .eq('slug', slug);

    if (error) {
      this.logger.error(`❌ Error deleting ${slug}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
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
