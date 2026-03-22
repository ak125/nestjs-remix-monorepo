import { Injectable, Logger, Optional } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { ContentWriteGateService } from '../../../config/content-write-gate.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { RoleId } from '../../../config/role-ids';
import type { ResourceGroup } from '../../../config/execution-registry.types';
import { SITE_ORIGIN } from '../../../config/site.constants';
import {
  R5_BLOCKING_FLAGS,
  R5_WARNING_FLAGS,
  R5_STRATEGIC_TOPICS,
  R5_VEHICLE_DEPENDENCY_SIGNALS,
  R5_FORBIDDEN_R3_TERMS,
  R5_FORBIDDEN_R4_TERMS,
  R5_GENERIC_PATTERNS,
  R5_QUALITY_THRESHOLDS,
  R5_AFTER_REPAIR_PATTERNS,
  type R5QualityFlag,
  type SurfaceTarget,
} from '../../../config/r5-diagnostic.constants';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface pour un diagnostic SEO (R5) - format complet
 * IMPORTANT: snake_case pour correspondre au frontend
 */
export interface SeoDiagnostic {
  id: number;
  slug: string;
  title: string;
  meta_description: string | null;
  canonical_url: string | null;
  observable_type: 'symptom' | 'sign' | 'dtc';
  perception_channel: string | null;
  risk_level: 'confort' | 'securite' | 'critique';
  safety_gate: 'none' | 'warning' | 'stop_soon' | 'stop_immediate';
  symptom_description: string | null;
  sign_description: string | null;
  dtc_codes: string[] | null;
  dtc_descriptions: Record<string, string> | null;
  ctx_phase: string[] | null;
  ctx_temp: string[] | null;
  ctx_freq: string | null;
  cluster_id: string | null;
  related_references: string[] | null;
  related_gammes: number[] | null;
  related_blog_articles: string[] | null;
  recommended_actions: Array<{
    action: string;
    urgency: string;
    skill_level: string;
    duration: string;
  }> | null;
  estimated_repair_cost_min: number | null;
  estimated_repair_cost_max: number | null;
  estimated_repair_duration: string | null;
  differentiation_checklist: Array<{
    criterion: string;
    if_yes: string;
    if_no: string;
  }> | null;
  consultation_triggers: Array<{
    trigger: string;
    urgency: 'urgent' | 'soon' | 'routine';
    reason: string;
  }> | null;
  do_dont_list: { do: string[]; dont: string[] } | null;
  schema_org: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Interface pour la liste des diagnostics (version legere)
 * IMPORTANT: snake_case pour correspondre au frontend
 */
export interface SeoDiagnosticListItem {
  slug: string;
  title: string;
  meta_description: string | null;
  observable_type: 'symptom' | 'sign' | 'dtc';
  perception_channel: string | null;
  risk_level: 'confort' | 'securite' | 'critique';
  safety_gate: string;
  cluster_id: string | null;
}

/**
 * Resultat de validation qualite R5 (double filtre).
 * Pattern: reference.service.ts validateReferenceQuality()
 */
export interface DiagnosticQualityResult {
  score: number;
  flags: R5QualityFlag[];
  isPublishable: boolean;
  vehicleDependencyScore: number;
  surfaceRecommendation: SurfaceTarget | null;
}

/**
 * Service pour gerer les pages Diagnostic (R5)
 * Observable Pro : Symptom (60%) / Sign (85%) / DTC (95%)
 */
@Injectable()
export class DiagnosticService extends SupabaseBaseService {
  protected override readonly logger = new Logger(DiagnosticService.name);
  private readonly RAG_DIAGNOSTIC_DIR =
    '/opt/automecanik/rag/knowledge/diagnostic';

  constructor(
    rpcGate: RpcGateService,
    @Optional() private readonly writeGate?: ContentWriteGateService,
    @Optional() private readonly featureFlags?: FeatureFlagsService,
  ) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * Recupere un diagnostic par son slug
   * @param slug - Le slug URL du diagnostic (ex: "bruit-embrayage")
   * @returns Le diagnostic complet ou null si non trouve
   */
  async getBySlug(slug: string): Promise<SeoDiagnostic | null> {
    this.logger.debug(`Fetching diagnostic: ${slug}`);

    // 🛡️ RPC Safety Gate
    const { data, error } = await this.callRpc<any>(
      'get_seo_observable_by_slug',
      { p_slug: slug },
      { source: 'api' },
    );

    if (error) {
      this.logger.error(`Error fetching diagnostic ${slug}:`, error);
      return null;
    }

    if (!data || data.length === 0) {
      this.logger.debug(`Diagnostic not found: ${slug}`);
      return null;
    }

    const row = data[0];
    return this.mapRowToDiagnostic(row);
  }

  /**
   * Returns the 301 redirect target for an R5 sub-page.
   * Single gamme → R3 conseil page, multi/none → hub.
   */
  async getRedirectTarget(
    slug: string,
  ): Promise<{ redirect_to: string; pg_alias: string } | null> {
    const { data, error } = await this.callRpc<
      Array<{ redirect_to: string; pg_alias: string }>
    >('get_r5_redirect_target', { p_slug: slug }, { source: 'api' });

    if (error || !data || data.length === 0) return null;
    return data[0];
  }

  /**
   * Recupere les diagnostics featured (populaires)
   * @param limit - Nombre max de resultats (defaut: 10)
   * @returns Liste des diagnostics populaires
   */
  async getFeatured(limit: number = 10): Promise<SeoDiagnosticListItem[]> {
    this.logger.debug(`Fetching featured diagnostics (limit: ${limit})`);

    // 🛡️ RPC Safety Gate
    const { data, error } = await this.callRpc<any[]>(
      'get_seo_observable_featured',
      { p_limit: limit },
      { source: 'api' },
    );

    if (error) {
      this.logger.error('Error fetching featured diagnostics:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row: Record<string, unknown>) =>
      this.mapRowToListItem(row),
    );
  }

  /**
   * Recupere les diagnostics d'un cluster
   * @param clusterId - ID du cluster (ex: "embrayage", "freinage")
   * @param limit - Nombre max de resultats (defaut: 20)
   * @returns Liste des diagnostics du cluster
   */
  async getByCluster(
    clusterId: string,
    limit: number = 20,
  ): Promise<SeoDiagnosticListItem[]> {
    this.logger.debug(`Fetching diagnostics for cluster: ${clusterId}`);

    // 🛡️ RPC Safety Gate
    const { data, error } = await this.callRpc<any[]>(
      'get_seo_observables_by_cluster',
      { p_cluster_id: clusterId, p_limit: limit },
      { source: 'api' },
    );

    if (error) {
      this.logger.error(
        `Error fetching diagnostics for cluster ${clusterId}:`,
        error,
      );
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row: Record<string, unknown>) =>
      this.mapRowToListItem(row),
    );
  }

  /**
   * Recherche les diagnostics par code DTC (OBD)
   * @param dtcCode - Code DTC (ex: "P0300", "C1234")
   * @returns Liste des diagnostics associes
   */
  async searchByDtc(dtcCode: string): Promise<SeoDiagnosticListItem[]> {
    this.logger.debug(`Searching diagnostics by DTC: ${dtcCode}`);

    // 🛡️ RPC Safety Gate
    const { data, error } = await this.callRpc<any[]>(
      'search_seo_observable_by_dtc',
      { p_dtc_code: dtcCode.toUpperCase() },
      { source: 'api' },
    );

    if (error) {
      this.logger.error(`Error searching by DTC ${dtcCode}:`, error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row: Record<string, unknown>) =>
      this.mapRowToListItem(row),
    );
  }

  /**
   * Verifie si un diagnostic existe pour un slug donne
   * @param slug - Le slug a verifier
   * @returns true si le diagnostic existe et est publie
   */
  async exists(slug: string): Promise<boolean> {
    const { count, error } = await this.supabase
      .from('__seo_observable')
      .select('id', { count: 'exact', head: true })
      .eq('slug', slug)
      .eq('is_published', true);

    return !error && (count ?? 0) > 0;
  }

  /**
   * Genere le Schema.org enrichi pour un diagnostic (R5)
   * Inclut: HowTo + FAQPage + BreadcrumbList
   * Impact SEO: +10-15% CTR avec Rich Snippets Google
   *
   * @param diagnostic - Le diagnostic
   * @returns Le JSON-LD Schema.org @graph
   */
  generateSchemaOrg(diagnostic: SeoDiagnostic): Record<string, unknown> {
    // Si un schema existe deja dans la DB, le retourner tel quel
    if (diagnostic.schema_org) {
      return diagnostic.schema_org;
    }

    const baseUrl = SITE_ORIGIN;
    const pageUrl = `${baseUrl}/diagnostic-auto/${diagnostic.slug}`;

    // 1. HowTo Schema (existant, ameliore)
    const howToSteps =
      diagnostic.recommended_actions?.map((action, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: action.action,
        text: action.action,
        ...(action.duration && {
          estimatedDuration: `PT${action.duration.toUpperCase().replace(/\s/g, '')}`,
        }),
      })) || [];

    const howToSchema: Record<string, unknown> = {
      '@type': 'HowTo',
      '@id': `${pageUrl}#howto`,
      name: diagnostic.title,
      description:
        diagnostic.meta_description ||
        this.stripHtml(diagnostic.symptom_description || '').substring(0, 200),
      step: howToSteps,
    };

    // Ajouter estimatedCost si disponible
    if (diagnostic.estimated_repair_cost_min) {
      howToSchema.estimatedCost = {
        '@type': 'MonetaryAmount',
        currency: 'EUR',
        minValue: diagnostic.estimated_repair_cost_min,
        maxValue: diagnostic.estimated_repair_cost_max,
      };
    }

    // Ajouter totalTime si disponible
    if (diagnostic.estimated_repair_duration) {
      howToSchema.totalTime = `PT${diagnostic.estimated_repair_duration.toUpperCase().replace(/\s/g, '')}`;
    }

    // 2. FAQPage Schema (NOUVEAU - Rich Snippets Google)
    const faqQuestions: Array<Record<string, unknown>> = [];

    // Q1: Symptomes
    if (diagnostic.symptom_description) {
      const titleBase = diagnostic.title.split(':')[0].toLowerCase().trim();
      faqQuestions.push({
        '@type': 'Question',
        name: `Quels sont les symptômes d'un ${titleBase} ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: this.stripHtml(diagnostic.symptom_description).substring(
            0,
            500,
          ),
        },
      });
    }

    // Q2: Diagnostic
    if (diagnostic.sign_description) {
      const titleBase = diagnostic.title.split(':')[0].toLowerCase().trim();
      faqQuestions.push({
        '@type': 'Question',
        name: `Comment diagnostiquer un ${titleBase} ?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: this.stripHtml(diagnostic.sign_description).substring(0, 500),
        },
      });
    }

    // Q3: Codes OBD (si disponibles)
    if (diagnostic.dtc_codes && diagnostic.dtc_codes.length > 0) {
      const dtcDescriptions = Object.entries(diagnostic.dtc_descriptions || {})
        .map(([code, desc]) => `${code}: ${desc}`)
        .join('. ');

      faqQuestions.push({
        '@type': 'Question',
        name: 'Quels codes OBD sont associés à ce problème ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Codes OBD associés: ${diagnostic.dtc_codes.join(', ')}. ${dtcDescriptions}`,
        },
      });
    }

    // Q4: Cout (si disponible)
    if (
      diagnostic.estimated_repair_cost_min &&
      diagnostic.estimated_repair_cost_max
    ) {
      faqQuestions.push({
        '@type': 'Question',
        name: 'Combien coûte cette réparation ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Le coût estimé de la réparation est de ${diagnostic.estimated_repair_cost_min}€ à ${diagnostic.estimated_repair_cost_max}€, avec une durée d'intervention d'environ ${diagnostic.estimated_repair_duration || '2-3 heures'}.`,
        },
      });
    }

    const faqSchema: Record<string, unknown> = {
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      mainEntity: faqQuestions,
    };

    // 3. BreadcrumbList Schema (NOUVEAU)
    const breadcrumbSchema: Record<string, unknown> = {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Accueil',
          item: baseUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Diagnostic Auto',
          item: `${baseUrl}/diagnostic-auto`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: diagnostic.title,
          item: pageUrl,
        },
      ],
    };

    // Assembler le @graph complet
    return {
      '@context': 'https://schema.org',
      '@graph': [howToSchema, faqSchema, breadcrumbSchema],
    };
  }

  /**
   * Supprime les balises HTML d'une chaine
   * @param html - La chaine avec HTML
   * @returns La chaine sans HTML
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  // ============================================
  // MÉTHODES DE GÉNÉRATION (Phase 7 - Draft + Review)
  // ============================================

  /**
   * Templates pour la génération automatique de diagnostics R5
   */
  private readonly DIAGNOSTIC_TEMPLATES = [
    {
      observable_type: 'symptom' as const,
      perception_channel: 'auditory',
      title_template: 'Bruit de {gamme}: causes et solutions',
      symptom_template:
        'Un bruit anormal provenant du {gamme} peut indiquer plusieurs problèmes mécaniques.',
      sign_template:
        "Pour identifier un bruit de {gamme}, écoutez attentivement lors du démarrage, de l'accélération et du freinage.",
      risk_level: 'securite' as const,
      safety_gate: 'warning' as const,
      keyword: 'bruit',
    },
    {
      observable_type: 'symptom' as const,
      perception_channel: 'tactile',
      title_template: 'Vibration du {gamme}: diagnostic complet',
      symptom_template:
        'Des vibrations au niveau du {gamme} peuvent être ressenties dans le volant ou la pédale.',
      sign_template:
        'Les vibrations du {gamme} se manifestent généralement à certaines vitesses ou lors de manœuvres spécifiques.',
      risk_level: 'securite' as const,
      safety_gate: 'warning' as const,
      keyword: 'vibration',
    },
    {
      observable_type: 'sign' as const,
      perception_channel: 'visual',
      title_template: 'Voyant {gamme}: que faire ?',
      symptom_template:
        "Le voyant lié au {gamme} s'est allumé sur votre tableau de bord. Voici comment réagir.",
      sign_template:
        "Un voyant allumé indique un dysfonctionnement du {gamme} détecté par l'électronique du véhicule.",
      risk_level: 'critique' as const,
      safety_gate: 'stop_soon' as const,
      keyword: 'voyant',
    },
    {
      observable_type: 'symptom' as const,
      perception_channel: 'olfactory',
      title_template: 'Odeur de {gamme}: causes possibles',
      symptom_template:
        'Une odeur inhabituelle provenant du {gamme} peut signaler une surchauffe ou une usure.',
      sign_template:
        "L'odeur de brûlé ou de caoutchouc chaud liée au {gamme} nécessite une vérification rapide.",
      risk_level: 'securite' as const,
      safety_gate: 'stop_soon' as const,
      keyword: 'odeur',
    },
    {
      observable_type: 'symptom' as const,
      perception_channel: 'visual',
      title_template: 'Fuite de {gamme}: identifier et réparer',
      symptom_template:
        'Une fuite au niveau du {gamme} peut être visible sous le véhicule ou détectée par une baisse de niveau.',
      sign_template:
        'Les fuites de {gamme} laissent généralement des traces caractéristiques au sol.',
      risk_level: 'securite' as const,
      safety_gate: 'warning' as const,
      keyword: 'fuite',
    },
  ];

  /**
   * Gammes prioritaires pour la génération de diagnostics
   */
  private readonly PRIORITY_GAMMES = [
    'embrayage',
    'freinage',
    'distribution',
    'suspension',
    'direction',
    'demarreur',
    'alternateur',
    'turbo',
    'injecteur',
    'pompe-a-eau',
  ];

  /**
   * Génère des entrées R5 Diagnostic depuis les templates
   * Les entrées sont créées en mode DRAFT (is_published: false)
   * @returns Nombre d'entrées créées et ignorées
   */
  async generateFromTemplates(): Promise<{ created: number; skipped: number }> {
    this.logger.log('🏭 Generating R5 Diagnostics from templates...');

    // Fetch ALL gammes (not just 10 hardcoded ones)
    const { data: gammes, error: gammeError } = await this.supabase
      .from('__pg_gammes')
      .select('id, pg_alias, label')
      .not('pg_alias', 'is', null)
      .order('position', { ascending: true });

    if (gammeError || !gammes || gammes.length === 0) {
      this.logger.error('❌ No gammes found for generation');
      return { created: 0, skipped: 0 };
    }

    this.logger.log(
      `📊 Processing ${gammes.length} gammes for diagnostic generation`,
    );
    return this.generateDiagnosticsForGammes(gammes);
  }

  /**
   * Generate diagnostics for a single gamme (public API for ExecutionRouter).
   * Fetches the gamme by pgId, then delegates to generateDiagnosticsForGammes.
   */
  async generateForSingleGamme(
    pgId: number,
    pgAlias: string,
  ): Promise<{ created: number; skipped: number }> {
    const { data: gamme } = await this.supabase
      .from('__pg_gammes')
      .select('id, pg_alias, label')
      .eq('pg_alias', pgAlias)
      .single();

    if (!gamme) {
      // Fallback: try by id
      const { data: gammeById } = await this.supabase
        .from('__pg_gammes')
        .select('id, pg_alias, label')
        .eq('id', pgId)
        .single();

      if (!gammeById) {
        this.logger.warn(`No gamme found for pgId=${pgId} alias=${pgAlias}`);
        return { created: 0, skipped: 0 };
      }

      return this.generateDiagnosticsForGammes([gammeById]);
    }

    return this.generateDiagnosticsForGammes([gamme]);
  }

  /**
   * Génère les diagnostics pour une liste de gammes
   */
  private async generateDiagnosticsForGammes(
    gammes: Array<{ id: number; pg_alias: string; label: string }>,
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    for (const gamme of gammes) {
      for (const template of this.DIAGNOSTIC_TEMPLATES) {
        const slug = `${template.keyword}-${gamme.pg_alias}`;

        // Vérifier si entrée existe déjà (publiée ou draft)
        const { count } = await this.supabase
          .from('__seo_observable')
          .select('id', { count: 'exact', head: true })
          .eq('slug', slug);

        if ((count ?? 0) > 0) {
          skipped++;
          continue;
        }

        // Policy gate: check if slug is blocked by observable_policy
        const policyBlock = await this.checkPolicyGate(slug);
        if (policyBlock) {
          this.logger.debug(
            `🚫 Policy blocked: ${slug} → ${policyBlock.redirect_to} (${policyBlock.reason})`,
          );
          skipped++;
          continue;
        }

        // Parse RAG diagnostic file for enriched content
        const ragData = this.parseRagDiagnosticFile(gamme.pg_alias);

        // Look up related R4 references
        const { data: relatedRefs } = await this.supabase
          .from('__seo_reference')
          .select('slug')
          .eq('pg_id', gamme.id)
          .limit(3);

        const relatedRefSlugs = (relatedRefs || []).map((r: any) => r.slug);

        // Build recommended actions from RAG data
        const recommendedActions =
          ragData?.causes?.slice(0, 4).map((cause) => ({
            action: cause.solution,
            urgency: cause.urgency.toLowerCase().includes('haute')
              ? 'high'
              : 'medium',
            skill_level: 'professional',
            duration: '1-2h',
          })) || null;

        // Estimate repair costs based on gamme category
        const costEstimates = this.estimateRepairCosts(gamme.pg_alias);

        // Build enriched symptom and sign descriptions
        let symptomDescription = template.symptom_template.replace(
          /{gamme}/g,
          gamme.label,
        );
        let signDescription = template.sign_template.replace(
          /{gamme}/g,
          gamme.label,
        );

        if (ragData?.symptoms?.length) {
          symptomDescription = ragData.symptoms
            .map(
              (s) =>
                `<p><strong>${s.label}</strong> — ${s.when}. ${s.characteristic}.</p>`,
            )
            .join('\n');
        }

        if (ragData?.causes?.length) {
          signDescription = ragData.causes
            .map(
              (c) =>
                `<p><strong>${c.name}</strong> (probabilité: ${c.probability}) — ${c.solution}.</p>`,
            )
            .join('\n');
        }

        // Créer entrée R5 en DRAFT avec enrichissement RAG
        const { error: insertError } = await this.supabase
          .from('__seo_observable')
          .insert({
            slug,
            title: template.title_template.replace('{gamme}', gamme.label),
            meta_description: `Diagnostic ${template.keyword} ${gamme.label}: symptômes, causes, solutions. Guide complet par AutoMecanik.`,
            observable_type: template.observable_type,
            perception_channel: template.perception_channel,
            risk_level: template.risk_level,
            safety_gate: template.safety_gate,
            symptom_description: symptomDescription,
            sign_description: signDescription,
            cluster_id: gamme.pg_alias,
            related_gammes: [gamme.id],
            related_references:
              relatedRefSlugs.length > 0 ? relatedRefSlugs : null,
            recommended_actions: recommendedActions,
            estimated_repair_cost_min: costEstimates.min,
            estimated_repair_cost_max: costEstimates.max,
            estimated_repair_duration: costEstimates.duration,
            is_published: false, // ← DRAFT - validation manuelle requise
          });

        if (insertError) {
          this.logger.error(
            `❌ Error inserting diagnostic ${slug}:`,
            insertError,
          );
          continue;
        }

        created++;
      }
    }

    this.logger.log(
      `✅ Generation complete: ${created} created, ${skipped} skipped`,
    );
    return { created, skipped };
  }

  /**
   * Récupère tous les drafts (non publiés)
   * @returns Liste des diagnostics en mode draft
   */
  async getDrafts(): Promise<SeoDiagnosticListItem[]> {
    this.logger.debug('📝 Fetching draft diagnostics');

    const { data, error } = await this.supabase
      .from('__seo_observable')
      .select(
        'slug, title, meta_description, observable_type, perception_channel, risk_level, safety_gate, cluster_id, created_at',
      )
      .eq('is_published', false)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('❌ Error fetching drafts:', error);
      return [];
    }

    return (data || []).map((row) => this.mapRowToListItem(row));
  }

  /**
   * Publie un diagnostic (is_published: true) avec validation qualite.
   * Phase 1B : bloque si flags bloquants presents.
   * @param slug - Le slug du diagnostic a publier
   * @returns Succes ou echec avec flags
   */
  async publish(
    slug: string,
  ): Promise<{ success: boolean; error?: string; flags?: R5QualityFlag[] }> {
    this.logger.log(`📢 Publishing diagnostic: ${slug}`);

    // 1. Fetch diagnostic
    const diag = await this.getBySlug(slug);
    if (!diag) {
      return { success: false, error: 'Diagnostic not found' };
    }

    // 2. Validate quality (double filter)
    const quality = this.validateDiagnosticQuality(diag);
    if (!quality.isPublishable) {
      this.logger.warn(
        `❌ Publish blocked for ${slug}: ${quality.flags.join(', ')}`,
      );
      return {
        success: false,
        error: `Blocked by quality gates: ${quality.flags.filter((f) => (R5_BLOCKING_FLAGS as readonly string[]).includes(f)).join(', ')}`,
        flags: quality.flags,
      };
    }

    // 3. Update is_published
    const { error } = await this.supabase
      .from('__seo_observable')
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

  // ============================================
  // QUALITY VALIDATION (Phase 1A — Double Filter)
  // ============================================

  /**
   * Valide la qualite d'un diagnostic R5 avec double filtre.
   * Filtre 1 : intention (R3/R4/R5/TOOL)
   * Filtre 2 : dependance vehicule
   *
   * Pattern: reference.service.ts:1425 validateReferenceQuality()
   *
   * @param diag - Le diagnostic complet
   * @returns Score, flags, publishability, surface recommendation
   */
  validateDiagnosticQuality(diag: SeoDiagnostic): DiagnosticQualityResult {
    const flags: R5QualityFlag[] = [];

    // Concatenate all text fields for content analysis
    const allText = [
      diag.title,
      diag.symptom_description,
      diag.sign_description,
      diag.meta_description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const allTextClean = this.stripHtml(allText);

    // ── Filtre 1 — Intention (le contenu est-il au bon endroit ?) ──

    // 1. R3_ANGLE_LEAK — vocabulaire procedural
    const r3TermCount = R5_FORBIDDEN_R3_TERMS.filter((term) =>
      allTextClean.includes(term.toLowerCase()),
    ).length;
    if (r3TermCount > R5_QUALITY_THRESHOLDS.maxR3TermCount) {
      flags.push('R3_ANGLE_LEAK');
    }

    // 2. R4_ANGLE_LEAK — vocabulaire encyclopedique
    const r4TermCount = R5_FORBIDDEN_R4_TERMS.filter((term) =>
      allTextClean.includes(term.toLowerCase()),
    ).length;
    if (r4TermCount > R5_QUALITY_THRESHOLDS.maxR4TermCount) {
      flags.push('R4_ANGLE_LEAK');
    }

    // 3. NOT_STRATEGIC_TOPIC — slug hors whitelist (WARNING)
    const isStrategic = R5_STRATEGIC_TOPICS.some((topic) =>
      diag.slug.startsWith(topic),
    );
    if (!isStrategic) {
      flags.push('NOT_STRATEGIC_TOPIC');
    }

    // ── Filtre 2 — Dependance vehicule ──

    // 4. VEHICLE_DEPENDENT — score par signaux (WARNING)
    const vehicleDependencyScore = R5_VEHICLE_DEPENDENCY_SIGNALS.reduce(
      (score, pattern) => score + (pattern.test(allText) ? 1 : 0),
      0,
    );
    if (vehicleDependencyScore >= 1) {
      flags.push('VEHICLE_DEPENDENT');
    }

    // 5. AFTER_REPAIR_TOPIC — sujet "apres reparation" (WARNING)
    const isAfterRepair = R5_AFTER_REPAIR_PATTERNS.some((p) => p.test(allText));
    if (isAfterRepair) {
      flags.push('AFTER_REPAIR_TOPIC');
    }

    // ── Qualite contenu ──

    // 6. VAGUE_PROMISE — symptom trop court ou generique
    const symptomText = diag.symptom_description || '';
    const isGeneric = R5_GENERIC_PATTERNS.some((p) => p.test(symptomText));
    if (
      symptomText.length < R5_QUALITY_THRESHOLDS.minSymptomLength ||
      isGeneric
    ) {
      flags.push('VAGUE_PROMISE');
    }

    // 7. SHORT_SYMPTOM (WARNING si > 0 mais < seuil)
    if (
      symptomText.length > 0 &&
      symptomText.length < R5_QUALITY_THRESHOLDS.minSymptomLength &&
      !flags.includes('VAGUE_PROMISE')
    ) {
      flags.push('SHORT_SYMPTOM');
    }

    // 8. SHORT_SIGN (WARNING)
    const signText = diag.sign_description || '';
    if (
      signText.length > 0 &&
      signText.length < R5_QUALITY_THRESHOLDS.minSignLength
    ) {
      flags.push('SHORT_SIGN');
    }

    // 9. GENERIC_PAGE — aucun contexte (WARNING)
    if (!diag.ctx_phase?.length && !diag.ctx_temp?.length && !diag.ctx_freq) {
      flags.push('GENERIC_PAGE');
    }

    // 10. NO_DIFFERENTIATION — pas de signe ni actions (WARNING)
    if (
      (!diag.sign_description || diag.sign_description.length < 50) &&
      (!diag.recommended_actions || diag.recommended_actions.length === 0)
    ) {
      flags.push('NO_DIFFERENTIATION');
    }

    // ── Champs obligatoires ──

    // 11. MISSING_SAFETY_GATE (BLOCKING)
    if (!diag.safety_gate || diag.safety_gate === ('none' as string)) {
      // 'none' is a valid value — only flag if truly empty
      if (!diag.safety_gate) {
        flags.push('MISSING_SAFETY_GATE');
      }
    }

    // 12. MISSING_ACTIONS (BLOCKING)
    if (
      !diag.recommended_actions ||
      diag.recommended_actions.length < R5_QUALITY_THRESHOLDS.minActionsCount
    ) {
      flags.push('MISSING_ACTIONS');
    }

    // 13. DTC_WITHOUT_CODES (BLOCKING)
    if (
      diag.observable_type === 'dtc' &&
      (!diag.dtc_codes || diag.dtc_codes.length === 0)
    ) {
      flags.push('DTC_WITHOUT_CODES');
    }

    // 14. MISSING_RISK_LEVEL (WARNING)
    if (!diag.risk_level) {
      flags.push('MISSING_RISK_LEVEL');
    }

    // 15. MISSING_GAMMES (WARNING)
    if (
      !diag.related_gammes ||
      diag.related_gammes.length < R5_QUALITY_THRESHOLDS.minGammesCount
    ) {
      flags.push('MISSING_GAMMES');
    }

    // ── Maillage (WARNINGs) ──

    if (
      !diag.related_blog_articles ||
      diag.related_blog_articles.length === 0
    ) {
      flags.push('NO_R3_LINK');
    }
    if (!diag.related_references || diag.related_references.length === 0) {
      flags.push('NO_R4_LINK');
    }

    // ── Meta (WARNING) ──

    const metaLen = (diag.meta_description || '').length;
    if (
      metaLen > 0 &&
      (metaLen < R5_QUALITY_THRESHOLDS.minMetaDescLength ||
        metaLen > R5_QUALITY_THRESHOLDS.maxMetaDescLength)
    ) {
      flags.push('META_LENGTH');
    }

    // ── Cost estimate (WARNING) ──

    if (!diag.estimated_repair_cost_min && !diag.estimated_repair_cost_max) {
      flags.push('MISSING_COST_ESTIMATE');
    }

    // ── Context partial (WARNING) ──

    const contextFields = [diag.ctx_phase, diag.ctx_temp].filter(
      (f) => f && f.length > 0,
    ).length;
    if (contextFields > 0 && contextFields < 2 && !diag.ctx_freq) {
      flags.push('MISSING_CONTEXT');
    }

    // ── Scoring ──

    const blockingCount = flags.filter((f) =>
      (R5_BLOCKING_FLAGS as readonly string[]).includes(f),
    ).length;
    const warningCount = flags.filter((f) =>
      (R5_WARNING_FLAGS as readonly string[]).includes(f),
    ).length;
    const score = Math.max(0, 12 - blockingCount * 2 - warningCount);

    // ── Surface recommendation ──

    let surfaceRecommendation: SurfaceTarget | null = null;
    if (flags.includes('R3_ANGLE_LEAK')) {
      surfaceRecommendation = 'R3';
    } else if (flags.includes('R4_ANGLE_LEAK')) {
      surfaceRecommendation = 'R4';
    } else if (
      vehicleDependencyScore >=
      R5_QUALITY_THRESHOLDS.vehicleDependencyBlockingScore
    ) {
      surfaceRecommendation = 'TOOL';
    } else if (isAfterRepair) {
      surfaceRecommendation = 'R3';
    }

    return {
      score,
      flags,
      isPublishable: blockingCount === 0,
      vehicleDependencyScore,
      surfaceRecommendation,
    };
  }

  /**
   * Audit qualite de toutes les pages R5 existantes (read-only).
   * Retourne la distribution des scores et flags pour calibrage.
   */
  async qualityAudit(): Promise<{
    total: number;
    publishable: number;
    blocked: number;
    avgScore: number;
    topFlags: Array<{ flag: string; count: number }>;
    details: Array<{
      slug: string;
      title: string;
      score: number;
      flags: string[];
      isPublishable: boolean;
      vehicleDependencyScore: number;
      surfaceRecommendation: string | null;
    }>;
  }> {
    this.logger.log('📊 Running R5 quality audit on all pages...');

    const { data, error } = await this.supabase
      .from('__seo_observable')
      .select('*')
      .order('slug');

    if (error || !data) {
      this.logger.error('❌ Error fetching observables for audit:', error);
      return {
        total: 0,
        publishable: 0,
        blocked: 0,
        avgScore: 0,
        topFlags: [],
        details: [],
      };
    }

    const details = data.map((row) => {
      const diag = this.mapRowToDiagnostic(row);
      const quality = this.validateDiagnosticQuality(diag);
      return {
        slug: diag.slug,
        title: diag.title,
        score: quality.score,
        flags: quality.flags,
        isPublishable: quality.isPublishable,
        vehicleDependencyScore: quality.vehicleDependencyScore,
        surfaceRecommendation: quality.surfaceRecommendation,
      };
    });

    // Aggregate flags
    const flagCounts: Record<string, number> = {};
    for (const d of details) {
      for (const f of d.flags) {
        flagCounts[f] = (flagCounts[f] || 0) + 1;
      }
    }
    const topFlags = Object.entries(flagCounts)
      .map(([flag, count]) => ({ flag, count }))
      .sort((a, b) => b.count - a.count);

    const publishable = details.filter((d) => d.isPublishable).length;
    const avgScore =
      details.length > 0
        ? +(
            details.reduce((sum, d) => sum + d.score, 0) / details.length
          ).toFixed(1)
        : 0;

    return {
      total: details.length,
      publishable,
      blocked: details.length - publishable,
      avgScore,
      topFlags,
      details: details.sort((a, b) => a.score - b.score),
    };
  }

  /**
   * Met à jour un diagnostic (draft ou publié)
   * @param slug - Le slug du diagnostic
   * @param updates - Les champs à mettre à jour
   * @returns Succès ou échec
   */
  async update(
    slug: string,
    updates: Partial<{
      title: string;
      meta_description: string;
      symptom_description: string;
      sign_description: string;
      observable_type: string;
      perception_channel: string;
      risk_level: string;
      safety_gate: string;
      dtc_codes: string[];
      dtc_descriptions: Record<string, string>;
      recommended_actions: Array<{
        action: string;
        urgency: string;
        skill_level: string;
        duration: string;
      }>;
      estimated_repair_cost_min: number;
      estimated_repair_cost_max: number;
      estimated_repair_duration: string;
    }>,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`✏️ Updating diagnostic: ${slug}`);

    const { error } = await this.supabase
      .from('__seo_observable')
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
   * Supprime un diagnostic draft (non publié)
   * @param slug - Le slug du diagnostic à supprimer
   * @returns Succès ou échec
   */
  async deleteDraft(
    slug: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`🗑️ Deleting draft diagnostic: ${slug}`);

    // Vérifier que c'est bien un draft
    const { data: existing } = await this.supabase
      .from('__seo_observable')
      .select('is_published')
      .eq('slug', slug)
      .single();

    if (existing?.is_published) {
      return { success: false, error: 'Cannot delete published diagnostic' };
    }

    const { error } = await this.supabase
      .from('__seo_observable')
      .delete()
      .eq('slug', slug);

    if (error) {
      this.logger.error(`❌ Error deleting ${slug}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Refresh a diagnostic from RAG knowledge files.
   * Called by ContentRefreshProcessor for R5_diagnostic jobs.
   *
   * @param diagnosticSlug - The slug of the diagnostic (e.g., "bruit-embrayage")
   * @returns Result with skipped/updated/confidence/flags
   */
  async refreshFromRag(diagnosticSlug: string): Promise<{
    skipped: boolean;
    updated: boolean;
    confidence: number;
    flags: string[];
  }> {
    // 1. Look up the observable by slug
    const { data: observable, error } = await this.supabase
      .from('__seo_observable')
      .select('id, slug, cluster_id, symptom_description, sign_description')
      .eq('slug', diagnosticSlug)
      .single();

    if (error || !observable) {
      this.logger.warn(
        `refreshFromRag: observable not found for slug=${diagnosticSlug}`,
      );
      return {
        skipped: true,
        updated: false,
        confidence: 0,
        flags: ['OBSERVABLE_NOT_FOUND'],
      };
    }

    // 2. Find matching RAG file via cluster_id (e.g., "embrayage" → "embrayage.md")
    const clusterId = observable.cluster_id as string | null;
    const slugBase = diagnosticSlug.split('-').slice(1).join('-'); // "bruit-embrayage" → "embrayage"

    // Try cluster_id first, then slug-derived name
    const candidates = [clusterId, slugBase, diagnosticSlug].filter(
      Boolean,
    ) as string[];
    let ragData: ReturnType<typeof this.parseRagDiagnosticFile> = null;
    for (const candidate of candidates) {
      ragData = this.parseRagDiagnosticFile(candidate);
      if (ragData) break;
    }

    if (
      !ragData ||
      (ragData.symptoms.length === 0 && ragData.causes.length === 0)
    ) {
      return {
        skipped: true,
        updated: false,
        confidence: 0,
        flags: ['NO_DIAGNOSTIC_RAG_DOC'],
      };
    }

    // 3. Build updated fields
    const flags: string[] = [];
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (ragData.symptoms.length > 0) {
      updates.symptom_description = ragData.symptoms
        .map(
          (s) =>
            `<p><strong>${s.label}</strong> — ${s.when}. ${s.characteristic}.</p>`,
        )
        .join('\n');
      flags.push('SYMPTOMS_UPDATED');
    }

    if (ragData.causes.length > 0) {
      updates.sign_description = ragData.causes
        .map(
          (c) =>
            `<p><strong>${c.name}</strong> (probabilité: ${c.probability}) — ${c.solution}.</p>`,
        )
        .join('\n');
      flags.push('CAUSES_UPDATED');

      updates.recommended_actions = ragData.causes.slice(0, 4).map((cause) => ({
        action: cause.solution,
        urgency: cause.urgency.toLowerCase().includes('haute')
          ? 'high'
          : 'medium',
        skill_level: 'professional',
        duration: '1-2h',
      }));
      flags.push('ACTIONS_UPDATED');
    }

    // 4. Update the observable
    // ── P1.5 v2.1: Route through WriteGate (merge + anti-regression) ──
    if (this.writeGate && this.featureFlags?.writeGuardEnabled) {
      const result = await this.writeGate.writeToTarget({
        roleId: RoleId.R5_DIAGNOSTIC,
        target: 'r5_diagnostic_main' as ResourceGroup,
        pkValue: observable.id,
        payload: updates,
        correlationId: `r5-${diagnosticSlug}-${Date.now().toString(36)}`,
      });
      if (!result.written) {
        this.logger.warn(
          `WriteGate blocked R5 update for ${diagnosticSlug}: ${result.reason}`,
        );
        return {
          skipped: false,
          updated: false,
          confidence: 0,
          flags: [...flags, 'WRITE_GATE_BLOCKED'],
        };
      }
      this.logger.log(
        `refreshFromRag: updated via WriteGate for ${diagnosticSlug} — ` +
          `fields=${result.fieldsWritten.length} skipped=${result.fieldsSkipped.length}`,
      );
    } else {
      // Legacy path
      const { error: updateError } = await this.supabase
        .from('__seo_observable')
        .update(updates)
        .eq('id', observable.id);

      if (updateError) {
        this.logger.error(
          `refreshFromRag: update failed for ${diagnosticSlug}: ${updateError.message}`,
        );
        return {
          skipped: false,
          updated: false,
          confidence: 0,
          flags: ['UPDATE_FAILED'],
        };
      }
    }

    const confidence =
      ragData.symptoms.length >= 2 && ragData.causes.length >= 2 ? 0.85 : 0.65;

    this.logger.log(
      `refreshFromRag: updated ${diagnosticSlug} — ${ragData.symptoms.length} symptoms, ${ragData.causes.length} causes, confidence=${confidence}`,
    );

    return { skipped: false, updated: true, confidence, flags };
  }

  /**
   * Parse RAG diagnostic file for enriched content
   */
  private parseRagDiagnosticFile(pgAlias: string): {
    symptoms: Array<{ label: string; when: string; characteristic: string }>;
    causes: Array<{
      name: string;
      probability: string;
      solution: string;
      urgency: string;
    }>;
  } | null {
    // Try multiple filename patterns
    const candidates = [
      `${pgAlias}.md`,
      `bruits-${pgAlias}.md`,
      `${pgAlias}-bruits.md`,
    ];

    for (const filename of candidates) {
      const filePath = path.join(this.RAG_DIAGNOSTIC_DIR, filename);
      try {
        if (!fs.existsSync(filePath)) continue;
        const content = fs.readFileSync(filePath, 'utf-8');

        // Extract symptoms (sections with "Quand" and "Caractéristique")
        const symptoms: Array<{
          label: string;
          when: string;
          characteristic: string;
        }> = [];
        const symptomMatches = content.matchAll(
          /###\s+(.+?)\n(?:[\s\S]*?)-\s*\*\*Quand\*\*\s*:\s*(.+?)\n(?:[\s\S]*?)-\s*\*\*Caractéristique\*\*\s*:\s*(.+?)(?:\n|$)/g,
        );
        for (const m of symptomMatches) {
          symptoms.push({
            label: m[1].trim(),
            when: m[2].trim(),
            characteristic: m[3].trim(),
          });
        }

        // Extract causes (sections with "Probabilité", "Solution", "Urgence")
        const causes: Array<{
          name: string;
          probability: string;
          solution: string;
          urgency: string;
        }> = [];
        const causeMatches = content.matchAll(
          /###\s+\d+\.\s+(.+?)\n(?:[\s\S]*?)-\s*\*\*Probabilité\*\*\s*:\s*(.+?)\n(?:[\s\S]*?)-\s*\*\*Solution\*\*\s*:\s*(.+?)\n(?:[\s\S]*?)-\s*\*\*Urgence\*\*\s*:\s*(.+?)(?:\n|$)/g,
        );
        for (const m of causeMatches) {
          causes.push({
            name: m[1].trim(),
            probability: m[2].trim(),
            solution: m[3].trim(),
            urgency: m[4].trim(),
          });
        }

        if (symptoms.length > 0 || causes.length > 0) {
          return { symptoms, causes };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Estimate repair costs based on gamme type
   */
  private estimateRepairCosts(pgAlias: string): {
    min: number;
    max: number;
    duration: string;
  } {
    const costMap: Record<
      string,
      { min: number; max: number; duration: string }
    > = {
      embrayage: { min: 400, max: 900, duration: '3-5h' },
      'kit-d-embrayage': { min: 400, max: 900, duration: '3-5h' },
      freinage: { min: 80, max: 300, duration: '1-2h' },
      distribution: { min: 400, max: 800, duration: '4-6h' },
      suspension: { min: 150, max: 500, duration: '2-3h' },
      amortisseur: { min: 150, max: 400, duration: '1-2h' },
      direction: { min: 200, max: 600, duration: '2-4h' },
      demarreur: { min: 150, max: 400, duration: '1-2h' },
      alternateur: { min: 200, max: 500, duration: '1-3h' },
      turbo: { min: 800, max: 2500, duration: '4-8h' },
      injecteur: { min: 100, max: 400, duration: '1-3h' },
      'pompe-a-eau': { min: 150, max: 400, duration: '2-4h' },
    };

    // Check for partial matches
    for (const [key, costs] of Object.entries(costMap)) {
      if (pgAlias.includes(key) || key.includes(pgAlias)) {
        return costs;
      }
    }

    // Default estimates
    return { min: 80, max: 400, duration: '1-3h' };
  }

  /**
   * Verifie si un slug est bloque par la policy table.
   * Retourne null si autorise, sinon { redirect_to, reason }.
   */
  private async checkPolicyGate(
    slug: string,
  ): Promise<{ redirect_to: string; reason: string } | null> {
    // Check 1: slug is in accepted_aliases of another topic
    const { data: aliasMatch } = await this.supabase
      .from('__seo_observable_policy')
      .select('canonical_topic, redirect_to, surface_owner')
      .contains('accepted_aliases', [slug])
      .limit(1);

    if (aliasMatch && aliasMatch.length > 0) {
      const match = aliasMatch[0];
      return {
        redirect_to: (match.redirect_to || match.surface_owner) as string,
        reason: `Alias of ${match.canonical_topic}`,
      };
    }

    // Check 2: slug matches a blocked policy entry
    const { data: directMatch } = await this.supabase
      .from('__seo_observable_policy')
      .select(
        'canonical_topic, redirect_to, surface_owner, is_allowed_in_r5, vehicle_dependency',
      )
      .eq('canonical_topic', slug)
      .limit(1);

    if (directMatch && directMatch.length > 0) {
      const policy = directMatch[0];
      if (!policy.is_allowed_in_r5) {
        return {
          redirect_to: (policy.redirect_to || policy.surface_owner) as string,
          reason: `Policy: vehicle_dependency=${policy.vehicle_dependency}`,
        };
      }
    }

    return null;
  }

  /**
   * Mappe une ligne de la base de donnees vers un SeoDiagnostic complet
   */
  private mapRowToDiagnostic(row: Record<string, unknown>): SeoDiagnostic {
    return {
      id: row.id as number,
      slug: row.slug as string,
      title: row.title as string,
      meta_description: row.meta_description as string | null,
      canonical_url: row.canonical_url as string | null,
      observable_type: row.observable_type as 'symptom' | 'sign' | 'dtc',
      perception_channel: row.perception_channel as string | null,
      risk_level: row.risk_level as 'confort' | 'securite' | 'critique',
      safety_gate: (row.safety_gate || 'none') as SeoDiagnostic['safety_gate'],
      symptom_description: row.symptom_description as string | null,
      sign_description: row.sign_description as string | null,
      dtc_codes: row.dtc_codes as string[] | null,
      dtc_descriptions: row.dtc_descriptions as Record<string, string> | null,
      ctx_phase: row.ctx_phase as string[] | null,
      ctx_temp: row.ctx_temp as string[] | null,
      ctx_freq: row.ctx_freq as string | null,
      cluster_id: row.cluster_id as string | null,
      related_references: row.related_references as string[] | null,
      related_gammes: row.related_gammes as number[] | null,
      related_blog_articles: row.related_blog_articles as string[] | null,
      recommended_actions: row.recommended_actions as Array<{
        action: string;
        urgency: string;
        skill_level: string;
        duration: string;
      }> | null,
      estimated_repair_cost_min: row.estimated_repair_cost_min as number | null,
      estimated_repair_cost_max: row.estimated_repair_cost_max as number | null,
      estimated_repair_duration: row.estimated_repair_duration as string | null,
      differentiation_checklist:
        row.differentiation_checklist as SeoDiagnostic['differentiation_checklist'],
      consultation_triggers:
        row.consultation_triggers as SeoDiagnostic['consultation_triggers'],
      do_dont_list: row.do_dont_list as SeoDiagnostic['do_dont_list'],
      schema_org: row.schema_org as Record<string, unknown> | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  /**
   * Mappe une ligne vers un SeoDiagnosticListItem (version legere)
   */
  private mapRowToListItem(
    row: Record<string, unknown>,
  ): SeoDiagnosticListItem {
    return {
      slug: row.slug as string,
      title: row.title as string,
      meta_description: row.meta_description as string | null,
      observable_type: row.observable_type as 'symptom' | 'sign' | 'dtc',
      perception_channel: row.perception_channel as string | null,
      risk_level: row.risk_level as 'confort' | 'securite' | 'critique',
      safety_gate: (row.safety_gate || 'none') as SeoDiagnostic['safety_gate'],
      cluster_id: row.cluster_id as string | null,
    };
  }
}
