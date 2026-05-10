import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveSupabaseKey } from '@common/utils';
import * as fs from 'fs/promises';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const matter = require('gray-matter');

import { SITE_ORIGIN } from '../../../config/app.config';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';

// Import du service de validation qualité
import {
  QualityValidatorService,
  type VLevel,
  type ValidationResult,
} from '../validation/quality-validator.service';

// Import du service AI Content pour enrichissement LLM
import { AiContentService } from '../../ai-content/ai-content.service';

// Import des templates SEO
import {
  R4_REFERENCE_TEMPLATE,
  R5_DIAGNOSTIC_TEMPLATE,
  applyTemplate,
  buildR4SchemaOrg,
  buildR5SchemaOrg,
} from '../constants/seo-templates.constants';

/**
 * Interface pour le frontmatter RAG des gammes
 */
interface RagGammeFrontmatter {
  entity_type: string;
  pg_id: number;
  truth_level: string;
  mechanical_rules?: {
    role_summary?: string;
    must_be_true?: string[];
    must_not_contain_concepts?: string[];
  };
  symptoms?: Array<{
    id: string;
    label: string;
    risk_level?: string;
  }>;
  composition?: string[];
  confusions_courantes?: string[];
}

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

/**
 * Service pour générer du contenu SEO depuis les fichiers RAG
 *
 * Workflow:
 * 1. Lire le fichier gamme RAG (markdown avec frontmatter YAML)
 * 2. Parser avec gray-matter
 * 3. Générer R4 Reference et/ou R5 Diagnostics
 * 4. Retourner en mode DRAFT pour validation
 */
@Injectable()
export class SeoGeneratorService {
  private readonly logger = new Logger(SeoGeneratorService.name);
  private readonly supabase: SupabaseClient;
  private readonly ragBasePath: string;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly qualityValidator?: QualityValidatorService,
    @Optional() private readonly aiContentService?: AiContentService,
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
    this.ragBasePath = RAG_KNOWLEDGE_PATH;
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
   * Enrichit le contenu avec LLM (anti-hallucination)
   *
   * PRINCIPE : "Le contenu ne crée jamais l'information"
   * - ✅ Reformuler le texte RAG existant
   * - ✅ Améliorer structure et lisibilité
   * - ✅ Explications mécaniques génériques
   * - ❌ Inventer des spécifications
   * - ❌ Ajouter des prix/promotions
   * - ❌ Créer des compatibilités
   */
  private async enrichWithLLM(
    baseContent: string,
    pageRole: 'R4' | 'R5',
    vLevel: VLevel,
    context: Record<string, unknown>,
  ): Promise<string> {
    // Si pas de service IA disponible, retourner le contenu brut
    if (!this.aiContentService) {
      this.logger.debug('AiContentService non disponible, contenu non enrichi');
      return baseContent;
    }

    // Si le contenu est vide, pas d'enrichissement
    if (!baseContent || baseContent.trim().length < 20) {
      return baseContent;
    }

    const maxTokens = this.getMaxTokens(vLevel);

    // 🛡️ Règles anti-hallucination strictes
    const antiHallucinationRules = `
RÈGLES STRICTES (violation = rejet) :
1. Tu ne PEUX PAS inventer de données (prix, specs, compatibilités, dates)
2. Tu ne PEUX PAS ajouter d'informations non présentes dans le contenu source
3. Tu PEUX UNIQUEMENT reformuler, structurer et améliorer le style
4. Tu PEUX ajouter des explications mécaniques GÉNÉRIQUES (ex: "un filtre retient les impuretés")
5. Tu NE PEUX PAS utiliser de superlatifs (meilleur, top, n°1, unique)
6. Tu NE PEUX PAS mentionner de prix ou promotions
7. Tu NE PEUX PAS inventer de marques ou références`;

    const systemPrompt =
      pageRole === 'R4'
        ? `Tu es un rédacteur technique automobile. REFORMULE ce contenu RAG sans inventer.
${antiHallucinationRules}

OBJECTIF : Améliorer la lisibilité et la structure du texte existant.
Maximum ${maxTokens} tokens. Ton professionnel et informatif.
Retourne UNIQUEMENT le texte reformulé, sans commentaires.`
        : `Tu es un rédacteur technique automobile. REFORMULE ce diagnostic sans inventer.
${antiHallucinationRules}

OBJECTIF : Structurer les symptômes/causes/solutions du texte source.
Maximum ${maxTokens} tokens. Ton technique et précis.
Retourne UNIQUEMENT le texte reformulé, sans commentaires.`;

    try {
      const result = await this.aiContentService.generateContent({
        type: 'generic',
        prompt: `${systemPrompt}\n\nContenu source (RAG) à reformuler :\n${baseContent}\n\nContexte vérifié :\n${JSON.stringify(context)}`,
        tone: 'technical',
        language: 'fr',
        maxLength: maxTokens,
        context: context,
        temperature: 0.2, // Très basse pour fidélité au source
        useCache: true,
      });

      this.logger.debug(
        `✅ Contenu enrichi par LLM (${result.metadata?.model || 'unknown'})`,
      );
      return result.content;
    } catch (error) {
      this.logger.warn(
        `⚠️ Enrichissement LLM échoué: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return baseContent; // Fallback au contenu original
    }
  }

  /**
   * Génère du contenu SEO depuis un fichier RAG gamme
   * @param pgId - L'ID de la gamme (pg_id)
   * @param slug - Le slug de la gamme (ex: "filtre-a-huile")
   * @param contentTypes - Types de contenu à générer ('r4', 'r5', ou les deux)
   * @param options - Options de génération (useAi pour enrichissement LLM)
   * @returns Le contenu généré (R4 et/ou R5)
   */
  async generateFromGamme(
    pgId: number,
    slug: string,
    contentTypes: ('r4' | 'r5')[],
    options: { useAi?: boolean } = {},
  ): Promise<GenerateResult> {
    this.logger.log(
      `🏭 Generating SEO content for gamme: ${slug} (pg_id: ${pgId})${options.useAi ? ' [AI enrichment enabled]' : ''}`,
    );

    const result: GenerateResult = {
      r4: null,
      r5: [],
      sourcesUsed: [],
      keywordsMatched: [],
      errors: [],
    };

    // 1. Chercher le fichier RAG
    const gammeFilePath = path.join(this.ragBasePath, 'gammes', `${slug}.md`);

    let ragContent: string;
    let frontmatter: RagGammeFrontmatter;
    let body: string;

    try {
      ragContent = await fs.readFile(gammeFilePath, 'utf-8');
      result.sourcesUsed.push(gammeFilePath);
      this.logger.debug(`📄 RAG file found: ${gammeFilePath}`);
    } catch (_error) {
      this.logger.warn(`⚠️ RAG file not found: ${gammeFilePath}`);
      // Fallback: générer depuis la base de données
      return this.generateFromDatabase(pgId, slug, contentTypes);
    }

    // 2. Parser le frontmatter avec gray-matter
    try {
      const parsed = matter(ragContent);
      frontmatter = parsed.data as RagGammeFrontmatter;
      body = parsed.content;
      this.logger.debug(
        `📊 Frontmatter parsed: ${Object.keys(frontmatter).length} keys`,
      );
    } catch (error) {
      result.errors.push(`Error parsing frontmatter: ${error}`);
      return result;
    }

    // 3. Récupérer le nom de la gamme et le volume de recherche depuis la DB
    const { data: gammeData } = await this.supabase
      .from('__pg_gammes')
      .select('label, pg_alias, search_volume')
      .eq('id', pgId)
      .single();

    const gammeName = gammeData?.label || this.slugToLabel(slug);
    const searchVolume = gammeData?.search_volume || 0;

    // 3b. Calculer le V-Level
    const vLevel = this.getVLevel(searchVolume);
    result.vLevel = vLevel;
    this.logger.debug(`📊 V-Level: ${vLevel} (volume: ${searchVolume})`);

    // 4. Générer R4 si demandé
    if (contentTypes.includes('r4')) {
      const useAi = options.useAi ?? false;
      const r4 = await this.buildR4FromRag(
        slug,
        pgId,
        gammeName,
        frontmatter,
        body,
        vLevel,
        useAi,
      );
      result.r4 = r4;
      result.keywordsMatched.push(...this.extractKeywords(frontmatter));

      // 4b. Valider le contenu R4
      if (this.qualityValidator && r4) {
        const contentToValidate = `${r4.title} ${r4.meta_description} ${r4.definition}`;
        const validation = this.qualityValidator.validateContent(
          contentToValidate,
          'R4',
        );
        result.validation = validation;
        result.qualityScore = validation.score;
        r4.quality_score = validation.score;

        if (!validation.isValid) {
          this.logger.warn(
            `⚠️ R4 ${slug} has ${validation.issues.length} quality issues`,
          );
        }
      }
    }

    // 5. Générer R5 si demandé
    if (contentTypes.includes('r5') && frontmatter.symptoms) {
      const r5List = frontmatter.symptoms.map((symptom) => {
        const r5 = this.buildR5FromRag(symptom, pgId, slug, gammeName);

        // 5b. Valider le contenu R5
        if (this.qualityValidator) {
          const contentToValidate = `${r5.title} ${r5.meta_description} ${r5.symptom_description}`;
          const validation = this.qualityValidator.validateContent(
            contentToValidate,
            'R5',
          );
          r5.quality_score = validation.score;
        }

        return r5;
      });
      result.r5 = r5List;
    }

    // 6. Auto-linking R4 ↔ R5 (maillage interne)
    if (result.r4 && result.r5.length > 0) {
      // R4 → R5 : symptômes associés
      result.r4.symptomes_associes = result.r5.map((r5) => r5.slug);
      this.logger.debug(
        `🔗 R4 ${slug} linked to ${result.r5.length} R5 symptoms`,
      );

      // R5 → R4 : référence parente
      for (const r5 of result.r5) {
        r5.related_references = [slug];
      }
      this.logger.debug(`🔗 R5 pages linked back to R4 ${slug}`);
    }

    this.logger.log(
      `✅ Generation complete: R4=${result.r4 ? 'yes' : 'no'}, R5=${result.r5.length} pages, V-Level=${vLevel}, Score=${result.qualityScore ?? 'N/A'}`,
    );

    return result;
  }

  /**
   * Construit une R4 Reference depuis les données RAG
   * @param useAi - Si true, enrichit le contenu avec LLM (anti-hallucination)
   */
  private async buildR4FromRag(
    slug: string,
    pgId: number,
    gammeName: string,
    frontmatter: RagGammeFrontmatter,
    body: string,
    vLevel?: VLevel,
    useAi: boolean = false,
  ): Promise<GeneratedR4> {
    const mechanicalRules = frontmatter.mechanical_rules || {};

    // Extraire la définition du body markdown (premier paragraphe après le titre)
    const definitionMatch = body.match(/## Définition\n\n([^#]+)/);
    let definition = definitionMatch
      ? definitionMatch[1].trim()
      : mechanicalRules.role_summary ||
        `Le ${gammeName} est une pièce automobile essentielle.`;

    // Extraire le rôle mécanique
    const roleMecaniqueMatch = body.match(/## Rôle mécanique\n\n([^#]+)/);
    let roleMecanique = roleMecaniqueMatch
      ? roleMecaniqueMatch[1].trim()
      : mechanicalRules.role_summary || null;

    // 🤖 Enrichissement LLM optionnel (anti-hallucination)
    if (useAi && vLevel) {
      const context = {
        gamme: gammeName,
        pg_id: pgId,
        composition: frontmatter.composition,
        source: 'rag',
      };

      // Enrichir la définition
      definition = await this.enrichWithLLM(definition, 'R4', vLevel, context);

      // Enrichir le rôle mécanique si disponible
      if (roleMecanique) {
        roleMecanique = await this.enrichWithLLM(
          roleMecanique,
          'R4',
          vLevel,
          context,
        );
      }

      this.logger.debug(`🤖 Contenu R4 ${slug} enrichi par LLM`);
    }

    // Construire le rôle négatif depuis must_not_contain_concepts
    const roleNegatif = mechanicalRules.must_not_contain_concepts?.length
      ? `Ce que le ${gammeName} NE fait PAS :\n- ${mechanicalRules.must_not_contain_concepts.join('\n- ')}`
      : null;

    // Générer les slugs R5 depuis les symptoms
    const symptomesAssocies =
      frontmatter.symptoms?.map((s) => this.symptomToSlug(s.label)) || null;

    // Appliquer le template R4
    const templateVars = {
      piece: gammeName.toLowerCase(),
      Piece: gammeName,
    };
    const templated = applyTemplate(R4_REFERENCE_TEMPLATE, templateVars);

    // Générer le Schema.org
    const url = `${SITE_ORIGIN}/reference-auto/${slug}`;
    const schemaOrg = buildR4SchemaOrg(templated.title, definition, url);

    return {
      slug,
      title: templated.title,
      meta_description: templated.meta,
      definition,
      role_mecanique: roleMecanique,
      role_negatif: roleNegatif,
      composition: frontmatter.composition || null,
      confusions_courantes: frontmatter.confusions_courantes || null,
      symptomes_associes: symptomesAssocies,
      regles_metier: mechanicalRules.must_be_true || null,
      content_html: null, // Généré par le frontend ou à partir du template
      pg_id: pgId,
      schema_org: schemaOrg,
      v_level: vLevel,
    };
  }

  /**
   * Construit une R5 Diagnostic depuis un symptôme RAG
   */
  private buildR5FromRag(
    symptom: { id: string; label: string; risk_level?: string },
    pgId: number,
    gammeSlug: string,
    gammeName: string,
  ): GeneratedR5 {
    const slug = this.symptomToSlug(symptom.label);

    // Mapper risk_level RAG vers safety_gate
    const { riskLevel, safetyGate } = this.mapRiskLevel(symptom.risk_level);

    // Déterminer le canal de perception depuis le label
    const perceptionChannel = this.detectPerceptionChannel(symptom.label);

    // Déterminer le type d'observable
    const observableType = this.detectObservableType(symptom.label);

    // Appliquer le template R5
    const templateVars = {
      symptome: symptom.label.toLowerCase(),
      Symptome: symptom.label,
    };
    const templated = applyTemplate(R5_DIAGNOSTIC_TEMPLATE, templateVars);

    // Description du symptôme
    const symptomDescription = `${symptom.label}. Ce symptôme peut indiquer un problème lié au ${gammeName.toLowerCase()}.`;

    // Générer le Schema.org FAQPage
    const url = `${SITE_ORIGIN}/diagnostic-auto/${slug}`;
    const causes = [
      `Usure du ${gammeName.toLowerCase()}`,
      `Défaillance du système`,
      `Problème de montage`,
    ];
    const schemaOrg = buildR5SchemaOrg(
      symptom.label,
      symptomDescription,
      causes,
      url,
    );

    return {
      slug,
      title: templated.title,
      meta_description: templated.meta,
      observable_type: observableType,
      perception_channel: perceptionChannel,
      risk_level: riskLevel,
      safety_gate: safetyGate,
      symptom_description: symptomDescription,
      sign_description: `Pour diagnostiquer un ${symptom.label.toLowerCase()}, vérifiez l'état du ${gammeName.toLowerCase()}.`,
      cluster_id: gammeSlug.split('-')[0], // Premier mot du slug
      related_gammes: [pgId],
      related_references: [gammeSlug],
      schema_org: schemaOrg,
    };
  }

  /**
   * Fallback: génère depuis la base de données si pas de fichier RAG
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

  /**
   * Liste les fichiers RAG disponibles
   */
  async listAvailableRagFiles(): Promise<string[]> {
    try {
      const gammesDir = path.join(this.ragBasePath, 'gammes');
      const files = await fs.readdir(gammesDir);
      return files
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace('.md', ''));
    } catch (error) {
      this.logger.error('Error listing RAG files:', error);
      return [];
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Convertit un slug en label lisible
   */
  private slugToLabel(slug: string): string {
    return slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Convertit un label de symptôme en slug URL
   */
  private symptomToSlug(label: string): string {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Collapse multiple dashes
      .replace(/^-|-$/g, ''); // Trim dashes
  }

  /**
   * Mappe le risk_level RAG vers les champs R5
   */
  private mapRiskLevel(riskLevel?: string): {
    riskLevel: 'confort' | 'securite' | 'critique';
    safetyGate: 'none' | 'warning' | 'stop_soon' | 'stop_immediate';
  } {
    switch (riskLevel?.toLowerCase()) {
      case 'critique':
      case 'stop_immediate':
        return { riskLevel: 'critique', safetyGate: 'stop_immediate' };
      case 'securite':
      case 'stop_soon':
        return { riskLevel: 'securite', safetyGate: 'stop_soon' };
      case 'warning':
        return { riskLevel: 'securite', safetyGate: 'warning' };
      case 'confort':
      default:
        return { riskLevel: 'confort', safetyGate: 'warning' };
    }
  }

  /**
   * Détecte le canal de perception depuis le label
   */
  private detectPerceptionChannel(label: string): string {
    const lower = label.toLowerCase();
    if (
      lower.includes('bruit') ||
      lower.includes('cliquetis') ||
      lower.includes('grincement')
    ) {
      return 'auditory';
    }
    if (
      lower.includes('voyant') ||
      lower.includes('témoin') ||
      lower.includes('fuite')
    ) {
      return 'visual';
    }
    if (lower.includes('vibration') || lower.includes('tremblement')) {
      return 'tactile';
    }
    if (lower.includes('odeur') || lower.includes('brûlé')) {
      return 'olfactory';
    }
    if (
      lower.includes('code') ||
      lower.includes('obd') ||
      lower.includes('dtc')
    ) {
      return 'electronic';
    }
    return 'visual'; // Default
  }

  /**
   * Détecte le type d'observable depuis le label
   */
  private detectObservableType(label: string): 'symptom' | 'sign' | 'dtc' {
    const lower = label.toLowerCase();
    if (lower.match(/^p[0-9]/) || lower.includes('code')) {
      return 'dtc';
    }
    if (
      lower.includes('voyant') ||
      lower.includes('niveau') ||
      lower.includes('usure')
    ) {
      return 'sign';
    }
    return 'symptom';
  }

  /**
   * Extrait les keywords depuis le frontmatter
   */
  private extractKeywords(frontmatter: RagGammeFrontmatter): string[] {
    const keywords: string[] = [];

    if (frontmatter.mechanical_rules?.must_be_true) {
      keywords.push(...frontmatter.mechanical_rules.must_be_true);
    }

    if (frontmatter.symptoms) {
      keywords.push(...frontmatter.symptoms.map((s) => s.label));
    }

    return keywords;
  }
}
