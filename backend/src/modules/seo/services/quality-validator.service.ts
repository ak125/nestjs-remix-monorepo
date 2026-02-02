import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface pour un mot interdit
 */
interface ForbiddenWord {
  word: string;
  category: string;
  role: string; // 'ALL' ou 'R1|R4' etc.
  reason: string;
  alternative: string;
}

/**
 * Interface pour un problème de validation
 */
export interface ValidationIssue {
  word: string;
  category: string;
  reason: string;
  alternative: string;
  severity: 'error' | 'warning';
  position?: number;
}

/**
 * Interface pour le résultat de validation
 */
export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100
  recommendations: string[];
}

/**
 * Type pour les rôles de page
 */
export type PageRole = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';

/**
 * Type pour les V-Levels (Volume Level)
 */
export type VLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

/**
 * Configuration V-Level
 */
export interface VLevelConfig {
  minWords: number;
  maxWords: number;
  maxTokens: number;
}

/**
 * Service de validation de qualité SEO
 *
 * Charge les mots interdits depuis forbidden.csv
 * Valide le contenu contre les règles SEO
 * Calcule un score de qualité
 *
 * @example
 * const result = await validator.validateContent(content, 'R4');
 * if (!result.isValid) {
 *   console.log('Issues:', result.issues);
 * }
 */
@Injectable()
export class QualityValidatorService implements OnModuleInit {
  private readonly logger = new Logger(QualityValidatorService.name);
  private forbiddenWords: ForbiddenWord[] = [];
  private readonly forbiddenCsvPath: string;

  /**
   * Configuration V-Level par niveau
   */
  private readonly vLevelConfig: Record<VLevel, VLevelConfig> = {
    L1: { minWords: 80, maxWords: 120, maxTokens: 150 },
    L2: { minWords: 150, maxWords: 250, maxTokens: 300 },
    L3: { minWords: 300, maxWords: 500, maxTokens: 600 },
    L4: { minWords: 600, maxWords: 1000, maxTokens: 1200 },
    L5: { minWords: 1200, maxWords: 1800, maxTokens: 2000 },
  };

  constructor() {
    // Chemin vers le fichier forbidden.csv
    this.forbiddenCsvPath = path.join(
      process.cwd(),
      '.claude/skills/seo-content-architect/data/forbidden.csv',
    );
  }

  /**
   * Charge les mots interdits au démarrage du module
   */
  async onModuleInit() {
    await this.loadForbiddenWords();
  }

  /**
   * Charge les mots interdits depuis le fichier CSV
   */
  private async loadForbiddenWords(): Promise<void> {
    try {
      if (!fs.existsSync(this.forbiddenCsvPath)) {
        this.logger.warn(
          `⚠️ Forbidden words file not found: ${this.forbiddenCsvPath}`,
        );
        return;
      }

      const csvContent = fs.readFileSync(this.forbiddenCsvPath, 'utf-8');
      const lines = csvContent.split('\n');

      this.forbiddenWords = [];

      for (const line of lines) {
        // Ignorer les commentaires et lignes vides
        if (line.startsWith('#') || line.trim() === '') {
          continue;
        }

        // Ignorer l'en-tête
        if (line.startsWith('mot,')) {
          continue;
        }

        const parts = line.split(',');
        if (parts.length >= 5) {
          this.forbiddenWords.push({
            word: parts[0].trim().toLowerCase(),
            category: parts[1].trim(),
            role: parts[2].trim(),
            reason: parts[3].trim(),
            alternative: parts[4].trim(),
          });
        }
      }

      this.logger.log(
        `✅ Loaded ${this.forbiddenWords.length} forbidden words`,
      );
    } catch (error) {
      this.logger.error('❌ Error loading forbidden words:', error);
    }
  }

  /**
   * Détermine le V-Level depuis le volume de recherche
   */
  getVLevel(searchVolume: number): VLevel {
    if (searchVolume < 10) return 'L1';
    if (searchVolume < 100) return 'L2';
    if (searchVolume < 1000) return 'L3';
    if (searchVolume < 10000) return 'L4';
    return 'L5';
  }

  /**
   * Retourne la configuration pour un V-Level
   */
  getVLevelConfig(vLevel: VLevel): VLevelConfig {
    return this.vLevelConfig[vLevel];
  }

  /**
   * Retourne le nombre de tokens max pour un V-Level
   */
  getMaxTokens(vLevel: VLevel): number {
    return this.vLevelConfig[vLevel].maxTokens;
  }

  /**
   * Valide un contenu contre les règles SEO
   *
   * @param content - Le contenu à valider
   * @param pageRole - Le rôle de la page (R1-R6)
   * @returns Le résultat de validation avec score et issues
   */
  validateContent(content: string, pageRole: PageRole): ValidationResult {
    const issues: ValidationIssue[] = [];
    const contentLower = content.toLowerCase();

    // Vérifier chaque mot interdit
    for (const forbidden of this.forbiddenWords) {
      // Vérifier si le mot s'applique à ce rôle
      if (!this.isRoleAffected(forbidden.role, pageRole)) {
        continue;
      }

      // Rechercher le mot dans le contenu
      const wordRegex = new RegExp(
        `\\b${this.escapeRegex(forbidden.word)}\\b`,
        'gi',
      );
      const match = wordRegex.exec(contentLower);

      if (match) {
        issues.push({
          word: forbidden.word,
          category: forbidden.category,
          reason: forbidden.reason,
          alternative: forbidden.alternative,
          severity: this.getSeverity(forbidden.category),
          position: match.index,
        });
      }
    }

    // Calculer le score
    const score = this.calculateScore(issues, content);

    // Générer les recommandations
    const recommendations = this.generateRecommendations(
      issues,
      content,
      pageRole,
    );

    return {
      isValid: issues.length === 0,
      issues,
      score,
      recommendations,
    };
  }

  /**
   * Vérifie si un rôle est affecté par une règle
   */
  private isRoleAffected(ruleRole: string, pageRole: PageRole): boolean {
    if (ruleRole === 'ALL') {
      return true;
    }

    // Gérer les règles avec pipe (ex: "R4|R5")
    const affectedRoles = ruleRole.split('|');
    return affectedRoles.includes(pageRole);
  }

  /**
   * Détermine la sévérité selon la catégorie
   */
  private getSeverity(category: string): 'error' | 'warning' {
    const errorCategories = ['superlatif', 'juridique', 'commercial', 'absolu'];
    return errorCategories.includes(category) ? 'error' : 'warning';
  }

  /**
   * Calcule le score de qualité (0-100)
   */
  private calculateScore(issues: ValidationIssue[], content: string): number {
    const baseScore = 100;
    let penalty = 0;

    for (const issue of issues) {
      if (issue.severity === 'error') {
        penalty += 15;
      } else {
        penalty += 5;
      }
    }

    // Pénalité si contenu trop court
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 50) {
      penalty += 10;
    }

    return Math.max(0, baseScore - penalty);
  }

  /**
   * Génère des recommandations d'amélioration
   */
  private generateRecommendations(
    issues: ValidationIssue[],
    content: string,
    pageRole: PageRole,
  ): string[] {
    const recommendations: string[] = [];

    // Recommandations basées sur les issues
    const categories = new Set(issues.map((i) => i.category));

    if (categories.has('superlatif')) {
      recommendations.push(
        'Évitez les superlatifs non vérifiables (meilleur, top, n°1)',
      );
    }

    if (categories.has('prix')) {
      recommendations.push(
        'Les mentions de prix appartiennent aux pages produit (R2)',
      );
    }

    if (
      categories.has('commercial') &&
      (pageRole === 'R4' || pageRole === 'R5')
    ) {
      recommendations.push(
        'Les pages référence/diagnostic ne doivent pas contenir de CTA commerciaux',
      );
    }

    if (categories.has('vehicule') && pageRole === 'R4') {
      recommendations.push(
        'Les pages R4 doivent rester génériques, sans mention de marques/modèles',
      );
    }

    // Recommandations de longueur
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 100) {
      recommendations.push(
        `Contenu trop court (${wordCount} mots). Minimum recommandé: 100 mots`,
      );
    }

    return recommendations;
  }

  /**
   * Échappe les caractères spéciaux regex
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Auto-corrige le contenu en remplaçant les mots interdits
   *
   * @param content - Le contenu original
   * @param issues - Les problèmes identifiés
   * @returns Le contenu corrigé
   */
  autoCorrectContent(content: string, issues: ValidationIssue[]): string {
    let corrected = content;

    for (const issue of issues) {
      if (issue.alternative && issue.alternative !== 'supprimer') {
        const wordRegex = new RegExp(
          `\\b${this.escapeRegex(issue.word)}\\b`,
          'gi',
        );
        corrected = corrected.replace(wordRegex, issue.alternative);
      }
    }

    return corrected;
  }

  /**
   * Retourne le nombre de mots interdits chargés
   */
  getForbiddenWordsCount(): number {
    return this.forbiddenWords.length;
  }

  /**
   * Retourne la liste des mots interdits par catégorie
   */
  getForbiddenWordsByCategory(): Record<string, ForbiddenWord[]> {
    const byCategory: Record<string, ForbiddenWord[]> = {};

    for (const word of this.forbiddenWords) {
      if (!byCategory[word.category]) {
        byCategory[word.category] = [];
      }
      byCategory[word.category].push(word);
    }

    return byCategory;
  }

  /**
   * Recharge les mots interdits (utile après mise à jour du fichier)
   */
  async reloadForbiddenWords(): Promise<number> {
    await this.loadForbiddenWords();
    return this.forbiddenWords.length;
  }
}
