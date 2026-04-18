/**
 * DiagnosticEngine SearchService — Ranking unifie (breezy-eagle Phase A3)
 *
 * Agrège les resultats /search de type symptom + maintenance + dtc,
 * score chaque hit, retourne un tableau ordonne pour le typeahead.
 *
 * Ranking rules (plan) :
 *   3 × exact label match
 *   2 × substring label match
 *   1.5 × synonym hit
 *   1 × DTC hit
 *   0.8 × maintenance label
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  DiagnosticEngineDataService,
  DiagSymptom,
  DiagMaintenanceOperation,
} from './diagnostic-engine.data-service';

export interface SearchHit {
  type: 'symptom' | 'maintenance' | 'dtc';
  slug: string;
  label: string;
  system_slug: string | null;
  urgency: string | null;
  score: number;
}

const DTC_RE = /^[PCBU]\d{4}$/i;

@Injectable()
export class DiagnosticEngineSearchService {
  private readonly logger = new Logger(DiagnosticEngineSearchService.name);

  constructor(private readonly data: DiagnosticEngineDataService) {}

  async search(rawQ: string, limit = 10): Promise<SearchHit[]> {
    const q = rawQ.trim();
    if (q.length < 2) return [];

    const qLower = q.toLowerCase();
    const isDtc = DTC_RE.test(q);

    // Fire the right queries in parallel
    const [symptoms, maintenance, dtcResult] = await Promise.all([
      this.data.searchSymptoms(q, limit * 2),
      this.data.searchMaintenance(q, limit),
      isDtc
        ? this.data.lookupDtc(q)
        : Promise.resolve({
            code: q.toUpperCase(),
            symptoms: [] as DiagSymptom[],
            likely_causes: [],
          }),
    ]);

    // Resolve system slugs for symptoms (single batch)
    const systemMap = await this.buildSystemMap(
      symptoms.concat(dtcResult.symptoms),
    );

    const hits: SearchHit[] = [];

    // Symptoms
    for (const s of symptoms) {
      hits.push({
        type: 'symptom',
        slug: s.slug,
        label: s.label,
        system_slug: systemMap.get(s.system_id) || null,
        urgency: s.urgency,
        score: this.scoreSymptom(s, qLower),
      });
    }

    // DTC hit (one synthetic entry if the query matches a DTC code)
    if (isDtc && dtcResult.symptoms.length > 0) {
      hits.push({
        type: 'dtc',
        slug: dtcResult.code,
        label: `Code OBD ${dtcResult.code} — ${dtcResult.symptoms.length} symptôme(s)`,
        system_slug: systemMap.get(dtcResult.symptoms[0].system_id) || null,
        urgency: dtcResult.symptoms[0].urgency,
        score: 100, // DTC exact match ranks highest
      });
    }

    // Maintenance
    for (const m of maintenance) {
      hits.push({
        type: 'maintenance',
        slug: m.slug,
        label: m.label,
        system_slug: systemMap.get(m.system_id) || null,
        urgency: null,
        score: this.scoreMaintenance(m, qLower),
      });
    }

    // Dedup by (type+slug), keep highest score
    const best = new Map<string, SearchHit>();
    for (const h of hits) {
      const key = `${h.type}:${h.slug}`;
      const prev = best.get(key);
      if (!prev || h.score > prev.score) best.set(key, h);
    }

    return Array.from(best.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private scoreSymptom(s: DiagSymptom, qLower: string): number {
    const label = s.label.toLowerCase();
    let score = 0;
    if (label === qLower) score += 30;
    else if (label.includes(qLower)) score += 20;
    if (s.synonyms.some((syn) => syn.toLowerCase().includes(qLower)))
      score += 15;
    if (s.dtc_codes.some((d) => d.toLowerCase() === qLower)) score += 10;
    // Urgency boost
    if (s.urgency === 'critique') score += 3;
    else if (s.urgency === 'haute') score += 2;
    return score;
  }

  private scoreMaintenance(
    m: DiagMaintenanceOperation,
    qLower: string,
  ): number {
    const label = m.label.toLowerCase();
    let score = 0;
    if (label === qLower) score += 24;
    else if (label.includes(qLower)) score += 16;
    if (m.description?.toLowerCase().includes(qLower)) score += 4;
    return score * 0.8; // maintenance weight per plan
  }

  private async buildSystemMap(
    symptoms: DiagSymptom[],
  ): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (!symptoms.length) return map;
    const systems = await this.data.getActiveSystems();
    for (const sys of systems) map.set(sys.id, sys.slug);
    return map;
  }
}
