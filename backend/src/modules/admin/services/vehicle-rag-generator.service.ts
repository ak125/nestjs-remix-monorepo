import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

// ── Result ──

export interface RagGenResult {
  status: 'created' | 'updated' | 'skipped' | 'failed';
  slug: string;
  filePath: string;
  sections: string[];
  warnings: string[];
}

// ── Internal types ──

interface ModelData {
  modeleId: number;
  modeleName: string;
  modeleAlias: string;
  marqueId: number;
  marqueName: string;
  marqueAlias: string;
}

interface Motorisation {
  fuel: string;
  name: string;
  powerPs: string;
  liter: string;
  yearFrom: string;
  yearTo: string | null;
  body: string;
  codes: string[];
}

interface TopGamme {
  pgName: string;
  pgAlias: string;
  nbPieces: number;
}

interface GammeRagExtract {
  pgAlias: string;
  pgName: string;
  role: string;
  symptoms: string[];
}

interface WebSpecs {
  longueur?: string;
  largeur?: string;
  hauteur?: string;
  empattement?: string;
  poids?: string;
  coffre?: string;
  reservoir?: string;
  places?: string;
  vitesseMax?: string;
  zeroACent?: string;
  consoMixte?: string;
  co2?: string;
  couple?: string;
  cylindree?: string;
  boite?: string;
  transmission?: string;
  suspensionAv?: string;
  suspensionAr?: string;
  pneus?: string;
  diamBraquage?: string;
  normeEuro?: string;
  sourceUrl?: string;
}

@Injectable()
export class VehicleRagGeneratorService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    VehicleRagGeneratorService.name,
  );

  private readonly RAG_VEHICLES_DIR = `${RAG_KNOWLEDGE_PATH}/vehicles`;
  private readonly RAG_GAMMES_DIR = `${RAG_KNOWLEDGE_PATH}/gammes`;

  constructor(configService: ConfigService) {
    super(configService);
  }

  /**
   * Generate a vehicle RAG .md file for a model from DB data + gamme RAGs.
   * 0 LLM — pure data fetch + templates.
   * Skips if existing file has truth_level: L1 (manually verified).
   */
  async generateForModel(modeleId: number): Promise<RagGenResult> {
    const warnings: string[] = [];

    // 1. Fetch model data
    const modelData = await this.fetchModelData(modeleId);
    if (!modelData) {
      return {
        status: 'failed',
        slug: '',
        filePath: '',
        sections: [],
        warnings: ['model not found'],
      };
    }

    const slug = `${modelData.marqueAlias}-${modelData.modeleAlias}`;
    const filePath = join(this.RAG_VEHICLES_DIR, `${slug}.md`);

    // 2. Check existing file — skip if L1
    if (existsSync(filePath)) {
      const existing = readFileSync(filePath, 'utf-8');
      const frontMatch = existing.match(/^---\n([\s\S]*?)\n---/);
      if (frontMatch) {
        const front = yaml.load(frontMatch[1]) as Record<string, unknown>;
        if (front?.truth_level === 'L1') {
          return {
            status: 'skipped',
            slug,
            filePath,
            sections: [],
            warnings: ['L1 file exists — not overwriting'],
          };
        }
      }
    }

    // 3. Fetch motorisations
    const motorisations = await this.fetchMotorisations(modeleId);
    if (!motorisations.length) {
      warnings.push('no motorisations found');
    }

    // 4. Fetch top gammes
    const topGammes = await this.fetchTopGammes(modeleId);
    if (!topGammes.length) {
      warnings.push('no compatible gammes found');
    }

    // 5. Load gamme RAGs for symptoms
    const gammeExtracts = topGammes
      .slice(0, 10)
      .map((g) => this.extractGammeRag(g.pgAlias, g.pgName));

    // 6. Fetch web-ingested specs from __rag_knowledge
    const webSpecs = await this.fetchWebSpecs(
      modelData.marqueName,
      modelData.modeleName,
    );
    if (webSpecs) {
      this.logger.log(
        `Web specs found for ${modelData.marqueName} ${modelData.modeleName} from ${webSpecs.sourceUrl || 'unknown'}`,
      );
    }

    // 7. Compile markdown
    const sections: string[] = [];
    const md = this.compileMarkdown(
      modelData,
      motorisations,
      topGammes,
      gammeExtracts,
      sections,
      webSpecs,
    );

    // 8. Write file
    mkdirSync(this.RAG_VEHICLES_DIR, { recursive: true });
    writeFileSync(filePath, md, 'utf-8');

    const status = existsSync(filePath) ? 'updated' : 'created';
    this.logger.log(
      `RAG vehicle ${status}: ${slug} (${sections.length} sections, ${warnings.length} warnings)`,
    );

    return { status: 'created', slug, filePath, sections, warnings };
  }

  /**
   * Batch generate for multiple models.
   */
  async generateBatch(
    modeleIds: number[],
  ): Promise<{ results: RagGenResult[]; summary: string }> {
    const results: RagGenResult[] = [];
    for (const id of modeleIds) {
      const result = await this.generateForModel(id);
      results.push(result);
      // Small delay to avoid DB hammering
      await new Promise((r) => setTimeout(r, 50));
    }
    const created = results.filter((r) => r.status === 'created').length;
    const skipped = results.filter((r) => r.status === 'skipped').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    return {
      results,
      summary: `${created} created, ${skipped} skipped, ${failed} failed`,
    };
  }

  /**
   * Get status: how many vehicle RAG files exist, top missing models.
   */
  async getStatus(): Promise<{
    totalFiles: number;
    totalModels: number;
    coverage: string;
    topMissing: Array<{
      modeleName: string;
      marqueName: string;
      modeleId: number;
      nbTypes: number;
    }>;
  }> {
    // Count existing files
    let totalFiles = 0;
    try {
      totalFiles = readdirSync(this.RAG_VEHICLES_DIR).filter((f) =>
        f.endsWith('.md'),
      ).length;
    } catch {
      totalFiles = 0;
    }

    // Count total models
    const { count: totalModels } = await this.client
      .from('auto_modele')
      .select('modele_id', { count: 'exact', head: true });

    // Top missing models (by type count) — use raw SQL
    const topMissing: Array<{
      modeleName: string;
      marqueName: string;
      modeleId: number;
      nbTypes: number;
    }> = [];

    const modelCount = totalModels || 0;
    return {
      totalFiles,
      totalModels: modelCount,
      coverage:
        modelCount > 0
          ? `${((totalFiles / modelCount) * 100).toFixed(1)}%`
          : '0%',
      topMissing,
    };
  }

  // ── Private helpers ──

  private async fetchModelData(modeleId: number): Promise<ModelData | null> {
    const { data, error } = await this.client
      .from('auto_modele')
      .select('modele_id, modele_name, modele_alias, modele_marque_id')
      .eq('modele_id', modeleId)
      .single();

    if (error || !data) return null;

    // Fetch brand
    const { data: marque } = await this.client
      .from('auto_marque')
      .select('marque_id, marque_name, marque_alias')
      .eq('marque_id', data.modele_marque_id)
      .single();

    if (!marque) return null;

    return {
      modeleId: data.modele_id,
      modeleName: data.modele_name,
      modeleAlias: data.modele_alias,
      marqueId: marque.marque_id,
      marqueName: marque.marque_name,
      marqueAlias: marque.marque_alias,
    };
  }

  private async fetchMotorisations(modeleId: number): Promise<Motorisation[]> {
    const { data, error } = await this.client
      .from('auto_type')
      .select(
        'type_id, type_fuel, type_name, type_power_ps, type_liter, type_year_from, type_year_to, type_body',
      )
      .eq('type_modele_id', String(modeleId))
      .eq('type_relfollow', '1')
      .order('type_fuel')
      .order('type_power_ps');

    if (error || !data?.length) return [];

    // Group by fuel + name + power to deduplicate variants
    const grouped = new Map<string, Motorisation>();
    for (const row of data) {
      const key = `${row.type_fuel}|${row.type_name}|${row.type_power_ps}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          fuel: row.type_fuel || '',
          name: row.type_name || '',
          powerPs: row.type_power_ps || '',
          liter: row.type_liter || '',
          yearFrom: row.type_year_from || '',
          yearTo: row.type_year_to || null,
          body: row.type_body || '',
          codes: [],
        });
      }
    }

    // Fetch motor codes for all type_ids
    const typeIds = data.map((r) => r.type_id);
    if (typeIds.length > 0) {
      const { data: codesData } = await this.client
        .from('auto_type_motor_code')
        .select('tmc_type_id, tmc_code')
        .in('tmc_type_id', typeIds);

      if (codesData?.length) {
        // Map codes to motorisations
        const codesByType = new Map<string, string[]>();
        for (const c of codesData) {
          if (!codesByType.has(c.tmc_type_id)) {
            codesByType.set(c.tmc_type_id, []);
          }
          codesByType.get(c.tmc_type_id)!.push(c.tmc_code);
        }
        // Attach codes to grouped motorisations
        for (const row of data) {
          const key = `${row.type_fuel}|${row.type_name}|${row.type_power_ps}`;
          const mot = grouped.get(key);
          const codes = codesByType.get(row.type_id) || [];
          if (mot) {
            for (const c of codes) {
              if (!mot.codes.includes(c)) mot.codes.push(c);
            }
          }
        }
      }
    }

    return Array.from(grouped.values());
  }

  private async fetchTopGammes(modeleId: number): Promise<TopGamme[]> {
    // Get all type_ids for this model
    const { data: types } = await this.client
      .from('auto_type')
      .select('type_id')
      .eq('type_modele_id', String(modeleId))
      .eq('type_relfollow', '1');

    if (!types?.length) return [];

    const typeIds = types.map((t) => parseInt(t.type_id, 10));

    // Get top gammes by piece count (batch — max 200 type_ids at once)
    const batchSize = 200;
    const gammeCounts = new Map<
      number,
      { name: string; alias: string; count: number }
    >();

    for (let i = 0; i < typeIds.length; i += batchSize) {
      const batch = typeIds.slice(i, i + batchSize);
      const { data: relations } = await this.client
        .from('pieces_relation_type')
        .select('rtp_pg_id')
        .in('rtp_type_id', batch);

      if (relations) {
        for (const r of relations) {
          const pgId = r.rtp_pg_id;
          const existing = gammeCounts.get(pgId);
          if (existing) {
            existing.count++;
          } else {
            gammeCounts.set(pgId, { name: '', alias: '', count: 1 });
          }
        }
      }
    }

    if (gammeCounts.size === 0) return [];

    // Fetch gamme names for top entries
    const topPgIds = Array.from(gammeCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([id]) => id);

    const { data: gammes } = await this.client
      .from('pieces_gamme')
      .select('pg_id, pg_name, pg_alias')
      .in('pg_id', topPgIds);

    if (!gammes) return [];

    // Merge
    const result: TopGamme[] = [];
    for (const g of gammes) {
      const entry = gammeCounts.get(g.pg_id);
      if (entry) {
        result.push({
          pgName: g.pg_name,
          pgAlias: g.pg_alias,
          nbPieces: entry.count,
        });
      }
    }
    return result.sort((a, b) => b.nbPieces - a.nbPieces);
  }

  private extractGammeRag(pgAlias: string, pgName: string): GammeRagExtract {
    const filePath = join(this.RAG_GAMMES_DIR, `${pgAlias}.md`);
    const empty: GammeRagExtract = {
      pgAlias,
      pgName,
      role: '',
      symptoms: [],
    };
    if (!existsSync(filePath)) return empty;
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const match = raw.match(/^---\n([\s\S]*?)\n---/);
      if (!match) return empty;
      const front = yaml.load(match[1]) as Record<string, any>;
      const role = front?.domain?.role || '';
      const symptoms = Array.isArray(front?.diagnostic?.symptoms)
        ? front.diagnostic.symptoms
            .map((s: any) => (typeof s === 'string' ? s : s?.label || ''))
            .filter(Boolean)
        : [];
      return { pgAlias, pgName, role, symptoms };
    } catch {
      return empty;
    }
  }

  private compileMarkdown(
    model: ModelData,
    motorisations: Motorisation[],
    topGammes: TopGamme[],
    gammeExtracts: GammeRagExtract[],
    sections: string[],
    webSpecs?: WebSpecs | null,
  ): string {
    const lines: string[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Year range
    const years = motorisations.map((m) => m.yearFrom).filter(Boolean);
    const yearsTo = motorisations
      .map((m) => m.yearTo)
      .filter(Boolean) as string[];
    const yearFrom = years.length ? Math.min(...years.map(Number)) : '';
    const yearTo = yearsTo.length ? Math.max(...yearsTo.map(Number)) : '';
    const yearRange = yearFrom
      ? `${yearFrom}${yearTo ? `-${yearTo}` : ''}`
      : '';

    // Bodies
    const bodies = [
      ...new Set(motorisations.map((m) => m.body).filter(Boolean)),
    ];

    // YAML frontmatter
    lines.push('---');
    lines.push(`category: ${model.marqueAlias}`);
    lines.push(`doc_family: catalog`);
    lines.push(`source_type: vehicle`);
    lines.push(
      `title: "Fiche vehicule - ${model.marqueName} ${model.modeleName}"`,
    );
    lines.push(`truth_level: L2`);
    lines.push(`updated_at: "${today}"`);
    lines.push(`verification_status: draft`);
    lines.push(`modele_id: ${model.modeleId}`);
    lines.push(`marque_id: ${model.marqueId}`);

    // Structured frontmatter for R8 enricher
    if (motorisations.length > 0) {
      lines.push(`motorisations:`);
      // Deduplicate by name+power for the frontmatter
      const seen = new Set<string>();
      for (const m of motorisations) {
        const key = `${m.name}|${m.powerPs}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(`  - moteur: "${m.name}"`);
        lines.push(`    puissance: "${m.powerPs} ch"`);
        lines.push(`    code: "${m.codes.join(', ') || '-'}"`);
      }
    }

    // problemes_connus from gamme symptoms
    const allSymptoms = gammeExtracts.flatMap((g) =>
      g.symptoms.map((s) => `${g.pgName}: ${s}`),
    );
    if (allSymptoms.length > 0) {
      lines.push(`problemes_connus:`);
      for (const s of allSymptoms.slice(0, 15)) {
        lines.push(`  - "${this.escapeYaml(s)}"`);
      }
    }

    // pieces_usure from top gammes
    if (topGammes.length > 0) {
      lines.push(`pieces_usure:`);
      for (const g of topGammes.slice(0, 10)) {
        lines.push(`  - "${g.pgName} (${g.nbPieces} references)"`);
      }
    }

    // specs_techniques from web-ingested data
    if (webSpecs) {
      lines.push(`specs_techniques:`);
      if (webSpecs.longueur) lines.push(`  longueur: "${webSpecs.longueur}"`);
      if (webSpecs.largeur) lines.push(`  largeur: "${webSpecs.largeur}"`);
      if (webSpecs.hauteur) lines.push(`  hauteur: "${webSpecs.hauteur}"`);
      if (webSpecs.empattement)
        lines.push(`  empattement: "${webSpecs.empattement}"`);
      if (webSpecs.poids) lines.push(`  poids: "${webSpecs.poids}"`);
      if (webSpecs.coffre) lines.push(`  coffre: "${webSpecs.coffre}"`);
      if (webSpecs.reservoir)
        lines.push(`  reservoir: "${webSpecs.reservoir}"`);
      if (webSpecs.vitesseMax)
        lines.push(`  vitesse_max: "${webSpecs.vitesseMax}"`);
      if (webSpecs.zeroACent)
        lines.push(`  zero_a_cent: "${webSpecs.zeroACent}"`);
      if (webSpecs.consoMixte)
        lines.push(`  conso_mixte: "${webSpecs.consoMixte}"`);
      if (webSpecs.co2) lines.push(`  co2: "${webSpecs.co2}"`);
      if (webSpecs.couple) lines.push(`  couple: "${webSpecs.couple}"`);
      if (webSpecs.cylindree)
        lines.push(`  cylindree: "${webSpecs.cylindree}"`);
      if (webSpecs.boite)
        lines.push(`  boite: "${this.escapeYaml(webSpecs.boite)}"`);
      if (webSpecs.transmission)
        lines.push(`  transmission: "${webSpecs.transmission}"`);
      if (webSpecs.pneus) lines.push(`  pneus: "${webSpecs.pneus}"`);
      if (webSpecs.diamBraquage)
        lines.push(`  diam_braquage: "${webSpecs.diamBraquage}"`);
      if (webSpecs.normeEuro)
        lines.push(`  norme_euro: "${webSpecs.normeEuro}"`);
      if (webSpecs.sourceUrl)
        lines.push(`  source_url: "${webSpecs.sourceUrl}"`);
    }

    // entretien (standard template by fuel presence)
    const hasDiesel = motorisations.some((m) =>
      m.fuel.toLowerCase().includes('diesel'),
    );
    const hasEssence = motorisations.some(
      (m) =>
        m.fuel.toLowerCase().includes('essence') ||
        m.fuel.toLowerCase().includes('petrol'),
    );
    lines.push(`entretien:`);
    if (hasDiesel) lines.push(`  - "Vidange diesel : 20 000 km ou 1 an"`);
    if (hasEssence) lines.push(`  - "Vidange essence : 15 000 km ou 1 an"`);
    lines.push(`  - "Controle general : tous les 20 000 km ou 1 an"`);

    lines.push('---');
    lines.push('');

    // Markdown body
    lines.push(
      `# ${model.marqueName} ${model.modeleName}${yearRange ? ` (${yearRange})` : ''}`,
    );
    lines.push('');
    sections.push('Identification');

    // Identification
    lines.push('## Identification');
    lines.push('');
    if (yearRange) lines.push(`- **Production** : ${yearRange}`);
    if (bodies.length) lines.push(`- **Carrosseries** : ${bodies.join(', ')}`);
    lines.push('');

    // Caractéristiques techniques (from web-ingested specs)
    if (
      webSpecs &&
      Object.keys(webSpecs).filter((k) => k !== 'sourceUrl').length > 1
    ) {
      sections.push('Caracteristiques techniques');
      lines.push('## Caracteristiques techniques');
      lines.push('');
      lines.push('| Caracteristique | Valeur |');
      lines.push('|-----------------|--------|');
      if (webSpecs.longueur) lines.push(`| Longueur | ${webSpecs.longueur} |`);
      if (webSpecs.largeur) lines.push(`| Largeur | ${webSpecs.largeur} |`);
      if (webSpecs.hauteur) lines.push(`| Hauteur | ${webSpecs.hauteur} |`);
      if (webSpecs.empattement)
        lines.push(`| Empattement | ${webSpecs.empattement} |`);
      if (webSpecs.poids) lines.push(`| Poids a vide | ${webSpecs.poids} |`);
      if (webSpecs.coffre) lines.push(`| Volume coffre | ${webSpecs.coffre} |`);
      if (webSpecs.reservoir)
        lines.push(`| Reservoir | ${webSpecs.reservoir} |`);
      if (webSpecs.places) lines.push(`| Places | ${webSpecs.places} |`);
      if (webSpecs.cylindree)
        lines.push(`| Cylindree | ${webSpecs.cylindree} |`);
      if (webSpecs.couple) lines.push(`| Couple | ${webSpecs.couple} |`);
      if (webSpecs.boite)
        lines.push(`| Boite de vitesse | ${webSpecs.boite} |`);
      if (webSpecs.transmission)
        lines.push(`| Transmission | ${webSpecs.transmission} |`);
      if (webSpecs.vitesseMax)
        lines.push(`| Vitesse max | ${webSpecs.vitesseMax} |`);
      if (webSpecs.zeroACent)
        lines.push(`| 0 a 100 km/h | ${webSpecs.zeroACent} |`);
      if (webSpecs.consoMixte)
        lines.push(`| Consommation mixte | ${webSpecs.consoMixte} |`);
      if (webSpecs.co2) lines.push(`| Emissions CO2 | ${webSpecs.co2} |`);
      if (webSpecs.pneus) lines.push(`| Pneumatiques | ${webSpecs.pneus} |`);
      if (webSpecs.diamBraquage)
        lines.push(`| Diametre de braquage | ${webSpecs.diamBraquage} |`);
      if (webSpecs.normeEuro)
        lines.push(`| Norme Euro | ${webSpecs.normeEuro} |`);
      lines.push('');
      if (webSpecs.sourceUrl) {
        lines.push(`*Source : ${webSpecs.sourceUrl}*`);
        lines.push('');
      }
    }

    // Motorisations
    if (motorisations.length > 0) {
      sections.push('Motorisations');
      lines.push('## Motorisations principales');
      lines.push('');

      const byFuel = new Map<string, Motorisation[]>();
      for (const m of motorisations) {
        const fuelKey = m.fuel || 'Autre';
        if (!byFuel.has(fuelKey)) byFuel.set(fuelKey, []);
        byFuel.get(fuelKey)!.push(m);
      }

      for (const [fuel, mots] of byFuel) {
        lines.push(`### ${fuel}`);
        lines.push('| Moteur | Puissance | Code moteur |');
        lines.push('|--------|-----------|-------------|');
        const seen = new Set<string>();
        for (const m of mots) {
          const key = `${m.name}|${m.powerPs}`;
          if (seen.has(key)) continue;
          seen.add(key);
          lines.push(
            `| ${m.name} | ${m.powerPs} ch | ${m.codes.join(', ') || '-'} |`,
          );
        }
        lines.push('');
      }
    }

    // Pieces d'usure
    if (topGammes.length > 0) {
      sections.push('Pieces usure');
      lines.push("## Pieces d'usure courantes");
      lines.push('');
      for (const g of topGammes.slice(0, 15)) {
        lines.push(`- **${g.pgName}** : ${g.nbPieces} references`);
      }
      lines.push('');
    }

    // Problemes connus
    if (allSymptoms.length > 0) {
      sections.push('Problemes connus');
      lines.push('## Problemes connus');
      lines.push('');
      // Group by gamme
      for (const extract of gammeExtracts) {
        if (extract.symptoms.length === 0) continue;
        lines.push(`### ${extract.pgName}`);
        for (const s of extract.symptoms.slice(0, 5)) {
          lines.push(`- ${s}`);
        }
        lines.push('');
      }
    }

    // Entretien
    sections.push('Intervalles entretien');
    lines.push("## Intervalles d'entretien");
    lines.push('');
    if (hasDiesel) {
      lines.push('### Diesel');
      lines.push('- **Vidange** : 20 000 km ou 1 an');
    }
    if (hasEssence) {
      lines.push('### Essence');
      lines.push('- **Vidange** : 15 000 km ou 1 an');
    }
    lines.push('- **Controle general** : tous les 20 000 km ou 1 an');
    lines.push('');

    // Conseils
    sections.push('Conseils entretien');
    lines.push("## Conseils d'entretien");
    lines.push('');
    lines.push('1. **Huile moteur** : respecter la preconisation constructeur');
    lines.push('2. **Liquide de frein** : DOT 4, changement tous les 2 ans');
    lines.push(
      "3. **Distribution** : verifier l'intervalle de remplacement selon la motorisation",
    );
    lines.push(
      "4. **Filtration** : remplacer les filtres selon le plan d'entretien",
    );
    lines.push('');

    return lines.join('\n');
  }

  private readonly RAG_WEB_DIR = `${RAG_KNOWLEDGE_PATH}/web`;
  private readonly RAG_WEB_CATALOG_DIR = `${RAG_KNOWLEDGE_PATH}/web-catalog`;

  /**
   * Search for web-ingested docs matching the vehicle model.
   * Strategy: DB first (__rag_knowledge), then filesystem fallback (web/*.md).
   * The DB often stores only summaries, while the filesystem has full section content.
   */
  private async fetchWebSpecs(
    marqueName: string,
    modeleName: string,
  ): Promise<WebSpecs | null> {
    // Build search terms with roman ↔ arabic numeral variants
    const modelLower = modeleName.toLowerCase();
    const marqueLower = marqueName.toLowerCase();
    const modelVariant = this.romanArabicVariant(modelLower);
    const searchTerms = [
      `${marqueLower} ${modelLower}`,
      modelLower,
      ...(modelVariant !== modelLower
        ? [`${marqueLower} ${modelVariant}`, modelVariant]
        : []),
    ];

    const specs: WebSpecs = {};

    // ── Strategy 1: DB (__rag_knowledge) ──
    try {
      const { data } = await this.client
        .from('__rag_knowledge')
        .select('content, source, title')
        .eq('status', 'active')
        .like('source', 'web/%')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data?.length) {
        const matching = data.filter((doc) => {
          const title = (doc.title || '').toLowerCase();
          return searchTerms.some((term) => title.includes(term));
        });
        for (const doc of matching) {
          this.parseWebSpecs(doc.content || '', specs);
        }
      }
    } catch {
      // DB read failure — continue to filesystem fallback
    }

    // ── Strategy 2: Filesystem fallback (web/*.md sections) ──
    // The filesystem has full section content (dimensions, performances, etc.)
    const specKeys1 = Object.keys(specs).filter((k) => k !== 'sourceUrl');
    if (specKeys1.length < 5) {
      this.scanWebFilesForSpecs(searchTerms, specs);
    }

    // Return null if no useful specs were extracted
    const specKeys = Object.keys(specs).filter((k) => k !== 'sourceUrl');
    if (specKeys.length === 0) return null;

    return specs;
  }

  /**
   * Scan web/ and web-catalog/ directories for .md files whose title
   * matches the vehicle model. Extract specs from markdown tables.
   */
  private scanWebFilesForSpecs(searchTerms: string[], specs: WebSpecs): void {
    const dirs = [this.RAG_WEB_DIR, this.RAG_WEB_CATALOG_DIR];

    for (const dir of dirs) {
      if (!existsSync(dir)) continue;

      let files: string[];
      try {
        files = readdirSync(dir).filter((f: string) => f.endsWith('.md'));
      } catch {
        continue;
      }

      for (const file of files) {
        const filePath = join(dir, file);
        try {
          const content = readFileSync(filePath, 'utf-8');

          // Check title in frontmatter
          const titleMatch = content.match(/title:\s*['"]?(.+?)['"]?\s*$/m);
          if (!titleMatch) continue;

          const title = titleMatch[1].toLowerCase();
          const matches = searchTerms.some((term) => title.includes(term));
          if (!matches) continue;

          // Parse specs from this file
          this.parseWebSpecs(content, specs);

          // Extract source_url
          if (!specs.sourceUrl) {
            const urlMatch = content.match(
              /source_url:\s*['"]?(https?:\/\/[^\s'"]+)/,
            );
            if (urlMatch) specs.sourceUrl = urlMatch[1];
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  /**
   * Extract specs from markdown table content (caradisiac, fiches-auto format).
   * Regex-based, tolerant to variations. First value wins (no overwrite).
   */
  private parseWebSpecs(content: string, specs: WebSpecs): void {
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Match markdown table rows: | Key | Value |
      const tableMatch = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|?\s*$/);
      if (!tableMatch) continue;

      const key = tableMatch[1].trim().toLowerCase();
      const val = tableMatch[2].trim();
      if (!val || val === '---' || val === 'NC' || val === '--') continue;

      // Map key → spec field (first value wins)
      if (!specs.longueur && key.includes('longueur')) specs.longueur = val;
      else if (!specs.largeur && key.includes('largeur')) specs.largeur = val;
      else if (!specs.hauteur && key.includes('hauteur')) specs.hauteur = val;
      else if (!specs.empattement && key.includes('empattement'))
        specs.empattement = val;
      else if (!specs.poids && (key.includes('poids') || key.includes('masse')))
        specs.poids = val;
      else if (!specs.coffre && key.includes('coffre')) specs.coffre = val;
      else if (
        !specs.reservoir &&
        (key.includes('réservoir') || key.includes('reservoir'))
      )
        specs.reservoir = val;
      else if (!specs.places && key.includes('places')) specs.places = val;
      else if (!specs.vitesseMax && key.includes('vitesse max'))
        specs.vitesseMax = val;
      else if (
        !specs.zeroACent &&
        (key.includes('0 à 100') || key.includes('0 a 100'))
      )
        specs.zeroACent = val;
      else if (!specs.consoMixte && key.includes('consommation mixte'))
        specs.consoMixte = val;
      else if (!specs.co2 && (key.includes('co2') || key.includes('co₂')))
        specs.co2 = val;
      else if (!specs.couple && key.includes('couple')) specs.couple = val;
      else if (
        !specs.cylindree &&
        (key.includes('cylindrée') || key.includes('cylindree'))
      )
        specs.cylindree = val;
      else if (!specs.boite && (key.includes('boîte') || key.includes('boite')))
        specs.boite = val;
      else if (!specs.transmission && key.includes('transmission'))
        specs.transmission = val;
      else if (!specs.pneus && key.includes('pneu')) specs.pneus = val;
      else if (!specs.diamBraquage && key.includes('braquage'))
        specs.diamBraquage = val;
      else if (!specs.normeEuro && key.includes('norme')) specs.normeEuro = val;
      // Fiches-auto format: single-column key-value in same cell
      else if (!specs.suspensionAv && key.includes('suspension avant'))
        specs.suspensionAv = val;
      else if (!specs.suspensionAr && key.includes('suspension arr'))
        specs.suspensionAr = val;
    }

    // Fallback: parse fiches-auto inline format (| key | value | in single line)
    const inlineSpecs = content.match(/Longueur\s*\|\s*([\d.,]+\s*m)/i);
    if (!specs.longueur && inlineSpecs) specs.longueur = inlineSpecs[1];
  }

  /**
   * Convert roman numerals ↔ arabic in model names for fuzzy matching.
   * "clio iii" → "clio 3", "megane 2" → "megane ii"
   */
  private romanArabicVariant(name: string): string {
    const romanToArabic: Record<string, string> = {
      i: '1',
      ii: '2',
      iii: '3',
      iv: '4',
      v: '5',
      vi: '6',
      vii: '7',
      viii: '8',
      ix: '9',
      x: '10',
    };
    const arabicToRoman: Record<string, string> = {};
    for (const [r, a] of Object.entries(romanToArabic)) {
      arabicToRoman[a] = r;
    }

    // Try roman → arabic first
    for (const [roman, arabic] of Object.entries(romanToArabic)) {
      const regex = new RegExp(`\\b${roman}\\b`, 'i');
      if (regex.test(name)) {
        return name.replace(regex, arabic);
      }
    }
    // Try arabic → roman
    for (const [arabic, roman] of Object.entries(arabicToRoman)) {
      const regex = new RegExp(`\\b${arabic}\\b`);
      if (regex.test(name)) {
        return name.replace(regex, roman);
      }
    }
    return name;
  }

  private escapeYaml(s: string): string {
    return s.replace(/"/g, '\\"');
  }
}
