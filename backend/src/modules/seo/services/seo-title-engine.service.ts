import { Injectable } from '@nestjs/common';

/**
 * SeoTitleEngineService — Moteur de résolution SEO title/meta/H1
 *
 * Chaîne de priorité (P1 → P2 → P3) :
 *   P1: sg_title_draft  (titre optimisé par pipeline R1, validé par IA)
 *   P2: Formule dynamique (data-driven: marques, nb produits, nb véhicules)
 *   P3: sg_title legacy  (fallback DB existant)
 *
 * Objectif : titles transactionnels France-first, uniques par gamme,
 * avec données dynamiques (marques, volumes) pour CTR max en SERP.
 */

export interface SeoTitleContext {
  /** Nom de la gamme tel qu'affiché sur le site */
  pgNameSite: string;
  /** Nom de la gamme pour les meta tags */
  pgNameMeta: string;
  /** Données SEO brutes depuis la RPC (__seo_gamme) */
  seoData?: {
    sg_title?: string | null;
    sg_title_draft?: string | null;
    sg_descrip?: string | null;
    sg_descrip_draft?: string | null;
    sg_keywords?: string | null;
    sg_h1?: string | null;
    sg_content?: string | null;
    [k: string]: unknown;
  };
  /** Statistiques gamme depuis gamme_aggregates */
  gammeStats?: {
    products_total?: number;
    vehicles_total?: number;
  };
  /** Noms des équipementiers (max 6) */
  brandNames?: string[];
}

export interface SeoTitleResult {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  content: string;
  /** Source qui a gagné la résolution */
  titleSource: 'draft' | 'dynamic' | 'legacy' | 'fallback';
  descripSource: 'draft' | 'dynamic' | 'legacy' | 'fallback';
}

/** Longueurs cibles SERP Google 2026 */
const TITLE_MAX = 60;
const DESCRIP_MAX = 155;
const BRAND_NAME = 'AutoMecanik';

@Injectable()
export class SeoTitleEngineService {
  /**
   * Résout title + meta description + H1 avec la chaîne de priorité.
   */
  resolve(ctx: SeoTitleContext): SeoTitleResult {
    const { title, titleSource } = this.resolveTitle(ctx);
    const { description, descripSource } = this.resolveDescription(ctx);
    const h1 = this.resolveH1(ctx);
    const keywords = ctx.seoData?.sg_keywords || ctx.pgNameMeta;
    const content = ctx.seoData?.sg_content || '';

    return {
      title,
      description,
      keywords,
      h1,
      content,
      titleSource,
      descripSource,
    };
  }

  // ─── TITLE ────────────────────────────────────────────────

  private resolveTitle(ctx: SeoTitleContext): {
    title: string;
    titleSource: SeoTitleResult['titleSource'];
  } {
    // P1: Draft pipeline R1 (only if R1-compliant — no price/transactional terms)
    const draft = ctx.seoData?.sg_title_draft;
    if (draft && this.isValidTitle(draft) && !this.hasR1ForbiddenTerms(draft)) {
      return { title: this.ensureBrand(draft), titleSource: 'draft' };
    }

    // P2: Formule dynamique R1 (compatibilité + marques OEM)
    const dynamic = this.buildDynamicTitle(ctx);
    if (dynamic) {
      return { title: dynamic, titleSource: 'dynamic' };
    }

    // P3: Legacy DB (only if R1-compliant)
    const legacy = ctx.seoData?.sg_title;
    if (legacy && legacy.length > 5 && !this.hasR1ForbiddenTerms(legacy)) {
      return { title: legacy, titleSource: 'legacy' };
    }

    // P4: Fallback ultime — gamme + sélection véhicule
    return {
      title: this.truncate(
        `${ctx.pgNameMeta} | Sélection par véhicule | ${BRAND_NAME}`,
        TITLE_MAX,
      ),
      titleSource: 'fallback',
    };
  }

  /**
   * Construit un title R1 data-driven (compatibilité + marques OEM).
   * Cascade de variantes (first-fit ≤ 60 chars) :
   *   V1: "{Gamme} | {Top 3 OEM} | AutoMecanik"
   *   V2: "{Gamme} | {Top 2 OEM} & + | AutoMecanik"
   *   V3: "{Gamme} | {N}+ véhicules compatibles | AutoMecanik"
   *   V4: "{Gamme} | {N}+ références | AutoMecanik"
   *   V5: "{Gamme} — Sélection par véhicule | AutoMecanik"
   */
  private buildDynamicTitle(ctx: SeoTitleContext): string | null {
    const { pgNameMeta, brandNames, gammeStats } = ctx;
    if (!pgNameMeta) return null;

    const productsTotal = gammeStats?.products_total || 0;
    const vehiclesTotal = gammeStats?.vehicles_total || 0;

    // V1: Gamme + marques OEM (meilleur signal confiance)
    if (brandNames && brandNames.length >= 3) {
      const topBrands = brandNames.slice(0, 3).join(', ');
      const v1 = `${pgNameMeta} | ${topBrands} | ${BRAND_NAME}`;
      if (v1.length <= TITLE_MAX) return v1;
    }

    // V2: Gamme + 2 marques (si V1 trop long)
    if (brandNames && brandNames.length >= 2) {
      const topBrands = brandNames.slice(0, 2).join(', ') + ' & +';
      const v2 = `${pgNameMeta} | ${topBrands} | ${BRAND_NAME}`;
      if (v2.length <= TITLE_MAX) return v2;
    }

    // V3: Gamme + nb véhicules compatibles
    if (vehiclesTotal > 100) {
      const count = this.formatCount(vehiclesTotal);
      const v3 = `${pgNameMeta} | ${count}+ véhicules compatibles | ${BRAND_NAME}`;
      if (v3.length <= TITLE_MAX) return v3;
    }

    // V4: Gamme + nb références
    if (productsTotal > 50) {
      const count = this.formatCount(productsTotal);
      const v4 = `${pgNameMeta} | ${count}+ références | ${BRAND_NAME}`;
      if (v4.length <= TITLE_MAX) return v4;
    }

    // V5: Gamme + sélection véhicule
    const v5 = `${pgNameMeta} — Sélection par véhicule | ${BRAND_NAME}`;
    if (v5.length <= TITLE_MAX) return v5;

    // V6: Ultra-court
    return this.truncate(`${pgNameMeta} | ${BRAND_NAME}`, TITLE_MAX);
  }

  // ─── DESCRIPTION ──────────────────────────────────────────

  private resolveDescription(ctx: SeoTitleContext): {
    description: string;
    descripSource: SeoTitleResult['descripSource'];
  } {
    // P1: Draft pipeline R1
    const draft = ctx.seoData?.sg_descrip_draft;
    if (draft && this.isValidDescription(draft)) {
      return {
        description: this.truncate(draft, DESCRIP_MAX),
        descripSource: 'draft',
      };
    }

    // P2: Formule dynamique
    const dynamic = this.buildDynamicDescription(ctx);
    if (dynamic) {
      return { description: dynamic, descripSource: 'dynamic' };
    }

    // P3: Legacy DB
    const legacy = ctx.seoData?.sg_descrip;
    if (legacy && legacy.length > 20) {
      return {
        description: this.truncate(legacy, DESCRIP_MAX),
        descripSource: 'legacy',
      };
    }

    // P4: Fallback R1-compliant (pas de termes transactionnels)
    return {
      description: this.truncate(
        `Trouvez votre ${ctx.pgNameMeta} compatible avec votre véhicule sur ${BRAND_NAME}. Sélection par marque, modèle et motorisation.`,
        DESCRIP_MAX,
      ),
      descripSource: 'fallback',
    };
  }

  /**
   * Construit une meta description data-driven.
   * Inclut : prix min, nb produits, top marques, livraison.
   */
  private buildDynamicDescription(ctx: SeoTitleContext): string | null {
    const { pgNameMeta, brandNames, gammeStats } = ctx;
    if (!pgNameMeta) return null;

    const productsTotal = gammeStats?.products_total || 0;
    const vehiclesTotal = gammeStats?.vehicles_total || 0;
    const parts: string[] = [];

    // Phrase d'accroche R1 : compatibilité + volume
    if (productsTotal > 50) {
      parts.push(
        `Trouvez votre ${pgNameMeta} parmi ${this.formatCount(productsTotal)}+ références`,
      );
    } else {
      parts.push(`Trouvez votre ${pgNameMeta} compatible avec votre véhicule`);
    }

    // Marques OEM
    if (brandNames && brandNames.length >= 2) {
      const topBrands = brandNames.slice(0, 4).join(', ');
      parts.push(`Marques : ${topBrands}`);
    }

    // Véhicules compatibles
    if (vehiclesTotal > 100) {
      parts.push(`${this.formatCount(vehiclesTotal)}+ véhicules compatibles`);
    }

    // CTA R1 : sélection, pas achat
    parts.push('Sélection par marque, modèle et motorisation');

    const result = parts.join('. ') + '.';
    return result.length <= DESCRIP_MAX
      ? result
      : this.truncate(result, DESCRIP_MAX);
  }

  // ─── H1 ───────────────────────────────────────────────────

  private resolveH1(ctx: SeoTitleContext): string {
    // Priorité: sg_h1 existant > formule
    const existing = ctx.seoData?.sg_h1;
    if (existing && typeof existing === 'string' && existing.length > 5) {
      return existing;
    }
    return `${ctx.pgNameSite} — trouvez la référence compatible avec votre véhicule`;
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private isValidTitle(title: string): boolean {
    return (
      typeof title === 'string' &&
      title.length >= 15 &&
      title.length <= 80 &&
      !title.includes('undefined') &&
      !title.includes('null')
    );
  }

  private isValidDescription(desc: string): boolean {
    return (
      typeof desc === 'string' &&
      desc.length >= 30 &&
      !desc.includes('undefined') &&
      !desc.includes('null')
    );
  }

  private ensureBrand(title: string): string {
    if (title.toLowerCase().includes(BRAND_NAME.toLowerCase())) {
      return this.truncate(title, TITLE_MAX);
    }
    const withBrand = `${title} | ${BRAND_NAME}`;
    return withBrand.length <= TITLE_MAX
      ? withBrand
      : this.truncate(title, TITLE_MAX);
  }

  private truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    return text.substring(0, max - 1).trimEnd() + '…';
  }

  private formatCount(n: number): string {
    if (n >= 1000) return Math.floor(n / 1000) + 'k';
    if (n >= 100) return Math.floor(n / 10) * 10 + '';
    return n + '';
  }

  // ─── R1 COMPLIANCE ───────────────────────────────────────

  /** Vérifie si un title contient des termes interdits en R1 (transactionnels) */
  private hasR1ForbiddenTerms(text: string): boolean {
    const lower = text.toLowerCase();
    const forbidden = [
      'pas cher',
      'prix',
      'meilleur prix',
      'à partir de',
      'promo',
      'en stock',
      'acheter',
      'commander',
      'livraison rapide',
      'garantie',
      'satisfait ou remboursé',
      '€',
    ];
    return forbidden.some((term) => lower.includes(term));
  }
}
