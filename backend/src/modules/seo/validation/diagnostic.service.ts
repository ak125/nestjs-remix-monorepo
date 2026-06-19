import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { RpcGateService } from '@security/rpc-gate/rpc-gate.service';
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

  constructor(rpcGate: RpcGateService) {
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
