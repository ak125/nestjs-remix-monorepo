import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RagProxyService } from '../../rag-proxy/rag-proxy.service';
import { ConfigService } from '@nestjs/config';

// ── Section type constants matching DB values ──

const SECTION_TYPES = {
  S1: 'S1', // Fonction
  S2: 'S2', // Quand changer
  S3: 'S3', // Comment choisir
  S4_DEPOSE: 'S4_DEPOSE', // Démontage
  S4_REPOSE: 'S4_REPOSE', // Remontage
  S5: 'S5', // Erreurs à éviter
  S6: 'S6', // Vérification finale
  S7: 'S7', // Pièces associées
  S8: 'S8', // FAQ
} as const;

const SECTION_ORDERS: Record<string, number> = {
  S1: 10,
  S2: 20,
  S3: 30,
  S4_DEPOSE: 40,
  S4_REPOSE: 50,
  S5: 60,
  S6: 65,
  S7: 80,
  S8: 85,
};

// ── Generic phrase penalties ──

const GENERIC_PHRASES = [
  'rôle essentiel',
  'bon fonctionnement',
  'il est important',
  'il est recommandé',
  'pièce indispensable',
  'entretien régulier',
  'il est conseillé',
  'pièce importante',
  'en bon état',
];

// ── Quality gate penalties ──

interface QualityFlag {
  id: string;
  severity: 'BLOQUANT' | 'WARNING';
  penalty: number;
}

const QUALITY_FLAGS: QualityFlag[] = [
  { id: 'MISSING_PROCEDURE', severity: 'BLOQUANT', penalty: 25 },
  { id: 'MISSING_ERRORS', severity: 'WARNING', penalty: 10 },
  { id: 'FAQ_TOO_SMALL', severity: 'WARNING', penalty: 14 },
  { id: 'GENERIC_PHRASES', severity: 'WARNING', penalty: 18 },
  { id: 'NO_NUMBERS_IN_S2', severity: 'WARNING', penalty: 8 },
  { id: 'S3_TOO_SHORT', severity: 'WARNING', penalty: 10 },
];

// ── Result interfaces ──

export interface ConseilEnrichResult {
  status: 'draft' | 'failed' | 'skipped';
  score: number;
  flags: string[];
  sectionsCreated: number;
  sectionsUpdated: number;
  reason?: string;
}

interface SectionAction {
  type: string; // Section type (S1, S2, etc.)
  action: 'create' | 'update' | 'skip';
  title: string;
  content: string; // HTML content
  order: number;
}

interface PageContract {
  intro?: { role?: string; syncParts?: string[] };
  symptoms?: string[];
  timing?: { km?: number[]; years?: number[]; note?: string };
  risk?: { explanation?: string; consequences?: string[] };
  antiMistakes?: string[];
  howToChoose?: string[];
  faq?: Array<{ q: string; a: string }>;
  diagnosticTree?: Array<{ if: string; then: string }>;
}

@Injectable()
export class ConseilEnricherService extends SupabaseBaseService {
  protected override readonly logger = new Logger(ConseilEnricherService.name);

  constructor(
    configService: ConfigService,
    private readonly ragService: RagProxyService,
  ) {
    super(configService);
  }

  /**
   * Enrich a single gamme's R3 Conseils sections using RAG knowledge.
   * 0 LLM — pure parsing + template generation.
   */
  async enrichSingle(
    pgId: string,
    pgAlias: string,
  ): Promise<ConseilEnrichResult> {
    // 1. Load RAG knowledge doc
    let ragContent: string;
    try {
      const doc = await this.ragService.getKnowledgeDoc(`gammes.${pgAlias}`);
      ragContent = doc.content || '';
    } catch {
      return {
        status: 'skipped',
        score: 0,
        flags: [],
        sectionsCreated: 0,
        sectionsUpdated: 0,
        reason: 'NO_RAG_DOC',
      };
    }

    if (ragContent.length < 100) {
      return {
        status: 'skipped',
        score: 0,
        flags: [],
        sectionsCreated: 0,
        sectionsUpdated: 0,
        reason: 'RAG_DOC_TOO_SHORT',
      };
    }

    // 2. Parse frontmatter YAML for page_contract
    const contract = this.parsePageContract(ragContent);
    if (!contract) {
      return {
        status: 'skipped',
        score: 0,
        flags: [],
        sectionsCreated: 0,
        sectionsUpdated: 0,
        reason: 'NO_PAGE_CONTRACT',
      };
    }

    // 3. Load existing conseil sections
    const existing = await this.loadExistingSections(pgId);

    // 4. Plan actions for each section
    const actions = this.planActions(existing, contract, pgAlias);

    // 5. Filter out skips
    const writeActions = actions.filter((a) => a.action !== 'skip');
    if (writeActions.length === 0) {
      return {
        status: 'skipped',
        score: 100,
        flags: [],
        sectionsCreated: 0,
        sectionsUpdated: 0,
        reason: 'NO_ENRICHMENT_NEEDED',
      };
    }

    // 6. Validate quality
    const quality = this.validateQuality(actions, existing, contract);

    // 7. Write to DB if quality passes
    if (quality.score >= 70) {
      const { created, updated } = await this.writeSections(
        pgId,
        writeActions,
        existing,
      );
      return {
        status: 'draft',
        score: quality.score,
        flags: quality.flags,
        sectionsCreated: created,
        sectionsUpdated: updated,
      };
    }

    return {
      status: 'failed',
      score: quality.score,
      flags: quality.flags,
      sectionsCreated: 0,
      sectionsUpdated: 0,
      reason: 'QUALITY_BELOW_THRESHOLD',
    };
  }

  // ── YAML Frontmatter Parser ──

  private parsePageContract(content: string): PageContract | null {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];

    const contract: PageContract = {};

    // intro.role
    const roleMatch = fm.match(/^\s+role:\s*['"]?(.+?)['"]?\s*$/m);
    if (roleMatch) {
      contract.intro = { role: roleMatch[1].trim() };
    }

    // intro.syncParts
    const syncPartsItems = this.extractYamlList(fm, 'syncParts');
    if (syncPartsItems.length > 0 && contract.intro) {
      contract.intro.syncParts = syncPartsItems;
    }

    // symptoms
    const symptoms = this.extractYamlList(fm, 'symptoms');
    if (symptoms.length > 0) contract.symptoms = symptoms;

    // timing
    const timingNote = fm.match(/^\s+note:\s*['"]?(.+?)['"]?\s*$/m);
    const timingKm = this.extractYamlList(fm, 'km');
    const timingYears = this.extractYamlList(fm, 'years');
    if (timingNote || timingKm.length > 0) {
      contract.timing = {
        note: timingNote?.[1]?.trim(),
        km: timingKm.map(Number).filter((n) => !isNaN(n)),
        years: timingYears.map(Number).filter((n) => !isNaN(n)),
      };
    }

    // risk
    const riskExpl = fm.match(/^\s+explanation:\s*['"]?(.+?)['"]?\s*$/m);
    const riskConseq = this.extractYamlList(fm, 'consequences');
    if (riskExpl || riskConseq.length > 0) {
      contract.risk = {
        explanation: riskExpl?.[1]?.trim(),
        consequences: riskConseq,
      };
    }

    // antiMistakes
    const antiMistakes = this.extractYamlList(fm, 'antiMistakes');
    if (antiMistakes.length > 0) contract.antiMistakes = antiMistakes;

    // howToChoose
    const howToChoose = this.extractYamlList(fm, 'howToChoose');
    if (howToChoose.length > 0) contract.howToChoose = howToChoose;

    // faq
    const faqs = this.extractYamlFaq(fm);
    if (faqs.length > 0) contract.faq = faqs;

    // diagnosticTree
    const tree = this.extractYamlDiagnosticTree(fm);
    if (tree.length > 0) contract.diagnosticTree = tree;

    // Check if we have enough data
    const hasData =
      contract.intro?.role ||
      (contract.symptoms && contract.symptoms.length > 0) ||
      (contract.antiMistakes && contract.antiMistakes.length > 0) ||
      (contract.faq && contract.faq.length > 0);

    return hasData ? contract : null;
  }

  private extractYamlList(fm: string, key: string): string[] {
    const keyIdx = fm.indexOf(`${key}:`);
    if (keyIdx < 0) return [];
    const afterKey = fm.substring(keyIdx);
    const lines = afterKey.split('\n').slice(1);
    const items: string[] = [];
    for (const line of lines) {
      const m = line.match(/^\s+-\s+['"]?(.+?)['"]?\s*$/);
      if (m) {
        items.push(m[1].trim());
      } else if (line.trim() && !line.match(/^\s/)) {
        break;
      }
    }
    return items;
  }

  private extractYamlFaq(fm: string): Array<{ q: string; a: string }> {
    const faqIdx = fm.indexOf('faq:');
    if (faqIdx < 0) return [];
    const faqs: Array<{ q: string; a: string }> = [];
    const afterFaq = fm.substring(faqIdx);
    const lines = afterFaq.split('\n').slice(1);
    let currentQ = '';
    let currentA = '';
    for (const line of lines) {
      const qMatch = line.match(
        /^\s+-?\s*(?:question|q):\s*['"]?(.+?)['"]?\s*$/,
      );
      const aMatch = line.match(/^\s+(?:answer|a):\s*['"]?(.+?)['"]?\s*$/);
      if (qMatch) {
        if (currentQ && currentA) {
          faqs.push({ q: currentQ, a: currentA });
        }
        currentQ = qMatch[1].trim();
        currentA = '';
      } else if (aMatch) {
        currentA = aMatch[1].trim();
      } else if (line.trim() && !line.match(/^\s/)) {
        break;
      }
    }
    if (currentQ && currentA) {
      faqs.push({ q: currentQ, a: currentA });
    }
    return faqs;
  }

  private extractYamlDiagnosticTree(
    fm: string,
  ): Array<{ if: string; then: string }> {
    const treeIdx = fm.indexOf('diagnostic_tree:');
    if (treeIdx < 0) return [];
    const nodes: Array<{ if: string; then: string }> = [];
    const afterTree = fm.substring(treeIdx);
    const lines = afterTree.split('\n').slice(1);
    let currentIf = '';
    let currentThen = '';
    for (const line of lines) {
      const ifMatch = line.match(/^\s+-?\s*if:\s*['"]?(.+?)['"]?\s*$/);
      const thenMatch = line.match(/^\s+then:\s*['"]?(.+?)['"]?\s*$/);
      if (ifMatch) {
        if (currentIf && currentThen) {
          nodes.push({ if: currentIf, then: currentThen });
        }
        currentIf = ifMatch[1].trim();
        currentThen = '';
      } else if (thenMatch) {
        currentThen = thenMatch[1].trim();
      } else if (line.trim() && !line.match(/^\s/)) {
        break;
      }
    }
    if (currentIf && currentThen) {
      nodes.push({ if: currentIf, then: currentThen });
    }
    return nodes;
  }

  // ── Load existing sections ──

  private async loadExistingSections(pgId: string): Promise<
    Map<
      string,
      {
        sgc_id: string;
        sgc_title: string;
        sgc_content: string;
        sgc_order: number;
      }
    >
  > {
    const { data, error } = await this.client
      .from('__seo_gamme_conseil')
      .select('sgc_id, sgc_section_type, sgc_title, sgc_content, sgc_order')
      .eq('sgc_pg_id', pgId);

    if (error || !data) {
      this.logger.warn(
        `Failed to load conseil sections for pgId=${pgId}: ${error?.message}`,
      );
      return new Map();
    }

    const map = new Map<
      string,
      {
        sgc_id: string;
        sgc_title: string;
        sgc_content: string;
        sgc_order: number;
      }
    >();
    for (const row of data) {
      if (row.sgc_section_type) {
        map.set(row.sgc_section_type as string, {
          sgc_id: row.sgc_id as string,
          sgc_title: row.sgc_title as string,
          sgc_content: row.sgc_content as string,
          sgc_order: row.sgc_order as number,
        });
      }
    }
    return map;
  }

  // ── Plan actions ──

  private planActions(
    existing: Map<
      string,
      {
        sgc_id: string;
        sgc_title: string;
        sgc_content: string;
        sgc_order: number;
      }
    >,
    contract: PageContract,
    pgAlias: string,
  ): SectionAction[] {
    const actions: SectionAction[] = [];
    const gammeName = pgAlias.replace(/-/g, ' ');

    // S1 Fonction — update if RAG has richer intro
    if (contract.intro?.role) {
      const existingS1 = existing.get(SECTION_TYPES.S1);
      const ragRicher =
        !existingS1 ||
        contract.intro.role.length > (existingS1.sgc_content?.length || 0);
      if (ragRicher) {
        const syncParts = contract.intro.syncParts || [];
        const syncHtml =
          syncParts.length > 0
            ? `<br>Pièces liées : ${syncParts.map((p) => `<b>${p.replace(/-/g, ' ')}</b>`).join(', ')}.`
            : '';
        actions.push({
          type: SECTION_TYPES.S1,
          action: existingS1 ? 'update' : 'create',
          title: `Fonction des ${gammeName} :`,
          content: `${contract.intro.role}${syncHtml}`,
          order: SECTION_ORDERS.S1,
        });
      } else {
        actions.push({
          type: SECTION_TYPES.S1,
          action: 'skip',
          title: '',
          content: '',
          order: SECTION_ORDERS.S1,
        });
      }
    }

    // S2 Quand changer — update if RAG has quantitative data
    if (
      contract.symptoms?.length ||
      contract.timing?.km?.length ||
      contract.timing?.note
    ) {
      const existingS2 = existing.get(SECTION_TYPES.S2);
      const parts: string[] = [];

      if (contract.timing?.km?.length) {
        const km = contract.timing.km;
        parts.push(
          `Les <b>${gammeName}</b> sont à remplacer tous les ${km[0].toLocaleString('fr-FR')}` +
            (km[1] ? ` à ${km[1].toLocaleString('fr-FR')}` : '') +
            ` km environ.`,
        );
      }
      if (contract.timing?.years?.length) {
        const years = contract.timing.years;
        parts.push(
          `Durée de vie : ${years[0]}` +
            (years[1] ? ` à ${years[1]}` : '') +
            ` ans.`,
        );
      }
      if (contract.timing?.note) {
        parts.push(contract.timing.note);
      }
      if (contract.symptoms && contract.symptoms.length > 0) {
        parts.push(
          `<b>Symptômes d'usure :</b><br>- ${contract.symptoms.join('<br>- ')}`,
        );
      }

      const content = parts.join('<br>');
      const hasNumbers = /\d/.test(content);

      if (
        !existingS2 ||
        (hasNumbers && !/\d/.test(existingS2.sgc_content || ''))
      ) {
        actions.push({
          type: SECTION_TYPES.S2,
          action: existingS2 ? 'update' : 'create',
          title: `Quand changer les ${gammeName} :`,
          content,
          order: SECTION_ORDERS.S2,
        });
      }
    }

    // S3 Comment choisir — create if missing (only 5 exist in DB!)
    if (contract.howToChoose?.length) {
      const existingS3 = existing.get(SECTION_TYPES.S3);
      if (!existingS3) {
        const items = contract.howToChoose
          .map((item) => `- ${item}`)
          .join('<br>');
        actions.push({
          type: SECTION_TYPES.S3,
          action: 'create',
          title: `Comment choisir vos ${gammeName} :`,
          content: `Pour choisir les bons ${gammeName} pour votre véhicule :<br>${items}`,
          order: SECTION_ORDERS.S3,
        });
      }
    }

    // S4_DEPOSE/S4_REPOSE — only touch if RAG has explicit diagnostic_tree with procedures
    // Too risky to overwrite technical procedures without explicit data
    if (contract.diagnosticTree && contract.diagnosticTree.length >= 3) {
      const existingS4D = existing.get(SECTION_TYPES.S4_DEPOSE);
      if (!existingS4D) {
        const steps = contract.diagnosticTree
          .map((node) => `- Si ${node.if} → ${node.then}`)
          .join('<br>');
        actions.push({
          type: SECTION_TYPES.S4_DEPOSE,
          action: 'create',
          title: `Diagnostic des ${gammeName} :`,
          content: steps,
          order: SECTION_ORDERS.S4_DEPOSE,
        });
      }
    }

    // S5 Erreurs à éviter — CREATE if missing (most gammes don't have S5)
    if (contract.antiMistakes && contract.antiMistakes.length >= 3) {
      const existingS5 = existing.get(SECTION_TYPES.S5);
      if (!existingS5) {
        const items = contract.antiMistakes
          .map((item) => `- ${item}`)
          .join('<br>');
        actions.push({
          type: SECTION_TYPES.S5,
          action: 'create',
          title: `Erreurs à éviter avec les ${gammeName} :`,
          content: items,
          order: SECTION_ORDERS.S5,
        });
      }
    }

    // S6 Vérification — create from diagnostic_tree if available
    if (contract.diagnosticTree && contract.diagnosticTree.length >= 2) {
      const existingS6 = existing.get(SECTION_TYPES.S6);
      if (!existingS6) {
        const checks = contract.diagnosticTree
          .map((node) => `- Vérifier : ${node.then}`)
          .join('<br>');
        actions.push({
          type: SECTION_TYPES.S6,
          action: 'create',
          title: `Vérifications après remplacement des ${gammeName} :`,
          content: checks,
          order: SECTION_ORDERS.S6,
        });
      }
    }

    // S7 Pièces associées — update with syncParts links
    if (contract.intro?.syncParts && contract.intro.syncParts.length > 0) {
      const existingS7 = existing.get(SECTION_TYPES.S7);
      const links = contract.intro.syncParts
        .map(
          (p) => `- <b><a href="/pieces/${p}">${p.replace(/-/g, ' ')}</a></b>`,
        )
        .join('<br>');
      if (!existingS7) {
        actions.push({
          type: SECTION_TYPES.S7,
          action: 'create',
          title: `Pièces à contrôler et à remplacer avec les ${gammeName} :`,
          content: links,
          order: SECTION_ORDERS.S7,
        });
      }
    }

    // S8 FAQ — CREATE if missing (no gammes have S8)
    if (contract.faq && contract.faq.length >= 3) {
      const existingS8 = existing.get(SECTION_TYPES.S8);
      if (!existingS8) {
        const faqHtml = contract.faq
          .map(
            (f) =>
              `<details><summary><b>${f.q}</b></summary><p>${f.a}</p></details>`,
          )
          .join('\n');
        actions.push({
          type: SECTION_TYPES.S8,
          action: 'create',
          title: `Questions fréquentes sur les ${gammeName} :`,
          content: faqHtml,
          order: SECTION_ORDERS.S8,
        });
      }
    }

    return actions;
  }

  // ── Quality Validation ──

  private validateQuality(
    actions: SectionAction[],
    existing: Map<
      string,
      {
        sgc_id: string;
        sgc_title: string;
        sgc_content: string;
        sgc_order: number;
      }
    >,
    contract: PageContract,
  ): { score: number; flags: string[] } {
    const flags: string[] = [];

    // MISSING_PROCEDURE: S4 must exist (either already or being created)
    const hasS4 =
      existing.has(SECTION_TYPES.S4_DEPOSE) ||
      actions.some(
        (a) => a.type === SECTION_TYPES.S4_DEPOSE && a.action !== 'skip',
      );
    if (!hasS4) {
      flags.push('MISSING_PROCEDURE');
    }

    // MISSING_ERRORS: S5 should have at least 3 items
    const s5Action = actions.find((a) => a.type === SECTION_TYPES.S5);
    const existingS5 = existing.get(SECTION_TYPES.S5);
    if (!s5Action && !existingS5) {
      if (!contract.antiMistakes || contract.antiMistakes.length < 3) {
        flags.push('MISSING_ERRORS');
      }
    }

    // FAQ_TOO_SMALL: S8 needs at least 3 Q/A
    const s8Action = actions.find((a) => a.type === SECTION_TYPES.S8);
    const existingS8 = existing.get(SECTION_TYPES.S8);
    if (!s8Action && !existingS8) {
      if (!contract.faq || contract.faq.length < 3) {
        flags.push('FAQ_TOO_SMALL');
      }
    }

    // GENERIC_PHRASES: check all action content
    const allContent = actions
      .filter((a) => a.action !== 'skip')
      .map((a) => a.content)
      .join(' ')
      .toLowerCase();
    if (GENERIC_PHRASES.some((g) => allContent.includes(g))) {
      flags.push('GENERIC_PHRASES');
    }

    // NO_NUMBERS_IN_S2: S2 should have quantitative data
    const s2Action = actions.find((a) => a.type === SECTION_TYPES.S2);
    const existingS2 = existing.get(SECTION_TYPES.S2);
    const s2Content = s2Action?.content || existingS2?.sgc_content || '';
    if (s2Content && !/\d/.test(s2Content)) {
      flags.push('NO_NUMBERS_IN_S2');
    }

    // S3_TOO_SHORT: S3 should have meaningful content
    const s3Action = actions.find((a) => a.type === SECTION_TYPES.S3);
    if (s3Action && s3Action.content.length < 80) {
      flags.push('S3_TOO_SHORT');
    }

    // Calculate score
    const penalty = flags.reduce((sum, flagId) => {
      const flagDef = QUALITY_FLAGS.find((f) => f.id === flagId);
      return sum + (flagDef?.penalty || 5);
    }, 0);

    return {
      score: Math.max(0, 100 - penalty),
      flags,
    };
  }

  // ── Write sections to DB ──

  private async writeSections(
    pgId: string,
    actions: SectionAction[],
    existing: Map<
      string,
      {
        sgc_id: string;
        sgc_title: string;
        sgc_content: string;
        sgc_order: number;
      }
    >,
  ): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const action of actions) {
      if (action.action === 'skip') continue;

      const existingRow = existing.get(action.type);

      if (action.action === 'update' && existingRow) {
        const { error } = await this.client
          .from('__seo_gamme_conseil')
          .update({
            sgc_title: action.title,
            sgc_content: action.content,
          })
          .eq('sgc_id', existingRow.sgc_id);

        if (error) {
          this.logger.error(
            `Failed to update conseil section ${action.type} for pgId=${pgId}: ${error.message}`,
          );
        } else {
          updated++;
          this.logger.log(
            `Updated conseil section ${action.type} for pgId=${pgId}`,
          );
        }
      } else if (action.action === 'create') {
        const newId = `conseil-${pgId}-${action.type}-${Date.now()}`;
        const { error } = await this.client.from('__seo_gamme_conseil').insert({
          sgc_id: newId,
          sgc_pg_id: pgId,
          sgc_section_type: action.type,
          sgc_title: action.title,
          sgc_content: action.content,
          sgc_order: action.order,
        });

        if (error) {
          this.logger.error(
            `Failed to create conseil section ${action.type} for pgId=${pgId}: ${error.message}`,
          );
        } else {
          created++;
          this.logger.log(
            `Created conseil section ${action.type} for pgId=${pgId}`,
          );
        }
      }
    }

    return { created, updated };
  }
}
