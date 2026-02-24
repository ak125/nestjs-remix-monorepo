import { Injectable, Logger, Optional } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RagProxyService } from '../../rag-proxy/rag-proxy.service';
import { AiContentService } from '../../ai-content/ai-content.service';
import { PageBriefService } from './page-brief.service';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { GENERIC_PHRASES as SHARED_GENERIC_PHRASES } from '../../../config/buying-guide-quality.constants';
import type { EvidenceEntry } from '../../../workers/types/content-refresh.types';
import { EnricherTextUtils } from './enricher-text-utils.service';
import { EnricherYamlParser } from './enricher-yaml-parser.service';

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

// Minimum content length to consider a section "substantial".
// Sections below this threshold are treated as placeholders and can be re-enriched.
const MIN_SECTION_CONTENT_LENGTH = 150;

// ── Generic phrase penalties (shared + conseil-specific extras) ──

const GENERIC_PHRASES = [...SHARED_GENERIC_PHRASES, 'il est important'];

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
  evidencePack?: EvidenceEntry[];
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
  howToChooseInline?: string;
  faq?: Array<{ q: string; a: string }>;
  diagnosticTree?: Array<{ if: string; then: string }>;
  associatedPieces?: string[];
}

/** Classified supplementary content from web/PDF ingestion files */
interface SupplementaryClassification {
  symptoms: string[];
  procedures: string[];
  errors: string[];
  definitions: string[];
  faq: Array<{ q: string; a: string }>;
  specs: string[];
}

@Injectable()
export class ConseilEnricherService extends SupabaseBaseService {
  protected override readonly logger = new Logger(ConseilEnricherService.name);
  private readonly RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';

  constructor(
    configService: ConfigService,
    private readonly ragService: RagProxyService,
    private readonly flags: FeatureFlagsService,
    private readonly textUtils: EnricherTextUtils,
    private readonly yamlParser: EnricherYamlParser,
    @Optional() private readonly aiContentService?: AiContentService,
    @Optional() private readonly pageBriefService?: PageBriefService,
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
    supplementaryFiles: string[] = [],
    conservativeMode = false,
    force = false,
  ): Promise<ConseilEnrichResult> {
    // 1. Load RAG knowledge doc (API first, disk fallback)
    let ragContent: string;
    try {
      const doc = await this.ragService.getKnowledgeDoc(`gammes.${pgAlias}`);
      ragContent = doc.content || '';
    } catch {
      ragContent = '';
    }

    // Fallback: read from disk if API content lacks YAML frontmatter
    if (!ragContent || !ragContent.startsWith('---\n')) {
      const diskContent = this.readGammeFromDisk(pgAlias);
      if (diskContent) {
        this.logger.log(
          `Disk fallback for ${pgAlias}: ${diskContent.length} chars`,
        );
        ragContent = diskContent;
      }
    }

    if (!ragContent || ragContent.length < 100) {
      // No primary doc — try supplementary files as sole source
      if (supplementaryFiles.length > 0) {
        const classified =
          this.loadAndClassifySupplementary(supplementaryFiles);
        const hasSupplementary =
          classified.definitions.length > 0 ||
          classified.symptoms.length > 0 ||
          classified.procedures.length > 0;
        if (hasSupplementary) {
          this.logger.log(
            `No primary RAG doc for ${pgAlias}, building contract from ${supplementaryFiles.length} supplementary files`,
          );
          const contract: PageContract = {};
          this.mergeSupplementaryIntoContract(contract, classified, pgAlias);
          // Jump to step 3 below with this contract (always supplementary-enriched)
          return this.executeEnrichment(
            pgId,
            pgAlias,
            contract,
            true,
            conservativeMode,
          );
        }
      }
      return {
        status: 'skipped',
        score: 0,
        flags: [],
        sectionsCreated: 0,
        sectionsUpdated: 0,
        reason: 'NO_RAG_DOC',
      };
    }

    // 2. Parse frontmatter YAML — try v4 first, then legacy
    let contract = this.parseV4ToPageContract(ragContent);
    if (!contract) {
      contract = this.parsePageContract(ragContent);
    }
    if (!contract) {
      // Fallback: try parsing mechanical_rules + diagnostic_tree from YAML
      contract = this.parseFromMechanicalRules(ragContent);
    }
    if (!contract) {
      // No parseable contract — try supplementary files
      if (supplementaryFiles.length > 0) {
        const classified =
          this.loadAndClassifySupplementary(supplementaryFiles);
        const hasSupplementary =
          classified.definitions.length > 0 ||
          classified.symptoms.length > 0 ||
          classified.procedures.length > 0;
        if (hasSupplementary) {
          this.logger.log(
            `No page_contract for ${pgAlias}, building from ${supplementaryFiles.length} supplementary files`,
          );
          contract = {};
          this.mergeSupplementaryIntoContract(contract, classified, pgAlias);
          return this.executeEnrichment(
            pgId,
            pgAlias,
            contract,
            true,
            conservativeMode,
          );
        }
      }
      return {
        status: 'skipped',
        score: 0,
        flags: [],
        sectionsCreated: 0,
        sectionsUpdated: 0,
        reason: 'NO_PAGE_CONTRACT',
      };
    }

    // 2b. Extract associated pieces from markdown body (for S7)
    const associatedPieces = this.extractAssociatedPieces(ragContent);
    if (associatedPieces.length > 0) {
      contract.associatedPieces = associatedPieces;
    }

    // 2c. Merge supplementary RAG content into contract
    let supplementaryEnriched = false;
    if (supplementaryFiles.length > 0) {
      const classified = this.loadAndClassifySupplementary(supplementaryFiles);
      supplementaryEnriched = this.mergeSupplementaryIntoContract(
        contract,
        classified,
        pgAlias,
      );
      this.logger.log(
        `Merged supplementary content for ${pgAlias} (modified=${supplementaryEnriched}): ` +
          `${classified.definitions.length} defs, ${classified.symptoms.length} symptoms, ` +
          `${classified.procedures.length} procedures, ${classified.errors.length} errors`,
      );
    }

    // Build evidence pack from contract sections
    const evidenceEntries: EvidenceEntry[] = [];
    const docId = `gammes.${pgAlias}`;
    for (const [key, value] of Object.entries(contract)) {
      if (!value) continue;
      const excerpt =
        typeof value === 'string'
          ? value.substring(0, 200)
          : Array.isArray(value)
            ? value
                .slice(0, 3)
                .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
                .join('; ')
                .substring(0, 200)
            : '';
      if (excerpt.length < 10) continue;
      evidenceEntries.push({
        docId,
        heading: key,
        charRange: [-1, -1] as [number, number],
        rawExcerpt: excerpt,
        confidence: 1.0,
      });
    }

    // 2d. Auto-detect RAG content change via evidence_pack_hash comparison
    // Hash must match what the processor stores: sha256(JSON.stringify(evidencePack))
    let ragChanged = false;
    if (!force && !supplementaryEnriched && evidenceEntries.length > 0) {
      const currentHash = createHash('sha256')
        .update(JSON.stringify(evidenceEntries))
        .digest('hex');
      const { data: lastSuccess } = await this.client
        .from('__rag_content_refresh_log')
        .select('evidence_pack_hash')
        .eq('pg_alias', pgAlias)
        .eq('page_type', 'R3_conseils')
        .in('status', ['auto_published', 'published'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (
        lastSuccess?.evidence_pack_hash &&
        lastSuccess.evidence_pack_hash !== currentHash
      ) {
        ragChanged = true;
        this.logger.log(
          `Evidence changed for ${pgAlias}: old=${String(lastSuccess.evidence_pack_hash).substring(0, 8)} vs new=${currentHash.substring(0, 8)}`,
        );
      }
    }

    // 3-7. Execute enrichment pipeline (shared with supplementary-only path)
    const result = await this.executeEnrichment(
      pgId,
      pgAlias,
      contract,
      supplementaryEnriched,
      conservativeMode,
      force || ragChanged,
    );
    result.evidencePack = evidenceEntries;
    return result;
  }

  /**
   * Steps 3-7 of enrichment: load existing, plan, validate, write.
   * Extracted to be reusable from supplementary-only fallback path.
   */
  private async executeEnrichment(
    pgId: string,
    pgAlias: string,
    contract: PageContract,
    hasSupplementary = false,
    conservativeMode = false,
    force = false,
  ): Promise<ConseilEnrichResult> {
    // 3. Load existing conseil sections
    const existing = await this.loadExistingSections(pgId);

    // 4. Plan actions for each section
    const actions = this.planActions(
      existing,
      contract,
      pgAlias,
      hasSupplementary || force,
    );

    // 5. Filter out skips
    const writeActions = actions.filter((a) => a.action !== 'skip');
    if (writeActions.length === 0) {
      return {
        status: 'skipped',
        score: 100,
        flags: ['NO_ENRICHMENT_NEEDED'],
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

      // 8. Generate sg_descrip draft from enriched contract
      await this.writeSeoDescripDraft(
        pgId,
        contract,
        pgAlias,
        conservativeMode,
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

  // ── Disk reader (fallback when RAG API strips frontmatter) ──

  private readGammeFromDisk(pgAlias: string): string | null {
    const filePath = join(this.RAG_GAMMES_DIR, `${pgAlias}.md`);
    try {
      if (!existsSync(filePath)) return null;
      return readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  // ── v4 Schema Parser (5 blocs → PageContract) ──

  private parseV4ToPageContract(content: string): PageContract | null {
    try {
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) return null;

      const fm = yaml.load(fmMatch[1]) as Record<string, any>;
      if (!fm) return null;

      // Detect v4 via quality.version
      const version =
        fm?.rendering?.quality?.version ||
        fm?.page_contract?.quality?.version ||
        fm?.quality?.version;
      if (version !== 'GammeContentContract.v4') return null;

      const domain = fm.domain || {};
      const selection = fm.selection || {};
      const diagnostic = fm.diagnostic || {};
      const maintenance = fm.maintenance || {};
      const rendering = fm.rendering || {};

      // Parse interval value (can be "60000-80000" or "6-12")
      const interval = maintenance.interval || {};
      const intervalValue = String(interval.value || '');
      const intervalParts = intervalValue
        .split('-')
        .map((v: string) => parseInt(v.trim(), 10))
        .filter((n: number) => !isNaN(n));

      const contract: PageContract = {
        intro: {
          role: domain.role || undefined,
          syncParts:
            domain.related_parts ||
            domain.cross_gammes?.map((cg: any) => cg.slug),
        },
        symptoms: (diagnostic.symptoms || []).map((s: any) => s?.label || s),
        timing: {
          km: interval.unit === 'km' ? intervalParts : undefined,
          years: interval.unit === 'mois' ? intervalParts : undefined,
          note: interval.note || undefined,
        },
        risk: {
          explanation: rendering.risk_explanation || undefined,
          consequences: rendering.risk_consequences || undefined,
        },
        antiMistakes: selection.anti_mistakes || undefined,
        howToChoose: selection.criteria || undefined,
        faq: (rendering.faq || []).map((f: any) => ({
          q: f.question || f.q || '',
          a: f.answer || f.a || '',
        })),
        diagnosticTree: (diagnostic.causes || []).map((c: string) => ({
          if: c,
          then: '',
        })),
        associatedPieces: domain.related_parts || undefined,
      };

      // Validate: at least 2 useful fields present
      let fieldCount = 0;
      if (contract.intro?.role) fieldCount++;
      if (contract.symptoms && contract.symptoms.length > 0) fieldCount++;
      if (contract.antiMistakes && contract.antiMistakes.length > 0)
        fieldCount++;
      if (contract.howToChoose && contract.howToChoose.length > 0) fieldCount++;
      if (contract.faq && contract.faq.length > 0) fieldCount++;

      if (fieldCount < 2) return null;

      this.logger.log('Parsed v4 schema → PageContract adapter');
      return contract;
    } catch (err) {
      this.logger.warn(`Failed to parse v4 schema: ${err}`);
      return null;
    }
  }

  // ── YAML Frontmatter Parser (legacy v1/v3) ──

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
    const syncPartsItems = this.yamlParser.extractYamlList(fm, 'syncParts');
    if (syncPartsItems.length > 0 && contract.intro) {
      contract.intro.syncParts = syncPartsItems;
    }

    // symptoms
    const symptoms = this.yamlParser.extractYamlList(fm, 'symptoms');
    if (symptoms.length > 0) contract.symptoms = symptoms;

    // timing
    const timingNote = fm.match(/^\s+note:\s*['"]?(.+?)['"]?\s*$/m);
    let timingKm = this.yamlParser.extractYamlList(fm, 'km');
    let timingYears = this.yamlParser.extractYamlList(fm, 'years');

    // Fallback: parse inline km/years strings (e.g. km: "60 000 à 120 000")
    if (timingKm.length === 0) {
      const kmInline = this.extractYamlInlineShort(fm, 'km');
      if (kmInline) {
        timingKm = (kmInline.match(/[\d\s]+/g) || [])
          .map((s) => s.replace(/\s/g, ''))
          .filter((s) => s.length > 0);
      }
    }
    if (timingYears.length === 0) {
      const yearsInline = this.extractYamlInlineShort(fm, 'years');
      if (yearsInline) {
        timingYears = yearsInline.match(/\d+/g) || [];
      }
    }

    if (timingNote || timingKm.length > 0) {
      contract.timing = {
        note: timingNote?.[1]?.trim(),
        km: timingKm.map(Number).filter((n) => !isNaN(n)),
        years: timingYears.map(Number).filter((n) => !isNaN(n)),
      };
    }

    // risk
    const riskExpl = fm.match(/^\s+explanation:\s*['"]?(.+?)['"]?\s*$/m);
    const riskConseq = this.yamlParser.extractYamlList(fm, 'consequences');
    if (riskExpl || riskConseq.length > 0) {
      contract.risk = {
        explanation: riskExpl?.[1]?.trim(),
        consequences: riskConseq,
      };
    }

    // antiMistakes
    const antiMistakes = this.yamlParser.extractYamlList(fm, 'antiMistakes');
    if (antiMistakes.length > 0) contract.antiMistakes = antiMistakes;

    // howToChoose (can be a list or an inline string)
    const howToChoose = this.yamlParser.extractYamlList(fm, 'howToChoose');
    if (howToChoose.length > 0) {
      contract.howToChoose = howToChoose;
    } else {
      const howInline = this.extractYamlInline(fm, 'howToChoose');
      if (howInline) contract.howToChooseInline = howInline;
    }

    // faq
    const faqs = this.yamlParser.extractYamlFaq(fm);
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

  private extractYamlDiagnosticTree(
    fm: string,
  ): Array<{ if: string; then: string }> {
    const treeIdx = fm.indexOf('diagnostic_tree:');
    if (treeIdx < 0) return [];

    const lineStart = fm.lastIndexOf('\n', treeIdx) + 1;
    const keyIndent = treeIdx - lineStart;

    const nodes: Array<{ if: string; then: string }> = [];
    const afterTree = fm.substring(treeIdx);
    const lines = afterTree.split('\n').slice(1);
    let currentIf = '';
    let currentThen = '';
    for (const line of lines) {
      if (!line.trim()) continue;

      const indent = line.search(/\S/);
      if (indent >= 0 && indent <= keyIndent && !line.trim().startsWith('-')) {
        break;
      }

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
      }
    }
    if (currentIf && currentThen) {
      nodes.push({ if: currentIf, then: currentThen });
    }
    return nodes;
  }

  /**
   * Extract inline YAML value (single string after key:).
   * Returns null if the value is empty or the key is not found.
   */
  private extractYamlInline(fm: string, key: string): string | null {
    const regex = new RegExp(`^\\s*${key}:\\s+(.+)$`, 'm');
    const match = fm.match(regex);
    if (!match) return null;
    const value = match[1].trim().replace(/^['"]|['"]$/g, '');
    return value.length > 10 ? value : null;
  }

  /** Like extractYamlInline but accepts short values (for km, years). */
  private extractYamlInlineShort(fm: string, key: string): string | null {
    const regex = new RegExp(`^\\s*${key}:\\s+(.+)$`, 'm');
    const match = fm.match(regex);
    if (!match) return null;
    const value = match[1].trim().replace(/^['"]|['"]$/g, '');
    return value.length > 0 ? value : null;
  }

  /**
   * Extract associated pieces from the markdown body "## Pièces Associées" section.
   * Returns gamme-alias-style strings (e.g. "courroie-d-accessoire").
   */
  private extractAssociatedPieces(content: string): string[] {
    const fmEnd = content.indexOf('\n---', 4);
    if (fmEnd < 0) return [];
    const markdownBody = content.substring(fmEnd + 4);

    const sectionMatch = markdownBody.match(
      /##\s*Pi[èe]ces\s+Associ[ée]es[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i,
    );
    if (!sectionMatch) return [];

    const pieces: string[] = [];
    const lines = sectionMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/^[-*]\s+(\S+)/);
      if (m) {
        const alias = m[1].trim();
        // Must look like a gamme alias: lowercase, hyphens, letters
        if (/^[a-z][a-z0-9-]+$/.test(alias) && alias.length >= 4) {
          pieces.push(alias);
        }
      }
    }
    return pieces;
  }

  // ── Fallback: Parse from mechanical_rules + diagnostic_tree ──

  /**
   * Fallback parser when parsePageContract() returns null.
   * Extracts data from mechanical_rules, diagnostic_tree, and top-level symptoms
   * in the YAML frontmatter. Returns a PageContract if at least 2 fields are found.
   */
  private parseFromMechanicalRules(content: string): PageContract | null {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];
    const markdownBody = content.substring(fmMatch[0].length);

    const contract: PageContract = {};
    let fieldsFound = 0;

    // 1. Extract role_summary from mechanical_rules as intro.role
    const roleSummaryMatch = fm.match(
      /role_summary:\s*>-?\s*\n([\s\S]*?)(?=\n\s{2}\w|\n\w|$)/,
    );
    const roleSummaryInline = fm.match(/role_summary:\s+(.+?)$/m);
    const roleSummary = roleSummaryMatch
      ? roleSummaryMatch[1].replace(/\s+/g, ' ').trim()
      : roleSummaryInline?.[1]?.trim() || null;

    if (roleSummary && roleSummary.length > 10) {
      contract.intro = { role: roleSummary };
      fieldsFound++;
    }

    // 2. Extract must_be_true from mechanical_rules → map to antiMistakes
    //    (rules that must hold true = rules not to violate)
    const mustBeTrue: string[] = [];
    const mbtMatch = fm.match(/must_be_true:\s*\n((?:\s*-\s*.+\n?)*)/);
    if (mbtMatch) {
      const lines = mbtMatch[1].match(/^\s*-\s*(.+)$/gm);
      if (lines) {
        for (const line of lines) {
          const val = line.replace(/^\s*-\s*/, '').trim();
          if (val) mustBeTrue.push(val);
        }
      }
    }
    if (mustBeTrue.length > 0) {
      contract.antiMistakes = mustBeTrue;
      fieldsFound++;
    }

    // 3. Extract diagnostic_tree (top-level) → if/then pairs
    const diagnosticTree: Array<{ if: string; then: string }> = [];
    const dtSection = fm.match(
      /^diagnostic_tree:\s*\n((?:\s*-\s*[\s\S]*?)(?=\n\w|\n$|$))/m,
    );
    if (dtSection) {
      const dtText = dtSection[1];
      const ifMatches = dtText.matchAll(/^\s*-?\s*if:\s*(.+)$/gm);
      const thenMatches = dtText.matchAll(/^\s+then:\s*(.+)$/gm);
      const ifs = [...ifMatches].map((m) => m[1].trim());
      const thens = [...thenMatches].map((m) => m[1].trim());
      const len = Math.min(ifs.length, thens.length);
      for (let i = 0; i < len; i++) {
        diagnosticTree.push({
          if: ifs[i].replace(/_/g, ' '),
          then: thens[i].replace(/_/g, ' '),
        });
      }
    }
    if (diagnosticTree.length > 0) {
      contract.diagnosticTree = diagnosticTree;
      fieldsFound++;
    }

    // 4. Extract symptoms from top-level symptoms: list (label field)
    const symptoms: string[] = [];
    const sympSection = fm.match(
      /^symptoms:\s*\n((?:\s*-[\s\S]*?)(?=\n\w|$))/m,
    );
    if (sympSection) {
      const labelMatches = sympSection[1].matchAll(/label:\s*(.+)$/gm);
      for (const m of labelMatches) {
        const label = m[1].trim();
        if (label) symptoms.push(label);
      }
    }

    // Also check markdown body for ## Symptomes section
    if (symptoms.length === 0) {
      const sympMdMatch = markdownBody.match(
        /##\s*Sympt[oô]mes[^\n]*\n([\s\S]*?)(?=\n##\s|\n$|$)/i,
      );
      if (sympMdMatch) {
        const bulletMatches = sympMdMatch[1].matchAll(
          /^[-*]\s+\*?\*?(.+?)\*?\*?\s*$/gm,
        );
        for (const m of bulletMatches) {
          const item = m[1].trim();
          if (item && item.length > 5) symptoms.push(item);
        }
      }
    }

    if (symptoms.length > 0) {
      contract.symptoms = symptoms;
      fieldsFound++;
    }

    // 5. Extract faq from page_contract section (nested under page_contract:)
    const pcSection = fm.match(
      /^page_contract:\s*\n((?:\s{2}[\s\S]*?)(?=\n\w|$))/m,
    );
    if (pcSection) {
      const pcText = pcSection[1];
      const faqs: Array<{ q: string; a: string }> = [];
      const faqIdx = pcText.indexOf('faq:');
      if (faqIdx >= 0) {
        const faqText = pcText.substring(faqIdx);
        const faqLines = faqText.split('\n').slice(1);
        let currentQ = '';
        let currentA = '';
        for (const line of faqLines) {
          const qMatch = line.match(/^\s+-?\s*question:\s*(.+)$/);
          const aMatch = line.match(/^\s+answer:\s*(.+)$/);
          if (qMatch) {
            currentQ = qMatch[1].trim();
            if (currentQ && currentA) {
              faqs.push({ q: currentQ, a: currentA });
              currentQ = '';
              currentA = '';
            }
          } else if (aMatch) {
            currentA = aMatch[1].trim();
            if (currentQ && currentA) {
              faqs.push({ q: currentQ, a: currentA });
              currentQ = '';
              currentA = '';
            }
          } else if (
            line.trim() &&
            !line.match(/^\s/) &&
            line.indexOf(':') > 0
          ) {
            // New top-level key in page_contract — stop parsing faq
            break;
          }
        }
        if (currentQ && currentA) {
          faqs.push({ q: currentQ, a: currentA });
        }
      }
      if (faqs.length > 0) {
        contract.faq = faqs;
        fieldsFound++;
      }
    }

    // Return contract only if at least 2 fields were found
    return fieldsFound >= 2 ? contract : null;
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
    hasSupplementary = false,
  ): SectionAction[] {
    const actions: SectionAction[] = [];
    const gammeName = pgAlias.replace(/-/g, ' ');

    // S1 Fonction — update if RAG has richer intro
    if (contract.intro?.role) {
      const existingS1 = existing.get(SECTION_TYPES.S1);
      // Fair comparison: strip HTML from existing before comparing lengths
      const existingPlainLen = existingS1
        ? this.textUtils.stripHtml(existingS1.sgc_content || '').length
        : 0;
      const ragRicher =
        !existingS1 ||
        contract.intro.role.length > existingPlainLen ||
        hasSupplementary;
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

      const shouldUpdateS2 =
        !existingS2 ||
        (hasNumbers &&
          !/\d/.test(existingS2.sgc_content || '') &&
          content.length >= (existingS2.sgc_content?.length || 0) * 0.5) ||
        hasSupplementary;

      if (shouldUpdateS2) {
        actions.push({
          type: SECTION_TYPES.S2,
          action: existingS2 ? 'update' : 'create',
          title: `Quand changer les ${gammeName} :`,
          content,
          order: SECTION_ORDERS.S2,
        });
      }
    }

    // S3 Comment choisir — create if missing or update if placeholder (<150 chars)
    {
      const existingS3 = existing.get(SECTION_TYPES.S3);
      const s3Substantial =
        existingS3 &&
        (existingS3.sgc_content?.length || 0) >= MIN_SECTION_CONTENT_LENGTH;
      let s3Content = '';
      if (contract.howToChoose?.length) {
        const items = contract.howToChoose
          .map((item) => `- ${item}`)
          .join('<br>');
        s3Content = `Pour choisir les bons ${gammeName} pour votre véhicule :<br>${items}`;
      } else if (contract.howToChooseInline) {
        s3Content = contract.howToChooseInline;
      }
      if (s3Content.length > 30 && (!s3Substantial || hasSupplementary)) {
        actions.push({
          type: SECTION_TYPES.S3,
          action: existingS3 ? 'update' : 'create',
          title: `Comment choisir vos ${gammeName} :`,
          content: s3Content,
          order: SECTION_ORDERS.S3,
        });
      }
    }

    // S4_DEPOSE/S4_REPOSE — only touch if RAG has explicit diagnostic_tree with procedures
    // Too risky to overwrite technical procedures without explicit data
    if (contract.diagnosticTree && contract.diagnosticTree.length >= 1) {
      const existingS4D = existing.get(SECTION_TYPES.S4_DEPOSE);
      const s4dSubstantial =
        existingS4D &&
        (existingS4D.sgc_content?.length || 0) >= MIN_SECTION_CONTENT_LENGTH;
      const steps = contract.diagnosticTree
        .map((node) => `- Si ${node.if} → ${node.then}`)
        .join('<br>');
      if (!s4dSubstantial || hasSupplementary) {
        actions.push({
          type: SECTION_TYPES.S4_DEPOSE,
          action: existingS4D ? 'update' : 'create',
          title: `Diagnostic des ${gammeName} :`,
          content: steps,
          order: SECTION_ORDERS.S4_DEPOSE,
        });
      }
    }

    // S5 Erreurs à éviter — create if missing or update if placeholder (<150 chars)
    if (contract.antiMistakes && contract.antiMistakes.length >= 3) {
      const existingS5 = existing.get(SECTION_TYPES.S5);
      const s5Substantial =
        existingS5 &&
        (existingS5.sgc_content?.length || 0) >= MIN_SECTION_CONTENT_LENGTH;
      const items = contract.antiMistakes
        .map((item) => `- ${item}`)
        .join('<br>');
      if (!s5Substantial || hasSupplementary) {
        actions.push({
          type: SECTION_TYPES.S5,
          action: existingS5 ? 'update' : 'create',
          title: `Erreurs à éviter avec les ${gammeName} :`,
          content: items,
          order: SECTION_ORDERS.S5,
        });
      }
    }

    // S6 Vérification — create from diagnostic_tree if available, update if placeholder
    if (contract.diagnosticTree && contract.diagnosticTree.length >= 2) {
      const existingS6 = existing.get(SECTION_TYPES.S6);
      const s6Substantial =
        existingS6 &&
        (existingS6.sgc_content?.length || 0) >= MIN_SECTION_CONTENT_LENGTH;
      const checks = contract.diagnosticTree
        .map((node) => `- Vérifier : ${node.then}`)
        .join('<br>');
      if (!s6Substantial || hasSupplementary) {
        actions.push({
          type: SECTION_TYPES.S6,
          action: existingS6 ? 'update' : 'create',
          title: `Vérifications après remplacement des ${gammeName} :`,
          content: checks,
          order: SECTION_ORDERS.S6,
        });
      }
    }

    // S7 Pièces associées — prefer markdown associated pieces over syncParts
    // (no supplementary override — but force bypasses the substantial check)
    {
      const existingS7 = existing.get(SECTION_TYPES.S7);
      const s7Substantial =
        existingS7 &&
        (existingS7.sgc_content?.length || 0) >= MIN_SECTION_CONTENT_LENGTH;
      if (!s7Substantial || hasSupplementary) {
        const pieces =
          contract.associatedPieces && contract.associatedPieces.length > 0
            ? contract.associatedPieces
            : null;

        if (pieces && pieces.length > 0) {
          const links = pieces
            .map(
              (p) =>
                `- <b><a href="/pieces/${p}">${p.replace(/-/g, ' ')}</a></b>`,
            )
            .join('<br>');
          actions.push({
            type: SECTION_TYPES.S7,
            action: existingS7 ? 'update' : 'create',
            title: `Pièces à contrôler et à remplacer avec les ${gammeName} :`,
            content: links,
            order: SECTION_ORDERS.S7,
          });
        }
      }
    }

    // S8 FAQ — create if missing or update if placeholder (<150 chars)
    if (contract.faq && contract.faq.length >= 3) {
      const existingS8 = existing.get(SECTION_TYPES.S8);
      const s8Substantial =
        existingS8 &&
        (existingS8.sgc_content?.length || 0) >= MIN_SECTION_CONTENT_LENGTH;
      const faqHtml = contract.faq
        .map(
          (f) =>
            `<details><summary><b>${f.q}</b></summary><p>${f.a}</p></details>`,
        )
        .join('\n');
      if (!s8Substantial || hasSupplementary) {
        actions.push({
          type: SECTION_TYPES.S8,
          action: existingS8 ? 'update' : 'create',
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

  /**
   * Batch upsert all sections in a single HTTP call (= single DB transaction).
   * Prevents partial writes if the connection drops mid-enrichment.
   */
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
    const writeActions = actions.filter((a) => a.action !== 'skip');
    if (writeActions.length === 0) return { created: 0, updated: 0 };

    const upsertRows = writeActions.map((action) => {
      const existingRow = existing.get(action.type);
      return {
        sgc_id:
          existingRow?.sgc_id ?? `conseil-${pgId}-${action.type}-${Date.now()}`,
        sgc_pg_id: pgId,
        sgc_section_type: action.type,
        sgc_title: action.title,
        sgc_content: action.content,
        sgc_order: action.order,
      };
    });

    const { error } = await this.client
      .from('__seo_gamme_conseil')
      .upsert(upsertRows, { onConflict: 'sgc_pg_id,sgc_section_type' });

    if (error) {
      this.logger.error(
        `Failed to batch upsert ${upsertRows.length} conseil sections for pgId=${pgId}: ${error.message}`,
      );
      return { created: 0, updated: 0 };
    }

    const created = writeActions.filter((a) => a.action === 'create').length;
    const updated = writeActions.filter((a) => a.action === 'update').length;
    this.logger.log(
      `Batch upserted ${upsertRows.length} conseil sections for pgId=${pgId} (${created} created, ${updated} updated)`,
    );
    return { created, updated };
  }

  // ── Supplementary RAG Content Integration ──

  /**
   * Detects marketing/promotional content from supplementary sources (PDFs, web).
   * Rejects: superlatives, competitive claims, product promotions, brand-specific features.
   */
  private static readonly MARKETING_PATTERNS = [
    /\b(meilleur|best|superior|unmatched|inégalé|exceptionnel|premium)\b/i,
    /\b(nos\s+filtres|our\s+filters|notre\s+gamme|our\s+range)\b/i,
    /\b(FILTRON|MANN.?FILTER|K&N|BMC|Pipercross|JR\s+Filters)\b/i,
    /\b(\d+\s*%\s*(plus|more|better|meilleur|supérieur))\b/i,
    /\b(garantie?\s+à\s+vie|lifetime\s+warranty)\b/i,
    /\b(découvrez|discover|essayez|try\s+our)\b/i,
  ];

  private static isMarketingContent(text: string): boolean {
    return ConseilEnricherService.MARKETING_PATTERNS.some((p) => p.test(text));
  }

  /**
   * Load supplementary files, clean, anonymize, and classify their content
   * into section-appropriate buckets.
   */
  private loadAndClassifySupplementary(
    filePaths: string[],
  ): SupplementaryClassification {
    const result: SupplementaryClassification = {
      symptoms: [],
      procedures: [],
      errors: [],
      definitions: [],
      faq: [],
      specs: [],
    };

    for (const filePath of filePaths) {
      try {
        if (!existsSync(filePath)) continue;
        const raw = readFileSync(filePath, 'utf-8');

        // Strip YAML frontmatter
        const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
        if (body.length < 100) continue;

        // Clean HTML artifacts + anonymize brand names
        const cleaned = this.textUtils.anonymizeContent(
          this.cleanWebContent(body),
        );
        if (cleaned.length < 50) continue;

        // Classify paragraphs into section buckets
        this.classifyContent(cleaned, result);
      } catch {
        this.logger.warn(`Skipping unreadable supplementary file: ${filePath}`);
      }
    }

    return result;
  }

  /** Strip HTML tags, markdown headings, images, nav breadcrumbs, and collapse whitespace */
  private cleanWebContent(text: string): string {
    return (
      text
        .replace(/<[^>]+>/g, ' ') // Strip HTML tags
        .replace(/!\[.*?\]\(.*?\)/g, '') // Strip image markdown
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
        .replace(/^[^.\n]{0,80}\|[^.\n]*$/gm, '') // Strip breadcrumb/nav lines (contains |)
        .replace(/^.*\s-\s.*\s-\s.*$/gm, '') // Strip breadcrumb lines (2+ separated dashes)
        .replace(/^(?:Recherche|Produits|Products|Menu)\b.*$/gim, '') // Strip nav header lines
        // Inline navigation phrases (from web scrapes)
        .replace(/Recherche\s+Produit/gi, '')
        .replace(/Retourner\s+\w+/gi, '')
        .replace(/Informations?\s+g[ée]n[ée]rales?/gi, '')
        .replace(/Caract[ée]ristiques?\s+et\s+avantages?/gi, '')
        .replace(/Types?\s+et\s+caract[ée]ristiques?/gi, '')
        .replace(/Catalogues?\s+et\s+brochures?/gi, '')
        .replace(/Installation\s+et\s+d[ée]tection\s+des\s+pannes?/gi, '')
        .replace(/Comment\s+installer(?!\s+[a-zéè])/gi, '') // "Comment installer" nav tab (not "Comment installer un...")
        .replace(/^-\s+\S{1,20}$/gm, '') // Strip single-word bullet items (nav crumbs)
        .replace(/\n{3,}/g, '\n\n') // Collapse excess newlines
        .replace(/\s{3,}/g, ' ') // Collapse excess inline spaces
        .replace(/^[-•]\s*/gm, '- ') // Normalize bullets
        .trim()
    );
  }

  /**
   * Classify text chunks into section-appropriate buckets using keyword heuristics.
   */
  private classifyContent(
    text: string,
    result: SupplementaryClassification,
  ): void {
    const chunks = text
      .split(/\n(?=#{1,3}\s)|(?:\n\s*\n)/)
      .filter((c) => c.trim().length > 30);

    for (const chunk of chunks) {
      const lower = chunk.toLowerCase();
      const heading = chunk.match(/^#{1,3}\s+(.+)/)?.[1]?.toLowerCase() || '';

      // Procedures FIRST — more specific keywords, avoids "panne" in procedural text
      // being misclassified as symptoms
      if (
        this.matchesPatterns(lower, heading, [
          /remplacement/,
          /installation/,
          /d[eé]montage/,
          /remontage/,
          /proc[eé]dure/,
          /[eé]tape/,
          /comment.*installer/,
          /monter/,
          /d[eé]poser/,
          /reposer/,
          /retirer/,
          /d[eé]brancher/,
        ])
      ) {
        const items = this.textUtils.extractListItems(chunk);
        result.procedures.push(
          ...(items.length > 0
            ? items
            : [this.textUtils.truncateText(chunk, 300)]),
        );
        continue;
      }

      if (
        this.matchesPatterns(lower, heading, [
          /sympt[oô]me/,
          /signe/,
          /voyant/,
          /d[eé]faillance/,
          /panne/,
          /bruit anormal/,
          /vibration/,
          /anomalie/,
          /usure/,
          /d[eé]tect/,
          /diagnostic/,
        ])
      ) {
        const items = this.textUtils.extractListItems(chunk);
        result.symptoms.push(
          ...(items.length > 0
            ? items
            : [this.textUtils.truncateText(chunk, 200)]),
        );
        continue;
      }

      if (
        this.matchesPatterns(lower, heading, [
          /erreur/,
          /attention/,
          /ne\s+pas/,
          /[eé]viter/,
          /risque/,
          /danger/,
          /pr[eé]caution/,
          /avertissement/,
        ])
      ) {
        const items = this.textUtils.extractListItems(chunk);
        result.errors.push(
          ...(items.length > 0
            ? items
            : [this.textUtils.truncateText(chunk, 200)]),
        );
        continue;
      }

      if (
        /\?/.test(heading) ||
        /faq|question.*fr[eé]quent/i.test(heading) ||
        lower.split('?').length - 1 >= 2
      ) {
        const faqs = this.extractInlineFaq(chunk);
        if (faqs.length > 0) {
          result.faq.push(...faqs);
          continue;
        }
      }

      if (
        this.matchesPatterns(lower, heading, [
          /comment.*fonctionne/,
          /c.?est quoi/,
          /d[eé]finition/,
          /caract[eé]ristique/,
          /avantage/,
          /fonctionnement/,
          /technologie/,
          /principe/,
          /types?\b/,
        ])
      ) {
        result.definitions.push(this.textUtils.truncateText(chunk, 300));
        continue;
      }

      if (
        (
          lower.match(/\d+\s*(mm|kg|nm|bar|volt|amp[eè]re|kw|cv|rpm|ohm)/g) ||
          []
        ).length >= 2
      ) {
        result.specs.push(this.textUtils.truncateText(chunk, 200));
        continue;
      }

      if (chunk.length >= 200) {
        result.definitions.push(this.textUtils.truncateText(chunk, 200));
      }
    }
  }

  private matchesPatterns(
    lower: string,
    heading: string,
    patterns: RegExp[],
  ): boolean {
    return patterns.some((p) => p.test(lower) || p.test(heading));
  }

  private extractInlineFaq(chunk: string): Array<{ q: string; a: string }> {
    const faqs: Array<{ q: string; a: string }> = [];
    const lines = chunk.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const qMatch = lines[i].match(/^#{1,4}\s+(.+\?)\s*$/);
      if (!qMatch) continue;
      const question = qMatch[1].trim();
      const answerLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^#{1,4}\s/)) break;
        const trimmed = lines[j].trim();
        if (trimmed) answerLines.push(trimmed);
      }
      const answer = answerLines.join(' ');
      if (question.length >= 10 && answer.length >= 20) {
        faqs.push({ q: question, a: answer });
      }
    }
    return faqs;
  }

  /**
   * Merge classified supplementary content into an existing PageContract.
   * Deduplication by prefix-40-chars, capped at 5 items per section.
   */
  private mergeSupplementaryIntoContract(
    contract: PageContract,
    supplementary: SupplementaryClassification,
    pgAlias: string,
  ): boolean {
    const gammeName = pgAlias.replace(/-/g, ' ');
    let modified = false;

    // S1 (definitions) → enrich intro.role (filter marketing content)
    if (supplementary.definitions.length > 0) {
      const cleanDefs = supplementary.definitions.filter(
        (d) => !ConseilEnricherService.isMarketingContent(d),
      );
      if (cleanDefs.length > 0) {
        const bestDef = cleanDefs.sort((a, b) => b.length - a.length)[0];
        if (!contract.intro?.role) {
          contract.intro = { ...contract.intro, role: bestDef };
          modified = true;
        } else if (bestDef.length > contract.intro.role.length * 1.3) {
          contract.intro.role +=
            '. ' + this.textUtils.truncateText(bestDef, 150);
          modified = true;
        }
      }
    }

    // S2 (symptoms) → deduplicate + filter marketing + append max 5
    if (supplementary.symptoms.length > 0) {
      const existing = new Set(
        (contract.symptoms || []).map((s) => s.toLowerCase().slice(0, 40)),
      );
      const newItems = supplementary.symptoms.filter((s) => {
        if (existing.has(s.toLowerCase().slice(0, 40))) return false;
        return !ConseilEnricherService.isMarketingContent(s);
      });
      if (newItems.length > 0) {
        contract.symptoms = [
          ...(contract.symptoms || []),
          ...newItems.slice(0, 5),
        ];
        modified = true;
      }
    }

    // S4 (procedures) → replace only if primary weak (< 3 items)
    if (supplementary.procedures.length >= 3) {
      if ((contract.diagnosticTree?.length || 0) < 3) {
        contract.diagnosticTree = supplementary.procedures
          .slice(0, 8)
          .map((step, i) => ({ if: `Étape ${i + 1}`, then: step }));
        modified = true;
      }
    }

    // S5 (errors) → deduplicate + filter marketing + append max 5
    if (supplementary.errors.length > 0) {
      const existing = new Set(
        (contract.antiMistakes || []).map((e) => e.toLowerCase().slice(0, 40)),
      );
      const newItems = supplementary.errors.filter((e) => {
        if (existing.has(e.toLowerCase().slice(0, 40))) return false;
        return !ConseilEnricherService.isMarketingContent(e);
      });
      if (newItems.length > 0) {
        contract.antiMistakes = [
          ...(contract.antiMistakes || []),
          ...newItems.slice(0, 5),
        ];
        modified = true;
      }
    }

    // S8 (FAQ) → deduplicate + filter marketing answers + append max 5
    if (supplementary.faq.length > 0) {
      const existing = new Set(
        (contract.faq || []).map((f) => f.q.toLowerCase().slice(0, 40)),
      );
      const newFaqs = supplementary.faq.filter((f) => {
        if (existing.has(f.q.toLowerCase().slice(0, 40))) return false;
        return !ConseilEnricherService.isMarketingContent(f.a || '');
      });
      if (newFaqs.length > 0) {
        contract.faq = [...(contract.faq || []), ...newFaqs.slice(0, 5)];
        modified = true;
      }
    }

    // S3 (howToChoose from specs) → fill only if empty
    if (
      supplementary.specs.length > 0 &&
      !contract.howToChoose?.length &&
      !contract.howToChooseInline
    ) {
      contract.howToChooseInline = `Pour choisir les bons ${gammeName}, vérifiez : ${supplementary.specs.slice(0, 3).join('. ')}.`;
      modified = true;
    }

    return modified;
  }

  // ── SEO Descrip Draft Generation ──

  /**
   * Compose a personalized meta description (max 160 chars) from the PageContract.
   * Structure: function + timing + CTA
   */
  private composeSeoDescrip(
    contract: PageContract,
    _pgAlias: string,
  ): string | null {
    const intro = contract.intro?.role;
    if (!intro || intro.length < 30) return null;

    // Phrase 1: main function with restored accents (truncated to 80 chars)
    const func = this.textUtils
      .restoreAccents(intro)
      .replace(/\.$/, '')
      .slice(0, 80);

    // Phrase 2: timing if available
    const km = contract.timing?.km?.[0];
    const timing = km
      ? ` Remplacement tous les ${km.toLocaleString('fr-FR')} km.`
      : '';

    // Phrase 3: call-to-action
    const cta = ' Livraison 24-48h.';

    const result = `${func}.${timing}${cta}`;
    return result.length <= 160 ? result : `${func}.${cta}`;
  }

  /**
   * Write sg_descrip_draft to __seo_gamme if a meaningful description can be composed.
   */
  private async writeSeoDescripDraft(
    pgId: string,
    contract: PageContract,
    pgAlias: string,
    conservativeMode = false,
  ): Promise<void> {
    const templateDescrip = this.composeSeoDescrip(contract, pgAlias);
    if (!templateDescrip) return;

    let finalDescrip = templateDescrip;
    let draftSource = conservativeMode ? 'pipeline:conservative' : 'pipeline';
    let llmModel: string | null = null;

    if (this.aiContentService && !conservativeMode) {
      try {
        // Brief-aware template selection (Phase 2)
        const brief = this.flags.briefAwareEnabled
          ? await this.pageBriefService?.getActiveBrief(
              parseInt(pgId),
              'R3_conseils',
            )
          : null;

        const gammeLabelName = pgAlias.replace(/-/g, ' ');
        const result = await this.aiContentService.generateContent({
          type: brief ? 'seo_descrip_R3' : 'seo_descrip_polish',
          prompt: `Polish meta description for ${pgAlias}`,
          tone: 'professional',
          language: 'fr',
          maxLength: 200,
          temperature: 0.3,
          context: brief
            ? { draft: templateDescrip, gammeName: gammeLabelName, brief }
            : { draft: templateDescrip, gammeName: gammeLabelName },
          useCache: true,
        });
        const polished = result.content.trim();
        if (polished.length > 0 && polished.length <= 160) {
          finalDescrip = polished;
          draftSource = brief ? 'pipeline+llm+brief' : 'pipeline+llm';
          llmModel = result.metadata.model;
          this.logger.log(
            `LLM polished sg_descrip for pgId=${pgId} (${polished.length} chars, model=${llmModel}, brief=${brief ? 'R3' : 'none'})`,
          );
        } else {
          this.logger.warn(
            `LLM polish rejected for pgId=${pgId}: length=${polished.length}, using template`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `LLM polish failed for pgId=${pgId}, using template: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const { error } = await this.client
      .from('__seo_gamme')
      .update({
        sg_descrip_draft: finalDescrip,
        sg_draft_source: draftSource,
        sg_draft_updated_at: new Date().toISOString(),
        sg_draft_llm_model: llmModel,
      })
      .eq('sg_pg_id', pgId);

    if (error) {
      this.logger.warn(
        `Failed to write sg_descrip_draft for pgId=${pgId}: ${error.message}`,
      );
    } else {
      this.logger.log(
        `sg_descrip_draft written for pgId=${pgId} (${finalDescrip.length} chars, source=${draftSource})`,
      );
    }
  }
}
