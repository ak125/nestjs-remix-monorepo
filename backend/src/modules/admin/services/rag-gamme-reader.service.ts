/**
 * RagGammeReaderService — Lecture centralisée des fichiers RAG gamme.
 *
 * Remplace les 5 copies de readRagFromDisk/parseRagData dispersées dans :
 * - r1-image-prompt.service.ts
 * - r3-image-prompt.service.ts
 * - r1-enricher.service.ts
 * - r1-related-resources.service.ts
 * - vehicle-rag-generator.service.ts
 *
 * Utilise EnricherYamlParser (service partagé existant) pour le parsing YAML.
 */
import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import { EnricherYamlParser } from './enricher-yaml-parser.service';
import { type RagData } from './rag-data.types';

const RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';

@Injectable()
export class RagGammeReaderService {
  private readonly logger = new Logger(RagGammeReaderService.name);

  constructor(private readonly yamlParser: EnricherYamlParser) {}

  /**
   * Lit le contenu brut d'un fichier RAG gamme depuis le disque.
   * @returns Contenu markdown complet ou null si fichier absent.
   */
  readRawContent(pgAlias: string): string | null {
    const filePath = join(RAG_GAMMES_DIR, `${pgAlias}.md`);
    try {
      if (!existsSync(filePath)) return null;
      return readFileSync(filePath, 'utf-8');
    } catch {
      this.logger.warn(`[RAG-READER] Failed to read ${pgAlias}.md`);
      return null;
    }
  }

  /**
   * Parse le frontmatter YAML d'un contenu RAG en RagData typé.
   * Utilise EnricherYamlParser.extractFrontmatterBlock() (centralisé).
   */
  parseRagData(content: string): RagData {
    const fm = this.yamlParser.extractFrontmatterBlock(content);
    if (!fm) return {};
    try {
      const parsed = yaml.load(fm) as Record<string, unknown>;
      return {
        category: parsed.category as string | undefined,
        domain: parsed.domain as RagData['domain'],
        diagnostic: parsed.diagnostic as RagData['diagnostic'],
        maintenance: parsed.maintenance as RagData['maintenance'],
        selection: parsed.selection as RagData['selection'],
        installation: parsed.installation as RagData['installation'],
      };
    } catch {
      this.logger.warn(`[RAG-READER] Failed to parse YAML frontmatter`);
      return {};
    }
  }

  /**
   * Lecture + parsing combinés. Méthode principale.
   */
  readAndParse(pgAlias: string): RagData | null {
    const content = this.readRawContent(pgAlias);
    if (!content) return null;
    const data = this.parseRagData(content);
    return Object.keys(data).length > 0 ? data : null;
  }
}
