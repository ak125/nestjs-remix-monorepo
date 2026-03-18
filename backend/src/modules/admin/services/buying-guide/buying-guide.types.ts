import type { GammeContentQualityFlag } from '../../../../config/buying-guide-quality.constants';

export interface SectionValidationResult {
  ok: boolean;
  flags: GammeContentQualityFlag[];
  content: unknown;
  sources: string[];
  confidence: number;
  sourcesCitation: string;
  rawAnswer: string;
}

export interface EnrichDryRunSection {
  content: unknown;
  sources: string[];
  confidence: number;
  flags: GammeContentQualityFlag[];
  ok: boolean;
  rawAnswer: string;
}

export interface EnrichDryRunResult {
  pgId: string;
  gammeName: string;
  family: string;
  sections: Record<string, EnrichDryRunSection>;
  qualityScore: number;
  qualityFlags: GammeContentQualityFlag[];
  antiWikiGate: { ok: boolean; reasons: string[] };
  wouldUpdate: boolean;
}
