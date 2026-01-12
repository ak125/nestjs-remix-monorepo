import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  LexiqueMatrice,
  Gamme,
  validateLexiqueMatrice,
  detectConfusion,
  detectDangerousClaims,
  detectConfusionPairs,
  detectAmbiguousTerms,
} from '../schemas/lexique-matrice.schema';

export interface ValidationResult {
  valid: boolean;
  issues: Array<{
    rule: string;
    severity: 'warning' | 'blocking';
    message: string;
  }>;
  stats: {
    totalIssues: number;
    blockingCount: number;
    warningCount: number;
  };
}

export interface GammeWithRules {
  pg_id: number;
  slug: string;
  nom_fr: string;
  famille: string;
  lexique_autorise: string[];
  lexique_interdit: string[];
  role_fonctionnel: string;
  verbes_autorises: string[];
  verbes_interdits: string[];
  pieces_associees: (string | number)[];
  symptomes: string[];
  claims_interdits: string[];
  // Global rules that apply
  termes_globaux_interdits: string[];
  phrases_association_autorisees: string[];
  // Related confusion pairs
  confusion_pairs: Array<{
    piece_a: string;
    piece_b: string;
    severity: string;
    message_fr: string;
  }>;
  // Ambiguous terms related to this gamme
  ambiguous_terms: Array<{
    term: string;
    required_contexts: string[];
    message_fr: string;
  }>;
}

@Injectable()
export class SeoMatriceService implements OnModuleInit {
  private readonly logger = new Logger(SeoMatriceService.name);
  private matrice: LexiqueMatrice | null = null;
  private gammesByPgId: Map<number, { gamme: Gamme; famille: string }> =
    new Map();
  private gammesBySlug: Map<string, { gamme: Gamme; famille: string }> =
    new Map();

  async onModuleInit() {
    await this.loadMatrice();
  }

  /**
   * Load the matrice from JSON file
   */
  async loadMatrice(): Promise<void> {
    try {
      // Use __dirname to navigate from dist/modules/seo/services/ up to backend/data/
      const matricePath = join(
        __dirname,
        '../../../../data/seo-lexique-matrice.json',
      );
      this.logger.log(`📂 Loading matrice from: ${matricePath}`);

      const content = readFileSync(matricePath, 'utf-8');
      const data = JSON.parse(content);

      const validation = validateLexiqueMatrice(data);
      if (!validation.success) {
        this.logger.error('Matrice validation failed:', validation.errors);
        throw new Error(`Invalid matrice: ${validation.errors?.join(', ')}`);
      }

      this.matrice = validation.data!;

      // Build lookup maps
      this.gammesByPgId.clear();
      this.gammesBySlug.clear();

      for (const famille of this.matrice.familles) {
        for (const gamme of famille.gammes) {
          this.gammesByPgId.set(gamme.pg_id, { gamme, famille: famille.code });
          this.gammesBySlug.set(gamme.slug, { gamme, famille: famille.code });
        }
      }

      this.logger.log(
        `✅ Matrice SEO v${this.matrice.version} chargée: ${this.gammesByPgId.size} gammes`,
      );
    } catch (error) {
      this.logger.error('Failed to load matrice:', error);
      throw error;
    }
  }

  /**
   * Get matrice version and stats
   */
  getMatriceInfo(): {
    version: string;
    updated_at: string;
    total_gammes: number;
    total_familles: number;
    confusion_pairs_count: number;
    ambiguous_terms_count: number;
  } | null {
    if (!this.matrice) return null;

    return {
      version: this.matrice.version,
      updated_at: this.matrice.updated_at,
      total_gammes: this.gammesByPgId.size,
      total_familles: this.matrice.familles.length,
      confusion_pairs_count: this.matrice.confusion_pairs.length,
      ambiguous_terms_count: this.matrice.ambiguous_terms.length,
    };
  }

  /**
   * Get gamme rules by pg_id
   */
  getGammeByPgId(pgId: number): GammeWithRules | null {
    if (!this.matrice) return null;

    const entry = this.gammesByPgId.get(pgId);
    if (!entry) return null;

    return this.buildGammeWithRules(entry.gamme, entry.famille);
  }

  /**
   * Get gamme rules by slug
   */
  getGammeBySlug(slug: string): GammeWithRules | null {
    if (!this.matrice) return null;

    const entry = this.gammesBySlug.get(slug);
    if (!entry) return null;

    return this.buildGammeWithRules(entry.gamme, entry.famille);
  }

  /**
   * Build full gamme object with all applicable rules
   */
  private buildGammeWithRules(gamme: Gamme, famille: string): GammeWithRules {
    if (!this.matrice) {
      throw new Error('Matrice not loaded');
    }

    // Find confusion pairs that involve this gamme
    const relatedConfusionPairs = this.matrice.confusion_pairs.filter(
      (pair) =>
        pair.piece_a.toLowerCase().includes(gamme.slug.replace(/-/g, ' ')) ||
        pair.piece_b.toLowerCase().includes(gamme.slug.replace(/-/g, ' ')) ||
        gamme.nom_fr.toLowerCase().includes(pair.piece_a.toLowerCase()) ||
        gamme.nom_fr.toLowerCase().includes(pair.piece_b.toLowerCase()),
    );

    // Find ambiguous terms related to this gamme's lexique
    const relatedAmbiguousTerms = this.matrice.ambiguous_terms.filter((term) =>
      gamme.lexique_autorise.some(
        (lex) =>
          lex.toLowerCase().includes(term.term.toLowerCase()) ||
          term.term.toLowerCase().includes(lex.toLowerCase()),
      ),
    );

    return {
      pg_id: gamme.pg_id,
      slug: gamme.slug,
      nom_fr: gamme.nom_fr,
      famille,
      lexique_autorise: gamme.lexique_autorise,
      lexique_interdit: gamme.lexique_interdit,
      role_fonctionnel: gamme.role_fonctionnel,
      verbes_autorises: gamme.verbes_autorises,
      verbes_interdits: gamme.verbes_interdits,
      pieces_associees: gamme.pieces_associees,
      symptomes: gamme.symptomes,
      claims_interdits: gamme.claims_interdits,
      termes_globaux_interdits: this.matrice.termes_globaux_interdits,
      phrases_association_autorisees:
        this.matrice.phrases_association_autorisees,
      confusion_pairs: relatedConfusionPairs.map((p) => ({
        piece_a: p.piece_a,
        piece_b: p.piece_b,
        severity: p.severity,
        message_fr: p.message_fr,
      })),
      ambiguous_terms: relatedAmbiguousTerms.map((t) => ({
        term: t.term,
        required_contexts: t.required_contexts,
        message_fr: t.message_fr,
      })),
    };
  }

  /**
   * Validate content against SEO rules for a specific gamme
   */
  validateContent(
    pgId: number,
    content: string,
    zones?: { title?: string; intro?: string; body?: string },
  ): ValidationResult {
    if (!this.matrice) {
      return {
        valid: false,
        issues: [
          {
            rule: 'SYSTEM',
            severity: 'blocking',
            message: 'Matrice not loaded',
          },
        ],
        stats: { totalIssues: 1, blockingCount: 1, warningCount: 0 },
      };
    }

    const entry = this.gammesByPgId.get(pgId);
    if (!entry) {
      return {
        valid: false,
        issues: [
          {
            rule: 'SYSTEM',
            severity: 'blocking',
            message: `Gamme ${pgId} not found`,
          },
        ],
        stats: { totalIssues: 1, blockingCount: 1, warningCount: 0 },
      };
    }

    const { gamme } = entry;
    const allContent = zones
      ? [zones.title || '', zones.intro || '', zones.body || '', content].join(
          ' ',
        )
      : content;

    const issues: Array<{
      rule: string;
      severity: 'warning' | 'blocking';
      message: string;
    }> = [];

    // B1: Lexique confusion check
    const confusionIssues = detectConfusion(
      gamme,
      allContent,
      this.matrice.phrases_association_autorisees,
    );
    issues.push(...confusionIssues);

    // B2: Dangerous claims check
    const claimsIssues = detectDangerousClaims(
      gamme,
      allContent,
      this.matrice.termes_globaux_interdits,
    );
    issues.push(...claimsIssues);

    // B6: Confusion pairs check
    const pairsIssues = detectConfusionPairs(
      allContent,
      this.matrice.confusion_pairs,
    );
    issues.push(...pairsIssues);

    // W1: Ambiguous terms check
    const ambiguousIssues = detectAmbiguousTerms(
      allContent,
      this.matrice.ambiguous_terms,
    );
    issues.push(...ambiguousIssues);

    const blockingCount = issues.filter(
      (i) => i.severity === 'blocking',
    ).length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    return {
      valid: blockingCount === 0,
      issues,
      stats: {
        totalIssues: issues.length,
        blockingCount,
        warningCount,
      },
    };
  }

  /**
   * Get all gammes (for listing)
   */
  getAllGammes(): Array<{
    pg_id: number;
    slug: string;
    nom_fr: string;
    famille: string;
  }> {
    if (!this.matrice) return [];

    const result: Array<{
      pg_id: number;
      slug: string;
      nom_fr: string;
      famille: string;
    }> = [];

    for (const famille of this.matrice.familles) {
      for (const gamme of famille.gammes) {
        result.push({
          pg_id: gamme.pg_id,
          slug: gamme.slug,
          nom_fr: gamme.nom_fr,
          famille: famille.code,
        });
      }
    }

    return result.sort((a, b) => a.pg_id - b.pg_id);
  }

  /**
   * Get gammes by famille
   */
  getGammesByFamille(familleCode: string): Gamme[] {
    if (!this.matrice) return [];

    const famille = this.matrice.familles.find((f) => f.code === familleCode);
    return famille?.gammes || [];
  }

  /**
   * Get all confusion pairs
   */
  getConfusionPairs(): typeof this.matrice.confusion_pairs {
    return this.matrice?.confusion_pairs || [];
  }

  /**
   * Get all ambiguous terms
   */
  getAmbiguousTerms(): typeof this.matrice.ambiguous_terms {
    return this.matrice?.ambiguous_terms || [];
  }

  /**
   * Reload matrice from file (for hot-reload scenarios)
   */
  async reloadMatrice(): Promise<void> {
    this.logger.log('Reloading matrice...');
    await this.loadMatrice();
  }
}
