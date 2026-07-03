import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';

// Import du service de validation qualité
import {
  QualityValidatorService,
  type VLevel,
  type ValidationResult,
} from '../validation/quality-validator.service';

/**
 * Interface pour une R4 générée
 */
export interface GeneratedR4 {
  slug: string;
  title: string;
  meta_description: string;
  definition: string;
  role_mecanique: string | null;
  role_negatif: string | null;
  composition: string[] | null;
  confusions_courantes: string[] | null;
  symptomes_associes: string[] | null;
  regles_metier: string[] | null;
  content_html: string | null;
  pg_id: number;
  /** Schema.org JSON-LD */
  schema_org?: object;
  /** Score de qualité (0-100) */
  quality_score?: number;
  /** V-Level (L1-L5) */
  v_level?: VLevel;
}

/**
 * Interface pour une R5 générée
 */
export interface GeneratedR5 {
  slug: string;
  title: string;
  meta_description: string;
  observable_type: 'symptom' | 'sign' | 'dtc';
  perception_channel: string;
  risk_level: 'confort' | 'securite' | 'critique';
  safety_gate: 'none' | 'warning' | 'stop_soon' | 'stop_immediate';
  symptom_description: string;
  sign_description: string | null;
  cluster_id: string;
  related_gammes: number[];
  related_references: string[];
  /** Schema.org JSON-LD */
  schema_org?: object;
  /** Score de qualité (0-100) */
  quality_score?: number;
}

/**
 * Interface pour le résultat de génération
 */
export interface GenerateResult {
  r4: GeneratedR4 | null;
  r5: GeneratedR5[];
  sourcesUsed: string[];
  keywordsMatched: string[];
  errors: string[];
  /** Score de qualité global (0-100) */
  qualityScore?: number;
  /** V-Level calculé depuis le volume de recherche */
  vLevel?: VLevel;
  /** Résultat de validation (mots interdits) */
  validation?: ValidationResult;
}

// @role-purity-skip
// Multi-role generator: produces R4 Reference AND R5 Diagnostics (saveR4Draft / saveR5Draft);
// its docstring legitimately names both roles. Not single-role content.
/**
 * Service de génération de contenu SEO (R4 Reference / R5 Diagnostics) depuis la DB.
 *
 * ADR-031/046 (programme rag-purge) : la génération depuis le corpus RAG
 * (`RAG_KNOWLEDGE_PATH/gammes/*.md`) a été **retirée** — RAG = retrieval chatbot
 * only, jamais source de contenu/SEO. La source de contenu est la DB interne
 * (puis la projection WIKI, ADR-059). Les méthodes `buildR4FromRag`/`buildR5FromRag`,
 * l'enrichissement LLM du RAG et le listing des fichiers RAG ont été supprimés.
 */
@Injectable()
export class SeoGeneratorService {
  private readonly logger = new Logger(SeoGeneratorService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly qualityValidator?: QualityValidatorService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const supabaseKey = getEffectiveSupabaseKey();

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        'SeoGeneratorService: SUPABASE_URL ou clé Supabase manquant — service will fail on first call',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Détermine le V-Level depuis le volume de recherche
   */
  getVLevel(searchVolume: number): VLevel {
    if (this.qualityValidator) {
      return this.qualityValidator.getVLevel(searchVolume);
    }
    // Fallback si pas de QualityValidatorService
    if (searchVolume < 10) return 'L1';
    if (searchVolume < 100) return 'L2';
    if (searchVolume < 1000) return 'L3';
    if (searchVolume < 10000) return 'L4';
    return 'L5';
  }

  /**
   * Retourne le nombre de tokens max pour un V-Level
   */
  getMaxTokens(vLevel: VLevel): number {
    if (this.qualityValidator) {
      return this.qualityValidator.getMaxTokens(vLevel);
    }
    // Fallback
    const config: Record<VLevel, number> = {
      L1: 150,
      L2: 300,
      L3: 600,
      L4: 1200,
      L5: 2000,
    };
    return config[vLevel];
  }

  /**
   * Génère du contenu SEO pour une gamme (R4 et/ou R5) depuis la DB.
   *
   * ADR-031/046 : génération depuis le RAG **retirée**. Le contenu provient de la DB
   * interne (puis de la projection WIKI, ADR-059). Signature conservée pour les
   * consommateurs existants ; `options` est ignoré (l'enrichissement LLM du corpus RAG
   * n'existe plus). Pas de fallback silencieux : la source est explicitement la DB.
   *
   * @param pgId - L'ID de la gamme (pg_id)
   * @param slug - Le slug de la gamme (ex: "filtre-a-huile")
   * @param contentTypes - Types de contenu à générer ('r4', 'r5', ou les deux)
   */
  async generateFromGamme(
    pgId: number,
    slug: string,
    contentTypes: ('r4' | 'r5')[],
    _options: { useAi?: boolean } = {},
  ): Promise<GenerateResult> {
    this.logger.log(
      `🏭 Generating SEO content (DB source) for gamme: ${slug} (pg_id: ${pgId})`,
    );
    return this.generateFromDatabase(pgId, slug, contentTypes);
  }

  /**
   * Génère du contenu SEO depuis la base de données (source de contenu, ADR-031/046).
   */
  private async generateFromDatabase(
    pgId: number,
    slug: string,
    contentTypes: ('r4' | 'r5')[],
  ): Promise<GenerateResult> {
    this.logger.log(`📊 Generating from database for: ${slug}`);

    const result: GenerateResult = {
      r4: null,
      r5: [],
      sourcesUsed: ['database'],
      keywordsMatched: [],
      errors: [],
    };

    // Récupérer la gamme depuis la DB
    const { data: gamme, error } = await this.supabase
      .from('__pg_gammes')
      .select('id, pg_alias, label, description')
      .eq('id', pgId)
      .single();

    if (error || !gamme) {
      result.errors.push(`Gamme not found: pg_id=${pgId}`);
      return result;
    }

    if (contentTypes.includes('r4')) {
      result.r4 = {
        slug: gamme.pg_alias || slug,
        title: `${gamme.label} : Définition et rôle`,
        meta_description: `Découvrez le ${gamme.label.toLowerCase()} : fonction, entretien et remplacement.`,
        definition:
          gamme.description || `Le ${gamme.label} est une pièce automobile.`,
        role_mecanique: null,
        role_negatif: null,
        composition: null,
        confusions_courantes: null,
        symptomes_associes: null,
        regles_metier: null,
        content_html: null,
        pg_id: pgId,
      };
    }

    return result;
  }

  /**
   * Sauvegarde une R4 générée en draft dans la base de données
   */
  async saveR4Draft(
    r4: GeneratedR4,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`💾 Saving R4 draft: ${r4.slug}`);

    // Vérifier si existe déjà
    const { count } = await this.supabase
      .from('__seo_reference')
      .select('id', { count: 'exact', head: true })
      .eq('slug', r4.slug);

    if ((count ?? 0) > 0) {
      return { success: false, error: `Reference already exists: ${r4.slug}` };
    }

    const { error } = await this.supabase.from('__seo_reference').insert({
      slug: r4.slug,
      title: r4.title,
      meta_description: r4.meta_description,
      definition: r4.definition,
      role_mecanique: r4.role_mecanique,
      role_negatif: r4.role_negatif,
      composition: r4.composition,
      confusions_courantes: r4.confusions_courantes,
      symptomes_associes: r4.symptomes_associes,
      regles_metier: r4.regles_metier,
      content_html: r4.content_html,
      pg_id: r4.pg_id,
      is_published: false, // DRAFT
    });

    if (error) {
      this.logger.error(`❌ Error saving R4 ${r4.slug}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Sauvegarde une R5 générée en draft dans la base de données
   */
  async saveR5Draft(
    r5: GeneratedR5,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`💾 Saving R5 draft: ${r5.slug}`);

    // Vérifier si existe déjà
    const { count } = await this.supabase
      .from('__seo_observable')
      .select('id', { count: 'exact', head: true })
      .eq('slug', r5.slug);

    if ((count ?? 0) > 0) {
      return { success: false, error: `Diagnostic already exists: ${r5.slug}` };
    }

    const { error } = await this.supabase.from('__seo_observable').insert({
      slug: r5.slug,
      title: r5.title,
      meta_description: r5.meta_description,
      observable_type: r5.observable_type,
      perception_channel: r5.perception_channel,
      risk_level: r5.risk_level,
      safety_gate: r5.safety_gate,
      symptom_description: r5.symptom_description,
      sign_description: r5.sign_description,
      cluster_id: r5.cluster_id,
      related_gammes: r5.related_gammes,
      related_references: r5.related_references,
      is_published: false, // DRAFT
    });

    if (error) {
      this.logger.error(`❌ Error saving R5 ${r5.slug}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Génère et sauvegarde en une seule opération
   */
  async generateAndSave(
    pgId: number,
    slug: string,
    contentTypes: ('r4' | 'r5')[],
  ): Promise<{
    generated: GenerateResult;
    saved: { r4: boolean; r5: number };
    errors: string[];
  }> {
    const generated = await this.generateFromGamme(pgId, slug, contentTypes);
    const saved = { r4: false, r5: 0 };
    const errors: string[] = [...generated.errors];

    // Sauvegarder R4
    if (generated.r4) {
      const r4Result = await this.saveR4Draft(generated.r4);
      saved.r4 = r4Result.success;
      if (!r4Result.success && r4Result.error) {
        errors.push(`R4: ${r4Result.error}`);
      }
    }

    // Sauvegarder R5
    for (const r5 of generated.r5) {
      const r5Result = await this.saveR5Draft(r5);
      if (r5Result.success) {
        saved.r5++;
      } else if (r5Result.error) {
        errors.push(`R5 ${r5.slug}: ${r5Result.error}`);
      }
    }

    return { generated, saved, errors };
  }
}
