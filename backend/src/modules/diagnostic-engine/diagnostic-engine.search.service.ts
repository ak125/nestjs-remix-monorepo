/**
 * DiagnosticEngine SearchService — delegation RAG (strategy pivot 2026-04-18)
 *
 * Recherche unifiee pour /api/diagnostic-engine/search :
 *   1. Delegue la requete au RAG pipeline (embeddings semantiques)
 *   2. Filtre les chunks R5_DIAGNOSTIC (excl. backups)
 *   3. Pour chaque chunk, tente un match EXACT titre H3 -> __diag_symptom.label
 *      (pas de matching fuzzy/synonymes fabriques)
 *   4. Retourne hits avec slug DB lie si match exact, sinon chunk RAG autonome
 *   5. Fallback si RAG indisponible : ILIKE simple sur __diag_symptom.label
 *
 * ❌ Aucun synonyme en DB (colonnes synonyms/dtc_codes ignorees)
 * ❌ Aucun mapping pre-calcule en DB (rag_doc_id absent)
 * ✅ RAG = single source of truth pour la recherche
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { RagProxyService } from '../rag-proxy/rag-proxy.service';
import {
  DiagnosticEngineDataService,
  DiagSymptom,
} from './diagnostic-engine.data-service';

export interface SearchHit {
  type: 'symptom' | 'maintenance' | 'dtc' | 'rag';
  slug: string;
  label: string;
  system_slug: string | null;
  urgency: string | null;
  score: number;
  rag_source_path?: string;
  rag_truth_level?: string;
}

const DTC_RE = /^[PCBU]\d{4}$/i;

@Injectable()
export class DiagnosticEngineSearchService {
  private readonly logger = new Logger(DiagnosticEngineSearchService.name);

  constructor(
    private readonly data: DiagnosticEngineDataService,
    @Optional() private readonly ragService: RagProxyService | null,
  ) {}

  async search(rawQ: string, limit = 10): Promise<SearchHit[]> {
    const q = rawQ.trim();
    if (q.length < 2) return [];

    const isDtc = DTC_RE.test(q);

    // DTC : lookup direct via data-service (aucun besoin du RAG)
    if (isDtc) {
      const dtcResult = await this.data.lookupDtc(q);
      if (dtcResult.symptoms.length > 0) {
        const systemMap = await this.buildSystemMap();
        return [
          {
            type: 'dtc',
            slug: dtcResult.code,
            label: `Code OBD ${dtcResult.code} — ${dtcResult.symptoms.length} symptôme(s)`,
            system_slug: systemMap.get(dtcResult.symptoms[0].system_id) || null,
            urgency: dtcResult.symptoms[0].urgency,
            score: 1,
          },
        ];
      }
    }

    // Recherche semantique via RAG
    const ragHits = await this.searchViaRag(q, limit);
    if (ragHits.length > 0) return ragHits;

    // Fallback ILIKE si RAG indisponible ou zero hit
    return this.searchViaFallback(q, limit);
  }

  /**
   * Delegue au RAG pipeline + resolution slug DB par match exact titre -> label.
   */
  private async searchViaRag(q: string, limit: number): Promise<SearchHit[]> {
    if (!this.ragService) {
      this.logger.debug('RAG service not loaded, skipping semantic search');
      return [];
    }

    try {
      const response = await this.ragService.search({
        query: q,
        limit: Math.max(limit * 3, 15),
        filters: { truth_levels: ['L1', 'L2'] },
        routing: { target_role: 'R5_DIAGNOSTIC' },
      });
      const results = response.results || [];

      // Filtrer chunks R5 diagnostic, exclure backups
      const filtered = results.filter((r) => {
        const sp = (r.source_path || r.sourcePath || '').toString();
        if (sp.includes('.backup-') || sp.includes('/_quarantine/'))
          return false;
        return (
          r.primary_role === 'R5_DIAGNOSTIC' ||
          r.section_key === 'symptoms' ||
          r.allowed_roles?.includes('R5_DIAGNOSTIC') ||
          sp.startsWith('diagnostic/')
        );
      });

      if (filtered.length === 0) return [];

      // Preparer map labels -> DiagSymptom pour resolution slug
      const symptoms = await this.data.getAllActiveSymptoms();
      const systemMap = await this.buildSystemMap();
      const byNormalizedLabel = new Map<string, DiagSymptom>();
      for (const s of symptoms) {
        byNormalizedLabel.set(this.normalize(s.label), s);
      }

      // Pour chaque chunk RAG, tenter match exact avec un label DB
      const hits: SearchHit[] = [];
      const seenSlugs = new Set<string>();
      for (const r of filtered) {
        const h3 = this.extractH3FromContent(r.content || '');
        const normalizedH3 = this.normalize(h3 || r.title || '');
        const sym = byNormalizedLabel.get(normalizedH3);

        if (sym && !seenSlugs.has(sym.slug)) {
          seenSlugs.add(sym.slug);
          hits.push({
            type: 'symptom',
            slug: sym.slug,
            label: sym.label,
            system_slug: systemMap.get(sym.system_id) || null,
            urgency: sym.urgency,
            score: r.score,
            rag_source_path: r.source_path || r.sourcePath,
            rag_truth_level: r.truth_level,
          });
        } else if (hits.length < limit) {
          // Chunk RAG sans slug DB : proposer en resultat autonome
          hits.push({
            type: 'rag',
            slug: r.chunk_id || '',
            label: h3 || r.title || '(chunk)',
            system_slug: null,
            urgency: null,
            score: r.score,
            rag_source_path: r.source_path || r.sourcePath,
            rag_truth_level: r.truth_level,
          });
        }

        if (hits.length >= limit) break;
      }

      return hits;
    } catch (e) {
      this.logger.warn(
        `RAG search failed for "${q}": ${(e as Error).message} — fallback to ILIKE`,
      );
      return [];
    }
  }

  /**
   * Fallback ILIKE sur __diag_symptom.label quand le RAG est indisponible.
   * Pas de synonymes, pas d'unaccent avance — juste un match basique.
   */
  private async searchViaFallback(
    q: string,
    limit: number,
  ): Promise<SearchHit[]> {
    const [symptoms, maintenance, systemMap] = await Promise.all([
      this.data.searchSymptomsByLabelOnly(q, limit),
      this.data.searchMaintenanceByLabelOnly(q, limit),
      this.buildSystemMap(),
    ]);

    const hits: SearchHit[] = [];
    for (const s of symptoms) {
      hits.push({
        type: 'symptom',
        slug: s.slug,
        label: s.label,
        system_slug: systemMap.get(s.system_id) || null,
        urgency: s.urgency,
        score: 0.5, // score bas pour signaler fallback
      });
    }
    for (const m of maintenance) {
      hits.push({
        type: 'maintenance',
        slug: m.slug,
        label: m.label,
        system_slug: systemMap.get(m.system_id) || null,
        urgency: null,
        score: 0.4,
      });
    }
    return hits.slice(0, limit);
  }

  private normalize(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractH3FromContent(content: string): string {
    const m = content.match(/^###\s+(.+?)$/m);
    return m ? m[1].trim() : '';
  }

  private async buildSystemMap(): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const systems = await this.data.getActiveSystems();
    for (const sys of systems) map.set(sys.id, sys.slug);
    return map;
  }
}
