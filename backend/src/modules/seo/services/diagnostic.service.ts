import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
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
  recommended_actions: Array<{
    action: string;
    urgency: string;
    skill_level: string;
    duration: string;
  }> | null;
  estimated_repair_cost_min: number | null;
  estimated_repair_cost_max: number | null;
  estimated_repair_duration: string | null;
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
 * Service pour gerer les pages Diagnostic (R5)
 * Observable Pro : Symptom (60%) / Sign (85%) / DTC (95%)
 */
@Injectable()
export class DiagnosticService extends SupabaseBaseService {
  protected override readonly logger = new Logger(DiagnosticService.name);
  private readonly RAG_DIAGNOSTIC_DIR =
    '/opt/automecanik/rag/knowledge/diagnostic';

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

    const baseUrl = 'https://www.automecanik.com';
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
   * Publie un diagnostic (is_published: true)
   * @param slug - Le slug du diagnostic à publier
   * @returns Succès ou échec
   */
  async publish(slug: string): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`📢 Publishing diagnostic: ${slug}`);

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
      recommended_actions: row.recommended_actions as Array<{
        action: string;
        urgency: string;
        skill_level: string;
        duration: string;
      }> | null,
      estimated_repair_cost_min: row.estimated_repair_cost_min as number | null,
      estimated_repair_cost_max: row.estimated_repair_cost_max as number | null,
      estimated_repair_duration: row.estimated_repair_duration as string | null,
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
