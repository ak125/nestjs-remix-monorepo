import { Injectable } from '@nestjs/common';

/**
 * Service pour nettoyer et normaliser le contenu HTML provenant de la base de données
 * Gère les placeholders vides et les templates incomplets
 */
@Injectable()
export class HtmlContentSanitizerService {
  /**
   * Nettoie le contenu HTML en remplaçant les placeholders vides
   */
  sanitizeHtmlContent(
    content: string,
    context?: {
      marque?: string;
      modele?: string;
      gamme?: string;
      piece?: string;
    },
  ): string {
    if (!content) return content;

    let cleaned = content;

    // 1. Remplacer "de votre  relient" → "de votre véhicule relient"
    cleaned = cleaned.replace(
      /de votre\s{2,}relient/gi,
      'de votre véhicule relient',
    );

    // 2. Remplacer "pour  quoi" → "pour lesquels" ou "pourquoi"
    cleaned = cleaned.replace(/pour\s{2,}quoi/gi, 'pour lesquels');

    // 3. Nettoyer les listes vides "De  , . De  , ."
    cleaned = cleaned.replace(/De\s{2,},\s*\.\s*/gi, '');
    cleaned = cleaned.replace(/de\s{2,},\s*\.\s*/gi, '');

    // 4. Supprimer "Attention : ." incomplet
    cleaned = cleaned.replace(/Attention\s*:?\s*\.\s*<\/span>/gi, '</span>');
    cleaned = cleaned.replace(/Attention&nbsp;:?\s*\.\s*<\/span>/gi, '</span>');

    // 5. Nettoyer les doubles espaces HTML
    cleaned = cleaned.replace(/&nbsp;&nbsp;+/g, '&nbsp;');
    cleaned = cleaned.replace(/\s{3,}/g, ' ');

    // 6. Supprimer les phrases vides finales "."
    cleaned = cleaned.replace(/\.\s*<\/span>\s*<\/p>$/gi, '</span></p>');

    // 7. Si contexte fourni, remplacer les placeholders dynamiques
    if (context) {
      if (context.marque) {
        cleaned = cleaned.replace(/\{marque\}/gi, context.marque);
        cleaned = cleaned.replace(
          /compatible avec votre\s+\./gi,
          `compatible avec votre ${context.marque}.`,
        );
      }

      if (context.modele) {
        cleaned = cleaned.replace(/\{modele\}/gi, context.modele);
      }

      if (context.piece) {
        cleaned = cleaned.replace(/\{piece\}/gi, context.piece);
        cleaned = cleaned.replace(/des\s+pour/gi, `des ${context.piece} pour`);
      }
    }

    return cleaned;
  }

  /**
   * Nettoie les mots-clés SEO
   */
  sanitizeKeywords(keywords: string): string {
    if (!keywords) return keywords;

    // Supprimer keywords vides ou en double
    const keywordList = keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
      .filter((k, i, arr) => arr.indexOf(k) === i); // Déduplique

    return keywordList.join(', ');
  }

  /**
   * Nettoie un objet blog/article complet
   */
  sanitizeBlogContent(
    article: {
      content?: string;
      description?: string;
      keywords?: string;
      preview?: string;
    },
    context?: any,
  ): typeof article {
    return {
      ...article,
      content: article.content
        ? this.sanitizeHtmlContent(article.content, context)
        : article.content,
      description: article.description
        ? this.sanitizeHtmlContent(article.description, context)
        : article.description,
      keywords: article.keywords
        ? this.sanitizeKeywords(article.keywords)
        : article.keywords,
      preview: article.preview
        ? this.sanitizeHtmlContent(article.preview, context)
        : article.preview,
    };
  }

  /**
   * Détecte si un contenu a des placeholders manquants
   */
  hasIncompletePlaceholders(content: string): boolean {
    if (!content) return false;

    const patterns = [
      /de votre\s{2,}[a-z]/i, // "de votre  relient"
      /pour\s{2,}quoi/i, // "pour  quoi"
      /De\s{2,},\s*\./i, // "De  , ."
      /Attention\s*:?\s*\.\s*</i, // "Attention : ."
      /compatible avec votre\s+\./i, // "compatible avec votre ."
    ];

    return patterns.some((pattern) => pattern.test(content));
  }

  /**
   * Analyse et rapporte les problèmes de contenu
   */
  analyzeContent(content: string): {
    hasIssues: boolean;
    issues: string[];
    cleaned: string;
  } {
    const issues: string[] = [];

    if (!content) {
      return { hasIssues: false, issues: [], cleaned: content };
    }

    if (/de votre\s{2,}[a-z]/i.test(content)) {
      issues.push('Placeholder manquant après "de votre"');
    }

    if (/pour\s{2,}quoi/i.test(content)) {
      issues.push('Placeholder manquant dans "pour  quoi"');
    }

    if (/De\s{2,},\s*\./i.test(content)) {
      issues.push('Liste avec placeholders vides');
    }

    if (/Attention\s*:?\s*\.\s*</i.test(content)) {
      issues.push("Texte d'attention incomplet");
    }

    const cleaned = this.sanitizeHtmlContent(content);

    return {
      hasIssues: issues.length > 0,
      issues,
      cleaned,
    };
  }
}
