import { Injectable } from '@nestjs/common';

import {
  ResolvedPageSeo,
  ResolvedSeoField,
  SeoSourceStage,
} from '../types/resolved-seo-field';
import {
  SeoFieldGate,
  SEO_BRAND_NAME,
  SEO_RESOLVER_VERSION,
} from '../utils/seo-field-gate';

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

/** Noms courts pour marques composées (évite "FILTER" seul ou "DORIA" seul) */
const BRAND_SHORT: Record<string, string> = {
  'MAURICE LECOY': 'LECOY',
  'MAGNETI MARELLI': 'MAGNETI MARELLI',
  'HERTH+BUSS JAKOPARTS': 'JAKOPARTS',
  'AVA QUALITY COOLING': 'AVA',
  'CALORSTAT BY VERNET': 'CALORSTAT',
  'PRESTOLITE ELECTRIC': 'PRESTOLITE',
  'BUDWEG CALIPER': 'BUDWEG',
  'COOPERS FIAAM': 'FIAAM',
};

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

  // ─── RESOLVER UNIFIÉ (Phase 11, SHADOW) ──────────────────

  /**
   * Resolver unifié (Phase 11) — produit title/desc/h1 via le GATE PARTAGÉ
   * (`SeoFieldGate.brandAwareFit` + `hasForbidden` symétrique) avec provenance complète.
   *
   * NE remplace PAS `resolve()` : introduit en SHADOW (observe-only). Tant que le flip
   * live n'est pas owner-validé, le builder continue d'émettre la sortie legacy de
   * `resolve()` et logge seulement le diff gated-vs-live. Ferme G3 (clip marque-aveugle)
   * et G5 (asymétrie title/desc) par construction. Cf.
   * `audit/seo-producer-chain-unified-verify-2026-06-26.md`.
   */
  resolveGated(ctx: SeoTitleContext): ResolvedPageSeo {
    return {
      title: this.gatedTitle(ctx),
      description: this.gatedDescription(ctx),
      h1: this.gatedH1(ctx),
      surface: 'R1',
      entityKey: `gamme:${ctx.pgNameMeta}`,
    };
  }

  private gatedTitle(ctx: SeoTitleContext): ResolvedSeoField {
    const draft = ctx.seoData?.sg_title_draft;
    const draftPresent = !!(draft && this.isValidTitle(draft));
    // P1: draft validé ET R1-compliant (termes interdits via gate partagé)
    if (draftPresent && !SeoFieldGate.hasForbidden(draft!)) {
      return this.field(
        SeoFieldGate.brandAwareFit(this.ensureBrandRaw(draft!), TITLE_MAX),
        'runtime_db',
        2,
        'sg_title_draft',
        false,
        null,
      );
    }
    // draft présent mais écarté (termes interdits) = signal de dégradation observable
    const dropped = draftPresent;
    const droppedReason = dropped ? 'draft_rejected_forbidden_terms' : null;

    // P2: formule dynamique
    const dynamic = this.buildDynamicTitle(ctx);
    if (dynamic) {
      return this.field(
        dynamic,
        'legacy_switch_validated',
        1,
        'dynamic_formula',
        dropped,
        droppedReason,
      );
    }
    // P3: legacy DB (R1-compliant)
    const legacy = ctx.seoData?.sg_title;
    if (legacy && legacy.length > 5 && !SeoFieldGate.hasForbidden(legacy)) {
      return this.field(
        SeoFieldGate.brandAwareFit(legacy, TITLE_MAX),
        'runtime_db',
        1,
        'sg_title',
        dropped,
        droppedReason,
      );
    }
    // P4: fallback déterministe (non-null par construction)
    return this.field(
      SeoFieldGate.brandAwareFit(
        `${ctx.pgNameMeta} | Sélection par véhicule | ${SEO_BRAND_NAME}`,
        TITLE_MAX,
      ),
      'fallback_deterministic',
      0,
      null,
      true,
      droppedReason ?? 'no_valid_source',
    );
  }

  private gatedDescription(ctx: SeoTitleContext): ResolvedSeoField {
    const draft = ctx.seoData?.sg_descrip_draft;
    const draftPresent = !!(draft && this.isValidDescription(draft));
    // P1: draft validé ET — NOUVEAU — R1-compliant (symétrique au title) = fix G5
    if (draftPresent && !SeoFieldGate.hasForbidden(draft!)) {
      return this.field(
        SeoFieldGate.brandAwareFit(draft!, DESCRIP_MAX),
        'runtime_db',
        2,
        'sg_descrip_draft',
        false,
        null,
      );
    }
    const dropped = draftPresent;
    const droppedReason = dropped ? 'draft_rejected_forbidden_terms' : null;

    // P2: formule dynamique (propre par construction)
    const dynamic = this.buildDynamicDescription(ctx);
    if (dynamic) {
      return this.field(
        dynamic,
        'legacy_switch_validated',
        1,
        'dynamic_formula',
        dropped,
        droppedReason,
      );
    }
    // P3: legacy DB
    const legacy = ctx.seoData?.sg_descrip;
    if (legacy && legacy.length > 20) {
      return this.field(
        SeoFieldGate.brandAwareFit(legacy, DESCRIP_MAX),
        'runtime_db',
        1,
        'sg_descrip',
        dropped,
        droppedReason,
      );
    }
    // P4: fallback déterministe R1-compliant
    return this.field(
      SeoFieldGate.brandAwareFit(
        `Comparez les ${ctx.pgNameMeta} compatibles votre véhicule sur ${SEO_BRAND_NAME}. Filtrez par marque, modèle et motorisation.`,
        DESCRIP_MAX,
      ),
      'fallback_deterministic',
      0,
      null,
      true,
      droppedReason ?? 'no_valid_source',
    );
  }

  private gatedH1(ctx: SeoTitleContext): ResolvedSeoField {
    const formula = `${ctx.pgNameSite} — trouvez la référence compatible avec votre véhicule`;
    const existing = ctx.seoData?.sg_h1;
    if (existing && typeof existing === 'string' && existing.length > 5) {
      // h1 scrubbé symétriquement (attrape une éventuelle fuite de termes interdits)
      if (!SeoFieldGate.hasForbidden(existing)) {
        return this.field(existing, 'runtime_db', 1, 'sg_h1', false, null);
      }
      return this.field(
        formula,
        'fallback_deterministic',
        0,
        null,
        true,
        'h1_rejected_forbidden_terms',
      );
    }
    return this.field(formula, 'fallback_deterministic', 0, null, false, null);
  }

  private ensureBrandRaw(title: string): string {
    if (title.toLowerCase().includes(SEO_BRAND_NAME.toLowerCase()))
      return title;
    return `${title} | ${SEO_BRAND_NAME}`;
  }

  private field(
    value: string,
    sourceStage: SeoSourceStage,
    truthLevel: number,
    sourceId: string | null,
    degraded: boolean,
    degradeReason: string | null,
  ): ResolvedSeoField {
    return {
      value,
      sourceStage,
      truthLevel,
      sourceId,
      evidenceIds: [],
      resolverVersion: SEO_RESOLVER_VERSION,
      degraded,
      degradeReason,
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

    // V2b: Gamme + 1 marque raccourcie (noms de gamme très longs)
    if (brandNames && brandNames.length >= 1) {
      const shortName = BRAND_SHORT[brandNames[0]] || brandNames[0];
      const v2b = `${pgNameMeta} | ${shortName} & + | ${BRAND_NAME}`;
      if (v2b.length <= TITLE_MAX) return v2b;
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
        `Comparez les ${ctx.pgNameMeta} compatibles votre véhicule sur ${BRAND_NAME}. Filtrez par marque, modèle et motorisation.`,
        DESCRIP_MAX,
      ),
      descripSource: 'fallback',
    };
  }

  /**
   * Construit une meta description R1 data-driven.
   * Pattern : "Comparez {N}+ {Gamme} compatibles votre véhicule. Marques : {OEM}. Filtrez par marque, modèle et motorisation."
   */
  private buildDynamicDescription(ctx: SeoTitleContext): string | null {
    const { pgNameMeta, brandNames, gammeStats } = ctx;
    if (!pgNameMeta) return null;

    const productsTotal = gammeStats?.products_total || 0;
    const parts: string[] = [];

    // Accroche R1 : "Comparez" + volume + compatibilité
    if (productsTotal > 50) {
      parts.push(
        `Comparez ${this.formatCount(productsTotal)}+ ${pgNameMeta} compatibles votre véhicule`,
      );
    } else {
      parts.push(`Comparez les ${pgNameMeta} compatibles votre véhicule`);
    }

    // Marques OEM (raccourcies via mapping explicite)
    if (brandNames && brandNames.length >= 2) {
      const topBrands = brandNames
        .slice(0, 4)
        .map((b) => BRAND_SHORT[b] || b)
        .join(', ');
      parts.push(`Marques : ${topBrands}`);
    }

    // CTA R1 action-driven
    parts.push('Filtrez par marque, modèle et motorisation');

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

  /**
   * Vérifie si un texte contient des termes interdits en R1 (transactionnels).
   * Délègue au gate partagé (source unique du tableau — voir SeoFieldGate). Comportement
   * identique au tableau historique ; le test de parité interdit toute dérive.
   */
  private hasR1ForbiddenTerms(text: string): boolean {
    return SeoFieldGate.hasForbidden(text);
  }
}
