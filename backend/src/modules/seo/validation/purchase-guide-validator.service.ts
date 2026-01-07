import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  PURCHASE_GUIDE_VALIDATION,
  ValidationSeverity,
} from './purchase-guide-validation.constants';
import {
  ValidationResult,
  ValidationIssue,
  SeoAuditResult,
} from './purchase-guide-validation.dto';

interface PurchaseGuideRow {
  sgpg_id: number;
  sgpg_pg_id: string;
  sgpg_intro_title: string | null;
  sgpg_intro_role: string | null;
  sgpg_symptoms: string[] | null;
  sgpg_faq: Array<{ question: string; answer: string }> | null;
}

/**
 * Service de validation SEO pour les guides d'achat
 *
 * Ce service valide les guides d'achat selon les critères SEO :
 * - Longueur des meta descriptions (120-160 chars)
 * - Nombre minimum de symptômes (3+)
 * - Nombre minimum de FAQs (3+)
 * - Détection de cannibalisation de titres (similarité Levenshtein ≥ 80%)
 */
@Injectable()
export class PurchaseGuideValidatorService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    PurchaseGuideValidatorService.name,
  );

  constructor(configService: ConfigService) {
    super(configService);
    this.logger.log('PurchaseGuideValidatorService initialized');
  }

  /**
   * Valide un guide d'achat individuel par son pgId
   */
  async validateByPgId(pgId: string): Promise<ValidationResult | null> {
    const { data: guide, error } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select(
        'sgpg_id, sgpg_pg_id, sgpg_intro_title, sgpg_intro_role, sgpg_symptoms, sgpg_faq',
      )
      .eq('sgpg_pg_id', pgId)
      .single();

    if (error || !guide) {
      this.logger.warn(`Guide not found for pgId: ${pgId}`);
      return null;
    }

    return this.validateGuide(guide as PurchaseGuideRow);
  }

  /**
   * Valide un guide d'achat individuel par son ID interne
   */
  async validateById(sgpgId: number): Promise<ValidationResult | null> {
    const { data: guide, error } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select(
        'sgpg_id, sgpg_pg_id, sgpg_intro_title, sgpg_intro_role, sgpg_symptoms, sgpg_faq',
      )
      .eq('sgpg_id', sgpgId)
      .single();

    if (error || !guide) {
      this.logger.warn(`Guide not found for sgpg_id: ${sgpgId}`);
      return null;
    }

    return this.validateGuide(guide as PurchaseGuideRow);
  }

  /**
   * Valide un guide d'achat et retourne les problèmes détectés
   */
  async validateGuide(guide: PurchaseGuideRow): Promise<ValidationResult> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // 1. Validation de la longueur de la description
    const descLength = guide.sgpg_intro_role?.length || 0;
    if (descLength < PURCHASE_GUIDE_VALIDATION.MIN_DESC_LENGTH) {
      errors.push({
        field: 'sgpg_intro_role',
        message: 'Description trop courte',
        severity: ValidationSeverity.ERROR,
        current: descLength,
        expected: PURCHASE_GUIDE_VALIDATION.MIN_DESC_LENGTH,
      });
    } else if (descLength > PURCHASE_GUIDE_VALIDATION.MAX_DESC_LENGTH) {
      warnings.push({
        field: 'sgpg_intro_role',
        message: 'Description trop longue',
        severity: ValidationSeverity.WARNING,
        current: descLength,
        expected: PURCHASE_GUIDE_VALIDATION.MAX_DESC_LENGTH,
      });
    }

    // 2. Validation du nombre de symptômes
    const symptomsCount = Array.isArray(guide.sgpg_symptoms)
      ? guide.sgpg_symptoms.length
      : 0;
    if (symptomsCount < PURCHASE_GUIDE_VALIDATION.MIN_SYMPTOMS) {
      errors.push({
        field: 'sgpg_symptoms',
        message: 'Symptômes insuffisants',
        severity: ValidationSeverity.ERROR,
        current: symptomsCount,
        expected: PURCHASE_GUIDE_VALIDATION.MIN_SYMPTOMS,
      });
    }

    // 3. Validation du nombre de FAQs
    const faqCount = Array.isArray(guide.sgpg_faq) ? guide.sgpg_faq.length : 0;
    if (faqCount < PURCHASE_GUIDE_VALIDATION.MIN_FAQS) {
      errors.push({
        field: 'sgpg_faq',
        message: 'FAQs insuffisantes',
        severity: ValidationSeverity.ERROR,
        current: faqCount,
        expected: PURCHASE_GUIDE_VALIDATION.MIN_FAQS,
      });
    }

    // 4. Vérification de la cannibalisation de titre
    if (guide.sgpg_intro_title) {
      const similarTitle = await this.checkTitleUniqueness(
        guide.sgpg_intro_title,
        guide.sgpg_id,
      );
      if (similarTitle) {
        errors.push({
          field: 'sgpg_intro_title',
          message: `Titre similaire existant: "${similarTitle}"`,
          severity: ValidationSeverity.ERROR,
          current: guide.sgpg_intro_title,
          expected: 'Titre unique',
        });
      }
    }

    // 5. Validation du titre (longueur minimale)
    const titleLength = guide.sgpg_intro_title?.length || 0;
    if (titleLength < PURCHASE_GUIDE_VALIDATION.MIN_TITLE_LENGTH) {
      errors.push({
        field: 'sgpg_intro_title',
        message: 'Titre trop court',
        severity: ValidationSeverity.ERROR,
        current: titleLength,
        expected: PURCHASE_GUIDE_VALIDATION.MIN_TITLE_LENGTH,
      });
    }

    return {
      sgpg_id: guide.sgpg_id,
      sgpg_pg_id: guide.sgpg_pg_id,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Exécute un audit SEO complet sur tous les guides d'achat
   */
  async auditAll(): Promise<SeoAuditResult> {
    this.logger.log('Starting full SEO audit...');

    const { data: guides, error } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select(
        'sgpg_id, sgpg_pg_id, sgpg_intro_title, sgpg_intro_role, sgpg_symptoms, sgpg_faq',
      );

    if (error || !guides) {
      this.logger.error('Failed to fetch guides for audit', error);
      return {
        timestamp: new Date().toISOString(),
        totalGuides: 0,
        validGuides: 0,
        invalidGuides: 0,
        issues: {
          descriptionTooShort: 0,
          descriptionTooLong: 0,
          insufficientSymptoms: 0,
          insufficientFaqs: 0,
          titleCannibalization: 0,
        },
        details: [],
      };
    }

    const details: ValidationResult[] = [];
    const issues = {
      descriptionTooShort: 0,
      descriptionTooLong: 0,
      insufficientSymptoms: 0,
      insufficientFaqs: 0,
      titleCannibalization: 0,
    };

    // Pré-charger tous les titres pour la détection de cannibalisation
    const allTitles = guides
      .filter((g) => g.sgpg_intro_title)
      .map((g) => ({
        id: g.sgpg_id,
        title: g.sgpg_intro_title as string,
      }));

    for (const guide of guides) {
      const result = await this.validateGuideWithTitles(
        guide as PurchaseGuideRow,
        allTitles,
      );
      details.push(result);

      // Compter les problèmes par type
      for (const error of result.errors) {
        switch (error.field) {
          case 'sgpg_intro_role':
            if (error.message.includes('courte')) {
              issues.descriptionTooShort++;
            } else {
              issues.descriptionTooLong++;
            }
            break;
          case 'sgpg_symptoms':
            issues.insufficientSymptoms++;
            break;
          case 'sgpg_faq':
            issues.insufficientFaqs++;
            break;
          case 'sgpg_intro_title':
            if (error.message.includes('similaire')) {
              issues.titleCannibalization++;
            }
            break;
        }
      }
    }

    const validGuides = details.filter((d) => d.isValid).length;

    this.logger.log(
      `SEO Audit complete: ${validGuides}/${guides.length} guides valid`,
    );

    return {
      timestamp: new Date().toISOString(),
      totalGuides: guides.length,
      validGuides,
      invalidGuides: guides.length - validGuides,
      issues,
      details: details.filter((d) => !d.isValid), // Only return invalid guides
    };
  }

  /**
   * Valide un guide avec une liste pré-chargée de titres (optimisation)
   */
  private async validateGuideWithTitles(
    guide: PurchaseGuideRow,
    allTitles: Array<{ id: number; title: string }>,
  ): Promise<ValidationResult> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // 1. Validation de la longueur de la description
    const descLength = guide.sgpg_intro_role?.length || 0;
    if (descLength < PURCHASE_GUIDE_VALIDATION.MIN_DESC_LENGTH) {
      errors.push({
        field: 'sgpg_intro_role',
        message: 'Description trop courte',
        severity: ValidationSeverity.ERROR,
        current: descLength,
        expected: PURCHASE_GUIDE_VALIDATION.MIN_DESC_LENGTH,
      });
    } else if (descLength > PURCHASE_GUIDE_VALIDATION.MAX_DESC_LENGTH) {
      warnings.push({
        field: 'sgpg_intro_role',
        message: 'Description trop longue',
        severity: ValidationSeverity.WARNING,
        current: descLength,
        expected: PURCHASE_GUIDE_VALIDATION.MAX_DESC_LENGTH,
      });
    }

    // 2. Validation du nombre de symptômes
    const symptomsCount = Array.isArray(guide.sgpg_symptoms)
      ? guide.sgpg_symptoms.length
      : 0;
    if (symptomsCount < PURCHASE_GUIDE_VALIDATION.MIN_SYMPTOMS) {
      errors.push({
        field: 'sgpg_symptoms',
        message: 'Symptômes insuffisants',
        severity: ValidationSeverity.ERROR,
        current: symptomsCount,
        expected: PURCHASE_GUIDE_VALIDATION.MIN_SYMPTOMS,
      });
    }

    // 3. Validation du nombre de FAQs
    const faqCount = Array.isArray(guide.sgpg_faq) ? guide.sgpg_faq.length : 0;
    if (faqCount < PURCHASE_GUIDE_VALIDATION.MIN_FAQS) {
      errors.push({
        field: 'sgpg_faq',
        message: 'FAQs insuffisantes',
        severity: ValidationSeverity.ERROR,
        current: faqCount,
        expected: PURCHASE_GUIDE_VALIDATION.MIN_FAQS,
      });
    }

    // 4. Vérification de la cannibalisation de titre (avec liste pré-chargée)
    if (guide.sgpg_intro_title) {
      const similarTitle = this.findSimilarTitle(
        guide.sgpg_intro_title,
        guide.sgpg_id,
        allTitles,
      );
      if (similarTitle) {
        errors.push({
          field: 'sgpg_intro_title',
          message: `Titre similaire existant: "${similarTitle}"`,
          severity: ValidationSeverity.ERROR,
          current: guide.sgpg_intro_title,
          expected: 'Titre unique',
        });
      }
    }

    return {
      sgpg_id: guide.sgpg_id,
      sgpg_pg_id: guide.sgpg_pg_id,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Vérifie l'unicité d'un titre par rapport aux autres guides
   * Retourne le titre similaire trouvé, ou null si unique
   */
  private async checkTitleUniqueness(
    title: string,
    excludeId: number,
  ): Promise<string | null> {
    const { data: guides } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_id, sgpg_intro_title')
      .neq('sgpg_id', excludeId);

    if (!guides) return null;

    for (const g of guides) {
      if (!g.sgpg_intro_title) continue;

      const similarity = this.levenshteinSimilarity(
        title.toLowerCase(),
        g.sgpg_intro_title.toLowerCase(),
      );

      if (similarity >= PURCHASE_GUIDE_VALIDATION.TITLE_SIMILARITY_THRESHOLD) {
        return g.sgpg_intro_title;
      }
    }

    return null;
  }

  /**
   * Trouve un titre similaire dans une liste pré-chargée (version optimisée)
   */
  private findSimilarTitle(
    title: string,
    excludeId: number,
    allTitles: Array<{ id: number; title: string }>,
  ): string | null {
    const normalizedTitle = title.toLowerCase();

    for (const t of allTitles) {
      if (t.id === excludeId) continue;

      const similarity = this.levenshteinSimilarity(
        normalizedTitle,
        t.title.toLowerCase(),
      );

      if (similarity >= PURCHASE_GUIDE_VALIDATION.TITLE_SIMILARITY_THRESHOLD) {
        return t.title;
      }
    }

    return null;
  }

  /**
   * Calcule la similarité Levenshtein entre deux chaînes
   * Retourne un score entre 0 (différent) et 1 (identique)
   */
  private levenshteinSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const len1 = str1.length;
    const len2 = str2.length;

    // Optimization: skip if lengths differ by more than 50%
    if (Math.abs(len1 - len2) / Math.max(len1, len2) > 0.5) {
      return 0;
    }

    // Create matrix
    const matrix: number[][] = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(null));

    // Initialize first row and column
    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    // Fill matrix
    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + cost, // substitution
        );
      }
    }

    const distance = matrix[len2][len1];
    return 1 - distance / Math.max(len1, len2);
  }

  /**
   * Retourne un résumé rapide de l'état SEO
   */
  async getQuickStats(): Promise<{
    total: number;
    shortDescriptions: number;
    insufficientSymptoms: number;
    insufficientFaqs: number;
  }> {
    const { data: guides } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_intro_role, sgpg_symptoms, sgpg_faq');

    if (!guides) {
      return {
        total: 0,
        shortDescriptions: 0,
        insufficientSymptoms: 0,
        insufficientFaqs: 0,
      };
    }

    let shortDescriptions = 0;
    let insufficientSymptoms = 0;
    let insufficientFaqs = 0;

    for (const g of guides) {
      if (
        (g.sgpg_intro_role?.length || 0) <
        PURCHASE_GUIDE_VALIDATION.MIN_DESC_LENGTH
      ) {
        shortDescriptions++;
      }
      if (
        (Array.isArray(g.sgpg_symptoms) ? g.sgpg_symptoms.length : 0) <
        PURCHASE_GUIDE_VALIDATION.MIN_SYMPTOMS
      ) {
        insufficientSymptoms++;
      }
      if (
        (Array.isArray(g.sgpg_faq) ? g.sgpg_faq.length : 0) <
        PURCHASE_GUIDE_VALIDATION.MIN_FAQS
      ) {
        insufficientFaqs++;
      }
    }

    return {
      total: guides.length,
      shortDescriptions,
      insufficientSymptoms,
      insufficientFaqs,
    };
  }
}
