import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
import { SITE_ORIGIN } from '../../../config/app.config';
import {
  isBareSlug,
  filterOffFamilyParts,
  detectOffFamilyArtifacts,
} from './r4-family-guard';

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
  pgImg: string | null;
  relatedReferences: number[] | null;
  blogSlugs: string[] | null;
  canonicalUrl: string | null;
  takeaways: string[] | null;
  synonyms: string[] | null;
  variants: { name: string; description: string }[] | null;
  keySpecs:
    | { label: string; value: string; note?: string; source?: string }[]
    | null;
  commonQuestions: { q: string; a: string }[] | null;
  contaminationFlags: string[] | null;
  sectionOverrides: Record<string, string> | null;
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
    const { data, error } = await this.callRpc<Array<Record<string, unknown>>>(
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
   * R4→R3 consolidation redirect target (mirror des patterns R5 et R6 #925).
   * Auto-gaté : retourne une cible UNIQUEMENT si la référence est liée à une
   * gamme (pg_id) dont l'article R3 conseils existe — sinon null et la page
   * R4 standalone continue de servir (jamais de redirect-vers-404).
   * Inerte tant que SEO_R4_CONSOLIDATION_ENABLED=false (défaut).
   */
  async getRedirectTarget(
    slug: string,
  ): Promise<{ redirect_to: string; pg_alias: string } | null> {
    if (!this.featureFlags?.seoR4ConsolidationEnabled) return null;

    const { data: ref } = await this.supabase
      .from('__seo_reference')
      .select('pg_id')
      .eq('slug', slug)
      .eq('is_published', true)
      .single();
    if (!ref?.pg_id) return null;

    // Self-gate : ne rediriger que si la page R3 de la gamme existe
    // (ba_pg_id est TEXT legacy — comparaison via chaîne).
    const { data: advice } = await this.supabase
      .from('__blog_advice')
      .select('ba_pg_id')
      .eq('ba_pg_id', String(ref.pg_id))
      .limit(1)
      .single();
    if (!advice) return null;

    const { data: gamme } = await this.supabase
      .from('pieces_gamme')
      .select('pg_alias')
      .eq('pg_id', ref.pg_id)
      .single();
    if (!gamme?.pg_alias) return null;

    return {
      redirect_to: `/blog-pieces-auto/conseils/${gamme.pg_alias}`,
      pg_alias: gamme.pg_alias as string,
    };
  }

  /**
   * Récupère toutes les références publiées
   * @returns Liste des références (version légère)
   */
  async getAll(): Promise<SeoReferenceListItem[]> {
    this.logger.debug('📚 Fetching all references');

    // 🛡️ RPC Safety Gate
    const { data, error } = await this.callRpc<Array<Record<string, unknown>>>(
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
        url: `${SITE_ORIGIN}/reference-auto`,
      },
      url: `${SITE_ORIGIN}/reference-auto/${ref.slug}`,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // R4 cross-family guard helpers — pure logic lives in ./r4-family-guard.ts.
  // Family key = mf_id (catalog_family) resolved via __seo_family_gamme_car_switch.
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Memoized pg_id → mf_id (catalog family) map. ~104 gammes are mapped; the rest
   * resolve to UNKNOWN and are therefore never dropped/flagged by the guard.
   * Paginated read (sfgcs has ~3790 rows, up to 295/pg → a plain `.in()` would hit
   * the supabase-js 1000-row cap), first mf_id per gamme wins.
   */
  private r4GammeFamilyMap: Map<string, number> | null = null;

  private async getGammeFamilyMap(): Promise<Map<string, number>> {
    if (this.r4GammeFamilyMap) return this.r4GammeFamilyMap;
    const map = new Map<string, number>();
    const PAGE = 1000;
    for (let from = 0; from < 100_000; from += PAGE) {
      const { data, error } = await this.supabase
        .from('__seo_family_gamme_car_switch')
        .select('sfgcs_pg_id, sfgcs_mf_id')
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      for (const row of data as Array<{
        sfgcs_pg_id: string | number;
        sfgcs_mf_id: string | number;
      }>) {
        const pid = String(row.sfgcs_pg_id);
        if (!map.has(pid)) map.set(pid, Number(row.sfgcs_mf_id));
      }
      if (data.length < PAGE) break;
    }
    this.r4GammeFamilyMap = map;
    return map;
  }

  /**
   * Resolve bare-slug → mf_id for the given entries (slug → pg_id via pieces_gamme,
   * pg_id → mf_id via the family map). Non bare-slug / unmapped entries are absent.
   */
  private async resolveSlugFamilies(
    entries: readonly string[],
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const bare = [
      ...new Set(
        entries.filter((s) => isBareSlug(s)).map((s) => s.trim().toLowerCase()),
      ),
    ];
    if (bare.length === 0) return out;
    const famMap = await this.getGammeFamilyMap();
    const slugToPgId = new Map<string, string>();
    for (let i = 0; i < bare.length; i += 200) {
      const { data } = await this.supabase
        .from('pieces_gamme')
        .select('pg_id, pg_alias')
        .in('pg_alias', bare.slice(i, i + 200));
      for (const g of (data ?? []) as Array<{
        pg_id: string | number;
        pg_alias: string;
      }>) {
        slugToPgId.set(String(g.pg_alias).toLowerCase(), String(g.pg_id));
      }
    }
    for (const [slug, pgId] of slugToPgId) {
      const mf = famMap.get(pgId);
      if (mf != null) out.set(slug, mf);
    }
    return out;
  }

  /**
   * Drop related_parts that belong to another family (mf_id) before write.
   * Returns the kept list (null if empty). Dropped items are logged — never silent.
   * Fail-safe: on any resolution error the raw list is kept (content is never lost).
   * Public: reused as-is by SeoGeneratorService.buildR4FromRag (2nd R4 writer) — same filter,
   * no duplicated resolution logic, no behaviour change to this primary writer.
   */
  async filterCompositionByFamily(
    pgAlias: string,
    targetPgId: number,
    parts: string[] | null,
  ): Promise<string[] | null> {
    if (!parts || parts.length === 0) return parts;
    try {
      const famMap = await this.getGammeFamilyMap();
      const targetMfId = famMap.get(String(targetPgId)) ?? null;
      if (targetMfId == null) return parts; // unmapped gamme → cannot judge → keep
      const slugToMfId = await this.resolveSlugFamilies(parts);
      const { kept, dropped } = filterOffFamilyParts(
        parts,
        targetMfId,
        slugToMfId,
      );
      if (dropped.length > 0) {
        this.logger.warn(
          `R4 family guard: dropped ${dropped.length} off-family related_parts from "${pgAlias}" (mf_id ${targetMfId}): ${dropped.join(', ')}`,
        );
      }
      return kept.length > 0 ? kept : null;
    } catch (e) {
      this.logger.warn(
        `R4 family guard skipped for "${pgAlias}" (resolution error, content kept): ${(e as Error).message}`,
      );
      return parts;
    }
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
      pgImg: row.pg_img as string | null,
      relatedReferences: row.related_references as number[] | null,
      blogSlugs: row.blog_slugs as string[] | null,
      canonicalUrl: row.canonical_url as string | null,
      takeaways: row.takeaways as string[] | null,
      synonyms: row.synonyms as string[] | null,
      variants: row.variants as { name: string; description: string }[] | null,
      keySpecs: row.key_specs as
        | { label: string; value: string; note?: string; source?: string }[]
        | null,
      commonQuestions: row.common_questions as
        | { q: string; a: string }[]
        | null,
      contaminationFlags: row.contamination_flags as string[] | null,
      sectionOverrides: row.section_overrides as Record<string, string> | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
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
  validateReferenceQuality(
    ref: SeoReference,
    familyCtx?: {
      targetMfId: number | null;
      slugToMfId: ReadonlyMap<string, number>;
    },
  ): ReferenceQualityResult {
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

    // --- R4 PROOF PACK GATES (Phase 5B) ---

    // 9. Contamination R4 : termes R3/R5 dans les champs texte
    const R4_FORBIDDEN = [
      'installation',
      'procédure',
      'outils nécessaires',
      'temps estimé',
      'difficulté',
      'rodage',
      'erreurs de montage',
      'vérifications post-montage',
    ];
    const allText = [
      ref.definition,
      ref.roleMecanique,
      ref.roleNegatif,
      ref.scopeLimites,
      ref.contentHtml,
      ...(ref.composition || []),
      ...(ref.reglesMetier || []),
      ...(ref.confusionsCourantes || []),
      ...(ref.symptomesAssocies || []),
      ...(ref.takeaways || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (R4_FORBIDDEN.some((term) => allText.includes(term))) {
      flags.push('R4_CONTAMINATED');
    }

    // 9b. Cross-FAMILY contamination: related-part slugs that belong to another
    // product family (e.g. electrical slugs in a brake reference). Family-aware via
    // mf_id (catalog_family), no denylist. Only runs when a family context is supplied
    // (auditAllReferences); skipped otherwise to keep backward-compatible callers pure.
    if (familyCtx) {
      const offFamily = detectOffFamilyArtifacts(
        [
          ref.composition,
          ref.symptomesAssocies,
          ref.confusionsCourantes,
          ref.takeaways,
        ],
        familyCtx.targetMfId,
        familyCtx.slugToMfId,
      );
      if (offFamily.length > 0) {
        flags.push('R4_OFF_GAMME');
      }
    }

    // 10. Règles métier = mots-clés au lieu de phrases
    if (ref.reglesMetier && ref.reglesMetier.length > 0) {
      const keywordRules = ref.reglesMetier.filter(
        (r) => r.split(/\s+/).length < 5,
      );
      if (keywordRules.length > ref.reglesMetier.length * 0.5) {
        flags.push('RULES_ARE_KEYWORDS');
      }
    }

    // 11. Pas de "À retenir" (takeaways)
    if (!ref.takeaways || ref.takeaways.length < 2) {
      flags.push('MISSING_TAKEAWAYS');
    }

    // 12. Pas de FAQ structurée
    if (!ref.commonQuestions || ref.commonQuestions.length === 0) {
      flags.push('MISSING_FAQ');
    }

    // Score: 6 - nombre de flags bloquants
    const blockingFlags = [
      'GENERIC_DEFINITION',
      'NO_NUMBERS_IN_DEFINITION',
      'GENERIC_COMPOSITION',
      'R4_CONTAMINATED',
      'R4_OFF_GAMME',
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

    // Pre-resolve the family context once for cross-family (R4_OFF_GAMME) detection:
    // pg_id → mf_id map + bare-slug → mf_id for every slug appearing in any ref array.
    const famMap = await this.getGammeFamilyMap();
    const allSlugs = new Set<string>();
    for (const ref of allRefs) {
      for (const arr of [
        ref.composition,
        ref.symptomesAssocies,
        ref.confusionsCourantes,
        ref.takeaways,
      ]) {
        for (const v of arr ?? []) {
          if (isBareSlug(v)) allSlugs.add(v.trim().toLowerCase());
        }
      }
    }
    const slugToMfId = await this.resolveSlugFamilies([...allSlugs]);

    const details: ReferenceAuditDetail[] = allRefs.map((ref) => {
      const familyCtx = {
        targetMfId:
          ref.pgId != null ? (famMap.get(String(ref.pgId)) ?? null) : null,
        slugToMfId,
      };
      const quality = this.validateReferenceQuality(ref, familyCtx);
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

    // Persist contamination flags in DB (Phase 5B)
    const PERSIST_FLAGS = [
      'R4_CONTAMINATED',
      'RULES_ARE_KEYWORDS',
      'R4_OFF_GAMME',
    ];
    for (const ref of allRefs) {
      const detail = details.find((d) => d.slug === ref.slug);
      if (!detail) continue;

      const newFlags = detail.flags
        .filter((f) => PERSIST_FLAGS.includes(f))
        .sort();
      const currentFlags = (ref.contaminationFlags || []).sort();

      if (JSON.stringify(newFlags) !== JSON.stringify(currentFlags)) {
        await this.supabase
          .from('__seo_reference')
          .update({
            contamination_flags: newFlags.length > 0 ? newFlags : null,
          })
          .eq('id', ref.id);
      }
    }

    // R4 Health stats (Phase 5B)
    const r4Health = {
      contaminated: details.filter((d) => d.flags.includes('R4_CONTAMINATED'))
        .length,
      missingFaq: details.filter((d) => d.flags.includes('MISSING_FAQ')).length,
      missingTakeaways: details.filter((d) =>
        d.flags.includes('MISSING_TAKEAWAYS'),
      ).length,
      rulesAreKeywords: details.filter((d) =>
        d.flags.includes('RULES_ARE_KEYWORDS'),
      ).length,
      avgScore:
        details.length > 0
          ? +(
              details.reduce((sum, d) => sum + d.score, 0) / details.length
            ).toFixed(1)
          : 0,
    };

    return {
      total: details.length,
      stubs,
      real,
      r4Health,
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

    return data.map((row: Record<string, unknown>) =>
      this.mapRowToReference(row),
    );
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

export interface R4HealthStats {
  contaminated: number;
  missingFaq: number;
  missingTakeaways: number;
  rulesAreKeywords: number;
  avgScore: number;
}

export interface ReferenceAuditResult {
  total: number;
  stubs: number;
  real: number;
  r4Health: R4HealthStats;
  details: ReferenceAuditDetail[];
}
