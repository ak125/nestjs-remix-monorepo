import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import * as fs from 'fs';
import * as path from 'path';

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
  private readonly RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';

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
   * Récupère une référence par pg_id (gamme ID)
   */
  async getByPgId(pgId: number): Promise<SeoReference | null> {
    const { data, error } = await this.supabase
      .from('__seo_reference')
      .select('*')
      .eq('pg_id', pgId)
      .eq('is_published', true)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapRowToReference(data);
  }

  /**
   * Compte les produits pour une gamme (pour CTA pages référence)
   */
  async getProductCountByGammeId(pgId: number): Promise<number> {
    const { count } = await this.supabase
      .from('pieces')
      .select('*', { count: 'exact', head: true })
      .eq('piece_pg_id', pgId)
      .eq('piece_display', true);
    return count || 0;
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

      // 3. Parse RAG gamme file for enriched content
      const ragData = this.parseRagGammeFile(gamme.pg_alias);

      // 4. Look up related R5 diagnostics
      const { data: relatedDiags } = await this.supabase
        .from('__seo_observable')
        .select('id')
        .eq('cluster_id', gamme.pg_alias)
        .limit(5);

      const relatedRefIds = (relatedDiags || []).map((d: any) => d.id);

      // 5. Build content HTML from RAG data
      let contentHtml = '';
      if (ragData) {
        contentHtml = '<div class="reference-content">';

        if (ragData.roleSummary) {
          contentHtml += `<section><h2>Rôle mécanique</h2><p>${ragData.roleSummary}</p></section>`;
        }

        if (ragData.mustBeTrue && ragData.mustBeTrue.length > 0) {
          contentHtml += '<section><h2>Règles métier</h2><ul>';
          ragData.mustBeTrue.forEach((rule) => {
            contentHtml += `<li>${rule}</li>`;
          });
          contentHtml += '</ul></section>';
        }

        if (ragData.symptoms && ragData.symptoms.length > 0) {
          contentHtml += '<section><h2>Symptômes associés</h2><ul>';
          ragData.symptoms.forEach((symptom) => {
            contentHtml += `<li>${symptom}</li>`;
          });
          contentHtml += '</ul></section>';
        }

        contentHtml += '</div>';
      }

      // 6. Créer entrée R4 en DRAFT avec enrichissement RAG
      const { error: insertError } = await this.supabase
        .from('__seo_reference')
        .insert({
          slug: gamme.pg_alias,
          title: `${gamme.label} : Définition, rôle et composition`,
          meta_description: ragData?.roleSummary
            ? `${gamme.label}: ${ragData.roleSummary.substring(0, 130)}. Guide complet.`
            : `Définition technique du ${gamme.label}: rôle, composition, fonctionnement.`,
          definition: ragData?.roleSummary
            ? `Le ${gamme.label} ${ragData.roleSummary.charAt(0).toLowerCase()}${ragData.roleSummary.slice(1)}. C'est une pièce essentielle du système automobile.`
            : gamme.description ||
              `Le ${gamme.label} est une pièce automobile essentielle.`,
          role_mecanique:
            ragData?.roleSummary ||
            `Rôle mécanique du ${gamme.label} dans le véhicule.`,
          composition: null,
          confusions_courantes: ragData?.mustNotContain?.length
            ? ragData.mustNotContain
            : null,
          symptomes_associes: ragData?.symptoms?.length
            ? ragData.symptoms
            : null,
          regles_metier: ragData?.mustBeTrue?.length
            ? ragData.mustBeTrue
            : null,
          content_html: contentHtml || null,
          related_references: relatedRefIds.length > 0 ? relatedRefIds : null,
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
   * Refresh a single gamme's R4 reference from RAG knowledge.
   * Creates a new DRAFT or updates existing entry (never overwrites is_published).
   */
  async refreshSingleGamme(pgAlias: string): Promise<{
    created: boolean;
    updated: boolean;
    skipped: boolean;
    qualityScore?: number;
    qualityFlags?: string[];
  }> {
    // 1. Find gamme by alias
    const { data: gamme } = await this.supabase
      .from('__pg_gammes')
      .select('id, pg_alias, label, description')
      .eq('pg_alias', pgAlias)
      .single();

    if (!gamme) {
      this.logger.warn(`No gamme found for alias: ${pgAlias}`);
      return { created: false, updated: false, skipped: true };
    }

    // 2. Parse fresh RAG data
    const ragData = this.parseRagGammeFile(pgAlias);
    if (!ragData) {
      this.logger.warn(`No RAG data available for: ${pgAlias}`);
      return { created: false, updated: false, skipped: true };
    }

    // 3. Check if entry exists
    const { data: existing } = await this.supabase
      .from('__seo_reference')
      .select('id, is_published')
      .eq('slug', pgAlias)
      .single();

    // 4. Build content HTML from RAG data
    let contentHtml = '<div class="reference-content">';
    if (ragData.roleSummary) {
      contentHtml += `<section><h2>Rôle mécanique</h2><p>${ragData.roleSummary}</p></section>`;
    }
    if (ragData.mustBeTrue.length > 0) {
      contentHtml += '<section><h2>Règles métier</h2><ul>';
      ragData.mustBeTrue.forEach((rule) => {
        contentHtml += `<li>${rule}</li>`;
      });
      contentHtml += '</ul></section>';
    }
    if (ragData.symptoms.length > 0) {
      contentHtml += '<section><h2>Symptômes associés</h2><ul>';
      ragData.symptoms.forEach((symptom) => {
        contentHtml += `<li>${symptom}</li>`;
      });
      contentHtml += '</ul></section>';
    }
    contentHtml += '</div>';

    if (existing) {
      // 5a. Update existing entry — refresh content but keep is_published
      const { error } = await this.supabase
        .from('__seo_reference')
        .update({
          role_mecanique: ragData.roleSummary || undefined,
          confusions_courantes:
            ragData.mustNotContain.length > 0
              ? ragData.mustNotContain
              : undefined,
          symptomes_associes:
            ragData.symptoms.length > 0 ? ragData.symptoms : undefined,
          regles_metier:
            ragData.mustBeTrue.length > 0 ? ragData.mustBeTrue : undefined,
          content_html: contentHtml,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        this.logger.error(
          `Failed to update reference ${pgAlias}: ${error.message}`,
        );
        return { created: false, updated: false, skipped: false };
      }

      this.logger.log(`Updated R4 reference for: ${pgAlias}`);
      const quality = this.scoreRagData(ragData, false);
      return {
        created: false,
        updated: true,
        skipped: false,
        qualityScore: quality.score,
        qualityFlags: quality.flags,
      };
    }

    // 5b. Create new DRAFT entry
    const { error: insertError } = await this.supabase
      .from('__seo_reference')
      .insert({
        slug: pgAlias,
        title: `${gamme.label} : Définition, rôle et composition`,
        meta_description: ragData.roleSummary
          ? `${gamme.label}: ${ragData.roleSummary.substring(0, 130)}. Guide complet.`
          : `Définition technique du ${gamme.label}: rôle, composition, fonctionnement.`,
        definition: ragData.roleSummary
          ? `Le ${gamme.label} ${ragData.roleSummary.charAt(0).toLowerCase()}${ragData.roleSummary.slice(1)}.`
          : gamme.description || `Le ${gamme.label} est une pièce automobile.`,
        role_mecanique:
          ragData.roleSummary || `Rôle mécanique du ${gamme.label}.`,
        confusions_courantes:
          ragData.mustNotContain.length > 0 ? ragData.mustNotContain : null,
        symptomes_associes:
          ragData.symptoms.length > 0 ? ragData.symptoms : null,
        regles_metier:
          ragData.mustBeTrue.length > 0 ? ragData.mustBeTrue : null,
        content_html: contentHtml,
        pg_id: gamme.id,
        is_published: false,
      });

    if (insertError) {
      this.logger.error(
        `Failed to create reference ${pgAlias}: ${insertError.message}`,
      );
      return { created: false, updated: false, skipped: false };
    }

    this.logger.log(`Created R4 draft reference for: ${pgAlias}`);
    const quality = this.scoreRagData(ragData, true);
    return {
      created: true,
      updated: false,
      skipped: false,
      qualityScore: quality.score,
      qualityFlags: quality.flags,
    };
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
   * Parse RAG gamme file for enriched content
   */
  private parseRagGammeFile(pgAlias: string): {
    roleSummary: string | null;
    mustBeTrue: string[];
    mustNotContain: string[];
    symptoms: string[];
    diagnosticTree: string[];
  } | null {
    // Try multiple filename patterns
    const candidates = [`${pgAlias}.md`, `${pgAlias.replace(/-/g, ' ')}.md`];

    for (const filename of candidates) {
      const filePath = path.join(this.RAG_GAMMES_DIR, filename);
      try {
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse YAML frontmatter
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) return null;

        const fm = fmMatch[1];

        // Extract role_summary (supports both YAML block scalar `>-` and inline with indented continuation)
        const roleMatch = fm.match(
          /role_summary:\s*(?:>-?\s*\n([\s\S]*?)(?=\n\s*\w+:|$)|(.*(?:\n\s{2,}.*)*))/,
        );
        const roleSummary = roleMatch
          ? (roleMatch[1] || roleMatch[2] || '').replace(/\s+/g, ' ').trim() ||
            null
          : null;

        // Extract must_be_true list
        const mustBeTrue: string[] = [];
        const mbtMatch = fm.match(/must_be_true:\s*\n((?:\s*-\s*.+\n)*)/);
        if (mbtMatch) {
          const lines = mbtMatch[1].match(/^\s*-\s*(.+)$/gm);
          if (lines) {
            for (const line of lines) {
              const val = line.replace(/^\s*-\s*/, '').trim();
              if (val) mustBeTrue.push(val);
            }
          }
        }

        // Extract must_not_contain_concepts list
        const mustNotContain: string[] = [];
        const mncMatch = fm.match(
          /must_not_contain_concepts:\s*\n((?:\s*-\s*.+\n)*)/,
        );
        if (mncMatch) {
          const lines = mncMatch[1].match(/^\s*-\s*(.+)$/gm);
          if (lines) {
            for (const line of lines) {
              const val = line.replace(/^\s*-\s*/, '').trim();
              if (val) mustNotContain.push(val);
            }
          }
        }

        // Extract symptoms labels
        const symptoms: string[] = [];
        const sympMatches = fm.matchAll(/label:\s*(.+)/g);
        for (const m of sympMatches) {
          if (m[1]) symptoms.push(m[1].trim());
        }

        // Extract diagnostic tree
        const diagnosticTree: string[] = [];
        const dtMatches = fm.matchAll(/then:\s*(.+)/g);
        for (const m of dtMatches) {
          if (m[1]) diagnosticTree.push(m[1].trim().replace(/_/g, ' '));
        }

        return {
          roleSummary,
          mustBeTrue,
          mustNotContain,
          symptoms,
          diagnosticTree,
        };
      } catch {
        continue;
      }
    }

    return null;
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

  // ==========================================
  // Supplementary Doc Extraction for R4
  // ==========================================

  // ==========================================
  // Dynamic R4 Scoring from RAG data
  // ==========================================

  /**
   * Score RAG data quality on a 0-100 scale.
   * Uses the same flag logic as validateReferenceQuality but works on raw ragData
   * without needing a DB round-trip.
   *
   * Score mapping: raw 0-6 → 60-100 scale
   * 6/6=100, 5/6=92, 4/6=83, 3/6=75, 2/6=67, 1/6=62, 0/6=60
   */
  private scoreRagData(
    ragData: {
      roleSummary: string;
      mustBeTrue: string[];
      mustNotContain: string[];
      symptoms: string[];
      diagnosticTree?: unknown;
    },
    isNew: boolean,
  ): { score: number; flags: string[] } {
    const flags: string[] = [];

    // Blocking flags
    const definition = ragData.roleSummary || '';
    if (
      !definition ||
      definition.length < 300 ||
      /joue un r[oô]le essentiel/i.test(definition) ||
      /Son entretien r[eé]gulier garantit/i.test(definition)
    ) {
      flags.push('GENERIC_DEFINITION');
    }
    if (definition && !/\d/.test(definition)) {
      flags.push('NO_NUMBERS_IN_DEFINITION');
    }

    // Warning flags
    if (!ragData.mustBeTrue || ragData.mustBeTrue.length < 3) {
      flags.push('MISSING_REGLES_METIER');
    }
    if (!ragData.symptoms || ragData.symptoms.length === 0) {
      flags.push('MISSING_SYMPTOMS');
    }
    if (!ragData.mustNotContain || ragData.mustNotContain.length === 0) {
      flags.push('MISSING_CONFUSIONS');
    }

    // Raw score 0-6
    const blockingFlags = ['GENERIC_DEFINITION', 'NO_NUMBERS_IN_DEFINITION'];
    const blockingCount = flags.filter((f) => blockingFlags.includes(f)).length;
    const warningCount = flags.filter((f) => !blockingFlags.includes(f)).length;
    const rawScore = Math.max(0, 6 - blockingCount * 2 - warningCount);

    // Map to 60-100 scale
    const base = isNew ? 60 : 65;
    const mapped = base + Math.round((rawScore / 6) * (100 - base));
    const score = Math.min(100, Math.max(0, mapped));

    return { score, flags };
  }

  // ==========================================
  // Quality Gate — R4 Content Validation
  // ==========================================

  /**
   * Valide la qualité du contenu d'une référence R4
   * Retourne un score 0-6 et une liste de flags
   *
   * Flags BLOQUANTS (empêchent la publication) :
   * - GENERIC_DEFINITION : contenu placeholder
   * - NO_NUMBERS_IN_DEFINITION : pas de données chiffrées
   * - GENERIC_COMPOSITION : composition placeholder
   *
   * Flags WARNING :
   * - MISSING_ROLE_NEGATIF, MISSING_REGLES_METIER, MISSING_SCOPE
   * - MISSING_ACCENTS, TITLE_FORMAT
   */
  validateReferenceQuality(ref: SeoReference): ReferenceQualityResult {
    const flags: string[] = [];

    // --- BLOQUANTS ---

    // 1. Définition générique ou trop courte
    if (
      !ref.definition ||
      ref.definition.length < 300 ||
      /joue un r[oô]le essentiel/i.test(ref.definition) ||
      /Son entretien r[eé]gulier garantit/i.test(ref.definition)
    ) {
      flags.push('GENERIC_DEFINITION');
    }

    // 2. Pas de chiffres dans la définition
    if (ref.definition && !/\d/.test(ref.definition)) {
      flags.push('NO_NUMBERS_IN_DEFINITION');
    }

    // 3. Composition générique
    if (
      ref.composition &&
      ref.composition.some(
        (c) =>
          /^Composants principaux$/i.test(c) ||
          /^[EÉ]l[eé]ments d'assemblage$/i.test(c) ||
          /^Pi[eè]ces d'usure$/i.test(c),
      )
    ) {
      flags.push('GENERIC_COMPOSITION');
    }

    // --- WARNINGS ---

    // 4. Rôle négatif manquant
    if (!ref.roleNegatif || ref.roleNegatif.trim().length === 0) {
      flags.push('MISSING_ROLE_NEGATIF');
    }

    // 5. Règles métier insuffisantes
    if (!ref.reglesMetier || ref.reglesMetier.length < 3) {
      flags.push('MISSING_REGLES_METIER');
    }

    // 6. Scope manquant
    if (!ref.scopeLimites || ref.scopeLimites.trim().length === 0) {
      flags.push('MISSING_SCOPE');
    }

    // 7. Accents manquants dans la définition
    if (
      ref.definition &&
      /\b(vehicule|securite|systeme|fiabilite|regulier)\b/.test(ref.definition)
    ) {
      flags.push('MISSING_ACCENTS');
    }

    // 8. Format du titre
    if (!ref.title.includes(' : ') || !ref.title.includes('| Guide Auto')) {
      flags.push('TITLE_FORMAT');
    }

    // Score: 6 - nombre de flags bloquants
    const blockingFlags = [
      'GENERIC_DEFINITION',
      'NO_NUMBERS_IN_DEFINITION',
      'GENERIC_COMPOSITION',
    ];
    const blockingCount = flags.filter((f) => blockingFlags.includes(f)).length;
    const warningCount = flags.filter((f) => !blockingFlags.includes(f)).length;
    const score = Math.max(0, 6 - blockingCount * 2 - warningCount);

    return {
      score,
      flags,
      isPublishable: blockingCount === 0,
    };
  }

  /**
   * Audit bulk de toutes les références publiées
   * Retourne les stats et le détail par référence
   */
  async auditAllReferences(): Promise<ReferenceAuditResult> {
    const allRefs = await this.getAllFull();
    const details: ReferenceAuditDetail[] = allRefs.map((ref) => {
      const quality = this.validateReferenceQuality(ref);
      return {
        slug: ref.slug,
        title: ref.title,
        score: quality.score,
        flags: quality.flags,
        isPublishable: quality.isPublishable,
        definitionLength: ref.definition?.length || 0,
      };
    });

    const stubs = details.filter((d) => !d.isPublishable).length;
    const real = details.filter((d) => d.isPublishable).length;

    return {
      total: details.length,
      stubs,
      real,
      details: details.sort((a, b) => a.score - b.score),
    };
  }

  /**
   * Récupère TOUTES les références (publiées) avec les champs complets
   * Utilisé pour l'audit bulk
   */
  private async getAllFull(): Promise<SeoReference[]> {
    const { data, error } = await this.supabase
      .from('__seo_reference')
      .select('*')
      .eq('is_published', true)
      .order('slug');

    if (error || !data) {
      this.logger.error('❌ Error fetching all references for audit:', error);
      return [];
    }

    return data.map((row: any) => this.mapRowToReference(row));
  }
}

// ==========================================
// Quality Gate Types
// ==========================================

export interface ReferenceQualityResult {
  score: number;
  flags: string[];
  isPublishable: boolean;
}

export interface ReferenceAuditDetail {
  slug: string;
  title: string;
  score: number;
  flags: string[];
  isPublishable: boolean;
  definitionLength: number;
}

export interface ReferenceAuditResult {
  total: number;
  stubs: number;
  real: number;
  details: ReferenceAuditDetail[];
}
