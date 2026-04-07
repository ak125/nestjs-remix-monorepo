import { Injectable, Logger, Optional } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { ContentWriteGateService } from '../../../config/content-write-gate.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { RoleId } from '../../../config/role-ids';
import type { ResourceGroup } from '../../../config/execution-registry.types';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SITE_ORIGIN } from '../../../config/app.config';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';

// ── V4 Schema Types ──

interface V4CostRange {
  min: number;
  max: number;
  currency: string;
  unit: string;
  source?: string | null;
}

interface V4Symptom {
  id: string;
  label: string;
  severity: 'confort' | 'securite' | 'immobilisation';
}

interface V4Interval {
  value: string;
  unit: 'km' | 'mois' | 'condition';
  note: string;
  source?: string | null;
}

interface V4CrossGamme {
  slug: string;
  relation: string;
  context: string;
}

export interface ParsedRagDataV4 {
  version: 'v4';
  domain: {
    role: string | null;
    mustBeTrue: string[];
    mustNotContain: string[];
    confusionWith: { term: string; difference: string }[];
    relatedParts: string[];
    norms: string[];
    crossGammes: V4CrossGamme[];
  };
  selection: {
    criteria: string[];
    checklist: string[];
    antiMistakes: string[];
    costRange: V4CostRange | null;
    brands: {
      premium: string[];
      equivalent: string[];
      budget: string[];
    } | null;
  };
  diagnostic: {
    symptoms: V4Symptom[];
    causes: string[];
    quickChecks: string[];
    workshopChecks: string[];
    escalation: string | null;
    immediateReplace: string[];
  };
  maintenance: {
    interval: V4Interval | null;
    usageFactors: string[];
    goodPractices: string[];
    doNot: string[];
    wearSigns: string[];
  };
  installation: {
    difficulty: string;
    time: string;
    tools: string[];
    steps: string[];
    postChecks: string[];
    commonErrors: string[];
    proOnly: boolean;
  } | null;
  rendering: {
    pgId: string;
    introTitle: string;
    riskTitle: string;
    riskExplanation: string;
    riskConsequences: string[];
    riskConclusion: string;
    arguments: { title: string; icon: string; sourceRef: string | null }[];
    faq: { question: string; answer: string }[];
    schemaOrg: { type: string; sourceBloc: string }[];
    quality: { score: number; source: string; version: string };
  };
  sources: Record<string, { type: string; doc?: string | null; note?: string }>;
}

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
  private readonly RAG_GAMMES_DIR = `${RAG_KNOWLEDGE_PATH}/gammes`;

  constructor(
    rpcGate: RpcGateService,
    @Optional() private readonly writeGate?: ContentWriteGateService,
    @Optional() private readonly featureFlags?: FeatureFlagsService,
  ) {
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

      const relatedRefIds = (relatedDiags || []).map(
        (d: { id: string }) => d.id,
      );

      // 5. R4 Content Policy: contentHtml n'est plus assemble.
      // Les donnees (roleMecanique, reglesMetier, symptomes) sont stockees
      // dans les champs structures et rendues en Cards cote frontend.
      const contentHtml: string | null = null;

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

    // 2. Parse fresh RAG data — try v4 first, fallback to legacy
    const v4Data = this.parseRagGammeFileV4(pgAlias);
    const ragData = v4Data
      ? {
          // Convert v4 to legacy shape for backward-compatible DB write
          roleSummary: v4Data.domain.role,
          mustBeTrue: v4Data.domain.mustBeTrue,
          mustNotContain: v4Data.domain.mustNotContain,
          symptoms: v4Data.diagnostic.symptoms.map((s) => s.label),
          diagnosticTree: [],
        }
      : this.parseRagGammeFile(pgAlias);
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

    // 4. R4 Content Policy: contentHtml n'est plus assemble.
    // Les donnees structurees (roleMecanique, reglesMetier, symptomes) sont rendues
    // en Cards cote frontend. Les sections Installation/Procedure sont du contenu R3
    // interdit sur R4.
    const contentHtml: string | null = null;

    // v4: Build richer confusions_courantes from confusion_with objects
    const confusionsCourantes =
      v4Data && v4Data.domain.confusionWith.length > 0
        ? v4Data.domain.confusionWith.map((c) => `${c.term} : ${c.difference}`)
        : ragData.mustNotContain.length > 0
          ? ragData.mustNotContain
          : null;

    // v4: Build composition from related_parts
    const composition =
      v4Data && v4Data.domain.relatedParts.length > 0
        ? v4Data.domain.relatedParts
        : null;

    if (existing) {
      // 5a. Update existing entry — refresh content but keep is_published
      const refPayload = {
        role_mecanique: ragData.roleSummary || undefined,
        confusions_courantes: confusionsCourantes || undefined,
        symptomes_associes:
          ragData.symptoms.length > 0 ? ragData.symptoms : undefined,
        regles_metier:
          ragData.mustBeTrue.length > 0 ? ragData.mustBeTrue : undefined,
        composition: composition || undefined,
        content_html: contentHtml,
        updated_at: new Date().toISOString(),
      };

      // ── P1.5 v2.1: Route through WriteGate (merge + anti-regression) ──
      if (this.writeGate && this.featureFlags?.writeGuardEnabled) {
        const result = await this.writeGate.writeToTarget({
          roleId: RoleId.R4_REFERENCE,
          target: 'r4_reference_main' as ResourceGroup,
          pkValue: existing.id,
          payload: refPayload,
          correlationId: `r4-ref-${pgAlias}-${Date.now().toString(36)}`,
        });
        if (!result.written) {
          this.logger.warn(
            `WriteGate blocked R4 update for ${pgAlias}: ${result.reason}`,
          );
          return { created: false, updated: false, skipped: true };
        }
      } else {
        // Legacy path
        const { error } = await this.supabase
          .from('__seo_reference')
          .update(refPayload)
          .eq('id', existing.id);

        if (error) {
          this.logger.error(
            `Failed to update reference ${pgAlias}: ${error.message}`,
          );
          return { created: false, updated: false, skipped: false };
        }
      }

      this.logger.log(`Updated R4 reference for: ${pgAlias}`);
      const quality = v4Data
        ? this.scoreRagDataV4(v4Data)
        : this.scoreRagData(ragData, false);

      // 6. Write v4 data to purchase guide if available
      if (v4Data) {
        await this.writeV4ToPurchaseGuide(
          v4Data,
          gamme.id,
          pgAlias,
          quality.score,
        );
      }

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
        confusions_courantes: confusionsCourantes,
        symptomes_associes:
          ragData.symptoms.length > 0 ? ragData.symptoms : null,
        regles_metier:
          ragData.mustBeTrue.length > 0 ? ragData.mustBeTrue : null,
        composition: composition,
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
    const quality = v4Data
      ? this.scoreRagDataV4(v4Data)
      : this.scoreRagData(ragData, true);

    // 6. Write v4 data to purchase guide if available
    if (v4Data) {
      await this.writeV4ToPurchaseGuide(
        v4Data,
        gamme.id,
        pgAlias,
        quality.score,
      );
    }

    return {
      created: true,
      updated: false,
      skipped: false,
      qualityScore: quality.score,
      qualityFlags: quality.flags,
    };
  }

  /**
   * Write v4 parsed data to __seo_gamme_purchase_guide (UPSERT)
   */
  private async writeV4ToPurchaseGuide(
    v4Data: ParsedRagDataV4,
    pgId: number,
    pgAlias: string,
    score: number,
  ): Promise<void> {
    const args = v4Data.rendering.arguments || [];
    const interval = v4Data.maintenance.interval;
    const costRange = v4Data.selection.costRange;

    const row: Record<string, unknown> = {
      sgpg_pg_id: String(pgId),
      sgpg_intro_title: v4Data.rendering.introTitle || null,
      sgpg_intro_role: v4Data.domain.role || null,
      sgpg_intro_sync_parts:
        v4Data.domain.crossGammes.length > 0
          ? v4Data.domain.crossGammes.map((cg) => cg.slug)
          : v4Data.domain.relatedParts.length > 0
            ? v4Data.domain.relatedParts
            : null,
      sgpg_how_to_choose:
        v4Data.selection.criteria.length > 0
          ? v4Data.selection.criteria.map((c) => `• ${c}`).join('\n')
          : null,
      sgpg_anti_mistakes:
        v4Data.selection.antiMistakes.length > 0
          ? v4Data.selection.antiMistakes
          : null,
      sgpg_selection_criteria: {
        criteria: v4Data.selection.criteria,
        checklist: v4Data.selection.checklist,
        cross_gammes: v4Data.domain.crossGammes,
      },
      sgpg_symptoms:
        v4Data.diagnostic.symptoms.length > 0
          ? v4Data.diagnostic.symptoms.map((s) => s.label)
          : null,
      sgpg_faq: v4Data.rendering.faq.length > 0 ? v4Data.rendering.faq : null,
      sgpg_risk_title: v4Data.rendering.riskTitle || null,
      sgpg_risk_explanation: v4Data.rendering.riskExplanation || null,
      sgpg_risk_consequences:
        v4Data.rendering.riskConsequences.length > 0
          ? v4Data.rendering.riskConsequences
          : null,
      sgpg_risk_cost_range: costRange
        ? `${costRange.min}-${costRange.max} ${costRange.currency} (${costRange.unit})`
        : null,
      sgpg_risk_conclusion: v4Data.rendering.riskConclusion || null,
      sgpg_timing_km:
        interval && interval.unit === 'km' ? `${interval.value} km` : null,
      sgpg_timing_years:
        interval && interval.unit === 'mois' ? `${interval.value} mois` : null,
      sgpg_timing_note: interval?.note || null,
      sgpg_arg1_title: args[0]?.title || null,
      sgpg_arg1_content: args[0]?.title || null,
      sgpg_arg1_icon: args[0]?.icon || null,
      sgpg_arg2_title: args[1]?.title || null,
      sgpg_arg2_content: args[1]?.title || null,
      sgpg_arg2_icon: args[1]?.icon || null,
      sgpg_arg3_title: args[2]?.title || null,
      sgpg_arg3_content: args[2]?.title || null,
      sgpg_arg3_icon: args[2]?.icon || null,
      sgpg_arg4_title: args[3]?.title || null,
      sgpg_arg4_content: args[3]?.title || null,
      sgpg_arg4_icon: args[3]?.icon || null,
      sgpg_source_type: 'rag',
      sgpg_source_uri: `rag://gammes.${pgAlias}`,
      sgpg_source_ref: `v4-pipeline/${new Date().toISOString().slice(0, 10)}`,
      sgpg_is_draft: score < 85,
      sgpg_updated_at: new Date().toISOString(),
    };

    // ── P1.5 v2.1: Route through WriteGate (merge intelligent, anti-regression) ──
    if (this.writeGate && this.featureFlags?.writeGuardEnabled) {
      const result = await this.writeGate.writeToTarget({
        roleId: RoleId.R4_REFERENCE,
        target: 'purchase_guide_main' as ResourceGroup,
        pkValue: pgId,
        payload: row,
        correlationId: `r4-pg-${pgAlias}-${Date.now().toString(36)}`,
      });
      this.logger.log(
        `Purchase guide via WriteGate for ${pgAlias}: written=${result.written} ` +
          `fields=${result.fieldsWritten.length} skipped=${result.fieldsSkipped.length} stripped=${result.fieldsStripped.length}`,
      );
    } else {
      // Legacy path — UPSERT: try update first, insert if not found
      const { data: existing } = await this.supabase
        .from('__seo_gamme_purchase_guide')
        .select('sgpg_id')
        .eq('sgpg_pg_id', String(pgId))
        .single();

      if (existing) {
        const { error } = await this.supabase
          .from('__seo_gamme_purchase_guide')
          .update(row)
          .eq('sgpg_id', existing.sgpg_id);

        if (error) {
          this.logger.error(
            `Failed to update purchase guide for ${pgAlias}: ${error.message}`,
          );
        } else {
          this.logger.log(`Updated purchase guide (v4) for: ${pgAlias}`);
        }
      } else {
        const { error } = await this.supabase
          .from('__seo_gamme_purchase_guide')
          .insert(row);

        if (error) {
          this.logger.error(
            `Failed to create purchase guide for ${pgAlias}: ${error.message}`,
          );
        } else {
          this.logger.log(`Created purchase guide (v4) for: ${pgAlias}`);
        }
      }
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
  // V4 Schema Parser + Scorer
  // ==========================================

  /**
   * Parse a v4 gamme.md file using proper YAML parsing.
   * Returns null if file not found or not v4.
   */
  private parseRagGammeFileV4(pgAlias: string): ParsedRagDataV4 | null {
    const candidates = [`${pgAlias}.md`, `${pgAlias.replace(/-/g, ' ')}.md`];

    for (const filename of candidates) {
      const filePath = path.join(this.RAG_GAMMES_DIR, filename);
      try {
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, 'utf-8');

        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) return null;

        const fm: Record<string, unknown> = yaml.load(fmMatch[1]) as Record<
          string,
          unknown
        >;
        if (!fm) return null;

        // Detect v4 by quality.version or rendering.quality.version
        const rendering = (fm.rendering || {}) as Record<string, unknown>;
        const pageContract = (fm.page_contract || {}) as Record<
          string,
          unknown
        >;
        const fmQuality = (fm.quality || {}) as Record<string, unknown>;
        const qualityVersion =
          (rendering.quality as Record<string, unknown>)?.version ||
          (pageContract.quality as Record<string, unknown>)?.version ||
          fmQuality.version;
        if (qualityVersion !== 'GammeContentContract.v4') return null;

        // Parse domain (Bloc A)
        const domain = (fm.domain || {}) as Record<string, unknown>;
        const parsedDomain = {
          role: (domain.role as string) || null,
          mustBeTrue: (domain.must_be_true as string[]) || [],
          mustNotContain: (domain.must_not_contain as string[]) || [],
          confusionWith: (
            (domain.confusion_with as Array<Record<string, unknown>>) || []
          ).map((c: Record<string, unknown>) => ({
            term: (c.term as string) || '',
            difference: (c.difference as string) || '',
          })),
          relatedParts: (domain.related_parts as string[]) || [],
          norms: (domain.norms as string[]) || [],
          crossGammes: (
            (domain.cross_gammes as Array<Record<string, unknown>>) || []
          ).map((cg: Record<string, unknown>) => ({
            slug: (cg.slug as string) || '',
            relation: (cg.relation as string) || '',
            context: (cg.context as string) || '',
          })),
        };

        // Parse selection (Bloc B)
        const sel = (fm.selection || {}) as Record<string, unknown>;
        const costRangeRaw = sel.cost_range as
          | Record<string, unknown>
          | undefined;
        const costRange = costRangeRaw
          ? {
              min: (costRangeRaw.min as number) ?? 0,
              max: (costRangeRaw.max as number) ?? 0,
              currency: (costRangeRaw.currency as string) || 'EUR',
              unit: (costRangeRaw.unit as string) || '',
              source: (costRangeRaw.source as string) || null,
            }
          : null;
        const brandsRaw = sel.brands as Record<string, unknown> | undefined;
        const parsedSelection = {
          criteria: (sel.criteria as string[]) || [],
          checklist: (sel.checklist as string[]) || [],
          antiMistakes: (sel.anti_mistakes as string[]) || [],
          costRange,
          brands: brandsRaw
            ? {
                premium: (brandsRaw.premium as string[]) || [],
                equivalent: (brandsRaw.equivalent as string[]) || [],
                budget: (brandsRaw.budget as string[]) || [],
              }
            : null,
        };

        // Parse diagnostic (Bloc C)
        const diag = (fm.diagnostic || {}) as Record<string, unknown>;
        const parsedDiagnostic = {
          symptoms: (
            (diag.symptoms as Array<Record<string, unknown>>) || []
          ).map((s: Record<string, unknown>) => ({
            id: (s.id as string) || '',
            label: (s.label as string) || '',
            severity: (s.severity as V4Symptom['severity']) || 'confort',
          })),
          causes: (diag.causes as string[]) || [],
          quickChecks: (diag.quick_checks as string[]) || [],
          workshopChecks: (diag.workshop_checks as string[]) || [],
          escalation: (diag.escalation as string) || null,
          immediateReplace: (diag.immediate_replace as string[]) || [],
        };

        // Parse maintenance (Bloc D)
        const maint = (fm.maintenance || {}) as Record<string, unknown>;
        const intervalRaw = maint.interval as
          | Record<string, unknown>
          | undefined;
        const interval = intervalRaw
          ? {
              value: (intervalRaw.value as string) || '',
              unit: (intervalRaw.unit as V4Interval['unit']) || 'km',
              note: (intervalRaw.note as string) || '',
              source: (intervalRaw.source as string) || null,
            }
          : null;
        const parsedMaintenance = {
          interval,
          usageFactors: (maint.usage_factors as string[]) || [],
          goodPractices: (maint.good_practices as string[]) || [],
          doNot: (maint.do_not as string[]) || [],
          wearSigns: (maint.wear_signs as string[]) || [],
        };

        // Parse installation (Bloc E) — optional
        const inst = fm.installation as Record<string, unknown> | undefined;
        const parsedInstallation = inst
          ? {
              difficulty: (inst.difficulty as string) || 'moyen',
              time: (inst.time as string) || '',
              tools: (inst.tools as string[]) || [],
              steps: (inst.steps as string[]) || [],
              postChecks: (inst.post_checks as string[]) || [],
              commonErrors: (inst.common_errors as string[]) || [],
              proOnly: inst.pro_only === true,
            }
          : null;

        // Parse rendering
        const rend = (fm.rendering || {}) as Record<string, unknown>;
        const rendQuality = (rend.quality || {}) as Record<string, unknown>;
        const parsedRendering = {
          pgId: (rend.pgId as string) || '',
          introTitle: (rend.intro_title as string) || '',
          riskTitle: (rend.risk_title as string) || '',
          riskExplanation: (rend.risk_explanation as string) || '',
          riskConsequences: (rend.risk_consequences as string[]) || [],
          riskConclusion: (rend.risk_conclusion as string) || '',
          arguments: (
            (rend.arguments as Array<Record<string, unknown>>) || []
          ).map((a: Record<string, unknown>) => ({
            title: (a.title as string) || '',
            icon: (a.icon as string) || '',
            sourceRef: (a.source_ref as string) || null,
          })),
          faq: ((rend.faq as Array<Record<string, unknown>>) || []).map(
            (f: Record<string, unknown>) => ({
              question: (f.question as string) || '',
              answer: (f.answer as string) || '',
            }),
          ),
          schemaOrg: (
            (rend.schema_org as Array<Record<string, unknown>>) || []
          ).map((s: Record<string, unknown>) => ({
            type: (s.type as string) || '',
            sourceBloc: (s.source_bloc as string) || '',
          })),
          quality: {
            score: (rendQuality.score as number) ?? 0,
            source: (rendQuality.source as string) || '',
            version:
              (rendQuality.version as string) || 'GammeContentContract.v4',
          },
        };

        // Parse _sources
        const sources: Record<
          string,
          { type: string; doc?: string | null; note?: string }
        > = {};
        if (fm._sources) {
          for (const [key, val] of Object.entries(
            fm._sources as Record<string, Record<string, unknown>>,
          )) {
            sources[key] = {
              type: (val.type as string) || '',
              doc: (val.doc as string) || null,
              note: (val.note as string) || '',
            };
          }
        }

        return {
          version: 'v4',
          domain: parsedDomain,
          selection: parsedSelection,
          diagnostic: parsedDiagnostic,
          maintenance: parsedMaintenance,
          installation: parsedInstallation,
          rendering: parsedRendering,
          sources,
        };
      } catch (err) {
        this.logger.warn(`Failed to parse v4 for ${pgAlias}: ${err}`);
        continue;
      }
    }

    return null;
  }

  /**
   * Score v4 gamme data. Non-linear: BLOCK=-10, WARN=-3, BONUS=+2/+3/+5.
   * Score 0-100 (no artificial floor).
   */
  private scoreRagDataV4(data: ParsedRagDataV4): {
    score: number;
    flags: string[];
  } {
    const flags: string[] = [];
    let penalties = 0;
    let bonuses = 0;

    // ── Bloc A: Domain ──
    const role = data.domain.role || '';
    const genericPatterns = [
      /joue un r[oô]le essentiel/i,
      /Son entretien r[eé]gulier garantit/i,
      /assure le bon fonctionnement/i,
      /permet de garantir/i,
      /est un [eé]l[eé]ment (essentiel|important|cl[eé])/i,
    ];
    if (
      !role ||
      role.length < 80 ||
      genericPatterns.some((p) => p.test(role))
    ) {
      flags.push('GENERIC_DEFINITION');
      penalties += 10;
    }
    if (data.domain.confusionWith.length < 2) {
      flags.push('MISSING_CONFUSIONS');
      penalties += 3;
    }
    if (data.domain.mustBeTrue.length < 2) {
      flags.push('MISSING_REGLES_METIER');
      penalties += 3;
    }

    // ── Bloc B: Selection ──
    if (data.selection.criteria.length < 3) {
      flags.push('THIN_SELECTION');
      penalties += 3;
    }
    if (data.selection.costRange) {
      const cr = data.selection.costRange;
      if (cr.max > 10 * cr.min && cr.min > 0) {
        flags.push('SUSPECT_PRICE_RANGE');
        penalties += 10;
      }
    } else {
      flags.push('MISSING_COST_RANGE');
      penalties += 10;
    }
    if (data.selection.antiMistakes.length < 3) {
      flags.push('THIN_ANTI_MISTAKES');
      penalties += 3;
    }
    if (data.selection.checklist.length < 3) {
      flags.push('THIN_CHECKLIST');
      penalties += 3;
    }

    // ── Bloc C: Diagnostic ──
    if (data.diagnostic.symptoms.length < 3) {
      flags.push('INSUFFICIENT_SYMPTOMS');
      penalties += 3;
    }
    if (data.diagnostic.causes.length < 2) {
      flags.push('MISSING_CAUSES');
      penalties += 3;
    }
    if (data.diagnostic.quickChecks.length < 2) {
      flags.push('MISSING_QUICK_CHECKS');
      penalties += 3;
    }

    // ── Bloc D: Maintenance ──
    if (!data.maintenance.interval || !data.maintenance.interval.note) {
      flags.push('MISSING_INTERVAL');
      penalties += 3;
    }
    if (
      data.maintenance.interval &&
      data.maintenance.interval.unit !== 'km' &&
      data.maintenance.usageFactors.length === 0
    ) {
      flags.push('MISSING_USAGE_FACTORS');
      penalties += 3;
    }

    // ── Bloc E: Installation (BONUS) ──
    if (data.installation && data.installation.steps.length >= 3) {
      bonuses += 5;
    }

    // ── Rendering ──
    // Check for unsourced claims in arguments
    const hasUnsourcedClaim = data.rendering.arguments.some((arg) => {
      const hasNumber = /\d/.test(arg.title);
      return hasNumber && !arg.sourceRef;
    });
    if (hasUnsourcedClaim) {
      flags.push('UNSOURCED_CLAIM');
      penalties += 10;
    }
    if (data.rendering.faq.length < 4) {
      flags.push('THIN_FAQ');
      penalties += 3;
    }

    // ── Cross-gamme (BONUS) ──
    if (data.domain.crossGammes.length >= 1) {
      bonuses += 3;
    }

    // ── Provenance (BONUS) ──
    if (Object.keys(data.sources).length >= 1) {
      bonuses += 2;
    }

    const score = Math.max(0, Math.min(100, 100 - penalties + bonuses));
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
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (R4_FORBIDDEN.some((term) => allText.includes(term))) {
      flags.push('R4_CONTAMINATED');
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

    // Persist contamination flags in DB (Phase 5B)
    const PERSIST_FLAGS = ['R4_CONTAMINATED', 'RULES_ARE_KEYWORDS'];
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
