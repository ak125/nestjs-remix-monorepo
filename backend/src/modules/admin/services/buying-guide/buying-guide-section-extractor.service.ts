import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  SelectionCriterionSchema,
  DecisionNodeSchema,
  UseCaseSchema,
} from '../../dto/buying-guide-enrich.dto';
import { EnricherTextUtils } from '../enricher-text-utils.service';

/**
 * Pure markdown section extraction logic for buying guide enrichment.
 * No I/O, no DB — only sync parsing.
 */
@Injectable()
export class BuyingGuideSectionExtractor {
  constructor(private readonly textUtils: EnricherTextUtils) {}

  /**
   * Extract FAQ items from markdown guide docs.
   * Matches ### headings ending with "?" and collects answer paragraphs.
   */
  extractFaqFromMarkdown(
    markdown: string,
  ): Array<{ question: string; answer: string }> {
    const faqs: Array<{ question: string; answer: string }> = [];
    if (!markdown) return faqs;
    const lines = markdown.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^###\s+(.+\?)\s*$/);
      if (!match) continue;
      const question = match[1].trim();
      const answerLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^#{1,3}\s+/)) break;
        const trimmed = lines[j].trim();
        if (trimmed) answerLines.push(trimmed);
      }
      const answer = answerLines.join(' ');
      if (question.length >= 10 && answer.length >= 20) {
        faqs.push({ question, answer });
      }
    }
    return faqs;
  }

  extractSection(markdown: string, heading: string): string | null {
    // Match ## or ### heading (case-insensitive, accent-insensitive)
    const lines = markdown.split('\n');
    const headingLower = heading.toLowerCase();
    let startIdx = -1;
    let headingLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,3})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        if (level < 2) continue; // skip h1 for heading search
        const title = match[2].trim().toLowerCase();
        if (title.includes(headingLower) || headingLower.includes(title)) {
          startIdx = i + 1;
          headingLevel = level;
          break;
        }
      }
    }

    if (startIdx < 0) return null;

    // Collect until next heading of same or higher level (including h1)
    const sectionLines: string[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(#{1,3})\s+/);
      if (match && match[1].length <= headingLevel) break;
      sectionLines.push(line);
    }

    const content = sectionLines.join('\n').trim();
    return content || null;
  }

  /**
   * Extract numbered list items from a markdown section.
   * Matches: "1. **Title** - Description" or "1. Description"
   */
  extractNumberedList(section: string): string[] {
    return section
      .split('\n')
      .map((line) => {
        const match = line.match(/^\s*\d+\.\s+(.+)/);
        return match ? match[1].trim() : '';
      })
      .filter((line) => line.length >= 10);
  }

  buildCriteriaFromCheckList(
    items: string[],
  ): z.infer<typeof SelectionCriterionSchema>[] {
    return items.map((item, i) => {
      const key = item
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 30);
      // First 5 items are "required", rest are "recommended"
      const priority: 'required' | 'recommended' =
        i < 5 ? 'required' : 'recommended';
      return {
        key: key || `criterion_${i + 1}`,
        label: item.split('.')[0].split(':')[0].trim(),
        guidance: item,
        priority,
      };
    });
  }

  buildDecisionTree(
    replaceSection: string,
    testsSection: string,
    testsAtelierSection: string,
  ): z.infer<typeof DecisionNodeSchema>[] {
    const nodes: z.infer<typeof DecisionNodeSchema>[] = [];

    // Node 1: Visual inspection (from tests simples)
    const simpleTests = this.textUtils.extractBulletList(testsSection);
    if (simpleTests.length > 0) {
      nodes.push({
        id: 'step-visual',
        question: 'Inspection visuelle et tests simples sans outil',
        options: [
          {
            label: 'Anomalie visible',
            outcome: 'check' as const,
            nextId: 'step-atelier',
            note: simpleTests.join('. '),
          },
          {
            label: 'Aucune anomalie visible',
            outcome: 'continue' as const,
            nextId: 'step-atelier',
          },
        ],
      });
    }

    // Node 2: Workshop tests (from tests atelier)
    const atelierTests = this.textUtils.extractBulletList(testsAtelierSection);
    if (atelierTests.length > 0) {
      nodes.push({
        id: 'step-atelier',
        question: 'Tests atelier avec outils de mesure',
        options: [
          {
            label: 'Mesures hors tolerance',
            outcome: 'replace' as const,
            note: atelierTests.join('. '),
          },
          {
            label: 'Mesures conformes',
            outcome: 'stop' as const,
            note: 'Piece encore en bon etat de service.',
          },
        ],
      });
    }

    // Node 3: Immediate replacement criteria
    const replaceCriteria = this.textUtils.extractBulletList(replaceSection);
    if (replaceCriteria.length > 0) {
      nodes.push({
        id: 'step-urgence',
        question: 'Criteres de remplacement immediat (securite)',
        options: [
          {
            label: 'Un ou plusieurs criteres presents',
            outcome: 'replace' as const,
            note: replaceCriteria.join('. '),
          },
          {
            label: 'Aucun critere de remplacement immediat',
            outcome: 'continue' as const,
            nextId: 'step-visual',
          },
        ],
      });
    }

    return nodes;
  }

  buildUseCases(
    percesSection: string,
    rainuresSection: string,
    standardSection: string,
  ): z.infer<typeof UseCaseSchema>[] {
    const useCases: z.infer<typeof UseCaseSchema>[] = [];

    if (percesSection) {
      const advantages = this.extractSubSection(percesSection, 'Avantages');
      const inconvenients = this.extractSubSection(
        percesSection,
        'Inconvenients',
      );
      useCases.push({
        id: 'perces',
        label: 'Disques percés',
        recommendation: `Avantages: ${advantages || 'evacuation gaz/eau'}. Inconvenients: ${inconvenients || 'usure plaquettes acceleree'}.`,
      });
    }

    if (rainuresSection) {
      const advantages = this.extractSubSection(rainuresSection, 'Avantages');
      const inconvenients = this.extractSubSection(
        rainuresSection,
        'Inconvenients',
      );
      useCases.push({
        id: 'rainures',
        label: 'Disques rainurés',
        recommendation: `Avantages: ${advantages || 'nettoyage de surface'}. Inconvenients: ${inconvenients || 'bruit, confort reduit'}.`,
      });
    }

    if (standardSection) {
      const advantages = this.extractSubSection(standardSection, 'Avantages');
      const inconvenients = this.extractSubSection(
        standardSection,
        'Inconvenients',
      );
      useCases.push({
        id: 'standard',
        label: 'Disques pleins/ventilés standard',
        recommendation: `Avantages: ${advantages || 'cout maitrise, bon compromis'}. Inconvenients: ${inconvenients || 'gestion thermique inferieure'}.`,
      });
    }

    return useCases;
  }

  extractSubSection(text: string, label: string): string {
    const lines = text.split('\n');
    const labelLower = label.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (!lineLower.includes(labelLower)) continue;

      // Case 1: Inline "- Avantages: evacuation gaz/eau..."
      const colonIdx = lines[i].indexOf(':');
      if (colonIdx >= 0) {
        const inline = lines[i]
          .substring(colonIdx + 1)
          .trim()
          .replace(/\.$/, '');
        if (inline) return inline;
      }

      // Case 2: Sub-heading with bullets underneath
      const items: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.startsWith('-') || line.startsWith('•')) {
          items.push(line.replace(/^[-•]\s*/, '').trim());
        } else if (line.match(/^[A-Z#]/) || line === '') {
          break;
        }
      }
      if (items.length > 0) return items.join(', ');
    }
    return '';
  }

  /**
   * Filters parasitic entries from string arrays (symptoms, anti_mistakes).
   * Rejects: QA flags, YAML fragment prefixes, raw keywords, markdown artifacts.
   */
  private static readonly PARASITIC_PATTERNS = [
    /^(FAQ_TOO_SMALL|TOO_SHORT|GATES_CLEAN|SYMPTOMS_TOO_SMALL|DUPLICATE_ITEMS|SKIPPED_\w+|S\d_TOO_SHORT|GENERIC_\w+|NO_NUMBERS_\w+)$/,
    /^content:\s/i,
    /^answer:\s/i,
    /^'\*\*/,
    /^###\s/,
    /^❌\s*".*"$/, // "Fausses promesses" markers leaked from YAML (e.g., ❌ "homologué CT")
  ];

  static sanitizeStringArray(arr: string[]): string[] {
    return arr.filter((item) => {
      if (typeof item !== 'string') return false;
      const trimmed = item.trim();
      if (trimmed.length < 10) return false;
      return !BuyingGuideSectionExtractor.PARASITIC_PATTERNS.some((p) =>
        p.test(trimmed),
      );
    });
  }
}
